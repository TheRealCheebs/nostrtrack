import inquirer from 'inquirer';
import chalk from 'chalk';

import { listRelays, modifyRelays } from '../settings';

export async function mainSettingsFlow() {
  const { action } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'action',
      message: 'Settings Actions:',
      choices: ['Sync with Relays', 'List Relays', 'Modify Relays', 'Back to Main Menu'],
    },
  ]);

  switch (action) {
    case 'Sync with Relays':
      console.log('Syncing with relays...');
      break;
    case 'List Relays':
      await listRelaysFlow();
      break;
    case 'Modify Relays':
      await modifyRelaysFlow();
      break;
    case 'Back to Main Menu':
      break;
  }
}

async function listRelaysFlow() {
  const relays = await listRelays();

  if (relays.length === 0) {
    console.log(chalk.yellow('No relays found'));
    return;
  }
  console.log(chalk.bold.blue('Relays:'));
  relays.forEach((relay: string) => {
    console.log(`${chalk.cyan(relay)}`);
  });
}

async function modifyRelaysFlow() {
  const { action } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'action',
      message: 'Would you like to add or remove a relay?',
      choices: ['Add', 'Remove', 'Cancel'],
    },
  ]);

  if (action === 'Cancel') {
    console.log('Operation canceled.');
    return;
  }

  if (action === 'Add') {
    const { relayUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'relayUrl',
        message: 'Enter the URL of the relay to add (or leave blank to cancel):',
        validate: (input) => input.trim() !== '' || 'Relay URL cannot be empty',
      },
    ]);

    if (!relayUrl.trim()) {
      console.log('Add operation canceled.');
      return;
    }

    await modifyRelays('add', relayUrl);
    console.log(`Relay added: ${relayUrl}`);
  } else if (action === 'Remove') {
    const relays = await listRelays();

    if (relays.length === 0) {
      console.log('No relays available to remove.');
      return;
    }

    const { relayToRemove } = await inquirer.prompt([
      {
        type: 'rawlist',
        name: 'relayToRemove',
        message: 'Select a relay to remove (or Cancel):',
        choices: [...relays, new inquirer.Separator(), 'Cancel'],
      },
    ]);

    if (relayToRemove === 'Cancel') {
      console.log('Remove operation canceled.');
      return;
    }

    await modifyRelays('remove', relayToRemove);
    console.log(`Relay removed: ${relayToRemove}`);
  }
}
