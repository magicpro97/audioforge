import { AudioProvider } from './base.js';
import { ElevenLabsProvider } from './elevenlabs.js';
import { StabilityProvider } from './stability.js';
import { FalProvider } from './fal.js';
import { ReplicateProvider } from './replicate.js';

export { AudioProvider } from './base.js';
export { ElevenLabsProvider } from './elevenlabs.js';
export { StabilityProvider } from './stability.js';
export { FalProvider } from './fal.js';
export { ReplicateProvider } from './replicate.js';

const providerRegistry = new Map<string, () => AudioProvider>([
  ['elevenlabs', () => new ElevenLabsProvider()],
  ['stability', () => new StabilityProvider()],
  ['fal', () => new FalProvider()],
  ['replicate', () => new ReplicateProvider()],
]);

export function createProvider(name: string): AudioProvider {
  const factory = providerRegistry.get(name.toLowerCase());
  if (!factory) {
    const available = Array.from(providerRegistry.keys()).join(', ');
    throw new Error(`Unknown provider "${name}". Available: ${available}`);
  }
  return factory();
}

export function getAllProviderNames(): string[] {
  return Array.from(providerRegistry.keys());
}

export function createAllProviders(): Map<string, AudioProvider> {
  const providers = new Map<string, AudioProvider>();
  for (const [name, factory] of providerRegistry) {
    providers.set(name, factory());
  }
  return providers;
}
