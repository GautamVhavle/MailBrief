import { describe, expect, it } from 'vitest';
import { stageFromEvent, stageToLabel, STAGE_LABELS } from '../../src/content/ui/AttachmentControl';

describe('stage mapping', () => {
  it('has four labels', () => {
    expect(STAGE_LABELS).toEqual(['Fetching', 'Reading', 'Summarising', 'Finishing']);
  });

  it('maps fetching', () => {
    expect(stageToLabel({ stage: 'fetching' })).toBe('Fetching');
    expect(stageFromEvent({ stage: 'fetching' })).toBe('fetching');
  });

  it('maps extracting to Reading', () => {
    expect(stageToLabel({ stage: 'extracting' })).toBe('Reading');
  });

  it('maps chunk to Summarising', () => {
    expect(stageToLabel({ stage: 'chunk', done: 1, total: 2 })).toBe('Summarising');
  });

  it('maps finishing', () => {
    expect(stageToLabel({ stage: 'finishing', done: 1, total: 1 })).toBe('Finishing');
  });
});
