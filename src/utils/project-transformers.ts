import { Project } from '../interfaces/project';
import { NostrEvent } from '../types/nostr';
import { PrismaProjectWithDetails } from '../types/project';
import { type Ticket as PrismaTicket, type ProjectMember as PrismaProjectMember } from '@prisma/client';

export function nostrToProject(nostrEvent: NostrEvent): Project {
  return {
    uuid: nostrEvent.id,
    name: nostrEvent.tags.find(tag => tag[0] === 'name')?.[1] || 'Unknown',
    updated: new Date(Number(nostrEvent.created_at) * 1000).toISOString(),
    private: nostrEvent.tags.some(tag => tag[0] === 'private' && tag[1] === 'true'),
  };
}

function prismaToProjectMember(prismaMember: PrismaProjectMember): ProjectMember {
  return {
    projectId: prismaMember.project_uuid,
    pubkey: prismaMember.pubkey,
    role: prismaMember.role,
    createdAt: Number(prismaMember.created_at),
  };
}

export function prismaToProject(prismaProject: PrismaProjectWithDetails): Project {
  return {
    uuid: prismaProject.uuid,
    name: prismaProject.name,
    description: prismaProject.description,
    isPrivate: prismaProject.is_private,
    createdAt: Number(prismaProject.created_at),
    lastEventId: prismaProject.last_event_id,
    lastEventCreatedAt: Number(prismaProject.last_event_created_at),
    members: prismaProject.members.map(prismaToProjectMember),
    tickets: prismaProject.tickets.map((ticket) => ticket.uuid),
  };
}
