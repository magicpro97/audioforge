import { AudioProvider } from './base.js';
import type { AudioGenerationRequest, AudioGenerationResult, ProviderInfo } from '../types/index.js';

export class ElevenLabsProvider extends AudioProvider {
  private apiKey: string = '';
  private baseUrl = 'https://api.elevenlabs.io/v1';

  get info(): ProviderInfo {
    return {
      name: 'elevenlabs',
      displayName: 'ElevenLabs (Sound Effects)',
      description: 'High-quality AI sound effects from text descriptions',
      requiresKey: true,
      website: 'https://elevenlabs.io/api',
      models: ['eleven_sfx_v2'],
      capabilities: { sfx: true, loop: true },
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
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: { 'xi-api-key': this.apiKey },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(request: AudioGenerationRequest): Promise<AudioGenerationResult> {
    if (!this.apiKey) throw new Error('ElevenLabs API key not configured. Run: audioforge config set elevenlabs.apiKey <key>');

    const startTime = Date.now();
    const duration = request.duration || 5;

    const body: Record<string, unknown> = {
      text: request.prompt,
      duration_seconds: Math.min(duration, 30),
      prompt_influence: request.promptInfluence ?? 0.3,
    };

    const response = await fetch(`${this.baseUrl}/sound-generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = (errorData as any)?.detail?.message || response.statusText;
      throw new Error(`ElevenLabs API error (${response.status}): ${msg}`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const elapsed = Date.now() - startTime;

    return {
      audio: [{ base64, duration }],
      provider: 'elevenlabs',
      model: 'eleven_sfx_v2',
      elapsed,
      metadata: {},
    };
  }

  async listModels(): Promise<string[]> {
    return this.info.models;
  }
}
