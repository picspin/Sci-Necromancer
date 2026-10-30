import { describe, expect, it, vi } from 'vitest';
import { BrowserFigureSession, createFigureSpec } from './browserFigures';

describe('browser figure plans', () => {
  it('freezes the explicit dataset, mapping, unit and style version', () => {
    const plan = createFigureSpec(
      'a'.repeat(64),
      'scatter',
      { x: 'col_1', y: 'col_2' },
      { x: 'mm', y: 'score' },
      'nature'
    );
    expect(plan).toEqual({
      schema_version: 'figure-spec-v1',
      dataset_sha256: 'a'.repeat(64),
      template_id: 'scatter',
      template_version: 'scatter-v1',
      mapping: { x: 'col_1', y: 'col_2' },
      units: { x: 'mm', y: 'score' },
      style: { id: 'nature', version: 'nature-inspired-v1' },
    });
    expect(() => createFigureSpec('bad', 'scatter', {}, {}, 'nature')).toThrow();
  });
});

describe('local Worker lifetime', () => {
  function worker() {
    return {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    } as unknown as Worker;
  }
  it('rejects concurrent operations, ignores stale replies, and cancels without leaving a promise pending', async () => {
    const w = worker();
    const session = new BrowserFigureSession(() => w);
    const pending = session.inspect(new Uint8Array([1]));
    await expect(session.inspect(new Uint8Array([2]))).rejects.toThrow('figure_operation_pending');
    w.onmessage?.({ data: { id: 99, type: 'result', result: { row_count: 999 } } } as MessageEvent);
    const rejected = expect(pending).rejects.toThrow('figure_cancelled');
    session.dispose();
    await rejected;
    expect(w.terminate).toHaveBeenCalled();
  });
  it('terminates a hung Worker and permits a fresh Worker on retry', async () => {
    vi.useFakeTimers();
    try {
      const first = worker(),
        second = worker();
      const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
      const session = new BrowserFigureSession(factory);
      const pending = session.inspect(new Uint8Array([1]));
      const rejected = expect(pending).rejects.toThrow('figure_timeout');
      await vi.advanceTimersByTimeAsync(120_000);
      await rejected;
      expect(first.terminate).toHaveBeenCalled();
      const retry = session.inspect(new Uint8Array([2]));
      second.onmessage?.({
        data: { id: 2, type: 'result', result: { row_count: 1 } },
      } as MessageEvent);
      await expect(retry).resolves.toEqual({ row_count: 1 });
      session.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
  it('limits inputs before copying them to the Worker', async () => {
    const factory = vi.fn(() => worker());
    const session = new BrowserFigureSession(factory);
    await expect(session.inspect(new Uint8Array(10 * 1024 * 1024 + 1))).rejects.toThrow(
      'invalid_csv_size'
    );
    expect(factory).not.toHaveBeenCalled();
  });
});
