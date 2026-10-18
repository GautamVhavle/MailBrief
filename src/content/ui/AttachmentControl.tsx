import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { MailBriefErrorShape, Summary } from '../../shared/types';
import '../style.css';

export type StageEvent =
  | { stage: 'fetching' }
  | { stage: 'extracting' }
  | { stage: 'chunk' | 'combine' | 'finishing'; done: number; total: number };

export type Phase = 'idle' | 'consent' | 'working' | 'success' | 'error';

export type StageKey = 'fetching' | 'reading' | 'summarising' | 'finishing';

export const STAGE_LABELS: string[] = ['Fetching', 'Reading', 'Summarising', 'Finishing'];

export function stageFromEvent(event: StageEvent): StageKey {
  switch (event.stage) {
    case 'fetching':
      return 'fetching';
    case 'extracting':
      return 'reading';
    case 'chunk':
    case 'combine':
      return 'summarising';
    case 'finishing':
      return 'finishing';
    default:
      return 'summarising';
  }
}

export function stageToLabel(event: StageEvent): string {
  const key = stageFromEvent(event);
  if (key === 'fetching') return 'Fetching';
  if (key === 'reading') return 'Reading';
  if (key === 'summarising') return 'Summarising';
  return 'Finishing';
}

export function mapStageEventToLabel(event: StageEvent): string {
  return stageToLabel(event);
}

export function labelForStage(event: StageEvent): string {
  return stageToLabel(event);
}

export interface AttachmentControlProps {
  id: string;
  fileName: string;
  endpoint: string | null;
  consentGiven: boolean;
  url: string | null;
  onSummarize: (url: string | null, onProgress: (p: StageEvent) => void, onStream?: (d: string) => void, signal?: AbortSignal) => Promise<Summary>;
  onError: (id: string, error: MailBriefErrorShape) => void;
  onConsentGrant: () => Promise<void>;
  onCancelRun: () => void;
  onDismiss: (id: string) => void;
}

export function AttachmentControl(props: AttachmentControlProps): React.JSX.Element {
  const { id, fileName, endpoint } = props;
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<MailBriefErrorShape | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [stageText, setStageText] = useState('Fetching');
  const [streamText, setStreamText] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [consentGranted, setConsentGranted] = useState(props.consentGiven);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const busy = phase === 'working';

  useEffect(() => {
    setAgreed(false);
  }, [endpoint]);

  useEffect(() => {
    setConsentGranted(props.consentGiven);
  }, [props.consentGiven]);

  const fileType = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() ?? 'FILE' : 'FILE';

  const closeModal = (): void => {
    if (busy) return;
    setOpen(false);
    setPhase('idle');
    setError(null);
    setSummary(null);
    setStreamText('');

  };

  const runSummarization = async (): Promise<void> => {
    setError(null);
    setSummary(null);
    setStreamText('');

    setPhase('working');
    setStageText('Fetching');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await props.onSummarize(props.url, (event) => {
      setStageText(stageToLabel(event));
      }, (delta) => {
        setStreamText((prev) => prev + delta);
      }, controller.signal);
      setSummary(result);
      setPhase('success');
    } catch (err) {
      const shape = err as MailBriefErrorShape;
      if ((err as { name?: string })?.name === 'AbortError') {
        setError({ kind: 'cancelled', message: 'Cancelled.', retryable: true });
        setPhase('error');
      } else {
        setError(shape);
        setPhase('error');
        props.onError(id, shape);
      }
    } finally {
      abortRef.current = null;
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

  const handleCancel = (): void => {
    abortRef.current?.abort();
    props.onCancelRun();
    setError({ kind: 'cancelled', message: 'Cancelled.', retryable: true });
    setPhase('error');
  };

  const handleCopy = async (): Promise<void> => {
    if (!summary) return;
    const text = [
      summary.executiveSummary,
      ...summary.keyPoints,
      ...summary.actionItems.map((a) => `Action: ${a.text}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  // Focus trap + escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (busy) {
          handleCancel();
        } else {
          closeModal();
        }
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    // initial focus
    setTimeout(() => {
      const first = modalRef.current?.querySelector<HTMLElement>('button, input');
      first?.focus();
    }, 0);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  const buttonClick = (): void => {
    setOpen(true);
    if (consentGranted) {
      setPhase('working');
      void runSummarization();
    } else {
      setPhase('consent');
    }
  };

  const modal = open
    ? createPortal(
        <div className="mbx-root mbx-modal-overlay" role="presentation">
          <div
            className="mbx-modal"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Summary for ${fileName}`}
          >
            <div className="mbx-modal-header">
              <div className="mbx-modal-title">{fileName}</div>
              <div className="mbx-modal-sub">
                <span className="mbx-badge">{fileType}</span>
                <span className="mbx-source-badge">MailBrief</span>
              </div>
              <button className="mbx-icon-button" type="button" aria-label="Close" onClick={closeModal} disabled={busy}>
                ×
              </button>
            </div>

            {phase === 'consent' && (
              <div className="mbx-card mbx-consent-card" role="dialog" aria-label="Consent required">
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
                <div className="mbx-modal-actions">
                  <button
                    className="mbx-button"
                    disabled={!agreed}
                    onClick={() => void handleConsentContinue()}
                    type="button"
                  >
                    Continue
                  </button>
                  <button className="mbx-button mbx-button-secondary" onClick={closeModal} type="button">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {phase === 'working' && (
              <div className="mbx-card">
                <div className="mbx-progress-label">{stageText}</div>
                <div className="mbx-progress-track" aria-hidden="true">
                  <div className="mbx-progress-bar" style={{ width: `${((STAGE_LABELS.indexOf(stageText) + 1) / STAGE_LABELS.length) * 100}%` }} />
                </div>
                <div className="mbx-stage-steps">
                  {STAGE_LABELS.map((label) => (
                    <span key={label} className={`mbx-stage-step${label === stageText ? ' active' : ''}`}>
                      {label}
                    </span>
                  ))}
                </div>
                {streamText && (
                  <div className="mbx-stream-preview">
                    <div className="mbx-card-title">Live preview</div>
                    <p className="mbx-stream-text">{streamText}</p>
                  </div>
                )}
                <div className="mbx-meta">{fileName}</div>
                <div className="mbx-modal-actions">
                  <button className="mbx-button mbx-button-secondary" onClick={handleCancel} type="button">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {phase === 'error' && error && (
              <div className="mbx-card">
                <div className="mbx-error-box">
                  <div className="mbx-error-kind">{error.kind}</div>
                  <div className="mbx-error-message">{error.message}</div>
                </div>
                <div className="mbx-modal-actions">
                  <button
                    className="mbx-button mbx-retry"
                    disabled={!error.retryable}
                    onClick={() => void handleRetry()}
                    type="button"
                  >
                    Try again
                  </button>
                  <button className="mbx-button mbx-button-secondary" onClick={closeModal} type="button">
                    Close
                  </button>
                </div>
              </div>
            )}

            {phase === 'success' && (
              <div className="mbx-card">
                {streamText && !summary && (
                  <div className="mbx-stream-preview">
                    <div className="mbx-card-title">Preview</div>
                    <p className="mbx-stream-text">{streamText}</p>
                  </div>
                )}
                {summary && <SummaryView summary={summary} />}
                <div className="mbx-modal-actions">
                  {summary && (
                    <button className="mbx-button" onClick={() => void handleCopy()} type="button">
                      {copied ? 'Copied' : 'Copy summary'}
                    </button>
                  )}
                  <button className="mbx-button mbx-button-secondary" onClick={closeModal} type="button">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="mbx-root">
      <button
        className="mbx-button mbx-button-secondary"
        disabled={busy && open}
        onClick={buttonClick}
        type="button"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Summarise
      </button>
      {modal}
    </div>
  );
}

function SummaryView({ summary }: { summary: Summary }): React.JSX.Element {
  const [tab, setTab] = useState<'summary' | 'details'>('summary');
  return (
    <div>
      <div className="mbx-tabs">
        <button className={`mbx-tab${tab === 'summary' ? ' active' : ''}`} onClick={() => setTab('summary')} type="button">
          Summary
        </button>
        <button className={`mbx-tab${tab === 'details' ? ' active' : ''}`} onClick={() => setTab('details')} type="button">
          Details
        </button>
      </div>
      {tab === 'summary' && (
        <>
          <h3 className="mbx-summary-heading">Summary</h3>
          <p className="mbx-executive">{summary.executiveSummary}</p>
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
        </>
      )}
      {tab === 'details' && (
        <>
          {summary.decisions.length > 0 && (
            <div className="mbx-summary-section">
              <h4>Decisions</h4>
              <ul>{summary.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
            </div>
          )}
          {summary.risks.length > 0 && (
            <div className="mbx-summary-section">
              <h4>Risks &amp; important clauses</h4>
              <ul>{summary.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
          {summary.unansweredQuestions.length > 0 && (
            <div className="mbx-summary-section">
              <h4>Unanswered questions</h4>
              <ul>{summary.unansweredQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </div>
          )}
        </>
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
  onSummarize: (url: string | null, onProgress: (p: StageEvent) => void, onStream?: (d: string) => void, signal?: AbortSignal) => Promise<Summary>;
  onError: (id: string, error: MailBriefErrorShape) => void;
  onConsentGrant: () => Promise<void>;
  onCancelRun: () => void;
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