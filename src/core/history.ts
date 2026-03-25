import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { HistoryEntry } from '../types/index.js';
import { getConfigDir, loadConfig } from './config.js';

const HISTORY_FILE = path.join(getConfigDir(), 'history.json');

function loadHistory(): HistoryEntry[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  const config = loadConfig();
  const maxEntries = config.history.maxEntries;
  const trimmed = entries.slice(-maxEntries);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
  const fullEntry: HistoryEntry = {
    id: crypto.randomUUID().slice(0, 8),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  const entries = loadHistory();
  entries.push(fullEntry);
  saveHistory(entries);
  return fullEntry;
}

export function getHistory(limit?: number): HistoryEntry[] {
  const entries = loadHistory();
  if (limit) return entries.slice(-limit);
  return entries;
}

export function getHistoryEntry(id: string): HistoryEntry | undefined {
  return loadHistory().find(e => e.id === id);
}

export function clearHistory(): void {
  saveHistory([]);
}
