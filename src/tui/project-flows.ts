import { rawlist, input, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { type PrismaClient, type Project as PrismaProject } from '@prisma/client';

import { createProject } from '../services/project';
import { saveNewProject, getProjects } from '../services/prisma/project';
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
    'Switch Active Project',
    'List Local Projects',
    'Remove Local Project',
    'Show All Remote Projects',
    'Show Remote Tickets In Active Project',
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
    'Switch Active Project': async (prisma) => {
      await switchProjectsFlow(prisma);
    },
    'List Local Projects': async (prisma) => {
      await listLocalProjectsFlow(prisma);
    },
    'Remove Local Project': async () => {
      console.log(chalk.yellow('TODO: remove local project...'));
      return Promise.resolve();
    },
    'Show All Remote Projects': async () => {
      await showAllProjectsOnRelayFlow();
    },
    'Show Remote Tickets In Active Project': async (prisma) => {
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
  if (!userKeys) {
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
    userKeys.pubKey,
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

export async function listLocalProjectsFlow(prisma: PrismaClient) {
  const pubKey = userState.getPubKey();
  if (pubKey === '') {
    console.log(chalk.yellow('No pubkey found, please load userKeys'));
    return;
  }
  const projects: PrismaProject[] = await getProjects(prisma, pubKey);

  if (projects.length === 0) {
    console.log('No projects found.');
    return;
  }

  console.log(chalk.blue(`Projects ${getNpub(pubKey)} has locally saved:`));

  printPrismaProjectList(projects);

  const conf = await confirm({
    message: 'View Project Details',
    default: false,
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

export async function switchProjectsFlow(prisma: PrismaClient) {
  const pubKey = userState.getPubKey();
  if (pubKey === '') {
    console.log(chalk.yellow('No pubkey found, please load userKeys'));
  }

  const projects: PrismaProject[] = await getProjects(prisma, pubKey);

  if (projects.length === 0) {
    console.log(chalk.yellow('No projects found.'));
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

  if (selectedProject === '') {
    return;
  }

  // TODO: think about a confirm here before switching?

  userState.setActiveProject(selectedProject);
}

export async function getProjectDetails(prisma: PrismaClient, projectId: string): Promise<void> {
  try {
    // Fetch the project details, including members and tickets
    const project = await prisma.project.findUnique({
      where: { uuid: projectId },
      include: {
        members: true, // Include project members
        tickets: true, // Include project tickets
      },
    });

    if (!project) {
      console.log(chalk.yellow('Project not found.'));
      return;
    }

    console.log(`Project: ${project.name}`);
    console.log(`Description: ${project.description}`);
    console.log(`Private: ${project.is_private ? 'Yes' : 'No'}`);
    console.log(`Last Event ID: ${project.last_event_id}`);
    console.log(`Last Time: ${formatNostrTimestamp(project.last_event_created_at)}`);

    // List project tickets
    console.log('Tickets:');
    if (project.tickets.length > 0) {
      project.tickets.forEach((ticket) => {
        console.log(`\t${ticket.state}: ${ticket.title}`);
      });
    } else {
      console.log('\tNo tickets available.');
    }

    // If the project is not private, show admin members
    if (!project.is_private) {
      console.log('Admin Members:');
      const adminMembers = project.members.filter((member) => member.role === 'admin');
      if (adminMembers.length > 0) {
        adminMembers.forEach((admin) => {
          console.log(`\t- ${admin.pubkey}`);
        });
      } else {
        console.log('\tNo admin members.');
      }
    } else {
      // List project members on private projects
      console.log('Members:');
      project.members.forEach((member) => {
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
    },
  );

  const projects: Project[] = await getAllProjectsFromRelay(Number(limit));

  projects.forEach((project) => {
    const date = new Date(project.lastEventCreatedAt * 1000); // Convert milliseconds to a Date object
    // Format the date to a readable string
    console.log(`Project: ${project.name}`);
    console.log(`Description: ${project.description}`);
    console.log(`Private: ${project.isPrivate ? 'Yes' : 'No'}`);
    console.log(`Last Event ID: ${project.lastEventId}`);
    console.log(`Last Time: ${date.toLocaleString()}`);

    // List project tickets
    // console.log("Tickets:");
    // if (project.tickets.length > 0) {
    //   project.tickets.forEach((ticket) => {
    //     console.log(`${ticket}`);
    //   });
    // } else {
    //   console.log("  No tickets available.");
    // }

    // The project is not private, show admin members
    if (!project.isPrivate) {
      console.log('Admin Members:');
      const adminMembers = project.members.filter((member) => member.role === 'admin');
      if (adminMembers.length > 0) {
        adminMembers.forEach((admin) => {
          console.log(`\t- ${admin.pubKey}`);
        });
      } else {
        console.log('\tNo admin members.');
      }
    }
  });
}

async function showAllTicketsInProjectFromRelayFlow(prisma: PrismaClient): Promise<void> {
  const pubKey = userState.getPubKey();
  if (pubKey === '') {
    console.log('No pubkey found, please load userKeys');
    return;
  }
  const projects = await getProjects(prisma, pubKey);

  if (projects.length === 0) {
    console.log('No projects found.');
    return;
  }

  console.table(
    projects.map((p) => ({
      ID: p.uuid.slice(0, 8),
      Name: p.name,
    })),
  );

  const { action } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'action',
      message: 'Select an action:',
      choices: ['Select Project', 'Enter Project', 'Back to Main Menu'],
    },
  ]);

  if (action === 'Back to Main Menu') {
    console.log('Action Canceled, not looking up tickets.');
    return;
  }

  let project_uuid: string = '';

  if (action === 'Select Project') {
    const { project_uuid: selectedProjectUuid } = await inquirer.prompt([
      {
        type: 'rawlist',
        name: 'project_uuid',
        message: 'Select a project:',
        choices: projects.map((project) => ({
          name: project.name,
          value: project.uuid,
        })),
      },
    ]);
    project_uuid = selectedProjectUuid; // Assign the selected project UUID
  }

  if (action === 'Enter Project') {
    const { project_uuid: enteredProjectUuid } = await inquirer.prompt([
      {
        type: 'input',
        name: 'project_uuid',
        message: 'Input a project:',
      },
    ]);
    project_uuid = enteredProjectUuid; // Assign the entered project UUID
  }

  const tickets = await getAllProjectTicketsFromRelay(project_uuid);
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

  return;
}
