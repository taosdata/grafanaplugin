import {ChangeEvent, useCallback} from 'react'
import type {ChangeOptions, Query} from '../../types'
import type {EditorProps} from './types'

export function useChangeString(props: EditorProps, options: ChangeOptions<Query>): (value: string) => void {
    const {onChange, onRunQuery, query} = props;
    const {propertyName, runQuery} = options;

    return useCallback(
        (value: string) => {
            if (!value) {
                return;
            }

            onChange({
                ...query,
                [propertyName]: value,
            });

            if (runQuery) {
                onRunQuery();
            }
        },
        [onChange, onRunQuery, query, propertyName, runQuery]
    );
}

export function useChangeOptions(props: EditorProps, options: ChangeOptions<Query>): (value: ChangeEvent<HTMLInputElement>) => void {
    const {onChange, onRunQuery, query} = props;
    const {propertyName, runQuery} = options;

    return useCallback(
        (value: ChangeEvent<HTMLInputElement>) => {
            if (!value) {
                return;
            }

            onChange({
                ...query,
                [propertyName]: value.target.value,
            });

            if (runQuery) {
                onRunQuery();
            }
        },
        [onChange, onRunQuery, query, propertyName, runQuery]
    );
}
