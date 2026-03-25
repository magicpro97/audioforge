export const STYLE_PRESETS: Record<string, string> = {
  'game-sfx': 'punchy, clear, game-ready sound effect, suitable for video games',
  'ui-click': 'subtle, satisfying, short UI interaction sound, clean digital click',
  'ambient': 'atmospheric environmental background ambience, immersive spatial audio',
  'cinematic': 'dramatic, theatrical, high-production sound design, cinematic impact',
  'foley': 'realistic everyday sound, natural acoustic recording, foley-style',
  '8-bit': 'retro chiptune style, 8-bit pixel game sound, lo-fi vintage electronic',
  'sci-fi': 'futuristic, technological, sci-fi sound, synthetic and otherworldly',
  'fantasy': 'magical, ethereal, enchanting sound, mystical and whimsical',
  'horror': 'dark, unsettling, eerie sound, suspenseful and creepy atmosphere',
  'electronic': 'synthesized, modern electronic sound, clean digital production',
  'orchestral': 'classical orchestral instruments, rich and full-bodied sound',
  'lo-fi': 'warm, vintage, relaxing lo-fi sound, tape saturation and gentle noise',
  'notification': 'short, clear, attention-grabbing alert sound, pleasant notification',
  'transition': 'smooth whoosh, sweep, or fade transition sound, cinematic movement',
  'nature': 'natural environmental sound, organic and authentic outdoor recording',
};

export function applyPreset(prompt: string, presetName: string): string {
  const suffix = STYLE_PRESETS[presetName];
  if (!suffix) return prompt;
  return `${prompt}, ${suffix}`;
}

export function getPresetNames(): string[] {
  return Object.keys(STYLE_PRESETS);
}
