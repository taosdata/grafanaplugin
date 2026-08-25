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
