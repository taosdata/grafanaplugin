import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { ConfigEditor } from './ConfigEditor';

jest.mock('@grafana/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  const FormField = ({ inputEl, label, onBlur, onChange, value, disabled }: any) => (
    <label>
      {label}
      {inputEl ?? (
        <input
          aria-label={label}
          value={value ?? ''}
          disabled={disabled}
          onBlur={onBlur}
          onChange={onChange}
        />
      )}
    </label>
  );
  const SecretFormField = ({ label, value, disabled, onBlur, onChange }: any) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value ?? ''}
        disabled={disabled}
        onBlur={onBlur}
        onChange={onChange}
      />
    </label>
  );

  return {
    Alert: ({ children, title }: any) => (
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    ),
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    Collapse: ({ children, isOpen, label, onToggle }: any) => (
      <div>
        <button type="button" onClick={() => onToggle?.(!isOpen)}>
          {label}
        </button>
        {isOpen ? children : null}
      </div>
    ),
    ConfirmModal: () => null,
    FieldSet: ({ children, label }: any) => (
      <fieldset>
        <legend>{label}</legend>
        {children}
      </fieldset>
    ),
    Icon: () => null,
    LegacyForms: { FormField, SecretFormField },
    Modal: () => null,
    Switch: ({ value, ...props }: any) => <input type="checkbox" checked={Boolean(value)} {...props} />,
    Tab: ({ label, onChangeTab }: any) => (
      <button type="button" onClick={onChangeTab}>
        {label}
      </button>
    ),
    TabContent: ({ children }: any) => <div>{children}</div>,
    TabsBar: ({ children }: any) => <div>{children}</div>,
    TextArea: (props: any) => <textarea {...props} />,
  };
});

jest.mock('../../utils', () => ({
  checkGrafanaVersion: jest.fn().mockResolvedValue(false),
  deleteAlerts: jest.fn(),
  getCurrentTime: jest.fn().mockReturnValue('test-suffix'),
}));

function renderEditor(overrides: Record<string, unknown> = {}) {
  const onOptionsChange = jest.fn();
  let options = {
    id: 1,
    uid: 'tdengine-test',
    orgId: 1,
    name: 'TDengine',
    type: 'tdengine-datasource',
    typeLogoUrl: '',
    typeName: 'TDengine',
    access: 'proxy',
    url: 'https://localhost:6041',
    user: '',
    database: '',
    basicAuth: false,
    basicAuthUser: '',
    isDefault: false,
    jsonData: {},
    secureJsonData: {},
    secureJsonFields: {},
    readOnly: false,
    withCredentials: false,
    ...overrides,
  };

  const rendered = render(<ConfigEditor options={options as any} onOptionsChange={onOptionsChange} />);
  onOptionsChange.mockImplementation((nextOptions) => {
    options = nextOptions;
    rendered.rerender(<ConfigEditor options={options as any} onOptionsChange={onOptionsChange} />);
  });

  return { onOptionsChange };
}

describe('ConfigEditor TLS/SSL settings', () => {
  it('keeps TLS settings collapsed by default and shows CA before skip verification', () => {
    renderEditor();

    expect(screen.queryByLabelText('CA certificate')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('TLS/SSL'));

    const caCertificate = screen.getByLabelText('CA certificate');
    const skipVerification = screen.getByLabelText('Skip TLS certificate validation');
    expect(caCertificate.compareDocumentPosition(skipVerification) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(skipVerification).not.toBeChecked();
    expect(screen.queryByText(/disables certificate verification/i)).not.toBeInTheDocument();
  });

  it('stores a CA certificate in secureJsonData and enables custom CA handling', () => {
    const { onOptionsChange } = renderEditor();

    fireEvent.click(screen.getByText('TLS/SSL'));
    fireEvent.change(screen.getByLabelText('CA certificate'), {
      target: { value: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----' },
    });

    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        jsonData: expect.objectContaining({ tlsAuthWithCACert: true }),
        secureJsonData: expect.objectContaining({
          tlsCACert: '-----BEGIN CERTIFICATE-----\nCA\n-----END CERTIFICATE-----',
        }),
      })
    );
  });

  it('stores skip verification as an opt-in boolean', () => {
    const { onOptionsChange } = renderEditor();

    fireEvent.click(screen.getByText('TLS/SSL'));
    const skipVerification = screen.getByLabelText('Skip TLS certificate validation');
    fireEvent.click(skipVerification);

    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        jsonData: expect.objectContaining({ tlsSkipVerify: true }),
      })
    );
    expect(screen.getByText(/disables certificate verification/i)).toBeInTheDocument();

    fireEvent.click(skipVerification);

    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        jsonData: expect.objectContaining({ tlsSkipVerify: false }),
      })
    );
    expect(screen.queryByText(/disables certificate verification/i)).not.toBeInTheDocument();
  });

  it('resets a previously configured CA certificate', () => {
    const { onOptionsChange } = renderEditor({
      jsonData: { tlsAuthWithCACert: true },
      secureJsonFields: { tlsCACert: true },
    });

    fireEvent.click(screen.getByText('TLS/SSL'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset CA certificate' }));

    expect(onOptionsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        jsonData: expect.objectContaining({ tlsAuthWithCACert: false }),
        secureJsonData: expect.objectContaining({ tlsCACert: '' }),
        secureJsonFields: expect.objectContaining({ tlsCACert: false }),
      })
    );
  });
});
