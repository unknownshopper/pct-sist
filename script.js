(() => {
  const STORAGE_KEY = 'primariaStateV1';

  function qs(sel, ctx = document) { return ctx.querySelector(sel); }
  function qsa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

  function getHeaders(table) {
    const ths = qsa('thead th', table).map(th => th.textContent.trim());
    return ths; // [#, Parámetro, Codo, Tubería 1, Tubería 2]
  }

  function setupSaveButton() {
    const btn = qs('#saveBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const table = qs('table.inspection');
      if (!table) return;
      const data = serialize(table);
      // persist first
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      // try remote save (optional)
      let remoteMsg = '';
      if (typeof window.saveInspection === 'function') {
        try {
          const res = await window.saveInspection(data);
          if (res?.ok) {
            remoteMsg = res.itemId ? ` • Firestore: ${res.itemId}` : ' • Firestore ok';
          } else {
            remoteMsg = ' • Firestore: fallo';
          }
        } catch (e) {
          remoteMsg = ' • Firestore: sin conexión';
        }
      }
      // download JSON
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `inspeccion-primaria-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // feedback
      btn.textContent = `Guardado ✓${remoteMsg}`;
      setTimeout(() => { btn.textContent = 'Guardar'; }, 1400);
    });
  }

  function isEditableCell(td) {
    if (!td) return false;
    if (td.closest('thead')) return false;
    if (td.classList.contains('num')) return false;
    if (td.classList.contains('param')) return false;
    if (td.querySelector('.badge')) return false;
    return true;
  }

  function enableContentEditing(table) {
    qsa('tbody tr', table).forEach((tr, rIdx) => {
      const tds = qsa('td', tr);
      tds.forEach((td, cIdx) => {
        if (isEditableCell(td)) {
          td.setAttribute('contenteditable', 'true');
          td.setAttribute('inputmode', 'text');
          td.addEventListener('input', saveStateThrottled);
          td.addEventListener('blur', saveState);
        }
      });
    });
  }

  function normalizeBadgeRow(td) {
    if (td.querySelector('.badge-row')) return; // already grouped
    const nodes = Array.from(td.childNodes);
    const row = document.createElement('span');
    row.className = 'badge-row';
    let movedAny = false;
    nodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('badge')) {
        row.appendChild(node);
        movedAny = true;
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text && text.trim() === '/') {
          const sep = document.createElement('span');
          sep.className = 'badge-sep';
          sep.textContent = '/';
          row.appendChild(sep);
          movedAny = true;
          return; // skip appending original text node
        }
      }
    });
    if (movedAny) {
      // Remove moved nodes from td first
      qsa('.badge', td).forEach(el => el.remove());
      nodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE && n.textContent.trim() === '/') n.remove(); });
      // Insert row at the top
      td.insertBefore(row, td.firstChild);
      td.classList.add('has-controls');
      // Ensure detail box (if present) stays after the row
      const box = td.querySelector('.detail-box');
      if (box && box.previousSibling !== row) {
        td.appendChild(box);
      }
    }
  }

  function setupBadges(table) {
    qsa('tbody tr', table).forEach(tr => {
      qsa('td', tr).forEach(td => {
        const badges = qsa('.badge', td);
        if (badges.length) {
          normalizeBadgeRow(td);
          badges.forEach(b => {
            b.setAttribute('role', 'button');
            b.setAttribute('tabindex', '0');
            const activate = () => {
              // single-select per cell
              badges.forEach(x => x.classList.remove('active'));
              b.classList.add('active');
              // handle detail textarea for 'Malo'
              handleDetailArea(td, b);
              saveState();
            };
            b.addEventListener('click', activate);
            // Touch support
            b.addEventListener('touchend', (e) => { e.preventDefault(); activate(); }, { passive: false });
            // Keyboard
            b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
          });
        }
      });
    });
  }

  function ensureDetailBox(td) {
    let box = td.querySelector('.detail-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'detail-box';
      const ta = document.createElement('textarea');
      ta.className = 'detail-input';
      ta.placeholder = 'Describe el detalle de la falla…';
      ta.addEventListener('input', saveStateThrottled);
      box.appendChild(ta);
      td.appendChild(box);
    }
    return box;
  }

  function handleDetailArea(td, activeBadge) {
    const label = activeBadge?.textContent.trim();
    if (label === 'Malo') {
      const box = ensureDetailBox(td);
      box.style.display = '';
      const ta = box.querySelector('textarea');
      if (ta) ta.focus({ preventScroll: true });
    } else {
      const box = td.querySelector('.detail-box');
      if (box) box.style.display = 'none';
    }
  }

  function serialize(table) {
    const headers = getHeaders(table);
    const colLabels = headers.slice(2); // Codo, Tubería 1, Tubería 2
    const out = [];
    qsa('tbody tr', table).forEach(tr => {
      const cells = qsa('td', tr);
      const idx = cells[0]?.textContent.trim() || '';
      const param = cells[1]?.textContent.trim() || '';
      const rowObj = { idx, parametro: param };
      // values per remaining cols
      for (let i = 2; i < cells.length; i++) {
        const label = colLabels[i - 2] || `Col${i-1}`;
        const td = cells[i];
        const active = td.querySelector('.badge.active');
        let value = '';
        if (active) {
          value = active.textContent.trim();
        } else if (isEditableCell(td)) {
          value = td.textContent.trim();
        } else {
          // non-editable without badges -> raw text
          value = td.textContent.trim();
        }
        rowObj[label] = value;
        if (active && value === 'Malo') {
          const ta = td.querySelector('.detail-box textarea');
          rowObj[label + '_detalle'] = ta ? ta.value : '';
        }
      }
      out.push(rowObj);
    });
    return { headers, rows: out };
  }

  function saveState() {
    try {
      const table = qs('table.inspection');
      if (!table) return;
      const data = serialize(table);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  let saveTimer = null;
  function saveStateThrottled() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 250);
  }

  function restoreState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    const table = qs('table.inspection');
    if (!table || !data || !Array.isArray(data.rows)) return;

    const headers = getHeaders(table);
    const colLabels = headers.slice(2);

    // Build quick access map: parametro -> row element
    const rows = qsa('tbody tr', table);
    const rowByParam = new Map();
    rows.forEach(tr => {
      const param = tr.querySelector('td.param')?.textContent.trim() || tr.children[1]?.textContent.trim();
      if (param) rowByParam.set(param, tr);
    });

    data.rows.forEach(r => {
      const tr = rowByParam.get(r.parametro);
      if (!tr) return;
      const tds = qsa('td', tr);
      for (let i = 0; i < colLabels.length; i++) {
        const label = colLabels[i];
        const td = tds[i + 2];
        if (!td) continue;
        const val = r[label];
        if (val == null) continue;
        const badges = qsa('.badge', td);
        if (badges.length) {
          badges.forEach(b => b.classList.toggle('active', b.textContent.trim() === String(val)));
          const active = td.querySelector('.badge.active');
          if (active && active.textContent.trim() === 'Malo') {
            const box = ensureDetailBox(td);
            const ta = box.querySelector('textarea');
            if (ta) ta.value = r[label + '_detalle'] || '';
            box.style.display = '';
          } else {
            const box = td.querySelector('.detail-box');
            if (box) box.style.display = 'none';
          }
        } else if (isEditableCell(td)) {
          td.textContent = String(val);
        }
      }
    });
  }

  function setupExport() {
    const title = qs('main h1');
    if (!title) return;
    let lastTap = 0;
    const trigger = () => {
      const table = qs('table.inspection');
      const data = serialize(table);
      const text = JSON.stringify(data, null, 2);
      navigator.clipboard?.writeText(text).then(() => {
        // brief visual feedback
        title.style.textShadow = '0 0 18px rgba(124, 244, 255, 0.6)';
        setTimeout(() => { title.style.textShadow = ''; }, 400);
      }).catch(() => { /* ignore */ });
    };
    title.addEventListener('dblclick', trigger);
    title.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 400) {
        e.preventDefault();
        trigger();
      }
      lastTap = now;
    }, { passive: false });
  }

  function enhanceFocus(table) {
    // Improve focus ring on editable cells
    qsa('td[contenteditable="true"]', table).forEach(td => {
      td.addEventListener('focus', () => { td.style.outline = '2px solid rgba(124, 244, 255, 0.35)'; td.style.outlineOffset = '2px'; });
      td.addEventListener('blur', () => { td.style.outline = ''; td.style.outlineOffset = ''; });
    });
  }

  function init() {
    const table = qs('table.inspection');
    if (!table) return;
    setupBadges(table);
    enableContentEditing(table);
    restoreState();
    enhanceFocus(table);
    setupExport();
    setupSaveButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

