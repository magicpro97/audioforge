export const DURATION_PRESETS: Record<string, number> = {
  'blip': 0.5,
  'short': 2,
  'medium': 5,
  'long': 10,
  'extended': 30,
  'loop-short': 3,
  'loop-medium': 8,
  'music-short': 15,
  'music-medium': 30,
  'music-long': 60,
  'music-full': 180,
};

export function resolveDuration(input: string): number | null {
  const preset = DURATION_PRESETS[input.toLowerCase()];
  if (preset !== undefined) return preset;

  const parsed = parseFloat(input);
  if (!isNaN(parsed) && parsed > 0) return parsed;

  return null;
}

export function getDurationPresetNames(): string[] {
  return Object.keys(DURATION_PRESETS);
}
