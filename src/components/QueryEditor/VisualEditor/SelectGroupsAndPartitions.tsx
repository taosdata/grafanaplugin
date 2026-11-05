import React from "react";
import { SelectableValue } from "@grafana/data";
import { InlineFieldRow, Stack, Field, Select } from "@grafana/ui";
import { BuilderData } from "types";

type Props = {
    builderData: BuilderData
    onChange: (value: BuilderData) => void
    columns: SelectableValue<string>[]
};

export function SelectGroupsAndPartitions({ builderData, onChange, columns }: Props) {
    return (
        <InlineFieldRow>
            <Stack gap={2} alignItems="end">
                <Field label="Group by">
                    <Select
                        width={40}
                        options={columns}
                        isMulti
                        value={
                            (builderData.groupBy || []).map((col) => ({
                                label: col,
                                value: col,
                            }))
                        }
                        onChange={(selectables) => {
                            const cols = (selectables ?? []).map(
                                (s: SelectableValue<string>) => s.value ?? ''
                            );
                            onChange({
                                ...builderData,
                                groupBy: cols,
                            });
                        }}
                        placeholder="Select columns"
                        disabled={!builderData.table}
                    />
                </Field>
                <Field label="Partition by">
                    <Select
                        width={40}
                        options={columns}
                        isMulti
                        value={
                            (builderData.partitionBy || []).map((col) => ({
                                label: col,
                                value: col,
                            }))
                        }
                        onChange={(selectables) => {
                            const cols = (selectables ?? []).map(
                                (s: SelectableValue<string>) => s.value ?? ''
                            );
                            onChange({
                                ...builderData,
                                partitionBy: cols,
                            });
                        }}
                        placeholder="Select columns"
                        disabled={!builderData.table}
                    />
                </Field>
            </Stack>
        </InlineFieldRow>
    );
}