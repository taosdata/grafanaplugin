import {
    DataQueryRequest,
    DataQueryResponse,
    DataSourceApi,
    DataSourceInstanceSettings,
    MetricFindValue
} from '@grafana/data'
import {BackendSrv, getBackendSrv, getTemplateSrv, TemplateSrv} from '@grafana/runtime'
import {DataSourceOptions, Query} from './types';
import _, {uniqBy} from "lodash";
// eslint-disable-next-line no-restricted-imports
import moment from 'moment';
import axios from 'axios';
import data from './alert_rules.json'
import { getFolderUid } from './utils'
export class DataSource extends DataSourceApi<Query, DataSourceOptions> {
    baseUrl: string
    backendSrv: BackendSrv
    template: TemplateSrv
    timezone = ''
    lastGeneratedSql = ''
    serverVersion = 0
    isLoadAlerts?: boolean

    constructor(instanceSettings: DataSourceInstanceSettings<DataSourceOptions>) {
        super(instanceSettings);
        this.baseUrl = instanceSettings.url!
        this.backendSrv = getBackendSrv()
        this.template = getTemplateSrv()
        this.isLoadAlerts = instanceSettings.jsonData.isLoadAlerts;
    }

    // @ts-ignore
    query(options: DataQueryRequest<Query>): Promise<DataQueryResponse> {
        if (options.timezone) {
            this.timezone = options.timezone === "browser" ? Intl.DateTimeFormat().resolvedOptions().timeZone : options.timezone;
        } else {
            this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        const targets = options.targets.filter((target) => (!target.queryType || target.queryType === "SQL") && target.sql && !(target.hide === true));
        if (targets.length === 0) {
            // @ts-ignore
            return Promise.all([])
        }
        return Promise.all(targets.map(target => {
            let sql = this.generateSql(target.sql, options);
            this.lastGeneratedSql = sql;
            return this.request(sql).then((res: any) => this.postQuery(target, res, options));
        })).then(data => {
            let result = this.arithmeticQueries(data, options).flat();
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

    async checkVersion(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            axios.get("/api/frontend/settings").then(response=>{
                if (!!response && response.status=== 200 && !!response.data && !!response.data.buildInfo.version) {
                    const version = '' + response.data.buildInfo.version;
                    const versionParts = version.split(".");
                    if (versionParts.length > 0) {
                        const majorVersion = parseInt(versionParts[0], 10);
                        if (majorVersion === 11) {
                            console.log("11 版本"); 
                            resolve(true);
                        } else {
                            resolve(false);
                        }  
                    }
                } else {
                    console.log("get grafana version fail!")
                    reject()
                }
            })
        });  
    }

    getAlertFolder(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            let uid = getFolderUid(`${this.uid}`)
            axios.get(`/api/folders/${uid}`).then(response=>{
                console.log(response.status)
                if (!!response && (response.status === 200)) {
                    resolve(true)
                } else {
                    console.log(response)
                    reject()
                }
            }).catch((e: any) => {
                if(e.response.status === 404) {
                    resolve(false)
                }
                
            })
        });        
    }

    createAlertFolder(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            let req = {uid: getFolderUid(`${this.uid}`), title: this.name + '-alert'}
            console.log(req);
            axios.post("/api/folders", req).then(response=>{
                console.log(response.status)
                if (!!response && (response.status === 200)) {
                    resolve(true)
                } else {
                    console.log(response)
                    reject()
                }
            }).catch((e: any) => {
                if(e.response.status === 409) {
                    resolve(true)
                }
                
            })
        });        
    }

    async getAlerts(ruleGroup: string): Promise<boolean>{
        try{
            let uid = getFolderUid(`${this.uid}`)
            let path = `/api/v1/provisioning/folder/${uid}/rule-groups/${ruleGroup}`;
            let response = await axios.get(path);
            if (!!response && response.status=== 200 && !!response.data) {
                if (response.data.rules.length > 0) {
                    return true;
                }
            }
            console.log(response);   
            return false;
        }catch(e) {
            console.log(e);                 
            return false 
        }  
    }

    async loadAlerts(ruleGroup: string, data: any): Promise<boolean>{
        try{
            let uid = getFolderUid(`${this.uid}`)
            let path = `/api/v1/provisioning/folder/${uid}/rule-groups/${ruleGroup}`;
            let response = await axios.put(path, data, {
                headers: {
                    'X-Disable-Provenance': 'true'
                }
            });
            if (!!response && response.status=== 200) {
                console.log(`rule-groups-->${response}`);
                return true;
            }
            console.log(response);   
            return false;
        }catch(e) {
            console.log(e);                 
            return false 
        }  
    }

    modifyAlertDataSource(ruleGroup: any) {
        ruleGroup.folderUid = getFolderUid(`${this.uid}`);
        let count = ruleGroup.rules.length;
        for (let index = 0; index < count; index++) {
            ruleGroup.rules[index].folderUID = ruleGroup.folderUid;
            ruleGroup.rules[index].data[0].datasourceUid = this.uid;
            ruleGroup.rules[index].data[0].model.datasource.uid = this.uid;
        }
    }

    sendInitAlert(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                let bSuport = await this.checkVersion();
                if (bSuport) {
                    let bOk = await this.getAlertFolder();
                    if (!bOk) {
                        bOk = await this.createAlertFolder();
                    }

                    if (bOk) {
                        bOk = await this.getAlerts("alert_1m");
                        if (!bOk) {
                            this.modifyAlertDataSource(data.alert_1m);
                            await this.loadAlerts("alert_1m", data.alert_1m);
                        }

                        bOk = await this.getAlerts("alert_5m");
                        if (!bOk) {
                            this.modifyAlertDataSource(data.alert_5m);
                            await this.loadAlerts("alert_5m", data.alert_5m);
                        }

                        bOk = await this.getAlerts("alert_30s");
                        if (!bOk) {
                            this.modifyAlertDataSource(data.alert_30s);
                            await this.loadAlerts("alert_30s", data.alert_30s);
                        }

                        bOk = await this.getAlerts("alert_90s");
                        if (!bOk) {
                            this.modifyAlertDataSource(data.alert_90s);
                            await this.loadAlerts("alert_90s", data.alert_90s);
                        }

                        bOk = await this.getAlerts("alert_180s");
                        if (!bOk) {
                            this.modifyAlertDataSource(data.alert_180s);
                            await this.loadAlerts("alert_180s", data.alert_180s);
                        }

                        bOk = await this.getAlerts("alert_24h");
                        if (!bOk) {
                            this.modifyAlertDataSource(data.alert_24h);
                            await this.loadAlerts("alert_24h", data.alert_24h);
                        }  
                    }
                }
                resolve();

            } catch(e) {
                console.log(e);                 
                resolve(); 
            }
        })
    }

    testDatasource() { // save & test button
        return this.request('show databases').then((response: { status: number; data: { message: string; }; }) => {
            if (!!response && response.status === 200 && !_.get(response, 'data.code')) {
                if (this.isLoadAlerts === true) {
                    return this.sendInitAlert().then(()=>{
                        return {status: "success", message: "TDengine Data source is working", title: "Success"};
                    }).catch((e: any) => {
                        console.log("xxdxdxdxd");
                        return {status: "success", message: "TDengine Data source is working", title: "Success"};
                    });                    
                } else {
                    return {status: "success", message: "TDengine Data source is working", title: "Success"};
                } 
                
            }
            return {
                status: "error",
                message: "TDengine Data source is not working, reason: " + response.data.message,
                title: "Failed"
            };
        });
    }

    metricFindQuery(query: any, options: any): Promise<MetricFindValue[]> {
        return this.request(this.generateSql(query, options)).then(res => {
            if (!res?.data?.data) {
                return [];
            }

            const column_meta = res.data.column_meta || [];
            const hasTextAndValue = column_meta.length === 2 &&
                ((column_meta[0][0] === "__text" && column_meta[1][0] === "__value")
                    || (column_meta[1][0] === "__text" && column_meta[0][0] === "__value"));

            let values: MetricFindValue[] = [];
            if (hasTextAndValue) {
                let text_index = 0;
                let string_value = false;
                if (res.data.column_meta[1][0] === "__text") {
                    text_index = 1
                }
                let value_type = res.data.column_meta[1 - text_index][1].toUpperCase();
                if (value_type === "NCHAR" || value_type === "BINARY" || value_type === "VARCHAR") {
                    string_value = true
                }

                for (let i = 0; i < res.data.data.length; i++) {
                    let text = '' + res.data.data[i][text_index];
                    let value = res.data.data[i][1 - text_index]

                    if (string_value) {
                        value = "'" + value + "'";
                    }

                    values.push({text: text, value: value})
                }
            } else {
                for (let i = 0; i < res.data.data.length; i++) {
                    values.push({text: '' + res.data.data[i]});
                }
            }

            return uniqBy(values, "text");
        });
    }

    getGenerateSql(): string {
        return this.lastGeneratedSql
    }

    request(sql: string) {
        if (!sql) {
            return new Promise<void>((resolve, reject) => {
                resolve();
            });
        }
        if (this.serverVersion === 0) {
            return this.backendSrv.datasourceRequest({
                url: this.baseUrl + "/sql",
                data: "select server_version()",
                method: 'POST',
            }).then((res) => {
                if (res.data.data[0][0].startsWith("3")) {
                    this.serverVersion = 3;
                    return this.querySql(sql);
                } else {
                    this.serverVersion = 2;
                    return this.querySqlUtc(sql);
                }
            }).catch(err => {
                return err;
            });
        } else if (this.serverVersion === 3) {
            return this.querySql(sql);
        } else {
            return this.querySqlUtc(sql);
        }
    }

    querySql(sql: string) {
        return this.backendSrv.datasourceRequest({
            url: this.baseUrl + "/sql",
            data: sql,
            method: 'POST',
        }).then((result) => {
            result.data = this.convertResult(result.data);
            return result;
        }).catch(err => {
            console.log("catch error: ", err);
        });
    }

    querySqlUtc(sql: string) {
        return this.backendSrv.datasourceRequest({
            url: this.baseUrl + "/sqlutc",
            data: sql,
            method: 'POST',
        });
    }

    convertResult(src: any) {
        let dist = {
            status: "",
            code: undefined,
            desc: undefined,
            column_meta: undefined,
            data: undefined,
            rows: 0,
        }
        if (src.code === 0) {
            dist.status = "succ";
            dist.column_meta = src.column_meta;
            // @ts-ignore
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

    getRowAlias(alias: string, replaceObject: any, options: DataQueryRequest<Query>) {
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

    generateSql(sql: string, options: DataQueryRequest<Query>) {
        if (!sql || sql.length === 0) {
            return sql;
        }

        let queryStart = "now-1h";
        let queryEnd = "now";
        let intervalMs = "20000";
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

            sql = this.template.replace(sql, options.scopedVars, 'csv');
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

        const allVariables = this.template.getVariables()
        for (const variable of allVariables) {
            if ("current" in variable && variable.current && variable.current.value) {
                sql = sql.replace("$" + variable.name, String(variable.current.value))
            }
        }

        return sql;
    }

    formatColumn(colFormat: string, labelName: any) {
        let placeholders = colFormat.match(/\{\{(\w+)\}\}/g)
        if (!placeholders) {
            return colFormat;
        }
        for (let placeholder of placeholders) {
            // @ts-ignore
            let field = placeholder.replaceAll('{{', '')
            field = field.replaceAll('}}', '')
            let value = labelName[field]
            if (value) {
                // @ts-ignore
                colFormat = colFormat.replaceAll(placeholder, value)
            }
        }
        return colFormat;
    }

    long2wide(recv: any, by: string[], colFormat: string) {
        let data = recv.data;
        let header = recv.column_meta;
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
            // @ts-ignore
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
                if (colFormat) {
                    newField[0] = this.formatColumn(colFormat, labelName);
                } else {
                    newField[0] = field.name + " " + JSON.stringify(labelName);
                }
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
    }

    groupDataByColName(dataRecv: any, query: Query, options: DataQueryRequest<Query>) {
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
                    return [this.long2wide(dataRecv, by, query.colNameFormatStr)];
                } else {
                    return [dataRecv];
                }
            }
            if (!groupBy || query.colNameToGroup.length === 0) {
                return [dataRecv];
            }

            let by = _(groupBy).split(",").map(s => _.trim(s)).value();
            if (_.size(by) > 0) {
                return [this.long2wide(dataRecv, by, query.colNameFormatStr)];
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
                const data = dataRecv.data;
                const rows = dataRecv.rows;
                for (let rowsIndex = 0; rowsIndex < rows; rowsIndex++) {
                    let groupColValue = data[rowsIndex][index];
                    // @ts-ignore
                    if (!groupData[groupColValue]) {
                        // @ts-ignore
                        groupData[groupColValue] = {column_meta: [], data: [], rows: 0};
                        for (let k = 0; k < dataRecv.column_meta.length; k++) {
                            if (k !== index) {
                                let header = [...dataRecv.column_meta[k]];
                                if (!(k === 0 && header[1] === 9)) {
                                    header[0] = this.getRowAlias(query.colNameFormatStr || "prefix_{{group_field}}", {
                                        colName: header[0],
                                        groupValue: groupColValue
                                    }, options);
                                }
                                // @ts-ignore
                                groupData[groupColValue].column_meta.push(header);
                            }
                        }
                    }
                    data[rowsIndex].splice(index, 1);
                    // @ts-ignore
                    groupData[groupColValue].data.push(data[rowsIndex]);
                    // @ts-ignore
                    groupData[groupColValue].rows += 1;
                }
                let keys = Object.keys(groupData).sort();
                let groupDataRet = [];
                for (let indexKeys = 0; indexKeys < keys.length; indexKeys++) {
                    // @ts-ignore
                    groupDataRet.push(groupData[keys[indexKeys]]);
                }
                return groupDataRet;
            }
        }
        return [dataRecv];
    }

    postQuery(query: Query, response: DataQueryResponse, options: DataQueryRequest<Query>) {
        // @ts-ignore
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
                const timeSeriesIndex = headers.findIndex((item: number[]) => item[1] === 9);
                if (timeSeriesIndex === -1 || query.formatType === "Table") {
                    result.push({
                        columns: headers.map((item: any[]) => ({text: item[0]})),
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
                            if (query.timeShiftPeriod && query.timeShiftUnit) {
                                // @ts-ignore
                                timeShiftDuration = moment.duration(query.timeShiftPeriod, query.timeShiftUnit);
                            }
                            // @ts-ignore
                            resultItem.datapoints.push([data[k][i], moment.utc(data[k][timeSeriesIndex]).tz(this.timezone).add(timeShiftDuration).valueOf()]);
                        }
                        result.push(resultItem);
                    }
                }
            }
        }

        return result;
    }

    arithmeticQueries(data: any, options: DataQueryRequest<Query>) {
        const arithmeticQueries = options.targets.filter((target) => target.queryType === "Arithmetic" && target.expression && !(target.hide === true));
        if (arithmeticQueries.length === 0) {
            return data;
        }
        let targetRefIds = data.flatMap((item: any[]) => item.flatMap((field, index) => (index === 0 ? [field.refId, field.refId + '__' + index] : [field.refId + '__' + index])));
        let targetResults = {};
        data.forEach((item: any[]) => {
            item.forEach((field, index) => {
                field.datapoints.forEach((datapoint: any[]) => {
                    // @ts-ignore
                    targetResults[datapoint[1]] = targetResults[datapoint[1]] || [];
                    if (index === 0) {
                        // @ts-ignore
                        targetResults[datapoint[1]].push(datapoint[0]);
                    }
                    // @ts-ignore
                    targetResults[datapoint[1]].push(datapoint[0]);
                })
            })
        });

        try {
            let dataArithmetic = arithmeticQueries.map(target => {
                let functionArgs = targetRefIds.join(', ');
                let functionBody = "return (" + target.expression + ");";
                let expressionFunction = new Function(functionArgs, functionBody);
                let result: any[] | null = null;
                const aliasList = (target.alias || '').split(',').map(alias => this.getRowAlias(alias, {col: target.refId}, options));

                const aliasListResult: any[] = [];
                Object.entries(targetResults).forEach(args => {
                    // @ts-ignore
                    if (args[1].length === targetRefIds.length) {
                        try {
                            result = expressionFunction.apply(this, args[1]);
                        } catch (error) {
                            throw error
                        }
                    }
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
                        aliasListResult[index].datapoints.push([item, parseInt(args[0], 10)]);
                    })
                });
                return aliasListResult;
            });
            return data.concat(dataArithmetic);
        } catch (err) {
            // @ts-ignore
            throw new Error(err);
        }
    }

    generateTimeshift(options: DataQueryRequest<Query>, target: Query) {
        let alias = target.alias || "";
        alias = this.template.replace(alias, options.scopedVars, 'csv');
        return alias;
    }

    generateAlias(options: DataQueryRequest<Query>, target: Query) {
        let alias = target.alias || "";
        alias = this.template.replace(alias, options.scopedVars, 'csv');
        return alias;
    }
}
