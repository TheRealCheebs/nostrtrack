import keytar from 'keytar';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils' // already an installed dependency
import { PrismaClient } from '@prisma/client';
import type { Identity as PrismaIdentity } from '@prisma/client';
import type { UserKeys } from '@interfaces/identity.js';

const SERVICE_NAME = 'nostrtrack';

export async function getActiveUserKeys(prisma: PrismaClient): Promise<UserKeys | null> {
  try {
    const activeUser = await getActiveIdentity(prisma);
    if (!activeUser) {
      return null;
    }
    const userPubkey = activeUser.pubkey;
    const userPrivateKey = await getPrivateKey(userPubkey);
    if (!userPrivateKey) {
      return null;
    }

    return { pubKey: userPubkey, privateKey: userPrivateKey };
  } catch (error) {
    console.error("Error in getActiveUserKeys:", error);
    return null;
  }
}

export async function createIdentity(
  prisma: PrismaClient,
  name: string,
  userKeys: UserKeys
): Promise<PrismaIdentity> {
  const privateKeyHex = bytesToHex(userKeys.privateKey);
  await keytar.setPassword(SERVICE_NAME, userKeys.pubKey, privateKeyHex);

  const projects = new Map();

  return await prisma.identity.create({
    data: {
      pubkey: userKeys.pubKey,
      name: name,
      created_at: Date.now(),
      last_used: Date.now(),
      is_active: true,
      projects: JSON.stringify(projects) // not subscribed to any projects on create
    }
  });
}

export async function getPrivateKey(pubKey: string): Promise<Uint8Array | null> {
  const privateKeyHex = await keytar.getPassword(SERVICE_NAME, pubKey);
  if (!privateKeyHex) {
    return null;
  }
  return hexToBytes(privateKeyHex);
}

export async function removeIdentityByKey(prisma: PrismaClient, pubKey: string): Promise<boolean> {
  // Use a transaction to ensure atomicity
  return await prisma.$transaction(async (tx) => {
    // Delete from DB first
    const dbResult = await tx.identity.deleteMany({
      where: { pubkey: pubKey }
    });
    if (dbResult.count === 0) {
      return false; // Nothing deleted from DB
    }

    // Then delete from keytar
    const deletedFromKeytar = await keytar.deletePassword(SERVICE_NAME, pubKey);
    if (!deletedFromKeytar) {
      // Throw to roll back DB deletion
      throw new Error('Failed to delete from keytar, rolling back DB');
    }
    return true;
  });
}

export async function removeIdentityByName(prisma: PrismaClient, name: string): Promise<boolean> {
  // Use a transaction to ensure atomicity
  return await prisma.$transaction(async (tx) => {
    // First get the pubkey for the name
    const identity = await tx.identity.findUnique({
      where: { name }
    });
    if (!identity) {
      return false; // No such identity
    }
    const pubkey = identity.pubkey;

    // Delete from DB
    const dbResult = await tx.identity.deleteMany({
      where: { pubkey }
    });
    if (dbResult.count === 0) {
      return false; // Nothing deleted from DB
    }

    // Then delete from keytar
    const deletedFromKeytar = await keytar.deletePassword(SERVICE_NAME, pubkey);
    if (!deletedFromKeytar) {
      // Throw to roll back DB deletion
      throw new Error('Failed to delete from keytar, rolling back DB');
    }
    return true;
  });
}

export async function getAllIdentities(prisma: PrismaClient): Promise<PrismaIdentity[]> {
  return await prisma.identity.findMany({
    orderBy: { created_at: 'desc' }
  });
}

export async function getIdentityByKey(prisma: PrismaClient, pubkey: string): Promise<PrismaIdentity | null> {
  return await prisma.identity.findUnique({
    where: { pubkey }
  });
}

export async function getIdentityByName(prisma: PrismaClient, name: string): Promise<PrismaIdentity | null> {
  return await prisma.identity.findUnique({
    where: { name }
  });
}

// there should only be one active identity at a time
export async function getActiveIdentity(prisma: PrismaClient): Promise<PrismaIdentity | null> {
  return await prisma.identity.findFirst({
    where: { is_active: true },
    orderBy: { created_at: 'desc' }
  });
}

// there should only be one active identity at a time
export async function setActiveIdentityByKey(prisma: PrismaClient, pubkey: string): Promise<PrismaIdentity | null> {
  return prisma.$transaction(async (tx) => {
    // Deactivate all identities
    await tx.identity.updateMany({
      where: { is_active: true },
      data: { is_active: false }
    });

    // Activate the selected identity
    const updated = await tx.identity.updateMany({
      where: { pubkey },
      data: { is_active: true }
    });

    if (updated.count === 0) {
      return null; // No identity found with the given pubkey
    }

    return await tx.identity.findUnique({ where: { pubkey } });
  });
}

// there should only be one active identity at a time
export async function setActiveIdentityByName(prisma: PrismaClient, name: string): Promise<PrismaIdentity | null> {
  return prisma.$transaction(async (tx) => {
    // Deactivate all identities
    await tx.identity.updateMany({
      where: { is_active: true },
      data: { is_active: false }
    });

    // Activate the selected identity
    const updated = await tx.identity.updateMany({
      where: { name },
      data: { is_active: true }
    });

    if (updated.count === 0) {
      return null; // No identity found with the given name
    }

    return await tx.identity.findUnique({ where: { name } });
  });
}

export async function addOrUpdateUserProject(prisma: PrismaClient, pubKey: string, projectUuid: string, isPrivate: boolean): Promise<void> {
  try {
    const user = await prisma.identity.findUnique({
      where: { pubkey: pubKey },
      select: { projects: true },
    });

    if (!user) {
      throw new Error(`User with ID ${pubKey} not found.`);
    }

    if (typeof user.projects === "string") {
      const projects: Map<string, boolean> = new Map(
        Object.entries(JSON.parse(user.projects))
      );
      projects.set(projectUuid, isPrivate); // Add or update the project

      await prisma.identity.update({
        where: { pubkey: pubKey },
        data: { projects: JSON.stringify(projects) },
      });
    } else {
      throw new Error("Expected user.projects to be a string.");
    }

    console.log(`Project ${projectUuid} added/updated for user ${pubKey}.`);
  } catch (error) {
    console.error("Error adding/updating project:", error);
    throw error;
  }
}

export async function removeUserProject(prisma: PrismaClient, pubKey: string, projectUuid: string): Promise<void> {
  try {
    const user = await prisma.identity.findUnique({
      where: { pubkey: pubKey },
      select: { projects: true },
    });

    if (!user) {
      throw new Error(`User with ID ${pubKey} not found.`);
    }

    if (typeof user.projects === "string") {
      const projects: Map<string, boolean> = new Map(
        Object.entries(JSON.parse(user.projects))
      );
      projects.delete(projectUuid); // remove

      await prisma.identity.update({
        where: { pubkey: pubKey },
        data: { projects: JSON.stringify(projects) },
      });
    } else {
      throw new Error("Expected user.projects to be a string.");
    }

    console.log(`Project ${projectUuid} removed for user ${pubKey}.`);
  } catch (error) {
    console.error("Error removing project:", error);
    throw error;
  }
}

export async function getUserProjects(prisma: PrismaClient, pubKey: string): Promise<Map<string, boolean>> {
  try {
    const user = await prisma.identity.findUnique({
      where: { pubkey: pubKey },
      select: { projects: true },
    });

    if (!user) {
      throw new Error(`User with ID ${pubKey} not found.`);
    }

    if (typeof user.projects === "string") {
      const projects: Map<string, boolean> = new Map(
        Object.entries(JSON.parse(user.projects))
      );
      return projects;
    } else {
      throw new Error("Expected user.projects to be a string.");
    }
  } catch (error) {
    console.error("Error fetching projects:", error);
    throw error;
  }
}
