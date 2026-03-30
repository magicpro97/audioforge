import { AudioProvider } from './base.js';
import type { AudioGenerationRequest, AudioGenerationResult, ProviderInfo } from '../types/index.js';
import {
  replicateValidateApiKey,
  replicatePollPrediction,
  type ReplicateOptions,
  type ReplicatePrediction,
} from '@magicpro97/forge-core';

// Official models need version-based endpoint (model-based returns 404)
const VERSION_MAP: Record<string, string> = {
  'meta/musicgen': '671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb',
};

export class ReplicateProvider extends AudioProvider {
  private apiKey: string = '';
  private baseUrl = 'https://api.replicate.com/v1';

  get info(): ProviderInfo {
    return {
      name: 'replicate',
      displayName: 'Replicate (MusicGen)',
      description: "Meta's MusicGen — music and sound effects generation",
      requiresKey: true,
      website: 'https://replicate.com/',
      models: ['meta/musicgen'],
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
    return replicateValidateApiKey({ apiKey: this.apiKey, baseUrl: this.baseUrl });
  }

  async generate(request: AudioGenerationRequest): Promise<AudioGenerationResult> {
    if (!this.apiKey) throw new Error('Replicate API key not configured. Run: audioforge config set replicate.apiKey <key>');

    const startTime = Date.now();
    const model = request.model || 'meta/musicgen';
    const duration = request.duration || 8;

    const input: Record<string, unknown> = {
      prompt: request.prompt,
      duration: Math.min(duration, 30),
      ...(request.seed !== undefined ? { seed: request.seed } : {}),
    };

    // Official models (meta/*) need version-based endpoint; others use model-based
    const version = VERSION_MAP[model];
    const url = version
      ? `${this.baseUrl}/predictions`
      : `${this.baseUrl}/models/${model}/predictions`;
    const body = version
      ? { version, input }
      : { input };

    const createResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.apiKey}`,
        Prefer: 'wait',
      },
      body: JSON.stringify(body),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json().catch(() => ({}));
      const msg = (errorData as any)?.detail || createResponse.statusText;
      throw new Error(`Replicate API error (${createResponse.status}): ${msg}`);
    }

    const prediction = await createResponse.json() as ReplicatePrediction;

    let output: unknown;
    if (prediction.status === 'succeeded') {
      output = prediction.output;
    } else if (prediction.status === 'failed') {
      throw new Error('Replicate prediction failed');
    } else {
      const replicateOpts: ReplicateOptions = {
        apiKey: this.apiKey,
        baseUrl: this.baseUrl,
        timeoutMs: 300000,
        pollIntervalMs: 3000,
      };
      const completed = await replicatePollPrediction(replicateOpts, prediction);
      output = completed.output;
    }

    // Download audio
    const audioUrl = typeof output === 'string' ? output : (output as any)?.[0] || (output as any)?.audio;
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
