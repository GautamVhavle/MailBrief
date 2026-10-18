import { describe, expect, it } from 'vitest';
import { parseSummaryResponse } from '../../src/llm/parse';
import { MailBriefError } from '../../src/shared/types';

const VALID = {
  executiveSummary: 'Revenue grew 12 percent.',
  keyPoints: ['Churn fell to 3 percent.'],
  actionItems: [{ text: 'Send renewal draft', owner: 'Priya', deadline: 'Friday' }],
  decisions: ['Approved 40k budget.'],
  risks: ['30 day payment terms.'],
  unansweredQuestions: ['Berlin onboarding?'],
};

describe('parseSummaryResponse', () => {
  it('parses a plain JSON object', () => {
    const summary = parseSummaryResponse(JSON.stringify(VALID), 'report.pdf');
    expect(summary.executiveSummary).toBe('Revenue grew 12 percent.');
    expect(summary.keyPoints).toEqual(['Churn fell to 3 percent.']);
    expect(summary.actionItems[0]).toEqual({ text: 'Send renewal draft', owner: 'Priya', deadline: 'Friday' });
    expect(summary.decisions).toEqual(['Approved 40k budget.']);
    expect(summary.risks).toEqual(['30 day payment terms.']);
    expect(summary.unansweredQuestions).toEqual(['Berlin onboarding?']);
    expect(summary.sourceFileName).toBe('report.pdf');
    expect(typeof summary.generatedAt).toBe('string');
  });

  it('strips markdown fences and surrounding prose', () => {
    const raw = `Here is the summary:\n\`\`\`json\n${JSON.stringify(VALID)}\n\`\`\`\nDone.`;
    const summary = parseSummaryResponse(raw, 'notes.txt');
    expect(summary.executiveSummary).toBe('Revenue grew 12 percent.');
  });

  it('coerces wrong types into safe defaults', () => {
    const raw = JSON.stringify({ ...VALID, keyPoints: 'not-an-array', actionItems: [{ owner: 'nobody' }] });
    const summary = parseSummaryResponse(raw, 'a.pdf');
    expect(summary.keyPoints).toEqual([]);
    expect(summary.actionItems).toEqual([]);
  });

  it('omits owner and deadline fields when absent', () => {
    const raw = JSON.stringify({ ...VALID, actionItems: [{ text: 'Only text' }] });
    const summary = parseSummaryResponse(raw, 'a.pdf');
    expect(summary.actionItems[0]).toEqual({ text: 'Only text' });
  });

  it('throws a malformed error when executiveSummary is missing', () => {
    try {
      parseSummaryResponse(JSON.stringify({ keyPoints: [] }), 'x.pdf');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MailBriefError);
      expect((err as MailBriefError).kind).toBe('malformed');
    }
  });

  it('throws a malformed error when there is no JSON object', () => {
    try {
      parseSummaryResponse('no json at all', 'x.pdf');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as MailBriefError).kind).toBe('malformed');
    }
  });
});
