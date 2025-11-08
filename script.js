(() => {
  const STORAGE_KEY = 'primariaStateV1';

  function qs(sel, ctx = document) { return ctx.querySelector(sel); }
  function qsa(sel, ctx = document) { return Array.from(ctx.querySelectorAll(sel)); }

  function getUserRole(user){
    try {
      const email = (user?.email || '').toLowerCase().trim();
      const uid = user?.uid || '';
      if (email === 'the@unknownshoppers.com' || uid === 'awhOBSnooda38KOyHb2QeghGKDI2') return 'Admin';
      if (email === 'jalcz@pct.com') return 'Director';
      if (email.endsWith('@pct.com')) return 'Inspector';
      return 'Inspector';
    } catch { return 'Inspector'; }
  }

  function getHeaders(table) {
    const ths = qsa('thead th', table).map(th => th.textContent.trim());
    return ths; // [#, Parámetro, Codo, Tubería 1, Tubería 2]
  }

  function setupNavbar(){
    const navToggle = qs('#navToggle');
    const navMenu = qs('#navMenu');
    if (navToggle && navMenu) {
      navToggle.addEventListener('click', () => {
        const open = navMenu.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    const badge = qs('#userBadge');
    const logoutItem = qs('#logoutMenuItem');
    if (logoutItem) logoutItem.addEventListener('click', async () => { try { await window.logout?.(); } catch {} });
    const navLogin = qs('#navLogin');
    if (navLogin) navLogin.addEventListener('click', () => {
      const overlay = qs('#lockOverlay');
      const email = qs('#authEmail');
      document.body.classList.add('locked');
      const main = qs('main'); if (main) main.setAttribute('inert','');
      if (overlay) overlay.removeAttribute('aria-hidden');
      if (email) email.focus({ preventScroll: true });
      window.scrollTo(0,0);
    });
    if (badge) {
      // Toggle on click
      badge.addEventListener('click', (e) => {
        badge.classList.toggle('open');
        e.stopPropagation();
      });
      // Hover support (desktop)
      badge.addEventListener('mouseenter', () => badge.classList.add('open'));
      badge.addEventListener('mouseleave', () => badge.classList.remove('open'));
      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!badge.contains(e.target)) badge.classList.remove('open');
      });
    }
  }

  function setHeaderDate() {
    try {
      const metaBlocks = qsa('.meta > div');
      for (const block of metaBlocks) {
        const label = qs('.label', block)?.textContent?.trim();
        if (label && label.toLowerCase().includes('fecha / hora')) {
          const valueEl = qs('.value', block);
          if (valueEl) {
            const now = new Date();
            const str = now.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
            valueEl.textContent = str; // solo fecha, sin hora
          }
          break;
        }
      }
    } catch {}
  }

  function updateAuthUI(user) {
    const info = qs('#userInfo');
    const loginBtn = qs('#loginBtn');
    const logoutBtn = qs('#logoutBtn');
    const overlay = qs('#lockOverlay');
    const main = qs('main');
    const emailField = qs('#authEmail');
    const saveBtn = qs('#saveBtn');
    const userBadge = qs('#userBadge');
    const userBadgeName = qs('#userBadgeName');
    const userNameEl = qs('#userName');
    const navLogin = qs('#navLogin');
    if (user) {
      document.body.classList.remove('locked');
      if (overlay) overlay.style.display = '';
      if (main) main.removeAttribute('inert');
      const role = getUserRole(user);
      if (info) info.textContent = `${role} · ${(user.displayName || user.email || user.uid || '').toString()}`;
      if (loginBtn) loginBtn.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = '';
      if (userBadge) userBadge.style.display = 'inline-flex';
      const label = `${role} · ${(user.displayName || user.email || 'Usuario')}`;
      if (userBadgeName) userBadgeName.textContent = label;
      if (userNameEl) userNameEl.textContent = label;
      if (navLogin) navLogin.style.display = 'none';
      // return focus without scrolling viewport
      if (saveBtn) { try { saveBtn.focus({ preventScroll: true }); } catch {} }
      // ensure viewport stays at top
      try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch { try { window.scrollTo(0,0); } catch {} }
    } else {
      document.body.classList.add('locked');
      if (overlay) overlay.style.display = '';
      if (main) main.setAttribute('inert', '');
      if (info) info.textContent = 'No autenticado';
      if (userBadgeName) userBadgeName.textContent = 'Usuario';
      if (userNameEl) userNameEl.textContent = 'Usuario';
      if (loginBtn) loginBtn.style.display = '';
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (userBadge) userBadge.style.display = 'none';
      // move focus into overlay without scrolling
      if (emailField) { try { emailField.focus({ preventScroll: true }); } catch {} }
    }
  }

  function bindAuthButtons() {
    const loginBtn = qs('#loginBtn');
    const logoutBtn = qs('#logoutBtn');
    const overlayLoginBtn = qs('#overlayLoginBtn');
    const overlayLoginEmailBtn = qs('#overlayLoginEmailBtn');
    const overlayRegisterBtn = qs('#overlayRegisterBtn');
    const overlayResetBtn = qs('#overlayResetBtn');
    const emailInput = qs('#authEmail');
    const passInput = qs('#authPassword');
    const doLogin = async () => { try { await window.login?.(); } catch {} };
    const doLogout = async () => { try { await window.logout?.(); } catch {} };
    const doLoginEmail = async () => {
      console.log('[ui] click Entrar');
      const email = qs('#authEmail')?.value?.trim();
      const pass = qs('#authPassword')?.value || '';
      if (!email || !pass) { console.warn('[ui] faltan credenciales'); toast('Ingresa correo y contraseña'); return; }
      try {
        const res = await window.loginEmail?.(email, pass);
        console.log('[auth] loginEmail result', res);
        if (!res?.ok) { toast(res?.error || 'No se pudo iniciar sesión'); return; }
        toast('Sesión iniciada');
      } catch (e) {
        console.warn('[auth] loginEmail error', e?.message);
        toast(e?.message || 'Error de autenticación');
      }
    };
    const doRegister = async () => {
      const email = emailInput?.value || '';
      const pass = passInput?.value || '';
      if (!email || !pass) { toast('Completa correo y contraseña'); return; }
      const res = await window.registerEmail?.(email, pass);
      if (!res?.ok) toast(res?.error || 'No se pudo crear la cuenta');
      else toast('Cuenta creada, sesión iniciada');
    };
    const doReset = async () => {
      console.log('[ui] click Restablecer');
      const email = qs('#authEmail')?.value?.trim();
      if (!email) { console.warn('[ui] falta correo'); toast('Ingresa tu correo'); return; }
      try {
        const res = await window.resetPassword?.(email);
        console.log('[auth] resetPassword result', res);
        if (!res?.ok) { toast(res?.error || 'No se pudo enviar correo'); return; }
        toast('Correo enviado');
      } catch (e) {
        console.warn('[auth] resetPassword error', e?.message);
        toast(e?.message || 'Error al enviar correo');
      }
    };
    if (loginBtn) loginBtn.addEventListener('click', doLogin);
    if (overlayLoginBtn) overlayLoginBtn.addEventListener('click', doLogin);
    if (overlayLoginEmailBtn) overlayLoginEmailBtn.addEventListener('click', doLoginEmail);
    // Enter key submits login
    [emailInput, passInput].forEach(inp => {
      if (!inp) return;
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') doLoginEmail();
      });
    });
    if (overlayRegisterBtn) overlayRegisterBtn.addEventListener('click', doRegister);
    if (overlayResetBtn) overlayResetBtn.addEventListener('click', doReset);
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
    // Delegated fallback (in case late DOM prevents direct binding)
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.id === 'overlayLoginEmailBtn') {
        console.log('[ui] delegated Entrar click');
        doLoginEmail();
      }
    });
    window.addEventListener('auth:changed', (e) => updateAuthUI(e.detail?.user || null));
    // initial state
    updateAuthUI(window.currentUser || null);
  }

  function toast(msg) {
    if (!msg) return;
    // quick unobtrusive feedback
    try {
      const el = document.createElement('div');
      el.textContent = msg;
      el.style.position = 'fixed';
      el.style.bottom = '18px';
      el.style.left = '50%';
      el.style.transform = 'translateX(-50%)';
      el.style.background = '#0f172a';
      el.style.color = '#fff';
      el.style.padding = '10px 14px';
      el.style.borderRadius = '10px';
      el.style.boxShadow = '0 6px 16px rgba(15,23,42,0.25)';
      el.style.zIndex = '9999';
      document.body.appendChild(el);
      setTimeout(() => { el.remove(); }, 2400);
    } catch {}
  }

  function setupSaveButton() {
    const btn = qs('#saveBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!window.currentUser) {
        // show overlay and prevent action
        document.body.classList.add('locked');
        const overlay = qs('#lockOverlay');
        if (overlay) overlay.style.display = '';
        const main = qs('main');
        if (main) main.setAttribute('inert', '');
        const emailField = qs('#authEmail');
        if (emailField) { try { emailField.focus(); } catch {} }
        return;
      }
      const table = qs('table.inspection');
      if (!table) return;
      // Apply auto rules before serializing
      applyAutoEvaluation(table);
      applyAutoDate(table);
      const data = serialize(table);
      // Build meta (time, evaluation, geo, producto)
      const meta = await buildMeta();
      data.meta = meta;
      // persist first
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      // try remote save (optional)
      let remoteMsg = '';
      if (typeof window.saveInspection === 'function') {
        console.log('[ui] script.js loaded');
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
    const colLabels = headers.slice(2);
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

  function findRowByParamContains(table, needle) {
    const low = String(needle).toLowerCase();
    return Array.from(table.tBodies[0].rows).find(r => (r.cells[1]?.textContent || '').toLowerCase().includes(low));
  }

  function applyAutoEvaluation(table) {
    // If any badge "Malo" is active in the table, evaluation is Rechazado; else Aceptado
    const anyBad = Array.from(table.querySelectorAll('tbody td .badge.active')).some(b => b.textContent.trim() === 'Malo');
    const result = anyBad ? 'Rechazado' : 'Aceptado';
    const tr = findRowByParamContains(table, 'Evaluación');
    if (tr) {
      const td = tr.cells[1];
      const badges = td ? Array.from(td.querySelectorAll('.badge')) : [];
      badges.forEach(x => x.classList.toggle('active', x.textContent.trim() === result));
    }
  }

  function applyAutoDate(table) {
    const tr = findRowByParamContains(table, 'Fecha de Inspección');
    if (tr) {
      const td = tr.cells[1];
      let badge = td.querySelector('.badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge';
        td.appendChild(badge);
      }
      const now = new Date();
      // Local formatted date-time, e.g., 2025-11-07 20:31
      const pad = n => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
      badge.textContent = ts;
    }
  }

  async function getGeo() {
    if (!('geolocation' in navigator)) return null;
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy || null,
            granted: true,
          });
        },
        err => {
          resolve({ error: err?.message || 'geo_denied', granted: false });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  function getDeviceId() {
    const KEY = 'pct_device_id_v1';
    let id = localStorage.getItem(KEY);
    if (!id) {
      // RFC4122-ish v4
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map(b => b.toString(16).padStart(2, '0'));
      id = `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10,16).join('')}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  }

  function makeInspectionId() {
    const ts = Date.now().toString(36);
    const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    return `insp_${ts}_${rand}`;
  }

  async function buildMeta() {
    const producto = qs('#productSelect')?.value || '';
    const now = new Date();
    const createdAtLocal = now.toISOString();
    const table = qs('table.inspection');
    let evaluation = '';
    const evRow = table ? findRowByParamContains(table, 'Evaluación') : null;
    if (evRow) {
      const active = evRow.cells[1].querySelector('.badge.active');
      evaluation = active ? active.textContent.trim() : '';
    }
    const geo = await getGeo();
    const deviceId = getDeviceId();
    const inspectionId = makeInspectionId();
    return { producto, createdAtLocal, evaluation, geo, deviceId, inspectionId };
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
    console.log('[init] app init');
    const table = qs('table.inspection');
    if (table) {
      setupBadges(table);
      enableContentEditing(table);
      restoreState();
      enhanceFocus(table);
      setupExport();
      setupSaveButton();
    }
    bindAuthButtons();
    setupNavbar();
    setHeaderDate();
  }

  // Ensure all late DOM (like overlay after scripts) exists before init bindings
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else if (document.readyState === 'interactive') {
    window.addEventListener('load', init);
  } else {
    // complete
    init();
  }
})();

