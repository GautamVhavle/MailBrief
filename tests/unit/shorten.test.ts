import { describe, expect, it } from 'vitest';
import { shortenExecutiveSummary, shortenSummary } from '../../src/llm/parse';
import { parseSummaryResponse } from '../../src/llm/parse';

describe('summary shortening', () => {
  it('shortens to max sentences', () => {
    const text = 'One. Two. Three. Four. Five.';
    expect(shortenExecutiveSummary(text, 3)).toBe('One. Two. Three.');
  });

  it('keeps short text', () => {
    expect(shortenExecutiveSummary('Short.')).toBe('Short.');
  });

  it('shortens summary object', () => {
    const summary = parseSummaryResponse(JSON.stringify({ executiveSummary: 'A. B. C. D.', keyPoints: [], actionItems: [], decisions: [], risks: [], unansweredQuestions: [] }), 'x.pdf');
    const shortened = shortenSummary(summary, 2);
    expect(shortened.executiveSummary).toBe('A. B.');
  });
});
