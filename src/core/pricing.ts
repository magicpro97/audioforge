import { estimateCostFromPricing } from '@magicpro97/forge-core';

const PRICING: Record<string, Record<string, number>> = {
  elevenlabs: {
    'eleven_sfx_v2': 0.007,
    '_default': 0.007,
  },
  stability: {
    'stable-audio-2.5': 0.010,
    '_default': 0.010,
  },
  fal: {
    'cassetteai/sound-effects-generator': 0.005,
    'beatoven/sound-effect-generation': 0.005,
    'beatoven/music-generation': 0.008,
    '_default': 0.005,
  },
  replicate: {
    'meta/musicgen': 0.007,
    'meta/audiogen': 0.007,
    '_default': 0.007,
  },
};

export function estimateCost(
  provider: string,
  model: string,
  options?: { duration?: number; operation?: string }
): number {
  const baseCost = estimateCostFromPricing(PRICING, provider, model, {
    operation: options?.operation,
  });

  // Scale cost by duration (base price is per ~5 seconds)
  const duration = options?.duration || 5;
  const multiplier = Math.max(1, duration / 5);

  return baseCost * multiplier;
}

export function getAllPricing(): Record<string, Record<string, number>> {
  return PRICING;
}
