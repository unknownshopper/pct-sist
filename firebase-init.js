import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

(async function(){
  async function ensureConfig() {
    if (window.firebaseConfig) return true;
    const tryLoad = (src) => new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    // Try relative then root
    if (!await tryLoad('./firebase-config.js')) {
      await tryLoad('/firebase-config.js');
    }
    // small delay to allow script execution
    await new Promise(r => setTimeout(r, 0));
    return !!window.firebaseConfig;
  }

  const ok = await ensureConfig();
  const cfg = window.firebaseConfig;
  if (!ok || !cfg) {
    console.warn("Firebase config not found. Skipping Firestore init.");
    return;
  }
  const app = initializeApp(cfg);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  window.login = async function(){
    try {
      await signInWithPopup(auth, provider);
      return { ok: true };
    } catch (e) {
      console.warn('Login error', e?.message);
      return { ok: false, error: e?.message };
    }
  }
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
    window.currentUser = user || null;
    window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: window.currentUser } }));
  });
  window.db = db;
  window.saveInspection = async function(data){
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
