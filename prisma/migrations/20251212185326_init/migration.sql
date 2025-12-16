-- CreateTable
CREATE TABLE "Identity" (
    "pubkey" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "last_used" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "projects" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "Project" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "created_at" BIGINT NOT NULL,
    "last_event_id" TEXT NOT NULL,
    "last_event_created_at" BIGINT NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "project_uuid" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "created_at" BIGINT NOT NULL,

    PRIMARY KEY ("project_uuid", "pubkey"),
    CONSTRAINT "ProjectMember_project_uuid_fkey" FOREIGN KEY ("project_uuid") REFERENCES "Project" ("uuid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ticket" (
    "uuid" TEXT NOT NULL PRIMARY KEY,
    "project_uuid" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'unscheduled',
    "parent_uuid" TEXT,
    "children_uuids" JSONB NOT NULL,
    "creator_pubkey" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "updated_at" BIGINT NOT NULL,
    "last_event_id" TEXT NOT NULL,
    "last_event_created_at" BIGINT NOT NULL,
    CONSTRAINT "Ticket_parent_uuid_fkey" FOREIGN KEY ("parent_uuid") REFERENCES "Ticket" ("uuid") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_project_uuid_fkey" FOREIGN KEY ("project_uuid") REFERENCES "Project" ("uuid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketReference" (
    "source_ticket_uuid" TEXT NOT NULL,
    "target_ticket_uuid" TEXT NOT NULL,
    "reference_type" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,

    PRIMARY KEY ("source_ticket_uuid", "target_ticket_uuid", "reference_type"),
    CONSTRAINT "TicketReference_target_ticket_uuid_fkey" FOREIGN KEY ("target_ticket_uuid") REFERENCES "Ticket" ("uuid") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketReference_source_ticket_uuid_fkey" FOREIGN KEY ("source_ticket_uuid") REFERENCES "Ticket" ("uuid") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "event_id" TEXT NOT NULL PRIMARY KEY,
    "received_at" BIGINT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Identity_name_key" ON "Identity"("name");
