import React, {ReactElement} from 'react'
import {FieldSet, LegacyForms, Tab, TabContent, TabsBar} from '@grafana/ui'
import type {EditorProps} from './types'
import {useChangeSecureOptions} from './useChangeSecureOptions'
import {useResetSecureOptions} from './useResetSecureOptions'

const {SecretFormField, FormField} = LegacyForms;

enum authType {Basic = 'basic', Token = 'token'}

export function ConfigEditor(props: EditorProps): ReactElement {
    const {secureJsonData} = props.options;
    const {secureJsonFields} = props.options;

    const onChangeUrl = useChangeSecureOptions(props, 'url')
    const onResetUrl = useResetSecureOptions(props, 'url')
    const onChangeUser = useChangeSecureOptions(props, 'user')
    const onResetUser = useResetSecureOptions(props, 'user')
    const onChangePassword = useChangeSecureOptions(props, 'password')
    const onResetPassword = useResetSecureOptions(props, 'password')
    const onChangeToken = useChangeSecureOptions(props, 'token')
    const onResetToken = useResetSecureOptions(props, 'token')

    const [active, setActive] = React.useState((secureJsonFields && secureJsonFields.token && secureJsonData?.token?.length) ? authType.Token : authType.Basic )

    return (
        <div className='gf-form-group'>
            <FieldSet label="TDengine Host">
                <div className='gf-form max-width-30'>
                    <FormField label='Host'
                               labelWidth={8}
                               inputWidth={22}
                               tooltip="datasource's host"
                               onChange={onChangeUrl}
                               onBlur={onChangeUrl}
                               onReset={onResetUrl}
                               value={props.options.url || ''}
                               placeholder='http://localhost:6041'
                               required={true}
                               disabled={props.options.readOnly}
                    />
                </div>
            </FieldSet>
            <FieldSet label="TDengine Authentication">
                <TabsBar>
                    <Tab label={'by user and password'}
                         active={active === authType.Basic}
                         onChangeTab={() => setActive(authType.Basic)}
                    />
                    <Tab label={'by token'}
                         active={active === authType.Token}
                         onChangeTab={() => setActive(authType.Token)}
                    />
                </TabsBar>
                <TabContent>
                    {
                        active === authType.Basic &&
                        <div>
                            <div className='gf-form max-width-20'>
                                <FormField label='User'
                                           labelWidth={8}
                                           inputWidth={10}
                                           tooltip="datasource's username"
                                           onChange={onChangeUser}
                                           onBlur={onChangeUser}
                                           onReset={onResetUser}
                                           value={props.options.user || ''}
                                           disabled={props.options.readOnly}
                                           placeholder={secureJsonFields.basicAuth ? 'basic_auth configured' : 'username'}
                                />
                            </div>
                            <div className='gf-form max-width-20'>
                                <SecretFormField
                                    isConfigured={(secureJsonFields && secureJsonFields.password) as boolean}
                                    value={secureJsonData?.password || ''}
                                    label='Password'
                                    tooltip="datasource's password"
                                    labelWidth={8}
                                    inputWidth={10}
                                    onReset={onResetPassword}
                                    onChange={onChangePassword}
                                    onBlur={onChangePassword}
                                    disabled={props.options.readOnly}
                                    placeholder={secureJsonFields.basicAuth ? 'basic_auth configured' : 'password'}
                                />
                            </div>
                        </div>
                    }
                    {
                        active === authType.Token &&
                        <div className='gf-form max-width-30'>
                            <SecretFormField
                                isConfigured={(secureJsonFields && secureJsonFields.token && secureJsonData?.token?.length) as boolean}
                                value={secureJsonData?.token || ''}
                                label='Token'
                                tooltip="datasource's cloud token"
                                placeholder='token of TDengine cloud'
                                labelWidth={8}
                                inputWidth={22}
                                onReset={onResetToken}
                                onChange={onChangeToken}
                                onBlur={onChangeToken}
                                disabled={props.options.readOnly}
                            />
                        </div>
                    }
                </TabContent>
            </FieldSet>
        </div>
    )
}


