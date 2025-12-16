export interface Identity {
  pubkey: string;
  name: string;
  createdAt: number;
  lastUsed: number;
  isActive: boolean;
  projects: Map<string, boolean>;
}

export type UserKeys = {
  pubkey: string;
  privateKey: Uint8Array;
};
