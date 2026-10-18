import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { MailBriefErrorShape, Summary } from '../../shared/types';
import '../style.css';

export type StageEvent =
  | { stage: 'fetching' }
  | { stage: 'extracting' }
  | { stage: 'chunk' | 'combine'; done: number; total: number };

export type Phase = 'idle' | 'consent' | 'working' | 'success' | 'error';

export interface AttachmentControlProps {
  id: string;
  fileName: string;
  endpoint: string | null;
  consentGiven: boolean;
  url: string | null;
  onSummarize: (url: string | null, onProgress: (p: StageEvent) => void) => Promise<Summary>;
  onError: (id: string, error: MailBriefErrorShape) => void;
  onConsentGrant: () => Promise<void>;
  onDismiss: (id: string) => void;
}

export function AttachmentControl(props: AttachmentControlProps): React.JSX.Element {
  const { id, fileName, endpoint } = props;
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<MailBriefErrorShape | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stageLabel, setStageLabel] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [consentGranted, setConsentGranted] = useState(props.consentGiven);
  const busy = phase !== 'idle' && phase !== 'success' && phase !== 'error';

  useEffect(() => {
    setAgreed(false);
  }, [endpoint]);

  const runSummarization = async (): Promise<void> => {
    setError(null);
    setSummary(null);
    setPhase('working');
    setStageLabel('Fetching attachment…');
    try {
      const result = await props.onSummarize(props.url, (event) => {
        switch (event.stage) {
          case 'fetching':
            setStageLabel('Fetching attachment…');
            break;
          case 'extracting':
            setStageLabel('Extracting text…');
            break;
          case 'combine':
            setStageLabel('Combining partial summaries…');
            break;
          case 'chunk':
            setStageLabel(`Summarising section ${event.done} of ${event.total}…`);
            break;
        }
      });
      setSummary(result);
      setPhase('success');
    } catch (err) {
      const shape = err as MailBriefErrorShape;
      setError(shape);
      setPhase('error');
      props.onError(id, shape);
    }
  };

  const handleConsentContinue = async (): Promise<void> => {
    if (!agreed) return;
    await props.onConsentGrant();
    setConsentGranted(true);
    await runSummarization();
  };

  const handleRetry = async (): Promise<void> => {
    await runSummarization();
  };

  return (
    <div className="mbx-root">
      <button
        className="mbx-button"
        disabled={busy}
        onClick={() => {
          if (consentGranted) {
            void runSummarization();
          } else {
            setPhase('consent');
          }
        }}
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Summarise
      </button>

      {phase === 'consent' && (
        <div className="mbx-card" role="dialog" aria-label="Consent required">
          <div className="mbx-card-title">Destination endpoint</div>
          {endpoint ? (
            <div className="mbx-consent-endpoint">{endpoint}</div>
          ) : (
            <div className="mbx-consent-endpoint">Endpoint is not configured yet.</div>
          )}
          <div className="mbx-consent-note">
            On your go-ahead, MailBrief will download this attachment, extract its text, and send only that
            extracted text to the endpoint above for summarisation. Nothing is stored, and email content outside
            the attachment is never read.
          </div>
          <label className="mbx-consent-row">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            I understand and agree to send extracted text to this endpoint.
          </label>
          <button
            className="mbx-button"
            style={{ marginLeft: 0 }}
            disabled={!agreed}
            onClick={() => void handleConsentContinue()}
            type="button"
          >
            Continue
          </button>
          <button className="mbx-button" style={{ marginLeft: 0 }} onClick={() => setPhase('idle')} type="button">
            Cancel
          </button>
        </div>
      )}

      {phase === 'working' && (
        <div className="mbx-card">
          <div className="mbx-progress">
            <span className="mbx-spinner" aria-hidden="true" />
            {stageLabel}
          </div>
          <div className="mbx-meta">{fileName}</div>
        </div>
      )}

      {phase === 'error' && error && (
        <div className="mbx-card">
          <div className="mbx-error-box">
            <div className="mbx-error-kind">{error.kind}</div>
            <div className="mbx-error-message">{error.message}</div>
          </div>
          <button
            className="mbx-button mbx-retry"
            style={{ marginLeft: 0 }}
            disabled={!error.retryable}
            onClick={() => void handleRetry()}
            type="button"
          >
            Try again
          </button>
          <button className="mbx-button" style={{ marginLeft: 0 }} onClick={() => props.onDismiss(id)} type="button">
            Dismiss
          </button>
        </div>
      )}

      {phase === 'success' && summary && <SummaryView summary={summary} />}
    </div>
  );
}

function SummaryView({ summary }: { summary: Summary }): React.JSX.Element {
  return (
    <div className="mbx-card">
      <div className="mbx-card-title">Summary</div>
      <p style={{ margin: '0 0 4px', fontSize: 13 }}>{summary.executiveSummary}</p>

      {summary.keyPoints.length > 0 && (
        <div className="mbx-summary-section">
          <h4>Key points</h4>
          <ul>
            {summary.keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.actionItems.length > 0 && (
        <div className="mbx-summary-section">
          <h4>Action items</h4>
          {summary.actionItems.map((item, i) => (
            <div className="mbx-action-item" key={i}>
              • {item.text}
              {(item.owner || item.deadline) && (
                <span className="mbx-action-owner">
                  {item.owner ? `owner: ${item.owner}` : ''}
                  {item.owner && item.deadline ? ' · ' : ''}
                  {item.deadline ? `due: ${item.deadline}` : ''}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {summary.decisions.length > 0 && (
        <div className="mbx-summary-section">
          <h4>Decisions</h4>
          <ul>
            {summary.decisions.map((decision, i) => (
              <li key={i}>{decision}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.risks.length > 0 && (
        <div className="mbx-summary-section">
          <h4>Risks &amp; important clauses</h4>
          <ul>
            {summary.risks.map((risk, i) => (
              <li key={i}>{risk}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.unansweredQuestions.length > 0 && (
        <div className="mbx-summary-section">
          <h4>Unanswered questions</h4>
          <ul>
            {summary.unansweredQuestions.map((question, i) => (
              <li key={i}>{question}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mbx-meta">
        {summary.sourceFileName} · {new Date(summary.generatedAt).toLocaleString()}
      </div>
    </div>
  );
}

export interface MountOptions {
  container: HTMLElement;
  id: string;
  fileName: string;
  url: string | null;
  endpoint: string | null;
  consentGiven: boolean;
  onSummarize: (url: string | null, onProgress: (p: StageEvent) => void) => Promise<Summary>;
  onError: (id: string, error: MailBriefErrorShape) => void;
  onConsentGrant: () => Promise<void>;
  onDismiss: (id: string) => void;
}

export function mountAttachmentControl(options: MountOptions): Root {
  const host = document.createElement('div');
  host.className = 'mbx-host';
  host.dataset.mailbriefFor = options.id;
  options.container.appendChild(host);
  const root = createRoot(host);
  const dismiss = (): void => {
    root.unmount();
    host.remove();
  };
  root.render(<AttachmentControl {...options} onDismiss={dismiss} />);
  return root;
}
