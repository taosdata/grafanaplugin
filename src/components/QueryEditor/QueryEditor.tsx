import React, {ReactElement, useState} from 'react'
import {Collapse, InlineField, InlineFieldRow, Input, Select} from '@grafana/ui'
import {useSelectableValue} from './useSelectableValue'
import {useChangeSelectableValue} from './useChangeSelectableValue'
import type {EditorProps} from './types'
import {useChangeOptions} from './useChangeString'

export function QueryEditor(props: EditorProps): ReactElement {
    const {query} = props;
    if (!query.queryType) {
        query.queryType = "SQL"
    }
    if (!query.formatType) {
        query.formatType = "Time series"
    }

    const onChangeQueryType = useChangeSelectableValue(props, {propertyName: 'queryType', runQuery: true})
    const onChangeAlias = useChangeOptions(props, {propertyName: 'alias', runQuery: false})
    const onblurAlias = useChangeOptions(props, {propertyName: 'alias', runQuery: true})
    const onChangeSql = useChangeOptions(props, {propertyName: 'sql', runQuery: false})
    const onblurSql = useChangeOptions(props, {propertyName: 'sql', runQuery: true})
    const onchangeTimeShiftPeriod = useChangeOptions(props, {propertyName: 'timeShiftPeriod', runQuery: false})
    const onchangeTimeShiftUnit = useChangeSelectableValue(props, {propertyName: 'timeShiftUnit', runQuery: false})
    const onChangeFormatType = useChangeSelectableValue(props, {propertyName: 'formatType', runQuery: true})
    const onchangeGroupColumns = useChangeOptions(props, {propertyName: 'colNameToGroup', runQuery: false})
    const onblurGroupColumns = useChangeOptions(props, {propertyName: 'colNameToGroup', runQuery: true})
    const onchangeFormatStr = useChangeOptions(props, {propertyName: 'colNameFormatStr', runQuery: false})
    const onblurFormatStr = useChangeOptions(props, {propertyName: 'colNameFormatStr', runQuery: true})

    const ShowGeneratedSql = () => {
        const [isOpen, setIsOpen] = useState<boolean>(false)
        let sql = props.datasource.getGenerateSql()

        return (
            <Collapse
                label='Generate SQL'
                className='gf-form-label width-10'
                collapsible={true}
                isOpen={isOpen}
                onToggle={() =>
                    setIsOpen(!isOpen)
                }
            >
                <p>{sql}</p>
            </Collapse>
        )
    }
    const ShowHelpCollapse = () => {
        const [isOpen, setIsOpen] = useState<boolean>(false)
        let help = 'Use any SQL that can return Resultset such as:</br>' +
            '- [[timestamp1, value1], [timestamp2, value2], ... ]</br>' +
            '</br>' +
            'Macros:</br>' +
            '- $from -&gt; start timestamp of panel</br>' +
            '- $to -&gt; stop timestamp of panel</br>' +
            '- $interval -&gt; interval of panel</br>' +
            '</br>' +
            'Example of SQL:</br>' +
            '&nbsp;&nbsp;SELECT count(*)</br> FROM db.table WHERE ts > $from and ts < $to INTERVAL ($interval)'

        return (
            <Collapse
                label='Show Help'
                className='gf-form-label width-10'
                collapsible={true}
                isOpen={isOpen}
                onToggle={() =>
                    setIsOpen(!isOpen)
                }
            >
                <p dangerouslySetInnerHTML={{__html: help}}></p>
            </Collapse>
        )
    }

    const queryTypeOptions = [
        {label: 'SQL', value: 'SQL'},
        {label: 'Arithmetic', value: 'Arithmetic'}
    ]
    const formatTypeOptions = [
        {label: 'Time series', value: 'Time series'},
        {label: 'Table', value: 'Table'}
    ]
    const timeShiftUnit = [
        {label: 'seconds', value: 'seconds'},
        {label: 'minutes', value: 'minutes'},
        {label: 'hours', value: 'hours'},
        {label: 'days', value: 'days'},
        {label: 'weeks', value: 'weeks'},
        {label: 'months', value: 'months'}
    ]

    return (
        <div className='gf-form-group'>
            <InlineFieldRow>
                <InlineField id="queryType" label='Query Type' labelWidth={20}>
                    <Select
                        inputId={"queryType"}
                        width={20}
                        options={queryTypeOptions}
                        defaultValue={queryTypeOptions[0]}
                        onChange={onChangeQueryType}
                        value={useSelectableValue(query.queryType)}
                    />
                </InlineField>
                <InlineField label='Alias By' labelWidth={20}>
                    <Input
                        width={20}
                        onChange={onChangeAlias}
                        onBlur={onblurAlias}
                        value={query.alias ?? ''}
                        placeholder={"Naming pattern: a,{{'{{'}}col}}"}
                    />
                </InlineField>
                <div className="gf-form gf-form--grow">
                    <div className="gf-form-label gf-form-label--grow"></div>
                </div>
            </InlineFieldRow>

            <InlineFieldRow>
                <InlineField label='Input Sql' labelWidth={20} tooltip='' grow>
                    <Input
                        style={{"width": "100%; min-width: 800px;"}}
                        width={100}
                        className={'min-width-30 max-width-100 gf-form--grow'}
                        placeholder={'select avg(mem_system)  from log.dnodes_info where ts >= $from and ts < $to interval($interval)'}
                        onChange={onChangeSql}
                        onBlur={onblurSql}
                        value={query.sql}
                    />
                </InlineField>
            </InlineFieldRow>

            <InlineFieldRow>
                <ShowGeneratedSql/>
                <ShowHelpCollapse/>
                <InlineField id="formatType" label='Format new col' labelWidth={20}>
                    <Select
                        inputId={"formatType"}
                        width={20}
                        options={formatTypeOptions}
                        defaultValue={formatTypeOptions[0]}
                        onChange={onChangeFormatType}
                        value={useSelectableValue(query.formatType)}
                    />
                </InlineField>
            </InlineFieldRow>

            <InlineFieldRow>
                <InlineField label='Time Shift' labelWidth={20} tooltip=''>
                    <Input
                        width={20}
                        onChange={onchangeTimeShiftPeriod}
                        onBlur={onchangeTimeShiftPeriod}
                        value={query.timeShiftPeriod ?? ''}
                        placeholder={'period number like: 1'}
                    />
                </InlineField>
                <InlineField label='Time Shift Unit' labelWidth={20} tooltip=''>
                    <Select
                        width={20}
                        options={timeShiftUnit}
                        onChange={onchangeTimeShiftUnit}
                        value={useSelectableValue(query.timeShiftUnit)}
                    />
                </InlineField>
                <div className="gf-form gf-form--grow">
                    <div className="gf-form-label gf-form-label--grow"></div>
                </div>
            </InlineFieldRow>

            <InlineFieldRow>
                <InlineField label='Group By Column(s)' labelWidth={20} tooltip=''>
                    <Input
                        width={20}
                        onChange={onchangeGroupColumns}
                        onBlur={onblurGroupColumns}
                        value={query.colNameToGroup ?? ''}
                    />
                </InlineField>
                <InlineField label='Group By Format' labelWidth={20} tooltip=''>
                    <Input
                        width={20}
                        onChange={onchangeFormatStr}
                        onBlur={onblurFormatStr}
                        value={query.colNameFormatStr ?? ''}
                        placeholder={'prefix_{{group_field}}_suffix'}
                    />
                </InlineField>
                <div className="gf-form gf-form--grow">
                    <div className="gf-form-label gf-form-label--grow"></div>
                </div>
            </InlineFieldRow>
        </div>
    );
}


