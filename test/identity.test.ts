import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createKeys } from '../src/nostr/utils';

let responses: any[] = [];
// Mock keytar with an in-memory map
vi.mock('keytar', () => {
  const store = new Map<string, string>();
  const impl = {
    setPassword: vi.fn(async (_service: string, account: string, password: string) => {
      store.set(account, password);
      return true;
    }),
    getPassword: vi.fn(async (_service: string, account: string) => {
      return store.has(account) ? (store.get(account) ?? null) : null;
    }),
    deletePassword: vi.fn(async (_service: string, account: string) => {
      return store.delete(account);
    }),
  };

  // Provide both named exports and a default export for `import keytar from 'keytar'`
  return {
    ...impl,
    default: impl,
  };
});

// Simple deterministic mocks for nostr-tools and noble utils used by identity service
vi.mock('nostr-tools', () => {
  return {
    // generate a deterministic 32-byte secret key
    generateSecretKey: () => Uint8Array.from(Array.from({ length: 32 }, (_, i) => i + 1)),
    // derive a public key by hex-encoding the private key and prefixing
    getPublicKey: (priv: Uint8Array) => 'pub' + Buffer.from(priv).toString('hex'),
  };
});

vi.mock('@noble/hashes/utils', () => {
  return {
    bytesToHex: (bytes: Uint8Array) => Buffer.from(bytes).toString('hex'),
    hexToBytes: (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex')),
  };
});

import keytar from 'keytar';
import {
  createIdentity,
  getPrivateKey,
  addOrUpdateUserProject,
  getUserProjects,
  removeUserProject,
  getActiveUserKeys,
} from '../src/services/prisma/identity';

// Create a lightweight mock prisma that exposes the methods the identity service expects
function makeMockPrisma() {
  const identity: Record<string, any> = {};

  const mockIdentity = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  };

  const prisma: any = {
    identity: mockIdentity,
    // invoke callback with the prisma-like tx that has identity on it
    $transaction: async (cb: any) => cb(prisma),
  };

  return { prisma, mockIdentity };
}

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

describe('Identity service (prisma)', () => {
  describe('createIdentity', () => {
    it('should store private key in keytar and create db identity', async () => {
      const { prisma, mockIdentity } = makeMockPrisma();

      // mock create to return a plausible identity
      mockIdentity.create.mockResolvedValue({
        pubkey: 'pub010203',
        name: 'alice',
        created_at: Date.now(),
        last_used: Date.now(),
        is_active: true,
        projects: JSON.stringify({}),
      });

      const userKeys = createKeys();
      const res = await createIdentity(prisma, 'alice', userKeys);

      // keytar.setPassword should have been called with the derived pubkey
      expect(keytar.setPassword).toHaveBeenCalled();
      // DB create should have been called
      expect(mockIdentity.create).toHaveBeenCalled();
      expect(res).toBeDefined();
      expect(res.name).toBe('alice');
    });
  });

  describe('getPrivateKey', () => {
    it('returns bytes for a stored private key', async () => {
      // first set a password in keytar via the mocked API
      const pub = 'pubdeadbeef';
      const hex = 'deadbeef';
      await keytar.setPassword('nostrtrack', pub, hex);

      const bytes = await getPrivateKey(pub);
      expect(bytes).not.toBeNull();
      if (!bytes) throw new Error('Expected private key bytes to be present');
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(Buffer.from(bytes).toString('hex')).toBe(hex);
    });
  });

  describe('user project operations', () => {
    it('addOrUpdateUserProject, getUserProjects, removeUserProject flow', async () => {
      const { prisma, mockIdentity } = makeMockPrisma();
      const pub = 'pubprojuser';

      // Initially user has no projects
      mockIdentity.findUnique.mockResolvedValueOnce({
        projects: JSON.stringify({}),
      });
      mockIdentity.update.mockResolvedValue({});

      await addOrUpdateUserProject(prisma, pub, 'proj-1', true);
      expect(mockIdentity.update).toHaveBeenCalled();

      // Simulate prisma returning the updated projects when asked
      mockIdentity.findUnique.mockResolvedValueOnce({
        projects: JSON.stringify({ 'proj-1': true }),
      });
      const projects = await getUserProjects(prisma, pub);
      expect(projects instanceof Map).toBe(true);
      expect(projects.get('proj-1')).toBe(true);

      // Now test removeUserProject
      // simulate prior state
      mockIdentity.findUnique.mockResolvedValueOnce({
        projects: JSON.stringify({ 'proj-1': true, 'proj-2': false }),
      });
      mockIdentity.update.mockResolvedValue({});
      await removeUserProject(prisma, pub, 'proj-1');
      expect(mockIdentity.update).toHaveBeenCalled();
    });
  });

  describe('getActiveUserKeys', () => {
    it('returns pubkey and privateKey when active identity exists', async () => {
      const { prisma, mockIdentity } = makeMockPrisma();
      const pub = 'pubactiveuser';
      const hex = 'cafebabe';

      // Mock findFirst to return an active identity
      mockIdentity.findFirst.mockResolvedValue({
        pubkey: pub,
        is_active: true,
      });

      // set private key in the mocked keytar
      await keytar.setPassword('nostrtrack', pub, hex);

      const res = await getActiveUserKeys(prisma as any);
      expect(res).not.toBeNull();
      if (!res) throw new Error('Expected res');
      expect(res.pubkey).toBe(pub);
      expect(Buffer.from(res.privateKey).toString('hex')).toBe(hex);
    });

    it('returns null when there is no active identity', async () => {
      const { prisma, mockIdentity } = makeMockPrisma();

      // Mock findFirst to return null (no active identity)
      mockIdentity.findFirst.mockResolvedValue(null);

      const res = await getActiveUserKeys(prisma as any);
      expect(res).toBeNull();
    });

    it('returns null when an active identity exists but keytar has no private key', async () => {
      const { prisma, mockIdentity } = makeMockPrisma();

      const pub = 'pubnopekey';

      // Mock findFirst to return an active identity
      mockIdentity.findFirst.mockResolvedValue({
        pubkey: pub,
        is_active: true,
      });

      // Do NOT set a password in keytar for this pubkey (mock returns null by default)

      const res = await getActiveUserKeys(prisma as any);
      expect(res).toBeNull();
    });

    it('returns null when getActiveIdentity throws an error (catch path)', async () => {
      const { prisma, mockIdentity } = makeMockPrisma();

      // Make findFirst reject to simulate a DB error
      mockIdentity.findFirst.mockRejectedValue(new Error('db failure'));

      const res = await getActiveUserKeys(prisma as any);
      expect(res).toBeNull();
    });
  });
});
