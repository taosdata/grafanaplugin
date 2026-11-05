/*
 * Copyright (c) 2023 TAOS Data, Inc. <jhtao@taosdata.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can use, redistribute, and/or modify
 * it under the terms of the GNU Affero General Public License, version 3
 * or later ("AGPL"), as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

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
