import { getPublicName } from '../nostr/utils';
import { UserKeys } from '../interfaces/identity';


class UserState {
  private userKeys: UserKeys = { pubkey: '', privateKey: new Uint8Array() };
  private userName: string | null = null;
  private activeProject: string = '';
  private subscribers: Array<() => void> = [];

  // Set userKeys and notify subscribers if it changes
  setUserKeys(newKeys: UserKeys) {
    if (this.userKeys !== newKeys) {
      this.userKeys = newKeys;
      this.userName = newKeys ? getPublicName(newKeys.pubkey) : null;
      this.notifySubscribers();
    }
  }

  getUserKeys(): UserKeys {
    return this.userKeys;
  }

  getPubKey(): string {
    if (!this.userKeys) return '';
    return this.userKeys.pubkey;
  }

  // Get the current userName
  getUserName(): string | null {
    return this.userName;
  }

  setActiveProject(project: string) {
    if (this.activeProject !== project) {
      this.activeProject = project;
      this.notifySubscribers();
    }
  }

  resetActiveProject() {
    this.activeProject = '';
    this.notifySubscribers();
  }

  getActiveProject(): string {
    return this.activeProject;
  }

  // Subscribe to changes
  subscribe(callback: () => void) {
    this.subscribers.push(callback);
  }

  // Unsubscribe from changes
  unsubscribe(callback: () => void) {
    this.subscribers = this.subscribers.filter((sub) => sub !== callback);
  }

  // Notify all subscribers
  private notifySubscribers() {
    this.subscribers.forEach((callback) => callback());
  }
}

// Export a singleton instance of UserState
export const userState = new UserState();
