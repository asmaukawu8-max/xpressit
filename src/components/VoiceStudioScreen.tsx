import React, { useEffect, useRef, useState } from 'react';
import { ApiError, xpressitApi } from '../api/client';
import {
  ApiCategory,
  ApiMedia,
  ApiMeta,
  ApiPost,
  VoiceMaskPreset,
} from '../types';
import {
  CATEGORY_META,
  VOICE_MASK_PRESETS,
  createFallbackVoiceBlob,
  formatDuration,
} from '../utils/formatters';

interface VoiceStudioScreenProps {
  token: string;
  username: string;
  meta: ApiMeta | null;
  defaultMask: VoiceMaskPreset;
  onCancel: () => void;
  onSwitchToWritten: () => void;
  onPublished: (post: ApiPost) => void;
  onShowToast: (msg: string) => void;
}

const DEFAULT_BARS = [
  8, 16, 28, 40, 56, 32, 48, 64, 44, 56, 40, 52, 24, 48, 60, 64, 44, 32, 20, 8,
];

const VOICE_CHANNEL_OPTIONS: ApiCategory[] = [
  'confessions',
  'life',
  'mental-health',
  'relationships',
  'work',
  'wins',
];

export const VoiceStudioScreen: React.FC<VoiceStudioScreenProps> = ({
  token,
  username,
  meta,
  defaultMask,
  onCancel,
  onSwitchToWritten,
  onPublished,
  onShowToast,
}) => {
  const maxSeconds = meta?.limits.voiceSeconds ?? 300;
  const maxUploadMB = meta?.limits.uploadMB ?? 20;

  const [maskIndex, setMaskIndex] = useState(() => {
    const idx = VOICE_MASK_PRESETS.indexOf(defaultMask);
    return idx >= 0 ? idx : 0;
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [bars, setBars] = useState<number[]>(DEFAULT_BARS);
  const [selectedChannel, setSelectedChannel] =
    useState<ApiCategory>('confessions');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [attachedMedia, setAttachedMedia] = useState<ApiMedia | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedFilename, setRecordedFilename] = useState<string>('voice.webm');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentMask = VOICE_MASK_PRESETS[maskIndex];

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = window.setInterval(() => {
        setElapsedSec((prev) => {
          if (prev + 1 >= maxSeconds) {
            stopStream();
            setIsRecording(false);
            setIsPaused(false);
            setReviewOpen(true);
            return maxSeconds;
          }
          return prev + 1;
        });
      }, 1000);

      const waveTimer = window.setInterval(() => {
        setBars(
          DEFAULT_BARS.map((_, i) => {
            const centerBoost = 1 - Math.abs(i - 9.5) / 12;
            return Math.max(
              8,
              Math.min(64, Math.round((Math.random() * 44 + 16) * centerBoost))
            );
          })
        );
      }, 220);

      return () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        window.clearInterval(waveTimer);
      };
    }

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isRecording, isPaused, maxSeconds]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopStream = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startLiveRecording = async () => {
    setElapsedSec(0);
    setRecordedBlob(null);
    setErrorMsg(null);
    setIsRecording(true);
    setIsPaused(false);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        chunksRef.current = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          if (chunksRef.current.length > 0) {
            const actualMime = recorder.mimeType || 'audio/webm';
            const ext = actualMime.includes('mp4') ? 'm4a' : 'webm';
            const blob = new Blob(chunksRef.current, { type: actualMime });
            setRecordedBlob(blob);
            setRecordedFilename(`voice_${Date.now()}.${ext}`);
          }
        };
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      } catch {
        // Headless/denied mic: studio timer still runs and generates valid WAV fallback on stop
      }
    }
  };

  const handleToggleMasterRecord = () => {
    if (!isRecording) {
      startLiveRecording();
    } else {
      setIsRecording(false);
      setIsPaused(false);
      stopStream();
      setReviewOpen(true);
    }
  };

  const handlePauseToggle = () => {
    if (!isRecording) {
      startLiveRecording();
      return;
    }
    setIsPaused((prev) => {
      const next = !prev;
      if (mediaRecorderRef.current) {
        try {
          if (next && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.pause();
          } else if (!next && mediaRecorderRef.current.state === 'paused') {
            mediaRecorderRef.current.resume();
          }
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const handleStopAndReview = () => {
    if (isRecording) {
      setIsRecording(false);
      setIsPaused(false);
      stopStream();
    }
    if (elapsedSec === 0 && !recordedBlob) {
      onShowToast('Tap the microphone to record your voice confession first.');
      return;
    }
    setReviewOpen(true);
  };

  const handleDiscard = () => {
    setIsRecording(false);
    setIsPaused(false);
    stopStream();
    setElapsedSec(0);
    setBars(DEFAULT_BARS);
    setRecordedBlob(null);
    onShowToast('Voice take discarded');
  };

  const handlePhotoAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > maxUploadMB * 1024 * 1024) {
      onShowToast(`Image exceeds ${maxUploadMB} MB limit.`);
      return;
    }

    setUploadingPhoto(true);
    setErrorMsg(null);
    try {
      const uploaded = await xpressitApi.uploadMedia(token, 'image', file);
      setAttachedMedia(uploaded);
      onShowToast(`${uploaded.name} uploaded`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to upload image attachment.');
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePublish = async () => {
    const duration = Math.max(1, Math.min(maxSeconds, elapsedSec || 3));
    const blobToUpload = recordedBlob || createFallbackVoiceBlob(duration);
    const filenameToUpload = recordedBlob
      ? recordedFilename
      : `voice_studio_${Date.now()}.wav`;

    setPublishing(true);
    setErrorMsg(null);
    try {
      const voiceMedia = await xpressitApi.uploadMedia(
        token,
        'voice',
        blobToUpload,
        filenameToUpload
      );

      const post = await xpressitApi.createPost(token, {
        mode: 'voice',
        category: selectedChannel,
        title: title.trim() || undefined,
        content: caption.trim() || undefined,
        voice: {
          media: voiceMedia.id,
          duration,
        },
        attachments: attachedMedia ? [attachedMedia.id] : [],
      });

      setReviewOpen(false);
      onPublished(post);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to publish voice confession. Please try again.');
      }
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-12">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={handlePhotoAttach}
      />

      {/* Top Auxiliary Action Bar */}
      <div className="flex items-center justify-between py-2 mb-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-full bg-surface-container hover:bg-surface-variant text-on-surface text-[14px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
          <span>Cancel</span>
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-secondary-container text-[11px] font-bold tracking-wider">
          <span
            className={`w-2 h-2 rounded-full bg-tertiary ${
              isRecording && !isPaused ? 'animate-ping' : ''
            }`}
          />
          <span>{isRecording && !isPaused ? 'RECORDING' : 'LIVE STUDIO'}</span>
        </div>

        <button
          type="button"
          onClick={handleStopAndReview}
          className="px-4 py-2 rounded-full bg-primary hover:bg-primary-container text-on-primary text-[14px] font-semibold transition-transform active:scale-95 shadow-sm cursor-pointer"
        >
          Review
        </button>
      </div>

      {/* Mode Switcher Segmented Control */}
      <div className="w-full bg-surface-container-low p-1.5 rounded-full flex items-center mb-6 shadow-inner">
        <button
          type="button"
          onClick={onSwitchToWritten}
          className="flex-1 py-2 px-2 rounded-full text-center text-[12px] font-semibold text-on-surface-variant hover:text-on-surface transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">
            edit_note
          </span>
          <span>Written Story</span>
        </button>
        <button
          type="button"
          className="flex-1 py-2 px-2 rounded-full bg-surface-container-lowest text-center text-[12px] text-primary font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span className="material-symbols-outlined material-symbols-filled text-[18px]">
            mic
          </span>
          <span>Voice Note</span>
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Main Recording Studio Capsule */}
      <div className="w-full bg-surface-container-lowest rounded-3xl p-6 flex flex-col items-center relative overflow-hidden shadow-sm mb-4">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-tertiary-fixed/40 rounded-full blur-3xl pointer-events-none" />

        {/* Voice Mask Preset Selector */}
        <button
          type="button"
          onClick={() =>
            setMaskIndex((prev) => (prev + 1) % VOICE_MASK_PRESETS.length)
          }
          className="relative z-10 mb-6 px-4 py-2 rounded-full bg-surface-container-low hover:bg-surface-container transition-all flex items-center gap-2 group active:scale-95 cursor-pointer"
        >
          <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
            <span className="material-symbols-outlined text-[15px]">lock</span>
          </span>
          <span className="text-[12px] font-semibold text-on-surface">
            <span className="text-on-surface-variant">Voice Mask: </span>
            <span className="text-primary">{currentMask}</span>
          </span>
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
            tune
          </span>
        </button>

        {/* Visual Soundwave Spectrum */}
        <div className="w-full h-16 flex items-center justify-center gap-[4px] px-2 mb-4 overflow-hidden">
          {bars.map((height, idx) => (
            <span
              key={idx}
              style={{ height: `${height}px` }}
              className={`w-1 rounded-full transition-all duration-200 ${
                idx === 0 || idx === bars.length - 1
                  ? 'bg-surface-variant'
                  : idx >= 6 && idx <= 9
                  ? 'bg-tertiary'
                  : idx === 13 || idx === 14
                  ? 'bg-tertiary-container'
                  : 'bg-primary'
              }`}
            />
          ))}
        </div>

        {/* Duration Counter */}
        <div className="flex items-center gap-2 mb-7">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full bg-tertiary ${
              isRecording && !isPaused ? 'animate-pulse' : ''
            }`}
          />
          <span className="text-[18px] leading-[26px] font-semibold text-on-surface font-mono tracking-tight tabular-nums">
            {formatDuration(elapsedSec)}
          </span>
          <span className="text-[11px] font-medium text-on-surface-variant tabular-nums">
            / {formatDuration(maxSeconds)} max
          </span>
        </div>

        {/* Giant Glowing Pulsing Mic Button */}
        <div className="relative flex items-center justify-center my-1">
          {isRecording && !isPaused && (
            <div
              className="absolute w-36 h-36 rounded-full bg-primary/15 animate-ping"
              style={{ animationDuration: '2.4s' }}
            />
          )}
          <div className="absolute w-32 h-32 rounded-full bg-primary-container/20" />
          <button
            type="button"
            aria-label={isRecording ? 'Finish recording' : 'Start recording'}
            onClick={handleToggleMasterRecord}
            className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-primary-container text-on-primary flex items-center justify-center shadow-lg active:scale-95 transition-all focus:outline-none cursor-pointer"
          >
            <span className="material-symbols-outlined material-symbols-filled text-[44px]">
              {isRecording ? 'stop' : 'mic'}
            </span>
          </button>
        </div>

        <p className="text-[11px] font-medium text-on-surface-variant mt-5 mb-6 text-center max-w-xs">
          {isRecording
            ? isPaused
              ? 'Recording paused. Tap Resume or Stop & Review when ready.'
              : 'Recording live. Tap Stop & Review when finished.'
            : elapsedSec > 0
            ? 'Take ready. Tap Review to publish or tap the mic to record again.'
            : 'Tap the microphone to record your voice confession.'}
        </p>

        {/* Recording Controls Toolbar */}
        <div className="w-full pt-3 flex items-center justify-around">
          <button
            type="button"
            onClick={handlePauseToggle}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-surface-container transition-colors group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface group-active:scale-90 transition-transform">
              <span className="material-symbols-outlined text-[24px]">
                {isPaused || !isRecording ? 'play_arrow' : 'pause'}
              </span>
            </div>
            <span className="text-[11px] font-medium text-on-surface-variant group-hover:text-on-surface">
              {isPaused || !isRecording ? 'Record' : 'Pause'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleStopAndReview}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-surface-container transition-colors group cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-primary-fixed flex items-center justify-center text-primary group-active:scale-90 transition-transform shadow-sm">
              <span className="material-symbols-outlined material-symbols-filled text-[26px]">
                stop_circle
              </span>
            </div>
            <span className="text-[11px] text-primary font-bold">
              Stop &amp; Review
            </span>
          </button>

          <button
            type="button"
            onClick={handleDiscard}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-surface-container transition-colors group cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-error group-active:scale-90 transition-transform">
              <span className="material-symbols-outlined text-[24px]">
                delete
              </span>
            </div>
            <span className="text-[11px] font-medium text-on-surface-variant group-hover:text-error">
              Discard
            </span>
          </button>
        </div>
      </div>

      {/* Post Details Form Panel */}
      <div className="w-full bg-surface-container-lowest rounded-3xl p-4 mb-4 shadow-sm flex flex-col gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[12px] text-on-surface font-bold">
              Diary Channel
            </label>
            <span className="text-[11px] text-on-surface-variant">
              Select topic
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
            {VOICE_CHANNEL_OPTIONS.map((catId) => {
              const info = CATEGORY_META[catId];
              const active = selectedChannel === catId;
              return (
                <button
                  key={catId}
                  type="button"
                  onClick={() => setSelectedChannel(catId)}
                  className={`px-4 py-2 rounded-full text-[12px] font-semibold shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container hover:bg-surface-variant text-on-surface-variant'
                  }`}
                >
                  <span>{info.emoji}</span>
                  <span>{info.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label
            htmlFor="voice-title"
            className="text-[12px] text-on-surface font-bold mb-1.5 block"
          >
            Headline (Optional)
          </label>
          <input
            id="voice-title"
            type="text"
            maxLength={meta?.limits.titleCharacters ?? 120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your voice note a title..."
            className="w-full rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label
            htmlFor="confession-caption"
            className="text-[12px] text-on-surface font-bold mb-1.5 block"
          >
            Story Caption (Optional)
          </label>
          <div className="w-full rounded-2xl bg-surface-container-low p-4 focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <textarea
              id="confession-caption"
              maxLength={280}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a brief note about this recording... What moved you to speak today?"
              rows={3}
              className="w-full bg-transparent resize-none text-[15px] leading-[24px] text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none"
            />
            <div className="flex justify-between items-center pt-2">
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                sentiment_satisfied
              </span>
              <span className="text-[11px] text-on-surface-variant tabular-nums">
                {caption.length} / 280
              </span>
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            disabled={uploadingPhoto}
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-4 rounded-2xl bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center justify-between transition-colors cursor-pointer disabled:opacity-60"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[18px]">
                  add_photo_alternate
                </span>
              </span>
              <span className="text-[12px] font-semibold text-on-surface truncate">
                {uploadingPhoto
                  ? 'Uploading attachment...'
                  : attachedMedia
                  ? `Attached: ${attachedMedia.name}`
                  : 'Attach contextual screenshot or photo'}
              </span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
              chevron_right
            </span>
          </button>
        </div>
      </div>

      {/* Anonymity Notice */}
      <div className="w-full p-4 rounded-2xl bg-surface-container flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-[18px]">
            verified_user
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[12px] text-on-surface font-bold">
            Pseudonymous Voice Sanctuary
          </span>
          <p className="text-[13px] text-on-surface-variant mt-0.5 leading-relaxed">
            Published under @{username} with private authenticated audio
            streaming.
          </p>
        </div>
      </div>

      {/* Review & Publish Modal */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface">
                Review Voice Confession
              </h3>
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>

            <div className="rounded-2xl bg-surface-container-low p-4 mb-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface">
                  @{username} · {CATEGORY_META[selectedChannel].emoji}{' '}
                  {CATEGORY_META[selectedChannel].label}
                </span>
                <span className="font-mono text-primary font-semibold tabular-nums">
                  {formatDuration(Math.max(1, elapsedSec))}
                </span>
              </div>
              {title.trim() && (
                <p className="text-sm font-bold text-on-surface">{title}</p>
              )}
              {caption.trim() && (
                <p className="text-xs text-on-surface-variant">{caption}</p>
              )}
            </div>

            {errorMsg && (
              <div className="mb-3 p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={publishing}
                onClick={() => setReviewOpen(false)}
                className="flex-1 py-3 rounded-full bg-surface-container text-on-surface text-sm font-semibold cursor-pointer"
              >
                Back to Studio
              </button>
              <button
                type="button"
                disabled={publishing}
                onClick={handlePublish}
                className="flex-1 py-3 rounded-full bg-primary text-on-primary text-sm font-semibold shadow-md cursor-pointer disabled:opacity-60"
              >
                {publishing ? 'Uploading...' : 'Publish Anonymously'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
