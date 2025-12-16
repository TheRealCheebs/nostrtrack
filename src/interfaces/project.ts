export interface Project {
  uuid: string;
  name: string;
  description: string;
  isPrivate: boolean;
  createdAt: number;
  lastEventId: string;
  lastEventCreatedAt: number;
  members: ProjectMember[];
  tickets: string[];
}

export interface ProjectMember {
  projectId: string;
  pubkey: string;
  role: string;
  createdAt: number;
}
