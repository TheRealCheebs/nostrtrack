import { generateSecretKey, getPublicKey, nip19, SimplePool } from "nostr-tools"
import type { NostrEvent } from 'nostr-tools';
import { NOSTR_PROJECT_KIND, NOSTR_TICKET_KIND } from "src/constants";
import { nostrEventToProject } from "@services/nostr/projects.js";
import { nostrEventToTicket } from "@services/nostr/ticket.js";
import type { Project } from "@interfaces/project.js";
import type { Ticket } from "@interfaces/ticket.js";
import type { UserKeys } from "@interfaces/identity.js";

let pool: SimplePool | null = null; // Global pool instance
let relays: string[] = []; // Global list of relays

/**
 * Initialize the Nostr pool and relays.
 * @param relayUrls - Array of relay URLs to connect to.
 */
export async function initNostr(relayUrls: string[]): Promise<void> {
  if (!pool) {
    pool = new SimplePool();
    relays = relayUrls;

    // Connect to all relays
    for (const relay of relays) {
      try {
        await pool?.ensureRelay(relay); // Await the promise
        console.log(`Relay added: ${relay}`);
      } catch (error) {
        console.warn(`Failed to connect to relay ${relay}:`, error);
      }
    }
  } else {
    console.warn('Nostr is already initialized.');
  }
}

export function createKeys(): UserKeys {
  let userPrivateKey = generateSecretKey();
  const pubKey = getPublicKey(userPrivateKey);

  return { pubKey: pubKey, privateKey: userPrivateKey }
}

export function importKeys(nsec: string): UserKeys {
  try {
    const decoded = nip19.decode(nsec);

    if (decoded.type !== "nsec") {
      throw new Error("Only nsec keys are accepted.");
    }

    const pubKey = getPublicKey(decoded.data)

    return { pubKey: pubKey, privateKey: decoded.data };
  } catch (error) {
    throw new Error("Invalid nsec provided.");
  }
}

export function getPublicName(pubKey: string): string {
  //const { data: pubkey } = nip19.decode('npub1...'); // Replace with actual npub

  const pool = new SimplePool();
  const relays = ['wss://relay.damus.io']; // Add more relays
  let name = '';

  const filter = {
    authors: [pubKey],
    kinds: [0],
    limit: 1,
  }
  const sub = pool.subscribeMany(relays,
    filter,
    {
      onevent(event) {
        const profile = JSON.parse(event.content);
        name = profile.name;
        sub.close();
      },
      oneose() {
        sub.close();
      }
    }
  );
  // if the userName doesn't come back show the npub
  if (name === '') {
    name = nip19.npubEncode(pubKey);
  }
  return name;

}

export function convertForNIP19(userKeys: UserKeys): { nsec: string, npub: string } {
  const nsec = nip19.nsecEncode(userKeys.privateKey);
  const npub = nip19.npubEncode(userKeys.pubKey);

  return { nsec, npub };
}
/**
 * Publish an event to all configured relays.
 * @param event - The Nostr event to publish.
 */
export async function publishToRelays(event: NostrEvent): Promise<void> {
  if (!pool || relays.length === 0) {
    throw new Error('Nostr is not initialized. Call initNostr() first.');
  }
  try {
    // Publish to all relays and resolve as soon as one succeeds
    await Promise.any(pool.publish(relays, event));
    console.log('Event published successfully to at least one relay.');
  } catch (error) {
    console.error('Failed to publish event to any relay:', error);
  }
}

/**
 * Close all relay connections.
 */
export function closeNostr(): void {
  if (pool) {
    pool.close(relays);
    pool = null;
    relays = [];
    console.log('Nostr pool closed and relays cleared.');
  } else {
    console.warn('Nostr pool is not initialized.');
  }
}


export async function getAllProjectsFromRelay(limit: number = 10): Promise<Project[]> {
  if (!pool || relays.length === 0) {
    throw new Error('Nostr is not initialized. Call initNostr() first.');
  }
  try {
    const events: NostrEvent[] = await pool.querySync(
      relays,
      {
        kinds: [NOSTR_PROJECT_KIND],
        limit: limit
      },
    )
    const projects: Project[] = [];

    events.forEach((event) => {
      try {
        const project = nostrEventToProject(event); // Convert event to project
        if (project) {
          projects.push(project); // Push the project onto the array
        }
      } catch (error) {
        console.warn(`Failed to convert event to project: ${event.id}`, error);
      }
    });

    return projects; // Return the array of projects
  } catch (error) {
    console.error("Failed to fetch events from any relay:", error);
    return [];
  }
}

export async function getAllTicketsFromRelay(limit: number = 10): Promise<Ticket[]> {
  if (!pool || relays.length === 0) {
    throw new Error('Nostr is not initialized. Call initNostr() first.');
  }
  try {
    const events: NostrEvent[] = await pool.querySync(
      relays,
      {
        kinds: [NOSTR_TICKET_KIND],
        limit: limit,
      },
    )
    const tickets: Ticket[] = [];

    events.forEach((event) => {
      console.log(` the raw event is ${event}`);
      try {
        const ticket = nostrEventToTicket(event); // Convert event to project
        if (ticket) {
          tickets.push(ticket); // Push the project onto the array
        }
      } catch (error) {
        console.warn(`Failed to convert event to project: ${event.id}`, error);
      }
    });

    return tickets; // Return the array of projects
  } catch (error) {
    console.error("Failed to fetch events from any relay:", error);
    return [];
  }
}
export async function getAllProjectTicketsFromRelay(projectUuid: string, limit: number = 10): Promise<Ticket[]> {
  console.log(`getting tickets for ${projectUuid}`)
  if (!pool || relays.length === 0) {
    throw new Error('Nostr is not initialized. Call initNostr() first.');
  }
  try {
    const events: NostrEvent[] = await pool.querySync(
      relays,
      {
        kinds: [NOSTR_TICKET_KIND],
        limit: limit,
        '#project-uuid': [projectUuid],
      },
    )
    const tickets: Ticket[] = [];

    events.forEach((event) => {
      try {
        const ticket = nostrEventToTicket(event); // Convert event to project
        if (ticket) {
          tickets.push(ticket); // Push the project onto the array
        }
      } catch (error) {
        console.warn(`Failed to convert event to project: ${event.id}`, error);
      }
    });

    return tickets; // Return the array of projects
  } catch (error) {
    console.error("Failed to fetch events from any relay:", error);
    return [];
  }
}
