/*
 * Copyright (c) 2019 TAOS Data, Inc. <jhtao@taosdata.com>
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

import React, {ChangeEvent, ReactElement, useState} from 'react'
import {Alert, Button, Collapse, LegacyForms, Switch, TextArea} from '@grafana/ui'
import type {EditorProps} from './types'

const {FormField} = LegacyForms;

export function TLSSettings(props: EditorProps): ReactElement {
    const {onOptionsChange, options} = props;
    const [isOpen, setIsOpen] = useState(false);
    const hasConfiguredCA = Boolean(options.secureJsonFields?.tlsCACert);

    const onChangeCACertificate = (event: ChangeEvent<HTMLTextAreaElement>) => {
        const tlsCACert = event.currentTarget.value;
        onOptionsChange({
            ...options,
            jsonData: {
                ...options.jsonData,
                tlsAuthWithCACert: tlsCACert.trim().length > 0,
            },
            secureJsonData: {
                ...options.secureJsonData,
                tlsCACert,
            },
        });
    };

    const onResetCACertificate = () => {
        onOptionsChange({
            ...options,
            jsonData: {
                ...options.jsonData,
                tlsAuthWithCACert: false,
            },
            secureJsonData: {
                ...options.secureJsonData,
                tlsCACert: '',
            },
            secureJsonFields: {
                ...options.secureJsonFields,
                tlsCACert: false,
            },
        });
    };

    const onChangeSkipTLSVerify = (event: ChangeEvent<HTMLInputElement>) => {
        onOptionsChange({
            ...options,
            jsonData: {
                ...options.jsonData,
                tlsSkipVerify: event.currentTarget.checked,
            },
        });
    };

    return (
        <Collapse
            label="TLS/SSL"
            collapsible={true}
            isOpen={isOpen}
            onToggle={setIsOpen}
        >
            <div className="gf-form max-width-30">
                <label className="gf-form-label width-8" htmlFor="tdengine-tls-ca-cert">
                    CA certificate
                </label>
                {hasConfiguredCA ? (
                    <>
                        <input
                            id="tdengine-tls-ca-cert"
                            aria-label="CA certificate"
                            className="gf-form-input width-18"
                            type="text"
                            value="configured"
                            disabled={true}
                            readOnly={true}
                        />
                        <Button
                            aria-label="Reset CA certificate"
                            type="button"
                            variant="secondary"
                            onClick={onResetCACertificate}
                            disabled={options.readOnly}
                        >
                            Reset
                        </Button>
                    </>
                ) : (
                    <TextArea
                        id="tdengine-tls-ca-cert"
                        aria-label="CA certificate"
                        rows={6}
                        value={options.secureJsonData?.tlsCACert || ''}
                        placeholder="Paste a PEM-encoded CA certificate"
                        onChange={onChangeCACertificate}
                        disabled={options.readOnly}
                    />
                )}
            </div>
            <div className="gf-form max-width-30">
                <FormField
                    label="Skip TLS certificate validation"
                    labelWidth={20}
                    className="align-center"
                    inputEl={
                        <Switch
                            aria-label="Skip TLS certificate validation"
                            aria-describedby={options.jsonData.tlsSkipVerify ? 'tdengine-tls-skip-warning' : undefined}
                            value={Boolean(options.jsonData.tlsSkipVerify)}
                            onChange={onChangeSkipTLSVerify}
                            disabled={options.readOnly}
                        />
                    }
                />
            </div>
            {options.jsonData.tlsSkipVerify && (
                <Alert id="tdengine-tls-skip-warning" title="Security warning" severity="warning">
                    Skip TLS certificate validation disables certificate verification and can expose credentials and
                    data to man-in-the-middle attacks. Use only in controlled environments.
                </Alert>
            )}
        </Collapse>
    );
}
