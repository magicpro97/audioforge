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

  // UX Sound Design Presets (UXmatters 2024)
  'tap-feedback': 'Ultra-short subtle tactile tap feedback sound, crisp and clean, 50 milliseconds maximum, soft click or pop, not harsh or jarring, suitable for UI button press feedback in mobile app',
  'success-chime': 'Short positive achievement chime, bright and clear major chord, 300 milliseconds, uplifting and satisfying, suitable for task completion or successful action in mobile app UI',
  'error-alert': 'Brief gentle error notification sound, soft descending tone, 200 milliseconds, noticeable but not alarming or anxiety-inducing, suitable for form validation error or failed action in mobile app',
  'nav-whoosh': 'Ultra-short soft navigation transition whoosh, subtle air movement sound, 150 milliseconds, smooth and elegant, suitable for screen transition or page navigation in mobile app',
  'loading-loop': 'Calm ambient loading loop, gentle pulsing tone, exactly 2 seconds long, seamlessly loopable, unobtrusive and pleasant, suitable for loading spinner or progress indicator in mobile app',

  // Emotional Tone Presets
  'calm': 'Peaceful and serene audio, gentle dynamics, soft sustained tones, ambient textures, slow tempo, minor to major key resolution, evokes tranquility and relaxation',
  'energetic': 'Upbeat and driving audio, strong rhythmic pulse, bright tones, fast tempo, major key, dynamic range, evokes excitement and motivation',
  'suspenseful': 'Tension-building atmospheric audio, low rumbling undertones, dissonant intervals, minor key, slow build, sparse elements, evokes anticipation and mystery',
  'celebratory': 'Triumphant and joyful audio, major key fanfare, bright brass or synth tones, uplifting melody, moderate to fast tempo, evokes achievement and celebration',
};

export function applyPreset(prompt: string, presetName: string): string {
  const suffix = STYLE_PRESETS[presetName];
  if (!suffix) return prompt;
  return `${prompt}, ${suffix}`;
}

export function getPresetNames(): string[] {
  return Object.keys(STYLE_PRESETS);
}
