import React from "react";
import { Input, Select, Stack } from "@grafana/ui";
import { TimeUnit, TimeValue } from "types";

export const OptionalLabel = ({ label }: { label: string }) => {
    return (
        <span>{label} <span style={{ color: '#777', fontStyle: 'italic' }}>{" - optional "}</span></span>
    );
}

const TIME_UNITS = [
    { label: 'nanoseconds', value: 'b' },
    { label: 'microseconds', value: 'u' },
    { label: 'milliseconds', value: 'a' },
    { label: 'seconds', value: 's' },
    { label: 'minutes', value: 'm' },
    { label: 'hours', value: 'h' },
    { label: 'days', value: 'd' },
    { label: 'months', value: 'n' },
    { label: 'weeks', value: 'w' },
    { label: 'years', value: 'y' },
];

export function TimeInput({ value, onChange }: { value?: TimeValue, onChange: (value: TimeValue) => void }) {
    const onNumberChange = (event: React.FormEvent<HTMLInputElement>) => {
        const num = parseInt(event.currentTarget.value, 10);
        onChange({ ...value, number: isNaN(num) ? undefined : num });
    };

    return (
        <Stack gap={0} alignItems="end">
            <Input
                type="number"
                value={value?.number?.toString() || ''}
                onChange={onNumberChange}
                placeholder="Value"
                width={10}
            />
            <Select
                value={value?.unit}
                options={TIME_UNITS}
                onChange={(opt) => onChange({ ...value, unit: opt.value as TimeUnit })}
                width={15}
                placeholder="Unit"
            />
        </Stack>
    )
}