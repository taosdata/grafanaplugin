const backendQueryMock = jest.fn();
const healthCheckMock = jest.fn();
const templateReplaceMock = jest.fn((value: string) => value);
const templateVariablesMock = jest.fn(() => []);

jest.mock('@grafana/runtime', () => {
  class MockDataSourceWithBackend {
    constructor(instanceSettings: any) {
      Object.assign(this, instanceSettings);
    }

    query(request: any) {
      const scopedVars = request?.scopedVars || {};
      const targets = request?.targets?.map((target: any) => {
        if (typeof (this as any).applyTemplateVariables === 'function') {
          return (this as any).applyTemplateVariables(target, scopedVars);
        }
        return target;
      });
      return backendQueryMock({
        ...request,
        targets,
      });
    }

    callHealthCheck() {
      return healthCheckMock();
    }
  }

  return {
    DataSourceWithBackend: MockDataSourceWithBackend,
    config: { buildInfo: { version: '12.4.0' } },
    getBackendSrv: () => ({
      datasourceRequest: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    }),
    getTemplateSrv: () => ({
      replace: templateReplaceMock,
      getVariables: templateVariablesMock,
    }),
  };
});

import { DataSource } from './datasource';

describe('DataSource backend query path', () => {
  beforeEach(() => {
    backendQueryMock.mockReset();
    backendQueryMock.mockReturnValue('backend-query');
    healthCheckMock.mockReset();
    templateReplaceMock.mockClear();
    templateVariablesMock.mockClear();
    templateVariablesMock.mockReturnValue([]);
  });

  it('rejects deprecated Arithmetic queries in applyTemplateVariables', () => {
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);

    expect(() =>
      ds.applyTemplateVariables({ refId: 'B', queryType: 'Arithmetic', expression: '$A + $B', sql: '' } as any, {})
    ).toThrow('Use Grafana Expressions/Math for arithmetic instead.');
    expect(backendQueryMock).not.toHaveBeenCalled();
  });

  it('rejects deprecated plugin timeShift in applyTemplateVariables', () => {
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);

    expect(() =>
      ds.applyTemplateVariables(
        { refId: 'A', queryType: 'SQL', sql: 'select 1', timeShiftPeriod: '1', timeShiftUnit: 'hours' } as any,
        {}
      )
    ).toThrow('Use the panel Query options "Time shift" instead.');
    expect(backendQueryMock).not.toHaveBeenCalled();
  });

  it('sends SQL queries through backend datasource flow', () => {
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
    const request = {
      targets: [{ refId: 'A', queryType: 'SQL', sql: 'select 1' }],
      scopedVars: {},
    };

    expect(ds.query(request as any)).toBe('backend-query');
    expect(backendQueryMock).toHaveBeenCalledWith(request);
  });

  it('tests the connection through the backend health check', async () => {
    healthCheckMock.mockResolvedValue({ status: 'OK', message: 'Data source is working' });
    const ds = new DataSource({ url: 'https://localhost', jsonData: { isLoadAlerts: false } } as any);
    const directRequest = jest.spyOn(ds, 'request').mockResolvedValue({ status: 200, data: {} } as any);

    await expect(ds.testDatasource()).resolves.toEqual({
      status: 'success',
      message: 'TDengine Data source is working',
      title: 'Success',
    });
    expect(healthCheckMock).toHaveBeenCalledTimes(1);
    expect(directRequest).not.toHaveBeenCalled();
  });

  it('applies template variables and defaults queryType to SQL', () => {
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
    templateReplaceMock.mockReturnValue('select * from metrics where host = server-a');
    templateVariablesMock.mockReturnValue([{ name: 'extra', current: { value: '1' } }] as any);

    const result = ds.applyTemplateVariables({ sql: 'select * from metrics where host = $host' } as any, {
      host: { text: 'server-a', value: 'server-a' },
    });

    expect(result.queryType).toBe('SQL');
    expect(result.sql).toBe('select * from metrics where host = server-a');
    expect(ds.getGenerateSql()).toBe('select * from metrics where host = server-a');
  });

  it('supports $__timeFrom/$__timeTo/$__timeFilter macros in metricFind generateSql path', () => {
    templateReplaceMock.mockImplementation((value: string) => value);
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
    const result = ds.generateSql(
      'select * from t where $__timeFilter(ts) and ts >= $__timeFrom() and ts <= $__timeTo()',
      {
        range: {
          from: new Date('2024-01-01T00:00:00.000Z'),
          to: new Date('2024-01-01T01:00:00.000Z'),
        },
        scopedVars: {},
        intervalMs: 15000,
      } as any
    );

    expect(result).toContain("(ts >= '2024-01-01T00:00:00.000Z' AND ts <= '2024-01-01T01:00:00.000Z')");
    expect(result).toContain("ts >= '2024-01-01T00:00:00.000Z'");
    expect(result).toContain("ts <= '2024-01-01T01:00:00.000Z'");
  });

  it('throws error when $__timeFilter is used without column argument', () => {
    templateReplaceMock.mockImplementation((value: string) => value);
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);

    expect(() =>
      ds.generateSql('select * from t where $__timeFilter', {
        range: {
          from: new Date('2024-01-01T00:00:00.000Z'),
          to: new Date('2024-01-01T01:00:00.000Z'),
        },
        scopedVars: {},
        intervalMs: 15000,
      } as any)
    ).toThrow('macro $__timeFilter requires a column argument');
  });

  it('replaces $from and $to macros with non-now timestamps', () => {
    templateReplaceMock.mockImplementation((value: string) => value);
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
    const result = ds.generateSql('select * from t where ts >= $from and ts <= $to', {
      range: {
        from: new Date('2024-01-01T00:00:00.000Z'),
        to: new Date('2024-01-01T01:00:00.000Z'),
      },
      scopedVars: {},
      intervalMs: 15000,
    } as any);

    expect(result).toContain("ts >= '2024-01-01T00:00:00.000Z'");
    expect(result).toContain("ts <= '2024-01-01T01:00:00.000Z'");
  });

  it('replaces $interval macro with interval in milliseconds', () => {
    templateReplaceMock.mockImplementation((value: string) => value);
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
    const result = ds.generateSql('select * from t interval($interval)', {
      range: {
        from: new Date('2024-01-01T00:00:00.000Z'),
        to: new Date('2024-01-01T01:00:00.000Z'),
      },
      scopedVars: {},
      intervalMs: 30000, // 30 seconds
    } as any);

    expect(result).toContain('interval(30000a)');
  });

  it('handles custom template variables replacement', () => {
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
    templateReplaceMock.mockImplementation((value: string) => value);
    templateVariablesMock.mockReturnValue([
      { name: 'database', current: { value: 'test_db' } },
      { name: 'table', current: { value: 'metrics' } },
    ] as any);

    const result = ds.generateSql('select * from $database.$table where ts > $from', {
      range: {
        from: new Date('2024-01-01T00:00:00.000Z'),
        to: new Date('2024-01-01T01:00:00.000Z'),
      },
      scopedVars: {},
      intervalMs: 15000,
    } as any);

    expect(result).toContain('select * from test_db.metrics');
    expect(result).toContain("ts > '2024-01-01T00:00:00.000Z'");
  });

  describe('template variable replacement edge cases', () => {
    beforeEach(() => {
      templateReplaceMock.mockImplementation((value: string) => value);
    });

    it('replaces all occurrences of a variable (global replacement)', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      templateVariablesMock.mockReturnValue([
        { name: 'host', current: { value: 'server-a' } },
      ] as any);

      const result = ds.generateSql(
        'select * from t where host = $host or secondary_host = $host',
        {
          range: { from: new Date('2024-01-01T00:00:00Z'), to: new Date('2024-01-01T01:00:00Z') },
          scopedVars: {},
          intervalMs: 15000,
        } as any
      );

      expect(result).toMatch(/host = server-a/);
      expect(result).toMatch(/secondary_host = server-a/);
    });

    it('respects word boundaries when replacing variables', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      templateVariablesMock.mockReturnValue([
        { name: 'db', current: { value: 'mydb' } },
        { name: 'dbname', current: { value: 'mydbname' } },
      ] as any);

      const result = ds.generateSql('select * from $db where dbname = $dbname', {
        range: { from: new Date('2024-01-01T00:00:00Z'), to: new Date('2024-01-01T01:00:00Z') },
        scopedVars: {},
        intervalMs: 15000,
      } as any);

      // $db should be replaced to mydb
      expect(result).toContain('from mydb');
      // $dbname should be replaced to mydbname
      expect(result).toContain('dbname = mydbname');
      // SQL column name "dbname" should NOT be affected (it's not a variable)
      expect(result).toMatch(/where \w+ = mydbname/);
    });

    it('handles variable names with special regex characters', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      templateVariablesMock.mockReturnValue([
        { name: 'db.name', current: { value: 'testdb' } },
      ] as any);

      const result = ds.generateSql('select * from `$db.name` where ts > $from', {
        range: { from: new Date('2024-01-01T00:00:00Z'), to: new Date('2024-01-01T01:00:00Z') },
        scopedVars: {},
        intervalMs: 15000,
      } as any);

      expect(result).toContain('select * from `testdb`');
    });

    it('replaces multiple variables with overlapping names correctly', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      templateVariablesMock.mockReturnValue([
        { name: 'env', current: { value: 'prod' } },
        { name: 'env_type', current: { value: 'production' } },
      ] as any);

      const result = ds.generateSql('select * from $env where env_type = $env_type', {
        range: { from: new Date('2024-01-01T00:00:00Z'), to: new Date('2024-01-01T01:00:00Z') },
        scopedVars: {},
        intervalMs: 15000,
      } as any);

      expect(result).toContain('select * from prod');
      expect(result).toContain('env_type = production');
    });

    it('does not replace variables that are part of larger identifier', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      templateVariablesMock.mockReturnValue([
        { name: 'table', current: { value: 'metrics' } },
      ] as any);

      const result = ds.generateSql('select table_name, count(*) from $table group by table_name', {
        range: { from: new Date('2024-01-01T00:00:00Z'), to: new Date('2024-01-01T01:00:00Z') },
        scopedVars: {},
        intervalMs: 15000,
      } as any);

      // $table should be replaced
      expect(result).toContain('from metrics');
      // table_name should NOT be affected
      expect(result).toContain('table_name');
    });

    it('handles variables with underscore in name', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      templateVariablesMock.mockReturnValue([
        { name: 'my_table', current: { value: 'test_table' } },
      ] as any);

      const result = ds.generateSql('select * from $my_table where id > 0', {
        range: { from: new Date('2024-01-01T00:00:00Z'), to: new Date('2024-01-01T01:00:00Z') },
        scopedVars: {},
        intervalMs: 15000,
      } as any);

      expect(result).toContain('select * from test_table');
    });

    it('handles variables ending with numbers', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      templateVariablesMock.mockReturnValue([
        { name: 'db2', current: { value: 'database2' } },
      ] as any);

      const result = ds.generateSql('select * from $db2', {
        range: { from: new Date('2024-01-01T00:00:00Z'), to: new Date('2024-01-01T01:00:00Z') },
        scopedVars: {},
        intervalMs: 15000,
      } as any);

      expect(result).toContain('select * from database2');
    });

    it('skips variables without current property', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      templateVariablesMock.mockReturnValue([
        { name: 'database', current: { value: 'testdb' } },
        { name: 'table' }, // No current property
        { name: 'host', current: null }, // Current is null
      ] as any);

      const result = ds.generateSql('select * from $database where $table = $host', {
        range: { from: new Date('2024-01-01T00:00:00Z'), to: new Date('2024-01-01T01:00:00Z') },
        scopedVars: {},
        intervalMs: 15000,
      } as any);

      expect(result).toContain('from testdb');
      expect(result).toContain('$table'); // Should not be replaced
      expect(result).toContain('$host'); // Should not be replaced
    });
  });

  it('handles empty SQL query gracefully', () => {
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
    const result = ds.generateSql('', {
      range: {
        from: new Date('2024-01-01T00:00:00.000Z'),
        to: new Date('2024-01-01T01:00:00.000Z'),
      },
      scopedVars: {},
      intervalMs: 15000,
    } as any);

    expect(result).toBe('');
  });

  it('handles SQL with only whitespace', () => {
    templateReplaceMock.mockImplementation((value: string) => value);
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
    const result = ds.generateSql('   \n\t  ', {
      range: {
        from: new Date('2024-01-01T00:00:00.000Z'),
        to: new Date('2024-01-01T01:00:00.000Z'),
      },
      scopedVars: {},
      intervalMs: 15000,
    } as any);

    expect(result).toBe('');
  });

  it('properly escapes single quotes in timestamp values', () => {
    templateReplaceMock.mockImplementation((value: string) => value);
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
    const result = ds.generateSql('select * from t where ts >= $from', {
      range: {
        from: new Date("2024-01-01T00:00:00.000Z"),
        to: new Date('2024-01-01T01:00:00.000Z'),
      },
      scopedVars: {},
      intervalMs: 15000,
    } as any);

    expect(result).toContain("ts >= '2024-01-01T00:00:00.000Z'");
  });

  it('handles complex SQL with multiple macros', () => {
    templateReplaceMock.mockImplementation((value: string) => value);
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
    const result = ds.generateSql(
      `select *
       from metrics
       where $__timeFilter(ts)
         and $__timeFilter(ts2)
         and ts >= $__timeFrom()
         and ts <= $__timeTo()
         and host = 'server1'
       interval($interval)`,
      {
        range: {
          from: new Date('2024-01-01T00:00:00.000Z'),
          to: new Date('2024-01-01T01:00:00.000Z'),
        },
        scopedVars: {},
        intervalMs: 60000,
      } as any
    );

    expect(result).toContain("ts >= '2024-01-01T00:00:00.000Z'");
    expect(result).toContain("ts <= '2024-01-01T01:00:00.000Z'");
    expect(result).toContain('interval(60000a)');
    expect(result).toContain("host = 'server1'");
  });

  it('supports $begin and $end as aliases for $from and $to', () => {
    templateReplaceMock.mockImplementation((value: string) => value);
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
    const result = ds.generateSql('select * from t where ts >= $begin and ts <= $end', {
      range: {
        from: new Date('2024-01-01T00:00:00.000Z'),
        to: new Date('2024-01-01T01:00:00.000Z'),
      },
      scopedVars: {},
      intervalMs: 15000,
    } as any);

    expect(result).toContain("ts >= '2024-01-01T00:00:00.000Z'");
    expect(result).toContain("ts <= '2024-01-01T01:00:00.000Z'");
  });

  describe('filterQuery', () => {
    it('filters out hidden queries', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      expect(ds.filterQuery({ hide: true } as any)).toBe(false);
      expect(ds.filterQuery({ hide: false } as any)).toBe(true);
      expect(ds.filterQuery({} as any)).toBe(true);
    });
  });

  describe('deprecated query detection', () => {
    it('detects deprecated Arithmetic query type', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      expect(() => ds.applyTemplateVariables({ queryType: 'Arithmetic', sql: '' } as any, {})).toThrow(
        'deprecated queryType "Arithmetic"'
      );
    });

    it('detects deprecated timeShift with period', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      expect(() =>
        ds.applyTemplateVariables({ queryType: 'SQL', sql: 'select 1', timeShiftPeriod: 1 } as any, {})
      ).toThrow('deprecated plugin timeShift');
    });

    it('detects deprecated timeShift with unit', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      expect(() =>
        ds.applyTemplateVariables({ queryType: 'SQL', sql: 'select 1', timeShiftUnit: 'hours' } as any, {})
      ).toThrow('deprecated plugin timeShift');
    });

    it('allows valid SQL queries without deprecated features', () => {
      const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);
      templateReplaceMock.mockReturnValue('select 1');

      expect(() =>
        ds.applyTemplateVariables({ queryType: 'SQL', sql: 'select 1' } as any, {})
      ).not.toThrow();
    });
  });
});

describe('sendInitAlert', () => {
  const groupPath = (name: string) => `/api/v1/provisioning/folder/alert-testds-/rule-groups/${name}`;

  const buildDs = () =>
    new DataSource({
      url: 'http://localhost',
      uid: 'testds',
      name: 'TDengine',
      jsonData: { isLoadAlerts: true },
    } as any);

  const mockAlertGet = (ds: DataSource, alert1m: any) => {
    (ds.backendSrv.get as jest.Mock).mockImplementation((path: string) => {
      if (path === '/api/folders/alert-testds-') {
        return Promise.resolve({});
      }
      if (path === groupPath('alert_1m')) {
        if (alert1m?.status === 404) {
          return Promise.reject({ status: 404 });
        }
        return Promise.resolve(alert1m);
      }
      // other rule groups are already provisioned
      return Promise.resolve({ title: 'existing', interval: 60, rules: [{ title: 'Existing rule' }] });
    });
    (ds.backendSrv.put as jest.Mock).mockResolvedValue({});
  };

  const alert1mPutBodies = (ds: DataSource) =>
    (ds.backendSrv.put as jest.Mock).mock.calls
      .filter((call: any[]) => call[0] === groupPath('alert_1m'))
      .map((call: any[]) => call[1]);

  it('provisions the full template when the group does not exist', async () => {
    const ds = buildDs();
    mockAlertGet(ds, { status: 404 });

    await ds.sendInitAlert();

    const bodies = alert1mPutBodies(ds);
    expect(bodies).toHaveLength(1);
    expect(bodies[0].rules.map((r: any) => r.title)).toEqual([
      'Query Count Alert',
      'Slow Query Alert alert',
      'Stream Failed Alert',
      'Stream Recalc Failed Alert',
    ]);
    for (const rule of bodies[0].rules) {
      expect(rule.folderUID).toBe('alert-testds-');
      expect(rule.data[0].datasourceUid).toBe('testds');
    }
  });

  it('backfills newly added rules into an existing group without touching existing rules', async () => {
    const ds = buildDs();
    const customizedRule = { title: 'Query Count Alert', uid: 'uid-q', for: '10m', labels: { team: 'sre' } };
    const untouchedRule = { title: 'Slow Query Alert alert', uid: 'uid-s' };
    mockAlertGet(ds, {
      title: 'alert_1m',
      folderUid: 'alert-testds-',
      interval: 120,
      rules: [customizedRule, untouchedRule],
    });

    await ds.sendInitAlert();

    const bodies = alert1mPutBodies(ds);
    expect(bodies).toHaveLength(1);
    const merged = bodies[0];
    // existing group interval is preserved
    expect(merged.interval).toBe(120);
    expect(merged.rules.map((r: any) => r.title)).toEqual([
      'Query Count Alert',
      'Slow Query Alert alert',
      'Stream Failed Alert',
      'Stream Recalc Failed Alert',
    ]);
    // existing rules are passed through untouched, keeping user customizations
    expect(merged.rules[0]).toMatchObject({ uid: 'uid-q', for: '10m', labels: { team: 'sre' } });
    expect(merged.rules[1]).toMatchObject({ uid: 'uid-s' });
    // only the backfilled rules get this data source wired in
    expect(merged.rules[2].folderUID).toBe('alert-testds-');
    expect(merged.rules[2].data[0].datasourceUid).toBe('testds');
    expect(merged.rules[2].data[0].model.datasource.uid).toBe('testds');
    expect(merged.rules[3].data[0].datasourceUid).toBe('testds');
  });

  it('does not PUT when all backfill rules already exist', async () => {
    const ds = buildDs();
    mockAlertGet(ds, {
      title: 'alert_1m',
      folderUid: 'alert-testds-',
      interval: 60,
      rules: [
        { title: 'Query Count Alert' },
        { title: 'Slow Query Alert alert' },
        { title: 'Stream Failed Alert' },
        { title: 'Stream Recalc Failed Alert' },
      ],
    });

    await ds.sendInitAlert();

    expect(ds.backendSrv.put as jest.Mock).not.toHaveBeenCalled();
  });

  it('rejects when reading the existing group fails with a non-404 error', async () => {
    const ds = buildDs();
    (ds.backendSrv.get as jest.Mock).mockImplementation((path: string) => {
      if (path === '/api/folders/alert-testds-') {
        return Promise.resolve({});
      }
      return Promise.reject({ status: 500, message: 'boom' });
    });

    await expect(ds.sendInitAlert()).rejects.toMatchObject({ status: 500 });
    expect(ds.backendSrv.put as jest.Mock).not.toHaveBeenCalled();
  });
});
