import { nip44, finalizeEvent } from 'nostr-tools';
import { randomBytes } from '@noble/hashes/utils';
import { NOSTR_GIFT_WRAP_KIND, NOSTR_PROJECT_KIND } from '../../constants'
import { publishToRelays } from '../../nostr/utils';

import type { Project, ProjectMember } from '../../interfaces/project';
import type { UserKeys } from '../../interfaces/identity';
import type { NostrEvent, EventTemplate } from 'nostr-tools';

export async function createAndPublishPrivateProject(
  project: Project,
  userKeys: UserKeys,
  projectMembers: ProjectMember[]
): Promise<NostrEvent> {

  // Create a rumor (NIP-17)
  const rumor = finalizeEvent({
    kind: NOSTR_PROJECT_KIND,
    created_at: Math.floor(Date.now() / 1000),
    content: JSON.stringify(project),
    tags: [
      ['d', project.uuid],
      ['name', project.name],
      ['private', 'true'],
    ]
  }, userKeys.privateKey);

  // Create gift wraps for each member
  const wraps = [];
  for (const member of projectMembers) {
    const converKey = nip44.getConversationKey(userKeys.privateKey, member.pubKey);  // Ensure conversation key exists
    const nonce = randomBytes(24); // 24 random bytes
    const wrap = finalizeEvent({
      kind: NOSTR_GIFT_WRAP_KIND,
      created_at: Math.floor(Date.now() / 1000),
      content: nip44.encrypt(JSON.stringify(rumor), converKey, nonce),
      tags: [
        ['p', member.pubKey],
        ['project-uuid', project.uuid],
        ['type', 'project'],
      ]
    }, userKeys.privateKey);
    wraps.push(wrap);
  }

  // Publish all wraps
  for (const wrap of wraps) {
    await publishToRelays(wrap);
  }

  return rumor;
}
export async function updateAndPublishPrivateProject(
  project: Project,
  userKeys: UserKeys,
  projectMembers: ProjectMember[],
  updatedTag: string,
  propertyTag: string
): Promise<NostrEvent> {

  // Create a rumor (NIP-17)
  const rumor = finalizeEvent({
    kind: NOSTR_PROJECT_KIND,
    created_at: Math.floor(Date.now() / 1000),
    content: JSON.stringify(project),
    tags: [
      ['d', project.uuid],
      ['name', project.name],
      ['private', 'true'],
      ['updated', updatedTag],
      ['property', propertyTag],
      ['e', project.lastEventId],
    ]
  }, userKeys.privateKey);

  // Create gift wraps for each member
  const wraps = [];
  for (const member of projectMembers) {
    const converKey = nip44.getConversationKey(userKeys.privateKey, member.pubKey);  // Ensure conversation key exists
    const nonce = randomBytes(24); // 24 random bytes
    const wrap = finalizeEvent({
      kind: NOSTR_GIFT_WRAP_KIND,
      created_at: Math.floor(Date.now() / 1000),
      content: nip44.encrypt(JSON.stringify(rumor), converKey, nonce),
      tags: [
        ['p', member.pubKey],
        ['project-uuid', project.uuid],
        ['type', 'project'],
      ]
    }, userKeys.privateKey);
    wraps.push(wrap);
  }

  // Publish all wraps
  for (const wrap of wraps) {
    await publishToRelays(wrap);
  }

  return rumor;
}

export async function createAndPublishProject(
  project: Project,
  userKeys: UserKeys
): Promise<NostrEvent> {

  const eventTemplate: EventTemplate = {
    kind: NOSTR_PROJECT_KIND,
    created_at: Math.floor(Date.now() / 1000),
    content: JSON.stringify(project),
    tags: [
      ['d', project.uuid],
      ['name', project.name],
      ['private', 'false'],
    ]
  };

  const signed = finalizeEvent(eventTemplate, userKeys.privateKey);
  publishToRelays(signed);
  return signed;
}

export async function updateAndPublishProject(
  project: Project,
  userKeys: UserKeys,
  updatedTag: string,
  propertyTag: string
): Promise<NostrEvent> {

  const eventTemplate: EventTemplate = {
    kind: NOSTR_PROJECT_KIND,
    created_at: Math.floor(Date.now() / 1000),
    content: JSON.stringify(project),
    tags: [
      ['d', project.uuid],
      ['name', project.name],
      ['private', 'false'],
      ['updated', updatedTag],
      ['property', propertyTag],
      ['e', project.lastEventId],
    ]
  };

  const signed = finalizeEvent(eventTemplate, userKeys.privateKey);
  publishToRelays(signed);
  return signed;
}

export function nostrEventToProject(event: NostrEvent): Project {
  // Parse the content field
  const parsedContent = JSON.parse(event.content);

  // Validate and transform the parsed content if necessary
  const project: Project = {
    uuid: parsedContent.uuid,
    name: parsedContent.name,
    description: parsedContent.description,
    isPrivate: parsedContent.isPrivate,
    createdAt: parsedContent.createdAt,
    lastEventId: event.id,
    lastEventCreatedAt: event.created_at,
    members: parsedContent.members || [],
    tickets: parsedContent.tickets || [],
  };

  return project;
}

export async function getPrivateProject(
  rumorEvent: NostrEvent,
  userKeys: UserKeys
): Promise<Project> {
  // Extract the encrypted content and nonce from the rumor
  const encryptedContent = rumorEvent.content;
  const conversationKey = nip44.getConversationKey(userKeys.privateKey, rumorEvent.pubkey);

  // Decrypt the rumor content
  const decryptedContent = nip44.decrypt(encryptedContent, conversationKey);

  // Parse the decrypted content

  const parsedContent = JSON.parse(decryptedContent);
  // Validate and transform the parsed content if necessary
  const project: Project = {
    uuid: parsedContent.uuid,
    name: parsedContent.name,
    description: parsedContent.description,
    isPrivate: parsedContent.isPrivate,
    createdAt: parsedContent.createdAt,
    lastEventId: rumorEvent.id,
    lastEventCreatedAt: rumorEvent.created_at,
    members: parsedContent.members || [],
    tickets: parsedContent.tickets || [],
  };

  return project;
}
