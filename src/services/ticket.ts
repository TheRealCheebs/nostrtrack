import { v4 as uuidv4 } from 'uuid';

import type { Ticket } from '../interfaces/ticket';

export function createTicket(
  projectUuid: string,
  type: string,
  title: string,
  description: string,
  creatorPubkey: string,
  parentUuid: string,
  children: string[] = [],
): Ticket {
  const uuid = uuidv4();
  const now = Date.now();
  return {
    uuid: uuid,
    projectUuid: projectUuid,
    type: type,
    title: title,
    description: description,
    state: 'unscheduled',
    parentUuid: parentUuid,
    creatorPubkey: creatorPubkey,
    createdAt: now,
    updatedAt: now,
    lastEventId: '',
    lastEventCreatedAt: now,
    childrenUuids: children,
  } as Ticket;
}
