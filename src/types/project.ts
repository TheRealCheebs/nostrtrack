import {
  type Project as PrismaProject,
  type ProjectMember as PrismaProjectMember,
  type Ticket as PrismaTicket,
} from '@prisma/client';

export type PrismaProjectWithDetails = PrismaProject & {
  members: PrismaProjectMember[];
  tickets: PrismaTicket[];
};

export type NullablePrismaProjectWithDetails = PrismaProjectWithDetails | null;

