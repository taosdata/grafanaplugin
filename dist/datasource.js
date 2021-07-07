"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.GenericDatasource = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _lodash = require("lodash");

var _lodash2 = _interopRequireDefault(_lodash);

require("moment");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var GenericDatasource = exports.GenericDatasource = function () {
  function GenericDatasource(instanceSettings, $q, backendSrv, templateSrv) {
    _classCallCheck(this, GenericDatasource);

    this.type = instanceSettings.type;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv;
    this.templateSrv = templateSrv;
    this.headers = { 'Content-Type': 'application/json' };
    this.headers.Authorization = this.getAuthorization(instanceSettings.jsonData);
  }

  _createClass(GenericDatasource, [{
    key: "query",
    value: function query(options) {
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
  }, {
    key: "testDatasource",
    value: function testDatasource() {
      return this.doRequest({
        url: this.url + '/grafana/heartbeat',
        method: 'GET'
      }).then(function (response) {
        if (response.status === 200) {
          return { status: "success", message: "TDengine Data source is working", title: "Success" };
        }
      });
    }
  }, {
    key: "postQuery",
    value: function postQuery(options, res) {
      res.data = _lodash2.default.map(res.data, function (data) {
        var target = _lodash2.default.find(options.data, { refId: data.refId });
        if (_lodash2.default.isObject(target.timeshift)) {
          data.datapoints = (0, _lodash2.default)(data.datapoints).map(function (datapoint) {
            var unit2millis = {
              seconds: 1000,
              minutes: 60 * 1000,
              hours: 60 * 60 * 1000,
              days: 24 * 60 * 60 * 1000,
              weeks: 7 * 24 * 60 * 60 * 1000,
              months: 30 * 24 * 60 * 60 * 1000
            };
            datapoint[1] += target.timeshift.period * unit2millis[target.timeshift.unit];
            return datapoint;
          }).value();
        }
        console.log("target:", target);
        data.hide = target.hide;
        return data;
      });
      return res;
    }
  }, {
    key: "doRequest",
    value: function doRequest(options) {
      var _this = this;

      options.headers = this.headers;
      var sqlQueries = _lodash2.default.filter(options.data, { queryType: "SQL" });
      var arithmeticQueries = _lodash2.default.filter(options.data, { queryType: "Arithmetic" });
      var targetRefIds = _lodash2.default.map(sqlQueries, function (_ref) {
        var refId = _ref.refId;
        return refId;
      });

      return Promise.all(_lodash2.default.map(sqlQueries, function (target) {
        return _this.backendSrv.datasourceRequest(_extends({}, options, { data: [target] })).then(function (res) {
          return _this.postQuery(options, res);
        });
      })).then(function (res) {
        return _extends({}, res[0], { data: _lodash2.default.flatMap(res, function (_ref2) {
            var data = _ref2.data;
            return data;
          }) });
      }).then(function (res) {
        console.log(res);
        var targetResults = (0, _lodash2.default)(res.data).map(function (target) {
          return [target.refId, target];
        }).fromPairs().value();
        var data = _lodash2.default.map(arithmeticQueries, function (target) {
          var functionArgs = targetRefIds.join(', ');
          var functionBody = "return (" + target.expression + ");";
          var expressionFunction = new Function(functionArgs, functionBody);

          var datapoints = (0, _lodash2.default)(targetResults).values().flatMap(function (result) {
            return _lodash2.default.map(result.datapoints, function (datapoint) {
              return { value: datapoint[0], ts: datapoint[1], refId: result.refId };
            });
          }).groupBy('ts').map(function (datapoints, ts) {
            var dps = (0, _lodash2.default)(datapoints).map(function (dp) {
              return [dp.refId, dp.value];
            }).fromPairs().value();
            var args = _lodash2.default.map(targetRefIds, function (refId) {
              return _lodash2.default.get(dps, refId);
            });
            var result = null;
            try {
              result = expressionFunction.apply(_this, args);
            } catch (err) {
              console.log("expression function eval error:", err);
            }
            var tsint = parseInt(ts);
            return [result, _lodash2.default.isNaN(tsint) ? ts : tsint];
          }).value();
          return _extends({}, target, { target: target.alias, refId: target.refId, datapoints: datapoints });
        });
        res.data = _lodash2.default.concat(res.data, data);
        return res;
      });
    }
  }, {
    key: "buildQueryParameters",
    value: function buildQueryParameters(options) {
      var _this2 = this;

      var targets = _lodash2.default.flatMap(options.targets, function (target) {
        var sql = _this2.generateSql(options, target);
        if (_lodash2.default.isArray(sql)) {
          return sql;
        } else {
          return [_extends({}, target, {
            alias: _this2.generateAlias(options, target),
            sql: sql
          })];
        }
      });
      return targets;
    }
  }, {
    key: "encode",
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
    key: "getAuthorization",
    value: function getAuthorization(jsonData) {
      jsonData = jsonData || {};
      var defaultUser = jsonData.user || "root";
      var defaultPassword = jsonData.password || "taosdata";

      return "Basic " + this.encode(defaultUser + ":" + defaultPassword);
    }
  }, {
    key: "generateTimeshift",
    value: function generateTimeshift(options, target) {
      var alias = target.alias || "";
      alias = this.templateSrv.replace(alias, options.scopedVars, 'csv');
      return alias;
    }
  }, {
    key: "generateAlias",
    value: function generateAlias(options, target) {
      var alias = target.alias || "";
      console.log(options);
      alias = this.templateSrv.replace(alias, options.scopedVars, 'csv');
      return alias;
    }
  }, {
    key: "generateSql",
    value: function generateSql(options, target) {
      var _this3 = this;

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
      console.log(this.templateSrv.getVariables());

      var variables = (0, _lodash2.default)(this.templateSrv.getVariables()).flatMap(function (v) {
        var re = new RegExp("\\$(\{" + v.name + "(:\\S+)?\}|" + v.name + ")");
        var matches = sql.match(re);
        if (_lodash2.default.isNull(matches)) {
          return [];
        } else {
          return [_extends({ matches: matches }, v)];
        }
      }).value();

      var cartesian = function cartesian(first) {
        for (var _len = arguments.length, rest = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          rest[_key - 1] = arguments[_key];
        }

        return rest.length ? first.flatMap(function (v) {
          return cartesian.apply(undefined, rest).map(function (c) {
            return [v].concat(c);
          });
        }) : first;
      };
      var expanded = (0, _lodash2.default)(variables).map(function (v) {
        if (_lodash2.default.eq(v.current.value, "$__all")) {
          return (0, _lodash2.default)(v.options).filter(function (o) {
            return o.value != "$__all";
          }).map(function (o) {
            return { option: o.value, variable: v };
          }).value();
        } else if (_lodash2.default.isArray(v.current.value)) {
          return (0, _lodash2.default)(v.current.value).map(function (option) {
            return { option: option, variable: v };
          }).value();
        }{
          return [];
        }
      }).reduce(function (exp, vv) {
        return _lodash2.default.flatMap(vv, function (vvv) {
          return exp.length ? _lodash2.default.map(exp, function (e) {
            return _lodash2.default.concat([e], vvv);
          }) : [[vvv]];
        });
      }, []);

      if (_lodash2.default.size(expanded) > 0) {
        return (0, _lodash2.default)(expanded).map(function (vv, i) {
          console.log(vv, i);
          var sql2 = (0, _lodash2.default)(vv).reduce(function (sql, _ref3) {
            var option = _ref3.option,
                variable = _ref3.variable;

            return _lodash2.default.replace(sql, variable.matches[0], option);
          }, sql);

          var alias = (0, _lodash2.default)(vv).reduce(function (sql, _ref4) {
            var option = _ref4.option,
                variable = _ref4.variable;

            return _lodash2.default.replace(sql, variable.matches[0], option);
          }, target.alias || "");

          sql2 = _this3.templateSrv.replace(sql2, options.scopedVars, 'csv');
          return {
            refId: target.refId + "_" + i,
            alias: alias,
            sql: sql2,
            timeshift: target.timeshift
          };
        }).value();
      } else {
        sql = this.templateSrv.replace(sql, options.scopedVars, 'csv');
        return sql;
      }
    }
  }, {
    key: "metricFindQuery",
    value: function metricFindQuery(query, options) {
      console.log("metric find query");
      // query like 'select  name  from dbtest.t;'
      var targets = [{
        alias: "",
        refId: "A",
        sql: query
      }];
      var req = {
        url: this.url + "/grafana/query",
        data: targets,
        method: "POST"
      };
      return this.doRequest(req).then(function (res) {
        var tempList = [];
        (Array.isArray(_lodash2.default.get(res, 'data')) ? res.data : []).forEach(function (item) {
          (Array.isArray(item.datapoints) ? item.datapoints : []).forEach(function (end) {
            tempList.push({
              expendable: false,
              text: end[0],
              value: end[0]
            });
          });
        });
        return Array.from(new Set(tempList));
      }).catch(function (err) {
        console.log("err: ", err);
      });
    }
  }]);

  return GenericDatasource;
}();
//# sourceMappingURL=datasource.js.map
