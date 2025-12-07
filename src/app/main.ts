import { execSync } from 'child_process';

import { rawlist } from '@inquirer/prompts';
import { PrismaClient } from '@prisma/client';

import { mainUsersFlow, noUserFlow } from '../tui/user-flows';
import { mainProjectsFlow } from '../tui/project-flows';
import { mainTicketsFlow } from '../tui/ticket-flows';
import { mainSettingsFlow } from '../tui/settings-flows';
import { clearScreen, showHeader, pauseBeforeContinue } from '../tui/ui-utils';
import { closeAllSubscriptions } from '../nostr/sync';
import { userState } from '../state/user-state';
import { getActiveUserKeys } from '../services/prisma/identity';
import { listRelays } from '../settings';
import { initNostr } from '../nostr/utils';
import { subscribeAllForUser } from '../services/prisma/subscribe';
import type { UserKeys } from '../interfaces/identity';

// Main application loop
async function main() {
  const prisma = new PrismaClient();

  let running = await initializeApp(prisma);
  try {
    while (running) {
      // at this point there should always be userkeys loaded
      // Clear screen and show header
      clearScreen();
      showHeader();
      running = await mainMenu(prisma);
      if (running) await pauseBeforeContinue();
    }
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await cleanup(prisma);
  }
  await cleanup(prisma);
  console.log('\nGoodbye!');
  process.exit(0);
}

async function mainMenu(prisma: PrismaClient): Promise<boolean> {
  const CATEGORY_OPTIONS = ['Users', 'Projects', 'Tickets', 'Settings', 'Exit'] as const;
  type Category = (typeof CATEGORY_OPTIONS)[number];
  let keepRunning = true;

  const categoryActions: Record<Category, () => Promise<void>> = {
    Users: async () => {
      await mainUsersFlow(prisma);
    },
    Projects: async () => {
      await mainProjectsFlow(prisma);
    },
    Tickets: async () => {
      await mainTicketsFlow(prisma);
    },
    Settings: async () => {
      await mainSettingsFlow();
    },
    Exit: () => {
      keepRunning = false;
      return Promise.resolve();
    },
  };

  const answer = await rawlist({
    message: 'Select a category:',
    choices: CATEGORY_OPTIONS.map((category) => ({
      name: category,
      value: category,
    })),
  });

  const category = answer;
  await categoryActions[category]();

  return keepRunning;
}

async function initializeApp(prisma: PrismaClient): Promise<boolean> {
  console.log('Initializing application...');

  const relays = await listRelays();
  await initNostr(relays);
  initializeDatabase();

  let userKeys: UserKeys = await getActiveUserKeys(prisma);
  while (userKeys.pubKey === '') {
    userKeys = await noUserFlow(prisma);
  }

  userState.setUserKeys(userKeys);

  await subscribeAllForUser(prisma, userKeys, relays);

  console.log('Application initialized');
  return true;
}

async function cleanup(prisma: PrismaClient) {
  closeAllSubscriptions();

  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error during prisma cleanup:', error);
  }
}

function initializeDatabase() {
  try {
    console.log('Applying database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('Migrations applied successfully');
  } catch (error) {
    console.error('Failed to apply migrations:', error);
  }
}

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error);
  throw error;
});
