import type { AudioGenerationRequest, AudioGenerationResult, AudioVariationRequest, ProviderInfo } from '../types/index.js';

export abstract class AudioProvider {
  abstract get info(): ProviderInfo;

  abstract configure(apiKey: string): void;
  abstract isConfigured(): boolean;
  abstract validate(): Promise<boolean>;
  abstract generate(request: AudioGenerationRequest): Promise<AudioGenerationResult>;
  abstract listModels(): Promise<string[]>;

  // Optional capabilities — override in subclasses
  async generateMusic(_request: AudioGenerationRequest): Promise<AudioGenerationResult> {
    throw new Error(`${this.info.name} does not support music generation`);
  }

  async vary(_request: AudioVariationRequest): Promise<AudioGenerationResult> {
    throw new Error(`${this.info.name} does not support variations`);
  }
}
