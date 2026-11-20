import React, { useEffect, useRef, useState } from 'react';
import { ApiError, fetchAuthenticatedMediaUrl, xpressitApi } from '../api/client';
import {
  ApiComment,
  ApiMedia,
  ApiPost,
  ApiReactionType,
  ReportReason,
  VoiceMaskPreset,
} from '../types';
import {
  CATEGORY_META,
  REACTION_META,
  formatBytes,
  formatCompactCount,
  formatRelativeTime,
} from '../utils/formatters';
import { AudioWaveformPlayer } from './AudioWaveformPlayer';
import { AuthenticatedMedia } from './AuthenticatedMedia';

interface StoryDetailScreenProps {
  token: string;
  username: string;
  post: ApiPost;
  isBookmarked: boolean;
  voiceMaskLabel: VoiceMaskPreset;
  onToggleReaction: (postId: string, type: ApiReactionType) => void;
  onToggleBookmark: (postId: string) => void;
  onEditPost: (post: ApiPost) => void;
  onDeletedPost: (postId: string) => void;
  onBlockAuthor: (userId: string, authorUsername: string) => void;
  onShareStory: (post: ApiPost) => void;
  onPostUpdated: (post: ApiPost) => void;
  onShowToast: (msg: string) => void;
}

const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'harassment', label: 'Harassment or abuse' },
  { id: 'hate', label: 'Hate speech' },
  { id: 'personal-information', label: 'Personal or identifying info' },
  { id: 'spam', label: 'Spam or solicitation' },
  { id: 'other', label: 'Other concern' },
];

export const StoryDetailScreen: React.FC<StoryDetailScreenProps> = ({
  token,
  username,
  post,
  isBookmarked,
  voiceMaskLabel,
  onToggleReaction,
  onToggleBookmark,
  onEditPost,
  onDeletedPost,
  onBlockAuthor,
  onShareStory,
  onPostUpdated,
  onShowToast,
}) => {
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const [replyText, setReplyText] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [evidencePreview, setEvidencePreview] = useState<ApiMedia | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingComments(true);
    setCommentsPage(1);

    Promise.all([
      xpressitApi.getPost(token, post.id).catch(() => null),
      xpressitApi.getComments(token, post.id, 1, 20),
    ])
      .then(([freshPost, commentsRes]) => {
        if (!active) return;
        if (freshPost) {
          onPostUpdated(freshPost);
        }
        setComments(commentsRes.data);
        setCommentsHasMore(commentsRes.pagination.hasMore);
      })
      .catch(() => {
        if (active) setComments([]);
      })
      .finally(() => {
        if (active) setLoadingComments(false);
      });

    return () => {
      active = false;
    };
  }, [token, post.id]);

  const loadMoreComments = async () => {
    const nextPage = commentsPage + 1;
    try {
      const res = await xpressitApi.getComments(token, post.id, nextPage, 20);
      setComments((prev) => [...prev, ...res.data]);
      setCommentsHasMore(res.pagination.hasMore);
      setCommentsPage(nextPage);
    } catch {
      onShowToast('Unable to load older echoes');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || postingComment) return;

    setPostingComment(true);
    try {
      const created = await xpressitApi.addComment(token, post.id, trimmed);
      setComments((prev) => [created, ...prev]);
      onPostUpdated({ ...post, commentCount: post.commentCount + 1 });
      setReplyText('');
      onShowToast('Anonymous echo posted');
    } catch (err) {
      if (err instanceof ApiError) {
        onShowToast(err.message);
      } else {
        onShowToast('Failed to send reply.');
      }
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await xpressitApi.deleteComment(token, post.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onPostUpdated({
        ...post,
        commentCount: Math.max(0, post.commentCount - 1),
      });
      onShowToast('Echo deleted');
    } catch (err) {
      if (err instanceof ApiError) {
        onShowToast(err.message);
      }
    }
  };

  const handleDeletePost = async () => {
    setDeletingPost(true);
    try {
      await xpressitApi.deletePost(token, post.id);
      setDeleteConfirmOpen(false);
      onDeletedPost(post.id);
    } catch (err) {
      if (err instanceof ApiError) {
        onShowToast(err.message);
      } else {
        onShowToast('Unable to delete story.');
      }
    } finally {
      setDeletingPost(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReport(true);
    try {
      await xpressitApi.reportPost(
        token,
        post.id,
        reportReason,
        reportDetails.trim() || undefined
      );
      setReportModalOpen(false);
      setReportDetails('');
      onShowToast('Report submitted anonymously');
    } catch (err) {
      if (err instanceof ApiError) {
        onShowToast(err.message);
      } else {
        onShowToast('Unable to submit report.');
      }
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleOpenDocument = async (media: ApiMedia) => {
    try {
      const url = await fetchAuthenticatedMediaUrl(token, media.url);
      const a = document.createElement('a');
      a.href = url;
      a.download = media.name;
      a.click();
    } catch {
      onShowToast('Could not open document.');
    }
  };

  const catMeta = CATEGORY_META[post.category] || CATEGORY_META.other;
  const totalReassured =
    (post.reactions.love || 0) +
    (post.reactions.support || 0) +
    (post.reactions.resonate || 0);

  return (
    <div className="flex flex-col w-full pb-28">
      {/* Top Action & Meta Bar */}
      <div className="flex items-center justify-between py-2 mb-2 relative">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-[12px] font-semibold">
            {catMeta.hashtag}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-medium">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            Strict Anonymity
          </span>
        </div>

        <div className="flex items-center gap-1.5 relative">
          <button
            type="button"
            aria-label="Share story"
            onClick={() => onShareStory(post)}
            className="w-10 h-10 rounded-full bg-surface-container-low text-on-surface flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">
              ios_share
            </span>
          </button>
          <button
            type="button"
            aria-label="More options"
            onClick={() => setMoreMenuOpen((prev) => !prev)}
            className="w-10 h-10 rounded-full bg-surface-container-low text-on-surface flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">
              more_horiz
            </span>
          </button>

          {moreMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMoreMenuOpen(false)}
              />
              <div className="absolute right-0 top-11 z-40 w-52 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onToggleBookmark(post.id);
                    setMoreMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-low cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[17px] text-primary">
                    bookmark
                  </span>
                  <span>
                    {isBookmarked ? 'Remove Bookmark' : 'Save Confession'}
                  </span>
                </button>

                {post.isMine && post.mode === 'text' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onEditPost(post);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-on-surface hover:bg-surface-container-low cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[17px] text-primary">
                      edit
                    </span>
                    <span>Edit Story</span>
                  </button>
                )}

                {post.isMine && (
                  <button
                    type="button"
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setDeleteConfirmOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-error hover:bg-error-container/50 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[17px]">
                      delete
                    </span>
                    <span>Delete Story</span>
                  </button>
                )}

                {!post.isMine && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onBlockAuthor(post.author.id, post.author.username);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-error hover:bg-error-container/50 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        block
                      </span>
                      <span>Block @{post.author.username}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setReportModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        flag
                      </span>
                      <span>Report Content</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Confession Card */}
      <article className="bg-surface-container-lowest rounded-xl p-6 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-primary to-surface-tint flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[22px]">
                {post.mode === 'voice' ? 'mic' : 'masks'}
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold text-on-surface">
                  @{post.author.username}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-surface-container-high text-primary text-[11px] font-medium">
                  <span className="material-symbols-outlined text-[13px] mr-0.5">
                    verified_user
                  </span>
                  {post.isMine ? 'You' : 'Verified'}
                </span>
              </div>
              <span className="text-[11px] font-medium text-on-surface-variant">
                {formatRelativeTime(post.createdAt)} • {catMeta.emoji}{' '}
                {catMeta.label}
              </span>
            </div>
          </div>

          <button
            type="button"
            aria-label="Bookmark confession"
            onClick={() => onToggleBookmark(post.id)}
            className={`w-10 h-10 rounded-full bg-surface-container flex items-center justify-center transition-colors cursor-pointer ${
              isBookmarked
                ? 'text-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                isBookmarked ? 'material-symbols-filled' : ''
              }`}
            >
              {isBookmarked ? 'bookmark' : 'bookmark_border'}
            </span>
          </button>
        </div>

        {post.title && (
          <h1 className="text-[20px] leading-[28px] font-bold tracking-[-0.015em] text-on-surface mb-4">
            {post.title}
          </h1>
        )}

        {post.content && (
          <div className="text-[17px] leading-[28px] text-on-surface-variant whitespace-pre-line mb-6">
            {post.content}
          </div>
        )}

        {post.voice && (
          <AudioWaveformPlayer
            voice={post.voice}
            token={token}
            voiceMaskLabel={voiceMaskLabel}
            variant="detail"
          />
        )}

        {/* Attachments */}
        {post.attachments.length > 0 && (
          <div className="space-y-3 mb-6">
            {post.attachments.map((att) =>
              att.kind === 'image' || att.kind === 'video' ? (
                <div
                  key={att.id}
                  onClick={() => att.kind === 'image' && setEvidencePreview(att)}
                  className="relative w-full h-60 sm:h-72 rounded-xl overflow-hidden shadow-inner bg-surface-container-low cursor-pointer"
                >
                  <AuthenticatedMedia
                    media={att}
                    token={token}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  key={att.id}
                  className="bg-surface-container rounded-xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-highest text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[22px]">
                        description
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[12px] font-semibold text-on-surface truncate">
                        {att.name}
                      </span>
                      <span className="text-[11px] text-on-surface-variant tabular-nums">
                        {formatBytes(att.size)} · PDF Document
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenDocument(att)}
                    className="px-3.5 py-2 rounded-full bg-surface-container-lowest text-on-surface text-[12px] font-semibold hover:bg-surface-container-high transition-colors shrink-0 shadow-sm cursor-pointer"
                  >
                    Download
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* Emotional Empathy Reaction Grid */}
        <div className="bg-surface-container-low/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[12px] text-on-surface-variant font-medium">
              Community Sentiments
            </span>
            <span className="text-[11px] text-primary font-semibold tabular-nums">
              {totalReassured.toLocaleString()} Reassured
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['love', 'support', 'resonate'] as const).map((rType) => {
              const active = post.myReaction === rType;
              const info = REACTION_META[rType];
              return (
                <button
                  key={rType}
                  type="button"
                  onClick={() => onToggleReaction(post.id, rType)}
                  className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg active:scale-95 transition-all shadow-sm cursor-pointer ${
                    active
                      ? 'bg-primary-fixed/60 ring-2 ring-primary'
                      : 'bg-surface-container-lowest hover:bg-surface-container-high'
                  }`}
                >
                  <span className="text-lg mb-0.5">{info.emoji}</span>
                  <span className="text-[11px] font-semibold text-on-surface">
                    {info.label}
                  </span>
                  <span
                    className={`text-[11px] tabular-nums ${
                      active
                        ? 'text-primary font-bold'
                        : 'text-on-surface-variant font-medium'
                    }`}
                  >
                    {formatCompactCount(post.reactions[rType] || 0)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </article>

      {/* Discussion Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] leading-[26px] font-semibold text-on-surface">
            Anonymous Echoes
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface text-[11px] font-semibold tabular-nums">
            {post.commentCount}
          </span>
        </div>
      </div>

      {/* Comments Timeline Stream */}
      <div className="flex flex-col gap-3 mb-6">
        {loadingComments ? (
          <div className="bg-surface-container-lowest rounded-xl p-6 text-center text-xs text-on-surface-variant">
            Loading anonymous echoes...
          </div>
        ) : comments.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl p-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-on-surface">
              Be the first to leave a kind echo
            </p>
            <p className="text-xs text-on-surface-variant mt-1">
              Your reply will appear under your handle @{username}.
            </p>
          </div>
        ) : (
          <>
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-surface-container-lowest rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-fixed to-surface-variant text-primary flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-[16px]">
                        masks
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold text-on-surface">
                          @{comment.author.username}
                        </span>
                        {comment.author.id === post.author.id && (
                          <span className="px-1.5 py-0.5 rounded bg-primary-container text-on-primary-container text-[10px] font-semibold">
                            Author
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                  </div>

                  {comment.isMine && (
                    <button
                      type="button"
                      aria-label="Delete comment"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="w-8 h-8 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/50 flex items-center justify-center cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        delete
                      </span>
                    </button>
                  )}
                </div>

                <p className="text-[15px] leading-[24px] text-on-surface pl-10 whitespace-pre-line">
                  {comment.content}
                </p>
              </div>
            ))}

            {commentsHasMore && (
              <button
                type="button"
                onClick={loadMoreComments}
                className="w-full py-2.5 rounded-full bg-surface-container text-primary text-xs font-semibold cursor-pointer"
              >
                Load older echoes
              </button>
            )}
          </>
        )}
      </div>

      {/* Persistent Floating Anonymous Reply Dock */}
      <div className="fixed bottom-3 inset-x-4 max-w-xl mx-auto z-40">
        <form
          onSubmit={handleSendReply}
          className="bg-surface-container-lowest/95 backdrop-blur-xl shadow-xl border border-outline-variant/30 rounded-full p-1.5 flex items-center gap-2"
        >
          <div className="w-9 h-9 rounded-full bg-surface-container-high text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">masks</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Leave an anonymous reply... 🔒"
            className="flex-1 bg-transparent px-2 py-1.5 text-[13px] text-on-surface placeholder:text-on-surface-variant focus:outline-none min-w-0"
          />
          <button
            type="submit"
            disabled={postingComment || !replyText.trim()}
            aria-label="Send anonymous reply"
            className="w-10 h-10 rounded-full bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary flex items-center justify-center shadow-md active:scale-95 transition-transform shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </form>
      </div>

      {/* Evidence Image Zoom Modal */}
      {evidencePreview && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-on-surface truncate">
                {evidencePreview.name}
              </span>
              <button
                type="button"
                onClick={() => setEvidencePreview(null)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden max-h-[70vh] bg-surface-container-low">
              <AuthenticatedMedia
                media={evidencePreview}
                token={token}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Post Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-on-surface text-center">
              Delete this confession?
            </h3>
            <p className="text-sm text-on-surface-variant text-center">
              This permanently removes your story, reactions, and comments from
              Xpressit.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-3 rounded-full bg-surface-container text-on-surface text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingPost}
                onClick={handleDeletePost}
                className="flex-1 py-3 rounded-full bg-error text-on-error text-sm font-semibold cursor-pointer disabled:opacity-60"
              >
                {deletingPost ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Post Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitReport}
            className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-on-surface">
                Report Story
              </h3>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>

            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                    reportReason === r.id
                      ? 'bg-primary-fixed/50 text-on-surface'
                      : 'bg-surface-container-low text-on-surface-variant'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    checked={reportReason === r.id}
                    onChange={() => setReportReason(r.id)}
                    className="accent-primary"
                  />
                  <span className="text-xs font-semibold">{r.label}</span>
                </label>
              ))}
            </div>

            <textarea
              rows={3}
              maxLength={1000}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Optional context for moderators..."
              className="w-full rounded-2xl bg-surface-container-low p-3 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />

            <button
              type="submit"
              disabled={submittingReport}
              className="w-full py-3 rounded-full bg-primary text-on-primary text-sm font-semibold cursor-pointer disabled:opacity-60"
            >
              {submittingReport ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
