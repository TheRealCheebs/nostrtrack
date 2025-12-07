import { v4 as uuidv4 } from 'uuid';

import type { Project, ProjectMember } from '../interfaces/project';

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
    { projectId: projectId, pubkey: creatorPubkey, role: 'admin', createdAt: Math.floor(Date.now() / 1000) },
    ...members.filter((m) => m.pubKey !== creatorPubkey),
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
