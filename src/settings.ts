import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'nostrtrack');
const CONFIG_FILE = path.join(CONFIG_DIR, 'relays.json');

async function ensureConfigDir() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to create config directory: ${error.message}`);
    } else {
      console.error('Failed to create config directory: Unknown error');
    }
  }
}

async function saveRelaysConfig(relays: string[]) {
  try {
    await ensureConfigDir();
    const data = JSON.stringify({ relays }, null, 2);
    await fs.writeFile(CONFIG_FILE, data, 'utf-8');
    console.log(`Relays saved to ${CONFIG_FILE}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to save relays: ${error.message}`);
    } else {
      console.error('Failed to save relays: Unknown error');
    }
  }
}

async function loadRelaysConfig(): Promise<string[]> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const { relays } = JSON.parse(data);
    return relays || [];
  } catch (error) {
    console.error(`Error loading relays: ${error}`);
    return [];
  }
}

export async function listRelays(): Promise<string[]> {
  return await loadRelaysConfig();
}

export async function modifyRelays(action: 'add' | 'remove', relayUrl: string): Promise<void> {
  const relays = await loadRelaysConfig();

  if (action === 'add') {
    if (!relays.includes(relayUrl)) {
      relays.push(relayUrl);
      console.log(`Relay added: ${relayUrl}`);
    } else {
      console.log(`Relay already exists: ${relayUrl}`);
    }
  } else if (action === 'remove') {
    const initialLength = relays.length;
    const updatedRelays = relays.filter((url) => url !== relayUrl);
    if (updatedRelays.length < initialLength) {
      console.log(`Relay removed: ${relayUrl}`);
    } else {
      console.log(`Relay not found: ${relayUrl}`);
    }
    await saveRelaysConfig(updatedRelays);
  }

  await saveRelaysConfig(relays);
}
