const backendQueryMock = jest.fn();
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
  }

  return {
    DataSourceWithBackend: MockDataSourceWithBackend,
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
    templateReplaceMock.mockClear();
    templateVariablesMock.mockClear();
    templateVariablesMock.mockReturnValue([]);
  });

  it('rejects deprecated Arithmetic queries before backend execution', () => {
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);

    expect(() =>
      ds.query({
        targets: [{ refId: 'B', queryType: 'Arithmetic', expression: '$A + $B' }],
      } as any)
    ).toThrow('Use Grafana Expressions/Math for arithmetic instead.');
    expect(backendQueryMock).not.toHaveBeenCalled();
  });

  it('rejects deprecated plugin timeShift before backend execution', () => {
    const ds = new DataSource({ url: 'http://localhost', jsonData: {} } as any);

    expect(() =>
      ds.query({
        targets: [{ refId: 'A', queryType: 'SQL', sql: 'select 1', timeShiftPeriod: '1', timeShiftUnit: 'hours' }],
      } as any)
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
