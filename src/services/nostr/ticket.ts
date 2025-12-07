import { nip44, finalizeEvent } from 'nostr-tools';
import { randomBytes } from '@noble/hashes/utils';
import type { NostrEvent, EventTemplate } from 'nostr-tools';

import { NOSTR_GIFT_WRAP_KIND, NOSTR_TICKET_KIND } from '../../constants';
import { publishToRelays } from '../../nostr/utils';
import type { Ticket } from '../../interfaces/ticket';
import type { ProjectMember } from '../../interfaces/project';
import type { UserKeys } from '../../interfaces/identity';

export async function createAndPublishPrivateTicket(
  ticket: Ticket,
  userKeys: UserKeys,
  projectMembers: ProjectMember[],
): Promise<NostrEvent> {
  // Create a rumor (NIP-17)
  const rumor = finalizeEvent(
    {
      kind: NOSTR_TICKET_KIND,
      created_at: Math.floor(Date.now() / 1000),
      content: JSON.stringify(ticket),
      tags: [
        ['d', ticket.uuid],
        ['project-uuid', ticket.projectUuid],
        ['private', 'true'],
      ],
    },
    userKeys.privateKey,
  );

  // Create gift wraps for each member
  const wraps = [];
  for (const member of projectMembers) {
    const converKey = nip44.getConversationKey(userKeys.privateKey, member.pubKey); // Ensure conversation key exists
    const nonce = randomBytes(24); // 24 random bytes
    const wrap = finalizeEvent(
      {
        kind: NOSTR_GIFT_WRAP_KIND,
        created_at: Math.floor(Date.now() / 1000),
        content: nip44.encrypt(JSON.stringify(rumor), converKey, nonce),
        tags: [
          ['p', member.pubKey],
          ['project-uuid', ticket.projectUuid],
          ['type', 'ticket'],
        ],
      },
      userKeys.privateKey,
    );
    wraps.push(wrap);
  }

  // Publish all wraps
  for (const wrap of wraps) {
    await publishToRelays(wrap);
  }

  return rumor;
}

export async function createAndPublishTicket(
  ticket: Ticket,
  userKeys: UserKeys,
): Promise<NostrEvent> {
  const eventTemplate: EventTemplate = {
    kind: NOSTR_TICKET_KIND,
    created_at: Math.floor(Date.now() / 1000),
    content: JSON.stringify(ticket),
    tags: [
      ['d', ticket.uuid],
      ['project-uuid', ticket.projectUuid],
      ['private', 'false'],
    ],
  };

  const signed = finalizeEvent(eventTemplate, userKeys.privateKey);
  await publishToRelays(signed);
  return signed;
}

export async function updateAndPublishTicket(
  ticket: Ticket,
  userKeys: UserKeys,
): Promise<NostrEvent> {
  const eventTemplate: EventTemplate = {
    kind: NOSTR_TICKET_KIND,
    created_at: Math.floor(Date.now() / 1000),
    content: JSON.stringify(ticket),
    tags: [
      ['d', ticket.uuid],
      ['project-uuid', ticket.projectUuid],
      ['private', 'false'],
      ['e', ticket.lastEventId],
    ],
  };

  const signed = finalizeEvent(eventTemplate, userKeys.privateKey);
  await publishToRelays(signed);
  return signed;
}

export async function deleteTicket(
  ticketEventId: string,
  userKeys: UserKeys,
  reason: string = 'Deleted by user',
): Promise<NostrEvent> {
  try {
    // Step 1: Create the deletion event
    const deletionEvent = finalizeEvent(
      {
        kind: 5, // Kind 5 is the standard for deletion events
        created_at: Math.floor(Date.now() / 1000),
        content: reason, // Optional reason for deletion
        tags: [['e', ticketEventId]], // Reference the event to delete
      },
      userKeys.privateKey,
    );

    // Step 2: Publish the deletion event to the Nostr relays
    await publishToRelays(deletionEvent);

    console.log('Ticket deleted successfully:', deletionEvent.id);
    return deletionEvent;
  } catch (error) {
    console.error('Failed to delete ticket:', error);
    throw error;
  }
}

export function nostrEventToTicket(event: NostrEvent): Ticket {
  const parsedContent = JSON.parse(event.content) as Partial<Ticket>;

  const ticket: Ticket = {
    uuid: parsedContent.uuid || '',
    projectUuid: parsedContent.projectUuid || '',
    title: parsedContent.title || '',
    type: parsedContent.type || '',
    description: parsedContent.description || '',
    state: parsedContent.state || '',
    parentUuid: parsedContent.parentUuid || '',
    creatorPubkey: parsedContent.creatorPubkey || '',
    createdAt: parsedContent.createdAt || 0,
    updatedAt: parsedContent.updatedAt || 0,
    lastEventId: event.id,
    lastEventCreatedAt: event.created_at,
    childrenUuids: parsedContent.childrenUuids || [],
  };

  return ticket;
}

export function getPrivateTicket(rumorEvent: NostrEvent, userKeys: UserKeys): Ticket {
  // Extract the encrypted content and nonce from the rumor
  const encryptedContent = rumorEvent.content;
  const conversationKey = nip44.getConversationKey(userKeys.privateKey, rumorEvent.pubkey);

  // Decrypt the rumor content
  const decryptedContent = nip44.decrypt(encryptedContent, conversationKey);

  // Parse the decrypted content

  const parsedContent = JSON.parse(decryptedContent) as Partial<Ticket>;
  // Validate and transform the parsed content if necessary
  const ticket: Ticket = {
    uuid: parsedContent.uuid || '',
    projectUuid: parsedContent.projectUuid || '',
    title: parsedContent.title || '',
    type: parsedContent.type || '',
    description: parsedContent.description || '',
    state: parsedContent.state || '',
    parentUuid: parsedContent.parentUuid || '',
    creatorPubkey: parsedContent.creatorPubkey || '',
    createdAt: parsedContent.createdAt || 0,
    updatedAt: parsedContent.updatedAt || 0,
    lastEventId: rumorEvent.id,
    lastEventCreatedAt: rumorEvent.created_at,
    childrenUuids: parsedContent.childrenUuids || [],
  };

  return ticket;
}
