import React, {useEffect, useState} from 'react';
import {apiRequest} from '../store';
import {Action, Confirm, useActions} from './shared';

type Hosting = {
  defaultUrl: string;
  proxyTarget: string;
  domain: null | {
    hostname: string;
    senderAddress?: string;
    senderVerifiedAt?: string | null;
    status: string;
    url: string;
    error: string | null;
    records: {type: string; name: string; value: string}[];
  };
};

export function AsksDomainSettings() {
  const store = useActions();
  const [hosting, setHosting] = useState<Hosting | null>(null);
  const [hostname, setHostname] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState(false);

  useEffect(() => {
    let active = true;
    void apiRequest('/api/v1/asks-domain')
      .then(value => {
        if (active) {
          setHosting(value);
          setHostname(value.domain?.hostname || '');
          setSenderAddress(value.domain?.senderAddress || '');
        }
      })
      .catch(reason => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [store.data.workspaceId]);

  const run = async (path: string, method: string, body?: unknown) => {
    setBusy(true);
    setError('');
    try {
      const value = await apiRequest(path, {
        method,
        ...(body ? {body: JSON.stringify(body)} : {}),
      });
      setHosting(value);
      setHostname(value.domain?.hostname || '');
      setSenderAddress(value.domain?.senderAddress || '');
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="feature-setting-section asks-hosting-section">
      <div className="asks-section-heading">
        <div>
          <h2>Web forms hosting</h2>
          <p>Use the application host or configure a custom domain for your request portal.</p>
        </div>
      </div>
      <div className="feature-settings-card asks-hosting-card">
        {hosting && (
          <div className="feature-settings-row asks-default-address">
            <div>
              <strong>Default address</strong>
              <p>{hosting.defaultUrl}</p>
            </div>
            <a className="button feature-button" href={hosting.defaultUrl}>Open site</a>
          </div>
        )}
        <form onSubmit={event => {
          event.preventDefault();
          void run('/api/v1/asks-domain', 'PUT', {hostname, senderAddress});
        }}>
          <label className="feature-field">
            <span>Custom domain</span>
            <input className="input" aria-label="Custom domain" placeholder="requests.example.com" value={hostname} onChange={event => setHostname(event.target.value)} required disabled={busy}/>
          </label>
          <label className="feature-field">
            <span>Outgoing email address</span>
            <input className="input" type="email" aria-label="Outgoing email address" placeholder="support@example.com" value={senderAddress} onChange={event => setSenderAddress(event.target.value)} disabled={busy}/>
          </label>
          <div className="asks-form-actions">
            <button className="button" type="submit" disabled={busy || !hostname.trim()}>Save domain</button>
          </div>
        </form>
        {error && <p className="asks-inline-error" role="alert">{error}</p>}
        {hosting?.domain && (
          <div className="asks-domain-status">
            <p role="status">{hosting.domain.status === 'verified' ? 'DNS verified' : 'Pending DNS verification'}</p>
            {hosting.domain.senderAddress && <p role="status">{hosting.domain.senderVerifiedAt ? 'Sender DNS verified' : 'Pending sender DNS verification'}</p>}
            <p>Add these records with your DNS provider. Verification can take up to 48 hours.</p>
            <table>
              <thead><tr><th>Type</th><th>Name</th><th>Value</th></tr></thead>
              <tbody>{hosting.domain.records.map(record => <tr key={record.type + record.name}><td>{record.type}</td><td><code>{record.name}</code></td><td><code>{record.value}</code></td></tr>)}</tbody>
            </table>
            {hosting.domain.error && <p role="alert">{hosting.domain.error}</p>}
            <p>Your deployment must also serve this domain over HTTPS and forward its original Host header to Parabolic. DNS verification alone does not install a TLS certificate. Outgoing mail uses the deployment’s SMTP relay; authorize the configured sender with that provider.</p>
            <div className="feature-inline">
              <Action disabled={busy} onClick={() => void run('/api/v1/asks-domain/verify', 'POST')}>Retry activation</Action>
              <Action disabled={busy} onClick={() => void store.act(() => navigator.clipboard.writeText(hosting.domain!.url), 'Link copied')}>Copy portal link</Action>
              <Action disabled={busy} onClick={() => setRemove(true)}>Remove domain</Action>
            </div>
          </div>
        )}
      </div>
      {remove && <Confirm title="Remove custom domain?" description="Requesters can continue using the default address. Existing requests and accounts will be preserved." onClose={() => setRemove(false)} onConfirm={async () => {
        if (await run('/api/v1/asks-domain', 'DELETE')) setRemove(false);
      }}/>}
    </section>
  );
}
