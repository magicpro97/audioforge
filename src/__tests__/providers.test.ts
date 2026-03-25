// Mock filesystem first
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock-home'),
}));

import * as fs from 'node:fs';

// Stub global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  vi.mocked(fs.existsSync).mockReturnValue(false);
  vi.mocked(fs.readFileSync).mockReturnValue('' as any);
  vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
});

// Imports
import { AudioProvider } from '../providers/base.js';
import { ElevenLabsProvider } from '../providers/elevenlabs.js';
import { StabilityProvider } from '../providers/stability.js';
import { FalProvider } from '../providers/fal.js';
import { ReplicateProvider } from '../providers/replicate.js';
import { createProvider, getAllProviderNames, createAllProviders } from '../providers/index.js';
import type { AudioGenerationRequest } from '../types/index.js';

// ─── Base Provider ────────────────────────────────

describe('AudioProvider (base)', () => {
  class TestProvider extends AudioProvider {
    get info() {
      return {
        name: 'test', displayName: 'Test', description: 'Test provider',
        requiresKey: false, website: 'http://test.com', models: ['test-model'],
      };
    }
    configure() {}
    isConfigured() { return true; }
    async validate() { return true; }
    async generate(req: AudioGenerationRequest) {
      return { audio: [], provider: 'test', model: 'test', elapsed: 0, metadata: {} };
    }
    async listModels() { return ['test-model']; }
  }

  it('generateMusic throws not supported by default', async () => {
    const p = new TestProvider();
    await expect(p.generateMusic({ prompt: 'test' })).rejects.toThrow('does not support music generation');
  });

  it('vary throws not supported by default', async () => {
    const p = new TestProvider();
    await expect(p.vary({ inputAudio: 'data' })).rejects.toThrow('does not support variations');
  });
});

// ─── Provider Registry ────────────────────────────

describe('provider registry', () => {
  it('createProvider returns correct provider instances', () => {
    expect(createProvider('elevenlabs')).toBeInstanceOf(ElevenLabsProvider);
    expect(createProvider('stability')).toBeInstanceOf(StabilityProvider);
    expect(createProvider('fal')).toBeInstanceOf(FalProvider);
    expect(createProvider('replicate')).toBeInstanceOf(ReplicateProvider);
  });

  it('createProvider is case-insensitive', () => {
    expect(createProvider('ElevenLabs')).toBeInstanceOf(ElevenLabsProvider);
  });

  it('createProvider throws for unknown provider', () => {
    expect(() => createProvider('unknown')).toThrow('Unknown provider "unknown"');
  });

  it('getAllProviderNames returns all registered names', () => {
    const names = getAllProviderNames();
    expect(names).toContain('elevenlabs');
    expect(names).toContain('stability');
    expect(names).toContain('fal');
    expect(names).toContain('replicate');
    expect(names).toHaveLength(4);
  });

  it('createAllProviders creates all instances', () => {
    const all = createAllProviders();
    expect(all.size).toBe(4);
    expect(all.get('elevenlabs')).toBeInstanceOf(ElevenLabsProvider);
    expect(all.get('stability')).toBeInstanceOf(StabilityProvider);
    expect(all.get('fal')).toBeInstanceOf(FalProvider);
    expect(all.get('replicate')).toBeInstanceOf(ReplicateProvider);
  });
});

// ─── ElevenLabs Provider ──────────────────────────

describe('ElevenLabsProvider', () => {
  let p: ElevenLabsProvider;
  beforeEach(() => { p = new ElevenLabsProvider(); });

  it('info returns correct metadata', () => {
    expect(p.info.name).toBe('elevenlabs');
    expect(p.info.requiresKey).toBe(true);
    expect(p.info.models).toContain('eleven_sfx_v2');
    expect(p.info.capabilities?.sfx).toBe(true);
  });

  it('configure and isConfigured', () => {
    expect(p.isConfigured()).toBe(false);
    p.configure('test-key');
    expect(p.isConfigured()).toBe(true);
  });

  it('validate returns false without key', async () => {
    expect(await p.validate()).toBe(false);
  });

  it('validate returns true on ok response', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({ ok: true });
    expect(await p.validate()).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain('/user');
  });

  it('validate returns false on error response', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({ ok: false });
    expect(await p.validate()).toBe(false);
  });

  it('validate returns false on network error', async () => {
    p.configure('key');
    mockFetch.mockRejectedValue(new Error('network'));
    expect(await p.validate()).toBe(false);
  });

  it('generate throws without API key', async () => {
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('API key not configured');
  });

  it('generate makes correct API call', async () => {
    p.configure('test-key');
    const audioData = Buffer.from('audio-data');
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(audioData.buffer.slice(audioData.byteOffset, audioData.byteOffset + audioData.byteLength)),
    });

    const result = await p.generate({ prompt: 'explosion', duration: 3 });
    expect(result.audio).toHaveLength(1);
    expect(result.provider).toBe('elevenlabs');
    expect(result.model).toBe('eleven_sfx_v2');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/sound-generation');
    expect(opts.headers['xi-api-key']).toBe('test-key');
    const body = JSON.parse(opts.body);
    expect(body.text).toBe('explosion');
    expect(body.duration_seconds).toBe(3);
  });

  it('generate caps duration at 30s', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await p.generate({ prompt: 'test', duration: 60 });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.duration_seconds).toBe(30);
  });

  it('generate uses default duration and promptInfluence', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await p.generate({ prompt: 'test' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.duration_seconds).toBe(5);
    expect(body.prompt_influence).toBe(0.3);
  });

  it('generate uses custom promptInfluence', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await p.generate({ prompt: 'test', promptInfluence: 0.8 });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.prompt_influence).toBe(0.8);
  });

  it('generate handles API error with detail message', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: () => Promise.resolve({ detail: { message: 'Invalid prompt' } }),
    });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('ElevenLabs API error (400): Invalid prompt');
  });

  it('generate handles API error without JSON body', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('no json')),
    });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('ElevenLabs API error (500): Internal Server Error');
  });

  it('listModels returns model list', async () => {
    const models = await p.listModels();
    expect(models).toEqual(['eleven_sfx_v2']);
  });
});

// ─── Stability Provider ───────────────────────────

describe('StabilityProvider', () => {
  let p: StabilityProvider;
  beforeEach(() => { p = new StabilityProvider(); });

  it('info returns correct metadata', () => {
    expect(p.info.name).toBe('stability');
    expect(p.info.capabilities?.music).toBe(true);
    expect(p.info.capabilities?.sfx).toBe(true);
  });

  it('configure and isConfigured', () => {
    expect(p.isConfigured()).toBe(false);
    p.configure('key');
    expect(p.isConfigured()).toBe(true);
  });

  it('validate returns false without key', async () => {
    expect(await p.validate()).toBe(false);
  });

  it('validate returns true on non-401 response', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({ status: 200 });
    expect(await p.validate()).toBe(true);
  });

  it('validate returns false on 401', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({ status: 401 });
    expect(await p.validate()).toBe(false);
  });

  it('validate returns false on network error', async () => {
    p.configure('key');
    mockFetch.mockRejectedValue(new Error('network'));
    expect(await p.validate()).toBe(false);
  });

  it('generate throws without API key', async () => {
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('API key not configured');
  });

  it('generate makes correct API call', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    const result = await p.generate({ prompt: 'rain', duration: 10, seed: 42 });
    expect(result.provider).toBe('stability');
    expect(result.model).toBe('stable-audio-2.5');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/audio/generate');
    expect(opts.headers.Authorization).toBe('Bearer key');
    const body = JSON.parse(opts.body);
    expect(body.prompt).toBe('rain');
    expect(body.duration).toBe(10);
    expect(body.seed).toBe(42);
  });

  it('generate caps duration at 180s', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await p.generate({ prompt: 'test', duration: 300 });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.duration).toBe(180);
  });

  it('generate uses default duration when not specified', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await p.generate({ prompt: 'test' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.duration).toBe(10);
  });

  it('generate does not include seed when not specified', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await p.generate({ prompt: 'test' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.seed).toBeUndefined();
  });

  it('generate handles API error', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: () => Promise.resolve({ message: 'Rate limited' }),
    });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('Stability AI API error (429): Rate limited');
  });

  it('generate handles API error without JSON', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.reject(new Error()),
    });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('Stability AI API error (500): Server Error');
  });

  it('generateMusic delegates to generate', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    const result = await p.generateMusic({ prompt: 'ambient music' });
    expect(result.provider).toBe('stability');
  });

  it('listModels returns model list', async () => {
    expect(await p.listModels()).toEqual(['stable-audio-2.5']);
  });
});

// ─── Fal Provider ─────────────────────────────────

describe('FalProvider', () => {
  let p: FalProvider;
  beforeEach(() => { p = new FalProvider(); });

  it('info returns correct metadata', () => {
    expect(p.info.name).toBe('fal');
    expect(p.info.models).toContain('cassetteai/sound-effects-generator');
    expect(p.info.capabilities?.music).toBe(true);
  });

  it('configure and isConfigured', () => {
    expect(p.isConfigured()).toBe(false);
    p.configure('key');
    expect(p.isConfigured()).toBe(true);
  });

  it('validate returns false without key', async () => {
    expect(await p.validate()).toBe(false);
  });

  it('validate returns true with key', async () => {
    p.configure('key');
    expect(await p.validate()).toBe(true);
  });

  it('generate throws without API key', async () => {
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('API key not configured');
  });

  it('generate makes correct API call with audio_file url', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ audio_file: { url: 'http://fal.ai/audio.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    const result = await p.generate({ prompt: 'click sound', duration: 5, seed: 123 });
    expect(result.provider).toBe('fal');
    expect(result.model).toBe('cassetteai/sound-effects-generator');
    expect(result.audio).toHaveLength(1);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('cassetteai/sound-effects-generator');
    expect(opts.headers.Authorization).toBe('Key key');
    const body = JSON.parse(opts.body);
    expect(body.prompt).toBe('click sound');
    expect(body.seed).toBe(123);
  });

  it('generate handles audio.url response shape', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ audio: { url: 'http://fal.ai/out.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });
    const result = await p.generate({ prompt: 'test' });
    expect(result.audio).toHaveLength(1);
  });

  it('generate handles output.url response shape', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ output: { url: 'http://fal.ai/o.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });
    const result = await p.generate({ prompt: 'test' });
    expect(result.audio).toHaveLength(1);
  });

  it('generate throws when no audio URL in response', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ something: 'else' }),
    });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('No audio URL in response');
  });

  it('generate caps duration at 30s', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ audio_file: { url: 'http://fal.ai/a.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });
    await p.generate({ prompt: 'test', duration: 60 });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.duration).toBe(30);
  });

  it('generate uses custom model', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ audio_file: { url: 'http://fal.ai/a.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });
    await p.generate({ prompt: 'test', model: 'beatoven/sound-effect-generation' });
    expect(mockFetch.mock.calls[0][0]).toContain('beatoven/sound-effect-generation');
  });

  it('generate does not include seed when not specified', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ audio_file: { url: 'http://fal.ai/a.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });
    await p.generate({ prompt: 'test' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.seed).toBeUndefined();
  });

  it('generate handles submit API error', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: () => Promise.resolve({ detail: 'Invalid key' }),
    });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('fal.ai API error (403): Invalid key');
  });

  it('generate handles submit API error without JSON', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Error',
      json: () => Promise.reject(new Error()),
    });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('fal.ai API error (500): Error');
  });

  it('generate handles audio download failure', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ audio_file: { url: 'http://fal.ai/a.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('Failed to download audio from fal.ai');
  });

  it('generateMusic uses beatoven/music-generation by default', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ audio_file: { url: 'http://fal.ai/m.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });
    await p.generateMusic({ prompt: 'ambient music' });
    expect(mockFetch.mock.calls[0][0]).toContain('beatoven/music-generation');
  });

  it('generateMusic uses custom model when specified', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ audio_file: { url: 'http://fal.ai/m.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });
    await p.generateMusic({ prompt: 'test', model: 'custom-model' });
    expect(mockFetch.mock.calls[0][0]).toContain('custom-model');
  });

  it('listModels returns model list', async () => {
    expect(await p.listModels()).toHaveLength(3);
  });
});

// ─── Replicate Provider ───────────────────────────

describe('ReplicateProvider', () => {
  let p: ReplicateProvider;
  beforeEach(() => { p = new ReplicateProvider(); });

  it('info returns correct metadata', () => {
    expect(p.info.name).toBe('replicate');
    expect(p.info.capabilities?.variations).toBe(true);
    expect(p.info.models).toContain('meta/musicgen');
  });

  it('configure and isConfigured', () => {
    expect(p.isConfigured()).toBe(false);
    p.configure('key');
    expect(p.isConfigured()).toBe(true);
  });

  it('validate returns false without key', async () => {
    expect(await p.validate()).toBe(false);
  });

  it('validate returns true on ok response', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({ ok: true });
    expect(await p.validate()).toBe(true);
  });

  it('validate returns false on error', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({ ok: false });
    expect(await p.validate()).toBe(false);
  });

  it('validate returns false on network error', async () => {
    p.configure('key');
    mockFetch.mockRejectedValue(new Error('network'));
    expect(await p.validate()).toBe(false);
  });

  it('generate throws without API key', async () => {
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('API key not configured');
  });

  it('generate with immediate success (no polling needed)', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred1',
          status: 'succeeded',
          output: 'http://replicate.com/audio.wav',
          urls: { get: 'http://replicate.com/predictions/pred1' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    const result = await p.generate({ prompt: 'guitar riff', duration: 8, seed: 42 });
    expect(result.provider).toBe('replicate');
    expect(result.audio).toHaveLength(1);
    expect(result.metadata.predictionId).toBe('pred1');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.input.prompt).toBe('guitar riff');
    expect(body.input.duration).toBe(8);
    expect(body.input.seed).toBe(42);
  });

  it('generate with polling', async () => {
    vi.useFakeTimers();
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred2',
          status: 'starting',
          urls: { get: 'http://replicate.com/predictions/pred2' },
        }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'processing' }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'succeeded', output: ['http://replicate.com/out.wav'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    const promise = p.generate({ prompt: 'test' });
    // Advance through two polling intervals
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;
    expect(result.audio).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it('generate uses audiogen version for audiogen model', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred3',
          status: 'succeeded',
          output: 'http://replicate.com/audio.wav',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    await p.generate({ prompt: 'test', model: 'meta/audiogen' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.version).toBe('audiogen-medium');
  });

  it('generate uses melody-large for musicgen model', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred4',
          status: 'succeeded',
          output: 'http://replicate.com/audio.wav',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    await p.generate({ prompt: 'test', model: 'meta/musicgen' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.version).toBe('melody-large');
  });

  it('generate uses default model when not specified', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred',
          status: 'succeeded',
          output: 'http://replicate.com/audio.wav',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    const result = await p.generate({ prompt: 'test' });
    expect(result.model).toBe('meta/musicgen');
  });

  it('generate caps duration at 30s', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred',
          status: 'succeeded',
          output: 'http://replicate.com/audio.wav',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    await p.generate({ prompt: 'test', duration: 60 });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.input.duration).toBe(30);
  });

  it('generate does not include seed when not specified', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred',
          status: 'succeeded',
          output: 'http://replicate.com/audio.wav',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    await p.generate({ prompt: 'test' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.input.seed).toBeUndefined();
  });

  it('generate handles prediction failure', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred',
          status: 'failed',
        }),
      });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('prediction failed');
  });

  it('generate handles prediction timeout', async () => {
    vi.useFakeTimers();
    p.configure('key');
    // Return starting status, then keep returning processing forever
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred-timeout',
          status: 'starting',
          urls: { get: 'http://replicate.com/predictions/pred-timeout' },
        }),
      });
    // Mock all poll calls to return processing
    for (let i = 0; i < 200; i++) {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'processing' }),
      });
    }

    const promise = p.generate({ prompt: 'test' });
    // Advance past the 5-minute (300000ms) timeout
    await vi.advanceTimersByTimeAsync(303000);
    await expect(promise).rejects.toThrow('timed out');
    vi.useRealTimers();
  });

  it('generate handles no audio URL in output', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred',
          status: 'succeeded',
          output: null,
        }),
      });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('No audio URL');
  });

  it('generate handles output.audio format', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred',
          status: 'succeeded',
          output: { audio: 'http://replicate.com/audio.wav' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
    const result = await p.generate({ prompt: 'test' });
    expect(result.audio).toHaveLength(1);
  });

  it('generate handles create API error', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable',
      json: () => Promise.resolve({ detail: 'Bad input' }),
    });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('Replicate API error (422): Bad input');
  });

  it('generate handles create API error without JSON', async () => {
    p.configure('key');
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Error',
      json: () => Promise.reject(new Error()),
    });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('Replicate API error (500): Error');
  });

  it('generate handles audio download failure', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred',
          status: 'succeeded',
          output: 'http://replicate.com/audio.wav',
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
    await expect(p.generate({ prompt: 'test' })).rejects.toThrow('Failed to download audio from Replicate');
  });

  it('generate uses fallback poll URL when urls.get not available', async () => {
    vi.useFakeTimers();
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred123',
          status: 'starting',
          // no urls.get
        }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'succeeded', output: 'http://replicate.com/audio.wav' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });

    const promise = p.generate({ prompt: 'test' });
    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;
    expect(result.audio).toHaveLength(1);
    // Second call should be to fallback URL
    expect(mockFetch.mock.calls[1][0]).toContain('/predictions/pred123');
    vi.useRealTimers();
  });

  it('generateMusic uses meta/musicgen by default', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred',
          status: 'succeeded',
          output: 'http://replicate.com/music.wav',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
    const result = await p.generateMusic({ prompt: 'ambient' });
    expect(result.model).toBe('meta/musicgen');
  });

  it('generateMusic uses custom model when specified', async () => {
    p.configure('key');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'pred',
          status: 'succeeded',
          output: 'http://replicate.com/music.wav',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
    const result = await p.generateMusic({ prompt: 'test', model: 'custom/model' });
    expect(result.model).toBe('custom/model');
  });

  it('listModels returns model list', async () => {
    expect(await p.listModels()).toEqual(['meta/musicgen', 'meta/audiogen']);
  });
});
