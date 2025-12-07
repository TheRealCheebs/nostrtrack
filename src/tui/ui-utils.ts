import { input } from '@inquirer/prompts';

import { userState } from '../state/user-state';

export function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[0f');
}

export function showHeader() {
  const user = userState.getUserName();
  const project = userState.getActiveProject();

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    NostrTrack                                ║
╚══════════════════════════════════════════════════════════════╝
`);
  if (user !== '') {
    console.log(`User: ${user}`);
  }
  if (project !== '') {
    console.log(`Project: ${project}`);
  }
}

export async function pauseBeforeContinue() {
  await input({
    message: '\nPress Enter to continue...',
  });
  clearScreen();
}
