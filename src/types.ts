import {DataQuery, DataSourceJsonData} from '@grafana/data'

export type TimeUnit = 'b' | 'u' | 'a' | 's' | 'm' | 'h' | 'd' | 'n' | 'w' | 'y'

export type TimeValue = {
    number?: number
    unit?: TimeUnit
}

export interface BuilderData {
    database?: string
    table?: string
    columns?: Array<{
        column: string
        function: string
        alias: string
    }>
    whereClause?: string
    groupBy?: string[]
    partitionBy?: string[]
    limit?: number
    offset?: number
    sLimit?: number
    sOffset?: number
    interval?: string
    sliding?: string
}

export interface Query extends DataQuery {
    queryType?: string
    sql: string
    timeShiftPeriod?: number | string
    timeShiftUnit?: string
    expression?: string
    editorMode?: 'builder' | 'code'
    builderData: BuilderData
}

export const DEFAULT_QUERY: Partial<Query> = {
    sql: 'show databases'
};

/**
 * These are options configured for each DataSource instance
 */
export interface DataSourceOptions extends DataSourceJsonData {
    isLoadAlerts?: boolean;
    folderUidSuffix?: string;
    tlsAuthWithCACert?: boolean;
    tlsSkipVerify?: boolean;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface SecureJsonData {
    url?: string
    user?: string
    password?: string
    token?: string
    basicAuth?: string
    basicAuthPassword?: string
    tlsCACert?: string
}

export type ChangeOptions<T> = {
    propertyName: keyof T;
    runQuery: boolean
    defaultValue?: String
}
