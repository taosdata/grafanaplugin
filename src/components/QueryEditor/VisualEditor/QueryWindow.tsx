import React from "react";
import { InlineFieldRow, Stack, Field} from "@grafana/ui";
import { BuilderData } from "types";
import { OptionalLabel, TimeInput } from "./Utils";

type Props = {
    builderData: BuilderData
    onChange: (value: BuilderData) => void
};

export function QueryWindow({ builderData, onChange }: Props) {
    return (
        <InlineFieldRow>
            <Stack gap={2} alignItems="end">
                <Field label="Interval">
                    <TimeInput
                        value={builderData.interval}
                        onChange={(value) => onChange({ ...builderData, interval: value })}
                    />
                </Field>
                <Field label={<OptionalLabel label="Sliding" />}>
                    <TimeInput
                        value={builderData.sliding}
                        onChange={(value) => onChange({ ...builderData, sliding: value })}
                    />
                </Field>
            </Stack>
        </InlineFieldRow>
    );
}