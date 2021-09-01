import defaults from 'lodash/defaults';

import React, { ChangeEvent, useState } from 'react';
import { LegacyForms,InlineFormLabel,Select,Icon } from '@grafana/ui';
import { QueryEditorProps,SelectableValue } from '@grafana/data';
import { DataSource } from './DataSource';
import { defaultQuery, MyDataSourceOptions, MyQuery } from './types';

const { Input } = LegacyForms;
type Props = QueryEditorProps<DataSource, MyQuery, MyDataSourceOptions>;

export const QueryEditor: React.FC<Props> = (props) => {
  const [isSQLHelpVisible, setIsSQLHelpVisible] = useState(false);
  const [lastGenerateSQL, setLastGenerateSQL] = useState('');
  const onSQLChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery,datasource } = props;
    onChange({ ...query, sql: event.target.value });
    if (isSQLHelpVisible) {
      setLastGenerateSQL(datasource.generateSql(datasource.options,event.target.value));
    }
    onRunQuery();
  };
  const onAliasChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = props;
    onChange({ ...query, alias: event.target.value });
    onRunQuery();
  };
  const onQueryTypeChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = props;
    onChange({ ...query, queryType: item.value });
    onRunQuery();
  };
  const onTimeshiftPeriodChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = props;
    onChange({ ...query, timeshiftPeriod: parseInt(event.target.value) });
    onRunQuery();
  };
  const onTimeshiftUniteChange = (item: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = props;
    onChange({ ...query, timeshiftUnit: item.value||'' });
    onRunQuery();
  };
  const onExpressionChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = props;
    onChange({ ...query, expression: event.target.value });
    onRunQuery();
  };
  const query = defaults(props.query, defaultQuery);
  const { sql,alias,queryType,timeshiftUnit,timeshiftPeriod,expression } = query;
  return (<>
    <div className="gf-form-inline">
      <div className="gf-form" style={{width:"100%"}}>
        <div className="gf-form-inline">
          <InlineFormLabel className="query-keyword width-8">Type</InlineFormLabel>
          <Select
            className="width-15 gf-form-inline"
            onChange={onQueryTypeChange}
            value={queryType||'SQL'}
            options={[
              { label: 'SQL', value: 'SQL' },
              { label: 'Arithmetic', value: 'Arithmetic' },
            ]}
          />
        </div>
        <div className="gf-form-inline">
          <InlineFormLabel className="query-keyword width-8" >ALIAS BY</InlineFormLabel>
          <Input
            className="width-20"
            value={alias || ''}
            onChange={onAliasChange}
            placeholder={queryType=='Arithmetic'?"Naming pattern":"Naming pattern [[col]]"}
          />
        </div>
        <div className="gf-form gf-form--grow">
          <div className="gf-form-label gf-form-label--grow" style={{marginRight:0}}></div>
        </div>
      </div>
    </div>
    {queryType=='Arithmetic'?<div>
      <div className="gf-form-inline">
        <div className="gf-form" style={{width:"100%"}}>
          <InlineFormLabel className="query-keyword width-8" tooltip="" >Expression</InlineFormLabel>
          <Input
            value={expression || ''}
            onChange={onExpressionChange}
            placeholder="A+B__1"
          />
        </div>
      </div>
    </div>:<div>
      <div className="gf-form-inline">
        <div className="gf-form" style={{width:"100%"}}>
          <InlineFormLabel className="query-keyword width-8" tooltip="" >INPUT SQL</InlineFormLabel>
          <Input
            value={sql || ''}
            onChange={onSQLChange}
            placeholder="show databases"
          />
        </div>
      </div>
      <div className="gf-form-inline">
        <div className="gf-form" style={{width:"100%"}}>
          <div className="gf-form-inline">
            <InlineFormLabel className="query-keyword width-8">Timeshift</InlineFormLabel>
            <Input
              className="width-20"
              value={timeshiftPeriod || ''}
              onChange={onTimeshiftPeriodChange}
              placeholder="period number like: 1"
            />
          </div>
          <div className="gf-form-inline" style={{zIndex:1000}}>
            <InlineFormLabel className="query-keyword width-8" >Unit</InlineFormLabel>
            <Select
              menuPlacement="bottom"
              className="width-15"
              onChange={onTimeshiftUniteChange}
              value={timeshiftUnit||''}
              options={[
                { label: 'seconds', value: 'seconds' },
                { label: 'minutes', value: 'minutes' },
                { label: 'hours', value: 'hours' },
                { label: 'days', value: 'days' },
                { label: 'weeks', value: 'weeks' },
                { label: 'months', value: 'months' },
              ]}
              placeholder="Please Select"
            />
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" style={{marginRight:0}}></div>
          </div>
        </div>
      </div>
      <div className="gf-form gf-form--grow">  
        <div className="gf-form-inline">
          <div className="gf-form">
            <label
              className="gf-form-label query-keyword pointer"
              onClick={() => {
                const { datasource } = props;
                if (!isSQLHelpVisible) {
                  setLastGenerateSQL(datasource.generateSql(datasource.options,sql));
                }
                setIsSQLHelpVisible(!isSQLHelpVisible);
              }}
            >
              GENERATE SQL&nbsp;
              <Icon name={isSQLHelpVisible ? 'angle-down' : 'angle-right'} style={{ marginBottom: 0 }} />
            </label>
          </div>
          <InlineFormLabel className="query-keyword gf-form--grow" tooltip={
          <>
            <pre className="gf-form-pre alert alert-info">Use any SQL that can return Resultset such as:<br/>
              - [[timestamp1, value1], [timestamp2, value2], ... ]<br/>
              <br/>
              Macros:<br/>
              - $from -&gt; start timestamp of panel<br/>
              - $to -&gt; stop timestamp of panel<br/>
              - $interval -&gt; interval of panel<br/>
              <br/>
              Example of SQL:<br/>
              &nbsp;&nbsp;SELECT count(*)<br/>
              &nbsp;&nbsp;FROM db.table<br/>
              &nbsp;&nbsp;WHERE ts &gt; $from and ts &lt; $to<br/>
              &nbsp;&nbsp;INTERVAL ($interval)<br/>
            </pre>
          </>
        }>SHOW HELP</InlineFormLabel>
        </div>
        <div className="gf-form gf-form--grow">
          <div className="gf-form-label gf-form-label--grow" style={{marginRight:0}}></div>
        </div>
      </div>
      {isSQLHelpVisible&&<div className="gf-form-inline">
        <div className="gf-form" style={{width:"100%"}}>
          <Input
            readOnly
            value={lastGenerateSQL}
          />
        </div>
      </div>}
    </div> }
  </>);
}