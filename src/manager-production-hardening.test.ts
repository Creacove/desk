import { describe, expect, it } from 'vitest';
import { boundedOutputTokens, boundedProviderTimeoutMs } from '../supabase/functions/_shared/managerRuntimeGuardrails';
import { buildCareerWatchRequest } from '../supabase/functions/_shared/manager-intelligence/careerWatch';

describe('Gate 8 Manager production hardening', () => {
  it('bounds provider timeouts to a safe production window', () => {
    expect(boundedProviderTimeoutMs(undefined)).toBe(90_000);
    expect(boundedProviderTimeoutMs('1')).toBe(10_000);
    expect(boundedProviderTimeoutMs('999999')).toBe(120_000);
  });

  it('bounds model output budgets', () => {
    expect(boundedOutputTokens(undefined)).toBe(6_000);
    expect(boundedOutputTokens('1')).toBe(512);
    expect(boundedOutputTokens('999999')).toBe(12_000);
  });

  it('puts a hard output ceiling on proactive Career Watch', () => {
    const request = buildCareerWatchRequest({ artistName: 'Otmos' }, {});
    expect(request.max_output_tokens).toBe(4500);
    expect(request.tools).toEqual([{ type: 'web_search' }]);
  });
});
