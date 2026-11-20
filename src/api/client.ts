import {
  ApiBlockedUser,
  ApiCategory,
  ApiComment,
  ApiMedia,
  ApiMeta,
  ApiNotification,
  ApiPagination,
  ApiPost,
  ApiReactionType,
  ApiReport,
  ApiUser,
  ApiUserSettings,
  FeedTab,
  MediaKind,
  ReportReason,
} from '../types';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://xpressit.onrender.com'
).replace(/\/+$/, '');

export interface ApiFieldError {
  field?: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: ApiFieldError[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ApiFieldError[]
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
    formData?: FormData;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.formData
      ? options.formData
      : options.body !== undefined
      ? JSON.stringify(options.body)
      : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    const errObj = (json.error || {}) as {
      code?: string;
      message?: string;
      details?: ApiFieldError[];
    };
    throw new ApiError(
      res.status,
      errObj.code || 'API_ERROR',
      errObj.message || `Request failed (${res.status})`,
      errObj.details
    );
  }

  return json as T;
}

export const xpressitApi = {
  async getHealth(): Promise<{ status: string; database: string }> {
    return request('/health');
  },

  async getMeta(): Promise<ApiMeta> {
    const res = await request<{ data: ApiMeta }>('/api/meta');
    return res.data;
  },

  async register(username: string): Promise<{
    user: ApiUser;
    token: string;
    expiresAt: string;
    passphrase: string;
    words: string[];
    warning: string;
  }> {
    const res = await request<{
      data: {
        user: ApiUser;
        token: string;
        expiresAt: string;
        passphrase: string;
        words: string[];
        warning: string;
      };
    }>('/api/auth/register', {
      method: 'POST',
      body: { username },
    });
    return res.data;
  },

  async confirmRegistration(
    token: string,
    savedPassphrase = true
  ): Promise<{ user: ApiUser }> {
    const res = await request<{ data: { user: ApiUser } }>(
      '/api/auth/confirm',
      {
        method: 'POST',
        token,
        body: { savedPassphrase },
      }
    );
    return res.data;
  },

  async login(
    username: string,
    passphrase: string
  ): Promise<{ user: ApiUser; token: string; expiresAt: string }> {
    const res = await request<{
      data: { user: ApiUser; token: string; expiresAt: string };
    }>('/api/auth/login', {
      method: 'POST',
      body: { username, passphrase },
    });
    return res.data;
  },

  async logout(token: string): Promise<void> {
    await request<void>('/api/auth/logout', {
      method: 'POST',
      token,
    });
  },

  async preparePassphraseChange(
    token: string,
    currentPassphrase: string
  ): Promise<{ passphrase: string; words: string[]; warning?: string }> {
    const res = await request<{
      data: { passphrase: string; words: string[]; warning?: string };
    }>('/api/auth/passphrase', {
      method: 'POST',
      token,
      body: { currentPassphrase },
    });
    return res.data;
  },

  async confirmPassphraseChange(
    token: string,
    passphrase: string
  ): Promise<{ token: string; expiresAt?: string; user?: ApiUser }> {
    const res = await request<{
      data: { token: string; expiresAt?: string; user?: ApiUser };
    }>('/api/auth/passphrase/confirm', {
      method: 'POST',
      token,
      body: { savedPassphrase: true, passphrase },
    });
    return res.data;
  },

  async getPosts(
    token: string,
    params: {
      feed: FeedTab;
      category?: ApiCategory;
      page?: number;
      limit?: number;
    }
  ): Promise<{ data: ApiPost[]; pagination: ApiPagination }> {
    const query = new URLSearchParams({
      feed: params.feed,
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
    });
    if (params.category) {
      query.set('category', params.category);
    }
    return request<{ data: ApiPost[]; pagination: ApiPagination }>(
      `/api/posts?${query.toString()}`,
      { token }
    );
  },

  async getPost(token: string, postId: string): Promise<ApiPost> {
    const res = await request<{ data: ApiPost }>(`/api/posts/${postId}`, {
      token,
    });
    return res.data;
  },

  async createPost(
    token: string,
    payload: {
      mode: 'text' | 'voice';
      category: ApiCategory;
      title?: string;
      content?: string;
      voice?: { media: string; duration: number };
      attachments?: string[];
    }
  ): Promise<ApiPost> {
    const res = await request<{ data: ApiPost }>('/api/posts', {
      method: 'POST',
      token,
      body: payload,
    });
    return res.data;
  },

  async updatePost(
    token: string,
    postId: string,
    payload: {
      mode: 'text' | 'voice';
      category: ApiCategory;
      title?: string;
      content?: string;
      voice?: { media: string; duration: number };
      attachments?: string[];
    }
  ): Promise<ApiPost> {
    const res = await request<{ data: ApiPost }>(`/api/posts/${postId}`, {
      method: 'PUT',
      token,
      body: payload,
    });
    return res.data;
  },

  async deletePost(token: string, postId: string): Promise<void> {
    await request<void>(`/api/posts/${postId}`, {
      method: 'DELETE',
      token,
    });
  },

  async setReaction(
    token: string,
    postId: string,
    type: ApiReactionType
  ): Promise<ApiPost | { reactions?: ApiPost['reactions']; myReaction?: ApiReactionType }> {
    const res = await request<{
      data: ApiPost | { reactions?: ApiPost['reactions']; myReaction?: ApiReactionType };
    }>(`/api/posts/${postId}/reaction`, {
      method: 'PUT',
      token,
      body: { type },
    });
    return res.data;
  },

  async removeReaction(token: string, postId: string): Promise<void> {
    await request<void>(`/api/posts/${postId}/reaction`, {
      method: 'DELETE',
      token,
    });
  },

  async getComments(
    token: string,
    postId: string,
    page = 1,
    limit = 20
  ): Promise<{ data: ApiComment[]; pagination: ApiPagination }> {
    return request<{ data: ApiComment[]; pagination: ApiPagination }>(
      `/api/posts/${postId}/comments?page=${page}&limit=${limit}`,
      { token }
    );
  },

  async addComment(
    token: string,
    postId: string,
    content: string
  ): Promise<ApiComment> {
    const res = await request<{ data: ApiComment }>(
      `/api/posts/${postId}/comments`,
      {
        method: 'POST',
        token,
        body: { content },
      }
    );
    return res.data;
  },

  async deleteComment(
    token: string,
    postId: string,
    commentId: string
  ): Promise<void> {
    await request<void>(`/api/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
      token,
    });
  },

  async reportPost(
    token: string,
    postId: string,
    reason: ReportReason,
    details?: string
  ): Promise<ApiReport> {
    const res = await request<{ data: ApiReport }>(
      `/api/posts/${postId}/report`,
      {
        method: 'POST',
        token,
        body: details ? { reason, details } : { reason },
      }
    );
    return res.data;
  },

  async uploadMedia(
    token: string,
    kind: MediaKind,
    file: File | Blob,
    filename?: string
  ): Promise<ApiMedia> {
    const formData = new FormData();
    formData.append('kind', kind);
    if (file instanceof File) {
      formData.append('file', file);
    } else {
      formData.append('file', file, filename || `recording_${Date.now()}.webm`);
    }

    const res = await request<{ data: ApiMedia }>('/api/media', {
      method: 'POST',
      token,
      formData,
    });
    return res.data;
  },

  async deleteMedia(token: string, mediaId: string): Promise<void> {
    await request<void>(`/api/media/${mediaId}`, {
      method: 'DELETE',
      token,
    });
  },

  async getMe(token: string): Promise<ApiUser> {
    const res = await request<{ data: ApiUser }>('/api/users/me', { token });
    return res.data;
  },

  async updateSettings(
    token: string,
    patch: Partial<ApiUserSettings>
  ): Promise<ApiUser> {
    const res = await request<{ data: ApiUser }>('/api/users/me/settings', {
      method: 'PATCH',
      token,
      body: patch,
    });
    return res.data;
  },

  async getBlocks(token: string): Promise<ApiBlockedUser[]> {
    const res = await request<{ data: ApiBlockedUser[] }>(
      '/api/users/me/blocks',
      { token }
    );
    return res.data;
  },

  async blockUser(token: string, userId: string): Promise<void> {
    await request('/api/users/me/blocks', {
      method: 'POST',
      token,
      body: { userId },
    });
  },

  async unblockUser(token: string, userId: string): Promise<void> {
    await request<void>(`/api/users/me/blocks/${userId}`, {
      method: 'DELETE',
      token,
    });
  },

  async getReports(token: string): Promise<ApiReport[]> {
    const res = await request<{ data: ApiReport[] }>('/api/users/me/reports', {
      token,
    });
    return res.data;
  },

  async getNotifications(
    token: string,
    page = 1,
    limit = 20
  ): Promise<{
    data: ApiNotification[];
    unreadCount: number;
    pagination: ApiPagination;
  }> {
    return request<{
      data: ApiNotification[];
      unreadCount: number;
      pagination: ApiPagination;
    }>(`/api/users/me/notifications?page=${page}&limit=${limit}`, { token });
  },

  async markNotificationRead(
    token: string,
    notificationId: string
  ): Promise<void> {
    await request(
      `/api/users/me/notifications/${notificationId}/read`,
      {
        method: 'PATCH',
        token,
      }
    );
  },
};

const mediaBlobCache = new Map<string, string>();
const mediaInFlight = new Map<string, Promise<string>>();

export async function fetchAuthenticatedMediaUrl(
  token: string,
  relativeUrl: string
): Promise<string> {
  const fullUrl = relativeUrl.startsWith('http')
    ? relativeUrl
    : `${API_BASE_URL}${relativeUrl}`;

  const cacheKey = `${token.slice(0, 12)}:${fullUrl}`;
  const cached = mediaBlobCache.get(cacheKey);
  if (cached) return cached;

  const existingPromise = mediaInFlight.get(cacheKey);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    const res = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch media (${res.status})`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    mediaBlobCache.set(cacheKey, objectUrl);
    return objectUrl;
  })();

  mediaInFlight.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    mediaInFlight.delete(cacheKey);
  }
}

export function clearMediaBlobCache(): void {
  mediaBlobCache.forEach((url) => URL.revokeObjectURL(url));
  mediaBlobCache.clear();
}
