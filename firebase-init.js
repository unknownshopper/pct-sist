import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

(async function(){
  console.log('[init] firebase-init start');
  async function ensureConfig() {
    if (window.firebaseConfig) return true;
    const tryLoad = (src) => new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    // Try relative, then GitHub Pages repo base, then root
    if (!await tryLoad('./firebase-config.js')) {
      try {
        const parts = location.pathname.split('/').filter(Boolean);
        if (parts.length > 0) {
          const base = `/${parts[0]}/firebase-config.js`;
          if (await tryLoad(base)) {
            await new Promise(r => setTimeout(r, 0));
            return !!window.firebaseConfig;
          }
        }
      } catch {}
      await tryLoad('/firebase-config.js');
    }
    // small delay to allow script execution
    await new Promise(r => setTimeout(r, 0));
    return !!window.firebaseConfig;
  }

  let ok = await ensureConfig();
  if (!ok || !window.firebaseConfig) {
    // Final fallback (safe for public web Firebase):
    window.firebaseConfig = {
      apiKey: "AIzaSyCaG3KkC5q0VhNDfelH3OTTC0Qrpf7PRs4",
      authDomain: "pct-checklist.firebaseapp.com",
      projectId: "pct-checklist",
      storageBucket: "pct-checklist.firebasestorage.app",
      messagingSenderId: "573177765621",
      appId: "1:573177765621:web:7f7d58915121440cebefbc"
    };
    ok = true;
  }
  const cfg = window.firebaseConfig;
  console.log('[init] firebase config ready', !!cfg);
  const app = initializeApp(cfg);
  const db = getFirestore(app);
  const auth = getAuth(app);
  // Exponer global para vistas no-modulares (inslis.html usa window.db)
  window.app = app;
  window.db = db;
  window.auth = auth;
  console.log('[init] firebase app+db+auth initialized');
  window.logout = async function(){
    try { await signOut(auth); return { ok: true }; } catch (e) { return { ok: false, error: e?.message }; }
  }
  // Email/Password helpers
  window.loginEmail = async function(email, password){
    try { const cred = await signInWithEmailAndPassword(auth, String(email||'').trim(), String(password||'')); return { ok: true, uid: cred.user.uid }; }
    catch(e){ return { ok:false, error: e?.message } }
  }
  window.registerEmail = async function(email, password){
    try { const cred = await createUserWithEmailAndPassword(auth, String(email||'').trim(), String(password||'')); return { ok: true, uid: cred.user.uid }; }
    catch(e){ return { ok:false, error: e?.message } }
  }
  window.resetPassword = async function(email){
    try { await sendPasswordResetEmail(auth, String(email||'').trim()); return { ok: true } }
    catch(e){ return { ok:false, error: e?.message } }
  }
  // Presence (Firestore-based)
  let presenceTimer = null;
  let presenceUnloadsBound = false;
  async function touchPresence(user){
    try {
      if (!user) return;
      const { collection, doc, setDoc, updateDoc, serverTimestamp, query, where, getDocs, Timestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const ref = doc(collection(db, 'presence'), user.uid);
      await setDoc(ref, {
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        status: 'online',
        lastActive: serverTimestamp(),
      }, { merge: true });
    } catch(e) { /* ignore presence errors */ }
  }
  async function markOffline(user){
    try {
      if (!user) return;
      const { collection, doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const ref = doc(collection(db, 'presence'), user.uid);
      await updateDoc(ref, { status: 'offline', lastActive: serverTimestamp() });
    } catch { /* ignore */ }
  }
  function startPresence(user){
    if (!user) return;
    if (presenceTimer) clearInterval(presenceTimer);
    touchPresence(user);
    presenceTimer = setInterval(() => touchPresence(user), 10000);
    if (!presenceUnloadsBound) {
      presenceUnloadsBound = true;
      window.addEventListener('beforeunload', () => { try { markOffline(window.currentUser); } catch {} });
      document.addEventListener('visibilitychange', () => {
        try { if (document.visibilityState === 'hidden') { markOffline(window.currentUser); } else { touchPresence(window.currentUser); } } catch {}
      });
    }
  }
  function stopPresence(user){
    if (presenceTimer) { clearInterval(presenceTimer); presenceTimer = null; }
    markOffline(user);
  }

  // Admin helper to fetch online users in the last minute (excludes self by default)
  window.getOnlineUsers = async function(includeSelf = false, windowSeconds = 60){
    try {
      const mod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const nowMs = Date.now();
      const selfUid = window.currentUser?.uid || '';
      const snap = await mod.getDocs(mod.collection(db, 'presence'));
      const users = [];
      snap.forEach(d => {
        const data = d.data();
        if (!data) return;
        if (!includeSelf && data.uid === selfUid) return;
        const lastActive = data.lastActive && data.lastActive.toDate ? data.lastActive.toDate().getTime() : 0;
        const fresh = (nowMs - lastActive) <= (windowSeconds * 1000);
        if (fresh && data.status === 'online') {
          users.push({ uid: data.uid, email: data.email || null, displayName: data.displayName || null, lastActive: data.lastActive });
        }
      });
      return { ok: true, users };
    } catch(e){ return { ok: false, error: e?.message || 'presence_query_failed' }; }
  }

  async function emitPresenceSummary(){
    try {
      const res = await window.getOnlineUsers(false, 90);
      if (!res?.ok) return;
      const users = Array.isArray(res.users) ? res.users : [];
      let hasDirector = false;
      let hasInspector = false;
      let directorCount = 0;
      let inspectorCount = 0;
      const adminEmail = 'the@unknownshoppers.com';
      const adminUid = 'awhOBSnooda38KOyHb2QeghGKDI2';
      const directorUid = 'K7Hd0cw86cXHTI8ay2Fs9yqsxxo2';
      users.forEach(u => {
        const email = (u.email || '').toLowerCase().trim();
        const uid = u.uid || '';
        if (email === adminEmail || uid === adminUid) return;
        const isDirector = (email === 'jalcz@pct.com') || (uid === directorUid);
        if (isDirector) { hasDirector = true; directorCount++; return; }
        // Inspector: por defecto emails de dominio pct.com o inspector@pct.com
        const isInspector = (email === 'inspector@pct.com') || email.endsWith('@pct.com');
        if (isInspector) { hasInspector = true; inspectorCount++; }
      });
      window.dispatchEvent(new CustomEvent('presence:summary', { detail: { hasDirector, hasInspector, directorCount, inspectorCount } }));
    } catch {}
  }

  let presenceSummaryTimer = null;
  let presenceSummaryBurstTimer = null;
  window.forcePresenceRefresh = () => { try { emitPresenceSummary(); } catch {} };
  let presenceRealtimeUnsub = null;
  function isAdminUser(u){
    const email = (u?.email || '').toLowerCase().trim();
    const uid = u?.uid || '';
    return !!u && (email === 'the@unknownshoppers.com' || uid === 'awhOBSnooda38KOyHb2QeghGKDI2');
  }
  async function startPresenceRealtime(){
    try {
      if (!isAdminUser(window.currentUser)) return;
      if (presenceRealtimeUnsub) { try { presenceRealtimeUnsub(); } catch {} presenceRealtimeUnsub = null; }
      const mod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const col = mod.collection(db, 'presence');
      presenceRealtimeUnsub = mod.onSnapshot(col, (snap) => {
        try {
          const nowMs = Date.now();
          const windowMs = 120000; // 120s freshness window
          const adminEmail = 'the@unknownshoppers.com';
          const adminUid = 'awhOBSnooda38KOyHb2QeghGKDI2';
          const directorUid = 'K7Hd0cw86cXHTI8ay2Fs9yqsxxo2';
          let hasDirector = false, hasInspector = false, directorCount = 0, inspectorCount = 0;
          snap.forEach(d => {
            const data = d.data(); if (!data) return;
            const email = (data.email || '').toLowerCase().trim();
            const uid = data.uid || '';
            if (email === adminEmail || uid === adminUid) return; // exclude self admin
            const lastActive = data.lastActive && data.lastActive.toDate ? data.lastActive.toDate().getTime() : 0;
            const fresh = (nowMs - lastActive) <= windowMs;
            if (!fresh || data.status !== 'online') return;
            const isDirector = (email === 'jalcz@pct.com') || (uid === directorUid);
            if (isDirector) { hasDirector = true; directorCount++; return; }
            const isInspector = (email === 'inspector@pct.com') || email.endsWith('@pct.com');
            if (isInspector) { hasInspector = true; inspectorCount++; }
          });
          window.dispatchEvent(new CustomEvent('presence:summary', { detail: { hasDirector, hasInspector, directorCount, inspectorCount } }));
        } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
  }
  function stopPresenceRealtime(){ if (presenceRealtimeUnsub) { try { presenceRealtimeUnsub(); } catch {} presenceRealtimeUnsub = null; } }
  function startPresenceSummary(){
    if (presenceSummaryTimer) clearInterval(presenceSummaryTimer);
    if (presenceSummaryBurstTimer) clearInterval(presenceSummaryBurstTimer);
    emitPresenceSummary();
    // Faster interval for better responsiveness during testing
    presenceSummaryTimer = setInterval(emitPresenceSummary, 10000);
    // Burst: refresh every 3s for first ~30s after start
    let burstCount = 0;
    presenceSummaryBurstTimer = setInterval(() => {
      burstCount++;
      emitPresenceSummary();
      if (burstCount >= 10) { clearInterval(presenceSummaryBurstTimer); presenceSummaryBurstTimer = null; }
    }, 3000);
    // Re-emit on tab visibility changes
    document.addEventListener('visibilitychange', () => { try { emitPresenceSummary(); } catch {} });
  }
  function stopPresenceSummary(){
    if (presenceSummaryTimer) { clearInterval(presenceSummaryTimer); presenceSummaryTimer = null; }
    if (presenceSummaryBurstTimer) { clearInterval(presenceSummaryBurstTimer); presenceSummaryBurstTimer = null; }
  }

  onAuthStateChanged(auth, (user) => {
    console.log('[auth] state changed', !!user, user?.email || user?.uid || null);
    // stop previous presence if any
    if (!user && window.currentUser) { try { stopPresence(window.currentUser); } catch {} }
    window.currentUser = user || null;
    if (user) { startPresence(user); startPresenceSummary(); startPresenceRealtime(); }
    else { stopPresenceSummary(); stopPresenceRealtime(); }
    window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: window.currentUser } }));
  });
  window.saveInspection = async function(data){
    console.log('[save] saving inspection');
    const headers = Array.isArray(data?.headers) ? data.headers : [];
    const colLabels = headers.slice(2);
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const meta = data?.meta || null;
    // Preferir equipoActivo de meta como itemId
    let itemId = (meta?.equipoActivo || '').trim();
    if (!itemId) {
      const idRow = rows.find(r => (r.parametro || '').toLowerCase().includes('número de equipo') || (r.parametro || '').toLowerCase().includes('numero de equipo'));
      if (idRow) {
        itemId = idRow['Codo'] || idRow[colLabels[0]] || '';
      }
    }
    const now = new Date();
    const payload = {
      createdAt: serverTimestamp(),
      createdAtLocal: now.toISOString(),
      headers,
      rows,
      meta: {
        ...meta,
        user: window.currentUser ? {
          uid: window.currentUser.uid,
          email: window.currentUser.email || null,
          displayName: window.currentUser.displayName || null,
        } : null,
      },
    };
    try {
      console.log('[save] meta snapshot', {
        producto: payload.meta?.producto,
        product: payload.meta?.product,
        tipo1: payload.meta?.tipo1,
        equipoActivo: payload.meta?.equipoActivo,
        hasInv: !!payload.meta?.inv,
        invHeaders: Array.isArray(payload.meta?.inv?.headers) ? payload.meta.inv.headers.slice(0,8) : null,
      });
    } catch {}
    if (itemId) {
      const itemRef = doc(collection(db, 'items'), String(itemId));
      await setDoc(itemRef, { updatedAt: serverTimestamp(), itemId: String(itemId) }, { merge: true });
      await addDoc(collection(itemRef, 'inspections'), payload);
      console.log('[save] wrote to items/*/inspections', itemId);
      return { ok: true, itemId };
    } else {
      const ref = await addDoc(collection(db, 'inspections'), payload);
      console.log('[save] wrote to inspections root', ref.id);
      return { ok: true, id: ref.id };
    }
  }
})();
