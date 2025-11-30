import inquirer from 'inquirer';
import chalk from 'chalk';
import { createIdentity, getPrivateKey, getAllIdentities, getActiveUserKeys, setActiveIdentityByName, removeIdentityByKey } from '../services/prisma/identity';
import { PrismaClient } from '@prisma/client';
import type { Identity as PrismaIdentity } from '@prisma/client';
import type { UserKeys } from '../interfaces/identity';
import { convertForNIP19, createKeys, importKeys, getPublicName, getNpub } from '../nostr/utils';
import { userState } from "../state/user-state";

const emptyUserKeys: UserKeys = { pubKey: '', privateKey: new Uint8Array() };

export async function mainUsersFlow(prisma: PrismaClient): Promise<UserKeys> {

  const { action } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'action',
      message: 'User Actions:',
      choices: [
        'Create User',
        'Import User',
        'Export Active User',
        'List Users',
        'Switch User',
        'Delete User',
        'Back to Main Menu',
      ],
    },
  ]);

  switch (action) {
    case 'Create User':
      const userKeys = await createUser(prisma);
      if (userKeys) return userKeys;
      break;
    case 'Import User':
      const importedKeys = await importUser(prisma);
      if (importedKeys) return importedKeys;
      break;
    case 'Export Active User':
      await exportUser(prisma);
      break;
    case 'List Users':
      listUsers(prisma);
      break;
    case 'Switch User':
      const switchedKeys = await switchUser(prisma);
      if (switchedKeys) return switchedKeys;
      break;
    case 'Delete User':
      const updatedUser = await deleteUser(prisma);
      if (updatedUser) return updatedUser;
      break;
    case 'Back to Main Menu':
      break;
  }
  return emptyUserKeys;
}

export async function noUserFlow(prisma: PrismaClient): Promise<UserKeys> {
  let running = true;

  while (running) {
    console.log('No active user found. Please create or import a user.');
    const { action } = await inquirer.prompt([{
      type: 'rawlist',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        'Create User',
        'Import User',
        'Exit'
      ],
    }]);

    switch (action) {
      case 'Create User':
        const userKeys = await createUser(prisma);
        if (userKeys) return userKeys;
        break;
      case 'Import User':
        const importedKeys = await importUser(prisma);
        if (importedKeys) return importedKeys;
        break;
      case 'Exit':
        // should cleanup before exiting.
        process.exit(0);
    }
  }
  return emptyUserKeys;
}

async function createUser(prisma: PrismaClient): Promise<UserKeys | null> {
  console.log('\nCreate New User\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'User name:',
      validate: input => input.trim() !== '' || 'User name is required'
    }
  ]);

  const userKeys = createKeys();
  const identity = await createIdentity(prisma, answers.name, userKeys);
  if (!identity) {
    console.log(chalk.red('Failed to create user'));
    return null;
  }

  console.log(chalk.green(`User created: ${identity.name} (${getNpub(identity.pubkey)})`));
  const userPubkey = identity.pubkey;
  const userPrivateKey = await getPrivateKey(userPubkey)
  if (!userPrivateKey) {
    return null;
  }

  const newUserKeys = { pubKey: userPubkey, privateKey: userPrivateKey };
  userState.setUserKeys(newUserKeys); // Update the global state here
  return newUserKeys;
}

async function importUser(prisma: PrismaClient): Promise<UserKeys | null> {
  console.log('\nImport User\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'privateKey',
      message: 'private key: nsec',
      validate: input => input.trim() !== '' || 'private key is required'
    }
  ]);

  const userKeys = importKeys(answers.privateKey)
  const name = getPublicName(userKeys.pubKey)
  const identity = await createIdentity(prisma, name, userKeys);
  if (!identity) {
    console.log(chalk.red('Failed to import user'));
    return null;
  }

  const human = convertForNIP19(userKeys);
  console.log(chalk.green(`User imported: ${identity.name} (${human.npub})`));
  userState.setUserKeys(userKeys); // Update the global state here

  return userKeys
}
async function exportUser(prisma: PrismaClient): Promise<void> {
  const keys = await getActiveUserKeys(prisma)
  if (!keys) {
    return;
  }
  const readable = convertForNIP19(keys);
  console.log(chalk.bold.blue('npub:'));
  console.log(`${chalk.cyan(readable.npub)}`);
  console.log(chalk.bold.blue('nsec:'));
  console.log(`${chalk.cyan(readable.nsec)}`);
}

async function listUsers(prisma: PrismaClient): Promise<void> {
  console.log('\nList Users\n');
  getAllIdentities(prisma).then((identities: PrismaIdentity[]) => {
    if (identities.length === 0) {
      console.log(chalk.yellow('No users found'));
      return;
    }
    console.log(chalk.bold.blue('Users:'));
    identities.forEach((identity: PrismaIdentity) => {
      const activeMarker = identity.is_active ? chalk.green(' (active)') : '';
      console.log(`${chalk.cyan(identity.name)} | ${getNpub(identity.pubkey)}${activeMarker}`);
    });
  });
}

async function switchUser(prisma: PrismaClient): Promise<UserKeys | null> {
  const identities: PrismaIdentity[] = await getAllIdentities(prisma);
  if (identities.length === 0) {
    console.log(chalk.yellow('No users found'));
    return null;
  }
  const choices = identities.map(identity => ({
    name: `${identity.name} (${getNpub(identity.pubkey)})${identity.is_active ? ' (active)' : ''}`,
    value: identity.name
  }));

  const { name } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'name',
      message: 'Select a user to switch to:',
      choices
    }
  ]);

  const identity = await setActiveIdentityByName(prisma, name);
  if (identity) {
    console.log(chalk.green(`Switched to user: ${identity.name} (${getNpub(identity.pubkey)})`));
    const userPrivateKey = await getPrivateKey(identity.pubkey);
    if (!userPrivateKey) return null;
    const newUserKeys = { pubKey: identity.pubkey, privateKey: userPrivateKey };
    userState.setUserKeys(newUserKeys); // Update the global state here
    return newUserKeys;
  } else {
    console.log(chalk.red('User not found'));
    return null;
  }
}

async function deleteUser(prisma: PrismaClient): Promise<UserKeys | null> {
  const identities: PrismaIdentity[] = await getAllIdentities(prisma);
  if (identities.length === 0) {
    // this shouldn't be possible, but just in case
    console.log(chalk.yellow('No users found. You must create or import a user.'));
    return null;
  }
  const choices = identities.map(identity => ({
    name: `${identity.name} (${getNpub(identity.pubkey)})${identity.is_active ? ' (active)' : ''}`,
    value: identity.pubkey
  }));

  const { pubkey } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'pubkey',
      message: 'Select a user to delete:',
      choices
    }
  ]);

  const identity = identities.find(i => i.pubkey === pubkey);
  if (!identity) {
    console.log(chalk.red('User not found.'));
    return null;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete user ${identity.name} (${getNpub(identity.pubkey)})?`,
      default: false
    }
  ]);
  if (!confirm) {
    console.log(chalk.yellow('User deletion cancelled.'));
    return null;
  }

  // Delete the user (implement deleteIdentity in your identity module)
  const deleted = await removeIdentityByKey(prisma, pubkey);
  if (!deleted) {
    console.log(chalk.red('Failed to delete user.'));
    return null;
  }
  console.log(chalk.green(`User deleted: ${identity.name} (${getNpub(identity.pubkey)})`));

  // Get remaining users
  const remaining: PrismaIdentity[] = await getAllIdentities(prisma);
  if (remaining.length === 0) {
    console.log(chalk.yellow('No users left. You must create or import a new user.'));
    // Optionally, call createUser or importUser here
    return null;
  }

  // Force user to select a new active user
  const newChoices = remaining.map(i => ({
    name: `${i.name} (${getNpub(i.pubkey)})${i.is_active ? ' (active)' : ''}`,
    value: i.name
  }));
  const { name: newName } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'name',
      message: 'Select a user to set as active:',
      choices: newChoices
    }
  ]);
  const newIdentity = await setActiveIdentityByName(prisma, newName);
  if (newIdentity) {
    console.log(chalk.green(`Switched to user: ${newIdentity.name} (${getNpub(newIdentity.pubkey)})`));
    const userPrivateKey = await getPrivateKey(newIdentity.pubkey);
    if (!userPrivateKey) return null;
    const newUserKeys = { pubKey: newIdentity.pubkey, privateKey: userPrivateKey };
    userState.setUserKeys(newUserKeys); // Update the global state here
    return newUserKeys;
  } else {
    console.log(chalk.red('Failed to set new active user.'));
    return null;
  }
}
