export interface AppConfig {
  providers: Record<string, ProviderConfig>;
  defaults: DefaultsConfig;
  history: HistoryConfig;
  output: OutputConfig;
  cost: CostConfig;
  autoOpen: boolean;
}

export interface ProviderConfig {
  apiKey?: string;
  enabled: boolean;
  defaultModel?: string;
  endpoint?: string;
}

export interface DefaultsConfig {
  provider: string;
  model: string;
  duration: number;
  format: 'wav' | 'mp3' | 'ogg' | 'flac';
  preset: string;
}

export interface OutputConfig {
  directory: string;
  namingPattern: string;
}

export interface HistoryConfig {
  enabled: boolean;
  maxEntries: number;
}

export interface CostConfig {
  budget: number;
  currency: string;
  trackingEnabled: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  prompt: string;
  type: 'sfx' | 'music';
  duration: number;
  format: string;
  outputFiles: string[];
  elapsed: number;
  cost?: number;
}

export interface TemplateEntry {
  name: string;
  prompt: string;
  variables: string[];
  provider?: string;
  model?: string;
  duration?: number;
  preset?: string;
  type?: 'sfx' | 'music';
}
