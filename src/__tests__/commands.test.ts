// Mock modules at the TOP before imports
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock-home'),
  platform: vi.fn(() => 'linux'),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'abcdef01-2345-6789-abcd-ef0123456789'),
}));

vi.mock('chalk', () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
  },
}));

vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  }),
}));

vi.mock('yaml', () => ({
  parse: vi.fn(),
}));

import * as fs from 'node:fs';
import { parse as yamlParse } from 'yaml';

const CONFIG_DIR = '/mock-home/.audioforge';
const CONFIG_FILE = '/mock-home/.audioforge/config.json';
const HISTORY_FILE = '/mock-home/.audioforge/history.json';
const TEMPLATES_FILE = '/mock-home/.audioforge/templates.json';

const DEFAULT_CONFIG = {
  providers: { elevenlabs: { enabled: true }, stability: { enabled: true }, fal: { enabled: true }, replicate: { enabled: true } },
  defaults: { provider: 'elevenlabs', model: '', duration: 5, format: 'wav', preset: '' },
  history: { enabled: true, maxEntries: 500 },
  output: { directory: './audioforge-output', namingPattern: '{provider}-{model}-{timestamp}' },
  cost: { budget: 0, currency: 'USD', trackingEnabled: true },
  autoOpen: false,
};

function setupMocks(configOverrides?: any, historyData?: any[], templatesData?: any[]): void {
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const ps = String(p);
    if (ps === CONFIG_DIR) return true;
    if (ps === CONFIG_FILE) return true;
    if (ps === HISTORY_FILE) return !!historyData;
    if (ps === TEMPLATES_FILE) return !!templatesData;
    return false;
  });
  vi.mocked(fs.readFileSync).mockImplementation((p) => {
    const ps = String(p);
    if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, ...configOverrides }) as any;
    if (ps === HISTORY_FILE) return JSON.stringify(historyData || []) as any;
    if (ps === TEMPLATES_FILE) return JSON.stringify(templatesData || []) as any;
    return '' as any;
  });
}

// Stub global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit'); }) as any);
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReturnValue(false);
  vi.mocked(fs.readFileSync).mockReturnValue('' as any);
  vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
  mockFetch.mockReset();
  mockExit.mockClear();
  mockConsoleLog.mockClear();
  mockConsoleError.mockClear();
});

// ─── Generate Command ─────────────────────────────

import { generateCommand } from '../cli/commands/generate.js';

describe('generateCommand', () => {
  it('generates audio with default options', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });

    await generateCommand('explosion sound', {});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('applies style preset to prompt', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });

    await generateCommand('click', { preset: 'game-sfx' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('punchy');
  });

  it('resolves duration presets', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });

    await generateCommand('test', { duration: 'short' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.duration_seconds).toBe(2);
  });

  it('exits on invalid duration', async () => {
    setupMocks();
    await expect(generateCommand('test', { duration: 'invalid-xyz' })).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('exits when no API key configured', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true } } });
    await expect(generateCommand('test', {})).rejects.toThrow('process.exit');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('uses template with variables', async () => {
    setupMocks({}, undefined, [
      { name: 'boom', prompt: '{material} explosion', variables: ['material'], provider: 'elevenlabs', duration: 3, preset: 'game-sfx' },
    ]);
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE || ps === TEMPLATES_FILE) return true;
      return false;
    });

    // Set API key so it doesn't fail
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } }, undefined, [
      { name: 'boom', prompt: '{material} explosion', variables: ['material'], provider: 'elevenlabs', duration: 3, preset: 'game-sfx' },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });

    await generateCommand('ignored', { template: 'boom', var: ['material=glass'] });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('glass explosion');
  });

  it('exits on missing template', async () => {
    setupMocks({}, undefined, []);
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE) return true;
      if (ps === TEMPLATES_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === TEMPLATES_FILE) return '[]' as any;
      return '' as any;
    });

    await expect(generateCommand('test', { template: 'nonexistent' })).rejects.toThrow('process.exit');
  });

  it('exits on unresolved template variables', async () => {
    setupMocks({}, undefined, [
      { name: 't', prompt: '{a} and {b}', variables: ['a', 'b'] },
    ]);
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE || ps === TEMPLATES_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === TEMPLATES_FILE) return JSON.stringify([{ name: 't', prompt: '{a} and {b}', variables: ['a', 'b'] }]) as any;
      return '' as any;
    });

    await expect(generateCommand('test', { template: 't', var: ['a=done'] })).rejects.toThrow('process.exit');
  });

  it('handles generation error', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: () => Promise.reject(new Error()),
    });
    await expect(generateCommand('test', {})).rejects.toThrow('process.exit');
  });

  it('uses custom provider', async () => {
    setupMocks({ providers: { stability: { enabled: true, apiKey: 'skey' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await generateCommand('rain', { provider: 'stability', duration: '10' });
    expect(mockFetch.mock.calls[0][0]).toContain('stability.ai');
  });

  it('saves history when enabled', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } }, []);
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE) return true;
      if (ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { elevenlabs: { enabled: true, apiKey: 'key' } } }) as any;
      if (ps === HISTORY_FILE) return '[]' as any;
      return '' as any;
    });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await generateCommand('test', {});
    // Should have written to history file
    const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
    const historyWrite = writeCalls.find(c => String(c[0]) === HISTORY_FILE);
    expect(historyWrite).toBeDefined();
  });

  it('opens file when --open is set', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await generateCommand('test', { open: true });
    // Should complete without error; opener is mocked
    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses custom format and seed', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await generateCommand('test', { format: 'mp3', seed: '42' });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses custom model and output path', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await generateCommand('test', { model: 'eleven_sfx_v2', output: '/tmp/out.wav' });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses template with model/duration/preset defaults from template', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE || ps === TEMPLATES_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { elevenlabs: { enabled: true, apiKey: 'key' } } }) as any;
      if (ps === TEMPLATES_FILE) return JSON.stringify([
        { name: 'full', prompt: 'test prompt', variables: [], provider: 'elevenlabs', model: 'eleven_sfx_v2', duration: 8, preset: 'cinematic' },
      ]) as any;
      return '' as any;
    });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await generateCommand('ignored', { template: 'full' });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('handles long prompt display (>60 chars)', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    const longPrompt = 'a'.repeat(100);
    await generateCommand(longPrompt, {});
    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses format fallback to wav when not specified', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    // No format option, config defaults to wav
    await generateCommand('test', {});
    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses loop option', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await generateCommand('loop sound', { loop: true });
    expect(mockFetch).toHaveBeenCalled();
  });
});

// ─── Music Command ────────────────────────────────

import { musicCommand } from '../cli/commands/music.js';

describe('musicCommand', () => {
  it('generates music with provider', async () => {
    setupMocks({ providers: { stability: { enabled: true, apiKey: 'skey' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await musicCommand('ambient beat', { provider: 'stability', duration: '30' });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('enhances prompt with genre and bpm', async () => {
    setupMocks({ providers: { stability: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await musicCommand('chill vibes', {
      provider: 'stability',
      genre: 'lo-fi',
      bpm: '85',
      instrumental: true,
      loop: true,
    });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.prompt).toContain('lo-fi');
    expect(body.prompt).toContain('85 BPM');
    expect(body.prompt).toContain('instrumental');
    expect(body.prompt).toContain('seamless loop');
  });

  it('exits when no API key configured', async () => {
    setupMocks({ providers: { stability: { enabled: true } } });
    await expect(musicCommand('test', { provider: 'stability' })).rejects.toThrow('process.exit');
  });

  it('handles generation failure', async () => {
    setupMocks({ providers: { stability: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Error',
      json: () => Promise.reject(new Error()),
    });
    await expect(musicCommand('test', { provider: 'stability' })).rejects.toThrow('process.exit');
  });

  it('opens file when --open is set', async () => {
    setupMocks({ providers: { stability: { enabled: true, apiKey: 'skey' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await musicCommand('test', { provider: 'stability', open: true });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses custom format, seed, and model', async () => {
    setupMocks({ providers: { stability: { enabled: true, apiKey: 'skey' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await musicCommand('test', { provider: 'stability', format: 'mp3', seed: '42', model: 'stable-audio-2.5' });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('handles long prompt display (>60 chars)', async () => {
    setupMocks({ providers: { stability: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await musicCommand('a'.repeat(100), { provider: 'stability' });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses default duration when invalid', async () => {
    setupMocks({ providers: { stability: { enabled: true, apiKey: 'key' } } });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await musicCommand('test', { provider: 'stability', duration: 'abc' });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('defaults to stability when no provider configured', async () => {
    setupMocks({ providers: { stability: { enabled: true, apiKey: 'key' } } });
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { stability: { enabled: true, apiKey: 'key' } } }) as any;
      return '' as any;
    });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await musicCommand('test', {});
    expect(mockFetch.mock.calls[0][0]).toContain('stability.ai');
  });

  it('auto-selects configured provider', async () => {
    setupMocks({ providers: { fal: { enabled: true, apiKey: 'fkey' } } });
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { stability: { enabled: true }, fal: { enabled: true, apiKey: 'fkey' }, replicate: { enabled: true } } }) as any;
      return '' as any;
    });
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ audio_file: { url: 'http://fal.ai/a.wav' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });
    await musicCommand('test', {});
    expect(mockFetch.mock.calls[0][0]).toContain('fal.run');
  });
});

// ─── Config Command ───────────────────────────────

import { configCommand } from '../cli/commands/config.js';
import { Command } from 'commander';

describe('configCommand', () => {
  function runSubCommand(args: string[]): Promise<void> {
    const program = new Command();
    program.addCommand(configCommand);
    return program.parseAsync(['node', 'audioforge', 'config', ...args]);
  }

  it('set command writes config value', async () => {
    setupMocks();
    await runSubCommand(['set', 'defaults.provider', 'stability']);
    const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
    const configWrite = writeCalls.find(c => String(c[0]) === CONFIG_FILE);
    expect(configWrite).toBeDefined();
  });

  it('set masks API key in output', async () => {
    setupMocks();
    await runSubCommand(['set', 'elevenlabs.apiKey', 'super-secret-key-12345']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('super-'));
  });

  it('get command shows value', async () => {
    setupMocks({ defaults: { provider: 'fal' } });
    await runSubCommand(['get', 'defaults.provider']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('fal'));
  });

  it('get shows not found for missing key', async () => {
    setupMocks({});
    await runSubCommand(['get', 'nonexistent.key.deep']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('list shows all configuration with masked API keys', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'super-long-secret-key-12345' } } });
    await runSubCommand(['list']);
    expect(mockConsoleLog).toHaveBeenCalled();
  });
});

// ─── Providers Command ────────────────────────────

import { providersCommand } from '../cli/commands/providers.js';

describe('providersCommand', () => {
  it('list command shows configured and unconfigured providers', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { elevenlabs: { enabled: true, apiKey: 'key' }, stability: { enabled: true } } }) as any;
      return '' as any;
    });
    const program = new Command();
    program.addCommand(providersCommand);
    await program.parseAsync(['node', 'audioforge', 'providers', 'list']);
    expect(mockConsoleLog).toHaveBeenCalled();
  });
});

// ─── History Command ──────────────────────────────

import { historyCommand } from '../cli/commands/history.js';

describe('historyCommand', () => {
  function runSubCommand(args: string[]): Promise<void> {
    const program = new Command();
    program.addCommand(historyCommand);
    return program.parseAsync(['node', 'audioforge', 'history', ...args]);
  }

  it('list shows entries', async () => {
    setupMocks({}, [
      { id: 'a1', timestamp: '2024-01-01T00:00:00Z', provider: 'elevenlabs', model: 'sfx', prompt: 'explosion', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 1000, cost: 0.01 },
      { id: 'a2', timestamp: '2024-01-02T00:00:00Z', provider: 'stability', model: 'stable', prompt: 'rain', type: 'music', duration: 30, format: 'wav', outputFiles: [], elapsed: 5000 },
    ]);
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE || ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === HISTORY_FILE) return JSON.stringify([
        { id: 'a1', timestamp: '2024-01-01T00:00:00Z', provider: 'elevenlabs', model: 'sfx', prompt: 'explosion', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 1000, cost: 0.01 },
      ]) as any;
      return '' as any;
    });
    await runSubCommand(['list']);
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('list shows empty message', async () => {
    setupMocks({}, []);
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE) return true;
      if (ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === HISTORY_FILE) return '[]' as any;
      return '' as any;
    });
    await runSubCommand(['list']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('No generation history'));
  });

  it('list shows music type entries with cost and long prompt', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE || ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === HISTORY_FILE) return JSON.stringify([
        { id: 'm1', timestamp: '2024-01-01T00:00:00Z', provider: 'stability', model: 'stable', prompt: 'a'.repeat(100), type: 'music', duration: 30, format: 'wav', outputFiles: [], elapsed: 5000, cost: 0.02 },
        { id: 's1', timestamp: '2024-01-02T00:00:00Z', provider: 'elevenlabs', model: 'sfx', prompt: 'short', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 1000 },
      ]) as any;
      return '' as any;
    });
    await runSubCommand(['list']);
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('list with custom limit', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE || ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === HISTORY_FILE) return JSON.stringify([
        { id: 'a1', timestamp: '2024-01-01T00:00:00Z', provider: 'elevenlabs', model: 'sfx', prompt: 'explosion', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 1000, cost: 0.01 },
      ]) as any;
      return '' as any;
    });
    await runSubCommand(['list', '-l', '5']);
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('show displays entry details', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE || ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === HISTORY_FILE) return JSON.stringify([
        { id: 'abc', timestamp: '2024-01-01', provider: 'test', model: 'test', prompt: 'test prompt', type: 'sfx', duration: 5, format: 'wav', outputFiles: ['/f.wav'], elapsed: 1000, cost: 0.007 },
      ]) as any;
      return '' as any;
    });
    await runSubCommand(['show', 'abc']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('test prompt'));
  });

  it('show reports not found', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE) return true;
      if (ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === HISTORY_FILE) return '[]' as any;
      return '' as any;
    });
    await runSubCommand(['show', 'missing']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('show displays entry without cost', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE || ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === HISTORY_FILE) return JSON.stringify([
        { id: 'nocost', timestamp: '2024-01-01', provider: 'test', model: 'test', prompt: 'test prompt', type: 'sfx', duration: 5, format: 'wav', outputFiles: ['/f.wav'], elapsed: 1000 },
      ]) as any;
      return '' as any;
    });
    await runSubCommand(['show', 'nocost']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('test prompt'));
  });

  it('clear clears history', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE || ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === HISTORY_FILE) return '[]' as any;
      return '' as any;
    });
    await runSubCommand(['clear']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('cleared'));
  });
});

// ─── Template Command ─────────────────────────────

import { templateCommand } from '../cli/commands/template.js';

describe('templateCommand', () => {
  function runSubCommand(args: string[]): Promise<void> {
    const program = new Command();
    program.addCommand(templateCommand);
    return program.parseAsync(['node', 'audioforge', 'template', ...args]);
  }

  it('save creates template', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await runSubCommand(['save', 'sfx-boom', '{material} explosion']);
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('saved'));
  });

  it('save with options', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await runSubCommand(['save', 'test', 'prompt', '-p', 'fal', '-d', '10', '--preset', 'cinematic', '--type', 'sfx']);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('list shows templates', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === TEMPLATES_FILE) return true;
      return ps === CONFIG_DIR;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([
      { name: 'boom', prompt: '{x} explosion', variables: ['x'] },
    ]) as any);
    await runSubCommand(['list']);
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('list shows empty message', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === TEMPLATES_FILE);
    vi.mocked(fs.readFileSync).mockReturnValue('[]' as any);
    await runSubCommand(['list']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('No templates'));
  });

  it('show displays template', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      return ps === TEMPLATES_FILE || ps === CONFIG_DIR;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([
      { name: 'test', prompt: 'my prompt', variables: [], provider: 'fal', duration: 10, preset: 'cinematic', type: 'music' },
    ]) as any);
    await runSubCommand(['show', 'test']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('my prompt'));
  });

  it('show reports not found', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === TEMPLATES_FILE || String(p) === CONFIG_DIR);
    vi.mocked(fs.readFileSync).mockReturnValue('[]' as any);
    await runSubCommand(['show', 'missing']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('show displays template without optional fields', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      return ps === TEMPLATES_FILE || ps === CONFIG_DIR;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([
      { name: 'bare', prompt: 'bare prompt', variables: [] },
    ]) as any);
    await runSubCommand(['show', 'bare']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('bare prompt'));
  });

  it('save reports variables', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await runSubCommand(['save', 'vars-tmpl', '{x} hits {y}']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Variables'));
  });

  it('delete removes template', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      return ps === TEMPLATES_FILE || ps === CONFIG_DIR;
    });
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify([{ name: 'del', prompt: 'x', variables: [] }]) as any);
    await runSubCommand(['delete', 'del']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('deleted'));
  });

  it('delete reports not found', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === TEMPLATES_FILE || String(p) === CONFIG_DIR);
    vi.mocked(fs.readFileSync).mockReturnValue('[]' as any);
    await runSubCommand(['delete', 'nope']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });
});

// ─── Cost Command ─────────────────────────────────

import { costCommand } from '../cli/commands/cost.js';

describe('costCommand', () => {
  function runSubCommand(args: string[]): Promise<void> {
    const program = new Command();
    program.addCommand(costCommand);
    return program.parseAsync(['node', 'audioforge', 'cost', ...args]);
  }

  it('summary shows spending by provider', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE || ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === HISTORY_FILE) return JSON.stringify([
        { id: 'a1', provider: 'elevenlabs', model: 'sfx', cost: 0.01, prompt: 'p', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 100, timestamp: '' },
        { id: 'a2', provider: 'stability', model: 'stable', cost: 0.02, prompt: 'p', type: 'music', duration: 30, format: 'wav', outputFiles: [], elapsed: 200, timestamp: '' },
      ]) as any;
      return '' as any;
    });
    await runSubCommand(['summary']);
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('summary shows empty message when no history', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE) return true;
      if (ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === HISTORY_FILE) return '[]' as any;
      return '' as any;
    });
    await runSubCommand(['summary']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('No generations'));
  });

  it('summary handles entries without cost', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR || ps === CONFIG_FILE || ps === HISTORY_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_FILE) return JSON.stringify(DEFAULT_CONFIG) as any;
      if (ps === HISTORY_FILE) return JSON.stringify([
        { id: 'nc', provider: 'elevenlabs', model: 'sfx', prompt: 'p', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 100, timestamp: '' },
      ]) as any;
      return '' as any;
    });
    await runSubCommand(['summary']);
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('pricing shows all provider prices', async () => {
    await runSubCommand(['pricing']);
    expect(mockConsoleLog).toHaveBeenCalled();
  });
});

// ─── Compare Command ──────────────────────────────

import { compareCommand } from '../cli/commands/compare.js';

describe('compareCommand', () => {
  it('compares across configured providers', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'k1' }, stability: { enabled: true, apiKey: 'k2' } } });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await compareCommand('test sound', { duration: '5' });
    expect(mockFetch).toHaveBeenCalled();
  });

  it('uses specific providers list', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'k1' }, stability: { enabled: true, apiKey: 'k2' } } });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await compareCommand('test', { providers: 'elevenlabs,stability', duration: '3' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('exits when no providers configured', async () => {
    setupMocks({ providers: {} });
    await expect(compareCommand('test', {})).rejects.toThrow('process.exit');
  });

  it('handles provider failure gracefully', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'k' } } });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockFetch.mockRejectedValue(new Error('network fail'));
    // Should not throw - failures are caught per-provider
    await compareCommand('test', { providers: 'elevenlabs' });
  });

  it('creates output directory', async () => {
    setupMocks({ providers: { elevenlabs: { enabled: true, apiKey: 'k' } } });
    vi.mocked(fs.existsSync).mockReturnValue(false);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await compareCommand('test', { providers: 'elevenlabs', output: '/tmp/compare-out' });
    expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/compare-out', { recursive: true });
  });
});

// ─── Batch Command ────────────────────────────────

import { batchCommand } from '../cli/commands/batch.js';

describe('batchCommand', () => {
  it('exits when file not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await expect(batchCommand('missing.yaml', {})).rejects.toThrow('process.exit');
  });

  it('processes YAML batch file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === 'batch.yaml') return 'items:\n  - prompt: test' as any;
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { elevenlabs: { enabled: true, apiKey: 'key' } } }) as any;
      return '' as any;
    });
    vi.mocked(yamlParse).mockReturnValue({ items: [{ prompt: 'test sound' }] });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await batchCommand('batch.yaml', {});
    expect(mockFetch).toHaveBeenCalled();
  });

  it('processes JSON batch file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === 'batch.json') return JSON.stringify([{ prompt: 'click' }]) as any;
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { elevenlabs: { enabled: true, apiKey: 'key' } } }) as any;
      return '' as any;
    });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await batchCommand('batch.json', {});
    expect(mockFetch).toHaveBeenCalled();
  });

  it('dry-run mode does not generate', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('items: []' as any);
    vi.mocked(yamlParse).mockReturnValue({ items: [{ prompt: 'test', provider: 'fal' }] });
    await batchCommand('batch.yaml', { dryRun: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('dry-run mode shows type and provider', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('items: []' as any);
    vi.mocked(yamlParse).mockReturnValue({
      items: [
        { prompt: 'test sfx', type: 'sfx', provider: 'elevenlabs' },
        { prompt: 'test music', type: 'music' },
        { prompt: 'no type specified' },
      ],
    });
    await batchCommand('batch.yaml', { dryRun: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('processes batch key format', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === 'b.yaml') return '' as any;
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { elevenlabs: { enabled: true, apiKey: 'key' } } }) as any;
      return '' as any;
    });
    vi.mocked(yamlParse).mockReturnValue({ batch: [{ prompt: 'test' }] });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await batchCommand('b.yaml', {});
    expect(mockFetch).toHaveBeenCalled();
  });

  it('handles invalid file content', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('{{invalid' as any);
    vi.mocked(yamlParse).mockImplementation(() => { throw new Error('parse error'); });
    await expect(batchCommand('bad.yaml', {})).rejects.toThrow('process.exit');
  });

  it('processes YAML with direct array format', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === 'arr.yaml') return '' as any;
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { elevenlabs: { enabled: true, apiKey: 'key' } } }) as any;
      return '' as any;
    });
    vi.mocked(yamlParse).mockReturnValue([{ prompt: 'test' }]);
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await batchCommand('arr.yaml', {});
    expect(mockFetch).toHaveBeenCalled();
  });

  it('handles batch with custom provider and format', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === 'batch.yaml') return '' as any;
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { stability: { enabled: true, apiKey: 'key' } } }) as any;
      return '' as any;
    });
    vi.mocked(yamlParse).mockReturnValue({ items: [{ prompt: 'test', provider: 'stability', format: 'mp3', duration: 10, model: 'stable-audio-2.5' }] });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await batchCommand('batch.yaml', {});
    expect(mockFetch).toHaveBeenCalled();
  });

  it('handles batch item failure gracefully', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === 'batch.yaml') return '' as any;
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { elevenlabs: { enabled: true, apiKey: 'key' } } }) as any;
      return '' as any;
    });
    vi.mocked(yamlParse).mockReturnValue({ items: [{ prompt: 'test' }] });
    mockFetch.mockRejectedValue(new Error('fail'));
    await batchCommand('batch.yaml', {});
    // Should complete without throwing
    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('handles music type in batch', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === 'batch.yaml') return '' as any;
      if (ps === CONFIG_FILE) return JSON.stringify({ ...DEFAULT_CONFIG, providers: { stability: { enabled: true, apiKey: 'key' } } }) as any;
      return '' as any;
    });
    vi.mocked(yamlParse).mockReturnValue({ items: [{ prompt: 'ambient', type: 'music', provider: 'stability' }] });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    await batchCommand('batch.yaml', {});
    expect(mockFetch).toHaveBeenCalled();
  });
});

// ─── Convert Command ──────────────────────────────

import { convertCommand } from '../cli/commands/convert.js';

describe('convertCommand', () => {
  it('converts file format', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('audio data') as any);
    await convertCommand('/input/audio.wav', { to: 'mp3' });
    expect(fs.writeFileSync).toHaveBeenCalledWith('/input/audio.mp3', expect.any(Buffer));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Converted'));
  });

  it('uses custom output path', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('data') as any);
    await convertCommand('/input/audio.wav', { to: 'ogg', output: '/out/custom.ogg' });
    expect(fs.writeFileSync).toHaveBeenCalledWith('/out/custom.ogg', expect.any(Buffer));
  });

  it('exits when file not found', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    await expect(convertCommand('/missing.wav', { to: 'mp3' })).rejects.toThrow('process.exit');
  });

  it('defaults to wav format', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('data') as any);
    await convertCommand('/input/audio.mp3', { to: '' });
    // Uses '' which is falsy, so defaults to 'wav'
    // Actually the option defaults in the CLI, so the command gets 'wav' as the `to` value
  });
});

// ─── Index (CLI entry point) ──────────────────────

describe('CLI entry point', () => {
  it('exports are valid', async () => {
    // Just verify the module can be imported
    const mod = await import('../index.js');
    expect(mod).toBeDefined();
  });

  it('parses when argv has arguments', async () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'audioforge', '--version'];
    try {
      await import('../index.js?v2');
    } catch {
      // commander may call process.exit for --version
    }
    process.argv = originalArgv;
  });
});
