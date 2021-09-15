'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GenericDatasource = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var moment = require('./js/moment-timezone-with-data');

var GenericDatasource = exports.GenericDatasource = function () {
  function GenericDatasource(instanceSettings, $q, backendSrv, templateSrv) {
    _classCallCheck(this, GenericDatasource);

    // console.log("instanceSettings",instanceSettings);
    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.headers = { 'Content-Type': 'application/json' };
    this.headers.Authorization = this.getAuthorization(instanceSettings.jsonData);
    this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.options = null;
  }

  _createClass(GenericDatasource, [{
    key: 'query',
    value: function query(options) {
      var _this = this;

      // console.log('options',options);
      this.options = options;
      if (this.options.timezone) {
        this.timezone = this.options.timezone == "browser" ? Intl.DateTimeFormat().resolvedOptions().timeZone : this.options.timezone;
      }
      var targets = this.options.targets.filter(function (target) {
        return (!target.queryType || target.queryType === "SQL") && target.sql && !(target.hide === true);
      });
      if (targets.length <= 0) {
        return this.q.when({ data: [] });
      }

      return Promise.all(targets.map(function (target) {
        return _this.request('/rest/sqlutc', _this.generateSql(target.sql)).then(function (res) {
          return _this.postQuery(target, res);
        });
      })).then(function (data) {
        return { data: _this.arithmeticQueries(data).flat() };
      }, function (err) {
        console.log(err);
        if (err.data && err.data.desc) {
          throw new Error(err.data.desc);
        } else {
          throw new Error(err);
        }
      });
    }
  }, {
    key: 'testDatasource',
    value: function testDatasource() {
      return this.request('/rest/sqlutc', 'show databases').then(function (response) {
        if (!!response && response.status === 200) {
          return { status: "success", message: "TDengine Data source is working", title: "Success" };
        }
        return { status: "error", message: "TDengine Data source is not working", title: "Failed" };
      });
    }
  }, {
    key: 'request',
    value: function request(url, params) {
      if (!params) {
        return new Promise(function (resolve, reject) {
          resolve();
        });
      }
      return this.backendSrv.datasourceRequest({
        url: '' + this.url + url,
        data: params,
        method: 'POST',
        headers: this.headers
      });
    }
  }, {
    key: 'getRowAlias',
    value: function getRowAlias(alias, aliasRow) {
      if (!alias) {
        return aliasRow;
      }
      alias = this.generateSql(alias);
      var regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
      return alias.replace(regex, function (match, g1, g2) {
        var group = g1 || g2;

        if (group === 'col') {
          return aliasRow;
        }
        return match;
      });
    }
  }, {
    key: 'generateSql',
    value: function generateSql(sql) {
      // console.log('sql',sql);
      if (!sql || sql.length == 0) {
        return sql;
      }

      var queryStart = "now-1h";
      if (!!this.options.range && !!this.options.range.from) {
        queryStart = this.options.range.from.toISOString();
      }

      var queryEnd = "now";
      if (!!this.options.range && !!this.options.range.to) {
        queryEnd = this.options.range.to.toISOString();
      }

      var intervalMs = "20000";
      if (!!this.options.intervalMs) {
        intervalMs = this.options.intervalMs.toString();
      }

      intervalMs += "a";
      sql = sql.replace(/^\s+|\s+$/gm, '');
      sql = sql.replace("$from", "'" + queryStart + "'");
      sql = sql.replace("$begin", "'" + queryStart + "'");
      sql = sql.replace("$to", "'" + queryEnd + "'");
      sql = sql.replace("$end", "'" + queryEnd + "'");
      sql = sql.replace("$interval", intervalMs);

      var allVaribles = this.templateSrv.getVariables ? this.templateSrv.getVariables() : this.templateSrv.variables || [];
      for (var i = 0; i < allVaribles.length; i++) {
        if (allVaribles[i].current && allVaribles[i].current.value) {
          sql = sql.replace("$" + allVaribles[i].name, allVaribles[i].current.value);
        }
      }

      return sql;
    }
  }, {
    key: 'postQuery',
    value: function postQuery(query, response) {
      // console.log('query',query);
      // console.log('response',response);
      if (!response || !response.data || !response.data.data) {
        return [];
      }
      var headers = response.data.column_meta;
      var data = response.data.data;
      var rows = response.data.rows;
      var cols = headers.length;
      var result = [];
      var aliasList = (query.alias || '').split(',') || [];
      if (!!headers && !!headers[0] && !!headers[0][1]) {
        var timeSeriesIndex = headers.findIndex(function (item) {
          return item[1] === 9;
        });
        if (timeSeriesIndex == -1 || query.formatType == 'Table') {
          result.push({ columns: headers.map(function (item) {
              return { text: item[0] };
            }), rows: data, type: 'table', refId: query.refId, target: this.getRowAlias(aliasList[0], headers[0][0]), hide: !!query.hide });
        } else {
          for (var i = 0; i < cols; i++) {
            if (i == timeSeriesIndex) {
              continue;
            }
            var aliasRow = headers[i][0];
            if (i <= aliasList.length) {
              aliasRow = this.getRowAlias(aliasList[i - 1], aliasRow);
            }
            var resultItem = { datapoints: [], refId: query.refId, target: aliasRow, hide: !!query.hide };
            for (var k = 0; k < rows; k++) {
              var timeShiftDuration = moment.duration();
              if (query.timeshift && query.timeshift.period && query.timeshift.unit) {
                timeShiftDuration = moment.duration(query.timeshift.period, query.timeshift.unit);
              }
              resultItem.datapoints.push([data[k][i], moment.utc(data[k][timeSeriesIndex]).tz(this.timezone).add(timeShiftDuration).valueOf()]);
            }
            result.push(resultItem);
          }
        }
      }
      // console.log('result',result);
      return result;
    }
  }, {
    key: 'arithmeticQueries',
    value: function arithmeticQueries(data) {
      var _this2 = this;

      var arithmeticQueries = this.options.targets.filter(function (target) {
        return target.queryType === "Arithmetic" && target.expression && !(target.hide === true);
      });
      if (arithmeticQueries.length == 0) return data;
      var targetRefIds = data.flatMap(function (item) {
        return item.flatMap(function (field, index) {
          return index == 0 ? [field.refId, field.refId + '__' + index] : [field.refId + '__' + index];
        });
      });
      // console.log('targetRefIds',targetRefIds);
      var targetResults = {};
      data.forEach(function (item) {
        item.forEach(function (field, index) {
          field.datapoints.forEach(function (datapoint) {
            targetResults[datapoint[1]] = targetResults[datapoint[1]] || [];
            if (index == 0) {
              targetResults[datapoint[1]].push(datapoint[0]);
            }
            targetResults[datapoint[1]].push(datapoint[0]);
          });
        });
      });

      try {
        var dataArithmetic = arithmeticQueries.map(function (target) {
          var functionArgs = targetRefIds.join(', ');
          var functionBody = "return (" + target.expression + ");";
          var expressionFunction = new Function(functionArgs, functionBody);
          var result = null;
          var aliasList = (target.alias || '').split(',').map(function (alias) {
            return _this2.getRowAlias(alias, target.refId);
          });

          var aliasListResult = [];
          Object.entries(targetResults).forEach(function (args) {
            if (args[1].length === targetRefIds.length) {
              try {
                result = expressionFunction.apply(_this2, args[1]);
              } catch (error) {
                throw error;
              }
            }
            // else{
            //   console.log('args not full',targetRefIds,args);
            // }
            if (!Array.isArray(result)) {
              result = [result];
            }
            result.forEach(function (item, index) {
              aliasListResult[index] = aliasListResult[index] || { datapoints: [], refId: target.refId, target: aliasList[index] || target.refId + '__' + index, hide: !!target.hide };
              aliasListResult[index].datapoints.push([item, args[0]]);
            });
          });
          return aliasListResult;
        });
        return data.concat(dataArithmetic);
      } catch (err) {
        // console.log(err);
        throw new Error(err);
      }
    }
  }, {
    key: 'encode',
    value: function encode(input) {
      var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
      var output = "";
      var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
      var i = 0;
      while (i < input.length) {
        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);
        enc1 = chr1 >> 2;
        enc2 = (chr1 & 3) << 4 | chr2 >> 4;
        enc3 = (chr2 & 15) << 2 | chr3 >> 6;
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
  }, {
    key: 'getAuthorization',
    value: function getAuthorization(jsonData) {
      jsonData = jsonData || {};
      var defaultUser = jsonData.user || "root";
      var defaultPassword = jsonData.password || "taosdata";

      return "Basic " + this.encode(defaultUser + ":" + defaultPassword);
    }
  }, {
    key: 'generateTimeshift',
    value: function generateTimeshift(options, target) {
      var alias = target.alias || "";
      alias = this.templateSrv.replace(alias, options.scopedVars, 'csv');
      return alias;
    }
  }, {
    key: 'generateAlias',
    value: function generateAlias(options, target) {
      var alias = target.alias || "";
      alias = this.templateSrv.replace(alias, options.scopedVars, 'csv');
      return alias;
    }
  }, {
    key: 'metricFindQuery',
    value: function metricFindQuery(query, options) {
      this.options = options;
      // console.log('options',options);
      return this.request('/rest/sqlutc', this.generateSql(query)).then(function (res) {
        if (!res || !res.data || !res.data.data) {
          return [];
        } else {
          console.log('res', res);
          var values = [];
          for (var i = 0; i < res.data.data.length; i++) {
            values.push({ text: '' + res.data.data[i] });
          }
          return values;
        }
      });
    }
  }]);

  return GenericDatasource;
}();
//# sourceMappingURL=datasource.js.map
