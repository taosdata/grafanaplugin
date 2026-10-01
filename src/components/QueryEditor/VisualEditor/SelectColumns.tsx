import React from "react";
import {
    InlineFieldRow,
    Stack,
    Select,
    Field,
    Input,
    Button,
} from "@grafana/ui";
import { SelectableValue } from "@grafana/data";
import { BuilderData } from "types";
import { OptionalLabel } from "./Utils";

const AGGREGATION_FUNCTIONS = [
    { label: 'AVG', value: 'avg' },
    { label: 'SUM', value: 'sum' },
    { label: 'MAX', value: 'max' },
    { label: 'MIN', value: 'min' },
    { label: 'COUNT', value: 'count' },
    { label: 'FIRST', value: 'first' },
    { label: 'LAST', value: 'last' },
];

export const tsColumn = {
    column: 'ts',
    function: '',
    alias: ''
}

export const defaultColumn = {
    column: '',
    function: '',
    alias: ''
}

type Props = {
    builderData: BuilderData
    onChange: (value: BuilderData) => void
    columns: SelectableValue<string>[]
};

export function SelectColumns({ builderData, onChange, columns }: Props) {
    const onColumnChange = (
        index: number,
        field: 'column' | 'function' | 'alias',
        value: string
    ) => {
        const newColumns = [...(builderData.columns || [])];
        if (!newColumns[index]) {
            newColumns[index] = {...defaultColumn};
        }
        newColumns[index] = { ...newColumns[index], [field]: value };
        onChange({ ...builderData, columns: newColumns });
    };

    const addColumn = () => {
        onChange({
            ...builderData,
            columns: [
                ...(builderData.columns || []),
                {...defaultColumn},
            ],
        });
    };

    const removeColumn = (index: number) => {
        const newColumns = (builderData.columns || []).filter(
            (_, i) => i !== index
        );
        onChange({ ...builderData, columns: newColumns });
    };

    return (
        <InlineFieldRow>
            <Stack gap={0} wrap="wrap" direction="column">
                {(builderData.columns || [{...tsColumn}]).map((col, index) => (
                    <div key={index}>
                        <Stack gap={2} alignItems="end">
                            <Field label={<OptionalLabel label="Data operations" />}>
                                <Select
                                    value={col.function}
                                    options={AGGREGATION_FUNCTIONS}
                                    disabled={!builderData.table}
                                    isClearable
                                    menuShouldPortal
                                    allowCustomValue
                                    onChange={(opt) => onColumnChange(
                                        index,
                                        'function',
                                        opt?.value ?? ''
                                    )}
                                    width={30}
                                />
                            </Field>
                            <Field label="Column">
                                <Select
                                    options={columns}
                                    value={col.column}
                                    disabled={!builderData.table}
                                    onChange={(opt) => onColumnChange(index, 'column', opt?.value ?? '')}
                                    placeholder="Column"
                                    width={30}
                                />
                            </Field>
                            <Field label={<OptionalLabel label="Alias" />}>
                                <Input
                                    value={col.alias || ''}
                                    disabled={!builderData.table}
                                    onChange={(evt) => onColumnChange(
                                        index,
                                        'alias',
                                        evt?.currentTarget?.value ?? ''
                                    )}
                                    placeholder="Optional"
                                    width={30}
                                />
                            </Field>
                            <Field>
                                <Button
                                    aria-label="Remove column"
                                    type="button"
                                    icon="trash-alt"
                                    variant="secondary"
                                    size="md"
                                    onClick={() => removeColumn(index)}
                                />
                            </Field>
                        </Stack>
                    </div>
                ))}
                <Field>
                    <Button
                        type="button"
                        onClick={addColumn}
                        variant="secondary"
                        aria-label="Add column"
                        size="md"
                        icon="plus"
                        style={{ alignSelf: "flex-start" }}
                        disabled={!builderData.table}
                    />
                </Field>
            </Stack>
        </InlineFieldRow>
    );
}
