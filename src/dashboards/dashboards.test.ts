/*
 * Copyright (c) 2019 TAOS Data, Inc. <jhtao@taosdata.com>
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

import taosX from './taosX.json';
import tdinsight from './TDinsightV3.json';

const datasourceInput = '${DS_TDENGINE}';
const runtimeDatasourceVariable = '$TDENGINE_DATASOURCE';

type Dashboard = typeof tdinsight | typeof taosX;

function simulatePluginDashboardImport(dashboard: Dashboard, datasourceName: string): Dashboard {
  return JSON.parse(JSON.stringify(dashboard).replaceAll(datasourceInput, datasourceName));
}

describe.each([
  ['TDinsight', tdinsight],
  ['taosX', taosX],
])('%s dashboard', (_name, dashboard) => {
  it('keeps query variables bound through a runtime datasource variable after plugin import', () => {
    const imported = simulatePluginDashboardImport(dashboard, 'TDengine primary');
    const datasourceVariable = imported.templating.list.find((variable) => variable.type === 'datasource');
    const queryVariables = imported.templating.list.filter((variable) => variable.type === 'query');

    expect(queryVariables.length).toBeGreaterThan(0);
    expect(queryVariables.map((variable) => variable.datasource)).toEqual(
      queryVariables.map(() => runtimeDatasourceVariable)
    );
    expect(datasourceVariable).toMatchObject({
      current: {
        text: 'TDengine primary',
        value: 'TDengine primary',
      },
      name: 'TDENGINE_DATASOURCE',
      query: 'tdengine-datasource',
    });
  });
});
