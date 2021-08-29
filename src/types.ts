import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MyQuery extends DataQuery {
  queryType?: string;
  alias: string;
  sql: string;
  expression: string;
  timeshiftUnit: string;
  timeshiftPeriod?: number;
}

export const defaultQuery: Partial<MyQuery> = {
};

/**
 * These are options configured for each DataSource instance
 */
export interface MyDataSourceOptions extends DataSourceJsonData {
  url?: string;
  user?: string;
  password?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MySecureJsonData {
  apiKey?: string;
}
