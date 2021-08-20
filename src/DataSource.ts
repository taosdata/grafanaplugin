import _ from 'lodash';
import defaults from 'lodash/defaults';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import { getBackendSrv } from '@grafana/runtime';
import { MyQuery, MyDataSourceOptions, defaultQuery } from './types';

export class DataSource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  baseUrl: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);
    console.log(instanceSettings);
    this.baseUrl = instanceSettings.url!;
  }

  async query(options: DataQueryRequest<MyQuery>): Promise<DataQueryResponse> {
    const promises = options.targets.map(async target => {
      const query = defaults(target, defaultQuery);
      const response = await this.request('/rest/sql', query.queryText);

      console.log(response);
      const headers = response.data.column_meta;
      const data = response.data.data;
      const rows = response.data.rows;
      const cols = headers.length;
      const fieldValues: any[][] = [];
      const fields = [];

      for (let i = 0; i < cols; i++) {
        fieldValues.push([]);
      }

      for (let i = 0; i < rows; i++) {
        for (let k = 0; k < cols; k++) {
          fieldValues[k].push(data[i][k]);
        }
      }
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
        fields.push({ name: headers[i][0], type: fieldType, values: fieldValues[i] });
      }
      console.log(fields);
      return new MutableDataFrame({
        refId: query.refId,
        fields: fields,
      });
    });

    return Promise.all(promises).then(data => ({ data }));
  }



  async request(url: string, params?: string) {
    return getBackendSrv().datasourceRequest({
      url: `${this.baseUrl}${url}`,
      data: params,
      method: 'POST',
      headers:{Authorization:"Basic cm9vdDp0YW9zZGF0YQ=="},
    });
  }

  /**
   * Checks whether we can connect to the API.
   */
  async testDatasource() {
    const defaultErrorMessage = 'Cannot connect to API';

    try {
      const response = await this.request('/rest/login/root/taosdata');
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
}
