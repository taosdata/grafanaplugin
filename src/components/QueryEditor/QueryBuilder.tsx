import React, { useCallback, useState } from 'react';
import {
    InlineFieldRow,
    CodeEditor,
    RadioButtonGroup,
} from '@grafana/ui';
import { EditorProps } from './types';
import { VisualEditor } from './VisualEditor/VisualEditor';
import { ConfirmModal } from './ConfirmModal';


export function QueryBuilder(props: EditorProps) {
    const { query, onChange } = props;
    const [showConfirm, setShowConfirm] = useState(false);
    const onEditorModeChange = useCallback(
        (newEditorMode: 'builder' | 'code') => {
            if (query.editorMode === 'code') {
                setShowConfirm(true);
                return;
            }
            onChange({ ...query, editorMode: newEditorMode });
        },
        [query.editorMode, onChange, query]
    );

    return (
        <div>
            <InlineFieldRow>
                <RadioButtonGroup
                    options={[
                        { label: 'Builder', value: 'builder' },
                        { label: 'Code', value: 'code' }
                    ]}
                    size="sm"
                    value={query.editorMode}
                    onChange={onEditorModeChange}
                />
            </InlineFieldRow>
            <ConfirmModal
                isOpen={showConfirm}
                onCopy={() => {
                    setShowConfirm(false);
                    navigator.clipboard.writeText(query.sql!)
                    onChange({
                        ...query,
                        sql: query.sql,
                        editorMode: 'builder'
                    });
                }}
                onDiscard={() => {
                    setShowConfirm(false);
                    onChange({
                        ...query,
                        sql: query.sql,
                        editorMode: 'builder'
                    });
                }}
                onCancel={() => {
                    setShowConfirm(false);
                }}
            />

            {query.editorMode === 'builder' ? (
                <VisualEditor {...props} />
            ) : (
                <div>
                    <CodeEditor
                        language="sql"
                        height={300}
                        value={query.sql || ''}
                        onChange={(value) => onChange({ ...query, sql: value })}
                        showMiniMap={true}
                        monacoOptions={{
                            lineNumbers: 'off',
                            minimap: { enabled: false },
                            automaticLayout: true,
                            scrollBeyondLastLine: false,
                            wordWrap: 'on'
                        }}
                    />
                </div>
            )}
        </div>
    );
}