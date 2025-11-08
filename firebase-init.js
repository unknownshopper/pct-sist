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
  onAuthStateChanged(auth, (user) => {
    console.log('[auth] state changed', !!user, user?.email || user?.uid || null);
    window.currentUser = user || null;
    window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: window.currentUser } }));
  });
  window.saveInspection = async function(data){
    console.log('[save] saving inspection');
    const headers = Array.isArray(data?.headers) ? data.headers : [];
    const colLabels = headers.slice(2);
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    const meta = data?.meta || null;
    const idRow = rows.find(r => (r.parametro || '').toLowerCase().includes('número de equipo') || (r.parametro || '').toLowerCase().includes('numero de equipo'));
    let itemId = '';
    if (idRow) {
      itemId = idRow['Codo'] || idRow[colLabels[0]] || '';
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
    if (itemId) {
      const itemRef = doc(collection(db, 'items'), String(itemId));
      await setDoc(itemRef, { updatedAt: serverTimestamp(), itemId: String(itemId) }, { merge: true });
      await addDoc(collection(itemRef, 'inspections'), payload);
      return { ok: true, itemId };
    } else {
      const ref = await addDoc(collection(db, 'inspections'), payload);
      return { ok: true, id: ref.id };
    }
  }
})();
