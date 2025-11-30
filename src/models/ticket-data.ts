import type { Ticket as PrismaTicket } from '@prisma/client';


// Domain model for app logic and Nostr payloads
export interface TicketData {
  uuid: string;
  project_uuid: string;
  type: string;
  title: string;
  description: string;
  state: string;
  parent_uuid: string | null;
  owner_pubkey: string;
  created_at: number;
  updated_at: number;
  last_event_created_at: number;
  last_event_id: string;
  children_uuids: string[]; // list of child ticket UUIDs
}

// Mapping functions between PrismaTicket and TicketData
export function prismaTicketToData(ticket: PrismaTicket): TicketData {
  const childrenUuids = ticket.children_uuids as string[];
  return {
    uuid: ticket.uuid,
    project_uuid: ticket.project_uuid,
    type: ticket.type,
    title: ticket.title,
    description: ticket.description,
    state: ticket.state,
    parent_uuid: ticket.parent_uuid ?? null,
    owner_pubkey: ticket.creator_pubkey,
    created_at: Number(ticket.created_at),
    updated_at: Number(ticket.updated_at),
    last_event_id: ticket.last_event_id,
    last_event_created_at: Number(ticket.last_event_created_at),
    children_uuids: childrenUuids
  };
}

export function ticketDataToPrisma(data: TicketData): PrismaTicket {
  return {
    uuid: data.uuid,
    project_uuid: data.project_uuid,
    type: data.type,
    title: data.title,
    state: data.state,
    description: data.description,
    parent_uuid: data.parent_uuid,
    creator_pubkey: data.owner_pubkey,
    created_at: BigInt(data.created_at),
    updated_at: BigInt(data.updated_at),
    last_event_id: data.last_event_id,
    last_event_created_at: BigInt(data.last_event_created_at),
    children_uuids: data.children_uuids
  };
}

