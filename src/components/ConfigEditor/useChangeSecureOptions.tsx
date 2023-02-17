import {ChangeEvent, useCallback} from 'react'
import type {SecureJsonData} from 'types'
import type {EditorProps} from './types'

export function useChangeSecureOptions(props: EditorProps, propertyName: keyof SecureJsonData): (event: ChangeEvent<HTMLInputElement>) => void {
    const {onOptionsChange, options} = props;

    return useCallback((event: ChangeEvent<HTMLInputElement>) => {
            if (propertyName === 'url') {
                options.url = event.target.value
            }

            if (propertyName === 'user' && options.secureJsonData?.password) {
                options.basicAuth = true
                options.basicAuthUser = event.target.value
                options.secureJsonData.basicAuth = encode(event.target.value + ":" + options.secureJsonData.password)
            }

            if (propertyName === "password" && options.secureJsonData?.user) {
                options.basicAuth = true
                options.basicAuthUser = options.secureJsonData?.user
                options.secureJsonData.basicAuth = encode(options.secureJsonData.user + ":" + event.target.value)
            }

            onOptionsChange({
                ...options,
                secureJsonData: {
                    ...options.secureJsonData,
                    [propertyName]: event.target.value,
                },
            })
        },
        [onOptionsChange, options, propertyName]
    );
}

export function useChangeUser(props: EditorProps): (event: ChangeEvent<HTMLInputElement>) => void {
    const {onOptionsChange, options} = props;

    return useCallback((event: ChangeEvent<HTMLInputElement>) => {
            onOptionsChange({
                ...options,
                user: event.target.value,
                secureJsonData: {
                    ...options.secureJsonData,
                    user: event.target.value,
                },
            })

            if (options.secureJsonData?.password) {
                options.secureJsonData.basicAuth = encode(event.target.value + ':'
                    + options.secureJsonData.password)
            }
        },
        [onOptionsChange, options]
    );
}

export function useChangePassword(props: EditorProps): (event: ChangeEvent<HTMLInputElement>) => void {
    const {onOptionsChange, options} = props;

    return useCallback((event: ChangeEvent<HTMLInputElement>) => {
            onOptionsChange({
                ...options,
                secureJsonData: {
                    ...options.secureJsonData,
                    password: event.target.value,
                },
            })
            if (options.secureJsonData?.password) {
                options.secureJsonData.basicAuth = encode(options.secureJsonData.user + ':'
                    + event.target.value)
            }
        },
        [onOptionsChange, options]
    );
}

function encode(input: string): string {
    const _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    let output = "";
    let chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    let i = 0;
    while (i < input.length) {
        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);
        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;
        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }
        output = output + _keyStr.charAt(enc1) + _keyStr.charAt(enc2) + _keyStr.charAt(enc3) + _keyStr.charAt(enc4);
    }

    return output;
}
