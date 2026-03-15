import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSync } from '../contexts/SyncContext';
import {
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  UserPlus,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  Mail,
} from 'lucide-react';

export default function AuthSection() {
  const { user, loading, signUp, signIn, signOut, isConfigured } = useAuth();
  const { syncStatus, lastSynced, syncError, manualSync } = useSync();
  const [mode, setMode] = useState('sign-in'); // sign-in | sign-up
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isConfigured) {
    return (
      <div className="bg-bg-secondary rounded-xl border border-border p-4">
        <div className="flex items-start gap-3">
          <CloudOff className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-text-primary">Cloud sync not configured</p>
            <p className="text-xs text-text-muted mt-1">
              To enable cross-device sync, add your Supabase credentials to <code className="bg-bg-tertiary px-1.5 py-0.5 rounded text-[10px] font-mono text-accent">.env</code>:
            </p>
            <pre className="bg-bg-tertiary rounded-lg p-3 mt-2 text-xs font-mono text-text-secondary overflow-x-auto">
{`VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key`}
            </pre>
            <p className="text-xs text-text-muted mt-2">
              Your data is saved locally and will continue to work without Supabase.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-bg-secondary rounded-xl border border-border p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
      </div>
    );
  }

  // Signed in state
  if (user) {
    return (
      <div className="space-y-3">
        <div className="bg-bg-secondary rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                <Mail className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{user.email}</p>
                <p className="text-[10px] text-text-muted">Signed in</p>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  await signOut();
                } catch (err) {
                  setError(err.message);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-danger border border-border rounded-lg hover:border-danger/30 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>

          {/* Sync status */}
          <div className="flex items-center justify-between bg-bg-tertiary rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2">
              {syncStatus === 'syncing' ? (
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              ) : syncStatus === 'error' ? (
                <AlertCircle className="w-4 h-4 text-danger" />
              ) : syncStatus === 'synced' ? (
                <Cloud className="w-4 h-4 text-success" />
              ) : (
                <Cloud className="w-4 h-4 text-text-muted" />
              )}
              <div>
                <p className="text-xs text-text-primary">
                  {syncStatus === 'syncing' ? 'Syncing...' :
                   syncStatus === 'error' ? 'Sync error' :
                   syncStatus === 'synced' ? 'Synced' : 'Ready'}
                </p>
                {lastSynced && (
                  <p className="text-[10px] text-text-muted">
                    Last: {lastSynced.toLocaleTimeString()}
                  </p>
                )}
                {syncError && (
                  <p className="text-[10px] text-danger">{syncError}</p>
                )}
              </div>
            </div>
            <button
              onClick={manualSync}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-bg-secondary border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-hover disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              Sync Now
            </button>
          </div>
        </div>

        <p className="text-[10px] text-text-muted">
          Data syncs automatically every 5 minutes, on tab focus, and when you make changes.
        </p>
      </div>
    );
  }

  // Sign in / sign up form
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (mode === 'sign-up') {
        await signUp(email, password);
        setSuccess('Account created! Check your email to confirm, then sign in.');
        setMode('sign-in');
      } else {
        await signIn(email, password);
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-bg-secondary rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-4">
        <Cloud className="w-5 h-5 text-accent" />
        <p className="text-sm font-medium text-text-primary">
          {mode === 'sign-in' ? 'Sign in to sync' : 'Create account'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-danger">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {error}
          </p>
        )}
        {success && (
          <p className="flex items-center gap-1.5 text-xs text-success">
            <Check className="w-3 h-3 shrink-0" />
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : mode === 'sign-in' ? (
            <LogIn className="w-4 h-4" />
          ) : (
            <UserPlus className="w-4 h-4" />
          )}
          {mode === 'sign-in' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(''); setSuccess(''); }}
        className="w-full text-center text-xs text-text-muted hover:text-accent transition-colors mt-3"
      >
        {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
      </button>

      <p className="text-[10px] text-text-muted mt-3">
        Sign in to sync your study data across devices. Your data is always saved locally too.
      </p>
    </div>
  );
}
