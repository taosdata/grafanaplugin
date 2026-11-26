import React from "react";
import {
    InlineFieldRow,
    Stack,
    Field,
    Input,
} from "@grafana/ui";
import { BuilderData } from "types";

type Props = {
    builderData: BuilderData
    onChange: (value: BuilderData) => void
};

export function QueryLimits({ builderData, onChange }: Props) {
    const onLimitChange = (event: React.FormEvent<HTMLInputElement>) => {
        const value = parseInt(event.currentTarget.value, 10);
        onChange({ ...builderData, limit: isNaN(value) ? undefined : value });
    };

    const onOffsetChange = (event: React.FormEvent<HTMLInputElement>) => {
        const value = parseInt(event.currentTarget.value, 10);
        onChange({ ...builderData, offset: isNaN(value) ? undefined : value });
    };

    const onSLimitChange = (event: React.FormEvent<HTMLInputElement>) => {
        const value = parseInt(event.currentTarget.value, 10);
        onChange({ ...builderData, sLimit: isNaN(value) ? undefined : value });
    };

    const onSOffsetChange = (event: React.FormEvent<HTMLInputElement>) => {
        const value = parseInt(event.currentTarget.value, 10);
        onChange({ ...builderData, sOffset: isNaN(value) ? undefined : value });
    };

    return (
        <InlineFieldRow>
            <Stack gap={2} alignItems="end">
                <Field label="Limit">
                    <Input
                        type="number"
                        value={builderData.limit?.toString() || ''}
                        onChange={onLimitChange}
                        placeholder="Optional"
                        width={20}
                    />
                </Field>
                <Field label="Offset">
                    <Input
                        type="number"
                        value={builderData.offset?.toString() || ''}
                        onChange={onOffsetChange}
                        placeholder="Optional"
                        width={20}
                    />
                </Field>
                <Field label="SLimit">
                    <Input
                        type="number"
                        value={builderData.sLimit?.toString() || ''}
                        onChange={onSLimitChange}
                        placeholder="Optional"
                        width={20}
                    />
                </Field>
                <Field label="SOffset">
                    <Input
                        type="number"
                        value={builderData.sOffset?.toString() || ''}
                        onChange={onSOffsetChange}
                        placeholder="Optional"
                        width={20}
                    />
                </Field>
            </Stack>
        </InlineFieldRow>
    );
}