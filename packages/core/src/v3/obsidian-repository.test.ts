import { describe, expect, it } from 'vitest';
import { ClioRepository } from './repository.js';
import { RecordingTransport } from './recording-transport.test-helper.js';

describe('managed Obsidian account transport', () => {
  it('keeps service account setup separate from workspace source creation', async () => {
    const status = {
      installed: true,
      version: '0.0.14',
      state: 'ready',
      message: '',
      authenticated: false,
    };
    const transport = new RecordingTransport([
      status,
      status,
      { ...status, authenticated: true },
      { vaults: [{ id: 'remote', name: 'Notebook', encryptionKey: 'private' }] },
      { root: '/managed/notes' },
      status,
    ]);
    const repository = new ClioRepository(transport);
    const signal = new AbortController().signal;
    await repository.obsidianStatus(signal);
    await repository.installObsidian();
    await repository.signInObsidian({ email: 'user@example.test', password: 'secret', mfa: '123' });
    expect(await repository.obsidianVaults(signal)).toEqual({
      vaults: [{ id: 'remote', name: 'Notebook' }],
    });
    expect(await repository.setupObsidianVault('remote', 'encrypted')).toEqual({
      root: '/managed/notes',
    });
    await repository.signOutObsidian();
    expect(transport.requests.map(({ method, path }) => [method, path])).toEqual([
      ['GET', '/v1/storage/obsidian'],
      ['POST', '/v1/storage/obsidian/install'],
      ['POST', '/v1/storage/obsidian/login'],
      ['GET', '/v1/storage/obsidian/vaults'],
      ['POST', '/v1/storage/obsidian/setup'],
      ['POST', '/v1/storage/obsidian/logout'],
    ]);
    expect(transport.requests[0]?.signal).toBe(signal);
    expect(transport.requests[3]?.signal).toBe(signal);
    expect(transport.requests[2]?.body).toEqual({
      email: 'user@example.test',
      password: 'secret',
      mfa: '123',
    });
    expect(transport.requests[4]?.body).toEqual({ vault_id: 'remote', password: 'encrypted' });
  });
});
