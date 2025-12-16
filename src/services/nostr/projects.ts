import { nip44, finalizeEvent, nip19 } from 'nostr-tools';
import { randomBytes } from '@noble/hashes/utils';
import type { NostrEvent, EventTemplate } from 'nostr-tools';

import { NOSTR_GIFT_WRAP_KIND, NOSTR_PROJECT_KIND } from '../../constants';
import { publishToRelays } from '../../nostr/utils';
import type { Project, ProjectMember } from '../../interfaces/project';
import type { UserKeys } from '../../interfaces/identity';

export function createProjectMemberFromNPub(npub: string, role: string, projectUuid: string): ProjectMember | null {
  const decoded = nip19.decode(npub.trim());
  if (decoded.type !== 'npub') {
    return null
  }
  const pubkey: string = decoded.data;

  return createProjectMember(projectUuid, pubkey, role);
}

export function createProjectMember(projectId: string, pubkey: string, role: string): ProjectMember {
  return {
    projectId: projectId,
    pubkey: pubkey,
    role: role,
    createdAt: Math.floor(Date.now() / 1000),
  } as ProjectMember;
}

export async function publishProject(project: Project, userKeys: UserKeys): Promise<Project> {
  if (project.isPrivate) {
    const privateEvent = await createAndPublishPrivateProject(
      project,
      userKeys,
      project.members,
    );
    project.lastEventId = privateEvent.id;
    project.lastEventCreatedAt = privateEvent.created_at;
  } else {
    const event = await createAndPublishProject(project, userKeys);
    project.lastEventId = event.id;
    project.lastEventCreatedAt = event.created_at;
  }
  return project;
}

export async function createAndPublishPrivateProject(
  project: Project,
  userKeys: UserKeys,
  projectMembers: ProjectMember[],
): Promise<NostrEvent> {
  // Create a rumor (NIP-17)
  const rumor = finalizeEvent(
    {
      kind: NOSTR_PROJECT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      content: JSON.stringify(project),
      tags: [
        ['d', project.uuid],
        ['name', project.name],
        ['private', 'true'],
      ],
    },
    userKeys.privateKey,
  );

  // Create gift wraps for each member
  const wraps = [];
  for (const member of projectMembers) {
    const converKey = nip44.getConversationKey(userKeys.privateKey, member.pubkey); // Ensure conversation key exists
    const nonce = randomBytes(24); // 24 random bytes
    const wrap = finalizeEvent(
      {
        kind: NOSTR_GIFT_WRAP_KIND,
        created_at: Math.floor(Date.now() / 1000),
        content: nip44.encrypt(JSON.stringify(rumor), converKey, nonce),
        tags: [
          ['p', member.pubkey],
          ['project-uuid', project.uuid],
          ['type', 'project'],
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

export async function updateAndPublishPrivateProject(
  project: Project,
  userKeys: UserKeys,
  projectMembers: ProjectMember[],
  updatedTag: string,
  propertyTag: string,
): Promise<NostrEvent> {
  // Create a rumor (NIP-17)
  const rumor = finalizeEvent(
    {
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
      ],
    },
    userKeys.privateKey,
  );

  // Create gift wraps for each member
  const wraps = [];
  for (const member of projectMembers) {
    const converKey = nip44.getConversationKey(userKeys.privateKey, member.pubkey); // Ensure conversation key exists
    const nonce = randomBytes(24); // 24 random bytes
    const wrap = finalizeEvent(
      {
        kind: NOSTR_GIFT_WRAP_KIND,
        created_at: Math.floor(Date.now() / 1000),
        content: nip44.encrypt(JSON.stringify(rumor), converKey, nonce),
        tags: [
          ['p', member.pubkey],
          ['project-uuid', project.uuid],
          ['type', 'project'],
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

export async function createAndPublishProject(
  project: Project,
  userKeys: UserKeys,
): Promise<NostrEvent> {
  const eventTemplate: EventTemplate = {
    kind: NOSTR_PROJECT_KIND,
    created_at: Math.floor(Date.now() / 1000),
    content: JSON.stringify(project),
    tags: [
      ['d', project.uuid],
      ['name', project.name],
      ['private', 'false'],
    ],
  };

  const signed = finalizeEvent(eventTemplate, userKeys.privateKey);
  await publishToRelays(signed);
  return signed;
}

export async function updateAndPublishProject(
  project: Project,
  userKeys: UserKeys,
  updatedTag: string,
  propertyTag: string,
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
    ],
  };

  const signed = finalizeEvent(eventTemplate, userKeys.privateKey);
  await publishToRelays(signed);
  return signed;
}

export function nostrEventToProject(event: NostrEvent): Project {
  const parsedContent = JSON.parse(event.content) as Partial<Project>;

  return {
    uuid: parsedContent.uuid || '',
    name: parsedContent.name || 'Untitled Project',
    description: parsedContent.description || '',
    isPrivate: parsedContent.isPrivate || false,
    createdAt: parsedContent.createdAt || 0,
    lastEventId: event.id,
    lastEventCreatedAt: event.created_at,
    members: parsedContent.members || [],
    tickets: parsedContent.tickets || [],
  };
}

export function getPrivateProject(rumorEvent: NostrEvent, userKeys: UserKeys): Project {
  // Extract the encrypted content and nonce from the rumor
  const encryptedContent = rumorEvent.content;
  const conversationKey = nip44.getConversationKey(userKeys.privateKey, rumorEvent.pubkey);

  // Decrypt the rumor content
  const decryptedContent = nip44.decrypt(encryptedContent, conversationKey);

  // Parse the decrypted content

  const parsedContent = JSON.parse(decryptedContent) as Partial<Project>;
  // Validate and transform the parsed content if necessary
  const project: Project = {
    uuid: parsedContent.uuid || '',
    name: parsedContent.name || 'Untitled Project',
    description: parsedContent.description || '',
    isPrivate: parsedContent.isPrivate || false,
    createdAt: parsedContent.createdAt || 0,
    lastEventId: rumorEvent.id,
    lastEventCreatedAt: rumorEvent.created_at,
    members: parsedContent.members || [],
    tickets: parsedContent.tickets || [],
  };

  return project;
}
