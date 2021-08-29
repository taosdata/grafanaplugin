import React, { ChangeEvent } from 'react';
import { LegacyForms } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions } from './types';

const { Input } = LegacyForms;

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }) => {
  const onUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    options.jsonData.url=event.target.value;
    onOptionsChange({...options});
  };
  const onUserChange = (event: ChangeEvent<HTMLInputElement>) => {
    options.jsonData.user=event.target.value;
    onOptionsChange({...options});
  };
  const onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    options.jsonData.password=event.target.value;
    onOptionsChange({...options});
  };
  return (
    <>
      <div className="gf-form max-width-30">
        <span className="gf-form-label width-7">Host</span>
        <Input
          value={options.jsonData.url || ''}
          placeholder="http://localhost:6041"
          onChange={onUrlChange}
        />
      </div>
      <div className="gf-form-inline">
        <div className="gf-form max-width-15">
          <span className="gf-form-label width-7">User</span>
          <Input
            value={options.jsonData.user || ''}
            placeholder="root"
            onChange={onUserChange}
          />
        </div>
        <div className="gf-form max-width-15">
          <span className="gf-form-label width-7">Password</span>
          <Input
            type="password"
            value={options.jsonData.password || ''}
            placeholder="taosdata"
            onChange={onPasswordChange}
          />
        </div>
      </div>
    </>
  );
};
