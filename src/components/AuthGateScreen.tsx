import React, { useState } from 'react';
import { ApiError, xpressitApi } from '../api/client';
import { XPRESSIT_LOGO_URL } from '../data/initialData';
import { ApiMeta, ApiUser } from '../types';
import { SUGGESTED_USERNAMES } from '../utils/formatters';
import { SafeImage } from './SafeImage';

interface AuthGateScreenProps {
  meta: ApiMeta | null;
  pendingSession?: {
    token: string;
    user: ApiUser;
    words?: string[];
    passphrase?: string;
  } | null;
  onAuthenticated: (token: string, user: ApiUser) => void;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({
  meta,
  pendingSession,
  onAuthenticated,
}) => {
  const [tab, setTab] = useState<'register' | 'login'>('register');
  const [username, setUsername] = useState('');
  const [loginPassphrase, setLoginPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 2: Confirm saved 6-word passphrase
  const [pendingToken, setPendingToken] = useState<string | null>(
    pendingSession?.token || null
  );
  const [pendingUser, setPendingUser] = useState<ApiUser | null>(
    pendingSession?.user || null
  );
  const [generatedWords, setGeneratedWords] = useState<string[]>(
    pendingSession?.words || []
  );
  const [generatedPassphrase, setGeneratedPassphrase] = useState<string>(
    pendingSession?.passphrase || ''
  );
  const [copied, setCopied] = useState(false);
  const [confirmedSaved, setConfirmedSaved] = useState(false);

  const suggestUsername = () => {
    const base =
      SUGGESTED_USERNAMES[
        Math.floor(Math.random() * SUGGESTED_USERNAMES.length)
      ];
    const suffix = Math.floor(10 + Math.random() * 89);
    setUsername(`${base}_${suffix}`);
    setErrorMsg(null);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = username.trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleaned)) {
      setErrorMsg(
        'Username must be 3–24 characters using letters, numbers, or underscores.'
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await xpressitApi.register(cleaned);
      setPendingToken(res.token);
      setPendingUser(res.user);
      setGeneratedWords(
        res.words?.length ? res.words : res.passphrase.split(/\s+/)
      );
      setGeneratedPassphrase(res.passphrase);
      setConfirmedSaved(false);
      setCopied(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Unable to reach Xpressit sanctuary. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSaved = async () => {
    if (!pendingToken) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await xpressitApi.confirmRegistration(pendingToken, true);
      onAuthenticated(pendingToken, res.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to confirm registration. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedUser = username.trim();
    const cleanedPhrase = loginPassphrase.trim().replace(/\s+/g, ' ');
    if (!cleanedUser || !cleanedPhrase) {
      setErrorMsg('Enter both your username and six-word passphrase.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await xpressitApi.login(cleanedUser, cleanedPhrase);
      if (!res.user.confirmed) {
        setPendingToken(res.token);
        setPendingUser(res.user);
        setGeneratedWords(cleanedPhrase.split(' '));
        setGeneratedPassphrase(cleanedPhrase);
        setConfirmedSaved(true);
      } else {
        onAuthenticated(res.token, res.user);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Sign in failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyWords = () => {
    const text = generatedPassphrase || generatedWords.join(' ');
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-container-lowest shadow-sm flex items-center justify-center mb-3 p-2">
            <SafeImage
              src={XPRESSIT_LOGO_URL}
              alt="Xpressit Logo"
              className="w-full h-full object-contain"
              fallbackIcon="lock"
            />
          </div>
          <h1 className="text-[28px] leading-[36px] font-extrabold tracking-tight text-on-surface">
            {meta?.name || 'Xpressit'}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {meta?.tagline || 'Speak freely. Stay anonymous.'}
          </p>
        </div>

        {/* Sanctuary Notice */}
        <div className="rounded-2xl bg-gradient-to-r from-primary-fixed/80 via-surface-container-low to-primary-fixed/50 p-4 flex items-center gap-3 shadow-sm">
          <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined material-symbols-filled text-[20px]">
              shield
            </span>
          </div>
          <div>
            <p className="text-xs font-bold text-on-surface">
              No Email. No Phone Number. No Trackers.
            </p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Accounts use a pseudonymous handle and a cryptographic six-word
              passphrase.
            </p>
          </div>
        </div>

        {/* Step 2: Confirm Six-Word Passphrase */}
        {pendingToken && pendingUser ? (
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Save Your Recovery Key
                </span>
                <h2 className="text-lg font-bold text-on-surface mt-0.5">
                  @{pendingUser.username}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingToken(null);
                  setPendingUser(null);
                  setErrorMsg(null);
                }}
                className="text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                Start over
              </button>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Write down or copy these six words. Xpressit cannot recover a lost
              passphrase because no email or personal identifier is stored.
            </p>

            <div className="p-3.5 rounded-2xl bg-surface-container-low space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {generatedWords.map((word, idx) => (
                  <div
                    key={`${word}-${idx}`}
                    className="bg-surface-container-lowest rounded-xl py-2 px-2.5 text-center text-xs font-bold text-on-surface shadow-xs tabular-nums"
                  >
                    <span className="text-on-surface-variant font-medium mr-1">
                      {idx + 1}.
                    </span>
                    {word}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopyWords}
                className="w-full py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>
                  {copied ? 'Passphrase Copied' : 'Copy 6-Word Passphrase'}
                </span>
              </button>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-on-surface cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedSaved}
                onChange={(e) => setConfirmedSaved(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <span>
                I have safely saved my six-word passphrase and understand it
                cannot be reset.
              </span>
            </label>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              disabled={!confirmedSaved || loading}
              onClick={handleConfirmSaved}
              className="w-full py-3.5 rounded-full bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary text-sm font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>
                {loading ? 'Entering Sanctuary...' : 'Enter Sanctuary'}
              </span>
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </button>
          </div>
        ) : (
          /* Step 1: Register or Login */
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm space-y-5">
            <div className="w-full bg-surface-container-low p-1 rounded-full flex items-center">
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'register'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                New Anonymous ID
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'login'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Sign In
              </button>
            </div>

            {tab === 'register' ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="reg-username"
                      className="text-xs font-bold text-on-surface"
                    >
                      Choose a Pseudonym
                    </label>
                    <button
                      type="button"
                      onClick={suggestUsername}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        casino
                      </span>
                      Suggest
                    </button>
                  </div>
                  <div className="flex items-center rounded-2xl bg-surface-container-low px-3.5 py-3 focus-within:ring-2 focus-within:ring-primary/30">
                    <span className="text-on-surface-variant font-semibold mr-1">
                      @
                    </span>
                    <input
                      id="reg-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="quiet_voice"
                      autoComplete="off"
                      className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-on-surface-variant mt-1.5">
                    3–24 characters (letters, numbers, underscores). Immutable
                    once created.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-full bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary text-sm font-semibold shadow-md shadow-primary/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    key
                  </span>
                  <span>
                    {loading
                      ? 'Generating 6-Word Key...'
                      : 'Generate Passphrase & Continue'}
                  </span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-bold text-on-surface mb-1.5"
                  >
                    Pseudonym
                  </label>
                  <div className="flex items-center rounded-2xl bg-surface-container-low px-3.5 py-3 focus-within:ring-2 focus-within:ring-primary/30">
                    <span className="text-on-surface-variant font-semibold mr-1">
                      @
                    </span>
                    <input
                      id="login-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="quiet_voice"
                      autoComplete="username"
                      className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-passphrase"
                    className="block text-xs font-bold text-on-surface mb-1.5"
                  >
                    Six-Word Passphrase
                  </label>
                  <textarea
                    id="login-passphrase"
                    rows={2}
                    value={loginPassphrase}
                    onChange={(e) => setLoginPassphrase(e.target.value)}
                    placeholder="word1 word2 word3 word4 word5 word6"
                    className="w-full rounded-2xl bg-surface-container-low px-3.5 py-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-medium">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-full bg-primary hover:bg-primary-container disabled:opacity-60 text-on-primary text-sm font-semibold shadow-md shadow-primary/25 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    lock_open
                  </span>
                  <span>
                    {loading ? 'Unlocking Sanctuary...' : 'Sign In Anonymously'}
                  </span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
