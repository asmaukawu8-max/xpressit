import React from 'react';
import { ApiCategory, ApiPost, CategoryFilter, ScreenRoute } from '../types';
import { CATEGORY_META, formatRelativeTime } from '../utils/formatters';

interface DesktopSanctuaryPanelProps {
  posts: ApiPost[];
  categories: ApiCategory[];
  activeCategory: CategoryFilter;
  onSelectCategory: (category: CategoryFilter) => void;
  onNavigate: (route: ScreenRoute) => void;
  onOpenStory: (postId: string) => void;
}

export const DesktopSanctuaryPanel: React.FC<DesktopSanctuaryPanelProps> = ({
  posts,
  categories,
  activeCategory,
  onSelectCategory,
  onNavigate,
  onOpenStory,
}) => {
  const trendingStories = [...posts]
    .sort(
      (a, b) =>
        b.reactionCount +
        b.commentCount * 2 -
        (a.reactionCount + a.commentCount * 2)
    )
    .slice(0, 3);

  return (
    <aside className="hidden xl:flex flex-col w-72 shrink-0 sticky top-24 self-start gap-4">
      <div className="bg-gradient-to-br from-primary-fixed/80 via-surface-container-low to-surface-container-lowest rounded-2xl p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined material-symbols-filled text-[17px]">
              verified_user
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-on-surface">
              Zero-Trace Safe Zone
            </h3>
            <p className="text-[11px] text-on-surface-variant">
              Private pseudonymous sharing
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            onClick={() => onNavigate('create-text')}
            className="py-2 px-3 rounded-xl bg-surface-container-lowest hover:bg-surface-container text-xs font-semibold text-primary transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">
              edit_note
            </span>
            <span>Write</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('create-voice')}
            className="py-2 px-3 rounded-xl bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">mic</span>
            <span>Voice Note</span>
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
        <h3 className="text-sm font-bold text-on-surface mb-3">
          Diary Channels
        </h3>
        <div className="flex flex-col gap-1">
          {categories.map((catId) => {
            const meta = CATEGORY_META[catId] || CATEGORY_META.other;
            const active = activeCategory === catId;
            return (
              <button
                key={catId}
                type="button"
                onClick={() => onSelectCategory(active ? 'All' : catId)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </span>
                <span className="tabular-nums opacity-75">
                  {posts.filter((p) => p.category === catId).length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {trendingStories.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
          <h3 className="text-sm font-bold text-on-surface mb-3">
            Most Resonated
          </h3>
          <div className="space-y-3">
            {trendingStories.map((story) => (
              <button
                key={story.id}
                type="button"
                onClick={() => onOpenStory(story.id)}
                className="w-full text-left p-2.5 rounded-xl bg-surface-container-low/70 hover:bg-surface-container transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between text-[11px] text-on-surface-variant mb-1">
                  <span className="font-semibold text-on-surface">
                    @{story.author.username}
                  </span>
                  <span>{formatRelativeTime(story.createdAt)}</span>
                </div>
                <p className="text-xs font-medium text-on-surface line-clamp-2 leading-relaxed">
                  {story.title ||
                    story.content ||
                    (story.mode === 'voice'
                      ? 'Spoken audio confession'
                      : 'Anonymous story')}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
