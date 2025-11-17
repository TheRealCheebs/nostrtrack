import inquirer from 'inquirer';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

import { mainUsersFlow, noUserFlow } from '@tui/user-flows.js';
import { mainProjectsFlow } from '@tui/project-flows.js';
import { mainTicketsFlow } from '@tui/ticket-flows.js';
import { mainSettingsFlow } from '@tui/settings-flows.js';
import { clearScreen, showHeader, pauseBeforeContinue } from '@tui/ui-utils.js';
import { closeAllSubscriptions } from '@nostr/sync.js';

import { getActiveUserKeys } from '@services/prisma/identity.js';
import { listRelays } from '../settings.js';
import { initNostr } from '../nostr/utils.js';

import type { UserKeys } from '@interfaces/identity.js';
import { subscribeAllForUser } from '@services/prisma/subscribe.js';

// Main application loop
async function main() {
  const prisma = new PrismaClient();
  let running = true;
  let currentProject: string = "";

  let userKeys = await initializeApp(prisma);

  while (running) {
    try {
      // at this point there should always be userkeys loaded
      if (!userKeys) {
        console.log('Error loading user keys, exiting application.');
        return;
      }
      // Clear screen and show header
      clearScreen();
      // TODO: list the users name
      showHeader(userKeys.pubKey, currentProject);
      [userKeys, currentProject, running] = await mainMenu(prisma, userKeys, currentProject);

      // Pause before returning to menu (except for exit)
      if (running) {
        await pauseBeforeContinue();
      }

    } catch (error) {
      console.error('An error occurred:', error);
      await pauseBeforeContinue();
    }
  }

  // Cleanup before exit
  await cleanup();
  console.log('\n👋 Goodbye!');
  process.exit(0);
}

async function mainMenu(prisma: PrismaClient, userKeys: UserKeys, currentProjectUuid: string): Promise<[UserKeys, string, boolean]> {
  let keepRunning = true;

  const { category } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'category',
      message: 'Select a category:',
      choices: [
        'Users',
        'Projects',
        'Tickets',
        'Settings',
        'Exit',
      ],
    },
  ]);

  switch (category) {
    case 'Users':
      userKeys = await mainUsersFlow(prisma);
      break;
    case 'Projects':
      currentProjectUuid = await mainProjectsFlow(prisma, userKeys);
      break;
    case 'Tickets':
      await mainTicketsFlow(prisma, userKeys, currentProjectUuid);
      break;
    case 'Settings':
      await mainSettingsFlow();
      break;
    case 'Exit':
      keepRunning = false;
  }
  return [userKeys, currentProjectUuid, keepRunning];
}


async function initializeApp(prisma: PrismaClient): Promise<UserKeys | null> {
  console.log('Initializing application...');

  // load config
  const relays = await listRelays();
  initNostr(relays).catch((error) => {
    // we need to set offline mode or something here.
    console.error('Error initializing Nostr:', error);
  });

  // database
  await initializeDatabase(prisma);
  //
  // Load user keys
  let userKeys = await getActiveUserKeys(prisma);
  if (!userKeys) {
    userKeys = await noUserFlow(prisma);
  }

  subscribeAllForUser(prisma, userKeys, relays);

  // Any other initialization tasks
  console.log('✅ Application initialized');
  return userKeys;
}

async function cleanup() {
  console.log('Cleaning up...');

  closeAllSubscriptions();

  // Any other cleanup tasks
  console.log('✅ Cleanup complete');
}

async function initializeDatabase(prisma: PrismaClient) {
  try {
    // Check if the `Identity` table exists
    const result = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM sqlite_master WHERE type='table' AND name='Identity';
    `;

    if (!result || result.length === 0) {
      console.log('Table `Identity` does not exist. Running migrations...');
      // Run migrations
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('Migrations applied successfully.');
    } else {
      console.log('Database is already initialized.');
    }
  } catch (error) {
    console.error('Error during database initialization:', error);
    throw error;
  }
}

// Start the application
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
