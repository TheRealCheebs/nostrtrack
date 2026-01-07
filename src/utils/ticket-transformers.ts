
  uuid                  String @id
  project_uuid          String
type String
  title                 String
  description           String
  state                 String @default ("unscheduled")
  parent_uuid           String ?
  children_uuids        Json
  creator_pubkey        String
  created_at            BigInt
  updated_at            BigInt
  last_event_id         String
  last_event_created_at BigInt

export function prismaToTicket(prismaTicket: PrismaTicket): Ticket {
  const childrenUuids = prismaTicket.children_uuids as string[];
  return {

    uuid: prismaTicket.uuid,
    projectUuid: prismaTicket.project_uuid,
    title: prismaTicket.title,
    type: prismaTicket.type,
    description: prismaTicket.description,
    state: prismaTicket.state,
    parentUuid: prismaTicket.parent_uuid,
    creatorPubkey: prismaTicket.creator_pubkey,
    createdAt: prismaTicket.created_at,
    updatedAt: prismaTicket.updated_at,
    lastEventId: prismaTicket.last_event_id,
    lastEventCreatedAt: prismaTicket.last_event_created_at,
    childrenUuids: childrenUuids[],
  };
}
