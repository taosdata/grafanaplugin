import {DataSourcePlugin} from '@grafana/data'
import {DataSource} from './datasource';
import {ConfigEditor} from './components/ConfigEditor/ConfigEditor'
import {QueryEditor} from './components/QueryEditor/QueryEditor'
import {DataSourceOptions, Query} from './types';

export const plugin = new DataSourcePlugin<DataSource, Query, DataSourceOptions>(DataSource)
    .setConfigEditor(ConfigEditor)
    .setQueryEditor(QueryEditor)
