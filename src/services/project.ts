import { v4 as uuidv4 } from 'uuid';

import type { Project, ProjectMember } from '../interfaces/project';
import { createProjectMember } from './nostr/projects';

export function createProject(
  projectId: string = uuidv4(),
  name: string,
  creatorPubkey: string,
  description: string,
  isPrivate: boolean = false,
  members: Array<ProjectMember> = [],
): Project {
  // Always add the creator as admin
  const allMembers = [
    createProjectMember(projectId, creatorPubkey, 'admin'),
    ...members.filter((m) => m.pubkey !== creatorPubkey),
  ];

  const createdTime = Number(Math.floor(Date.now() / 1000));

  return {
    uuid: projectId,
    name,
    description,
    isPrivate,
    createdAt: createdTime,
    lastEventId: '',
    lastEventCreatedAt: createdTime,
    members: allMembers,
    tickets: [],
  } as Project; // Ensure the returned object matches the Project type
}
