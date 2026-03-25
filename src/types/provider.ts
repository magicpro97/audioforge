export interface AudioGenerationRequest {
  prompt: string;
  duration?: number;
  model?: string;
  preset?: string;
  format?: 'wav' | 'mp3' | 'ogg' | 'flac';
  loop?: boolean;
  seed?: number;
  promptInfluence?: number;
}

export interface AudioGenerationResult {
  audio: GeneratedAudio[];
  provider: string;
  model: string;
  elapsed: number;
  cost?: number;
  metadata: Record<string, unknown>;
}

export interface GeneratedAudio {
  base64?: string;
  url?: string;
  localPath?: string;
  duration?: number;
}

export interface AudioVariationRequest {
  inputAudio: string;
  prompt?: string;
  count?: number;
  strength?: number;
}

export interface ProviderInfo {
  name: string;
  displayName: string;
  description: string;
  requiresKey: boolean;
  website: string;
  models: string[];
  capabilities?: ProviderCapabilities;
}

export interface ProviderCapabilities {
  sfx?: boolean;
  music?: boolean;
  variations?: boolean;
  loop?: boolean;
}
