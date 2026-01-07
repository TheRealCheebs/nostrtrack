import {
  type PrismaClient,
  type Project as PrismaProject,
  type ProjectMember as PrismaProjectMember,
} from '@prisma/client';

import type { Project, ProjectMember } from '../../interfaces/project';
import { NullablePrismaProjectWithDetails, PrismaProjectWithDetails } from '../../types/project';

export async function saveNewProject(
  prisma: PrismaClient,
  project: Project,
): Promise<PrismaProject> {
  // lastEventId and lastEventCreatedAt should be null on new events
  // tickets will also be empty on a brand new project.
  const { uuid, name, description, isPrivate, lastEventId, createdAt, members } = project;

  return await prisma.project.create({
    data: {
      uuid,
      name,
      description,
      is_private: isPrivate,
      created_at: createdAt,
      last_event_id: lastEventId,
      last_event_created_at: createdAt,
      members: {
        create: members.map((member: ProjectMember) => ({
          pubkey: member.pubkey,
          role: member.role,
          created_at: member.createdAt,
        })),
      },
    },
  });
}

export async function removeProject(
  prisma: PrismaClient,
  projectUuid: string,
) {
  return await prisma.project.delete({
    where: {
      uuid: projectUuid,
    }
  });
}

export async function getProjectsWithDetails(prisma: PrismaClient, pubkey: string): Promise<NullablePrismaProjectWithDetails[]> {
  return await prisma.project.findMany({
    where: {
      OR: [
        {
          members: {
            some: {
              pubkey: pubkey, // pubkey needs to be a member
            },
          },
        },
        {
          is_private: false, // or the project is public and it's been loaded
        },
      ],
    },
    orderBy: { created_at: 'desc' },
    include: {
      members: true, // Include project members
      tickets: true, // Include tickets
    },
  });
}

export async function getProjects(prisma: PrismaClient, pubkey: string): Promise<PrismaProject[]> {
  return await prisma.project.findMany({
    where: {
      OR: [
        {
          members: {
            some: {
              pubkey: pubkey, // pubkey needs to be a member
            },
          },
        },
        {
          is_private: false, // or the project is public and it's been loaded
        },
      ],
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getTicketUuidsByProjectUuid(
  prisma: PrismaClient,
  projectUuid: string,
): Promise<string[]> {
  try {
    // Fetch the project with its tickets
    const project = await prisma.project.findUnique({
      where: { uuid: projectUuid },
      include: {
        tickets: {
          select: {
            uuid: true, // Only fetch the UUIDs of the tickets
          },
        },
      },
    });

    // If the project doesn't exist, return an empty array
    if (!project) {
      console.warn(`Project with UUID ${projectUuid} not found.`);
      return [];
    }

    // Map the tickets to extract their UUIDs
    return project.tickets.map((ticket) => ticket.uuid);
  } catch (error) {
    console.error('Error fetching ticket UUIDs:', error);
    throw error; // Rethrow the error to handle it at a higher level
  }
}

export async function getProjectById(
  prisma: PrismaClient,
  uuid: string,
): Promise<NullablePrismaProjectWithDetails> {
  return await prisma.project.findUnique({
    where: { uuid },
    include: {
      members: true, // Include project members
      tickets: true, // Include tickets
    },
  });
}

export async function deleteProject(prisma: PrismaClient, uuid: string): Promise<void> {
  await prisma.project.delete({
    where: { uuid },
  });
}

export async function updateProjectNostrEvent(
  prisma: PrismaClient,
  uuid: string,
  eventId: string,
  eventCreated: number,
): Promise<void> {
  try {
    await prisma.project.update({
      where: { uuid },
      data: {
        last_event_id: eventId,
        last_event_created_at: BigInt(eventCreated),
      },
    });
    console.log(`Projcet ${uuid} updated successfully after Nostr push.`);
  } catch (error) {
    console.error(`Failed to update project ${uuid}:`, error);
    throw error;
  }
}
export async function addNewTicketToProject(
  prisma: PrismaClient,
  projectUuid: string,
  ticketUuid: string,
): Promise<void> {
  try {
    // Ensure the project exists
    const project = await prisma.project.findUnique({
      where: { uuid: projectUuid },
    });

    if (!project) {
      throw new Error(`Project with UUID ${projectUuid} does not exist.`);
    }

    // Ensure the ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { uuid: ticketUuid },
    });

    if (!ticket) {
      throw new Error(`Ticket with UUID ${ticketUuid} does not exist.`);
    }

    // Update the project to connect the ticket
    await prisma.project.update({
      where: { uuid: projectUuid },
      data: {
        tickets: {
          connect: [{ uuid: ticketUuid }],
        },
      },
    });

    console.log(`Ticket ${ticketUuid} added successfully to project ${projectUuid}.`);
  } catch (error) {
    console.error(`Failed to add ticket ${ticketUuid} to project ${projectUuid}:`, error);
    throw error;
  }
}

export async function removeTicketFromProject(
  prisma: PrismaClient,
  projectUuid: string,
  ticketUuid: string,
): Promise<void> {
  try {
    await prisma.project.update({
      where: { uuid: projectUuid },
      data: {
        tickets: {
          disconnect: [{ uuid: ticketUuid }], // Disconnect the ticket from the project
        },
      },
    });

    console.log(`Ticket ${ticketUuid} removed successfully from project ${projectUuid}.`);
  } catch (error) {
    console.error(`Failed to remove ticket ${ticketUuid} from project ${projectUuid}:`, error);
    throw error;
  }
}

export async function updateProject(prisma: PrismaClient, project: Project): Promise<void> {
  const {
    uuid,
    name,
    description,
    isPrivate,
    createdAt,
    lastEventId,
    lastEventCreatedAt,
    members,
    tickets,
  } = project;

  // TODO: make sure all of the ticket uuids passed in are valid before doing
  // the set on the ticket mapping. (they need to exist in the database.)

  await prisma.project.update({
    where: { uuid },
    data: {
      name,
      description,
      is_private: isPrivate,
      created_at: createdAt,
      last_event_id: lastEventId,
      last_event_created_at: lastEventCreatedAt,
      members: {
        deleteMany: {}, // Remove all existing members
        create: members.map((member) => ({
          pubkey: member.pubkey,
          role: member.role,
          created_at: member.createdAt,
        })),
      },
      tickets: {
        set: tickets.map((ticketUuid) => ({ uuid: ticketUuid })), // Update ticket relationships
      },
    },
  });
}
