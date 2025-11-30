import { PrismaClient } from '@prisma/client';
import { subscribeToProjectUpdates, subscribeToPrivateProjectUpdates, addSubscription, subscribeToPrivateTicketUpdates, subscribeToTicketUpdates } from '../../nostr/sync';
import { updateProject, getTicketUuidsByProjectUuid } from '../../services/prisma/project';
import { updateTicket } from '../../services/prisma/ticket';
import { getUserProjects } from '../../services/prisma/identity';

import type { SubCloser } from 'nostr-tools/lib/types/abstract-pool';
import type { Subscription } from '../../nostr/sync';
import type { UserKeys } from '../../interfaces/identity';

export async function subscribeAllForUser(prisma: PrismaClient, userKeys: UserKeys, relays: string[]): Promise<void> {
  // use the list projects to iterate through and subscribe to all current projects
  const projects = await getUserProjects(prisma, userKeys.pubKey);
  for (const [projectUuid, isPrivate] of projects) {
    if (isPrivate) {
      const ppsc: SubCloser = subscribeToPrivateProjectUpdates(
        relays,
        projectUuid,
        Date.now(),
        userKeys,
        (projectEvent) => {
          updateProject(prisma, projectEvent);
        },
        (ticketEvent) => {
          updateTicket(prisma, ticketEvent);
        },
      );
      const ppsub: Subscription = {
        id: projectUuid,
        sub: ppsc,
      }
      addSubscription(ppsub);
    }
    else {
      const psc: SubCloser = subscribeToProjectUpdates(
        relays,
        projectUuid,
        Date.now(),
        (projectEvent) => {
          updateProject(prisma, projectEvent);
        },
        (ticketEvent) => {
          updateTicket(prisma, ticketEvent);
        },
      );
      const psub: Subscription = {
        id: projectUuid,
        sub: psc,
      }
      addSubscription(psub);
    }

    const allTickets = await getTicketUuidsByProjectUuid(prisma, projectUuid);
    allTickets.forEach(ticketUuid => {
      if (isPrivate) {
        const ptsc: SubCloser = subscribeToPrivateTicketUpdates(
          relays,
          projectUuid,
          ticketUuid,
          Date.now(),
          userKeys,
          (ticketEvent) => {
            updateTicket(prisma, ticketEvent);
          },
        );
        const ptsub: Subscription = {
          id: projectUuid,
          sub: ptsc,
        }
        addSubscription(ptsub);
      } else {
        const tsc: SubCloser = subscribeToTicketUpdates(
          relays,
          projectUuid,
          ticketUuid,
          Date.now(),
          (ticketEvent) => {
            updateTicket(prisma, ticketEvent);
          },
        );
        const tsub: Subscription = {
          id: projectUuid,
          sub: tsc,
        }
        addSubscription(tsub);
      }
    })
  }
}
