/* import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { getTickets, createTicket, updateTicketState, deleteTicket } from '../ticket.js';
import { PrismaClient } from '@prisma/client';
import { publishTicketUpdate } from '../nostr.js';
import { getActiveUserKeys } from '../identity.js';

const prisma = new PrismaClient();
const ticketCommand = new Command('ticket')
  .description('Ticket actions')

// List tickets command
ticketCommand
  .command('list')
  .description('List all tickets')
  .option('-s, --state <state>', 'Filter by state')
  .action(async (options) => {
    const tickets = await getTickets(prisma, options.state ? { state: options.state } : undefined);

    console.log(chalk.bold.blue('Tickets:'));
    tickets.forEach(ticket => {
      console.log(
        `${chalk.green(ticket.uuid)} | ${chalk.cyan(ticket.state.padEnd(10))} | ${ticket.title}`
      );
    });
  });

// Add ticket command
ticketCommand
  .command('add')
  .description('Add a new ticket')
  .action(async () => {
    const userKeys = await getActiveUserKeys(prisma);
    if (!userKeys) {
      console.log(chalk.red('No active user. Please select a user first.'));
      return;
    }
    const { pubkey, privateKey } = userKeys;

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
      }
    ]);

    const ticket = await createTicket(prisma, )
    //const ticket = await createTicket(prisma, answers.title, answers.description, pubkey);

    // Publish to Nostr
    await publishTicketUpdate(
      privateKey,
      ticket.uuid,
      ticket.state,
      `Ticket created: ${ticket.title}`
    );

    console.log(chalk.green(`Ticket created with ID: ${ticket.uuid}`));
  });

// Update ticket command
ticketCommand
  .command('update')
  .description('Update ticket state')
  .action(async () => {
    const userKeys = await getActiveUserKeys(prisma);
    if (!userKeys) {
      console.log(chalk.red('No active user. Please select a user first.'));
      return;
    }
    const { privateKey } = userKeys;

    const tickets = await getTickets(prisma);

    if (tickets.length === 0) {
      console.log(chalk.yellow('No tickets found'));
      return;
    }

    const { ticketId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'ticketId',
        message: 'Select ticket to update:',
        choices: tickets.map(t => ({
          name: `${t.title} (${t.state})`,
          value: t.uuid
        }))
      }
    ]);

    const { state } = await inquirer.prompt([
      {
        type: 'list',
        name: 'state',
        message: 'Select new state:',
        choices: [
          'backlog', 'started', 'finished',
          'delivered', 'accepted', 'rejected'
        ]
      }
    ]);

    await updateTicketStatus(prisma, ticketId, state);

    // Publish to Nostr
    await publishTicketUpdate(
      privateKey,
      ticketId,
      state,
      `state updated to ${state}`
    );

    console.log(chalk.green(`Ticket ${ticketId} updated to ${state}`));
  });

// Delete ticket command
ticketCommand
  .command('delete')
  .description('Delete a ticket')
  .action(async () => {
    const userKeys = await getActiveUserKeys(prisma);
    if (!userKeys) {
      console.log(chalk.red('No active user. Please select a user first.'));
      return;
    }
    const { privateKey } = userKeys;
    const tickets = await getTickets(prisma);

    if (tickets.length === 0) {
      console.log(chalk.yellow('No tickets found'));
      return;
    }

    const { ticketId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'ticketId',
        message: 'Select ticket to delete:',
        choices: tickets.map(t => ({
          name: `${t.title} (${t.state})`,
          value: t.uuid
        }))
      }
    ]);

    await deleteTicket(prisma, ticketId);

    // Publish to Nostr
    await publishTicketUpdate(
      privateKey,
      ticketId,
      'deleted',
      'Ticket deleted'
    );

    console.log(chalk.green(`Ticket ${ticketId} deleted`));
  });

ticketCommand
  .command('sync')
  .description('Sync tickets from Nostr')
  .action(async () => {
    console.log(chalk.blue('Syncing tickets from Nostr...'));
    // Placeholder for sync logic
    console.log(chalk.green('Tickets synced successfully (placeholder)'));
  });


export { ticketCommand }; */
