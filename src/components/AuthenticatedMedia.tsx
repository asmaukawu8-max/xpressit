import React, { useEffect, useState } from 'react';
import { fetchAuthenticatedMediaUrl } from '../api/client';
import { ApiMedia } from '../types';

interface AuthenticatedMediaProps {
  media: ApiMedia;
  token: string;
  className?: string;
  onOpenDocument?: (blobUrl: string) => void;
}

export const AuthenticatedMedia: React.FC<AuthenticatedMediaProps> = ({
  media,
  token,
  className = '',
  onOpenDocument,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setError(false);
    fetchAuthenticatedMediaUrl(token, media.url)
      .then((url) => {
        if (active) setBlobUrl(url);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, [token, media.url]);

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-surface-container-low text-on-surface-variant p-4 text-center ${className}`}
      >
        <span className="material-symbols-outlined text-[28px] opacity-75">
          {media.kind === 'video' ? 'videocam_off' : 'broken_image'}
        </span>
        <span className="text-xs mt-1">{media.name}</span>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-container-low animate-pulse ${className}`}
      >
        <span className="material-symbols-outlined text-primary/40 text-[28px]">
          {media.kind === 'video'
            ? 'movie'
            : media.kind === 'document'
            ? 'description'
            : 'image'}
        </span>
      </div>
    );
  }

  if (media.kind === 'video') {
    return (
      <video
        src={blobUrl}
        controls
        playsInline
        className={className}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  if (media.kind === 'document') {
    return (
      <div className="flex items-center justify-between gap-3 w-full">
        <span className="text-xs font-semibold text-on-surface truncate">
          {media.name}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenDocument) {
              onOpenDocument(blobUrl);
            } else {
              const a = document.createElement('a');
              a.href = blobUrl;
              a.download = media.name;
              a.click();
            }
          }}
          className="px-3.5 py-1.5 rounded-full bg-surface-container-lowest text-primary text-xs font-semibold shadow-sm hover:bg-surface-container-high cursor-pointer shrink-0"
        >
          View PDF
        </button>
      </div>
    );
  }

  return <img src={blobUrl} alt={media.name} className={className} />;
};
