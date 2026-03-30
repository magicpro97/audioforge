import { AudioProvider } from './base.js';
import type { AudioGenerationRequest, AudioGenerationResult, ProviderInfo } from '../types/index.js';
import {
  falSubmitJob,
  falPollStatus,
  falGetResult,
  type FalOptions,
} from '@magicpro97/forge-core';

export class FalProvider extends AudioProvider {
  private apiKey: string = '';

  get info(): ProviderInfo {
    return {
      name: 'fal',
      displayName: 'fal.ai (Multi-model)',
      description: 'Multiple sound and music models via fal.ai (CassetteAI, Beatoven)',
      requiresKey: true,
      website: 'https://fal.ai/',
      models: ['cassetteai/sound-effects-generator', 'beatoven/sound-effect-generation', 'beatoven/music-generation'],
      capabilities: { sfx: true, music: true },
    };
  }

  configure(apiKey: string): void {
    this.apiKey = apiKey;
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async validate(): Promise<boolean> {
    if (!this.apiKey) return false;
    return true;
  }

  async generate(request: AudioGenerationRequest): Promise<AudioGenerationResult> {
    if (!this.apiKey) throw new Error('fal.ai API key not configured. Run: audioforge config set fal.apiKey <key>');

    const startTime = Date.now();
    const model = request.model || 'cassetteai/sound-effects-generator';
    const duration = request.duration || 10;

    const body: Record<string, unknown> = {
      prompt: request.prompt,
      duration: Math.min(duration, 30),
    };

    if (request.seed !== undefined) {
      body.seed = request.seed;
    }

    const falOpts: FalOptions = { apiKey: this.apiKey };

    // Submit job and get result via forge-core
    const requestId = await falSubmitJob(falOpts, model, body);
    await falPollStatus(falOpts, model, requestId);
    const result = await falGetResult(falOpts, model, requestId);

    // Get audio URL from result
    const audioUrl = (result as any).audio_file?.url || (result as any).audio?.url || (result as any).output?.url;
    if (!audioUrl) {
      throw new Error('fal.ai: No audio URL in response');
    }

    // Download the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio from fal.ai (${audioResponse.status})`);
    }

    const buffer = await audioResponse.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const elapsed = Date.now() - startTime;

    return {
      audio: [{ base64, url: audioUrl, duration }],
      provider: 'fal',
      model,
      elapsed,
      metadata: {},
    };
  }

  async generateMusic(request: AudioGenerationRequest): Promise<AudioGenerationResult> {
    const musicRequest = {
      ...request,
      model: request.model || 'beatoven/music-generation',
    };
    return this.generate(musicRequest);
  }

  async listModels(): Promise<string[]> {
    return this.info.models;
  }
}
