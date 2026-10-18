import { MailBriefError, type ActionItem, type Summary } from '../shared/types';

interface RawSummary {
  executiveSummary?: unknown;
  keyPoints?: unknown;
  actionItems?: unknown;
  decisions?: unknown;
  risks?: unknown;
  unansweredQuestions?: unknown;
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter((s) => s.length > 0);
}

function asActionItems(value: unknown): ActionItem[] {
  if (!Array.isArray(value)) return [];
  const items: ActionItem[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      const text = asString(entry);
      if (text) items.push({ text });
      continue;
    }
    const record = entry as Record<string, unknown>;
    const text = asString(record.text ?? record.action ?? record.title);
    if (!text) continue;
    const owner = asString(record.owner);
    const deadline = asString(record.deadline ?? record.due);
    items.push({
      text,
      ...(owner ? { owner } : {}),
      ...(deadline ? { deadline } : {}),
    });
  }
  return items;
}

export function extractJsonObject(raw: string): RawSummary {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? raw.trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new MailBriefError('malformed', 'The response did not contain a JSON object.', false);
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as RawSummary;
  } catch (err) {
    throw new MailBriefError('malformed', `JSON parsing failed: ${(err as Error).message}`, false);
  }
}

export function parseSummaryResponse(raw: string, fileName: string): Summary {
  const parsed = extractJsonObject(raw);
  const executiveSummary = asString(parsed.executiveSummary);
  if (!executiveSummary) {
    throw new MailBriefError('malformed', 'The response was missing the executiveSummary field.', false);
  }
  return {
    executiveSummary,
    keyPoints: asStringArray(parsed.keyPoints),
    actionItems: asActionItems(parsed.actionItems),
    decisions: asStringArray(parsed.decisions),
    risks: asStringArray(parsed.risks),
    unansweredQuestions: asStringArray(parsed.unansweredQuestions),
    sourceFileName: fileName,
    generatedAt: new Date().toISOString(),
  };
}

export function parseConnectionTestResponse(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new MailBriefError('malformed', 'The endpoint returned an empty response.', false);
  return trimmed;
}
