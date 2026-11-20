import React, { useState } from 'react';
import { XPRESSIT_LOGO_URL } from '../data/initialData';
import { ApiNotification, ScreenRoute } from '../types';
import { formatRelativeTime } from '../utils/formatters';
import { SafeImage } from './SafeImage';

interface HeaderProps {
  route: ScreenRoute;
  isEditing?: boolean;
  username: string;
  notifications: ApiNotification[];
  unreadCount: number;
  onBack: () => void;
  onNavigate: (route: ScreenRoute) => void;
  onOpenStory: (postId: string) => void;
  onMarkNotificationRead: (notificationId: string) => void;
  onRefreshNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  route,
  isEditing,
  username,
  notifications,
  unreadCount,
  onBack,
  onNavigate,
  onOpenStory,
  onMarkNotificationRead,
  onRefreshNotifications,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);

  const isStack =
    route === 'create-text' || route === 'create-voice' || route === 'detail';

  const stackTitle =
    route === 'detail'
      ? 'Story Detail'
      : isEditing
      ? 'Edit Confession'
      : 'Create Confession';

  const handleToggleNotifs = () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) {
      onRefreshNotifications();
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
      <div className="max-w-7xl mx-auto h-16 px-4 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {isStack ? (
            <button
              type="button"
              aria-label="Go back"
              onClick={onBack}
              className="w-11 h-11 -ml-2 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[24px]">
                arrow_back
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onNavigate('feed')}
            className="flex items-center gap-2 min-w-0 cursor-pointer text-left"
          >
            <SafeImage
              src={XPRESSIT_LOGO_URL}
              alt="Xpressit Logo"
              className="h-8 w-8 rounded-lg object-contain shrink-0"
              fallbackIcon="lock"
            />
            {isStack ? (
              <h1 className="text-[18px] leading-[26px] font-semibold tracking-[-0.01em] text-on-surface truncate">
                {stackTitle}
              </h1>
            ) : (
              <span className="text-[20px] leading-[28px] tracking-tight text-on-surface font-bold whitespace-nowrap">
                Xpressit
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 relative shrink-0">
          {!isStack && (
            <div className="relative">
              <button
                type="button"
                aria-label="Notifications"
                onClick={handleToggleNotifs}
                className="relative w-11 h-11 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[24px]">
                  notifications
                </span>
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-tertiary-container" />
                )}
              </button>

              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 p-3 z-50">
                    <div className="flex items-center justify-between px-2 pb-2 border-b border-outline-variant/30">
                      <span className="text-sm font-bold text-on-surface">
                        Notifications
                      </span>
                      <span className="text-xs font-semibold text-primary tabular-nums">
                        {unreadCount} unread
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="py-6 text-center text-xs text-on-surface-variant">
                          No reactions or echoes yet.
                        </div>
                      ) : (
                        notifications.map((item) => {
                          const targetPostId =
                            item.postId || item.post?.id || undefined;
                          const headline =
                            item.title ||
                            item.message ||
                            (item.actor?.username
                              ? `@${item.actor.username} interacted with your story`
                              : 'New sanctuary activity');

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                if (!item.read) {
                                  onMarkNotificationRead(item.id);
                                }
                                setNotifOpen(false);
                                if (targetPostId) {
                                  onOpenStory(targetPostId);
                                }
                              }}
                              className={`w-full text-left p-2.5 rounded-xl flex items-start gap-2.5 transition-colors cursor-pointer ${
                                !item.read
                                  ? 'bg-surface-container-low hover:bg-surface-container'
                                  : 'hover:bg-surface-container-low'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-[17px]">
                                  {item.type === 'comment'
                                    ? 'chat_bubble'
                                    : 'volunteer_activism'}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-on-surface leading-snug">
                                  {headline}
                                </p>
                                {item.post?.title && (
                                  <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                                    {item.post.title}
                                  </p>
                                )}
                                <span className="text-[10px] text-outline mt-1 block">
                                  {formatRelativeTime(item.createdAt)}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            aria-label={`Open settings for @${username}`}
            title={`@${username}`}
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-2 rounded-full pl-1 pr-1 md:pr-3 py-1 hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-on-primary text-[18px]">
                person
              </span>
            </div>
            <span className="hidden md:inline text-xs font-semibold text-on-surface whitespace-nowrap">
              @{username}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
