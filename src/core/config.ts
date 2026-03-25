import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { AppConfig, ProviderConfig } from '../types/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.audioforge');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: AppConfig = {
  providers: {
    elevenlabs: { enabled: true },
    stability: { enabled: true },
    fal: { enabled: true },
    replicate: { enabled: true },
  },
  defaults: {
    provider: 'elevenlabs',
    model: '',
    duration: 5,
    format: 'wav',
    preset: '',
  },
  history: {
    enabled: true,
    maxEntries: 500,
  },
  output: {
    directory: './audioforge-output',
    namingPattern: '{provider}-{model}-{timestamp}',
  },
  cost: {
    budget: 0,
    currency: 'USD',
    trackingEnabled: true,
  },
  autoOpen: false,
};

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): AppConfig {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const loaded = JSON.parse(raw);
    return deepMerge(DEFAULT_CONFIG, loaded) as AppConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: AppConfig): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function getConfigValue(keyPath: string): unknown {
  const config = loadConfig();
  return getNestedValue(config, keyPath);
}

export function setConfigValue(keyPath: string, value: string): void {
  const config = loadConfig();
  setNestedValue(config, keyPath, parseValue(value));
  saveConfig(config);
}

export function getProviderApiKey(providerName: string): string | undefined {
  const config = loadConfig();
  return config.providers[providerName]?.apiKey;
}

export function setProviderApiKey(providerName: string, apiKey: string): void {
  const config = loadConfig();
  if (!config.providers[providerName]) {
    config.providers[providerName] = { enabled: true } as ProviderConfig;
  }
  config.providers[providerName].apiKey = apiKey;
  saveConfig(config);
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigFilePath(): string {
  return CONFIG_FILE;
}

// --- Helpers ---

function getNestedValue(obj: any, keyPath: string): unknown {
  const keys = keyPath.split('.');
  let current = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = current[key];
  }
  return current;
}

function setNestedValue(obj: any, keyPath: string, value: unknown): void {
  const keys = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined || current[keys[i]] === null) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

function parseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
