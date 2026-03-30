import { createHistoryManager, type BaseHistoryEntry } from '@magicpro97/forge-core';
import type { HistoryEntry } from '../types/index.js';
import { getConfigDir } from './config.js';

const historyManager = createHistoryManager<HistoryEntry & BaseHistoryEntry>({
  configDir: getConfigDir(),
  maxEntries: 500,
});

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
  return historyManager.addEntry(entry);
}

export function getHistory(limit?: number): HistoryEntry[] {
  return historyManager.getHistory(limit);
}

export function getHistoryEntry(id: string): HistoryEntry | undefined {
  return historyManager.getEntry(id);
}

export function clearHistory(): void {
  historyManager.clearHistory();
}
