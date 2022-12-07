import _ from "lodash";

var moment = require('./js/moment-timezone-with-data');

export class GenericDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    // console.log("instanceSettings",instanceSettings);
    this.pluginId = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.headers = {'Content-Type': 'application/json'};
    this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.generateSqlList = {};
    this.serverVersion = 0;
  }

  query(options) {
    // console.log('options',options);
    if (options.timezone) {
      this.timezone = options.timezone === "browser" ? Intl.DateTimeFormat().resolvedOptions().timeZone : options.timezone;
    }
    const targets = options.targets.filter((target) => (!target.queryType || target.queryType === "SQL") && target.sql && !(target.hide === true));
    if (targets.length <= 0) {
      return this.q.when({data: []});
    }
    return Promise.all(targets.map(target => {
      let sql = this.generateSql(target.sql, options);
      this.generateSqlList[target.refId] = sql;
      return this.request(sql).then(res => this.postQuery(target, res, options));
    }))
      .then(data => {
        let result = this.arithmeticQueries(data, options).flat();
        // console.log('result',result);
        return {data: result};
      }, (err) => {
        console.log(err);
        if (err.data && err.data.desc) {
          throw new Error(err.data.desc);
        } else {
          throw new Error(err);
        }
      });
  }

  testDatasource() {
    return this.request('show databases').then(response => {
      if (!!response && response.status === 200 && !_.get(response, 'data.code')) {
        return {status: "success", message: "TDengine Data source is working", title: "Success"};
      }
      return {
        status: "error",
        message: "TDengine Data source is not working, reason: " + response.data.message,
        title: "Failed"
      };
    });
  }

  request(params) {
    if (!params) {
      return new Promise((resolve, reject) => {
        resolve();
      });
    }
    return this.querySql(params);
  }

  querySql(params) {
    return this.backendSrv.datasourceRequest({
      url: this.url + "/v1/device/sql",
      data: params,
      method: 'POST',
    }).then((result) => {
      result.data = this.convertResult(result.data);
      return result;
    }).catch(err => {
      console.log("catch error: ", err);
    });
  }



  convertResult(src) {
    var dist = {}
    if (src.code === 0) {
      dist.status = "succ";
      dist.column_meta = src.column_meta;
      dist.column_meta.forEach(element => {
        if (element[1] === "TIMESTAMP") {
          element[1] = 9;
        }
      });
      dist.data = src.data;
      dist.rows = src.rows;
    } else {
      dist.status = "error";
      dist.code = src.code;
      dist.desc = src.desc;
    }
    return dist;
  }

  requestResources(url, params) {
    return this.backendSrv.datasourceRequest({
      url: `/api/plugins/${this.pluginId}/resources${url}`,
      data: params,
      method: 'POST',
    });
  }

  getRowAlias(alias, replaceObject, options) {
    if (!alias) {
      return Object.values(replaceObject)[0];
    }
    alias = this.generateSql(alias, options);
    const regex = /\$(\w+)|\[\[([\s\S]+?)\]\]|\{\{([\s\S]+?)\}\}/g;
    return alias.replace(regex, (match, g1, g2, g3) => {
      const group = g1 || g2 || g3;
      return replaceObject[group] || match;
    });
  }

  generateSql(sql, options) {
    console.log('sql',sql);
    if (!sql || sql.length === 0) {
      return sql;
    }

    var queryStart = "now-1h";
    var queryEnd = "now";
    var intervalMs = "20000";
    if (!!options) {
      if (!!options.range && !!options.range.from) {
        queryStart = options.range.from.toISOString();
      }

      if (!!options.range && !!options.range.to) {
        queryEnd = options.range.to.toISOString();
      }

      if (!!options.intervalMs) {
        intervalMs = options.intervalMs.toString();
      }

      sql = this.templateSrv.replace(sql, options.scopedVars, 'csv');
    }

    intervalMs += "a";
    sql = sql.replace(/^\s+|\s+$/gm, '');
    if (queryStart.indexOf("now") < 0) {
      sql = sql.replace(/\$from/g, "'" + queryStart + "'");
      sql = sql.replace(/\$begin/g, "'" + queryStart + "'");
    } else {
      sql = sql.replace(/\$from/g, queryStart);
      sql = sql.replace(/\$begin/g, queryStart);
    }
    if (queryEnd.indexOf("now") < 0) {
      sql = sql.replace(/\$to/g, "'" + queryEnd + "'");
      sql = sql.replace(/\$end/g, "'" + queryEnd + "'");
    } else {
      sql = sql.replace(/\$to/g, queryEnd);
      sql = sql.replace(/\$end/g, queryEnd);
    }
    sql = sql.replace(/\$interval/g, intervalMs);

    const allVaribles = this.templateSrv.getVariables ? this.templateSrv.getVariables() : this.templateSrv.variables || [];
    for (let i = 0; i < allVaribles.length; i++) {
      if (allVaribles[i].current && allVaribles[i].current.value) {
        sql = sql.replace("$" + allVaribles[i].name, allVaribles[i].current.value);
      }
    }

    return sql;
  }

  long2wide(recv, by) {
    let data = recv.data;
    let header = recv.column_meta;
    let rows = recv.rows;
    if (_.size(by) === 0) {
      return recv;
    }

    let name2idx = _(header).map((h, i) => [h[0], i]).fromPairs().value();
    _.remove(by, k => !_.has(name2idx, k));

    if (_.size(by) === 0) {
      return recv;
    }

    let [colKick, colLock] = _(header).slice(1).partition(h => _.includes(by, h[0])).value();

    let newHeader = [header[0]];

    let fields = _.map(colLock, (h, i) => {
      let colValue = _(colKick).map(col => {
        let idx = name2idx[col[0]];
        return _(data).map(row => row[idx]).uniq().map(v => _.fromPairs([[col[0], v]])).value();
      }).reduce((acc, cur) => {
        return _(acc).map(o => {
          return _.map(cur, n => _.extend({}, o, n))
        }).flatten().value()
      });
      return {field: h, name: h[0], labels: colValue};
    });

    let ts = _(data).map(row => row[0]).orderBy().uniq().value();

    // values long to wide
    _.forEach(fields, field => {
      let col = name2idx[field.name];
      field.labels = _(field.labels).map(label => {
        let values = _(data).filter(row => {
          return _(label).map((v, f) => row[name2idx[f]] === v).reduce((acc, cur) => acc && cur)
        }).map(row => [row[0], row[col]]).fromPairs().value();
        if (_.size(values) > 0) {
          return _.extend(label, {__values__: values});
        } else {
          return null;
        }
      }).filter().value();
    });

    // rebuild headers
    _.forEach(fields, field => {
      _.forEach(field.labels, label => {
        let newField = _.cloneDeep(field.field);
        let labelName = _(label).keys().filter(k => k !== '__values__').map(key => [key, label[key]]).fromPairs().value();
        console.log("label:", label, labelName);

        newField[0] = field.name + " " + JSON.stringify(labelName);
        newHeader.push(newField);
      })
    })

    // construct new data
    let newData = _.map(ts, t => {
      let row = [t];
      _.forEach(fields, field => {
        _.forEach(field.labels, label => {
          row.push(_.get(label.__values__, t));
        })
      });
      return row;
    })

    return {data: newData, column_meta: newHeader, rows: _.size(ts)};
    ;
  }

  groupDataByColName(dataRecv, query, options) {
    if (query.formatType === "Time series" && query.queryType === "SQL") {
      let groupBy = null;
      if (!!query.colNameToGroup) {
        groupBy = _.trim(query.colNameToGroup);
      } else {

        let m = query.sql.match(/group +by +([^()\s,]+(,\s*\S+)*)\s*[^(,)]*$/);
        if (m) {
          groupBy = m[1];
        } else {
          return [dataRecv];
        }

        let by = _(groupBy).split(",").map(s => _.trim(s)).value();
        if (_.size(by) > 0) {
          return [this.long2wide(dataRecv, by)];
        } else {
          return [dataRecv];
        }
      }
      if (!groupBy || query.colNameToGroup.length === 0) {
        return [dataRecv];
      }

      let by = _(groupBy).split(",").map(s => _.trim(s)).value();
      if (_.size(by) > 0) {
        return [this.long2wide(dataRecv, by)];
      } else {
        return [dataRecv];
      }
    }

    if (!query.colNameToGroup || query.colNameToGroup.length === 0) {
      return [dataRecv];
    }

    for (let index = 0; index < dataRecv.column_meta.length; index++) {
      if (dataRecv.column_meta[index][0] === query.colNameToGroup) {
        let groupData = {};
        let headers = dataRecv.column_meta;
        const data = dataRecv.data;
        const rows = dataRecv.rows;
        const cols = headers.length;
        for (let rowsIndex = 0; rowsIndex < rows; rowsIndex++) {
          let groupColValue = data[rowsIndex][index];
          if (!groupData[groupColValue]) {
            groupData[groupColValue] = {column_meta: [], data: [], rows: 0};
            for (let k = 0; k < dataRecv.column_meta.length; k++) {
              if (k !== index) {
                let header = [...dataRecv.column_meta[k]];
                if (!(k === 0 && header[1] === 9)) {
                  header[0] = this.getRowAlias(query.colNameFormatStr || "{{colName}}_{{groupValue}}", {
                    colName: header[0],
                    groupValue: groupColValue
                  }, options);
                }
                groupData[groupColValue].column_meta.push(header);
              }
            }
            groupData[groupColValue].column_meta;
          }
          data[rowsIndex].splice(index, 1);
          groupData[groupColValue].data.push(data[rowsIndex]);
          groupData[groupColValue].rows += 1;
        }
        let keys = Object.keys(groupData).sort();
        let groupDataRet = [];
        for (let indexKeys = 0; indexKeys < keys.length; indexKeys++) {
          groupDataRet.push(groupData[keys[indexKeys]]);
        }
        return groupDataRet;
      }
    }
    return [dataRecv];
  }

  postQuery(query, response, options) {
    console.log('query',query);
    console.log('response1111',response);
    if (!response || !response.data || !response.data.data) {
      return [];
    }
    let dataGroupList = this.groupDataByColName(response.data, query, options);
    const result = [];
    const aliasList = (query.alias || '').split(',') || [];
    let aliasListIndex = 0;
    for (let index = 0; index < dataGroupList.length; index++) {
      const headers = dataGroupList[index].column_meta;
      const data = dataGroupList[index].data;
      const rows = dataGroupList[index].rows;
      const cols = headers.length;
      if (!!headers && !!headers[0] && !!headers[0][1]) {
        const timeSeriesIndex = headers.findIndex(item => item[1] === 9);
        if (timeSeriesIndex === -1 || query.formatType === 'Table') {
          result.push({
            columns: headers.map(item => ({text: item[0]})),
            rows: data,
            type: 'table',
            refId: query.refId,
            target: this.getRowAlias(aliasList[0], {col: headers[0][0]}, options),
            hide: !!query.hide
          });
        } else {
          for (let i = 0; i < cols; i++) {
            if (i === timeSeriesIndex) {
              continue;
            }
            let aliasRow = headers[i][0];
            if (aliasListIndex < aliasList.length) {
              aliasRow = this.getRowAlias(aliasList[aliasListIndex], {col: aliasRow}, options);
              aliasListIndex++;
            }
            let resultItem = {datapoints: [], refId: query.refId, target: aliasRow, hide: !!query.hide};
            for (let k = 0; k < rows; k++) {
              let timeShiftDuration = moment.duration();
              if (query.timeshift && query.timeshift.period && query.timeshift.unit) {
                timeShiftDuration = moment.duration(query.timeshift.period, query.timeshift.unit);
              }
              resultItem.datapoints.push([data[k][i], moment.utc(data[k][timeSeriesIndex]).tz(this.timezone).add(timeShiftDuration).valueOf()]);
            }
            result.push(resultItem);
          }
        }
      }
    }
    // console.log('result',result);
    return result;
  }

  arithmeticQueries(data, options) {
    const arithmeticQueries = options.targets.filter((target) => target.queryType === "Arithmetic" && target.expression && !(target.hide === true));
    if (arithmeticQueries.length === 0) return data;
    let targetRefIds = data.flatMap((item) => item.flatMap((field, index) => (index === 0 ? [field.refId, field.refId + '__' + index] : [field.refId + '__' + index])));
    // console.log('targetRefIds',targetRefIds);
    let targetResults = {};
    data.forEach((item) => {
      item.forEach((field, index) => {
        field.datapoints.forEach(datapoint => {
          targetResults[datapoint[1]] = targetResults[datapoint[1]] || [];
          if (index === 0) {
            targetResults[datapoint[1]].push(datapoint[0]);
          }
          targetResults[datapoint[1]].push(datapoint[0]);
        })
      })
    });

    try {
      let dataArithmetic = arithmeticQueries.map(target => {
        let functionArgs = targetRefIds.join(', ');
        let functionBody = "return (" + target.expression + ");";
        let expressionFunction = new Function(functionArgs, functionBody);
        let result = null;
        const aliasList = (target.alias || '').split(',').map(alias => this.getRowAlias(alias, {col: target.refId}, options));

        const aliasListResult = [];
        Object.entries(targetResults).forEach(args => {
          if (args[1].length === targetRefIds.length) {
            try {
              result = expressionFunction.apply(this, args[1]);
            } catch (error) {
              throw error
            }
          }
          // else{
          //   console.log('args not full',targetRefIds,args);
          // }
          if (!Array.isArray(result)) {
            result = [result];
          }
          result.forEach((item, index) => {
            aliasListResult[index] = aliasListResult[index] || {
              datapoints: [],
              refId: target.refId,
              target: aliasList[index] || (target.refId + '__' + index),
              hide: !!target.hide
            };
            aliasListResult[index].datapoints.push([item, parseInt(args[0])]);
          })
        });
        return aliasListResult;
      });
      return data.concat(dataArithmetic);
    } catch (err) {
      // console.log(err);
      throw new Error(err);
    }
  }

  encode(input) {
    var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;
    while (i < input.length) {
      chr1 = input.charCodeAt(i++);
      chr2 = input.charCodeAt(i++);
      chr3 = input.charCodeAt(i++);
      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;
      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }
      output = output + _keyStr.charAt(enc1) + _keyStr.charAt(enc2) + _keyStr.charAt(enc3) + _keyStr.charAt(enc4);
    }

    return output;
  }

  generateTimeshift(options, target) {
    var alias = target.alias || "";
    alias = this.templateSrv.replace(alias, options.scopedVars, 'csv');
    return alias;
  }

  generateAlias(options, target) {
    var alias = target.alias || "";
    alias = this.templateSrv.replace(alias, options.scopedVars, 'csv');
    return alias;
  }

  metricFindQuery(query, options) {
    // console.log('query',query);
    // console.log('options',options);
    return this.request(this.generateSql(query, options)).then(res => {
      if (!res || !res.data || !res.data.data) {
        return [];
      } else {
        // console.log('res',res);
        let values = [];
        for (let i = 0; i < res.data.data.length; i++) {
          values.push({text: '' + res.data.data[i]});
        }
        return values;
      }
    });
  }
}
