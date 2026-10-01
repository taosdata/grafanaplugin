import React, { useState, useEffect } from "react";
import { SelectableValue } from "@grafana/data";
import { InlineFieldRow, Stack, Field, Select } from "@grafana/ui";
import { tsColumn } from "./SelectColumns";
import { EditorProps } from "../types";

export function QueryHeader({ query, onChange, datasource }: EditorProps) {
    const [databases, setDatabases] = useState<SelectableValue<string>[]>([]);
    const [tables, setTables] = useState<SelectableValue<string>[]>([]);

    // Load databases
    const loadDatabases = async (): Promise<void> => {
        try {
            const dbs = await datasource.metricFindQuery(
                'SHOW DATABASES',
                undefined
            );
            setDatabases(dbs.map((r) => ({
                label: r.text,
                value: String(r.value ?? r.text),
            })));
        } catch (error) {
            console.error('Failed to load databases:', error);
            setDatabases([]);
        }
    };

    // Load tables
    const loadTables = async (): Promise<void> => {
        if (!query.builderData.database) {
            setTables([]);
        }
        try {
            const tbls = await datasource.metricFindQuery(
                `SHOW ${query.builderData.database}.TABLES;`,
                undefined
            );
            const vtbls = await datasource.metricFindQuery(
                `SHOW ${query.builderData.database}.VTABLES;`,
                undefined
            );
            setTables(
                vtbls.map((r) => ({
                    label: "V " + r.text,
                    value: String(r.value ?? r.text),
                })).concat(
                    tbls.map((r) => ({
                        label: r.text,
                        value: String(r.value ?? r.text),
                    }))
                )
            )
        } catch (error) {
            console.error('Failed to load tables:', error);
            setTables([]);
        }
    }

    useEffect(() => {
        loadDatabases()
    }, [datasource])

    useEffect(() => {
        loadTables()
    }, [datasource, query.builderData.database])

    const onDatabaseChange = (
        opt: SelectableValue<string> | null | undefined
    ) => {
        onChange({
            ...query,
            builderData: {
                ...query.builderData,
                database: opt?.value,
                table: undefined,
                columns: [{ ...tsColumn }],
            }
        });
    };

    const onTableChange = (
        opt: SelectableValue<string> | null | undefined
    ) => {
        onChange({
            ...query,
            builderData: {
                ...query.builderData,
                table: opt?.value,
                columns: [{ ...tsColumn }],
            }
        });
    };

    return (
        <InlineFieldRow>
            <Stack gap={2} alignItems="end">
                <Field label="Database">
                    <Select
                        value={query.builderData.database}
                        options={databases}
                        width={30}
                        onChange={onDatabaseChange}
                        placeholder="Select database"
                    />
                </Field>
                <Field label="Table">
                    <Select
                        value={query.builderData.table ?? ''}
                        options={tables}
                        disabled={!query.builderData.database}
                        placeholder="Select table"
                        onChange={onTableChange}
                        width={30}
                    />
                </Field>
            </Stack>
        </InlineFieldRow>
    );
}