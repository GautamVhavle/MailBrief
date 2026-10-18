import { describe, expect, it } from 'vitest';
import { parseSseDataLine, parseSseChunk } from '../../src/llm/client';

describe('SSE parsing', () => {
  it('parses a content delta', () => {
    const result = parseSseDataLine('data: {"choices":[{"delta":{"content":"Hello"}}]}');
    expect(result).toEqual({ delta: 'Hello', done: false });
  });

  it('detects [DONE]', () => {
    const result = parseSseDataLine('data: [DONE]');
    expect(result).toEqual({ delta: '', done: true });
  });

  it('parses multiple lines', () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n';
    const events = parseSseChunk(chunk);
    expect(events).toHaveLength(2);
    expect(events[0].delta).toBe('Hi');
    expect(events[1].done).toBe(true);
  });

  it('ignores non-data lines', () => {
    expect(parseSseChunk('event: message\nid: 1\n')).toEqual([]);
  });
});
