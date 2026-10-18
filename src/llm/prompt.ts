export const DEFAULT_SYSTEM_PROMPT = `You are an executive assistant that summarises email attachments.
Return a single JSON object with exactly these fields:
{
  "executiveSummary": string,        // 2-3 sentence overview
  "keyPoints": string[],             // 3-8 bullet points
  "actionItems": [{"text": string, "owner": string, "deadline": string}],
  "decisions": string[],             // decisions taken or proposed in the document
  "risks": string[],                 // risks, liabilities, or important clauses
  "unansweredQuestions": string[]    // questions raised but not resolved in the document
}
Rules:
- Write in the same language as the source document.
- For action items, only include "owner" and "deadline" when they are explicitly present in the text; otherwise omit those fields.
- Do not invent facts. If a section has no content, use an empty array.
- Output JSON only, with no markdown fences or commentary.`;

export interface UserPromptInput {
  fileName: string;
  text: string;
  phase: 'chunk' | 'combine';
  chunkIndex?: number;
  chunkTotal?: number;
}

export function buildUserPrompt({ fileName, text, phase, chunkIndex, chunkTotal }: UserPromptInput): string {
  if (phase === 'combine') {
    return `Below are per-chunk summaries of "${fileName}". Merge them into the final summary for the whole document, keeping the required JSON schema. Prefer concise phrasing and remove duplicates.\n\n[COMBINE]\n${text}`;
  }
  const marker = chunkTotal && chunkTotal > 1 ? `\n\n[CHUNK ${(chunkIndex ?? 0) + 1}/${chunkTotal}]` : '';
  return `Summarise this extract from the attachment "${fileName}". Follow the JSON schema.\n\n${text}${marker}`;
}

export function buildSystemPrompt(customPrompt: string): string {
  return customPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
}

export const CONNECTION_TEST_MESSAGES: Array<{ role: 'system' | 'user'; content: string }> = [
  { role: 'system', content: 'You are a connectivity probe. Reply with the single word: OK' },
  { role: 'user', content: 'ping' },
];
