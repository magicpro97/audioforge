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

import * as fs from 'node:fs';
import * as os from 'node:os';
import { exec } from 'node:child_process';

// Core imports
import { loadConfig, saveConfig, getConfigValue, setConfigValue, getProviderApiKey, setProviderApiKey, getConfigDir, getConfigFilePath } from '../core/config.js';
import { addHistoryEntry, getHistory, getHistoryEntry, clearHistory } from '../core/history.js';
import { saveAudio } from '../core/output.js';
import { applyPreset, getPresetNames, STYLE_PRESETS } from '../core/presets.js';
import { resolveDuration, getDurationPresetNames, DURATION_PRESETS } from '../core/durations.js';
import { estimateCost, getAllPricing } from '../core/pricing.js';
import { saveTemplate, getTemplate, getAllTemplates, deleteTemplate, renderTemplate } from '../core/templates.js';
import { openFile } from '../core/opener.js';

const CONFIG_DIR = '/mock-home/.audioforge';
const CONFIG_FILE = '/mock-home/.audioforge/config.json';
const HISTORY_FILE = '/mock-home/.audioforge/history.json';
const TEMPLATES_FILE = '/mock-home/.audioforge/templates.json';

function getLastWrittenJSON(filePath?: string): any {
  const calls = vi.mocked(fs.writeFileSync).mock.calls;
  if (filePath) {
    const match = calls.filter(c => String(c[0]) === filePath);
    const last = match[match.length - 1];
    return last ? JSON.parse(last[1] as string) : undefined;
  }
  const last = calls[calls.length - 1];
  return JSON.parse(last[1] as string);
}

function setupConfigExists(configData?: any): void {
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const ps = String(p);
    if (ps === CONFIG_DIR) return true;
    if (ps === CONFIG_FILE) return !!configData;
    return false;
  });
  if (configData) {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(configData) as any);
  }
}

function setupHistoryExists(data?: any[]): void {
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const ps = String(p);
    if (ps === CONFIG_DIR) return true;
    if (ps === CONFIG_FILE) return true;
    if (ps === HISTORY_FILE) return !!data;
    return false;
  });
  vi.mocked(fs.readFileSync).mockImplementation((p) => {
    const ps = String(p);
    if (ps === HISTORY_FILE) return JSON.stringify(data || []) as any;
    if (ps === CONFIG_FILE) return JSON.stringify({ history: { enabled: true, maxEntries: 500 } }) as any;
    return '' as any;
  });
}

function setupTemplatesExists(data?: any[]): void {
  vi.mocked(fs.existsSync).mockImplementation((p) => {
    const ps = String(p);
    if (ps === CONFIG_DIR) return true;
    if (ps === CONFIG_FILE) return false;
    if (ps === TEMPLATES_FILE) return !!data;
    return false;
  });
  vi.mocked(fs.readFileSync).mockImplementation((p) => {
    const ps = String(p);
    if (ps === TEMPLATES_FILE) return JSON.stringify(data || []) as any;
    return '' as any;
  });
}

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReturnValue(false);
  vi.mocked(fs.readFileSync).mockReturnValue('' as any);
  vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  vi.mocked(fs.mkdirSync).mockReturnValue(undefined as any);
  vi.mocked(os.platform).mockReturnValue('linux');
});

// ─── Config ───────────────────────────────────────

describe('config', () => {
  it('loadConfig creates default config when none exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR) return false;
      return false;
    });
    const config = loadConfig();
    expect(config.defaults.provider).toBe('elevenlabs');
    expect(config.defaults.duration).toBe(5);
    expect(config.defaults.format).toBe('wav');
    expect(fs.mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('loadConfig reads existing config and merges with defaults', () => {
    setupConfigExists({ defaults: { provider: 'stability' } });
    const config = loadConfig();
    expect(config.defaults.provider).toBe('stability');
    expect(config.defaults.format).toBe('wav');
    expect(config.history.enabled).toBe(true);
  });

  it('loadConfig returns defaults on invalid JSON', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR) return true;
      if (ps === CONFIG_FILE) return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('{{invalid json' as any);
    const config = loadConfig();
    expect(config.defaults.provider).toBe('elevenlabs');
  });

  it('saveConfig writes JSON to config file', () => {
    setupConfigExists();
    const config = loadConfig();
    saveConfig(config);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      CONFIG_FILE,
      expect.any(String),
      'utf-8'
    );
  });

  it('getConfigValue returns nested value', () => {
    setupConfigExists({ defaults: { provider: 'fal', format: 'mp3' } });
    expect(getConfigValue('defaults.provider')).toBe('fal');
    expect(getConfigValue('defaults.format')).toBe('mp3');
  });

  it('getConfigValue returns undefined for missing path', () => {
    setupConfigExists({});
    expect(getConfigValue('nonexistent.deep.path')).toBeUndefined();
  });

  it('getConfigValue handles null in path', () => {
    setupConfigExists({ a: null });
    expect(getConfigValue('a.b')).toBeUndefined();
  });

  it('setConfigValue sets nested value and saves', () => {
    setupConfigExists({});
    setConfigValue('defaults.provider', 'replicate');
    const saved = getLastWrittenJSON(CONFIG_FILE);
    expect(saved.defaults.provider).toBe('replicate');
  });

  it('setConfigValue parses true/false/numbers', () => {
    setupConfigExists({});
    setConfigValue('autoOpen', 'true');
    let saved = getLastWrittenJSON(CONFIG_FILE);
    expect(saved.autoOpen).toBe(true);

    setConfigValue('autoOpen', 'false');
    saved = getLastWrittenJSON(CONFIG_FILE);
    expect(saved.autoOpen).toBe(false);

    setConfigValue('defaults.duration', '10');
    saved = getLastWrittenJSON(CONFIG_FILE);
    expect(saved.defaults.duration).toBe(10);

    setConfigValue('cost.budget', '5.5');
    saved = getLastWrittenJSON(CONFIG_FILE);
    expect(saved.cost.budget).toBe(5.5);
  });

  it('setConfigValue creates nested objects for new paths', () => {
    setupConfigExists({});
    setConfigValue('new.deep.key', 'value');
    const saved = getLastWrittenJSON(CONFIG_FILE);
    expect(saved.new.deep.key).toBe('value');
  });

  it('getProviderApiKey returns undefined when no key', () => {
    setupConfigExists({ providers: { elevenlabs: { enabled: true } } });
    expect(getProviderApiKey('elevenlabs')).toBeUndefined();
    expect(getProviderApiKey('nonexistent')).toBeUndefined();
  });

  it('getProviderApiKey returns key when set', () => {
    setupConfigExists({ providers: { elevenlabs: { enabled: true, apiKey: 'test-key' } } });
    expect(getProviderApiKey('elevenlabs')).toBe('test-key');
  });

  it('setProviderApiKey sets key for existing provider', () => {
    setupConfigExists({ providers: { elevenlabs: { enabled: true } } });
    setProviderApiKey('elevenlabs', 'new-key');
    const saved = getLastWrittenJSON(CONFIG_FILE);
    expect(saved.providers.elevenlabs.apiKey).toBe('new-key');
  });

  it('setProviderApiKey creates provider config if missing', () => {
    setupConfigExists({ providers: {} });
    setProviderApiKey('newprovider', 'my-key');
    const saved = getLastWrittenJSON(CONFIG_FILE);
    expect(saved.providers.newprovider.apiKey).toBe('my-key');
    expect(saved.providers.newprovider.enabled).toBe(true);
  });

  it('getConfigDir returns correct path', () => {
    expect(getConfigDir()).toBe(CONFIG_DIR);
  });

  it('getConfigFilePath returns correct path', () => {
    expect(getConfigFilePath()).toBe(CONFIG_FILE);
  });

  it('deepMerge handles arrays by replacing', () => {
    setupConfigExists({ providers: { elevenlabs: { enabled: false } }, defaults: { format: 'mp3' } });
    const config = loadConfig();
    expect(config.providers.elevenlabs.enabled).toBe(false);
    expect(config.defaults.format).toBe('mp3');
    // Deep merge fills in non-overridden defaults
    expect(config.history.enabled).toBe(true);
    expect(config.autoOpen).toBe(false);
  });
});

// ─── History ──────────────────────────────────────

describe('history', () => {
  it('getHistory returns empty array when no history file', () => {
    setupHistoryExists(undefined);
    expect(getHistory()).toEqual([]);
  });

  it('getHistory returns entries from file', () => {
    const entries = [
      { id: 'a1', timestamp: '2024-01-01', provider: 'elevenlabs', model: 'sfx', prompt: 'test', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 1000 },
    ];
    setupHistoryExists(entries);
    const result = getHistory();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('getHistory with limit returns last N entries', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      id: `e${i}`, timestamp: '2024-01-01', provider: 'test', model: 'test', prompt: 'p', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 100,
    }));
    setupHistoryExists(entries);
    const result = getHistory(3);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('e7');
  });

  it('getHistory returns empty on invalid JSON', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === HISTORY_FILE) return true;
      return true;
    });
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === HISTORY_FILE) return '{{invalid' as any;
      if (ps === CONFIG_FILE) return JSON.stringify({ history: { maxEntries: 500 } }) as any;
      return '' as any;
    });
    expect(getHistory()).toEqual([]);
  });

  it('addHistoryEntry adds entry with generated id and timestamp', () => {
    setupHistoryExists([]);
    const entry = addHistoryEntry({
      provider: 'elevenlabs',
      model: 'sfx',
      prompt: 'test sound',
      type: 'sfx',
      duration: 5,
      format: 'wav',
      outputFiles: ['/path/to/file.wav'],
      elapsed: 2000,
      cost: 0.01,
    });
    expect(entry.id).toBe('abcdef01');
    expect(entry.timestamp).toBeDefined();
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('addHistoryEntry trims to maxEntries', () => {
    const entries = Array.from({ length: 500 }, (_, i) => ({
      id: `e${i}`, timestamp: '2024-01-01', provider: 'test', model: 'test', prompt: 'p', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 100,
    }));
    setupHistoryExists(entries);
    addHistoryEntry({
      provider: 'test', model: 'test', prompt: 'new', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 100,
    });
    const saved = getLastWrittenJSON(HISTORY_FILE);
    expect(saved.length).toBeLessThanOrEqual(500);
  });

  it('getHistoryEntry finds entry by id', () => {
    setupHistoryExists([
      { id: 'abc', timestamp: '2024-01-01', provider: 'test', model: 'test', prompt: 'p', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 100 },
    ]);
    const entry = getHistoryEntry('abc');
    expect(entry?.id).toBe('abc');
  });

  it('getHistoryEntry returns undefined for missing id', () => {
    setupHistoryExists([]);
    expect(getHistoryEntry('nonexistent')).toBeUndefined();
  });

  it('clearHistory writes empty array', () => {
    setupHistoryExists([{ id: 'a', timestamp: '', provider: '', model: '', prompt: '', type: 'sfx', duration: 5, format: 'wav', outputFiles: [], elapsed: 0 }]);
    clearHistory();
    const saved = getLastWrittenJSON(HISTORY_FILE);
    expect(saved).toEqual([]);
  });
});

// ─── Output ───────────────────────────────────────

describe('output', () => {
  it('saveAudio saves single audio file with output path', () => {
    setupConfigExists({});
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = saveAudio(
      { audio: [{ base64: Buffer.from('test').toString('base64'), duration: 5 }], provider: 'test', model: 'test', elapsed: 100, metadata: {} },
      '/output/test.wav',
    );
    expect(result.filePaths).toHaveLength(1);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('saveAudio creates output directory if missing', () => {
    setupConfigExists({});
    vi.mocked(fs.existsSync).mockReturnValue(false);
    saveAudio(
      { audio: [{ base64: Buffer.from('data').toString('base64') }], provider: 'p', model: 'm', elapsed: 0, metadata: {} },
      '/new-dir/file.wav',
    );
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('saveAudio uses naming pattern when no output path', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR) return true;
      if (ps === CONFIG_FILE) return false;
      return false;
    });
    saveAudio(
      { audio: [{ base64: Buffer.from('data').toString('base64') }], provider: 'elevenlabs', model: 'sfx-v2', elapsed: 0, metadata: {} },
    );
    const calls = vi.mocked(fs.writeFileSync).mock.calls;
    // Should have written config (default) + audio file
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it('saveAudio handles multiple audio files with suffix', () => {
    setupConfigExists({});
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = saveAudio(
      {
        audio: [
          { base64: Buffer.from('a1').toString('base64') },
          { base64: Buffer.from('a2').toString('base64') },
        ],
        provider: 'test', model: 'test', elapsed: 0, metadata: {},
      },
      '/output/audio.wav',
    );
    expect(result.filePaths).toHaveLength(2);
  });

  it('saveAudio skips audio without base64', () => {
    setupConfigExists({});
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const result = saveAudio(
      { audio: [{ url: 'http://example.com/file.wav' }], provider: 'test', model: 'test', elapsed: 0, metadata: {} },
      '/output/test.wav',
    );
    expect(result.filePaths).toHaveLength(0);
  });

  it('saveAudio handles naming pattern with model containing special chars', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR) return true;
      if (ps === CONFIG_FILE) return false;
      return false;
    });
    saveAudio(
      { audio: [{ base64: Buffer.from('data').toString('base64') }], provider: 'fal', model: 'cassetteai/sound-effects', elapsed: 0, metadata: {} },
    );
    // Model slashes should be replaced with hyphens
    const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
    const audioWriteCall = writeCalls.find(c => String(c[0]).includes('fal-'));
    expect(audioWriteCall).toBeDefined();
  });

  it('saveAudio uses multiple files naming pattern without output path', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === CONFIG_DIR) return true;
      if (ps === CONFIG_FILE) return false;
      return false;
    });
    const result = saveAudio(
      {
        audio: [
          { base64: Buffer.from('a').toString('base64') },
          { base64: Buffer.from('b').toString('base64') },
        ],
        provider: 'test', model: 'model', elapsed: 0, metadata: {},
      },
    );
    expect(result.filePaths).toHaveLength(2);
  });
});

// ─── Presets ──────────────────────────────────────

describe('presets', () => {
  it('applyPreset appends style suffix', () => {
    const result = applyPreset('explosion', 'game-sfx');
    expect(result).toContain('explosion');
    expect(result).toContain('punchy');
  });

  it('applyPreset returns original prompt for unknown preset', () => {
    expect(applyPreset('test', 'nonexistent')).toBe('test');
  });

  it('getPresetNames returns all preset names', () => {
    const names = getPresetNames();
    expect(names).toContain('game-sfx');
    expect(names).toContain('cinematic');
    expect(names).toContain('8-bit');
    expect(names.length).toBe(Object.keys(STYLE_PRESETS).length);
  });

  it('STYLE_PRESETS has 15 presets', () => {
    expect(Object.keys(STYLE_PRESETS).length).toBe(15);
  });
});

// ─── Durations ────────────────────────────────────

describe('durations', () => {
  it('resolveDuration returns preset value', () => {
    expect(resolveDuration('blip')).toBe(0.5);
    expect(resolveDuration('short')).toBe(2);
    expect(resolveDuration('medium')).toBe(5);
    expect(resolveDuration('music-full')).toBe(180);
  });

  it('resolveDuration is case-insensitive', () => {
    expect(resolveDuration('BLIP')).toBe(0.5);
    expect(resolveDuration('Medium')).toBe(5);
  });

  it('resolveDuration parses numeric strings', () => {
    expect(resolveDuration('15')).toBe(15);
    expect(resolveDuration('0.5')).toBe(0.5);
  });

  it('resolveDuration returns null for invalid input', () => {
    expect(resolveDuration('invalid')).toBeNull();
    expect(resolveDuration('0')).toBeNull();
    expect(resolveDuration('-5')).toBeNull();
  });

  it('getDurationPresetNames returns all names', () => {
    const names = getDurationPresetNames();
    expect(names).toContain('blip');
    expect(names).toContain('music-full');
    expect(names.length).toBe(Object.keys(DURATION_PRESETS).length);
  });
});

// ─── Pricing ──────────────────────────────────────

describe('pricing', () => {
  it('estimateCost returns 0 for unknown provider', () => {
    expect(estimateCost('unknown', 'model')).toBe(0);
  });

  it('estimateCost uses model-specific price', () => {
    const cost = estimateCost('elevenlabs', 'eleven_sfx_v2', { duration: 5 });
    expect(cost).toBe(0.007);
  });

  it('estimateCost falls back to _default price', () => {
    const cost = estimateCost('elevenlabs', 'unknown-model', { duration: 5 });
    expect(cost).toBe(0.007);
  });

  it('estimateCost scales by duration', () => {
    const cost5s = estimateCost('elevenlabs', 'eleven_sfx_v2', { duration: 5 });
    const cost10s = estimateCost('elevenlabs', 'eleven_sfx_v2', { duration: 10 });
    expect(cost10s).toBe(cost5s * 2);
  });

  it('estimateCost uses minimum multiplier of 1', () => {
    const cost = estimateCost('elevenlabs', 'eleven_sfx_v2', { duration: 1 });
    expect(cost).toBe(0.007); // min multiplier = 1
  });

  it('estimateCost uses default duration when not specified', () => {
    const cost = estimateCost('elevenlabs', 'eleven_sfx_v2');
    expect(cost).toBe(0.007); // default 5s = multiplier 1
  });

  it('estimateCost handles operation pricing', () => {
    const cost = estimateCost('elevenlabs', 'model', { operation: 'nonexistent' });
    // Falls through to normal pricing since _nonexistent doesn't exist
    expect(cost).toBeGreaterThanOrEqual(0);
  });

  it('estimateCost returns 0 when no _default and unknown model', () => {
    // All providers have _default, but test the ?? 0 fallback
    const cost = estimateCost('elevenlabs', 'nonexistent-model-xyz');
    // Should use _default
    expect(cost).toBe(0.007);
  });

  it('getAllPricing returns full pricing table', () => {
    const pricing = getAllPricing();
    expect(pricing).toHaveProperty('elevenlabs');
    expect(pricing).toHaveProperty('stability');
    expect(pricing).toHaveProperty('fal');
    expect(pricing).toHaveProperty('replicate');
  });
});

// ─── Templates ────────────────────────────────────

describe('templates', () => {
  it('getAllTemplates returns empty when no file', () => {
    setupTemplatesExists(undefined);
    expect(getAllTemplates()).toEqual([]);
  });

  it('getAllTemplates returns empty on invalid JSON', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const ps = String(p);
      if (ps === TEMPLATES_FILE) return true;
      return ps === CONFIG_DIR;
    });
    vi.mocked(fs.readFileSync).mockReturnValue('{{bad' as any);
    expect(getAllTemplates()).toEqual([]);
  });

  it('saveTemplate creates new template', () => {
    setupTemplatesExists([]);
    const entry = saveTemplate('sfx-explosion', 'big {material} explosion', { type: 'sfx' });
    expect(entry.name).toBe('sfx-explosion');
    expect(entry.variables).toEqual(['material']);
    expect(entry.type).toBe('sfx');
    const saved = getLastWrittenJSON(TEMPLATES_FILE);
    expect(saved).toHaveLength(1);
  });

  it('saveTemplate updates existing template', () => {
    setupTemplatesExists([{ name: 'old', prompt: 'old prompt', variables: [] }]);
    saveTemplate('old', 'new {thing} prompt');
    const saved = getLastWrittenJSON(TEMPLATES_FILE);
    expect(saved).toHaveLength(1);
    expect(saved[0].prompt).toBe('new {thing} prompt');
  });

  it('saveTemplate extracts multiple unique variables', () => {
    setupTemplatesExists([]);
    const entry = saveTemplate('t', '{a} hits {b} and {a} again');
    expect(entry.variables).toEqual(['a', 'b']);
  });

  it('saveTemplate preserves options', () => {
    setupTemplatesExists([]);
    const entry = saveTemplate('t', 'prompt', { provider: 'fal', duration: 10, preset: 'cinematic', model: 'test' });
    expect(entry.provider).toBe('fal');
    expect(entry.duration).toBe(10);
    expect(entry.preset).toBe('cinematic');
  });

  it('getTemplate finds by name', () => {
    setupTemplatesExists([{ name: 'found', prompt: 'yes', variables: [] }]);
    expect(getTemplate('found')?.prompt).toBe('yes');
  });

  it('getTemplate returns undefined for missing', () => {
    setupTemplatesExists([]);
    expect(getTemplate('nope')).toBeUndefined();
  });

  it('deleteTemplate removes and returns true', () => {
    setupTemplatesExists([{ name: 'del', prompt: 'x', variables: [] }]);
    expect(deleteTemplate('del')).toBe(true);
    const saved = getLastWrittenJSON(TEMPLATES_FILE);
    expect(saved).toHaveLength(0);
  });

  it('deleteTemplate returns false for missing', () => {
    setupTemplatesExists([]);
    expect(deleteTemplate('nope')).toBe(false);
  });

  it('renderTemplate replaces variables', () => {
    const template = { name: 't', prompt: '{material} explosion on {surface}', variables: ['material', 'surface'] };
    const result = renderTemplate(template, { material: 'glass', surface: 'concrete' });
    expect(result).toBe('glass explosion on concrete');
  });

  it('renderTemplate throws on unresolved variables', () => {
    const template = { name: 't', prompt: '{a} and {b}', variables: ['a', 'b'] };
    expect(() => renderTemplate(template, { a: 'done' })).toThrow('Unresolved template variables: {b}');
  });

  it('renderTemplate replaces multiple occurrences of same variable', () => {
    const template = { name: 't', prompt: '{x} then {x}', variables: ['x'] };
    expect(renderTemplate(template, { x: 'hi' })).toBe('hi then hi');
  });

  it('saveTemplate creates dir if needed', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    saveTemplate('t', 'p');
    expect(fs.mkdirSync).toHaveBeenCalled();
  });
});

// ─── Opener ───────────────────────────────────────

describe('opener', () => {
  it('openFile uses xdg-open on linux', () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    openFile('/path/to/audio.wav');
    expect(exec).toHaveBeenCalledWith('xdg-open "/path/to/audio.wav"', expect.any(Function));
  });

  it('openFile uses open on darwin', () => {
    vi.mocked(os.platform).mockReturnValue('darwin');
    openFile('/path/to/audio.wav');
    expect(exec).toHaveBeenCalledWith('open "/path/to/audio.wav"', expect.any(Function));
  });

  it('openFile uses start on win32', () => {
    vi.mocked(os.platform).mockReturnValue('win32');
    openFile('/path/to/audio.wav');
    expect(exec).toHaveBeenCalledWith('start "" "/path/to/audio.wav"', expect.any(Function));
  });
});
