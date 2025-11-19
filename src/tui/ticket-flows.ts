import inquirer from 'inquirer';
import { createTicket } from '@services/ticket.js';
import { saveNewTicket, updateTicketNostrEvent } from '@services/prisma/ticket';
import { createAndPublishPrivateTicket, createAndPublishTicket } from '@services/nostr/ticket';
import { updateAndPublishPrivateProject, updateAndPublishProject } from '@services/nostr/projects';
import { addNewTicketToProject, getProjectById, prismaToProject, updateProjectNostrEvent } from '@services/prisma/project';
import { getAllTicketsFromRelay } from '@nostr/utils.js';
import { PrismaClient } from '@prisma/client';
import { userState } from '@state/user-state';
import type { Ticket } from '@interfaces/ticket';

export async function mainTicketsFlow(prisma: PrismaClient) {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Ticket Actions:',
      choices: [
        'Create Ticket',
        'Edit Ticket',
        'Delete Ticket',
        'Move Ticket',
        'List Tickets',
        'Show All from Relay',
        'Back to Main Menu',
      ],
    },
  ]);

  switch (action) {
    case 'Create Ticket':
      // in public project start state is unverified, or member in private
      await createTicketFlow(prisma);
      break;
    case 'Edit Ticket':
      // must be admin in public project, or member in private
      console.log('Edit ticket not done...');
      break;
    case 'Delete Ticket':
      // must be admin in public project, or member in private
      console.log('Delete ticket not done...');
      break;
    case 'Move Ticket':
      // must be admin in public project, or member in private
      console.log('Move ticket not done...');
      break;
    case 'List Tickets':
      console.log('List ticket not done...');
      break;
    case 'Show All from Relay':
      await showAllTicketssOnRelayFlow();
      break;
    case 'Back to Main Menu':
      break;
  }
}

async function createTicketFlow(prisma: PrismaClient): Promise<string | null> {
  console.log('\n📋 Create New Ticket\n');

  const userKeys = userState.getUserKeys();
  if (!userKeys) {
    console.log('No user keys found, please load userKeys');
    return null;
  }
  const projectUuid = userState.getActiveProject();
  if (projectUuid == "") {
    console.log('No projectUuid found, please select active project');
    return null;
  }
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: 'Ticket title:',
      validate: input => input.trim() !== '' || 'Title is required'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description (optional):'
    },
    {
      type: 'input',
      name: 'type',
      message: 'Type (Feature | Bug | Epic | Chore):'
    },
    {
      type: 'input',
      name: 'parent',
      message: 'Parent Ticket UUID (optional):'
    },
    {
      type: 'input',
      name: 'children',
      message: 'Children Ticket UUID (optional):'
    },
  ]);

  const pproject = await getProjectById(prisma, projectUuid);
  // project should exist but check.
  if (!pproject) {
    console.error('\n❌ Failed to find the project');
    return null
  }
  const project = prismaToProject(pproject);
  try {
    const ticket = createTicket(
      project.uuid,
      answers.type,
      answers.title,
      answers.description,
      userKeys.pubKey,
      answers.parent
    );

    saveNewTicket(prisma, ticket);
    try {
      if (project.isPrivate) {
        const privateEvent = await createAndPublishPrivateTicket(ticket, userKeys, project.members);
        updateTicketNostrEvent(prisma, ticket.uuid, privateEvent.id, privateEvent.created_at);
        // update the project to include the new ticket.
        const privateProject = await updateAndPublishPrivateProject(project, userKeys, project.members, ticket.uuid, 'ticket');
        updateProjectNostrEvent(prisma, project.uuid, privateProject.id, privateProject.created_at);
      } else {
        const event = await createAndPublishTicket(ticket, userKeys);
        updateTicketNostrEvent(prisma, ticket.uuid, event.id, event.created_at);
        // update the project to include the new ticket.
        const updatedProject = await updateAndPublishProject(project, userKeys, ticket.uuid, 'ticket');
        updateProjectNostrEvent(prisma, project.uuid, updatedProject.id, updatedProject.created_at);
      }
      addNewTicketToProject(prisma, project.uuid, ticket.uuid);
    } catch (relayError) {
      console.warn(" Failed to send ticket to relay:", relayError)
    }
    console.log(`\n✅ Ticket created successfully!`);
    console.log(`   UUID: ${ticket.uuid}`);
    return project.uuid;
  } catch (error) {
    console.error('\n❌ Failed to create ticket:', error);
  }
  return null

}

async function showAllTicketssOnRelayFlow(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'limit',
      message: 'Number of tickets to show'
    }
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
