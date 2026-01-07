import inquirer from 'inquirer';
import { rawlist, input, confirm } from '@inquirer/prompts';
import { type PrismaClient } from '@prisma/client';

import chalk from 'chalk';
import { createTicket } from '../services/ticket';
import { saveNewTicket, updateTicketNostrEvent } from '../services/prisma/ticket';
import { createAndPublishPrivateTicket, createAndPublishTicket } from '../services/nostr/ticket';
import {
  updateAndPublishPrivateProject,
  updateAndPublishProject,
} from '../services/nostr/projects';
import {
  addNewTicketToProject,
  getProjectById,
  updateProjectNostrEvent,
} from '../services/prisma/project';
import {
  prismaToProject,
} from '../utils/project-transformers';
import { getAllTicketsFromRelay } from '../nostr/utils';
import { userState } from '../state/user-state';
import type { Ticket } from '../interfaces/ticket';

export async function mainTicketsFlow(prisma: PrismaClient) {
  const TICKET_OPTIONS = [
    'Create Ticket',
    'Edit Ticket',
    'Delete Ticket',
    'Move Ticket',
    'List Ticket',
    'Show All from Relay',
    'Back to Main Menu',
  ] as const;
  type Action = (typeof TICKET_OPTIONS)[number];
  const ticketActions: Record<Action, (prisma: PrismaClient) => Promise<void>> = {
    'Create Ticket': async (prisma) => {
      // in public project start state is unverified, or member in private
      await createTicketFlow(prisma);
    },
    'Edit Ticket': async () => {
      // must be admin in public project, or member in private
      console.log('Edit ticket not done...');
    },
    'Delete Ticket': async () => {
      // must be admin in public project, or member in private
      console.log('Delete ticket not done...');
    },
    'Move Ticket': async () => {
      // must be admin in public project, or member in private
      console.log('Move ticket not done...');
    },
    'List Ticket': async () => {
      console.log('List ticket not done...');
    },
    'Show All from Relay': async () => {
      await showAllTicketssOnRelayFlow();
    },
    'Back to Main Menu': async () => {
      return Promise.resolve();
    },
  };
  const answer = await rawlist(
    {
      message: 'Ticket Actions:',
      choices: TICKET_OPTIONS.map((action) => ({
        name: action,
        value: action,
      })),
    });

  const action = answer;
  await ticketActions[action](prisma);
}

async function createTicketFlow(prisma: PrismaClient): Promise<string | null> {
  const userKeys = userState.getUserKeys();
  if (userKeys.pubkey === '') {
    console.log(chalk.red('No user keys found, please load userKeys'));
    return null;
  }
  const projectUuid = userState.getActiveProject();
  if (projectUuid === '') {
    console.log(chalk.red('No projectUuid found, please select active project'));
    return null;
  }

  const title = await input({
    message: 'Ticket title:',
    validate: (input) => input.trim() !== '' || 'Title is required',
  });
  const description = await input({
    message: 'Description (optional):',
  });
  const ticketType = await input({
    message: 'Type (Feature | Bug | Epic | Chore):',
    // validate they match one of these types?
  });
  const parentUuid = await input({
    message: 'Parent Ticket UUID (optional):',
  });
  const childrenUuid = await input({
    message: 'Children Ticket UUIDs (optional):',
  });

  const ticket = createTicket(
    projectUuid,
    ticketType,
    title,
    description,
    userKeys.pubkey,
    parentUuid,
  );

  const pproject = await getProjectById(prisma, projectUuid);
  try {
    saveNewTicket(prisma, ticket);
  } catch (error) {
    console.error('\nFailed to create ticket:', error);
  }
  // project should exist but check.
  if (pproject === null) {
    console.error('\nFailed to find the project');
    return null;
  }
  const project = prismaToProject(pproject);
  try {
    if (project.isPrivate) {
      const privateEvent = await createAndPublishPrivateTicket(ticket, userKeys, project.members);
      updateTicketNostrEvent(prisma, ticket.uuid, privateEvent.id, privateEvent.created_at);
      // update the project to include the new ticket.
      const privateProject = await updateAndPublishPrivateProject(
        project,
        userKeys,
        project.members,
        ticket.uuid,
        'ticket',
      );
      updateProjectNostrEvent(prisma, project.uuid, privateProject.id, privateProject.created_at);
    } else {
      const event = await createAndPublishTicket(ticket, userKeys);
      updateTicketNostrEvent(prisma, ticket.uuid, event.id, event.created_at);
      // update the project to include the new ticket.
      const updatedProject = await updateAndPublishProject(
        project,
        userKeys,
        ticket.uuid,
        'ticket',
      );
      updateProjectNostrEvent(prisma, project.uuid, updatedProject.id, updatedProject.created_at);
    }
    addNewTicketToProject(prisma, project.uuid, ticket.uuid);
  } catch (relayError) {
    console.warn('Failed to send ticket to relay:', relayError);
  }
  console.log(`\nTicket created successfully!`);
  console.log(`\tUUID: ${ticket.uuid}`);
  return project.uuid;
  return null;
}

async function showAllTicketssOnRelayFlow(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'limit',
      message: 'Number of tickets to show',
    },
  ]);

  const tickets: Ticket[] = await getAllTicketsFromRelay(answers.limit);

  tickets.forEach((ticket) => {
    const date = new Date(ticket.lastEventCreatedAt * 1000); // Convert milliseconds to a Date object
    const createdAt = new Date(ticket.createdAt * 1000); // Convert milliseconds to a Date object
    // Format the date to a readable string
    console.log(`Title: ${ticket.title}`);
    console.log(`Description: ${ticket.description}`);
    console.log(`Type: ${ticket.type}`);
    console.log(`Creator: ${ticket.creatorPubkey}`);
    console.log(`Creator At: ${createdAt}`);
    console.log(`Last Event ID: ${ticket.lastEventId}`);
    console.log(`Last Time: ${date}`);
  });
}
