import React, { useMemo, useState } from 'react';
import {
  ApiCategory,
  ApiPagination,
  ApiPost,
  ApiReactionType,
  CategoryFilter,
  FeedTab,
  LocalClientPreferences,
  ScreenRoute,
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

interface HomeFeedScreenProps {
  token: string;
  posts: ApiPost[];
  pagination: ApiPagination | null;
  categories: ApiCategory[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  localPrefs: LocalClientPreferences;
  activeTab: FeedTab;
  activeCategory: CategoryFilter;
  onChangeTab: (tab: FeedTab) => void;
  onChangeCategory: (category: CategoryFilter) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onOpenStory: (postId: string) => void;
  onNavigate: (route: ScreenRoute) => void;
  onToggleReaction: (postId: string, type: ApiReactionType) => void;
  onToggleBookmark: (postId: string) => void;
  onShareStory: (post: ApiPost) => void;
}

type FormatFilter = 'all' | 'voice' | 'text' | 'saved';

export const HomeFeedScreen: React.FC<HomeFeedScreenProps> = ({
  token,
  posts,
  pagination,
  categories,
  loading,
  loadingMore,
  error,
  localPrefs,
  activeTab,
  activeCategory,
  onChangeTab,
  onChangeCategory,
  onRefresh,
  onLoadMore,
  onOpenStory,
  onNavigate,
  onToggleReaction,
  onToggleBookmark,
  onShareStory,
}) => {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  const visiblePosts = useMemo(() => {
    if (formatFilter === 'voice') {
      return posts.filter((p) => p.mode === 'voice' || Boolean(p.voice));
    }
    if (formatFilter === 'text') {
      return posts.filter((p) => p.mode === 'text' && !p.voice);
    }
    if (formatFilter === 'saved') {
      return posts.filter((p) => localPrefs.bookmarkedIds.includes(p.id));
    }
    return posts;
  }, [posts, formatFilter, localPrefs.bookmarkedIds]);

  const categoryChipClass = (cat: ApiCategory) => {
    if (cat === 'relationships') {
      return 'bg-tertiary-fixed/60 text-tertiary';
    }
    if (cat === 'wins' || cat === 'mental-health') {
      return 'bg-primary-fixed/60 text-primary';
    }
    return 'bg-surface-container-low text-on-surface-variant';
  };

  return (
    <div className="flex flex-col w-full gap-y-4">
      {/* Encouragement Banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary-fixed via-surface-container-low to-primary-fixed/60 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary shadow-sm">
              <span className="material-symbols-outlined material-symbols-filled text-[20px]">
                lock
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[18px] leading-[26px] font-semibold tracking-[-0.01em] text-on-surface truncate">
                Share your burden
              </span>
              <span className="text-[13px] leading-[20px] text-on-surface-variant">
                100% anonymous sanctuary for your thoughts.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('create-text')}
            className="shrink-0 rounded-full bg-primary hover:bg-primary-container px-4 py-2 text-[12px] leading-[16px] font-semibold text-on-primary shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            Whisper
          </button>
        </div>
      </div>

      {/* Feed Sub-Navigation (For You, Latest, Trending) */}
      <div className="flex items-center justify-between px-1 relative">
        <div className="flex items-center gap-6">
          {(
            [
              { id: 'for-you', label: 'For You' },
              { id: 'latest', label: 'Latest' },
              { id: 'trending', label: 'Trending' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={`relative pb-2 text-[18px] leading-[26px] font-semibold tracking-[-0.01em] transition-colors focus:outline-none cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'text-primary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 h-1 w-full rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 relative">
          <button
            type="button"
            aria-label="Refresh Feed"
            onClick={onRefresh}
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <span
              className={`material-symbols-outlined text-[20px] ${
                loading ? 'animate-spin' : ''
              }`}
            >
              refresh
            </span>
          </button>

          <button
            type="button"
            aria-label="Filter Feed"
            onClick={() => setFilterMenuOpen((prev) => !prev)}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors cursor-pointer ${
              formatFilter !== 'all'
                ? 'bg-primary-fixed text-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>

          {filterMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setFilterMenuOpen(false)}
              />
              <div className="absolute right-0 top-11 z-40 w-48 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-1.5">
                {(
                  [
                    { id: 'all', label: 'All Confessions', icon: 'apps' },
                    { id: 'voice', label: 'Voice Notes Only', icon: 'mic' },
                    { id: 'text', label: 'Written Stories', icon: 'edit_note' },
                    { id: 'saved', label: 'Bookmarked', icon: 'bookmark' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setFormatFilter(opt.id);
                      setFilterMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      formatFilter === opt.id
                        ? 'bg-primary-fixed text-primary'
                        : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {opt.icon}
                    </span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Category Filter Buttons */}
      <div className="no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto py-0.5">
        <button
          type="button"
          onClick={() => onChangeCategory('All')}
          className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] leading-[16px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
            activeCategory === 'All'
              ? 'bg-primary-container text-on-primary shadow-sm'
              : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
          }`}
        >
          All
        </button>
        {categories.map((catId) => {
          const meta = CATEGORY_META[catId] || CATEGORY_META.other;
          const isActive = activeCategory === catId;
          return (
            <button
              key={catId}
              type="button"
              onClick={() => onChangeCategory(catId)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[12px] leading-[16px] font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary-container text-on-primary shadow-sm'
                  : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
              }`}
            >
              <span>{meta.emoji}</span>
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-2xl bg-error-container/70 text-on-error-container p-4 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold">{error}</div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-full bg-surface-container-lowest text-on-surface text-xs font-semibold cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && posts.length === 0 ? (
        <div className="flex flex-col gap-4 mt-1">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="rounded-xl bg-surface-container-lowest p-5 shadow-sm animate-pulse space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-container-high" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-32 rounded bg-surface-container-high" />
                  <div className="h-2.5 w-20 rounded bg-surface-container" />
                </div>
              </div>
              <div className="h-4 w-3/4 rounded bg-surface-container-high" />
              <div className="h-4 w-1/2 rounded bg-surface-container" />
            </div>
          ))}
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="rounded-2xl bg-surface-container-lowest p-8 text-center shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <div className="w-12 h-12 mx-auto rounded-full bg-surface-container-low text-primary flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[24px]">
              nights_stay
            </span>
          </div>
          <h3 className="text-base font-bold text-on-surface">
            No confessions in this view yet
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            Be the first to share an experience or reset your filters.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                onChangeCategory('All');
                setFormatFilter('all');
              }}
              className="px-4 py-2 rounded-full bg-surface-container text-on-surface text-xs font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => onNavigate('create-text')}
              className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-semibold cursor-pointer"
            >
              Share Story
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-1">
          {visiblePosts.map((post) => {
            const catMeta =
              CATEGORY_META[post.category] || CATEGORY_META.other;
            const isBookmarked = localPrefs.bookmarkedIds.includes(post.id);
            const isSensitive = localPrefs.localSensitiveIds.includes(post.id);
            const isBlurred =
              isSensitive &&
              localPrefs.sensitiveContentBlur &&
              !revealedIds[post.id];

            const visualAttachment = post.attachments.find(
              (att) => att.kind === 'image' || att.kind === 'video'
            );
            const docAttachment = post.attachments.find(
              (att) => att.kind === 'document'
            );

            return (
              <article
                key={post.id}
                onClick={() => onOpenStory(post.id)}
                className="flex flex-col rounded-xl bg-surface-container-lowest p-5 shadow-[0_2px_12px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.06)] transition-shadow cursor-pointer"
              >
                {/* Post Meta Header */}
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-inner ${
                        post.mode === 'voice'
                          ? 'bg-gradient-to-tr from-primary-fixed to-surface-variant text-primary'
                          : 'bg-gradient-to-tr from-surface-variant to-secondary-container text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {post.mode === 'voice' ? 'mic' : 'masks'}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] leading-[20px] font-semibold text-on-surface truncate">
                          @{post.author.username}
                        </span>
                        <span className="text-on-surface-variant text-[11px]">
                          •
                        </span>
                        <span className="text-[11px] leading-[14px] font-medium text-on-surface-variant whitespace-nowrap">
                          {formatRelativeTime(post.createdAt)}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] leading-[14px] font-medium ${
                          post.isMine
                            ? 'text-primary'
                            : 'text-on-secondary-container'
                        }`}
                      >
                        {post.isMine ? 'Your Confession' : 'Verified Anonymous'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] leading-[14px] font-medium shrink-0 whitespace-nowrap ${categoryChipClass(
                      post.category
                    )}`}
                  >
                    <span>{catMeta.emoji}</span>
                    <span>{catMeta.label}</span>
                  </span>
                </div>

                {/* Body Content with Optional TW Blur */}
                <div className="relative">
                  <div
                    className={
                      isBlurred
                        ? 'blur-md select-none pointer-events-none opacity-60 transition-all'
                        : 'transition-all'
                    }
                  >
                    {post.title && (
                      <h2 className="text-[18px] leading-[26px] font-semibold tracking-[-0.01em] text-on-surface mb-2.5 leading-snug">
                        {post.title}
                      </h2>
                    )}

                    {post.content && (
                      <p
                        className={`text-on-surface leading-relaxed mb-3.5 whitespace-pre-line line-clamp-5 ${
                          post.title
                            ? 'text-[15px] leading-[24px] text-on-surface-variant'
                            : 'text-[17px] leading-[28px] font-medium'
                        }`}
                      >
                        {post.content}
                      </p>
                    )}

                    {post.voice && (
                      <AudioWaveformPlayer
                        voice={post.voice}
                        token={token}
                        voiceMaskLabel={localPrefs.voiceMaskDefault}
                        variant="feed"
                      />
                    )}

                    {visualAttachment && (
                      <div className="relative w-full h-52 sm:h-64 rounded-xl overflow-hidden mb-4 shadow-inner bg-surface-container-low">
                        <AuthenticatedMedia
                          media={visualAttachment}
                          token={token}
                          className="w-full h-full object-cover"
                        />
                        {post.attachments.length > 1 && (
                          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-inverse-surface/85 backdrop-blur-md px-3 py-1 text-[11px] font-medium text-inverse-on-surface">
                            <span className="material-symbols-outlined text-[15px]">
                              photo_library
                            </span>
                            <span>{post.attachments.length} attachments</span>
                          </div>
                        )}
                      </div>
                    )}

                    {!visualAttachment && docAttachment && (
                      <div className="flex items-center gap-2 rounded-lg bg-surface-container-high/60 px-3 py-2 mb-4">
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                          attach_file
                        </span>
                        <span className="truncate text-[13px] leading-[20px] text-on-surface">
                          {docAttachment.name}
                        </span>
                        <span className="shrink-0 text-[11px] font-medium text-on-surface-variant tabular-nums">
                          {formatBytes(docAttachment.size)}
                        </span>
                      </div>
                    )}
                  </div>

                  {isBlurred && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-surface-container-low/70 backdrop-blur-[2px] p-4 text-center">
                      <span className="material-symbols-outlined text-tertiary text-[24px] mb-1">
                        visibility_off
                      </span>
                      <p className="text-xs font-bold text-on-surface">
                        Sensitive Content Warning (TW)
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRevealedIds((prev) => ({
                            ...prev,
                            [post.id]: true,
                          }));
                        }}
                        className="mt-2 px-3.5 py-1.5 rounded-full bg-surface-container-lowest text-primary text-xs font-semibold shadow-sm hover:bg-surface-container transition-colors cursor-pointer"
                      >
                        Tap to reveal story
                      </button>
                    </div>
                  )}
                </div>

                {/* Action & Interaction Bar */}
                <div
                  className="flex items-center justify-between pt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {(['love', 'support', 'resonate'] as const).map((rType) => {
                      const active = post.myReaction === rType;
                      const meta = REACTION_META[rType];
                      return (
                        <button
                          key={rType}
                          type="button"
                          title={meta.label}
                          onClick={() => onToggleReaction(post.id, rType)}
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors active:scale-95 cursor-pointer ${
                            active
                              ? rType === 'love'
                                ? 'bg-tertiary-fixed text-tertiary'
                                : 'bg-primary-fixed text-primary'
                              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-highest'
                          }`}
                        >
                          <span className="text-[14px]">{meta.emoji}</span>
                          <span className="text-[12px] font-semibold tabular-nums">
                            {formatCompactCount(post.reactions[rType] || 0)}
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => onOpenStory(post.id)}
                      className="flex items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5 text-on-surface-variant hover:bg-surface-container-highest transition-colors active:scale-95 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        chat_bubble
                      </span>
                      <span className="text-[12px] font-semibold tabular-nums">
                        {formatCompactCount(post.commentCount)}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-on-surface-variant shrink-0">
                    <button
                      type="button"
                      aria-label="Share confession"
                      onClick={() => onShareStory(post)}
                      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[19px]">
                        share
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={
                        isBookmarked
                          ? 'Remove bookmark'
                          : 'Bookmark confession'
                      }
                      onClick={() => onToggleBookmark(post.id)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-container-high transition-colors cursor-pointer ${
                        isBookmarked ? 'text-primary' : ''
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[19px] ${
                          isBookmarked ? 'material-symbols-filled' : ''
                        }`}
                      >
                        bookmark
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {pagination?.hasMore && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={onLoadMore}
              className="w-full py-3.5 rounded-full bg-surface-container-lowest hover:bg-surface-container text-primary text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-60"
            >
              {loadingMore ? 'Loading more stories...' : 'Load More Stories'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
