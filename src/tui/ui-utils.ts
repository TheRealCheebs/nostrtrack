import inquirer from 'inquirer';
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
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: '\nPress Enter to continue...',
    },
  ]);
}

export async function confirmAction(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: false,
    },
  ]);
  return confirmed;
}
