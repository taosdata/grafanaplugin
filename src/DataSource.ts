import _ from 'lodash';
import defaults from 'lodash/defaults';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
  MetricFindValue,
  DataFrame,
} from '@grafana/data';

import { getBackendSrv,getTemplateSrv } from '@grafana/runtime';
import { MyQuery, MyDataSourceOptions, defaultQuery } from './types';

import moment, { DurationInputArg2 } from 'moment-timezone';
export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  baseUrl: string;
  options: DataQueryRequest<MyQuery>|null;
  Authorization: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    console.log("instanceSettings",instanceSettings);
    this.Authorization = this.getAuthorization(instanceSettings.jsonData);
    this.baseUrl = instanceSettings.jsonData.url!;
    this.options=null;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    console.log("options",options);
    this.options = options;
    const timezone = options.timezone=="browser"?Intl.DateTimeFormat().resolvedOptions().timeZone:options.timezone;
    const targets = options.targets.filter((target) => (!target.queryType||target.queryType === "SQL")&&target.sql);
    const promises = targets.map(async target => {
      const query = defaults(target, defaultQuery);
      const response = await this.request('/rest/sql', this.generateSql(options,query.sql||""));
      console.log(response);
      const headers = response.data.column_meta;
      const data = response.data.data;
      const rows = response.data.rows;
      const cols = headers.length;
      const fieldValues: any[][] = [];
      const fields = [];
      const fieldTypes = [];

      // 1：BOOL
      // 2：TINYINT
      // 3：SMALLINT
      // 4：INT
      // 5：BIGINT
      // 6：FLOAT
      // 7：DOUBLE
      // 8：BINARY
      // 9：TIMESTAMP
      // 10：NCHAR
      for (let i = 0; i < cols; i++) {
        let fieldType = FieldType.other;
        if (headers[i][1]==1) {
          fieldType = FieldType.boolean;
        } else if (headers[i][1]==2||headers[i][1]==3||headers[i][1]==4||headers[i][1]==5||headers[i][1]==6||headers[i][1]==7) {
          fieldType = FieldType.number;
        } else if (headers[i][1]==8) {
          fieldType = FieldType.string;
        } else if (headers[i][1]==9) {
          fieldType = FieldType.time;
        } else if (headers[i][1]==10) {
          fieldType = FieldType.string;
        }
        fieldTypes.push(fieldType);
        fieldValues.push([]);
      }
      for (let i = 0; i < rows; i++) {
        for (let k = 0; k < cols; k++) {
          if (k==0&&fieldTypes[k]==FieldType.time) {
            let timeShiftDuration = moment.duration();
            if (query.timeshiftPeriod&&query.timeshiftUnit) {
              timeShiftDuration=moment.duration(query.timeshiftPeriod,query.timeshiftUnit as DurationInputArg2);
            }
            fieldValues[k].push(moment.utc(data[i][k]).tz(timezone).add(timeShiftDuration).format());
          }else{
            fieldValues[k].push(data[i][k]);
          }
        }
      }

      const aliasList = query.alias?.split(',')||[];
      for (let i = 0; i < cols; i++) {
        let aliasRow = headers[i][0];
        if (i>0&&i<=aliasList.length) {
          aliasRow=this.getRowAlias(aliasList[i-1],aliasRow);
        }
        fields.push({ name: aliasRow, type: fieldTypes[i], values: fieldValues[i] });
      }
      return new MutableDataFrame({
        refId: query.refId,
        fields: fields,
      });
    });

    return Promise.all(promises).then(data => ({data:this.arithmeticQueries(options,data)}));
  }
  arithmeticQueries(options:DataQueryRequest<MyQuery>, data: MutableDataFrame<DataFrame>[]) {
    const arithmeticQueries = options.targets.filter((target) => target.queryType === "Arithmetic"&&target.expression);
    if (arithmeticQueries.length == 0) return data;
    let targetRefIds = data.flatMap((item)=>item.fields.map(field=>(field.name==='ts'?item.refId:item.refId+'__'+field.name)));
    
    let targetResults:{[ts: string]:any[]} = {};
    data.forEach((item)=>{
      if (item.fields.length>1) {
        for (let i = 0; i < item.fields[0].values.length; i++) {
          const ts = item.fields[0].values.get(i);
          targetResults[ts]=targetResults[ts]||[];
          targetResults[ts].push(item.fields[1].values.get(i));
          for (let k = 1; k < item.fields.length; k++) {
            targetResults[ts].push(item.fields[k].values.get(i));
          }
        }
      }
    });
    
    try {
      let dataArithmetic = arithmeticQueries.map(target => {
        let functionArgs = targetRefIds.join(', ');
        let functionBody = "return (" + target.expression + ");";
        let expressionFunction = new Function(functionArgs, functionBody);
        let result: any = null;
        const fields:any[] = [];
        const tsList:any[] = [];
        const resultList:any[] = [];
        Object.entries(targetResults).map(args=>{
          result = expressionFunction.apply(this, args[1]);
          tsList.push(args[0]);
          resultList.push(result);
        });
        fields.push({ name: 'ts', type: FieldType.time, values: tsList });
        fields.push({ name: target.alias||target.refId, type: FieldType.number, values: resultList });
        return new MutableDataFrame({
          refId: target.refId,
          fields: fields,
        });
      });
      return data.concat(dataArithmetic);
    }catch (err) {
      console.error("expression function eval error:", err);
      return data;
    }
  }
  getRowAlias(alias: string, aliasRow: string) {
    if (!alias) {
      return aliasRow;
    }
    const regex = /\$(\w+)|\[\[([\s\S]+?)\]\]/g;
    return alias.replace(regex,(match: any, g1: any, g2: any) => {
      const group = g1 || g2;

      if (group === 'col') {
        return aliasRow;
      }
      return match;
    });
  }
  generateSql(options: DataQueryRequest<MyQuery>|null, sql: string) {
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
    var intervalMs = options?.intervalMs?.toString() || "20000";

    intervalMs += "a";
    sql = sql.replace(/^\s+|\s+$/gm, '');
    sql = sql.replace("$from", "'" + queryStart + "'");
    sql = sql.replace("$begin", "'" + queryStart + "'");
    sql = sql.replace("$to", "'" + queryEnd + "'");
    sql = sql.replace("$end", "'" + queryEnd + "'");
    sql = sql.replace("$interval", intervalMs);
    
    const allVaribles = getTemplateSrv().getVariables();
    for (let i = 0; i < allVaribles.length; i++) {
      // @ts-ignore
      if (allVaribles[i].current&&allVaribles[i].current.value) {
        // @ts-ignore
        sql = sql.replace("$"+allVaribles[i].name, allVaribles[i].current.value);
      }
    }

    return sql;
  }

  async request(url: string, params?: string) {
    return getBackendSrv().datasourceRequest({
      url: `${this.baseUrl}${url}`,
      data: params,
      method: 'POST',
      headers:{Authorization:this.Authorization},
    });
  }

  /**
   * Checks whether we can connect to the API.
   */
  async testDatasource() {
    const defaultErrorMessage = 'Cannot connect to API';

    try {
      const response = await this.request('/rest/sql',"show databases");
      console.log("response",response);
      if (response.status === 200) {
        return {
          status: 'success',
          message: 'Success',
        };
      } else {
        return {
          status: 'error',
          message: response.statusText ? response.statusText : defaultErrorMessage,
        };
      }
    } catch (err) {
      if (_.isString(err)) {
        return {
          status: 'error',
          message: err,
        };
      } else {
        let message = '';
        message += err.statusText ? err.statusText : defaultErrorMessage;
        if (err.data && err.data.error && err.data.error.code) {
          message += ': ' + err.data.error.code + '. ' + err.data.error.message;
        }

        return {
          status: 'error',
          message,
        };
      }
    }
  }
  async metricFindQuery(query: string, options?: any): Promise<MetricFindValue[]> {
    return this.request('/rest/sql', this.generateSql(options,query)).then(res=>{
      if (!res.data||!res.data.data) {
        return [];
      }else{
        let values: MetricFindValue[] = [];
        for (let i = 0; i < res.data.data.length; i++) {
          values.push({text:''+res.data.data[i]});
        }
        return values;
      }
    });
  }

  encode(input: string) {
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

  getAuthorization(jsonData: MyDataSourceOptions) {
    jsonData = jsonData || {};
    var defaultUser = jsonData.user || "root";
    var defaultPassword = jsonData.password || "taosdata";

    return "Basic " + this.encode(defaultUser + ":" + defaultPassword);
  }
}
