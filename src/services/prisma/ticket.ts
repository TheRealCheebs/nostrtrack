import { type PrismaClient, type Ticket as PrismaTicket } from '@prisma/client';

import type { Ticket } from '../../interfaces/ticket';

async function syncWithRelay() {
  //just a stub
}

export async function saveNewTicket(prisma: PrismaClient, ticket: Ticket): Promise<PrismaTicket> {
  const {
    uuid,
    projectUuid,
    title,
    type,
    description,
    state,
    parentUuid,
    creatorPubkey,
    createdAt,
    childrenUuids,
  } = ticket;

  return await prisma.ticket.create({
    data: {
      uuid,
      project_uuid: projectUuid,
      type,
      title,
      description,
      state,
      parent_uuid: parentUuid === '' ? null : parentUuid,
      children_uuids: JSON.stringify(childrenUuids),
      creator_pubkey: creatorPubkey,
      created_at: createdAt,
      updated_at: createdAt,
      last_event_id: '',
      last_event_created_at: createdAt,
    },
  });
}

export async function getTickets(
  prisma: PrismaClient,
  filter?: { state?: string; projectUuid?: string },
): Promise<PrismaTicket[]> {
  await syncWithRelay();
  const prismaTickets = await prisma.ticket.findMany({
    where: filter?.state ? { state: filter.state } : {},
    orderBy: { created_at: 'desc' },
  });
  return prismaTickets;
}

export async function updateTicketState(
  prisma: PrismaClient,
  uuid: string,
  state: string,
): Promise<boolean> {
  const now = Date.now();
  const result = await prisma.ticket.updateMany({
    where: { uuid },
    data: { state, updated_at: now },
  });
  return result.count > 0;
}

export async function updateTicketNostrEvent(
  prisma: PrismaClient,
  uuid: string,
  eventId: string,
  eventCreated: number,
): Promise<void> {
  try {
    await prisma.ticket.update({
      where: { uuid },
      data: {
        last_event_id: eventId,
        last_event_created_at: BigInt(eventCreated),
        updated_at: BigInt(eventCreated),
      },
    });
    console.log(`Ticket ${uuid} updated successfully after Nostr push.`);
  } catch (error) {
    console.error(`Failed to update ticket ${uuid}:`, error);
    throw error;
  }
}

export async function updateTicket(prisma: PrismaClient, ticket: Ticket): Promise<boolean> {
  const {
    uuid,
    type,
    title,
    description,
    state,
    parentUuid,
    updatedAt,
    lastEventId,
    lastEventCreatedAt,
    childrenUuids,
  } = ticket;

  const transaction = [];

  // note: connect adds new references without impacting existing ones
  // disconnect removes references
  // set replaces all existing references with a new set.
  transaction.push(
    prisma.ticket.update({
      where: { uuid },
      data: {
        type,
        title,
        description,
        state,
        parent_uuid: parentUuid,
        updated_at: updatedAt,
        last_event_id: lastEventId,
        last_event_created_at: lastEventCreatedAt,
        children: {
          set: childrenUuids.map((childId) => ({ uuid: childId })),
        },
      },
    }),
  );

  // updates.children.forEach(childId => {
  //   transaction.push(
  //     prisma.ticket.update({
  //       where: { uuid: childId },
  //       data: {
  //         referencesFrom: {
  //           connect: { uuid: uuid },
  //         },
  //       },
  //     })
  //   );
  // });
  //}
  // Execute the transaction
  try {
    await prisma.$transaction(transaction);
    return true;
  } catch (error) {
    console.error('Error updating ticket:', error);
    return false;
  }
}

export async function deleteTicket(prisma: PrismaClient, uuid: string): Promise<boolean> {
  const result = await prisma.ticket.deleteMany({ where: { uuid } });
  return result.count > 0;
}
