/* Cloud Functions to track Firestore storage usage in near real-time.
 * Updates admin/usage with:
 * - sizeBytes (accumulated)
 * - percent (if quotaBytes is present in the doc)
 * - updatedAt (serverTimestamp)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Serialize special Firestore/JS values into plain JSON so we can size them.
function normalizeForSize(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof admin.firestore.Timestamp) return { _ts: value.toMillis() };
  if (value instanceof admin.firestore.GeoPoint) return { _geo: { lat: value.latitude, lng: value.longitude } };
  if (Array.isArray(value)) return value.map(normalizeForSize);
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = normalizeForSize(value[k]);
    return out;
  }
  // primitives (string/number/boolean)
  return value;
}

function estimateDocSizeBytes(data) {
  if (!data) return 0;
  try {
    const normalized = normalizeForSize(data);
    const json = JSON.stringify(normalized);
    return Buffer.byteLength(json, 'utf8');
  } catch (e) {
    return 0;
  }
}

async function applyDeltaBytes(delta) {
  if (!Number.isFinite(delta) || delta === 0) return;
  const usageRef = db.collection('admin').doc('usage');
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(usageRef);
    const prev = snap.exists ? (snap.get('sizeBytes') || 0) : 0;
    let next = prev + delta;
    if (next < 0) next = 0;
    const quotaBytes = snap.exists ? snap.get('quotaBytes') : null;
    const update = {
      sizeBytes: next,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (Number.isFinite(quotaBytes) && quotaBytes > 0) {
      const pct = Math.max(0, Math.min(100, Math.round((next / quotaBytes) * 100)));
      update.percent = pct;
    }
    tx.set(usageRef, update, { merge: true });
  });
}

function makeOnWrite(path) {
  return functions.firestore.document(path).onWrite(async (change, context) => {
    try {
      const beforeData = change.before.exists ? change.before.data() : null;
      const afterData = change.after.exists ? change.after.data() : null;
      const beforeSize = estimateDocSizeBytes(beforeData);
      const afterSize = estimateDocSizeBytes(afterData);
      const delta = afterSize - beforeSize; // create -> positive, delete -> negative, update -> diff
      await applyDeltaBytes(delta);
    } catch (e) {
      console.error('applyDelta error', e && e.message);
    }
  });
}

// Collections to track (add more as needed)
exports.itemsInspectionsOnWrite = makeOnWrite('items/{itemId}/inspections/{docId}');
exports.inspectionsOnWrite = makeOnWrite('inspections/{docId}');

// Optional: track presence if you want it counted as well (usually tiny; commented out)
// exports.presenceOnWrite = makeOnWrite('presence/{uid}');

// Optional HTTP to set quotaBytes quickly (protect with IAM or a secret header in production)
exports.setQuotaBytes = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const { quotaBytes } = req.body || {};
    if (!Number.isFinite(quotaBytes) || quotaBytes <= 0) return res.status(400).send('quotaBytes must be a positive number');
    const ref = db.collection('admin').doc('usage');
    await ref.set({ quotaBytes: Number(quotaBytes) }, { merge: true });
    return res.status(200).send('ok');
  } catch (e) {
    console.error(e);
    return res.status(500).send('error');
  }
});
