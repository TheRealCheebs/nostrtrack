import { input } from '@inquirer/prompts';
import type { Project, ProjectMember } from '../interfaces/project';
import type { Ticket } from '../interfaces/ticket';

import { userState } from '../state/user-state';
import { formatNostrTimestamp } from '../nostr/utils';

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


export function printProjectList(projects: Project[]) {
  const columnWidths = {
    uuid: 40,
    name: 20,
    updated: 25,
    private: 10,
  };

  // Create the header
  const header = [
    'Project UUID'.padEnd(columnWidths.uuid),
    'Name'.padEnd(columnWidths.name),
    'Updated'.padEnd(columnWidths.updated),
    'Private'.padEnd(columnWidths.private),
  ].join(' | ');

  const rows = projects.map((project) => {
    const updatedDate = formatNostrTimestamp(Number(project.lastEventCreatedAt));
    const privateStatus = project.isPrivate ? 'Yes' : 'No';

    return [
      project.uuid.padEnd(columnWidths.uuid),
      project.name.padEnd(columnWidths.name),
      updatedDate.padEnd(columnWidths.updated),
      privateStatus.padEnd(columnWidths.private),
    ].join(' | ');
  });
  const table = [header, '-'.repeat(header.length), ...rows].join('\n');
  console.log(table);
}

export function printTicketList(tickets: Ticket[]) {
  const columnWidths = {
    uuid: 40,
    title: 20,
    updated: 25,
    state: 10,
    type: 10,
  };

  // Create the header
  const header = [
    'Ticket UUID'.padEnd(columnWidths.uuid),
    'Title'.padEnd(columnWidths.title),
    'Updated'.padEnd(columnWidths.updated),
    'State'.padEnd(columnWidths.state),
    'Type'.padEnd(columnWidths.type),
  ].join(' | ');

  const rows = tickets.map((ticket) => {
    const updatedDate = formatNostrTimestamp(Number(ticket.lastEventCreatedAt));

    return [
      ticket.uuid.padEnd(columnWidths.uuid),
      ticket.title.padEnd(columnWidths.title),
      updatedDate.padEnd(columnWidths.updated),
      ticket.state.padEnd(columnWidths.state),
      ticket.type.padEnd(columnWidths.type),
    ].join(' | ');
  });
  const table = [header, '-'.repeat(header.length), ...rows].join('\n');
  console.log(table);
}
