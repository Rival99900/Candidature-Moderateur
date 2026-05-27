// candidature/verify.js — Discord OAuth2 verification (implicit flow)
//
// Verifies that the candidate (a) has a Discord account and (b) is a member
// of the target server before they can submit the form.
//
// Uses OAuth2 implicit grant (response_type=token) — no client_secret required,
// fully client-side. The user-issued token lets us call /users/@me and
// /users/@me/guilds to check membership.
//
// Public API (exposed on window.MorphVerify):
//   - getState()      → current { status, user, error }
//   - onChange(fn)    → subscribe to state changes (also fires immediately)
//   - isVerified()    → true if status === 'verified'
//   - getUser()       → verified Discord user object (id, username, …) or null
//   - startLogin()    → redirect to Discord OAuth
//   - logout()        → clear verification

(function () {
  'use strict';

  const CFG = window.MORPH_CANDIDATURE_CONFIG || {};
  const CLIENT_ID = (CFG.DISCORD_CLIENT_ID || '').trim();
  const SERVER_ID = (CFG.DISCORD_SERVER_ID || '').trim();
  const INVITE_URL = (CFG.DISCORD_INVITE_URL || '').trim();

  // Exact value Discord will redirect back to. Must be registered in the
  // dev portal under OAuth2 → Redirects (down to the trailing slash).
  const REDIRECT_URI = location.origin + location.pathname;
  const STORAGE_KEY = 'morph_candidature_verify_v1';

  let state = { status: 'loading', user: null, error: null };
  const listeners = new Set();

  function setState(next) {
    state = { ...state, ...next };
    listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
  }

  function loadCached() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (!cached || cached.expires < Date.now()) return null;
      return cached;
    } catch { return null; }
  }
  function saveCached(user, token) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        user, token,
        expires: Date.now() + 6 * 3600 * 1000, // 6h
      }));
    } catch {}
  }
  function clearCached() { try { sessionStorage.removeItem(STORAGE_KEY); } catch {} }

  function buildAuthUrl() {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'token',
      scope: 'identify guilds',
    });
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  async function fetchUser(token) {
    const res = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Impossible de récupérer ton profil Discord (token expiré ?)");
    return res.json();
  }
  async function fetchGuilds(token) {
    const res = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Impossible de récupérer tes serveurs Discord');
    return res.json();
  }

  async function verifyToken(token) {
    setState({ status: 'verifying', error: null });
    try {
      const [user, guilds] = await Promise.all([fetchUser(token), fetchGuilds(token)]);
      const inServer = Array.isArray(guilds) && guilds.some((g) => g.id === SERVER_ID);
      // Enrich the user object with computed display info.
      const displayName = user.global_name || user.username;
      const avatarUrl = user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
        : `https://cdn.discordapp.com/embed/avatars/${(parseInt(user.id) >> 22) % 6}.png`;
      const enriched = {
        id: user.id,
        username: user.username,
        global_name: user.global_name,
        displayName,
        avatarUrl,
        verifiedAt: new Date().toISOString(),
      };
      if (!inServer) {
        setState({ status: 'not-member', user: enriched, error: null });
        return;
      }
      saveCached(enriched, token);
      setState({ status: 'verified', user: enriched, error: null });
    } catch (err) {
      console.error('Verify failed:', err);
      setState({ status: 'error', error: err.message });
    }
  }

  function startLogin() {
    if (!CLIENT_ID) { setState({ status: 'unconfigured' }); return; }
    location.href = buildAuthUrl();
  }
  function logout() { clearCached(); setState({ status: 'idle', user: null, error: null }); }

  function init() {
    if (!CLIENT_ID) {
      setState({ status: 'unconfigured', error: null });
      return;
    }
    if (!SERVER_ID) {
      setState({ status: 'unconfigured', error: 'DISCORD_SERVER_ID manquant dans config.js' });
      return;
    }

    // ── 1) Check URL hash for a fresh OAuth token ──
    const hash = location.hash.replace(/^#/, '');
    if (hash) {
      const params = new URLSearchParams(hash);
      const token = params.get('access_token');
      const error = params.get('error');
      if (token) {
        history.replaceState(null, '', location.pathname + location.search);
        verifyToken(token);
        return;
      }
      if (error) {
        history.replaceState(null, '', location.pathname + location.search);
        const desc = params.get('error_description') || error;
        setState({ status: 'idle', error: 'Connexion annulée : ' + desc });
        return;
      }
    }

    // ── 2) Check session storage for a cached verification ──
    const cached = loadCached();
    if (cached && cached.user) {
      setState({ status: 'verified', user: cached.user });
      return;
    }

    // ── 3) Otherwise wait for user to click "Verify" ──
    setState({ status: 'idle' });
  }

  window.MorphVerify = {
    getState: () => state,
    onChange: (fn) => { listeners.add(fn); fn(state); return () => listeners.delete(fn); },
    isVerified: () => state.status === 'verified',
    getUser: () => state.user,
    startLogin, logout,
    REDIRECT_URI, INVITE_URL, SERVER_ID, CLIENT_ID,
  };

  init();
})();
