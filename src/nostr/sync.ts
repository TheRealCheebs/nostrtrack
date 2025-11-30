import { SimplePool } from 'nostr-tools';
import type { Event } from 'nostr-tools/lib/types';
import type { SubCloser } from 'nostr-tools/lib/types/abstract-pool';
import { NOSTR_GIFT_WRAP_KIND, NOSTR_PROJECT_KIND, NOSTR_TICKET_KIND } from '../constants';
import { nostrEventToProject, getPrivateProject } from '../services/nostr/projects';
import { nostrEventToTicket, getPrivateTicket } from '../services/nostr/ticket';
import type { Project } from '../interfaces/project';
import type { Ticket } from '../interfaces/ticket';
import type { UserKeys } from '../interfaces/identity';


export type Subscription = {
  id: string;
  sub: SubCloser;
};

const subscriptions = new Map<string, Subscription>();

// Add a subscription to the map
export function addSubscription(subscription: Subscription): boolean {
  if (subscriptions.has(subscription.id)) {
    console.warn(`Subscription with ID ${subscription.id} already exists.`);
    return false; // Return false if the subscription already exists
  }

  subscriptions.set(subscription.id, subscription);
  console.log(`Subscription with ID ${subscription.id} added.`);
  return true; // Return true if the subscription was successfully added
}

// Remove a subscription from the map
function removeSubscription(subscriptionId: string): boolean {
  if (!subscriptions.has(subscriptionId)) {
    console.warn(`Subscription with ID ${subscriptionId} does not exist.`);
    return false; // Return false if the subscription does not exist
  }

  const subscription = subscriptions.get(subscriptionId);
  subscription?.sub.close(); // Call the unsubscribe function
  subscriptions.delete(subscriptionId);
  console.log(`Subscription with ID ${subscriptionId} removed.`);
  return true; // Return true if the subscription was successfully removed
}
export function closeAllSubscriptions() {
  subscriptions.forEach(sub => {
    sub.sub.close();
  });
}

// TODO: add something here so we don't export addSubscription
//export function subscribeToAllKnown() {
//}

// Helper to extract tag values from a Nostr event
export function getTagValue(event: Event, tag: string): string[] {
  return event.tags
    .filter(t => t[0] === tag && typeof t[1] === 'string')
    .map(t => t[1] as string);
}

/**
 * Subscribe to project updates
 *
 * @param relays - Array of relay URLs
 * @param projectUuid - The project UUID to watch
 * @param lastSyncTime - Timestamp for incremental sync
 * @param onProjectEvent - Callback for project events
 * @returns SubCloser (subscription object)
 */
export function subscribeToPrivateProjectUpdates(
  relays: string[],
  projectUuid: string,
  lastSyncTime: number | null,
  userKeys: UserKeys,
  onProjectEvent: (project: Project) => void,
  onTicketUpdate: (ticket: Ticket) => void,
): SubCloser {
  const filter = {
    kinds: [NOSTR_GIFT_WRAP_KIND],
    ['#project-uuid']: [projectUuid],
    ['#type']: ['project'],
    ['#p']: [userKeys.pubKey],
    since: lastSyncTime || Math.floor(Date.now() / 1000)
  };

  async function handleProjectEvent(event: Event) {
    const privateProject = await getPrivateProject(event, userKeys);
    onProjectEvent(privateProject);

    // Check for updated ticket/member tags
    const updatedProperty = getTagValue(event, 'property');
    const updatedEvent = getTagValue(event, 'updated');

    // If the event references an updated ticket, fetch it from Nostr and emit via callback
    if (updatedEvent.length) {
      const ticketUuid = updatedEvent[0]!;
      if (updatedProperty.includes('add-ticket')) {
        const sc: SubCloser = subscribeToPrivateTicketUpdates(
          relays,
          projectUuid,
          ticketUuid,
          lastSyncTime,
          userKeys,
          onTicketUpdate,
        );
        const sub: Subscription = {
          id: ticketUuid,
          sub: sc,
        };
        addSubscription(sub);
      } else if (updatedProperty.includes('remove-ticket')) {
        removeSubscription(ticketUuid);
      }
    }
  }

  return new SimplePool().subscribeMany(
    relays,
    filter,
    {
      onevent: (event: Event) => { void handleProjectEvent(event); },
      onclose: (reasons: any) => console.log('Subscription closed:', reasons)
    }
  );
}


/**
 * Subscribe to project updates and emit ticket updates via callback.
 *
 * @param relays - Array of relay URLs
 * @param projectUuid - The project UUID to watch
 * @param lastSyncTime - Timestamp for incremental sync
 * @param onProjectEvent - Callback for project events
 * @param onTicketUpdate - Callback for ticket update events
 * @returns SubCloser (subscription object)
 */
export function subscribeToProjectUpdates(
  relays: string[],
  projectUuid: string,
  lastSyncTime: number | null,
  onProjectEvent: (project: Project) => void,
  onTicketUpdate: (ticket: Ticket) => void,
): SubCloser {
  const filter = {
    kinds: [NOSTR_PROJECT_KIND],
    '#project-uuid': [projectUuid],
    since: lastSyncTime || Math.floor(Date.now() / 1000)
  };

  async function handleProjectEvent(event: Event) {
    const projectUpdate = nostrEventToProject(event);
    onProjectEvent(projectUpdate);

    // need to check if the project has added / removed a ticket.
    // if so subscribet to that ticket events.
    //
    // Check for updated ticket/member tags
    const updatedProperty = getTagValue(event, 'property');
    const updatedEvent = getTagValue(event, 'updated');

    if (updatedEvent.length) {
      const ticketUuid = updatedEvent[0]!;
      if (updatedProperty.includes('add-ticket')) {
        const sc: SubCloser = subscribeToTicketUpdates(
          relays,
          projectUuid,
          ticketUuid,
          lastSyncTime,
          onTicketUpdate,
        );
        const sub: Subscription = {
          id: ticketUuid,
          sub: sc,
        };
        addSubscription(sub);
      } else if (updatedProperty.includes('remove-ticket')) {
        removeSubscription(ticketUuid);
      }
    }
  }

  return new SimplePool().subscribeMany(
    relays,
    filter,
    {
      onevent: (event: Event) => { void handleProjectEvent(event); },
      onclose: (reasons: any) => console.log('Subscription closed:', reasons)
    }
  );
}

/**
 * Subscribe to ticket updates
 *
 * @param relays - Array of relay URLs
 * @param projectUuid - The project UUID to watch
 * @param lastSyncTime - Timestamp for incremental sync
 * @param onProjectEvent - Callback for project events
 * @returns SubCloser (subscription object)
 */
export function subscribeToPrivateTicketUpdates(
  relays: string[],
  projectUuid: string,
  ticketUuid: string,
  lastSyncTime: number | null,
  userKeys: UserKeys,
  onTicketEvent: (ticket: Ticket) => void,
): SubCloser {
  const filter = {
    kinds: [NOSTR_GIFT_WRAP_KIND],
    ['#project-uuid']: [projectUuid],
    ['#ticket-uuid']: [ticketUuid],
    ['#type']: ['ticket'],
    ['#p']: [userKeys.pubKey],
    since: lastSyncTime || Math.floor(Date.now() / 1000)
  };

  async function handleTicketEvent(event: Event) {
    const privateTicket = await getPrivateTicket(event, userKeys);
    onTicketEvent(privateTicket);
  }

  return new SimplePool().subscribeMany(
    relays,
    filter,
    {
      onevent: (event: Event) => { void handleTicketEvent(event); },
      onclose: (reasons: any) => console.log('Subscription closed:', reasons)
    }
  );
}

/**
 * Subscribe to ticket updates and emit ticket updates via callback.
 *
 * @param relays - Array of relay URLs
 * @param ticketUuid - The ticket UUID to watch
 * @param lastSyncTime - Timestamp for incremental sync
 * @param onTicketUpdate - Callback for ticket update events
 * @returns SubCloser (subscription object)
 */
export function subscribeToTicketUpdates(
  relays: string[],
  projectUuid: string,
  ticketUuid: string,
  lastSyncTime: number | null,
  onTicketUpdate: (ticket: Ticket) => void,
): SubCloser {
  const filter = {
    kinds: [NOSTR_TICKET_KIND],
    '#project-uuid': [projectUuid],
    '#d': [ticketUuid],
    since: lastSyncTime || Math.floor(Date.now() / 1000)
  };

  async function handleTicketEvent(event: Event) {
    const ticketUpdate = nostrEventToTicket(event);
    onTicketUpdate(ticketUpdate);
  }

  return new SimplePool().subscribeMany(
    relays,
    filter,
    {
      onevent: (event: Event) => { void handleTicketEvent(event); },
      onclose: (reasons: any) => console.log('Subscription closed:', reasons)
    }
  );
}
