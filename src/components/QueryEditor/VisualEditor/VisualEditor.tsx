import React, { useEffect, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import {
    InlineField,
    InlineFieldRow,
    CodeEditor,
    Input,
    Field,
    Stack,
    InlineLabel,
    Space,
} from '@grafana/ui';
import { EditorProps } from '../types';
import { BuilderData } from '../../../types';
import { QueryHeader } from './QueryHeader';
import { SelectColumns } from './SelectColumns';
import { QueryLimits } from './QueryLimits';
import { SelectGroupsAndPartitions } from './SelectGroupsAndPartitions';
import { QueryWindow } from './QueryWindow';

export function VisualEditor(props: EditorProps) {
    const { query, onChange, datasource } = props;
    const { builderData } = query
    const [generatedSQL, setGeneratedSQL] = useState<string>('');
    const [columns, setColumns] = useState<SelectableValue<string>[]>([]);

    const onBuilderDataChange = (value: BuilderData) => {
        onChange({ ...query, builderData: value });
    }

    const loadColumns = async (): Promise<void> => {
        if (!builderData.database || !builderData.table) {
            setColumns([]);
        }
        try {
            const cols = await datasource.metricFindQuery(
                `DESC ${builderData.database}.${builderData.table}`,
                undefined
            );
            const parsedCols = cols.map((r) => ({
                label: r.text.split(',')[0],
                value: String(r.value ?? r.text).split(',')[0],
            }));
            setColumns([{ label: 'tbname', value: 'tbname' }, ...parsedCols]);
        } catch (error) {
            console.error('Failed to load columns:', error);
            setColumns([]);
        }
    };

    useEffect(() => {
        loadColumns()
    }, [datasource, builderData.database, builderData.table])

    useEffect(() => {
        const sql = generateSQL(builderData);
        setGeneratedSQL(sql);
        if (sql !== query.sql) {
            onChange({ ...query, sql });
        }
    }, [query]);

    const onWhereChange = (event: React.FormEvent<HTMLInputElement>) => {
        onBuilderDataChange({ ...builderData, whereClause: event.currentTarget.value });
    };

    return (
        <Stack gap={1} direction="column">
            <Space v={1} />
            <QueryHeader {...props} />

            <InlineFieldRow>
                <InlineLabel>Columns</InlineLabel>
            </InlineFieldRow>
            <SelectColumns builderData={builderData} onChange={onBuilderDataChange} columns={columns} />

            <InlineFieldRow>
                <InlineLabel>Filtering</InlineLabel>
            </InlineFieldRow>
            <InlineFieldRow>
                <Field label="Where">
                    <Input
                        value={builderData.whereClause || ''}
                        onChange={onWhereChange}
                        placeholder="e.g ts > $from AND ts < $to"
                        width={40}
                    />
                </Field>
            </InlineFieldRow>

            <InlineFieldRow>
                <InlineLabel>Groups/Partitions</InlineLabel>
            </InlineFieldRow>
            <SelectGroupsAndPartitions builderData={builderData} onChange={onBuilderDataChange} columns={columns} />

            <InlineFieldRow>
                <InlineLabel>Window</InlineLabel>
            </InlineFieldRow>
            <QueryWindow builderData={builderData} onChange={onBuilderDataChange} />

            <InlineFieldRow>
                <InlineLabel>Limits</InlineLabel>
            </InlineFieldRow>
            <QueryLimits builderData={builderData} onChange={onBuilderDataChange} />

            <InlineFieldRow>
                <InlineLabel>Preview</InlineLabel>
            </InlineFieldRow>
            <InlineFieldRow>
                <InlineField shrink={false} grow={true} >
                    <CodeEditor
                        language="sql"
                        height={150}
                        value={generatedSQL || ''}
                        readOnly={true}
                        monacoOptions={{
                            lineNumbers: 'off',
                            minimap: { enabled: false },
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            fontSize: 13,
                        }}
                    />
                </InlineField>
            </InlineFieldRow>
        </Stack>
    );
}

// Generate SQL
function generateSQL(builderData: BuilderData): string {
    const parts: string[] = [];
    const selectParts: string[] = [];

    if (builderData.database && builderData.table && builderData.columns && builderData.columns.length > 0) {
        builderData.columns.forEach((col) => {
            if (!col.column) {
                return
            }
            let selectPart = col.column;
            if (col.function) {
                selectPart = `${col.function.toUpperCase()}(${selectPart})`
            }
            if (col.alias) {
                selectPart = `${selectPart} AS ${col.alias}`
            }
            selectParts.push(selectPart)
        });
    }
    if (!selectParts.length) {
        return '';
    }
    parts.push(`SELECT ${selectParts.join(', ')}`);
    if (builderData.database && builderData.table) {
        parts.push(`FROM ${builderData.database}.${builderData.table}`);
    }
    if (builderData.whereClause) {
        const whereParts: string[] = [];
        whereParts.push(builderData.whereClause);
        if (whereParts.length > 0) {
            parts.push(`WHERE ${whereParts.join(' AND ')}`);
        }
    }
    if (builderData.partitionBy && builderData.partitionBy.length > 0) {
        parts.push(`PARTITION BY ${builderData.partitionBy.join(', ')}`);
    }
    if (builderData.interval && builderData.interval.number && builderData.interval.unit) {
        parts.push(`INTERVAL(${builderData.interval.number}${builderData.interval.unit})`);
        if (builderData.sliding && builderData.sliding.number && builderData.sliding.unit) {
            parts.push(`SLIDING(${builderData.sliding.number}${builderData.sliding.unit})`);
        }
    }
    if (builderData.groupBy && builderData.groupBy.length > 0) {
        parts.push(`GROUP BY ${builderData.groupBy.join(', ')}`);
    }
    if (builderData.sLimit) {
        parts.push(`SLIMIT ${builderData.sLimit}`);
        if (builderData.sOffset) {
            parts.push(`SOFFSET ${builderData.sOffset}`);
        }
    }
    if (builderData.limit) {
        parts.push(`LIMIT ${builderData.limit}`);
        if (builderData.offset) {
            parts.push(`OFFSET ${builderData.offset}`);
        }
    }
    return parts.join(' ');
}