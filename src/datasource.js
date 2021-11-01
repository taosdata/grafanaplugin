import _ from "lodash";
var moment = require('./js/moment-timezone-with-data');
export class GenericDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    // console.log("instanceSettings",instanceSettings);
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.headers = { 'Content-Type': 'application/json' };
    this.headers.Authorization = this.getAuthorization(instanceSettings.jsonData);
    this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.generateSqlList = {};
  }

  query(options) {
    // console.log('options',options);
    if (options.timezone) {
      this.timezone = options.timezone == "browser"?Intl.DateTimeFormat().resolvedOptions().timeZone:options.timezone;
    }
    const targets = options.targets.filter((target) => (!target.queryType||target.queryType === "SQL")&&target.sql&&!(target.hide === true));
    if (targets.length <= 0) {
      return this.q.when({ data: [] });
    }
    return Promise.all(targets.map(target => {
      let sql = this.generateSql(target.sql,options);
      this.generateSqlList[target.refId]=sql;
      return this.request('/rest/sqlutc',sql).then(res => this.postQuery(target,res,options));
    }))
      .then(data => {
        let result = this.arithmeticQueries(data,options).flat();
        // console.log('result',result);
        return {data:result};
      },(err)=>{
        console.log(err);
        if (err.data&&err.data.desc) {
          throw new Error(err.data.desc);
        }else{
          throw new Error(err);
        }
      });
  }

  testDatasource() {
    return this.request('/rest/sqlutc','show databases').then(response => {
        if (!!response && response.status === 200) {
          return { status: "success", message: "TDengine Data source is working", title: "Success" };
        }
        return { status: "error", message: "TDengine Data source is not working", title: "Failed" };
      });
  }

  request(url , params) {
    if (!params) {
      return new Promise((resolve, reject)=>{
        resolve();
      });
    }
    return this.backendSrv.datasourceRequest({
      url: `${this.url}${url}`,
      data: params,
      method: 'POST',
      headers: this.headers,
    });
  }

  getRowAlias(alias, aliasRow,options) {
    if (!alias) {
      return aliasRow;
    }
    alias = this.generateSql(alias,options);
    const regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
    return alias.replace(regex,(match, g1, g2) => {
      const group = g1 || g2;

      if (group === 'col') {
        return aliasRow;
      }
      return match;
    });
  }
  generateSql(sql,options) {
    // console.log('sql',sql);
    if (!sql||sql.length == 0) {
      return sql;
    }

    var queryStart = "now-1h";
    var queryEnd = "now";
    var intervalMs = "20000";
    if (!!options) {
      if (!!options.range && !!options.range.from ) {
        queryStart = options.range.from.toISOString();
      }
  
      if (!!options.range && !!options.range.to ) {
        queryEnd = options.range.to.toISOString();
      }
      
      if (!!options.intervalMs ) {
        intervalMs = options.intervalMs.toString();
      }
  
      sql = this.templateSrv.replace(sql, options.scopedVars, 'csv');
    }
    
    intervalMs += "a";
    sql = sql.replace(/^\s+|\s+$/gm, '');
    sql = sql.replace("$from", "'" + queryStart + "'");
    sql = sql.replace("$begin", "'" + queryStart + "'");
    sql = sql.replace("$to", "'" + queryEnd + "'");
    sql = sql.replace("$end", "'" + queryEnd + "'");
    sql = sql.replace("$interval", intervalMs);
    
    const allVaribles = this.templateSrv.getVariables ? this.templateSrv.getVariables() : this.templateSrv.variables||[];
    for (let i = 0; i < allVaribles.length; i++) {
      if (allVaribles[i].current&&allVaribles[i].current.value) {
        sql = sql.replace("$"+allVaribles[i].name, allVaribles[i].current.value);
      }
    }

    return sql;
  }

  groupDataByColName(dataRecv,colName) {
    if(!colName||colName.length==0) {
      return [dataRecv];
    }
    for (let index = 0; index < dataRecv.column_meta.length; index++) {
      if (dataRecv.column_meta[index][0]==colName) {
        let groupData = {};
        let headers = dataRecv.column_meta;
        const data = dataRecv.data;
        const rows = dataRecv.rows;
        const cols = headers.length;
        for (let rowsIndex = 0; rowsIndex < rows; rowsIndex++) {
          let groupColValue = data[rowsIndex][index];
          if (!groupData[groupColValue]) {
            groupData[groupColValue]={column_meta:[],data:[],rows:0};
            for (let k = 0; k < dataRecv.column_meta.length; k++) {
              if (k!=index) {
                groupData[groupColValue].column_meta.push([...dataRecv.column_meta[k]]);
                if (!(k==0&&dataRecv.column_meta[k][1]==9)) {
                  groupData[groupColValue].column_meta[groupData[groupColValue].column_meta.length-1][0]+="_"+groupColValue;
                }
              }
            }
            groupData[groupColValue].column_meta;
          }
          data[rowsIndex].splice(index,1);
          groupData[groupColValue].data.push(data[rowsIndex]);
          groupData[groupColValue].rows+=1;
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

  postQuery(query, response,options) {
    // console.log('query',query);
    // console.log('response',response);
    if (!response||!response.data||!response.data.data) {
      return [];
    }
    let dataGroupList = this.groupDataByColName(response.data,query.colName);
    const result = [];
    const aliasList = (query.alias||'').split(',')||[];
    let aliasListIndex = 0;
    for (let index = 0; index < dataGroupList.length; index++) {
      const headers = dataGroupList[index].column_meta;
      const data = dataGroupList[index].data;
      const rows = dataGroupList[index].rows;
      const cols = headers.length;
      if (!!headers&&!!headers[0]&&!!headers[0][1]) {
        const timeSeriesIndex = headers.findIndex(item => item[1] === 9);
        if (timeSeriesIndex == -1||query.formatType == 'Table') {
          result.push({columns:headers.map(item => ({text:item[0]})),rows:data,type:'table',refId:query.refId,target:this.getRowAlias(aliasList[0],headers[0][0],options),hide:!!query.hide});
        }else{
          for (let i = 0; i < cols; i++) {
            if (i == timeSeriesIndex) {
              continue;
            }
            let aliasRow = headers[i][0];
            if (aliasListIndex<aliasList.length) {
              aliasRow = this.getRowAlias(aliasList[aliasListIndex],aliasRow,options);
              aliasListIndex++;
            }
            let resultItem = {datapoints:[],refId:query.refId,target:aliasRow,hide:!!query.hide};
            for (let k = 0; k < rows; k++) {
              let timeShiftDuration = moment.duration();
              if (query.timeshift&&query.timeshift.period&&query.timeshift.unit) {
                timeShiftDuration = moment.duration(query.timeshift.period,query.timeshift.unit);
              }
              resultItem.datapoints.push([data[k][i],moment.utc(data[k][timeSeriesIndex]).tz(this.timezone).add(timeShiftDuration).valueOf()]);
            }
            result.push(resultItem);
          }
        }
      }
    }
    // console.log('result',result);
    return result;
  }
  arithmeticQueries(data,options) {
    const arithmeticQueries = options.targets.filter((target) => target.queryType === "Arithmetic"&&target.expression&&!(target.hide === true));
    if (arithmeticQueries.length == 0) return data;
    let targetRefIds = data.flatMap((item)=>item.flatMap((field,index)=>(index == 0?[field.refId,field.refId+'__'+index]:[field.refId+'__'+index])));
    // console.log('targetRefIds',targetRefIds);
    let targetResults = {};
    data.forEach((item)=>{
      item.forEach((field,index)=>{
        field.datapoints.forEach(datapoint => {
          targetResults[datapoint[1]] = targetResults[datapoint[1]]||[];
          if (index == 0) {
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
        const aliasList = (target.alias||'').split(',').map(alias => this.getRowAlias(alias,target.refId,options));

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
          result.forEach((item,index)=>{
            aliasListResult[index] = aliasListResult[index]||{datapoints:[],refId:target.refId,target:aliasList[index]||(target.refId+'__'+index),hide:!!target.hide};
            aliasListResult[index].datapoints.push([item,parseInt(args[0])]);
          })
        });
        return aliasListResult;
      });
      return data.concat(dataArithmetic);
    }catch (err) {
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

  getAuthorization(jsonData) {
    jsonData = jsonData || {};
    var defaultUser = jsonData.user || "root";
    var defaultPassword = jsonData.password || "taosdata";

    return "Basic " + this.encode(defaultUser + ":" + defaultPassword);
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
    // console.log('options',options);
    return this.request('/rest/sqlutc', this.generateSql(query,options)).then(res => {
      if (!res||!res.data||!res.data.data) {
        return [];
      }else{
        console.log('res',res);
        let values = [];
        for (let i = 0; i < res.data.data.length; i++) {
          values.push({text:''+res.data.data[i]});
        }
        return values;
      }
    });
  }
}
