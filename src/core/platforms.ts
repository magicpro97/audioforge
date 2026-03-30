export interface PlatformAudioSpec {
  name: string;
  format: string;
  sampleRate: number;
  bitDepth: number;
  channels: number;
  description: string;
}

export const PLATFORM_SPECS: Record<string, PlatformAudioSpec> = {
  ios: {
    name: 'iOS',
    format: 'wav',
    sampleRate: 44100,
    bitDepth: 16,
    channels: 1,
    description: 'Apple iOS (WAV for sound effects, AAC for music)',
  },
  android: {
    name: 'Android',
    format: 'wav',
    sampleRate: 44100,
    bitDepth: 16,
    channels: 1,
    description: 'Android (WAV for sound effects, OGG for music)',
  },
  web: {
    name: 'Web',
    format: 'mp3',
    sampleRate: 44100,
    bitDepth: 16,
    channels: 2,
    description: 'Web browsers (MP3 for broad compatibility)',
  },
  game: {
    name: 'Game Engine',
    format: 'wav',
    sampleRate: 48000,
    bitDepth: 16,
    channels: 1,
    description: 'Game engines (WAV at 48kHz for low-latency playback)',
  },
};

export function getPlatformSpec(platform: string): PlatformAudioSpec | undefined {
  return PLATFORM_SPECS[platform.toLowerCase()];
}

export function getPlatformNames(): string[] {
  return Object.keys(PLATFORM_SPECS);
}
