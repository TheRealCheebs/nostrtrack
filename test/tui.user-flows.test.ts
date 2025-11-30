import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Response queue for the inquirer mock. Each prompt call will shift one response.
let responses: any[] = [];
vi.mock('inquirer', () => {
  const impl = {
    prompt: async () => {
      const r = responses.shift();
      return r;
    },
  };
  return {
    ...impl,
    default: impl,
  };
});

// Mock the identity service used by the TUI
vi.mock('../src/services/prisma/identity', () => ({
  createIdentity: vi.fn(),
  importIdentity: vi.fn(),
  getPrivateKey: vi.fn(),
  getAllIdentities: vi.fn(),
  getActiveUserKeys: vi.fn(),
  setActiveIdentityByName: vi.fn(),
  removeIdentityByKey: vi.fn(),
}));

// Mock nostr utils used by exportUser
vi.mock('../src/nostr/utils', () => ({
  convertForNIP19: vi.fn((keys: any) => ({ npub: 'npub', nsec: 'nsec' })),
  createKeys: vi.fn(() => ({
    pubKey: 'mockPubKey',
    privateKey: Uint8Array.from([1, 2, 3]),
  })),
  getPublicName: vi.fn((pubKey: string) => `mockNameFor:${pubKey}`),
  getNpub: vi.fn((pubKey: string) => `mockNpubFor:${pubKey}`),
}));

import * as identity from '../src/services/prisma/identity';
import { mainUsersFlow, noUserFlow } from '../src/tui/user-flows';

beforeEach(() => {
  vi.restoreAllMocks();
  responses = [];

  // silence console output during tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  // prevent tests from exiting the process
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => undefined) as any);
});

afterEach(() => {
  // restore all spies/mocks
  vi.restoreAllMocks();
});

describe('TUI user flows', () => {
  it('noUserFlow -> create user returns UserKeys when create succeeds', async () => {
    // Choose Create User, then provide name
    responses = [{ action: 'Create User' }, { name: 'alice' }];

    // Mock identity.createIdentity and getPrivateKey
    (identity.createIdentity as any).mockResolvedValue({
      pubkey: 'pub1',
      name: 'alice',
    });
    (identity.getPrivateKey as any).mockResolvedValue(Uint8Array.from([1, 2, 3]));

    const keys = await noUserFlow({} as any);
    expect(keys).not.toBeNull();
    expect(keys.pubKey).toBe('pub1');
    expect(Buffer.from(keys.privateKey).toString('hex')).toBe('010203');
  });

  it('mainUsersFlow -> switch user returns UserKeys when switching succeeds', async () => {
    // First prompt chooses Switch User, then the selection prompt returns the identity name
    responses = [{ action: 'Switch User' }, { name: 'alice' }];

    // Mock identities list and active switching
    (identity.getAllIdentities as any).mockResolvedValue([
      { pubkey: 'pub1', name: 'alice', is_active: false },
    ]);
    (identity.setActiveIdentityByName as any).mockResolvedValue({
      pubkey: 'pub1',
      name: 'alice',
      is_active: true,
    });
    (identity.getPrivateKey as any).mockResolvedValue(Uint8Array.from([4, 5, 6]));

    const keys = await mainUsersFlow({} as any);
    expect(keys).not.toBeNull();
    expect(keys.pubKey).toBe('pub1');
    expect(Buffer.from(keys.privateKey).toString('hex')).toBe('040506');
  });

  it('mainUsersFlow -> export active user calls convertForNIP19 when active keys exist', async () => {
    responses = [{ action: 'Export Active User' }];

    (identity.getActiveUserKeys as any).mockResolvedValue({
      pubKey: 'pubX',
      privateKey: Uint8Array.from([7, 8, 9]),
    });

    const { convertForNIP19 } = await import('../src/nostr/utils');

    const res = await mainUsersFlow({} as any);
    // mainUsersFlow returns emptyUserKeys in most non-returning actions
    expect(convertForNIP19).toHaveBeenCalled();
    expect(res.pubKey).toBe('');
  });
});
