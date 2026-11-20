import React, { useEffect, useState } from 'react';
import { ApiError, xpressitApi } from '../api/client';
import {
  ApiBlockedUser,
  ApiCategory,
  ApiMeta,
  ApiReport,
  ApiTheme,
  ApiUser,
  ApiUserSettings,
  LocalClientPreferences,
} from '../types';
import {
  CATEGORY_META,
  VOICE_MASK_PRESETS,
  formatRelativeTime,
} from '../utils/formatters';

interface SettingsScreenProps {
  token: string;
  user: ApiUser;
  meta: ApiMeta | null;
  localPrefs: LocalClientPreferences;
  onUpdateUser: (user: ApiUser) => void;
  onTokenRotated: (newToken: string) => void;
  onUpdateLocalPrefs: (patch: Partial<LocalClientPreferences>) => void;
  onLogout: () => void;
  onShowToast: (msg: string) => void;
}

type InfoModalType = 'guidelines' | 'anonymity' | 'terms' | null;

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  token,
  user,
  meta,
  localPrefs,
  onUpdateUser,
  onTokenRotated,
  onUpdateLocalPrefs,
  onLogout,
  onShowToast,
}) => {
  const [blocks, setBlocks] = useState<ApiBlockedUser[]>([]);
  const [reports, setReports] = useState<ApiReport[]>([]);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [wipeConfirmOpen, setWipeConfirmOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<InfoModalType>(null);

  // Passphrase rotation drawer
  const [rotateOpen, setRotateOpen] = useState(false);
  const [currentPhraseInput, setCurrentPhraseInput] = useState('');
  const [newWords, setNewWords] = useState<string[] | null>(null);
  const [newPassphrase, setNewPassphrase] = useState<string>('');
  const [rotating, setRotating] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  useEffect(() => {
    xpressitApi
      .getBlocks(token)
      .then(setBlocks)
      .catch(() => {});
    xpressitApi
      .getReports(token)
      .then(setReports)
      .catch(() => {});
  }, [token]);

  const patchServerSettings = async (patch: Partial<ApiUserSettings>) => {
    const optimistic: ApiUser = {
      ...user,
      settings: {
        ...user.settings,
        ...patch,
        notifications: {
          ...user.settings.notifications,
          ...(patch.notifications || {}),
        },
      },
    };
    onUpdateUser(optimistic);
    try {
      const updated = await xpressitApi.updateSettings(token, patch);
      onUpdateUser(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        onShowToast(err.message);
      }
    }
  };

  const togglePreferredCategory = (cat: ApiCategory) => {
    const exists = user.settings.categories.includes(cat);
    const next = exists
      ? user.settings.categories.filter((c) => c !== cat)
      : [...user.settings.categories, cat];
    patchServerSettings({ categories: next });
  };

  const handleUnblock = async (userId: string, handle: string) => {
    try {
      await xpressitApi.unblockUser(token, userId);
      setBlocks((prev) => prev.filter((b) => b.id !== userId));
      onShowToast(`@${handle} unblocked`);
    } catch (err) {
      if (err instanceof ApiError) {
        onShowToast(err.message);
      }
    }
  };

  const handlePreparePassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = currentPhraseInput.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      setRotateError('Enter your current six-word passphrase.');
      return;
    }

    setRotating(true);
    setRotateError(null);
    try {
      const res = await xpressitApi.preparePassphraseChange(token, cleaned);
      setNewWords(res.words?.length ? res.words : res.passphrase.split(/\s+/));
      setNewPassphrase(res.passphrase);
    } catch (err) {
      if (err instanceof ApiError) {
        setRotateError(err.message);
      } else {
        setRotateError('Unable to verify current passphrase.');
      }
    } finally {
      setRotating(false);
    }
  };

  const handleConfirmNewPassphrase = async () => {
    if (!newPassphrase) return;
    setRotating(true);
    setRotateError(null);
    try {
      const res = await xpressitApi.confirmPassphraseChange(
        token,
        newPassphrase
      );
      if (res.token) {
        onTokenRotated(res.token);
      }
      setRotateOpen(false);
      setCurrentPhraseInput('');
      setNewWords(null);
      setNewPassphrase('');
      onShowToast('Passphrase rotated & previous sessions revoked');
    } catch (err) {
      if (err instanceof ApiError) {
        setRotateError(err.message);
      } else {
        setRotateError('Could not confirm new passphrase.');
      }
    } finally {
      setRotating(false);
    }
  };

  const cycleVoicePitch = () => {
    const idx = VOICE_MASK_PRESETS.indexOf(localPrefs.voiceMaskDefault);
    const next = VOICE_MASK_PRESETS[(idx + 1) % VOICE_MASK_PRESETS.length];
    onUpdateLocalPrefs({ voiceMaskDefault: next });
    onShowToast(`Voice studio label set to ${next}`);
  };

  const renderToggle = (
    checked: boolean,
    onToggle: () => void,
    label: string
  ) => (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-primary' : 'bg-secondary-container'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-surface-container-lowest shadow-sm transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const availableCategories =
    meta?.categories ||
    ([
      'life',
      'relationships',
      'work',
      'family',
      'mental-health',
      'confessions',
      'wins',
      'other',
    ] as ApiCategory[]);

  return (
    <div className="flex flex-col w-full pb-10 space-y-4">
      {/* Sanctuary Status Banner */}
      <div className="w-full bg-gradient-to-r from-primary/10 via-surface-container-high to-surface-variant rounded-2xl p-4 flex items-center justify-between shadow-sm gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm shrink-0">
            <span className="material-symbols-outlined material-symbols-filled text-[20px]">
              security
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-on-surface truncate">
              Sanctuary Shield Active
            </p>
            <p className="text-[13px] text-on-surface-variant">
              Zero email • Passphrase protected
            </p>
          </div>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-container-lowest text-primary shadow-xs shrink-0 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse mr-1.5" />
          100% Private
        </span>
      </div>

      {/* Account & Pseudonym Card */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-primary-container p-0.5 shadow-sm shrink-0">
              <div className="w-full h-full rounded-full bg-surface-container-lowest flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[26px]">
                  masks
                </span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[18px] leading-[26px] font-semibold text-on-surface truncate">
                  @{user.username}
                </h2>
                <span
                  className="material-symbols-outlined text-primary text-[18px]"
                  title="Confirmed Anonymous Persona"
                >
                  verified_user
                </span>
              </div>
              <p className="text-[13px] text-on-surface-variant">
                Joined {formatRelativeTime(user.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Passphrase Section */}
        <div className="p-3.5 bg-surface-container-low rounded-xl flex items-center justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary mt-0.5 shrink-0">
              <span className="material-symbols-outlined text-[18px]">key</span>
            </div>
            <div className="min-w-0">
              <span className="text-[12px] font-semibold text-on-surface">
                6-Word Recovery Passphrase
              </span>
              <p className="text-[13px] text-on-surface-variant">
                Rotate your secret words anytime
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setRotateOpen((prev) => !prev);
              setRotateError(null);
              setNewWords(null);
            }}
            className="px-3.5 py-1.5 rounded-full bg-primary text-on-primary text-[12px] font-semibold shadow-xs active:scale-95 transition-transform cursor-pointer shrink-0"
          >
            {rotateOpen ? 'Close' : 'Rotate'}
          </button>
        </div>

        {/* Interactive Passphrase Rotation Drawer */}
        {rotateOpen && (
          <div className="p-3.5 bg-surface-variant/40 rounded-xl space-y-3">
            {!newWords ? (
              <form onSubmit={handlePreparePassphrase} className="space-y-2.5">
                <label className="block text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  Enter Current Six Words
                </label>
                <input
                  type="text"
                  value={currentPhraseInput}
                  onChange={(e) => setCurrentPhraseInput(e.target.value)}
                  placeholder="word1 word2 word3 word4 word5 word6"
                  className="w-full rounded-xl bg-surface-container-lowest px-3 py-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {rotateError && (
                  <p className="text-xs font-medium text-error">{rotateError}</p>
                )}
                <button
                  type="submit"
                  disabled={rotating}
                  className="w-full py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {rotating ? 'Generating...' : 'Generate New Passphrase'}
                </button>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                    New Secret Recovery Keys
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(newPassphrase)
                        .catch(() => {});
                      onShowToast('New passphrase copied');
                    }}
                    className="text-primary text-[11px] font-semibold hover:underline cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {newWords.map((word, idx) => (
                    <span
                      key={`${word}-${idx}`}
                      className="bg-surface-container-lowest py-1.5 px-2 rounded-lg text-center text-[12px] font-semibold text-on-surface tabular-nums"
                    >
                      {idx + 1}. {word}
                    </span>
                  ))}
                </div>
                {rotateError && (
                  <p className="text-xs font-medium text-error">{rotateError}</p>
                )}
                <button
                  type="button"
                  disabled={rotating}
                  onClick={handleConfirmNewPassphrase}
                  className="w-full py-2.5 rounded-full bg-primary text-on-primary text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {rotating
                    ? 'Activating...'
                    : 'I Saved These — Activate New Key'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* For You Preferred Categories */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm space-y-3">
        <div>
          <h3 className="text-[16px] font-semibold text-on-surface">
            For You Feed Preferences
          </h3>
          <p className="text-[13px] text-on-surface-variant">
            Select topics to tailor your For You feed
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((cat) => {
            const info = CATEGORY_META[cat] || CATEGORY_META.other;
            const selected = user.settings.categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => togglePreferredCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  selected
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <span>{info.emoji}</span>
                <span>{info.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preferences Group */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-1">
          <span className="text-[18px] leading-[26px] font-semibold text-on-surface">
            App Experience
          </span>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
            tune
          </span>
        </div>

        {/* Visual Appearance Light / Dark / System */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[20px]">
                palette
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-on-surface">
                Visual Appearance
              </p>
              <p className="text-[13px] text-on-surface-variant">
                Synced to your account settings
              </p>
            </div>
          </div>

          <div
            className="inline-flex p-1 rounded-full bg-surface-container-low text-[11px] font-medium shrink-0"
            role="radiogroup"
            aria-label="Theme mode"
          >
            {(['light', 'dark', 'system'] as ApiTheme[]).map((themeOption) => (
              <button
                key={themeOption}
                type="button"
                onClick={() => patchServerSettings({ theme: themeOption })}
                className={`px-2.5 py-1.5 rounded-full flex items-center gap-1 capitalize transition-all cursor-pointer ${
                  user.settings.theme === themeOption
                    ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {themeOption}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle: Reaction Alerts */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[20px]">
                volunteer_activism
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-on-surface">
                Empathy Reaction Alerts
              </p>
              <p className="text-[13px] text-on-surface-variant">
                In-app alerts when someone reacts to your story
              </p>
            </div>
          </div>
          {renderToggle(
            user.settings.notifications.reactions,
            () =>
              patchServerSettings({
                notifications: {
                  ...user.settings.notifications,
                  reactions: !user.settings.notifications.reactions,
                },
              }),
            'Toggle reaction notifications'
          )}
        </div>

        {/* Toggle: Comment Alerts */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[20px]">
                chat_bubble
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-on-surface">
                Comment Echo Alerts
              </p>
              <p className="text-[13px] text-on-surface-variant">
                Notify when someone replies to your story
              </p>
            </div>
          </div>
          {renderToggle(
            user.settings.notifications.comments,
            () =>
              patchServerSettings({
                notifications: {
                  ...user.settings.notifications,
                  comments: !user.settings.notifications.comments,
                },
              }),
            'Toggle comment notifications'
          )}
        </div>

        {/* Toggle: Sensitive Blur */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-[20px]">
                visibility_off
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-on-surface">
                Sensitive Content Blur (TW)
              </p>
              <p className="text-[13px] text-on-surface-variant">
                Tap-to-reveal on tagged stories
              </p>
            </div>
          </div>
          {renderToggle(
            localPrefs.sensitiveContentBlur,
            () =>
              onUpdateLocalPrefs({
                sensitiveContentBlur: !localPrefs.sensitiveContentBlur,
              }),
            'Toggle sensitive content blur'
          )}
        </div>
      </div>

      {/* Privacy Safeguards Group */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="text-[18px] leading-[26px] font-semibold text-on-surface">
              Privacy &amp; Moderation
            </span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
              Active
            </span>
          </div>
          <span className="material-symbols-outlined text-primary text-[20px]">
            verified
          </span>
        </div>

        {/* Voice Pitch Shifter Label */}
        <button
          type="button"
          onClick={cycleVoicePitch}
          className="w-full text-left flex items-center justify-between p-3 rounded-xl bg-surface-container-low/70 hover:bg-surface-container transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">
                graphic_eq
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-on-surface">
                Voice Studio Tag
              </p>
              <p className="text-[13px] text-on-surface-variant">
                Preferred voice studio indicator
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-primary text-[12px] font-semibold shrink-0">
            <span>{localPrefs.voiceMaskDefault}</span>
            <span className="material-symbols-outlined text-[18px]">
              chevron_right
            </span>
          </div>
        </button>

        {/* Blocked Handles */}
        <button
          type="button"
          onClick={() => setBlockedOpen((prev) => !prev)}
          className="w-full text-left flex items-center justify-between p-3 rounded-xl bg-surface-container-low/70 hover:bg-surface-container transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[18px]">
                block
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-on-surface">
                Blocked Anonymous Handles
              </p>
              <p className="text-[13px] text-on-surface-variant">
                Hides interactions in both directions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-on-surface-variant text-[12px] font-semibold shrink-0 tabular-nums">
            <span>{blocks.length} blocked</span>
            <span className="material-symbols-outlined text-[18px]">
              chevron_right
            </span>
          </div>
        </button>

        {blockedOpen && (
          <div className="p-3 rounded-xl bg-surface-container-low space-y-2">
            {blocks.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                You have not blocked any anonymous handles.
              </p>
            ) : (
              blocks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between bg-surface-container-lowest px-3 py-2 rounded-lg"
                >
                  <span className="text-xs font-semibold text-on-surface">
                    @{b.username}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUnblock(b.id, b.username)}
                    className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Submitted Reports */}
        <button
          type="button"
          onClick={() => setReportsOpen((prev) => !prev)}
          className="w-full text-left flex items-center justify-between p-3 rounded-xl bg-surface-container-low/70 hover:bg-surface-container transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
              <span className="material-symbols-outlined text-[18px]">
                flag
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-on-surface">
                Submitted Reports
              </p>
              <p className="text-[13px] text-on-surface-variant">
                Track safety reports you have filed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-on-surface-variant text-[12px] font-semibold shrink-0 tabular-nums">
            <span>{reports.length} filed</span>
            <span className="material-symbols-outlined text-[18px]">
              chevron_right
            </span>
          </div>
        </button>

        {reportsOpen && (
          <div className="p-3 rounded-xl bg-surface-container-low space-y-2">
            {reports.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                No reports submitted.
              </p>
            ) : (
              reports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between bg-surface-container-lowest px-3 py-2 rounded-lg text-xs"
                >
                  <span className="font-semibold text-on-surface capitalize">
                    {r.reason.replace('-', ' ')}
                  </span>
                  <span className="text-on-surface-variant capitalize">
                    {r.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Community & Trust Group */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm space-y-1">
        <div className="pb-2">
          <span className="text-[18px] leading-[26px] font-semibold text-on-surface">
            Trust &amp; Collective Safety
          </span>
        </div>

        <button
          type="button"
          onClick={() => setInfoModal('guidelines')}
          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[20px]">
              favorite
            </span>
            <span className="text-[14px] font-semibold text-on-surface">
              Community Guidelines (Safe Space Rules)
            </span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
            chevron_right
          </span>
        </button>

        <button
          type="button"
          onClick={() => setInfoModal('anonymity')}
          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[20px]">
              shield_with_heart
            </span>
            <span className="text-[14px] font-semibold text-on-surface">
              How Anonymity Works on Xpressit
            </span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
            chevron_right
          </span>
        </button>

        <button
          type="button"
          onClick={() => setInfoModal('terms')}
          className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-low transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
              description
            </span>
            <span className="text-[14px] font-semibold text-on-surface">
              Terms of Service &amp; Privacy Manifesto
            </span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
            chevron_right
          </span>
        </button>
      </div>

      {/* Session Management */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm space-y-4">
        <div>
          <h3 className="text-[14px] font-semibold text-on-surface">
            Local Device Session
          </h3>
          <p className="text-[13px] text-on-surface-variant">
            Revokes your active bearer session and clears local browser data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWipeConfirmOpen(true)}
          className="w-full py-3 px-4 rounded-xl bg-error-container/60 hover:bg-error-container text-on-error-container text-[14px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Sign Out &amp; Wipe Local Session</span>
        </button>
      </div>

      {/* Footer Meta */}
      <div className="text-center py-2 space-y-1">
        <p className="text-[12px] text-on-surface font-semibold">
          {meta?.name || 'Xpressit'} · @{user.username}
        </p>
        <p className="text-[13px] text-on-surface-variant">
          {meta?.tagline || 'Speak freely. Stay anonymous.'}
        </p>
      </div>

      {/* Wipe Confirmation Modal */}
      {wipeConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[26px]">
                logout
              </span>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-on-surface">
                Sign Out &amp; Clear Session?
              </h3>
              <p className="text-sm text-on-surface-variant mt-1">
                Make sure you have saved your 6-word passphrase before signing
                out, as it is the only way back into @{user.username}.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWipeConfirmOpen(false)}
                className="flex-1 py-3 rounded-full bg-surface-container text-on-surface text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setWipeConfirmOpen(false);
                  onLogout();
                }}
                className="flex-1 py-3 rounded-full bg-error text-on-error text-sm font-semibold cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoModal && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-on-surface">
                {infoModal === 'guidelines'
                  ? 'Community Guidelines'
                  : infoModal === 'anonymity'
                  ? 'How Anonymity Works'
                  : 'Privacy Manifesto'}
              </h3>
              <button
                type="button"
                onClick={() => setInfoModal(null)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>
            <div className="text-sm text-on-surface-variant space-y-3 leading-relaxed">
              {infoModal === 'guidelines' && (
                <>
                  <p>
                    1. Lead with empathy. Confessions shared here come from real
                    people carrying unspoken weight.
                  </p>
                  <p>
                    2. Never share personal identifying information, harassment,
                    or hate speech.
                  </p>
                  <p>
                    3. Use blocking and reporting tools whenever someone crosses
                    a boundary.
                  </p>
                </>
              )}
              {infoModal === 'anonymity' && (
                <>
                  <p>
                    Accounts use only a pseudonymous username and a 6-word
                    recovery passphrase hashed with scrypt—no email, phone
                    number, or real name is collected.
                  </p>
                  <p>
                    Media attachments and voice recordings are served through
                    authenticated endpoints that enforce blocklists and post
                    visibility.
                  </p>
                </>
              )}
              {infoModal === 'terms' && (
                <p>
                  Your saved 6-word passphrase is your sole credential. Keep it
                  somewhere safe; if lost, Xpressit cannot recover the account.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInfoModal(null)}
              className="w-full py-3 rounded-full bg-primary text-on-primary text-sm font-semibold cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
