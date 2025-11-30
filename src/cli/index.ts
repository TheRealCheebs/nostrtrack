/* #!/usr/bin/env node

import { Command } from 'commander';
import { userCommand } from './userCommands.js';
import { ticketCommand } from './ticketCommands.js';

const program = new Command();

program
  .name('nostrtrack')
  .description('Nostr native agile project tracker')
  .version('1.0.0');



// Show help if no command is provided (no subcommand)
if (process.argv.length < 3) {
  program.outputHelp();
}

program.addCommand(userCommand);
program.addCommand(ticketCommand);
program.parse() */
