import { rawlist, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { type PrismaClient, type Identity as PrismaIdentity } from '@prisma/client';

import {
  createIdentity,
  getPrivateKey,
  getAllIdentities,
  getActiveUserKeys,
  setActiveIdentityByName,
  removeIdentityByKey,
} from '../services/prisma/identity';
import type { UserKeys } from '../interfaces/identity';
import { convertForNIP19, createKeys, importKeys, getPublicName, getNpub } from '../nostr/utils';
import { userState } from '../state/user-state';

const emptyUserKeys: UserKeys = { pubkey: '', privateKey: new Uint8Array() };

export async function mainUsersFlow(prisma: PrismaClient): Promise<void> {
  const USER_OPTIONS = [
    'Create User',
    'Import User',
    'Export Active User',
    'List Users',
    'Switch User',
    'Remove User',
    'Back to Main Menu',
  ] as const;
  type Action = (typeof USER_OPTIONS)[number];

  const userActions: Record<Action, (prisma: PrismaClient) => Promise<void>> = {
    'Create User': async (prisma) => {
      await createUser(prisma);
    },
    'Import User': async (prisma) => {
      await importUser(prisma);
    },
    'Export Active User': async (prisma) => {
      await exportUser(prisma);
    },
    'List Users': async (prisma) => {
      await listUsers(prisma);
    },
    'Switch User': async (prisma) => {
      await switchUser(prisma);
    },
    'Remove User': async (prisma) => {
      await removeUser(prisma);
    },
    'Back to Main Menu': async () => {
      return Promise.resolve();
    },
  };
  const answer = await rawlist({
    message: 'User Actions',
    choices: USER_OPTIONS.map((action) => ({
      name: action,
      value: action,
    })),
  });

  const action = answer;
  await userActions[action](prisma);
}

export async function noUserFlow(prisma: PrismaClient): Promise<UserKeys> {
  const USER_OPTIONS = ['Create User', 'Import User', 'Exit'] as const;
  type Action = (typeof USER_OPTIONS)[number];

  const userActions: Record<Action, (prisma: PrismaClient) => Promise<UserKeys>> = {
    'Create User': async (prisma) => {
      const userKeys: UserKeys | null = await createUser(prisma);
      if (userKeys === null) return emptyUserKeys;
      return userKeys;
    },
    'Import User': async (prisma) => {
      const importedKeys: UserKeys | null = await importUser(prisma);
      if (importedKeys === null) return emptyUserKeys;
      return importedKeys;
    },
    Exit: () => {
      process.exit(0);
    },
  };
  const answer = await rawlist({
    message: 'No active user found. Please create or import a user.',
    choices: USER_OPTIONS.map((action) => ({
      name: action,
      value: action,
    })),
  });

  const action = answer;
  const userKeys: UserKeys = await userActions[action](prisma);
  return userKeys;
}

async function createUser(prisma: PrismaClient): Promise<UserKeys | null> {
  let answers: string = await input({
    message: 'User name:',
    required: true,
    validate: (input) => input.trim() !== '' || 'user name is required',
  });

  try {
    answers = answers.trim();
    const userKeys: UserKeys = createKeys();
    const identity: PrismaIdentity = await createIdentity(prisma, answers, userKeys);
    console.log(chalk.green(`User created: ${identity.name} | (${getNpub(identity.pubkey)})`));
    userState.setUserKeys(userKeys); // Update the global state here
    return userKeys;
  } catch (error) {
    if (error instanceof Error) {
      console.log(chalk.red(`Failed to create user: ${error.message}`));
    } else {
      console.log(chalk.red(`Failed to create user: ${String(error)}`));
    }
    return null;
  }
}

async function importUser(prisma: PrismaClient): Promise<UserKeys | null> {
  const answers: string = await input({
    message: 'private key (nsec):',
    required: true,
    validate: (input) => input.trim() !== '' || 'private key is required',
  });

  try {
    const userKeys: UserKeys = importKeys(answers);
    const name: string = getPublicName(userKeys.pubkey);
    const identity: PrismaIdentity = await createIdentity(prisma, name, userKeys);

    const readable: { nsec: string; npub: string } = convertForNIP19(userKeys);
    // TODO: if getPublicName doesn't return it gives us the npub, so this will be
    // npub npub...
    console.log(chalk.green(`User imported: ${identity.name} | (${readable.npub})`));
    userState.setUserKeys(userKeys); // Update the global state here

    return userKeys;
  } catch (error) {
    if (error instanceof Error) {
      console.log(chalk.red(`Failed to import user: ${error.message}`));
    } else {
      console.log(chalk.red(`Failed to import user: ${String(error)}`));
    }
    return null;
  }
}

async function exportUser(prisma: PrismaClient): Promise<void> {
  const keys: UserKeys = await getActiveUserKeys(prisma);
  if (keys.pubkey === '') {
    console.log(chalk.yellow('There is not an active user.'));
    return;
  }
  const readable: { nsec: string; npub: string } = convertForNIP19(keys);
  console.log(chalk.bold.blue('npub:'));
  console.log(chalk.green(readable.npub));
  console.log(chalk.bold.blue('nsec:'));
  console.log(chalk.green(readable.nsec));
}

async function listUsers(prisma: PrismaClient): Promise<void> {
  const identities: PrismaIdentity[] = await getAllIdentities(prisma);
  if (identities.length === 0) {
    console.log(chalk.yellow('No users found'));
    return;
  }
  console.log(chalk.bold.blue('Users:'));
  identities.forEach((identity: PrismaIdentity) => {
    const activeMarker = identity.is_active ? chalk.green(' (active)') : '';
    console.log(`${getNpub(identity.pubkey)} | ${identity.name}${activeMarker}`);
  });
}

async function switchUser(prisma: PrismaClient): Promise<UserKeys | null> {
  const identities: PrismaIdentity[] = await getAllIdentities(prisma);
  if (identities.length === 0) {
    console.log(chalk.yellow('No users found'));
    return null;
  }

  const name = await rawlist({
    message: 'Select a user to switch to:',
    choices: identities.map((identity) => ({
      name: `(${getNpub(identity.pubkey)}) | ${identity.name} ${identity.is_active ? ' (active)' : ''}`,
      value: identity.name,
    })),
  });

  const identity: PrismaIdentity | null = await setActiveIdentityByName(prisma, name);
  if (identity === null) {
    // this shouldn't happen
    console.log(chalk.red('User not found'));
    return null;
  }

  console.log(chalk.green(`Switched to user: (${getNpub(identity.pubkey)} | ${identity.name} )`));
  const userPrivateKey: Uint8Array | null = await getPrivateKey(identity.pubkey);
  if (userPrivateKey === null) return null;

  const newUserKeys = { pubkey: identity.pubkey, privateKey: userPrivateKey };
  userState.setUserKeys(newUserKeys); // Update the global state here
  return newUserKeys;
}

async function removeUser(prisma: PrismaClient): Promise<UserKeys | null> {
  const identities: PrismaIdentity[] = await getAllIdentities(prisma);
  if (identities.length === 0) {
    // this shouldn't be possible, but just in case
    console.log(chalk.yellow('No users found.'));
    return null;
  }

  const user: PrismaIdentity = await rawlist({
    message: 'Select a user to remove:',
    choices: identities.map((identity) => ({
      name: `${getNpub(identity.pubkey)} | ${identity.name} ${identity.is_active ? ' (active)' : ''}`,
      value: identity,
    })),
  });

  const conf = await confirm({
    message: `Are you sure you want to remove user ${getNpub(user.pubkey)} (${user.name})?`,
    default: false,
  });
  if (conf === false) {
    console.log(chalk.yellow('User removal cancelled.'));
    return null;
  }

  const deleted = await removeIdentityByKey(prisma, user.pubkey);
  if (!deleted) {
    console.log(chalk.red('Failed to delete user.'));
    return null;
  }
  console.log(chalk.green(`User removed: ${getNpub(user.pubkey)} (${user.name})`));

  // if the user was active, a new active user needs to be selected.
  if (user.is_active === true) return await switchUser(prisma);

  return null;
}
