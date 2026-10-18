import { describe, expect, it } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, DEFAULT_SYSTEM_PROMPT } from '../../src/llm/prompt';

describe('DEFAULT_SYSTEM_PROMPT', () => {
  it('requests all required sections', () => {
    const prompt = DEFAULT_SYSTEM_PROMPT.toLowerCase();
    for (const section of [
      'executiveSummary',
      'keyPoints',
      'actionItems',
      'decisions',
      'risks',
      'unansweredQuestions',
      'owner',
      'deadline',
      'json',
    ]) {
      expect(prompt).toContain(section.toLowerCase());
    }
  });
});

describe('buildUserPrompt', () => {
  it('includes the document filename and content for single-chunk summaries', () => {
    const prompt = buildUserPrompt({ fileName: 'report.pdf', text: 'Content here.', phase: 'chunk' });
    expect(prompt).toContain('report.pdf');
    expect(prompt).toContain('Content here.');
    expect(prompt).not.toContain('[CHUNK');
  });

  it('adds an explicit chunk marker for multi-chunk documents', () => {
    const prompt = buildUserPrompt({ fileName: 'report.pdf', text: 'Part.', phase: 'chunk', chunkIndex: 1, chunkTotal: 3 });
    expect(prompt).toContain('[CHUNK 2/3]');
  });

  it('uses the combine marker for the reduce step', () => {
    const prompt = buildUserPrompt({ fileName: 'report.pdf', text: 'merged parts', phase: 'combine' });
    expect(prompt).toContain('[COMBINE]');
    expect(prompt).toContain('report.pdf');
  });
});

describe('buildSystemPrompt', () => {
  it('falls back to the default prompt when the custom prompt is empty', () => {
    expect(buildSystemPrompt('')).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(buildSystemPrompt('   \n')).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it('uses the trimmed custom prompt when provided', () => {
    expect(buildSystemPrompt('  Custom prompt.  ')).toBe('Custom prompt.');
  });
});
