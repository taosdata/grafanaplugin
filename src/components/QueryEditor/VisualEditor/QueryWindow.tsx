import React from "react";
import { InlineFieldRow, Stack, Field, Input} from "@grafana/ui";
import { BuilderData } from "types";
import { OptionalLabel } from "./Utils";

type Props = {
    builderData: BuilderData
    onChange: (value: BuilderData) => void
};

export function QueryWindow({ builderData, onChange }: Props) {
    return (
        <InlineFieldRow>
            <Stack gap={2} alignItems="end">
                <Field label="Interval">
                    <Input
                        value={builderData.interval}
                        onChange={(event: React.FormEvent<HTMLInputElement>) => onChange({ ...builderData, interval: event.currentTarget.value })}
                    />
                </Field>
                <Field label={<OptionalLabel label="Sliding" />}>
                    <Input
                        value={builderData.sliding}
                        onChange={(event: React.FormEvent<HTMLInputElement>) => onChange({ ...builderData, sliding: event.currentTarget.value })}
                    />
                </Field>
            </Stack>
        </InlineFieldRow>
    );
}