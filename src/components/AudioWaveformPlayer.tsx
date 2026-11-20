import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAuthenticatedMediaUrl } from '../api/client';
import { ApiMedia, VoiceMaskPreset } from '../types';
import { formatDuration, generateWaveformFromId } from '../utils/formatters';

interface AudioWaveformPlayerProps {
  voice: ApiMedia;
  token: string;
  voiceMaskLabel?: VoiceMaskPreset;
  variant?: 'feed' | 'detail';
}

const SPEEDS = [1, 1.25, 1.5] as const;

export const AudioWaveformPlayer: React.FC<AudioWaveformPlayerProps> = ({
  voice,
  token,
  voiceMaskLabel = 'Shifted (+1 st)',
  variant = 'feed',
}) => {
  const durationSec = Math.max(1, voice.duration || 15);
  const baseBars = useMemo(
    () => generateWaveformFromId(voice.id, 22),
    [voice.id]
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [actualDuration, setActualDuration] = useState(durationSec);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [liveHeights, setLiveHeights] = useState<number[]>(baseBars);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speed = SPEEDS[speedIndex];
  const progressRatio = Math.min(
    1,
    Math.max(0, elapsedSec / Math.max(1, actualDuration))
  );
  const activeBarCount = Math.round(progressRatio * baseBars.length);

  useEffect(() => {
    setLiveHeights(baseBars);
    setElapsedSec(0);
    setActualDuration(durationSec);
    setAudioBlobUrl(null);
    setIsPlaying(false);
    setAudioError(false);
  }, [voice.id, baseBars, durationSec]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setLiveHeights(
        baseBars.map((base) => {
          const jitter = Math.floor(Math.random() * 10) - 4;
          return Math.max(8, Math.min(32, base + jitter));
        })
      );
    }, 220);

    return () => window.clearInterval(interval);
  }, [isPlaying, baseBars]);

  const ensureLoadedAndToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    if (audioBlobUrl && audioRef.current) {
      audioRef.current.playbackRate = speed;
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch {
        setAudioError(true);
      }
      return;
    }

    setLoadingAudio(true);
    setAudioError(false);
    try {
      const url = await fetchAuthenticatedMediaUrl(token, voice.url);
      setAudioBlobUrl(url);
      // Let React bind src, then play
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.playbackRate = speed;
          audioRef.current
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => setAudioError(true));
        }
      }, 40);
    } catch {
      setAudioError(true);
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleScrub = (index: number) => {
    const ratio = (index + 1) / baseBars.length;
    const nextSec = ratio * actualDuration;
    setElapsedSec(nextSec);
    if (audioRef.current && audioBlobUrl) {
      audioRef.current.currentTime = nextSec;
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIdx);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[nextIdx];
    }
  };

  const audioElement = (
    <audio
      ref={audioRef}
      src={audioBlobUrl || undefined}
      onLoadedMetadata={(ev) => {
        const d = ev.currentTarget.duration;
        if (Number.isFinite(d) && d > 0) {
          setActualDuration(d);
        }
      }}
      onTimeUpdate={(ev) => {
        setElapsedSec(ev.currentTarget.currentTime);
      }}
      onEnded={() => {
        setIsPlaying(false);
        setElapsedSec(0);
      }}
      onError={() => {
        setIsPlaying(false);
        setAudioError(true);
      }}
    />
  );

  if (variant === 'detail') {
    return (
      <div className="bg-surface-container-low rounded-xl p-4 mb-4">
        {audioElement}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[18px]">
              mic
            </span>
            <span className="text-xs font-semibold text-on-surface">
              Spoken Audio Confession
            </span>
            <span className="text-[11px] text-on-surface-variant">
              · {voiceMaskLabel}
            </span>
          </div>
          <span className="text-[11px] text-primary font-semibold tabular-nums">
            {formatDuration(actualDuration)}
          </span>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            disabled={loadingAudio}
            aria-label={isPlaying ? 'Pause recording' : 'Play recording'}
            onClick={ensureLoadedAndToggle}
            className="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm shrink-0 active:scale-95 transition-transform cursor-pointer disabled:opacity-60"
          >
            <span className="material-symbols-outlined material-symbols-filled text-[22px]">
              {loadingAudio
                ? 'hourglass_top'
                : isPlaying
                ? 'pause'
                : 'play_arrow'}
            </span>
          </button>

          <div className="flex items-center gap-[3px] h-8 flex-1 overflow-hidden px-1">
            {liveHeights.map((h, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Seek to ${Math.round(
                  ((idx + 1) / liveHeights.length) * 100
                )}%`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleScrub(idx);
                }}
                style={{ height: `${h}px` }}
                className={`w-1 rounded-full transition-all duration-200 cursor-pointer ${
                  idx < activeBarCount ? 'bg-primary' : 'bg-outline-variant'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={cycleSpeed}
            className="shrink-0 rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors tabular-nums cursor-pointer"
          >
            {speed.toFixed(speed === 1.25 ? 2 : 1)}x
          </button>
        </div>

        <div className="flex justify-between items-center mt-2 px-1 text-[11px] font-medium text-on-surface-variant tabular-nums">
          <span>{formatDuration(elapsedSec)}</span>
          <span>
            {audioError ? 'Audio stream unavailable' : voice.name}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col rounded-xl bg-surface-container-low p-3.5 mb-3.5"
      onClick={(e) => e.stopPropagation()}
    >
      {audioElement}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={loadingAudio}
          aria-label={
            isPlaying ? 'Pause audio confession' : 'Play audio confession'
          }
          onClick={ensureLoadedAndToggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary shadow-md active:scale-95 transition-transform cursor-pointer disabled:opacity-60"
        >
          <span className="material-symbols-outlined material-symbols-filled text-[22px]">
            {loadingAudio
              ? 'hourglass_top'
              : isPlaying
              ? 'pause'
              : 'play_arrow'}
          </span>
        </button>

        <div className="flex flex-1 items-center gap-1 h-8 overflow-hidden px-1">
          {liveHeights.map((h, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Seek waveform bar ${idx + 1}`}
              onClick={() => handleScrub(idx)}
              style={{ height: `${h}px` }}
              className={`w-[3px] rounded-full transition-all duration-200 cursor-pointer ${
                idx < activeBarCount ? 'bg-primary' : 'bg-outline-variant'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={cycleSpeed}
          className="shrink-0 rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors tabular-nums cursor-pointer"
        >
          {speed.toFixed(speed === 1.25 ? 2 : 1)}x
        </button>
      </div>

      <div className="flex justify-between items-center mt-2 px-1 text-on-surface-variant text-[11px] font-medium tabular-nums">
        <span>{formatDuration(elapsedSec)}</span>
        <span>
          {audioError
            ? 'Unable to load audio'
            : formatDuration(actualDuration)}
        </span>
      </div>
    </div>
  );
};
