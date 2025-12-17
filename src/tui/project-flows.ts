import { rawlist, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { type PrismaClient, type Project as PrismaProject, type Ticket as PrismaTicket, type ProjectMember as PrismaProjectMember } from '@prisma/client';
import { NullablePrismaProjectWithDetails } from '../types/project';

import { createProject } from '../services/project';
import { saveNewProject, removeProject, getProjects, getProjectById } from '../services/prisma/project';
import {
  publishProject,
  createProjectMemberFromNPub,
} from '../services/nostr/projects';
import {
  getAllProjectTicketsFromRelay,
  getAllProjectsFromRelay,
  formatNostrTimestamp,
  getNpub,
} from '../nostr/utils';
import { userState } from '../state/user-state';
import type { Project, ProjectMember } from '../interfaces/project';

export async function mainProjectsFlow(prisma: PrismaClient) {
  const PROJECT_OPTIONS = [
    'Create Project',
    'Import Project',
    'Edit Project',
    'Switch Active Project',
    'List Local Projects',
    'Remove Local Project',
    'Show All Remote Projects',
    'Show Remote Tickets In Project', // TODO: move this to the ticket flow?
    'Back to Main Menu',
  ] as const;
  type Action = (typeof PROJECT_OPTIONS)[number];

  const projectActions: Record<Action, (prisma: PrismaClient) => Promise<void>> = {
    'Create Project': async (prisma) => {
      await createProjectFlow(prisma);
    },
    'Import Project': async () => {
      console.log(chalk.yellow('TODO: Importing project...'));
      return Promise.resolve();
    },
    'Edit Project': async () => {
      console.log(chalk.yellow('TODO: Editing project...'));
      return Promise.resolve();
    },
    'Switch Active Project': async (prisma) => {
      await switchProjectsFlow(prisma);
    },
    'List Local Projects': async (prisma) => {
      await listLocalProjectsFlow(prisma);
    },
    'Remove Local Project': async () => {
      await removeLocalProjectsFlow(prisma);
    },
    'Show All Remote Projects': async () => {
      await showAllProjectsOnRelayFlow();
    },
    // TODO: move this into the tickets flow?
    'Show Remote Tickets In Project': async (prisma) => {
      await showAllTicketsInProjectFromRelayFlow(prisma);
    },
    'Back to Main Menu': async () => {
      return Promise.resolve();
    },
  };
  const answer = await rawlist({
    message: 'Project Actions',
    choices: PROJECT_OPTIONS.map((action) => ({
      name: action,
      value: action,
    })),
  });

  const action = answer;
  await projectActions[action](prisma);
}

async function createProjectFlow(prisma: PrismaClient) {
  const userKeys = userState.getUserKeys();
  if (userKeys.pubkey == '') {
    console.log(chalk.red('No user keys found, please load userKeys'));
    return;
  }
  let memberUsers: string = '';

  const name = await input({
    message: 'Project name:',
    validate: (input) => input.trim() !== '' || 'Project name is required',
  })
  const description = await input({
    message: 'Description (optional):',
  });
  const isPrivate = await confirm({
    message: 'Make this project private?',
  });
  // TODO: do this better
  const adminUsers = await input({
    message: 'Add users with admin roles (comma-separated npubs, optional):',
  });

  const projectId: string = uuidv4();
  let members: Array<ProjectMember> = [];
  if (adminUsers !== '') {
    const admin = adminUsers
      .split(',')
      .map((npub: string) => {
        const member: ProjectMember | null = createProjectMemberFromNPub(npub, 'admin', projectId);
        if (member === null) {
          console.log(chalk.red(`${npub} was not a valide npub, user is being skipped`));
        }
        return member;
      })
      .filter((member): member is ProjectMember => member !== null);
    members = members.concat(admin);
  }

  if (isPrivate === true) {
    memberUsers = await input({
      message:
        'Add users with read only roles (comma-separated npubs, optional):',
    });
    if (memberUsers !== '') {
      const users = memberUsers
        .split(',')
        .map((npub: string) => {
          const member: ProjectMember | null = createProjectMemberFromNPub(npub, 'member', projectId);
          if (member === null) {
            console.log(chalk.red(`${npub} was not a valide npub, user is being skipped`));
          }
          return member;
        })
        .filter((member): member is ProjectMember => member !== null);
      members = members.concat(users);
    }
  }

  let project = createProject(
    projectId,
    name,
    userKeys.pubkey,
    description,
    isPrivate,
    members,
  );

  try {
    project = await publishProject(project, userKeys);
  } catch (relayError) {
    console.log(chalk.yellow('Failed to send project to relay:', relayError));
  }

  try {
    saveNewProject(prisma, project);
    console.log(chalk.green(`Project ${projectId} created successfully, setting as active project.`));
    userState.setActiveProject(project.uuid);
  } catch (error) {
    if (error instanceof Error) {
      console.log(chalk.red(`Failed to create project: ${error.message}`));
    } else {
      console.log(chalk.red(`Failed to create project: ${String(error)}`));
    }
  }
}

async function removeLocalProjectsFlow(prisma: PrismaClient) {
  const selectedProject: string = await selectExistingLocalProject(prisma);
  if (selectedProject === '') {
    return;
  }

  const remove = await confirm({
    message: `Remove ${selectedProject} from local projects?`,
    default: false,
  });

  if (remove === false) {
    return;
  }

  try {
    await removeProject(prisma, selectedProject);
    console.log(chalk.green(`${selectedProject} removed from local project list`));
  } catch (error) {
    if (error instanceof Error) {
      console.log(chalk.red(`Failed to remove project: ${error.message}`));
    } else {
      console.log(chalk.red(`Failed to remove project: ${String(error)}`));
    }
  }
}

function printPrismaProjectList(projects: PrismaProject[]) {
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
    const updatedDate = new Date(Number(project.last_event_created_at) * 1000).toISOString();
    const privateStatus = project.is_private ? 'Yes' : 'No';

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

// TODO: move this
function printPrismaTicketList(tickets: PrismaTicket[]) {
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
    const updatedDate = new Date(Number(ticket.last_event_created_at) * 1000).toISOString();

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

export async function listLocalProjectsFlow(prisma: PrismaClient) {
  const pubkey = userState.getPubKey();
  if (pubkey === '') {
    console.log(chalk.yellow('No pubkey found, please load userKeys'));
    return;
  }
  const projects: PrismaProject[] = await getProjects(prisma, pubkey);

  if (projects.length === 0) {
    console.log(chalk.yellow('No projects found.'));
    return;
  }

  console.log(chalk.blue(`Projects ${getNpub(pubkey)} has locally saved:`));

  printPrismaProjectList(projects);

  const conf = await confirm({
    message: 'View Project Details',
  });

  if (conf === false) {
    return;
  }

  const options = projects.map((project) => ({
    name: project.name,
    value: project.uuid,
  }));
  options.push({
    name: 'Cancel',
    value: '',
  });

  const detailedView = await rawlist({
    message: 'Select a project',
    choices: options,
  });

  if (detailedView === '') {
    return;
  }

  await getProjectDetails(prisma, detailedView);
}

async function selectExistingLocalProject(prisma: PrismaClient): Promise<string> {
  const pubkey = userState.getPubKey();
  if (pubkey === '') {
    console.log(chalk.yellow('No pubkey found, please load userKeys'));
    return '';
  }

  const projects: PrismaProject[] = await getProjects(prisma, pubkey);

  if (projects.length === 0) {
    console.log(chalk.yellow('No projects found.'));
    return '';
  }

  const options = projects.map((project) => ({
    name: project.name,
    value: project.uuid,
  }));
  options.push({
    name: 'Cancel',
    value: '',
  });

  const selectedProject = await rawlist({
    message: 'Select a project',
    choices: options,
  });

  return selectedProject;
}

export async function switchProjectsFlow(prisma: PrismaClient) {
  const selectedProject: string = await selectExistingLocalProject(prisma);
  if (selectedProject === '') {
    return;
  }
  // TODO: think about a confirm here before switching?

  userState.setActiveProject(selectedProject);
}

export async function getProjectDetails(prisma: PrismaClient, projectId: string): Promise<void> {
  const activeUser = userState.getUserKeys();
  try {
    const project: NullablePrismaProjectWithDetails = await getProjectById(prisma, projectId);

    if (project === null) {
      console.log(chalk.yellow('Project not found.'));
      return;
    }

    const isUserInProject = project.members.some((member: PrismaProjectMember) => member.pubkey === activeUser.pubkey);
    if (project.is_private === true && isUserInProject === false) {
      console.log(chalk.yellow('User cannot view private project details.'));
      return;
    }

    console.log(`Project Name: ${project.name}`);
    console.log(`Description: ${project.description}`);
    console.log(`Private: ${project.is_private ? 'Yes' : 'No'}`);
    console.log(`Last Event ID: ${project.last_event_id}`);
    console.log(`Last Time: ${formatNostrTimestamp(project.last_event_created_at)}`);


    // List project tickets
    console.log(chalk.blue('Tickets:'));
    if (project.tickets.length > 0) {
      printPrismaTicketList(project.tickets);
    } else {
      console.log(chalk.yellow('\tNo tickets available.'));
    }

    // If the project is not private, show admin members
    if (project.is_private === false) {
      console.log(chalk.blue('Admin Members:'));
      const adminMembers: PrismaProjectMember[] = project.members.filter((member: PrismaProjectMember) => member.role === 'admin');
      if (adminMembers.length > 0) {
        adminMembers.forEach((admin: PrismaProjectMember) => {
          console.log(`\t- ${getNpub(admin.pubkey)}`);
        });
      } else {
        console.log(chalk.yellow('\tNo admin members.'));
      }
    } else {
      // List project members on private projects
      console.log(chalk.blue('Members:'));
      project.members.forEach((member: PrismaProjectMember) => {
        console.log(`\t- ${member.pubkey} (${member.role})`);
      });
    }
  } catch (error) {
    console.error('Error fetching project details:', error);
  }
}

async function showAllProjectsOnRelayFlow(): Promise<void> {
  const limit = await input(
    {
      message: 'Number of projects to show',
      validate: (input) => Number.isInteger(Number(input)) || 'Must be a valid integer',
      default: '10',
    },
  );

  const projects: Project[] = await getAllProjectsFromRelay(Number(limit));

  if (projects.length === 0) {
    console.log(chalk.yellow('There are no projects on the saved relays'));
    return;
  }

  projects.forEach((project) => {
    console.log(`Project Name: ${project.name}`);
    console.log(`Description: ${project.description}`);
    console.log(`Private: ${project.isPrivate ? 'Yes' : 'No'}`);
    console.log(`Last Event ID: ${project.lastEventId}`);
    console.log(`Last Time: ${formatNostrTimestamp(BigInt(project.lastEventCreatedAt))}`);


    // List project tickets
    console.log(chalk.blue('Tickets:'));
    if (project.tickets.length > 0) {
      project.tickets.forEach((ticket) => {
        console.log(`${ticket}`);
      });
    } else {
      console.log(chalk.yellow('\tNo tickets available.'));
    }

    // If the project is not private, show admin members
    if (project.isPrivate === false) {
      console.log(chalk.blue('Admin Members:'));
      const adminMembers: ProjectMember[] = project.members.filter((member: ProjectMember) => member.role === 'admin');
      console.log(adminMembers);
      if (adminMembers.length > 0) {
        adminMembers.forEach((admin: ProjectMember) => {
          console.log(`\t- ${getNpub(admin.pubkey)}`);
        });
      } else {
        console.log(chalk.yellow('\tNo admin members.'));
      }
    }
    console.log('\n');
  });
}

async function showAllTicketsInProjectFromRelayFlow(prisma: PrismaClient): Promise<void> {
  const answer = await rawlist({
    message: 'Select an action:',
    choices: [
      {
        name: 'Select Project',
        value: 'select',
      },
      {
        name: 'Import Project',
        value: 'import',
      },
      {
        name: 'Cancel',
        value: '',
      },
    ],
  });

  if (answer === '') {
    return;
  }

  let projectUuid: string = '';
  if (answer === 'select') {
    const selectedProject: string = await selectExistingLocalProject(prisma);
    if (selectedProject === '') {
      return;
    }
    projectUuid = selectedProject;
  } else if (answer === 'import') {
    const selectedProject = await input(
      {
        message: 'Nostr Project UUID:',
        validate: (input) => input.trim() !== '' || 'Project uuid is required',
      });
    projectUuid = selectedProject;
  }

  const tickets = await getAllProjectTicketsFromRelay(projectUuid);
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
    console.log('\n');
  });

  return;
}
