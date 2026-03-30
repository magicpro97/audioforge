import { createConfigManager } from '@magicpro97/forge-core';
import type { AppConfig } from '../types/index.js';

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

const manager = createConfigManager({
  toolName: 'audioforge',
  defaultConfig: DEFAULT_CONFIG as AppConfig & Record<string, unknown>,
});

export const loadConfig = manager.loadConfig;
export const saveConfig = manager.saveConfig;
export const getConfigValue = manager.getConfigValue;
export const setConfigValue = manager.setConfigValue;
export const getProviderApiKey = manager.getProviderApiKey;
export const setProviderApiKey = manager.setProviderApiKey;
export const getConfigDir = manager.getConfigDir;
export const getConfigFilePath = manager.getConfigFilePath;
