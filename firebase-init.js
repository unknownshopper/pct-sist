import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, setDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

(function(){
  const cfg = window.firebaseConfig; // expected from firebase-config.js (user-provided)
  if (!cfg) {
    console.warn("Firebase config not found. Skipping Firestore init.");
    return;
  }
  const app = initializeApp(cfg);
  const db = getFirestore(app);
  window.db = db;
  window.saveInspection = async function(data){
    const headers = Array.isArray(data?.headers) ? data.headers : [];
    const colLabels = headers.slice(2);
    const rows = Array.isArray(data?.rows) ? data.rows : [];
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
