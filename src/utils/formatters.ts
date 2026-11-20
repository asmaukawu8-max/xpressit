import { ApiCategory, ApiReactionType, VoiceMaskPreset } from '../types';

export const CATEGORY_META: Record<
  ApiCategory,
  { label: string; emoji: string; hashtag: string }
> = {
  life: { label: 'Life', emoji: '💭', hashtag: '#Life' },
  relationships: {
    label: 'Relationships',
    emoji: '❤️',
    hashtag: '#Relationships',
  },
  work: { label: 'Work & Career', emoji: '💼', hashtag: '#WorkAndCareer' },
  family: { label: 'Family', emoji: '🏡', hashtag: '#Family' },
  'mental-health': {
    label: 'Mental Health',
    emoji: '🌿',
    hashtag: '#MentalHealth',
  },
  confessions: {
    label: 'Confessions',
    emoji: '🤫',
    hashtag: '#Confessions',
  },
  wins: { label: 'Small Wins', emoji: '✨', hashtag: '#SmallWins' },
  other: { label: 'Other', emoji: '🕊️', hashtag: '#Other' },
};

export const REACTION_META: Record<
  ApiReactionType,
  { label: string; emoji: string }
> = {
  love: { label: 'Love', emoji: '❤️' },
  support: { label: 'Support', emoji: '🫂' },
  resonate: { label: 'Resonate', emoji: '✨' },
};

export const VOICE_MASK_PRESETS: VoiceMaskPreset[] = [
  'Shifted (+1 st)',
  'Deep Tone',
  'Mask: Deep Ambient',
  'Warm Echo',
];

export const SUGGESTED_USERNAMES = [
  'silent_drifter',
  'midnight_poet',
  'velvet_ghost',
  'quiet_lantern',
  'gentle_horizon',
  'amber_compass',
  'thoughtful_sparrow',
];

export function formatCompactCount(count: number): string {
  if (count >= 1000) {
    const val = (count / 1000).toFixed(1);
    return val.endsWith('.0') ? `${val.slice(0, -2)}k` : `${val}k`;
  }
  return String(count);
}

export function formatRelativeTime(isoDate: string): string {
  const timeMs = new Date(isoDate).getTime();
  if (Number.isNaN(timeMs)) return 'Recently';
  const diffSec = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(timeMs).toLocaleDateString();
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function generateWaveformFromId(id: string, count = 22): number[] {
  let seed = 0;
  for (let i = 0; i < id.length; i++) {
    seed = (seed * 31 + id.charCodeAt(i)) % 997;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    seed = (seed * 73 + 19) % 997;
    bars.push(10 + (seed % 23));
  }
  return bars;
}

/**
 * Generates a valid PCM WAV audio blob as a fallback if microphone access
 * is unavailable or denied during studio testing, ensuring valid RIFF/WAVE signature.
 */
export function createFallbackVoiceBlob(durationSeconds: number): Blob {
  const sampleRate = 8000;
  const clampedDuration = Math.min(10, Math.max(1, durationSeconds));
  const numSamples = sampleRate * clampedDuration;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, t * 4) * Math.min(1, (clampedDuration - t) * 4);
    const sample = Math.sin(2 * Math.PI * 220 * t) * 0.04 * envelope;
    view.setInt16(44 + i * 2, Math.floor(sample * 32767), true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
