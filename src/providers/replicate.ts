import { AudioProvider } from './base.js';
import type { AudioGenerationRequest, AudioGenerationResult, ProviderInfo } from '../types/index.js';

export class ReplicateProvider extends AudioProvider {
  private apiKey: string = '';
  private baseUrl = 'https://api.replicate.com/v1';

  get info(): ProviderInfo {
    return {
      name: 'replicate',
      displayName: 'Replicate (MusicGen / AudioGen)',
      description: "Meta's AudioCraft models — MusicGen for music, AudioGen for sound effects",
      requiresKey: true,
      website: 'https://replicate.com/',
      models: ['meta/musicgen', 'meta/audiogen'],
      capabilities: { sfx: true, music: true, variations: true },
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
      const response = await fetch(`${this.baseUrl}/account`, {
        headers: { Authorization: `Token ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(request: AudioGenerationRequest): Promise<AudioGenerationResult> {
    if (!this.apiKey) throw new Error('Replicate API key not configured. Run: audioforge config set replicate.apiKey <key>');

    const startTime = Date.now();
    const model = request.model || 'meta/musicgen';
    const duration = request.duration || 8;

    const body = {
      version: model === 'meta/audiogen'
        ? 'audiogen-medium'
        : 'melody-large',
      input: {
        prompt: request.prompt,
        duration: Math.min(duration, 30),
        ...(request.seed !== undefined ? { seed: request.seed } : {}),
      },
    };

    // Create prediction
    const createResponse = await fetch(`${this.baseUrl}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      const msg = (errorData as any)?.detail || createResponse.statusText;
      throw new Error(`Replicate API error (${createResponse.status}): ${msg}`);
    }

    const prediction: any = await createResponse.json();
    let status = prediction.status;
    let output = prediction.output;
    let pollUrl = prediction.urls?.get || `${this.baseUrl}/predictions/${prediction.id}`;

    // Poll for completion (max 5 minutes)
    const maxWait = 300000;
    const pollInterval = 3000;
    let waited = 0;

    while (status !== 'succeeded' && status !== 'failed' && waited < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval));
      waited += pollInterval;

      const pollResponse = await fetch(pollUrl, {
        headers: { Authorization: `Token ${this.apiKey}` },
      });
      const pollData: any = await pollResponse.json();
      status = pollData.status;
      output = pollData.output;
    }

    if (status === 'failed') {
      throw new Error('Replicate prediction failed');
    }
    if (status !== 'succeeded') {
      throw new Error('Replicate prediction timed out');
    }

    // Download audio
    const audioUrl = typeof output === 'string' ? output : output?.[0] || output?.audio;
    if (!audioUrl) {
      throw new Error('Replicate: No audio URL in prediction output');
    }

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio from Replicate (${audioResponse.status})`);
    }

    const buffer = await audioResponse.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const elapsed = Date.now() - startTime;

    return {
      audio: [{ base64, url: audioUrl, duration }],
      provider: 'replicate',
      model,
      elapsed,
      metadata: { predictionId: prediction.id },
    };
  }

  async generateMusic(request: AudioGenerationRequest): Promise<AudioGenerationResult> {
    const musicRequest = {
      ...request,
      model: request.model || 'meta/musicgen',
    };
    return this.generate(musicRequest);
  }

  async listModels(): Promise<string[]> {
    return this.info.models;
  }
}
