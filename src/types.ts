export type ScreenRoute =
  | 'feed'
  | 'create-text'
  | 'create-voice'
  | 'detail'
  | 'settings';

export type FeedTab = 'for-you' | 'latest' | 'trending';

export type ApiCategory =
  | 'life'
  | 'relationships'
  | 'work'
  | 'family'
  | 'mental-health'
  | 'confessions'
  | 'wins'
  | 'other';

export type CategoryFilter = 'All' | ApiCategory;

export type ApiReactionType = 'love' | 'support' | 'resonate';

export type ApiTheme = 'system' | 'light' | 'dark';

export type MediaKind = 'voice' | 'image' | 'video' | 'document';

export type ReportReason =
  | 'harassment'
  | 'hate'
  | 'personal-information'
  | 'spam'
  | 'other';

export type VoiceMaskPreset =
  | 'Shifted (+1 st)'
  | 'Deep Tone'
  | 'Mask: Deep Ambient'
  | 'Warm Echo';

export interface ApiMedia {
  id: string;
  kind: MediaKind;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  duration?: number;
}

export interface ApiAuthor {
  id: string;
  username: string;
}

export interface ApiPost {
  id: string;
  author: ApiAuthor;
  mode: 'text' | 'voice';
  title: string;
  content: string;
  category: ApiCategory;
  voice: ApiMedia | null;
  attachments: ApiMedia[];
  reactions: {
    resonate: number;
    support: number;
    love: number;
  };
  reactionCount: number;
  myReaction: ApiReactionType | null;
  commentCount: number;
  isMine: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiComment {
  id: string;
  author: ApiAuthor;
  content: string;
  createdAt: string;
  isMine: boolean;
}

export interface ApiUserSettings {
  theme: ApiTheme;
  notifications: {
    reactions: boolean;
    comments: boolean;
  };
  categories: ApiCategory[];
}

export interface ApiUser {
  id: string;
  username: string;
  confirmed: boolean;
  settings: ApiUserSettings;
  createdAt: string;
}

export interface ApiMeta {
  name: string;
  tagline: string;
  categories: ApiCategory[];
  reactions: ApiReactionType[];
  limits: {
    textCharacters: number;
    titleCharacters: number;
    commentCharacters: number;
    attachmentsPerPost: number;
    voiceSeconds: number;
    uploadMB: number;
  };
  documentFormats: string[];
}

export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface ApiNotification {
  id: string;
  type?: string;
  message?: string;
  title?: string;
  postId?: string;
  post?: { id: string; title?: string };
  actor?: ApiAuthor;
  read: boolean;
  createdAt: string;
}

export interface ApiBlockedUser {
  id: string;
  username: string;
  blockedAt?: string;
}

export interface ApiReport {
  id: string;
  postId?: string;
  post?: { id: string; title?: string; content?: string };
  reason: ReportReason;
  details?: string;
  status: string;
  createdAt: string;
}

export interface LocalClientPreferences {
  sensitiveContentBlur: boolean;
  voiceMaskDefault: VoiceMaskPreset;
  bookmarkedIds: string[];
  localSensitiveIds: string[];
}
