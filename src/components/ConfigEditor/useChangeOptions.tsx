import {ChangeEvent, useCallback} from 'react'
import type {DataSourceOptions} from 'types'
import type {EditorProps} from './types'

export function useChangeOptions(props: EditorProps, propertyName: keyof DataSourceOptions): (event: ChangeEvent<HTMLInputElement>) => void {
    const {onOptionsChange, options} = props;

    return useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            onOptionsChange({
                ...options,
                jsonData: {
                    ...options.jsonData,
                    [propertyName]: event.target.value,
                },
            });
        },
        [onOptionsChange, options, propertyName]
    );
}
