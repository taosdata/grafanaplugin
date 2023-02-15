import React, {ReactElement} from 'react'
import {FieldSet, LegacyForms} from '@grafana/ui'
import type {EditorProps} from './types'
import {useChangeSecureOptions} from './useChangeSecureOptions'
import {useResetSecureOptions} from './useResetSecureOptions'

const {SecretFormField, FormField} = LegacyForms;

export function ConfigEditor(props: EditorProps): ReactElement {
    const {secureJsonData} = props.options;

    const onChangeUrl = useChangeSecureOptions(props, 'url')
    const onChangeUser = useChangeSecureOptions(props, 'user')
    const onChangePassword = useChangeSecureOptions(props, 'password')
    const onResetPassword = useResetSecureOptions(props, 'password')
    const onChangeToken = useChangeSecureOptions(props, 'token')
    const onResetToken = useResetSecureOptions(props, 'token')

    return (
        <div className='gf-form-group'>
            <FieldSet label="TDengine Connection">
                <div className='gf-form max-width-30'>
                    <FormField label='Host'
                               labelWidth={7}
                               inputWidth={23}
                               // tooltip="datasource's host"
                               onChange={onChangeUrl}
                               value={secureJsonData?.url || ''}
                               placeholder='http://localhost:6041'
                    />
                </div>
                <div className='gf-form-inline'>
                    <div className='gf-form max-width-15'>
                        <FormField label='User'
                                   labelWidth={7}
                                   inputWidth={8}
                                   // tooltip="datasource's username"
                                   onChange={onChangeUser}
                                   value={secureJsonData?.user || ''}
                        />
                    </div>
                    <div className='gf-form max-width-15'>
                        <SecretFormField isConfigured={false}
                            // isConfigured={(secureJsonFields && secureJsonFields.password) as boolean}
                                         value={secureJsonData?.password || ''}
                                         label='Password'
                                         // tooltip="datasource's token"
                                         labelWidth={7}
                                         inputWidth={8}
                                         onReset={onResetPassword}
                                         onChange={onChangePassword}
                        />
                    </div>
                </div>
                <div className='gf-form max-width-30'>
                    <SecretFormField isConfigured={false}
                        // isConfigured={(secureJsonFields && secureJsonFields.password) as boolean}
                                     value={secureJsonData?.token || ''}
                                     label='Cloud Token'
                                     // tooltip="datasource's cloud token"
                                     placeholder=''
                                     labelWidth={7}
                                     inputWidth={23}
                                     onReset={onResetToken}
                                     onChange={onChangeToken}
                    />
                </div>
            </FieldSet>
        </div>
    )
}
