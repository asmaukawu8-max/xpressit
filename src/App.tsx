import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  clearMediaBlobCache,
  xpressitApi,
} from './api/client';
import { AuthGateScreen } from './components/AuthGateScreen';
import { BottomNav } from './components/BottomNav';
import { CreateTextStoryScreen } from './components/CreateTextStoryScreen';
import { DesktopNavRail } from './components/DesktopNavRail';
import { DesktopSanctuaryPanel } from './components/DesktopSanctuaryPanel';
import { Header } from './components/Header';
import { HomeFeedScreen } from './components/HomeFeedScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { StoryDetailScreen } from './components/StoryDetailScreen';
import { VoiceStudioScreen } from './components/VoiceStudioScreen';
import {
  ApiCategory,
  ApiMeta,
  ApiNotification,
  ApiPagination,
  ApiPost,
  ApiReactionType,
  ApiUser,
  CategoryFilter,
  FeedTab,
  LocalClientPreferences,
  ScreenRoute,
} from './types';

const SESSION_KEY = 'xpressit_session_v2';
const PREFS_KEY = 'xpressit_local_prefs_v2';

const DEFAULT_LOCAL_PREFS: LocalClientPreferences = {
  sensitiveContentBlur: true,
  voiceMaskDefault: 'Shifted (+1 st)',
  bookmarkedIds: [],
  localSensitiveIds: [],
};

export default function App() {
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw).token || null : null;
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<ApiUser | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw).user || null : null;
    } catch {
      return null;
    }
  });
  const [validatingSession, setValidatingSession] = useState<boolean>(() =>
    Boolean(token)
  );

  const [localPrefs, setLocalPrefs] = useState<LocalClientPreferences>(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? { ...DEFAULT_LOCAL_PREFS, ...JSON.parse(raw) } : DEFAULT_LOCAL_PREFS;
    } catch {
      return DEFAULT_LOCAL_PREFS;
    }
  });

  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [pagination, setPagination] = useState<ApiPagination | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [route, setRoute] = useState<ScreenRoute>('feed');
  const [previousRoute, setPreviousRoute] = useState<ScreenRoute>('feed');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<ApiPost | null>(null);
  const [activeTab, setActiveTab] = useState<FeedTab>('latest');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // Persist local preferences
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(localPrefs));
    } catch {
      // ignore
    }
  }, [localPrefs]);

  // Persist session
  useEffect(() => {
    try {
      if (token && user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // ignore
    }
  }, [token, user]);

  // Apply theme ('light' | 'dark' | 'system')
  useEffect(() => {
    const theme = user?.settings.theme || 'light';
    const applyDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', Boolean(applyDark));
  }, [user?.settings.theme]);

  // Load API metadata once
  useEffect(() => {
    xpressitApi
      .getMeta()
      .then(setMeta)
      .catch(() => {});
  }, []);

  // Validate saved token on startup
  useEffect(() => {
    if (!token) {
      setValidatingSession(false);
      return;
    }
    let active = true;
    xpressitApi
      .getMe(token)
      .then((freshUser) => {
        if (active) setUser(freshUser);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
          setUser(null);
          clearMediaBlobCache();
        }
      })
      .finally(() => {
        if (active) setValidatingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const loadFeed = useCallback(
    async (page = 1, append = false) => {
      if (!token || !user?.confirmed) return;
      if (append) {
        setLoadingMore(true);
      } else {
        setFeedLoading(true);
      }
      setFeedError(null);
      try {
        const res = await xpressitApi.getPosts(token, {
          feed: activeTab,
          category: activeCategory === 'All' ? undefined : activeCategory,
          page,
          limit: 20,
        });
        setPosts((prev) => (append ? [...prev, ...res.data] : res.data));
        setPagination(res.pagination);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
          setUser(null);
          clearMediaBlobCache();
          showToast('Session expired. Please sign in again.');
        } else if (err instanceof ApiError) {
          setFeedError(err.message);
        } else {
          setFeedError('Could not load stories from Xpressit.');
        }
      } finally {
        setFeedLoading(false);
        setLoadingMore(false);
      }
    },
    [token, user?.confirmed, activeTab, activeCategory, showToast]
  );

  const loadNotifications = useCallback(async () => {
    if (!token || !user?.confirmed) return;
    try {
      const res = await xpressitApi.getNotifications(token, 1, 20);
      setNotifications(res.data);
      setUnreadCount(res.unreadCount);
    } catch {
      // ignore transient notification errors
    }
  }, [token, user?.confirmed]);

  useEffect(() => {
    if (token && user?.confirmed) {
      loadFeed(1, false);
    }
  }, [token, user?.confirmed, activeTab, activeCategory, loadFeed]);

  useEffect(() => {
    if (token && user?.confirmed) {
      loadNotifications();
    }
  }, [token, user?.confirmed, loadNotifications]);

  const navigateTo = (nextRoute: ScreenRoute) => {
    if (nextRoute !== 'create-text') {
      setEditingPost(null);
    }
    if (nextRoute !== route) {
      setPreviousRoute(route);
      setRoute(nextRoute);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenStory = (postId: string) => {
    setSelectedPostId(postId);
    setPreviousRoute(route);
    setRoute('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setEditingPost(null);
    if (route === 'detail') {
      setRoute(previousRoute === 'detail' ? 'feed' : previousRoute);
    } else if (route === 'create-text' || route === 'create-voice') {
      setRoute(
        previousRoute === 'create-text' || previousRoute === 'create-voice'
          ? 'feed'
          : previousRoute
      );
    } else {
      setRoute('feed');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleReaction = async (
    postId: string,
    type: ApiReactionType
  ) => {
    if (!token) return;
    const target = posts.find((p) => p.id === postId);
    if (!target) return;

    const prevReaction = target.myReaction;
    const isRemoving = prevReaction === type;

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const nextReactions = { ...p.reactions };
        if (prevReaction) {
          nextReactions[prevReaction] = Math.max(
            0,
            (nextReactions[prevReaction] || 0) - 1
          );
        }
        if (!isRemoving) {
          nextReactions[type] = (nextReactions[type] || 0) + 1;
        }
        return {
          ...p,
          reactions: nextReactions,
          myReaction: isRemoving ? null : type,
          reactionCount:
            (nextReactions.love || 0) +
            (nextReactions.support || 0) +
            (nextReactions.resonate || 0),
        };
      })
    );

    try {
      if (isRemoving) {
        await xpressitApi.removeReaction(token, postId);
      } else {
        await xpressitApi.setReaction(token, postId, type);
      }
    } catch (err) {
      // Revert on failure
      setPosts((prev) => prev.map((p) => (p.id === postId ? target : p)));
      if (err instanceof ApiError) {
        showToast(err.message);
      }
    }
  };

  const handleToggleBookmark = (postId: string) => {
    setLocalPrefs((prev) => {
      const exists = prev.bookmarkedIds.includes(postId);
      const nextIds = exists
        ? prev.bookmarkedIds.filter((id) => id !== postId)
        : [...prev.bookmarkedIds, postId];
      showToast(exists ? 'Removed from saved' : 'Saved locally');
      return { ...prev, bookmarkedIds: nextIds };
    });
  };

  const handlePublishedPost = (savedPost: ApiPost, markSensitive = false) => {
    setPosts((prev) => {
      const exists = prev.some((p) => p.id === savedPost.id);
      if (exists) {
        return prev.map((p) => (p.id === savedPost.id ? savedPost : p));
      }
      return [savedPost, ...prev];
    });

    if (markSensitive) {
      setLocalPrefs((prev) => ({
        ...prev,
        localSensitiveIds: prev.localSensitiveIds.includes(savedPost.id)
          ? prev.localSensitiveIds
          : [...prev.localSensitiveIds, savedPost.id],
      }));
    }

    const wasEditing = Boolean(editingPost);
    setEditingPost(null);
    setSelectedPostId(savedPost.id);
    setPreviousRoute('feed');
    setRoute('detail');
    showToast(
      wasEditing ? 'Story updated' : 'Confession published anonymously'
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletedPost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setRoute('feed');
    showToast('Story deleted');
  };

  const handleBlockAuthor = async (userId: string, authorUsername: string) => {
    if (!token) return;
    try {
      await xpressitApi.blockUser(token, userId);
      setPosts((prev) => prev.filter((p) => p.author.id !== userId));
      setRoute('feed');
      showToast(`@${authorUsername} blocked`);
    } catch (err) {
      if (err instanceof ApiError) {
        showToast(err.message);
      }
    }
  };

  const handleShareStory = (post: ApiPost) => {
    const snippet = post.title || post.content.slice(0, 90) || 'Voice confession';
    navigator.clipboard
      ?.writeText(`Xpressit (@${post.author.username}): "${snippet}" [ID: ${post.id}]`)
      .catch(() => {});
    showToast('Story reference copied');
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    if (!token) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await xpressitApi.markNotificationRead(token, notificationId);
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await xpressitApi.logout(token);
      } catch {
        // ignore network error on logout
      }
    }
    clearMediaBlobCache();
    setToken(null);
    setUser(null);
    setPosts([]);
    setNotifications([]);
    setUnreadCount(0);
    setRoute('feed');
    showToast('Signed out & session cleared');
  };

  const activePost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) || null,
    [posts, selectedPostId]
  );

  const availableCategories: ApiCategory[] = meta?.categories || [
    'life',
    'relationships',
    'work',
    'family',
    'mental-health',
    'confessions',
    'wins',
    'other',
  ];

  if (validatingSession) {
    return (
      <div className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 rounded-full border-3 border-primary border-t-transparent animate-spin mb-3" />
        <p className="text-sm font-semibold text-on-surface-variant">
          Entering Xpressit Sanctuary...
        </p>
      </div>
    );
  }

  if (!token || !user || !user.confirmed) {
    return (
      <AuthGateScreen
        meta={meta}
        pendingSession={
          token && user && !user.confirmed ? { token, user } : null
        }
        onAuthenticated={(newToken, confirmedUser) => {
          setToken(newToken);
          setUser(confirmedUser);
          setRoute('feed');
          showToast(`Welcome, @${confirmedUser.username}`);
        }}
      />
    );
  }

  const showBottomPadding =
    route === 'feed' || route === 'settings' ? 'pb-28 lg:pb-12' : 'pb-safe';

  return (
    <div className="bg-surface text-on-surface flex flex-col min-h-screen transition-colors duration-200">
      <Header
        route={route}
        isEditing={Boolean(editingPost)}
        username={user.username}
        notifications={notifications}
        unreadCount={unreadCount}
        onBack={handleBack}
        onNavigate={navigateTo}
        onOpenStory={handleOpenStory}
        onMarkNotificationRead={handleMarkNotificationRead}
        onRefreshNotifications={loadNotifications}
      />

      <main
        className={`flex-1 w-full pt-20 ${showBottomPadding} px-4 lg:px-8 max-w-7xl mx-auto`}
      >
        <div className="flex items-start justify-center gap-6">
          <DesktopNavRail
            route={route}
            username={user.username}
            bookmarkedCount={localPrefs.bookmarkedIds.length}
            onNavigate={navigateTo}
          />

          <div className="w-full max-w-xl lg:max-w-2xl min-w-0">
            {route === 'feed' && (
              <HomeFeedScreen
                token={token}
                posts={posts}
                pagination={pagination}
                categories={availableCategories}
                loading={feedLoading}
                loadingMore={loadingMore}
                error={feedError}
                localPrefs={localPrefs}
                activeTab={activeTab}
                activeCategory={activeCategory}
                onChangeTab={setActiveTab}
                onChangeCategory={setActiveCategory}
                onRefresh={() => loadFeed(1, false)}
                onLoadMore={() =>
                  loadFeed((pagination?.page || 1) + 1, true)
                }
                onOpenStory={handleOpenStory}
                onNavigate={navigateTo}
                onToggleReaction={handleToggleReaction}
                onToggleBookmark={handleToggleBookmark}
                onShareStory={handleShareStory}
              />
            )}

            {route === 'create-text' && (
              <CreateTextStoryScreen
                token={token}
                username={user.username}
                meta={meta}
                editingPost={editingPost}
                onCancel={handleBack}
                onSwitchToVoice={() => {
                  setEditingPost(null);
                  setRoute('create-voice');
                }}
                onPublished={handlePublishedPost}
                onShowToast={showToast}
              />
            )}

            {route === 'create-voice' && (
              <VoiceStudioScreen
                token={token}
                username={user.username}
                meta={meta}
                defaultMask={localPrefs.voiceMaskDefault}
                onCancel={handleBack}
                onSwitchToWritten={() => setRoute('create-text')}
                onPublished={(post) => handlePublishedPost(post, false)}
                onShowToast={showToast}
              />
            )}

            {route === 'detail' && activePost && (
              <StoryDetailScreen
                token={token}
                username={user.username}
                post={activePost}
                isBookmarked={localPrefs.bookmarkedIds.includes(activePost.id)}
                voiceMaskLabel={localPrefs.voiceMaskDefault}
                onToggleReaction={handleToggleReaction}
                onToggleBookmark={handleToggleBookmark}
                onEditPost={(postToEdit) => {
                  setEditingPost(postToEdit);
                  setPreviousRoute('detail');
                  setRoute('create-text');
                }}
                onDeletedPost={handleDeletedPost}
                onBlockAuthor={handleBlockAuthor}
                onShareStory={handleShareStory}
                onPostUpdated={(updated) =>
                  setPosts((prev) =>
                    prev.map((p) => (p.id === updated.id ? updated : p))
                  )
                }
                onShowToast={showToast}
              />
            )}

            {route === 'settings' && (
              <SettingsScreen
                token={token}
                user={user}
                meta={meta}
                localPrefs={localPrefs}
                onUpdateUser={setUser}
                onTokenRotated={setToken}
                onUpdateLocalPrefs={(patch) =>
                  setLocalPrefs((prev) => ({ ...prev, ...patch }))
                }
                onLogout={handleLogout}
                onShowToast={showToast}
              />
            )}
          </div>

          <DesktopSanctuaryPanel
            posts={posts}
            categories={availableCategories}
            activeCategory={activeCategory}
            onSelectCategory={(cat) => {
              setActiveCategory(cat);
              if (route !== 'feed') setRoute('feed');
            }}
            onNavigate={navigateTo}
            onOpenStory={handleOpenStory}
          />
        </div>
      </main>

      <BottomNav route={route} onNavigate={navigateTo} />

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-inverse-surface text-inverse-on-surface text-xs font-semibold shadow-xl flex items-center gap-2 whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[16px] text-inverse-primary">
            verified_user
          </span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
