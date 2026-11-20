import React, { useRef, useState } from 'react';
import { ApiError, xpressitApi } from '../api/client';
import {
  ApiCategory,
  ApiMedia,
  ApiMeta,
  ApiPost,
  MediaKind,
} from '../types';
import { CATEGORY_META, formatBytes } from '../utils/formatters';
import { AuthenticatedMedia } from './AuthenticatedMedia';

interface CreateTextStoryScreenProps {
  token: string;
  username: string;
  meta: ApiMeta | null;
  editingPost?: ApiPost | null;
  onCancel: () => void;
  onSwitchToVoice: () => void;
  onPublished: (post: ApiPost, markSensitive: boolean) => void;
  onShowToast: (msg: string) => void;
}

export const CreateTextStoryScreen: React.FC<CreateTextStoryScreenProps> = ({
  token,
  username,
  meta,
  editingPost,
  onCancel,
  onSwitchToVoice,
  onPublished,
  onShowToast,
}) => {
  const categories =
    meta?.categories ||
    ([
      'confessions',
      'life',
      'relationships',
      'work',
      'family',
      'mental-health',
      'wins',
      'other',
    ] as ApiCategory[]);
  const maxTitle = meta?.limits.titleCharacters ?? 120;
  const maxContent = meta?.limits.textCharacters ?? 5000;
  const maxAttachments = meta?.limits.attachmentsPerPost ?? 5;
  const maxUploadMB = meta?.limits.uploadMB ?? 20;

  const [selectedCategory, setSelectedCategory] = useState<ApiCategory>(
    editingPost?.category || 'confessions'
  );
  const [title, setTitle] = useState(editingPost?.title || '');
  const [content, setContent] = useState(editingPost?.content || '');
  const [attachments, setAttachments] = useState<ApiMedia[]>(
    editingPost?.attachments || []
  );
  const [isSensitive, setIsSensitive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingKind, setPendingKind] = useState<MediaKind>('image');

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const catharsisLevel =
    wordCount > 45 ? 'High' : wordCount > 15 ? 'Moderate' : 'Gentle';

  const triggerFileSelect = (kind: MediaKind) => {
    if (attachments.length >= maxAttachments) {
      onShowToast(`Maximum ${maxAttachments} attachments per story.`);
      return;
    }
    setPendingKind(kind);
    if (fileInputRef.current) {
      fileInputRef.current.accept =
        kind === 'image'
          ? 'image/png,image/jpeg,image/gif,image/webp'
          : kind === 'video'
          ? 'video/mp4,video/webm'
          : kind === 'document'
          ? 'application/pdf,.pdf'
          : 'audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,.m4a';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > maxUploadMB * 1024 * 1024) {
      onShowToast(`File exceeds ${maxUploadMB} MB upload limit.`);
      return;
    }

    setUploading(true);
    setErrorMsg(null);
    try {
      const uploaded = await xpressitApi.uploadMedia(token, pendingKind, file);
      setAttachments((prev) => [...prev, uploaded]);
      onShowToast(`${uploaded.name} uploaded`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to upload attachment.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAttachment = async (media: ApiMedia) => {
    setAttachments((prev) => prev.filter((item) => item.id !== media.id));
    if (!editingPost) {
      try {
        await xpressitApi.deleteMedia(token, media.id);
      } catch {
        // Non-blocking if already detached
      }
    }
  };

  const handlePublish = async () => {
    const trimmedContent = content.trim();
    const trimmedTitle = title.trim();

    if (!trimmedContent) {
      setErrorMsg('Please share your story before publishing.');
      return;
    }
    if (trimmedTitle.length > maxTitle) {
      setErrorMsg(`Headline must be ${maxTitle} characters or fewer.`);
      return;
    }
    if (trimmedContent.length > maxContent) {
      setErrorMsg(`Story must be ${maxContent} characters or fewer.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const payload = {
        mode: 'text' as const,
        category: selectedCategory,
        title: trimmedTitle,
        content: trimmedContent,
        attachments: attachments.map((a) => a.id),
      };

      const saved = editingPost
        ? await xpressitApi.updatePost(token, editingPost.id, payload)
        : await xpressitApi.createPost(token, payload);

      onPublished(saved, isSensitive);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to publish story. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const catMeta = CATEGORY_META[selectedCategory] || CATEGORY_META.other;

  return (
    <div className="flex flex-col w-full pb-12">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Action & Status Bar */}
      <div className="flex items-center justify-between py-2 mb-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface text-[12px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
          <span>Cancel</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-primary text-[11px] font-medium whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {editingPost ? 'Editing story' : 'Ready to publish'}
          </span>
          <button
            type="button"
            disabled={submitting || uploading}
            onClick={handlePublish}
            className="px-4 py-2 rounded-full bg-primary hover:bg-primary-container disabled:opacity-60 transition-all shadow-md shadow-primary/20 text-on-primary text-[12px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <span className="hidden sm:inline">
              {submitting
                ? 'Publishing...'
                : editingPost
                ? 'Save Changes'
                : 'Publish Anonymously'}
            </span>
            <span className="sm:hidden">
              {submitting ? 'Saving...' : 'Publish'}
            </span>
            <span className="material-symbols-outlined text-[16px]">lock</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      {!editingPost && (
        <div className="w-full bg-surface-container p-1 rounded-full flex items-center mb-4">
          <button
            type="button"
            className="flex-1 py-2.5 px-4 rounded-full bg-surface-container-lowest shadow-sm flex items-center justify-center gap-2 text-primary text-[12px] font-bold transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              edit_note
            </span>
            <span>Written Story</span>
          </button>
          <button
            type="button"
            onClick={onSwitchToVoice}
            className="flex-1 py-2.5 px-4 rounded-full text-secondary hover:text-on-surface flex items-center justify-center gap-2 text-[12px] font-semibold transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">mic</span>
            <span>Voice Note</span>
          </button>
        </div>
      )}

      {/* Reassurance & Privacy Shield Banner */}
      <div className="w-full bg-surface-container-low rounded-xl p-4 mb-4 flex items-start gap-3 shadow-sm">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
          <span className="material-symbols-outlined material-symbols-filled text-[18px]">
            shield
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-semibold text-on-surface">
              Publishing as @{username}
            </span>
            <span className="material-symbols-outlined material-symbols-filled text-[14px] text-primary">
              verified_user
            </span>
          </div>
          <p className="text-[13px] leading-[20px] text-on-surface-variant mt-0.5">
            No email, phone number, or real name is stored. Your story is linked
            only to your pseudonymous handle.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-xl bg-error-container text-on-error-container text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Category & Mood Selector */}
      <div className="mb-4">
        <label className="block text-[12px] font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wider">
          Category &amp; Tone
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
          {categories.map((catId) => {
            const info = CATEGORY_META[catId] || CATEGORY_META.other;
            const active = selectedCategory === catId;
            return (
              <button
                key={catId}
                type="button"
                onClick={() => setSelectedCategory(catId)}
                className={`shrink-0 h-9 px-3.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                }`}
              >
                <span>{info.emoji}</span>
                <span>{info.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Writing Canvas Card */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-4 shadow-sm mb-4">
        <div className="mb-2 pb-1 border-b border-outline-variant/25">
          <input
            type="text"
            maxLength={maxTitle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give it a headline (optional)..."
            className="w-full bg-transparent text-[18px] leading-[26px] font-semibold text-on-surface placeholder:text-outline focus:outline-none"
          />
        </div>

        <div className="relative">
          <textarea
            value={content}
            maxLength={maxContent}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's your experience? Don't hold back. This is your safe space."
            rows={7}
            className="w-full bg-transparent text-[17px] leading-[28px] text-on-surface placeholder:text-outline focus:outline-none resize-none"
          />
          <div className="flex items-center justify-between pt-2 mt-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-secondary">
              <span className="material-symbols-outlined text-[14px] text-tertiary">
                favorite
              </span>
              Catharsis Rating: {catharsisLevel}
            </span>
            <span className="text-[11px] font-medium text-on-surface-variant tabular-nums">
              {content.length} / {maxContent.toLocaleString()} chars
            </span>
          </div>
        </div>
      </div>

      {/* Supporting Evidence Section */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] leading-[26px] font-semibold text-on-surface">
                Supporting Evidence
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-surface-container text-[11px] font-medium text-secondary">
                Optional ({attachments.length}/{maxAttachments})
              </span>
            </div>
            <p className="text-[13px] leading-[20px] text-on-surface-variant mt-0.5">
              Images, short videos, or PDFs (up to {maxUploadMB} MB each).
            </p>
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-12 h-12 rounded-lg bg-surface-variant overflow-hidden shrink-0 flex items-center justify-center">
                    {att.kind === 'image' ? (
                      <AuthenticatedMedia
                        media={att}
                        token={token}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[20px] text-primary">
                        {att.kind === 'video'
                          ? 'movie'
                          : att.kind === 'voice'
                          ? 'audio_file'
                          : 'description'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-semibold text-on-surface truncate">
                      {att.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-medium text-on-surface-variant tabular-nums">
                        {formatBytes(att.size)}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-outline" />
                      <span className="text-[11px] font-medium text-primary uppercase">
                        {att.kind}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => handleRemoveAttachment(att)}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-error-container hover:text-on-error-container text-on-surface-variant transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    close
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-3">
          <button
            type="button"
            disabled={uploading}
            onClick={() => triggerFileSelect('image')}
            className="py-2.5 px-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-60 transition-colors flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] text-primary">
              add_photo_alternate
            </span>
            <span className="text-[11px] text-on-surface font-medium truncate w-full">
              {uploading && pendingKind === 'image'
                ? 'Uploading...'
                : 'Photo / Proof'}
            </span>
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => triggerFileSelect('document')}
            className="py-2.5 px-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-60 transition-colors flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] text-primary">
              description
            </span>
            <span className="text-[11px] text-on-surface font-medium truncate w-full">
              {uploading && pendingKind === 'document'
                ? 'Uploading...'
                : 'PDF Document'}
            </span>
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => triggerFileSelect('video')}
            className="py-2.5 px-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-60 transition-colors flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px] text-primary">
              videocam
            </span>
            <span className="text-[11px] text-on-surface font-medium truncate w-full">
              {uploading && pendingKind === 'video'
                ? 'Uploading...'
                : 'Video Clip'}
            </span>
          </button>
        </div>
      </div>

      {/* Safety & Content Warning Toggle */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-4 shadow-sm mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <div className="w-9 h-9 rounded-full bg-tertiary/10 text-tertiary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">
              warning
            </span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[14px] font-semibold text-on-surface">
              Mark Sensitive Content (TW)
            </span>
            <span className="text-[13px] text-on-surface-variant truncate">
              Adds a local blur filter on your feed preview
            </span>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isSensitive}
          onClick={() => setIsSensitive((prev) => !prev)}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
            isSensitive ? 'bg-primary' : 'bg-secondary-container'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-surface-container-lowest shadow-sm transition duration-200 ${
              isSensitive ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Bottom Action Tray */}
      <div className="w-full flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex-1 py-3.5 px-4 rounded-full bg-surface-container-low hover:bg-surface-container text-primary text-[14px] font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">
            visibility
          </span>
          <span>Preview</span>
        </button>
        <button
          type="button"
          disabled={submitting || uploading}
          onClick={handlePublish}
          className="flex-[2] py-3.5 px-6 rounded-full bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary text-[14px] font-semibold transition-all shadow-md shadow-primary/30 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
        >
          <span className="material-symbols-outlined material-symbols-filled text-[20px]">
            lock
          </span>
          <span>
            {submitting
              ? 'Publishing...'
              : editingPost
              ? 'Save Changes'
              : 'Publish Anonymously'}
          </span>
        </button>
      </div>

      {/* Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Anonymous Card Preview
              </span>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>

            <div className="rounded-2xl bg-surface-container-low p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">
                      masks
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">
                      @{username} · Just now
                    </p>
                    <p className="text-[11px] text-primary">
                      Verified Anonymous
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-surface-container-lowest text-[11px] font-medium text-on-surface">
                  {catMeta.emoji} {catMeta.label}
                </span>
              </div>

              {title.trim() && (
                <h3 className="text-lg font-bold text-on-surface mb-2">
                  {title}
                </h3>
              )}
              <p className="text-sm text-on-surface-variant whitespace-pre-line leading-relaxed">
                {content || 'No confession text entered yet.'}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="flex-1 py-3 rounded-full bg-surface-container text-on-surface text-sm font-semibold cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setPreviewOpen(false);
                  handlePublish();
                }}
                className="flex-1 py-3 rounded-full bg-primary text-on-primary text-sm font-semibold cursor-pointer"
              >
                Publish Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
