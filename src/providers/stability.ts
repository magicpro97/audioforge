import { AudioProvider } from './base.js';
import type { AudioGenerationRequest, AudioGenerationResult, ProviderInfo } from '../types/index.js';

export class StabilityProvider extends AudioProvider {
  private apiKey: string = '';
  private baseUrl = 'https://api.stability.ai/v2beta';

  get info(): ProviderInfo {
    return {
      name: 'stability',
      displayName: 'Stability AI (Stable Audio)',
      description: 'Studio-quality music and sound effects, up to 3 minutes',
      requiresKey: true,
      website: 'https://platform.stability.ai/',
      models: ['stable-audio-2.5'],
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
    try {
      const response = await fetch(`${this.baseUrl}/audio/generate`, {
        method: 'HEAD',
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.status !== 401;
    } catch {
      return false;
    }
  }

  async generate(request: AudioGenerationRequest): Promise<AudioGenerationResult> {
    if (!this.apiKey) throw new Error('Stability AI API key not configured. Run: audioforge config set stability.apiKey <key>');

    const startTime = Date.now();
    const duration = request.duration || 10;

    const body: Record<string, unknown> = {
      prompt: request.prompt,
      duration: Math.min(duration, 180),
      output_format: 'wav',
    };

    if (request.seed !== undefined) {
      body.seed = request.seed;
    }

    const response = await fetch(`${this.baseUrl}/audio/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'audio/*',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = (errorData as any)?.message || response.statusText;
      throw new Error(`Stability AI API error (${response.status}): ${msg}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const elapsed = Date.now() - startTime;

    return {
      audio: [{ base64, duration }],
      provider: 'stability',
      model: 'stable-audio-2.5',
      elapsed,
      metadata: {},
    };
  }

  async generateMusic(request: AudioGenerationRequest): Promise<AudioGenerationResult> {
    return this.generate(request);
  }

  async listModels(): Promise<string[]> {
    return this.info.models;
  }
}
