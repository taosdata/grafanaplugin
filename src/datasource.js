import _ from "lodash";
import "moment";

export class GenericDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.headers = { 'Content-Type': 'application/json' };
    this.headers.Authorization = this.getAuthorization(instanceSettings.jsonData);
  }

  query(options) {
    var targets = this.buildQueryParameters(options);

    if (targets.length <= 0) {
      return this.q.when({ data: [] });
    }

    return this.doRequest({
      url: this.url + '/grafana/query',
      data: targets,
      method: 'POST'
    });
  }

  testDatasource() {
    return this.backendSrv
      .datasourceRequest({
        headers: this.headers,
        url: this.url + '/grafana/heartbeat',
        method: 'GET',
      }).then(response => {
        if (!!response && response.status === 200) {
          return { status: "success", message: "TDengine Data source is working", title: "Success" };
        }
        return { status: "error", message: "TDengine Data source is not working", title: "Failed" };
      });
  }

  postQuery(options, res) {
    res.data = _.map(res.data, function (data) {
      let target = _.find(options.data, { refId: data.refId });
      if (_.isObject(target.timeshift) && !!target.timeshift.period) {
        data.datapoints = _(data.datapoints).map(datapoint => {
          const unit2millis = {
            seconds: 1000,
            minutes: 60 * 1000,
            hours: 60 * 60 * 1000,
            days: 24 * 60 * 60 * 1000,
            weeks: 7 * 24 * 60 * 60 * 1000,
            months: 30 * 24 * 60 * 60 * 1000,
          };
          datapoint[1] += target.timeshift.period * unit2millis[target.timeshift.unit];
          return datapoint
        }).value();
      }
      data.hide = target.hide;
      return data;
    });
    return res;
  }
  arithmeticQueries(options, res, sqlQueries) {
    let arithmeticQueries = _.filter(options.data, { queryType: "Arithmetic" });
    if (_.size(arithmeticQueries) == 0) return res;
    let targetRefIds = _.map(sqlQueries, ({ refId }) => refId);
    let targetResults = _(res.data).map(target => [target.refId, target]).fromPairs().value();
    let data = _.map(arithmeticQueries, target => {
      let functionArgs = targetRefIds.join(', ');
      let functionBody = "return (" + target.expression + ");";
      let expressionFunction = new Function(functionArgs, functionBody);

      let datapoints = _(targetResults).values()
        .flatMap(result => _.map(result.datapoints, datapoint => {
          return { value: datapoint[0], ts: datapoint[1], refId: result.refId };
        }))
        .groupBy('ts')
        .map((datapoints, ts) => {
          let dps = _(datapoints).map(dp => [dp.refId, dp.value]).fromPairs().value();
          let args = _.map(targetRefIds, refId => _.get(dps, refId));
          let result = null;
          try {
            result = expressionFunction.apply(this, args)
          }
          catch (err) {
            console.error("expression function eval error:", err);
          }
          let tsint = parseInt(ts);
          return [result, _.isNaN(tsint) ? ts : tsint]
        })
        .value();
      return { ...target, target: target.alias, refId: target.refId, datapoints };
    });
    res.data = _.concat(res.data, data);
    return res
  }

  doRequest(options) {
    options.headers = this.headers;
    let sqlQueries = _.filter(options.data, (target) => !_.get(target, "queryType") || _.get(target, 'queryType') === "SQL");
    let ops = _.map(sqlQueries, target => {
      return { ...options, data: [target] }
    });

    return Promise.all(_.map(ops, target => {
      return this.backendSrv
        .datasourceRequest(target)
        .then(res => this.postQuery(options, res));
    }))
      .then(res => {
        return { ...res[0], data: _.flatMap(res, ({ data }) => data) };
      }).then(res => this.arithmeticQueries(options, res, sqlQueries))
      .then(res => {
        this.result = res;
        try {
          this.$scope.$digest();
        } catch(err) {
        }
        return res;
      });
  }

  fetchMetricNames(query) {
    let options = {
      url: this.url + '/grafana/query',
      data: [{ refId: "A", sql: query, alias: "ref" }],
      method: 'POST'
    }
    return this.doRequest(options)
  }

  buildQueryParameters(options) {
    var targets = _.flatMap(options.targets, target => {
      let sql = this.generateSql(options, target);
      if (_.isArray(sql)) {
        return sql;
      } else {
        return [{
          ...target,
          alias: this.generateAlias(options, target),
          sql,
        }];
      }
    });
    return targets;
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

  generateSql(options, target) {
    var sql = target.sql;
    if (sql == null || sql == "") {
      return sql;
    }

    var queryStart = "now-1h";
    if (options != null && options.range != null && options.range.from != null) {
      queryStart = options.range.from.toISOString();
    }

    var queryEnd = "now";
    if (options != null && options.range != null && options.range.to != null) {
      queryEnd = options.range.to.toISOString();
    }
    var intervalMs = options.intervalMs || "20000";

    intervalMs += "a";
    sql = sql.replace(/^\s+|\s+$/gm, '');
    sql = sql.replace("$from", "'" + queryStart + "'");
    sql = sql.replace("$begin", "'" + queryStart + "'");
    sql = sql.replace("$to", "'" + queryEnd + "'");
    sql = sql.replace("$end", "'" + queryEnd + "'");
    sql = sql.replace("$interval", intervalMs);

    let allVaribles = this.templateSrv.getVariables ? this.templateSrv.getVariables() : [];
    let variables = _(allVaribles).flatMap(v => {
      let re = new RegExp("\\$(\{" + v.name + "(:\\S+)?\}|" + v.name + ")")
      let matches = sql.match(re)
      if (!!matches) {
        return [{ matches, ...v }];
      } else {
        return [];
      }
    }).value();
    if (!_.size(variables)) {
      return this.templateSrv.replace(sql, options.scopedVars, 'csv');
    }

    let expanded = _(variables).map(v => {
      if (v.includeAll) {
        return _(v.options)
          .filter(o => o.value != "$__all")
          .map(o => { return { option: o.value, variable: v }; })
          .value();
      } else if (_.isArray(v.current.value)) {
        return _(v.current.value)
          .map(option => { return { option, variable: v }; })
          .value();
      } else {
        return []
      }
    }).reduce((exp, vv) => {
      return _.flatMap(vv, vvv => {
        return exp.length ? _.map(exp, e => _.concat([e], vvv)) : [[vvv]]
      });
    }, []);

    if (_.size(expanded) > 0) {
      return _(expanded)
        .map((vv, i) => {
          let sql2 = _(vv).reduce((sql, { option, variable }) => {
            return _.replace(sql, variable.matches[0], option)
          }, sql);

          let alias = _(vv).reduce((sql, { option, variable }) => {
            return _.replace(sql, variable.matches[0], option)
          }, target.alias || "");

          sql2 = this.templateSrv.replace(sql2, options.scopedVars, 'csv');
          return {
            ...target,
            alias,
            sql: sql2,
            queryType: "SQL",
          }
        })
        .value();
    } else {
      sql = this.templateSrv.replace(sql, options.scopedVars, 'csv');
      return sql;
    }
  }
  metricFindQuery(query, options) {
    return this.fetchMetricNames(query).then((res) => {
      let tempList = [];
      (Array.isArray(_.get(res, 'data')) ? res.data : []).forEach((item) => {
        (Array.isArray(item.datapoints) ? item.datapoints : []).forEach(
          (end) => {
            tempList.push({
              expendable: false,
              text: end[0],
              value: end[0],
            });
          }
        );
      });
      return Array.from(new Set(tempList));
    }).catch(err => {
      console.error("err: ", err)
    });
  }

}
