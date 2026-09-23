/*
 * Copyright (c) 2023 TAOS Data, Inc. <jhtao@taosdata.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can use, redistribute, and/or modify
 * it under the terms of the GNU Affero General Public License, version 3
 * or later ("AGPL"), as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import { ChangeEvent, useCallback } from 'react'
import type { ChangeOptions, Query } from '../../types'
import type { EditorProps } from './types'

export function useChangeOptions(props: EditorProps, options: ChangeOptions<Query>): (value: ChangeEvent<HTMLInputElement>) => void {
    const { onChange, onRunQuery, query } = props;
    const { propertyName, runQuery } = options;

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

// 修改 useChangeOptions 自定义 Hook
export function useChangeOptionsArea(props: EditorProps, options: ChangeOptions<any>): (value: ChangeEvent<HTMLTextAreaElement>) => void {
    const { onChange, onRunQuery, query } = props;
    const { propertyName, runQuery } = options;

    return useCallback(
        (value: ChangeEvent<HTMLTextAreaElement>) => {
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
