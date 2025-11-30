import { SimplePool } from 'nostr-tools';

export async function getLastNostrEvents(relays: string[], kinds: number[], limit: number = 10) {
  const pool = new SimplePool();
  const events = pool.querySync(relays, {
    kinds: kinds,
    limit: limit,
  });
  if (events) {
    console.log('it exists indeed on this relay:', events);
    // console.log('events on the relay:\n');
    // events.forEach((e: Event) => {
    //   console.log(e);
    // })
  } else {
    console.log('no events found');
  }
}

export function formatNostrTimestamp(timestamp: BigInt): string {
  const date = new Date(Number(timestamp)); // Convert milliseconds to a Date object
  return date.toLocaleString(); // Format the date to a readable string
}
