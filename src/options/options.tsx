import React, { useCallback, useEffect, useState } from 'react';
import { PORT_NAME, STORAGE_KEY } from '../shared/constants';
import { loadSettings, saveSettings, clearSettings } from '../shared/storage';
import { DEFAULT_SETTINGS } from '../shared/constants';
import type { MailBriefSettings } from '../shared/types';

interface ConnectionResult {
  ok: boolean;
  message: string;
}

export function OptionsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<MailBriefSettings | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('');
  const [connectionResult, setConnectionResult] = useState<ConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((err) => setStatus(`Failed to load settings: ${String(err)}`));
  }, []);

  const update = useCallback(<K extends keyof MailBriefSettings>(key: K, value: MailBriefSettings[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }, []);

  const handleSave = async (): Promise<void> => {
    if (!settings) return;
    try {
      await saveSettings(settings);
      setStatus('Settings saved.');
      setErrors([]);
    } catch (err) {
      const message = String(err);
      setErrors([message]);
      setStatus('');
    }
  };

  const handleReset = async (): Promise<void> => {
    await clearSettings();
    const defaults = await loadSettings();
    setSettings({ ...DEFAULT_SETTINGS, ...defaults });
    setStatus('Settings reset to defaults.');
    setConnectionResult(null);
  };

  const handleTestConnection = async (): Promise<void> => {
    if (!settings) return;
    setTesting(true);
    setConnectionResult(null);
    try {
      const port = chrome.runtime.connect({ name: PORT_NAME });
      const result = await new Promise<ConnectionResult>((resolve) => {
        const timer = setTimeout(() => resolve({ ok: false, message: 'The extension did not respond in time.' }), 30_000);
        port.onMessage.addListener((message: { type: string; ok?: boolean; message?: string }) => {
          if (message.type === 'mailbrief/connection-result') {
            clearTimeout(timer);
            port.disconnect();
            resolve({ ok: Boolean(message.ok), message: message.message ?? '' });
          }
        });
        port.postMessage({ type: 'mailbrief/test-connection' });
      });
      setConnectionResult(result);
    } catch (err) {
      setConnectionResult({ ok: false, message: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleRevokeConsent = async (): Promise<void> => {
    if (!settings) return;
    await saveSettings({ ...settings, consentGiven: false, consentEndpoint: '' });
    setStatus('Consent revoked. You will be asked again before the next request.');
  };

  if (!settings) {
    return <div className="options-page">Loading…</div>;
  }

  return (
    <div className="options-page">
      <h1>MailBrief options</h1>
      <p className="options-subtitle">User-triggered attachment summaries for Gmail and Outlook Web.</p>

      {errors.length > 0 && (
        <div className="banner error" role="alert">
          {errors.map((error, i) => (
            <div key={i}>{error}</div>
          ))}
        </div>
      )}
      {status && <div className="banner ok">{status}</div>}
      {connectionResult && (
        <div className={`banner ${connectionResult.ok ? 'ok' : 'error'}`} role="status">
          {connectionResult.message}
        </div>
      )}

      <div className="card">
        <h2>Endpoint</h2>
        <div className="field">
          <label htmlFor="baseUrl">Base URL (OpenAI-compatible)</label>
          <input
            id="baseUrl"
            type="text"
            placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
            value={settings.baseUrl}
            onChange={(e) => update('baseUrl', e.target.value)}
          />
          <div className="hint">HTTPS is required for remote endpoints. Plain HTTP is allowed on localhost only.</div>
        </div>
        <div className="field">
          <label htmlFor="apiKey">API key</label>
          <input
            id="apiKey"
            type="password"
            autoComplete="off"
            value={settings.apiKey}
            onChange={(e) => update('apiKey', e.target.value)}
          />
          <div className="hint">Stored only in chrome.storage.local. Never logged or transmitted anywhere except the endpoint above.</div>
        </div>
        <div className="field">
          <label htmlFor="model">Model</label>
          <input id="model" type="text" value={settings.model} onChange={(e) => update('model', e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="timeoutMs">Timeout (ms)</label>
            <input
              id="timeoutMs"
              type="number"
              min={2000}
              max={300000}
              step={500}
              value={settings.timeoutMs}
              onChange={(e) => update('timeoutMs', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="maxOutputTokens">Max output tokens</label>
            <input
              id="maxOutputTokens"
              type="number"
              min={64}
              max={16384}
              value={settings.maxOutputTokens}
              onChange={(e) => update('maxOutputTokens', Number(e.target.value))}
            />
          </div>
        </div>
        <div className="button-row">
          <button onClick={() => void handleTestConnection()} disabled={testing}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Summary prompt</h2>
        <div className="field">
          <label htmlFor="prompt">Custom system prompt</label>
          <textarea id="prompt" value={settings.prompt} onChange={(e) => update('prompt', e.target.value)} />
          <div className="hint">
            The default prompt requests: executive summary, key points, action items (owner/deadline when
            present), decisions, risks/important clauses, and unanswered questions.
          </div>
        </div>
        <div className="checkbox-field">
          <input
            id="includeDocumentTitle"
            type="checkbox"
            checked={settings.includeDocumentTitle}
            onChange={(e) => update('includeDocumentTitle', e.target.checked)}
          />
          <label htmlFor="includeDocumentTitle">Include the document title/filename in the prompt</label>
        </div>
      </div>

      <div className="card">
        <h2>Limits &amp; chunking</h2>
        <div className="field-row">
          <div className="field">
            <label htmlFor="maxFileBytes">Max attachment size (bytes)</label>
            <input
              id="maxFileBytes"
              type="number"
              min={10240}
              value={settings.maxFileBytes}
              onChange={(e) => update('maxFileBytes', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="maxExtractedChars">Max extracted characters</label>
            <input
              id="maxExtractedChars"
              type="number"
              min={1000}
              value={settings.maxExtractedChars}
              onChange={(e) => update('maxExtractedChars', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="chunkChars">Chunk size (chars)</label>
            <input
              id="chunkChars"
              type="number"
              min={1000}
              value={settings.chunkChars}
              onChange={(e) => update('chunkChars', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="chunkOverlapChars">Chunk overlap (chars)</label>
            <input
              id="chunkOverlapChars"
              type="number"
              min={0}
              value={settings.chunkOverlapChars}
              onChange={(e) => update('chunkOverlapChars', Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Privacy &amp; consent</h2>
        <p className="privacy-text">
          The configured endpoint receives <strong>only the extracted text of attachments you explicitly
          choose to summarise</strong>. MailBrief never reads unrelated thread content, never persists
          extracted text, and never logs API keys, headers, attachments, or full model responses.
        </p>
        <p className="privacy-text">
          Destination endpoint:
          {settings.baseUrl ? (
            <span className="endpoint-display">{settings.baseUrl}</span>
          ) : (
            <em> not configured yet</em>
          )}
        </p>
        {settings.consentGiven && settings.consentEndpoint && (
          <p className="privacy-text">
            Consent given for: <span className="endpoint-display">{settings.consentEndpoint}</span>
          </p>
        )}
        <div className="button-row">
          <button className="danger" onClick={() => void handleRevokeConsent()} disabled={!settings.consentGiven}>
            Revoke consent
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Debug</h2>
        <div className="checkbox-field">
          <input
            id="debug"
            type="checkbox"
            checked={settings.debug}
            onChange={(e) => update('debug', e.target.checked)}
          />
          <label htmlFor="debug">Enable debug logging (redacted; never includes document text)</label>
        </div>
      </div>

      <div className="button-row">
        <button onClick={() => void handleSave()}>Save</button>
        <button className="secondary" onClick={() => void handleReset()}>
          Reset to defaults
        </button>
      </div>

      <p className="privacy-text" style={{ marginTop: 16 }}>
        <code>{STORAGE_KEY}</code> is the chrome.storage.local key used for these settings. Clearing it via
        “Reset to defaults” removes the API key and consent as well.
      </p>
    </div>
  );
}
