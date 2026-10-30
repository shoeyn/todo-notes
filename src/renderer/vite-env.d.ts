import type { TodonotesAPI } from '../main/preload.js';

declare global {
  interface Window {
    todonotes: TodonotesAPI;
  }
}

export {};
