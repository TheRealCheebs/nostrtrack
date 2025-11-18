// flows.ts
import inquirer from 'inquirer';
import { PrismaClient } from '@prisma/client';

import { createProject } from '@services/project.ts';
import { saveNewProject, getProjects, updateProject } from '@services/prisma/project.js';
import { createAndPublishPrivateProject, createAndPublishProject } from '@services/nostr/projects.js';
import { formatNostrTimestamp } from 'src/nostr/helpers';
import { getAllProjectTicketsFromRelay, getAllProjectsFromRelay } from 'src/nostr/utils';
import { userState } from '@state/user-state';

import type { Project } from '@interfaces/project';

export async function mainProjectsFlow(prisma: PrismaClient): Promise<string> {
  let projectUuid: string = "";

  const { action } = await inquirer.prompt([
    {
      type: 'rawlist',
      name: 'action',
      message: 'Project Actions:',
      choices: [
        'Create Project',
        'Import Project',
        'List Projects',
        'Switch Project',
        // TODO 'Update Project'
        // TODO: add a sync project option
        'Show All From Relay',
        'Show Tickets in Project From Relay',
        'Back to Main Menu',
      ],
    },
  ]);

  switch (action) {
    case 'Create Project':
      const created = await createProjectFlow(prisma);
      projectUuid = created ?? "";
      break;
    case 'Import Project':
      console.log('TODO: Importing project...');
      break;
    case 'List Projects':
      await listProjectsFlow(prisma);
      break;
    case 'Switch Project':
      const switched = await switchProjectsFlow(prisma);
      if (switched !== "") {
        projectUuid = switched;
      }
      break;
    case 'Show All From Relay':
      await showAllProjectsOnRelayFlow();
      break;
    case 'Show Tickets in Project From Relay':
      await showAllTicketsInProjectFromRelayFlow(prisma);
      break;
    case 'Back to Main Menu':
      break;
  }
  return projectUuid;
}

async function createProjectFlow(prisma: PrismaClient): Promise<string | null> {
  console.log('\n📋 Create New Project\n');
  const userKeys = userState.getUserKeys();
  if (!userKeys) {
    console.log('No user keys found, please load userKeys');
    return null;
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      validate: input => input.trim() !== '' || 'Project name is required'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Project description (optional):'
    },
    {
      type: 'confirm',
      name: 'isPrivate',
      message: 'Make this project private?',
      default: false
    },
    // TODO: do this better
    {
      type: 'input',
      name: 'adminUsers',
      message: 'Add users with admin roles (comma-separated public keys, optional):'
    },
    {
      type: 'input',
      name: 'memberUsers',
      message: 'Add users with read only roles, if project is private. (comma-separated public keys, optional):'
    }
  ]);

  let members: { pubkey: string, role?: string }[] = [];
  if (answers.adminUsers) {
    const admin = answers.adminUsers.split(',').map((pubkey: string) => ({ pubkey: pubkey.trim(), role: 'admin' }));
    members = members.concat(admin)
  }
  if (answers.memberUsers) {
    const users = answers.memberUsers.split(',').map((pubkey: string) => ({ pubkey: pubkey.trim(), role: 'member' }));
    members = members.concat(users)
  }

  try {
    const project = createProject(
      answers.name,
      userKeys.pubKey,
      answers.description,
      answers.isPrivate,
      members
    );

    saveNewProject(prisma, project);
    try {
      if (project.isPrivate) {
        const privateEvent = await createAndPublishPrivateProject(project, userKeys, project.members);
        project.lastEventId = privateEvent.id;
        project.lastEventCreatedAt = privateEvent.created_at;
      } else {
        const event = await createAndPublishProject(project, userKeys);
        project.lastEventId = event.id;
        project.lastEventCreatedAt = event.created_at;
      }
      updateProject(prisma, project);
    } catch (relayError) {
      console.warn(" Failed to send project to relay:", relayError)
    }
    console.log(`\n✅ Project created successfully!`);
    console.log(`   UUID: ${project.uuid}`);
    return project.uuid;
  } catch (error) {
    console.error('\n❌ Failed to create project:', error);
  }
  return null
}

export async function listProjectsFlow(prisma: PrismaClient) {
  console.log('\n📂 Projects\n');

  const pubKey = userState.getPubKey();
  if (pubKey === "") {
    console.log('No pubkey found, please load userKeys');
    return;
  }
  const projects = await getProjects(prisma, pubKey);

  if (projects.length === 0) {
    console.log('No projects found.');
    return;
  }

  console.table(projects.map(p => ({
    ID: p.uuid.slice(0, 8),
    Name: p.name,
    Private: p.is_private ? 'Yes' : 'No'
  })));

  const { action } = await inquirer.prompt([{
    type: 'rawlist',
    name: 'action',
    message: 'Select an action:',
    choices: [
      'View Details',
      'Back to Main Menu'
    ]
  }]);

  if (action === 'View Details') {
    const { project_uuid } = await inquirer.prompt([{
      type: 'rawlist',
      name: 'project_uuid',
      message: 'Select a project:',
      choices: projects.map((project) => ({
        name: project.name,
        value: project.uuid,
      })),
    },
    ]);

    await getProjectDetails(prisma, project_uuid);
  }
}

export async function switchProjectsFlow(prisma: PrismaClient): Promise<string> {
  console.log('\n📂 Projects\n');
  const pubKey = userState.getPubKey();
  if (pubKey === "") {
    console.log('No pubkey found, please load userKeys');
    return "";
  }

  const projects = await getProjects(prisma, pubKey);

  if (projects.length === 0) {
    console.log('No projects found.');
    return "";
  }

  console.table(projects.map(p => ({
    ID: p.uuid.slice(0, 8),
    Name: p.name,
    Private: p.is_private ? 'Yes' : 'No'
  })));

  const { action } = await inquirer.prompt([{
    type: 'rawlist',
    name: 'action',
    message: 'Select an action:',
    choices: [
      'Select Project',
      'Back to Main Menu'
    ]
  }]);

  if (action === 'Back to Main Menu') {
    console.log('Action Canceled, not switching.');
    return "";
  }

  const { project_uuid } = await inquirer.prompt([{
    type: 'rawlist',
    name: 'project_uuid',
    message: 'Select a project:',
    choices: projects.map((project) => ({
      name: project.name,
      value: project.uuid,
    })),
  },
  ]);
  return project_uuid;
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
      console.log("Project not found.");
      return;
    }

    console.log(`Project: ${project.name}`);
    console.log(`Description: ${project.description}`);
    console.log(`Private: ${project.is_private ? "Yes" : "No"}`);
    console.log(`Last Event ID: ${project.last_event_id}`);
    console.log(`Last Time: ${formatNostrTimestamp(project.last_event_created_at)}`);

    // List project tickets
    console.log("Tickets:");
    if (project.tickets.length > 0) {
      project.tickets.forEach((ticket) => {
        console.log(`  ${ticket.state}: ${ticket.title}`);
      });
    } else {
      console.log("  No tickets available.");
    }


    // If the project is not private, show admin members
    if (!project.is_private) {
      console.log("Admin Members:");
      const adminMembers = project.members.filter((member) => member.role === "admin");
      if (adminMembers.length > 0) {
        adminMembers.forEach((admin) => {
          console.log(`  - ${admin.pubkey}`);
        });
      } else {
        console.log("  No admin members.");
      }
    } else {
      // List project members on private projects
      console.log("Members:");
      project.members.forEach((member) => {
        console.log(`  - ${member.pubkey} (${member.role})`);
      });
    }
  } catch (error) {
    console.error("Error fetching project details:", error);
  }
}

async function showAllProjectsOnRelayFlow(): Promise<void> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'limit',
      message: 'Number of projects to show'
    }
  ]);

  const projects: Project[] = await getAllProjectsFromRelay(answers.limit);

  projects.forEach((project) => {
    const date = new Date(project.lastEventCreatedAt * 1000); // Convert milliseconds to a Date object
    // Format the date to a readable string
    console.log(`Project: ${project.name}`);
    console.log(`Description: ${project.description}`);
    console.log(`Private: ${project.isPrivate ? "Yes" : "No"}`);
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
      console.log("Admin Members:");
      const adminMembers = project.members.filter((member) => member.role === "admin");
      if (adminMembers.length > 0) {
        adminMembers.forEach((admin) => {
          console.log(`  - ${admin.pubKey}`);
        });
      } else {
        console.log("  No admin members.");
      }
    }
  });
}

async function showAllTicketsInProjectFromRelayFlow(prisma: PrismaClient): Promise<void> {
  const pubKey = userState.getPubKey();
  if (pubKey === "") {
    console.log('No pubkey found, please load userKeys');
    return;
  }
  const projects = await getProjects(prisma, pubKey);

  if (projects.length === 0) {
    console.log('No projects found.');
    return;
  }

  console.table(projects.map(p => ({
    ID: p.uuid.slice(0, 8),
    Name: p.name,
  })));

  const { action } = await inquirer.prompt([{
    type: 'rawlist',
    name: 'action',
    message: 'Select an action:',
    choices: [
      'Select Project',
      'Enter Project',
      'Back to Main Menu'
    ]
  }]);

  if (action === 'Back to Main Menu') {
    console.log('Action Canceled, not looking up tickets.');
    return;
  }

  let project_uuid: string = "";

  if (action === 'Select Project') {
    const { project_uuid: selectedProjectUuid } = await inquirer.prompt([{
      type: 'rawlist',
      name: 'project_uuid',
      message: 'Select a project:',
      choices: projects.map((project) => ({
        name: project.name,
        value: project.uuid,
      })),
    }]);
    project_uuid = selectedProjectUuid; // Assign the selected project UUID
  }

  if (action === 'Enter Project') {
    const { project_uuid: enteredProjectUuid } = await inquirer.prompt([{
      type: 'input',
      name: 'project_uuid',
      message: 'Input a project:',
    }]);
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
