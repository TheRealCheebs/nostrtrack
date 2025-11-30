// import { Command } from 'commander';
// import chalk from 'chalk';
// import { PrismaClient } from '@prisma/client';
// import { createIdentity, getActiveIdentity, getAllIdentities, setActiveIdentityByName, setActiveIdentityByKey, removeIdentityByName, removeIdentityByKey } from '../identity.js';
// import type { Identity as PrismaIdentity } from '@prisma/client';

// const prisma = new PrismaClient();
// const userCommand = new Command('user')
//   .description('Manage users')

// userCommand
//   .command('create')
//   .description('Create a new user')
//   .requiredOption('-n, --name <name>', 'Name is required')
//   .action((options) => {
//     createIdentity(prisma, options.name).then(identity => {
//       console.log(chalk.green(`User created: ${identity.name} (${identity.pubkey})`));
//     });
//   });

// userCommand
//   .command('select')
//   .description('Select a user')
//   .option('-k, --key <pubkey>', 'Select by pubkey')
//   .option('-n, --name <name>', 'Select by name')
//   .action((options) => {
//     if (options.name === '') {
//       setActiveIdentityByName(prisma, options.name).then(identity => {
//         if (identity) {
//           console.log(chalk.green(`Switched to user: ${identity.name} (${identity.pubkey})`));
//         } else {
//           console.log(chalk.red('User not found'));
//         }
//       });
//       return;
//     }
//     if (options.key === '') {
//       setActiveIdentityByKey(prisma, options.key).then(identity => {
//         if (identity) {
//           console.log(chalk.green(`Switched to user: ${identity.name} (${identity.pubkey})`));
//         } else {
//           console.log(chalk.red('User not found'));
//         }
//       });
//       return;
//     }
//     console.log(chalk.red('No user provided, not switching'));
//   });

// userCommand
//   .command('active')
//   .description('Show the active user')
//   .action(() => {
//     getActiveIdentity(prisma).then(identity => {
//       if (identity) {
//         console.log(chalk.green(`Active user: ${identity.name} (${identity.pubkey})`));
//       } else {
//         console.log(chalk.red('No active user'));
//       }
//     });
//   });

// userCommand
//   .command('list')
//   .description('List all users')
//   .action(() => {
//     getAllIdentities(prisma).then((identities: PrismaIdentity[]) => {
//         if (identities.length === 0) {
//             console.log(chalk.yellow('No users found'));
//             return;
//         }
//         console.log(chalk.bold.blue('Users:'));
//         identities.forEach((identity: PrismaIdentity) => {
//             const activeMarker = identity.is_active ? chalk.green(' (active)') : '';
//             console.log(`${chalk.cyan(identity.name)} | ${identity.pubkey}${activeMarker}`);
//         });
//     });
// });

// userCommand
//   .command('remove')
//   .description('Remove a user')
//   .option('-k, --key <pubkey>', 'Remove by pubkey')
//   .option('-n, --name <name>', 'Remove by name')
//   .action((options) => {
//     if (options.name === '') {
//       removeIdentityByName(prisma, options.name).then(success => {
//         if (success) {
//           console.log(chalk.green(`Removed user: ${options.name}`));
//         } else {
//           console.log(chalk.red('User not found'));
//         }
//       });
//       return;
//     }
//     if (options.key === '') {
//       removeIdentityByKey(prisma, options.key).then(success => {
//         if (success) {
//           console.log(chalk.green(`Removed user: ${options.key}`));
//         } else {
//           console.log(chalk.red('User not found'));
//         }
//       });
//       return;
//     }
//     console.log(chalk.red('No user provided, unable to remove'));
//   });

// export { userCommand };
