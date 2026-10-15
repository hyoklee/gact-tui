import { describe, expect, it } from 'vitest';
import { targetFactsSchema } from './infrastructure-contract.js';

const facts = {
  target_id: 'local', label: 'Local host', os: 'windows', arch: 'AMD64',
  accelerator: 'none', docker_available: false, docker_installed: false,
  uv_available: true, transport_state: 'connected',
};

describe('host ownership facts', () => {
  it.each([{ uid: -1, gid: -1 }, { uid: 1000, gid: 1000 }])('decodes the backend identity object %j', (identity) => {
    expect(targetFactsSchema.parse({ ...facts, identity }).identity).toEqual(identity);
  });
  it('accepts older servers without identity but rejects malformed ownership', () => {
    expect(targetFactsSchema.parse(facts).identity).toBeUndefined();
    expect(targetFactsSchema.safeParse({ ...facts, identity: '1000' }).success).toBe(false);
    expect(targetFactsSchema.safeParse({ ...facts, identity: { uid: '1000', gid: 1000 } }).success).toBe(false);
  });
});
