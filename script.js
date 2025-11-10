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

  async function ensureProductFromInventoryForSave(equipoActivo){
    try {
      const inv = await loadInventoryOnce();
      if (!inv || !Array.isArray(inv.headers) || !Array.isArray(inv.rows)) return;
      const idxEquipo = pickHeaderIndex(inv.headers, 'EQUIPO / ACTIVO');
      if (idxEquipo < 0) return;
      const match = inv.rows.find(r => normalizeText(r[idxEquipo]) === normalizeText(equipoActivo));
      if (!match) return;
      const { product: tipo, extras } = getProductAndTipos(inv.headers, match);
      if (tipo) setProductFromTipo(tipo);
      window._invLastMatch = { headers: inv.headers, row: match };
      window._invLastTipos = { tipo1: extras[0] || '', tipo2: extras[1] || '', tipo3: extras[2] || '' };
    } catch {}
  }

  function setupNavbar(){
    const badge = document.getElementById('userBadge');
    const nameEl = document.getElementById('userName');
    const loginBtn = document.getElementById('navLogin');
    function apply(u){
      if (u && (u.email || u.displayName)){
        if (badge) badge.style.display = 'inline-flex';
        if (nameEl) nameEl.textContent = u.displayName || u.email || 'Usuario';
        if (loginBtn) loginBtn.style.display = 'none';
      } else {
        if (badge) badge.style.display = 'none';
        if (loginBtn) loginBtn.style.display = '';
      }
      const userInfo = document.getElementById('userInfo');
      if (userInfo) userInfo.textContent = u ? (u.displayName || u.email || 'Usuario') : 'No autenticado';
    }
    apply(window.currentUser || null);
    window.addEventListener('auth:changed', (e)=>{ try { apply((e.detail||{}).user || null); } catch {} });
  }

  function bindAuthButtons(){
    const overlayLogin = document.getElementById('overlayLoginEmailBtn');
    const overlayReset = document.getElementById('overlayResetBtn');
    const emailEl = document.getElementById('authEmail');
    const passEl = document.getElementById('authPassword');
    if (overlayLogin) overlayLogin.addEventListener('click', async ()=>{
      try {
        const email = emailEl?.value || '';
        const pass = passEl?.value || '';
        const res = await (window.loginEmail ? window.loginEmail(email, pass) : Promise.resolve({ ok:false }));
        if (res?.ok) { document.body.classList.remove('locked'); }
      } catch {}
    });
    if (overlayReset) overlayReset.addEventListener('click', async ()=>{
      try { const email = emailEl?.value || ''; if (window.resetPassword && email) await window.resetPassword(email); } catch {}
    });
    window.addEventListener('auth:changed', (e)=>{
      const u = (e.detail||{}).user || null;
      if (u) { document.body.classList.remove('locked'); }
      else { /* keep page usable without forcing lock here */ }
    });
  }

  function collectTipos(headers, row){
    try {
      const tipos = [];
      for (let i = 0; i < headers.length; i++){
        const h = String(headers[i] || '').trim().toLowerCase();
        if (h === 'tipo' || /^tipo\s*\d+$/i.test(headers[i] || '')){
          const v = row[i];
          if (v != null && String(v).trim()) tipos.push(String(v).trim());
        }
      }
      return tipos;
    } catch { return []; }
  }

  function getProductAndTipos(headers, row){
    // Producto: preferir encabezado 'PRODUCTO', luego primer 'TIPO'; fallback: columna 5 (index 4)
    const idxProducto = pickHeaderIndex(headers, 'PRODUCTO');
    let product = '';
    let usedIdx = -1;
    if (idxProducto >= 0) { product = String(row[idxProducto] || '').trim(); usedIdx = idxProducto; }
    if (!product){
      for (let i = 0; i < headers.length; i++){
        const h = String(headers[i] || '').trim().toLowerCase();
        if (h === 'tipo'){ product = String(row[i] || '').trim(); usedIdx = i; break; }
      }
    }
    if (!product) { product = String(row[4] || '').trim(); usedIdx = 4; }
    // tipos extra: otros TIPO* distintos al usado como producto
    const extras = [];
    for (let i = 0; i < headers.length; i++){
      if (i === usedIdx) continue;
      const h = String(headers[i] || '').trim();
      if (/^tipo(\s*\d+)?$/i.test(h)){
        const v = String(row[i] || '').trim();
        if (v) extras.push(v);
      }
    }
    return { product, extras };
  }

  function ensureMariposaCauseBox(td){
    let box = td.querySelector('.detail-box');
    if (!box) { box = document.createElement('div'); box.className = 'detail-box'; td.appendChild(box); }
    const ta = box.querySelector('textarea.detail-input'); if (ta) ta.remove();
    let wrap = box.querySelector('.mariposa-cause-wrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.className = 'mariposa-cause-wrap';
      const label = document.createElement('label'); label.textContent = 'Causa:'; label.style.marginRight = '8px';
      const selWrap = document.createElement('span'); selWrap.className = 'select-pill';
      const sel = document.createElement('select'); sel.className = 'mariposa-cause';
      // Sin 'Golpe'
      ['Golpe', 'Deformación','Abrasión','Corrosión','Lavadura','Otro'].forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); });
      selWrap.appendChild(sel);
      const other = document.createElement('input'); other.type='text'; other.placeholder='Describe la causa'; other.className='input mariposa-cause-other'; other.style.marginLeft='8px'; other.style.minWidth='200px'; other.style.display='none';
      sel.addEventListener('change', ()=>{ other.style.display = (sel.value === 'Otro') ? '' : 'none'; saveStateThrottled(); });
      other.addEventListener('input', saveStateThrottled);
      wrap.appendChild(label); wrap.appendChild(selWrap); wrap.appendChild(other);
      box.appendChild(wrap);
    }
    return box;
  }

  function ensureCauseBox(td){
    return ensureRoscaCauseBox(td);
  }

  function ensureRetenedorCauseBox(td){
    let box = td.querySelector('.detail-box');
    if (!box) { box = document.createElement('div'); box.className = 'detail-box'; td.appendChild(box); }
    const ta = box.querySelector('textarea.detail-input'); if (ta) ta.remove();
    let wrap = box.querySelector('.retenedor-cause-wrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.className = 'retenedor-cause-wrap';
      const label = document.createElement('label'); label.textContent = 'Causa:'; label.style.marginRight = '8px';
      const selWrap = document.createElement('span'); selWrap.className = 'select-pill';
      const sel = document.createElement('select'); sel.className = 'retenedor-cause';
      ['Golpe','Deformación','Abrasión','Corrosión','Otro'].forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); });
      selWrap.appendChild(sel);
      const other = document.createElement('input'); other.type='text'; other.placeholder='Describe la causa'; other.className='input retenedor-cause-other'; other.style.marginLeft='8px'; other.style.minWidth='200px'; other.style.display='none';
      sel.addEventListener('change', ()=>{ other.style.display = (sel.value === 'Otro') ? '' : 'none'; saveStateThrottled(); });
      other.addEventListener('input', saveStateThrottled);
      wrap.appendChild(label); wrap.appendChild(selWrap); wrap.appendChild(other);
      box.appendChild(wrap);
    }
    return box;
  }

  async function populateEquipoDatalistFromInventory(){
    try {
      const dl = qs('#equipNumberList');
      if (!dl) return;
      const inv = await loadInventoryOnce();
      if (!inv || !Array.isArray(inv.headers) || !Array.isArray(inv.rows)) return;
      const idxEquipo = pickHeaderIndex(inv.headers, 'EQUIPO / ACTIVO');
      if (idxEquipo < 0) return;
      const set = new Set();
      for (const r of inv.rows){
        const v = String(r[idxEquipo] || '').trim();
        if (v) set.add(v);
      }
      const list = Array.from(set).sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
      dl.innerHTML = '';
      // Limitar a 1000 opciones para performance si fuera muy grande
      const MAX = 1000;
      let count = 0;
      for (const v of list){
        const opt = document.createElement('option');
        opt.value = v;
        dl.appendChild(opt);
        if (++count >= MAX) break;
      }
    } catch {}
  }

  function generateEquipNumberFor(productValue) {
    try {
      const prod = String(productValue || '').toLowerCase();
      const prefix = prod === 'codo' ? 'C' : (prod === 't1' ? 'T1' : (prod === 't2' ? 'T2' : 'EQ'));
      const now = new Date();
      const y = String(now.getFullYear()).slice(-2);
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const dayKey = `${now.getFullYear()}-${m}-${d}`;
      const seqKey = `equip_seq_${prefix}_${dayKey}`;
      let seq = parseInt(localStorage.getItem(seqKey) || '0', 10);
      seq = isNaN(seq) ? 1 : (seq + 1);
      localStorage.setItem(seqKey, String(seq));
      const seqStr = String(seq).padStart(3, '0');
      return `${prefix}-${y}${m}${d}-${seqStr}`;
    } catch {
      // Fallback: random
      return `EQ-${Math.floor(Math.random() * 1e6)}`;
    }
  }

  function setupEquipmentAuto() {
    const eqInput = document.getElementById('equipNumberInput');
    const eqAuto = document.getElementById('equipAutoCheckbox');
    const prodSel = document.getElementById('productSelect');
    if (!eqAuto || !eqInput) return;
    const maybeGenerate = () => {
      if (eqAuto.checked) {
        const num = generateEquipNumberFor(prodSel ? prodSel.value : '');
        eqInput.value = num;
        saveStateThrottled();
      }
    };
    eqAuto.addEventListener('change', () => {
      if (eqAuto.checked && (!eqInput.value || eqInput.value.trim() === '')) {
        maybeGenerate();
      } else {
        saveStateThrottled();
      }
    });
    if (prodSel) {
      prodSel.addEventListener('change', () => {
        if (eqAuto.checked) {
          maybeGenerate();
        }
      });
    }
    // If restored state has auto on but empty input, generate once
    setTimeout(() => {
      if (eqAuto.checked && (!eqInput.value || eqInput.value.trim() === '')) maybeGenerate();
    }, 0);
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
    // Presence indicator dots (only for admin): green=Director, cyan=Inspector, red=none
    let dotWrap = null, dotDir = null, dotIns = null, dotNone = null;
    function ensurePresenceDots(){
      if (!badge) return null;
      if (!dotWrap) {
        dotWrap = document.createElement('div');
        dotWrap.id = 'presenceDots';
        // Inline, placed to the LEFT of the badge
        dotWrap.style.position = 'static';
        dotWrap.style.transform = 'none';
        dotWrap.style.display = 'inline-flex';
        dotWrap.style.marginRight = '6px';
        dotWrap.style.gap = '3px';
        dotWrap.style.alignItems = 'center';
        dotWrap.style.justifyContent = 'center';
        dotWrap.style.flexDirection = 'column';
        dotWrap.style.padding = '0';
        // Create dots
        const makeDot = (color) => {
          const el = document.createElement('span');
          el.style.width = '9px';
          el.style.height = '9px';
          el.style.borderRadius = '999px';
          el.style.background = color;
          el.style.boxShadow = '0 0 0 2px #fff';
          el.style.display = 'none';
          return el;
        };
        dotDir = makeDot('#22c55e'); // green
        dotIns = makeDot('#0ea5e9'); // cyan
        dotNone = makeDot('#ef4444'); // red
        dotWrap.appendChild(dotDir);
        dotWrap.appendChild(dotIns);
        dotWrap.appendChild(dotNone);
        const parent = badge.parentElement;
        if (parent) {
          parent.insertBefore(dotWrap, badge);
        } else {
          // fallback: inside badge as first child
          badge.insertBefore(dotWrap, badge.firstChild);
        }
        // default: show red until summary arrives (only if admin, handled below)
        dotDir.style.display = 'none';
        dotIns.style.display = 'none';
        dotNone.style.display = 'inline-block';
      }
      return { dotWrap, dotDir, dotIns, dotNone };
    }
    function showDots(showDir, showIns){
      const dots = ensurePresenceDots(); if (!dots) return;
      const any = showDir || showIns;
      dots.dotWrap.style.display = 'inline-flex';
      dots.dotDir.style.display = showDir ? 'inline-block' : 'none';
      dots.dotIns.style.display = showIns ? 'inline-block' : 'none';
      dots.dotNone.style.display = any ? 'none' : '';
    }
    function hideDots(){ const dots = ensurePresenceDots(); if (!dots) return; dots.dotWrap.style.display = 'none'; }
    function updatePresenceIndicator(summary){
      try {
        const user = window.currentUser;
        const role = getUserRole(user);
        if (role !== 'Admin') { hideDots(); return; }
        const hasDirector = !!summary?.hasDirector;
        const hasInspector = !!summary?.hasInspector;
        showDots(hasDirector, hasInspector);
      } catch { hideDots(); }
    }
    // Create dots after helpers exist and set initial state
    try {
      ensurePresenceDots();
      const roleInit = getUserRole(window.currentUser);
      if (roleInit === 'Admin') {
        showDots(false, false); // default red
      } else {
        hideDots();
      }
    } catch {}
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
    // React to presence summary and auth changes
    window.addEventListener('presence:summary', (e) => updatePresenceIndicator(e.detail || {}));
    window.addEventListener('auth:changed', () => { setTimeout(() => updatePresenceIndicator({}), 50); });
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
      // Asegurar que si el usuario no salió del input, resolvemos Producto desde Inventario
      try {
        const prodEl = qs('#productDisplay');
        const eqVal = qs('#equipNumberInput')?.value?.trim() || '';
        const prodTxt = (prodEl?.textContent || '').trim();
        if (eqVal && (!prodTxt || prodTxt === '—')) {
          await ensureProductFromInventoryForSave(eqVal);
        }
      } catch {}
      // Apply auto rules before serializing
      applyAutoEvaluation(table);
      applyAutoDate(table);
      const data = serialize(table);
      // Build meta (time, evaluation, geo, producto)
      const meta = await buildMeta();
      data.meta = meta;
      // persist first
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      // Staging para InsLis si lecturas a Firestore están bloqueadas
      try { localStorage.setItem('pct_lastSavedInspectionTemp', JSON.stringify({ id: `local-${Date.now()}`, origin: 'local', ...data })); } catch {}
      // Forzar evaluación automática antes de serializar y guardar
      try { applyAutoEvaluation(table); } catch {}
      // try remote save (optional)
      let remoteMsg = '';
      if (typeof window.saveInspection === 'function') {
        console.log('[ui] script.js loaded');
        try {
          const res = await window.saveInspection(data);
          if (res?.ok) {
            remoteMsg = res.itemId ? ` • Firestore: ${res.itemId}` : ' • Firestore ok';
            // Navegar a la lista de inspecciones para ver el registro
            setTimeout(() => { try { window.location.href = 'inslis.html'; } catch {} }, 600);
          } else {
            remoteMsg = ' • Firestore: fallo';
          }
        } catch (e) {
          remoteMsg = ' • Firestore: sin conexión';
        }
      }
      // feedback
      btn.textContent = `Guardado ✓${remoteMsg}`;
      setTimeout(() => { btn.textContent = 'Guardar'; }, 1400);
    });
    // Restaurar tipo de inspección
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.tipoInspeccion === 'string') setTipoInspeccionSelected(parsed.tipoInspeccion);
      }
    } catch {}
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
      // Insert row at the end (después del texto del parámetro)
      td.appendChild(row);
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

  function ensureRoscaCauseBox(td){
    let box = td.querySelector('.detail-box');
    if (!box) { box = document.createElement('div'); box.className = 'detail-box'; td.appendChild(box); }
    // clear default textarea if present for this special row
    const ta = box.querySelector('textarea.detail-input'); if (ta) ta.remove();
    let wrap = box.querySelector('.rosca-cause-wrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.className = 'rosca-cause-wrap';
      const label = document.createElement('label'); label.textContent = 'Causa:'; label.style.marginRight = '8px';
      const selWrap = document.createElement('span'); selWrap.className = 'select-pill';
      const sel = document.createElement('select'); sel.className = 'rosca-cause';
      ['Golpe','Deformación','Abrasión','Corrosión','Lavadura','Otro'].forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); });
      selWrap.appendChild(sel);
      const other = document.createElement('input'); other.type='text'; other.placeholder='Describe la causa'; other.className='input rosca-cause-other'; other.style.marginLeft='8px'; other.style.minWidth='200px'; other.style.display='none';
      sel.addEventListener('change', ()=>{ other.style.display = (sel.value === 'Otro') ? '' : 'none'; saveStateThrottled(); });
      other.addEventListener('input', saveStateThrottled);
      wrap.appendChild(label); wrap.appendChild(selWrap); wrap.appendChild(other);
      box.appendChild(wrap);
    }
    return box;
  }

  function handleDetailArea(td, activeBadge) {
    const label = activeBadge?.textContent.trim();
    if (label === 'Malo') {
      const rowParam = td?.closest('tr')?.cells?.[1]?.textContent?.trim() || '';
      const rp = rowParam.toLowerCase();
      const isRosca = rp.includes('rosca') && rp.includes('hembra');
      const isSellado = /área\s*de\s*sellado|area\s*de\s*sellado/i.test(rp);
      const isCuerpo = /cuerpo/i.test(rp);
      const isRetenedor = /retenedor/i.test(rp);
      const isInsertos = /insertos?/i.test(rp);
      const isMariposa = /mariposa/i.test(rp);
      const isPinon = /piñón|pinon/i.test(rp);
      if (isRetenedor || isInsertos){
        const box = ensureRetenedorCauseBox(td);
        box.style.display = '';
        const sel = box.querySelector('select.retenedor-cause'); if (sel) sel.focus({ preventScroll: true });
      } else if (isMariposa || isPinon){
        const box = ensureMariposaCauseBox(td);
        box.style.display = '';
        const sel = box.querySelector('select.mariposa-cause'); if (sel) sel.focus({ preventScroll: true });
      } else if (isRosca || isSellado || isCuerpo){
        const box = ensureCauseBox(td);
        box.style.display = '';
        const sel = box.querySelector('select.rosca-cause'); if (sel) sel.focus({ preventScroll: true });
      } else {
        const box = ensureDetailBox(td);
        box.style.display = '';
        const ta = box.querySelector('textarea');
        if (ta) ta.focus({ preventScroll: true });
      }
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
      // Capture inputs inside the parameter cell (e.g., manual fields like Número de Equipo)
      try {
        const paramTd = cells[1];
        if (paramTd) {
          const eqInput = paramTd.querySelector('#equipNumberInput');
          const eqAuto = paramTd.querySelector('#equipAutoCheckbox');
          if (eqInput) rowObj.__equipNumber = eqInput.value ?? '';
          if (eqAuto) rowObj.__equipAuto = eqAuto.checked ? 'true' : 'false';
          // Rosca / Hembra causa
          const paramText = paramTd.textContent || '';
          if (/rosca\s*\/\s*hembra/i.test(paramText)){
            const causeSel = paramTd.querySelector('select.rosca-cause');
            const causeOther = paramTd.querySelector('input.rosca-cause-other');
            if (causeSel) rowObj.__rosca_causa = causeSel.value || '';
            if (causeOther) rowObj.__rosca_otro = causeOther.value || '';
          }
          // Área de Sellado causa
          if (/área\s*de\s*sellado|area\s*de\s*sellado/i.test(paramText)){
            const causeSel = paramTd.querySelector('select.rosca-cause');
            const causeOther = paramTd.querySelector('input.rosca-cause-other');
            if (causeSel) rowObj.__sellado_causa = causeSel.value || '';
            if (causeOther) rowObj.__sellado_otro = causeOther.value || '';
          }
          // Cuerpo causa
          if (/cuerpo/i.test(paramText)){
            const causeSel = paramTd.querySelector('select.rosca-cause');
            const causeOther = paramTd.querySelector('input.rosca-cause-other');
            if (causeSel) rowObj.__cuerpo_causa = causeSel.value || '';
            if (causeOther) rowObj.__cuerpo_otro = causeOther.value || '';
          }
          // Retenedor causa
          if (/retenedor/i.test(paramText)){
            const causeSel = paramTd.querySelector('select.retenedor-cause');
            const causeOther = paramTd.querySelector('input.retenedor-cause-other');
            if (causeSel) rowObj.__retenedor_causa = causeSel.value || '';
            if (causeOther) rowObj.__retenedor_otro = causeOther.value || '';
          }
          // Insertos causa
          if (/insertos?/i.test(paramText)){
            const causeSel = paramTd.querySelector('select.retenedor-cause');
            const causeOther = paramTd.querySelector('input.retenedor-cause-other');
            if (causeSel) rowObj.__insertos_causa = causeSel.value || '';
            if (causeOther) rowObj.__insertos_otro = causeOther.value || '';
          }
          // Mariposa causa
          if (/mariposa/i.test(paramText)){
            const causeSel = paramTd.querySelector('select.mariposa-cause');
            const causeOther = paramTd.querySelector('input.mariposa-cause-other');
            if (causeSel) rowObj.__mariposa_causa = causeSel.value || '';
            if (causeOther) rowObj.__mariposa_otro = causeOther.value || '';
          }
          // Piñón causa (mismas opciones que Mariposa)
          if (/piñón|pinon/i.test(paramText)){
            const causeSel = paramTd.querySelector('select.mariposa-cause');
            const causeOther = paramTd.querySelector('input.mariposa-cause-other');
            if (causeSel) rowObj.__pinon_causa = causeSel.value || '';
            if (causeOther) rowObj.__pinon_otro = causeOther.value || '';
          }
          // Fallback: capture first control generically (legacy support)
          if (!eqInput && !eqAuto) {
            const ctrl = paramTd.querySelector('input, textarea, select');
            if (ctrl) {
              rowObj.__input = (ctrl.type === 'checkbox') ? (ctrl.checked ? 'true' : 'false') : (ctrl.value ?? '');
            }
          }
        }
      } catch {}
      // values per remaining cols
      for (let i = 2; i < cells.length; i++) {
        const label = colLabels[i - 2] || `Col${i-1}`;
        const td = cells[i];
        const active = td.querySelector('.badge.active');
        let value = '';
        if (active) {
          value = active.textContent.trim();
        } else {
          // Prefer control values if present
          const ctrl = td.querySelector('input, textarea, select');
          if (ctrl) {
            value = (ctrl.type === 'checkbox') ? (ctrl.checked ? 'true' : 'false') : (ctrl.value ?? '');
          } else if (isEditableCell(td)) {
            value = td.textContent.trim();
          } else {
            // non-editable without badges -> raw text
            value = td.textContent.trim();
          }
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
    const rows = Array.from(table.tBodies[0].rows);
    let trEval = findRowByParamContains(table, 'Evaluación');
    const badPoints = [];
    for (const tr of rows) {
      if (tr === trEval) break;
      const tdParam = tr.cells[1];
      if (!tdParam) continue;
      const badges = Array.from(tdParam.querySelectorAll('.badge'));
      // Evalúa filas con opciones de estado (Bueno/Malo/No Aplica)
      const texts = badges.map(b => b.textContent.trim().toLowerCase());
      const isEvaluable = texts.includes('bueno') || texts.includes('malo') || texts.includes('no aplica');
      if (!isEvaluable) continue;
      const active = tdParam.querySelector('.badge.active');
      const sel = (active ? active.textContent.trim().toLowerCase() : '');
      const isAcceptable = (sel === 'bueno') || (sel === 'no aplica');
      if (!isAcceptable) {
        const idx = (tr.cells[0]?.textContent || '').trim();
        const name = (tdParam.childNodes[0]?.textContent || tdParam.textContent || '').trim();
        // Determinar causa/detalle
        let detail = '';
        const text = name.toLowerCase();
        // Rosca/Hembra, Área de Sellado, Cuerpo comparten 'rosca-cause'
        if (/rosca|hembra|sellado|cuerpo/.test(text)){
          const sel = tdParam.querySelector('select.rosca-cause');
          const other = tdParam.querySelector('input.rosca-cause-other');
          if (sel) detail = sel.value || '';
          if (detail === 'Otro' && other && other.value) detail = `Otro: ${other.value}`;
        }
        // Retenedor / Insertos
        else if (/retenedor|insertos?/.test(text)){
          const sel = tdParam.querySelector('select.retenedor-cause');
          const other = tdParam.querySelector('input.retenedor-cause-other');
          if (sel) detail = sel.value || '';
          if (detail === 'Otro' && other && other.value) detail = `Otro: ${other.value}`;
        }
        // Mariposa / Piñón
        else if (/mariposa|piñ[oó]n|pinon/.test(text)){
          const sel = tdParam.querySelector('select.mariposa-cause');
          const other = tdParam.querySelector('input.mariposa-cause-other');
          if (sel) detail = sel.value || '';
          if (detail === 'Otro' && other && other.value) detail = `Otro: ${other.value}`;
        }
        // Elastómero u otros con múltiples estados: usar el badge activo como detalle
        if (!detail) {
          detail = active ? active.textContent.trim() : '';
        }
        badPoints.push({ idx, name, detail });
      }
    }
    const result = badPoints.length ? 'Rechazado' : 'Aceptado';
    if (trEval) {
      const td = trEval.cells[1];
      const badges = td ? Array.from(td.querySelectorAll('.badge')) : [];
      badges.forEach(x => x.classList.toggle('active', x.textContent.trim() === result));
      let box = td.querySelector('.detail-box');
      if (!box) { box = document.createElement('div'); box.className = 'detail-box'; td.appendChild(box); }
      if (badPoints.length) {
        const list = document.createElement('ul');
        list.style.paddingLeft = '16px';
        list.style.margin = '6px 0 0 0';
        list.style.color = 'var(--text-200)';
        box.innerHTML = '';
        const title = document.createElement('div');
        title.textContent = 'Puntos que afectan:';
        title.style.fontWeight = '600';
        title.style.marginBottom = '4px';
        box.appendChild(title);
        badPoints.forEach(p => {
          const li = document.createElement('li');
          const det = p.detail ? ` — ${p.detail}` : '';
          li.textContent = `#${p.idx} · ${p.name}${det}`;
          list.appendChild(li);
        });
        box.appendChild(list);
        box.style.display = '';
      } else {
        if (box) { box.innerHTML = ''; box.style.display = 'none'; }
      }
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

  function currentUserInfo(){
    try {
      const u = window.currentUser || null;
      if (!u) return null;
      return {
        uid: u.uid,
        email: u.email || null,
        displayName: u.displayName || null,
      };
    } catch { return null; }
  }

  function makeInspectionId() {
    const ts = Date.now().toString(36);
    const rand = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
    return `insp_${ts}_${rand}`;
  }

  async function buildMeta() {
    const producto = (qs('#productDisplay')?.textContent || '').trim();
    const now = new Date();
    const createdAtLocal = now.toISOString();
    const table = qs('table.inspection');
    let evaluation = '';
    const evRow = table ? findRowByParamContains(table, 'Evaluación') : null;
    if (evRow) {
      const active = evRow.cells[1].querySelector('.badge.active');
      evaluation = active ? active.textContent.trim() : '';
    }
    const tipoInspeccion = getTipoInspeccionSelected();
    const equipoActivo = qs('#equipNumberInput')?.value?.trim() || '';
    const inv = window._invLastMatch || null;
    const geo = await getGeo();
    const deviceId = getDeviceId();
    const inspectionId = makeInspectionId();
    const meta = {
      inspectionId: makeInspectionId(),
      createdAtLocal,
      product: producto,
      producto,
      evaluation,
      tipoInspeccion,
      equipoActivo,
      user: currentUserInfo(),
    };
    // Adjuntar tipos adicionales del inventario si existen
    if (window._invLastTipos) {
      const { tipo1, tipo2, tipo3 } = window._invLastTipos;
      if (tipo1) meta.tipo1 = tipo1;
      if (tipo2) meta.tipo2 = tipo2;
      if (tipo3) meta.tipo3 = tipo3;
    }
    return { ...meta, inv, geo, deviceId, inspectionId };
  }

  function saveState() {
    try {
      const table = qs('table.inspection');
      if (!table) return;
      const data = serialize(table);
      data.tipoInspeccion = getTipoInspeccionSelected();
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
      // Restore control in parameter cell if present
      try {
        const paramTd = tds[1];
        if (paramTd) {
          const eqInput = paramTd.querySelector('#equipNumberInput');
          const eqAuto = paramTd.querySelector('#equipAutoCheckbox');
          if (eqInput && r.hasOwnProperty('__equipNumber')) eqInput.value = r.__equipNumber ?? '';
          if (eqAuto && r.hasOwnProperty('__equipAuto')) eqAuto.checked = (String(r.__equipAuto).toLowerCase() === 'true');
          // Rosca / Hembra restaura
          const paramText = paramTd.textContent || '';
          if (/rosca\s*\/\s*hembra/i.test(paramText)){
            const box = ensureCauseBox(paramTd);
            const sel = box.querySelector('select.rosca-cause');
            const other = box.querySelector('input.rosca-cause-other');
            if (sel && r.hasOwnProperty('__rosca_causa')) sel.value = r.__rosca_causa || sel.value;
            if (other) {
              const isOtro = (sel?.value === 'Otro') || (r.__rosca_causa === 'Otro');
              other.style.display = isOtro ? '' : 'none';
              if (r.hasOwnProperty('__rosca_otro')) other.value = r.__rosca_otro || '';
            }
          }
          // Área de Sellado restaura
          if (/área\s*de\s*sellado|area\s*de\s*sellado/i.test(paramText)){
            const box = ensureCauseBox(paramTd);
            const sel = box.querySelector('select.rosca-cause');
            const other = box.querySelector('input.rosca-cause-other');
            if (sel && r.hasOwnProperty('__sellado_causa')) sel.value = r.__sellado_causa || sel.value;
            if (other) {
              const isOtro = (sel?.value === 'Otro') || (r.__sellado_causa === 'Otro');
              other.style.display = isOtro ? '' : 'none';
              if (r.hasOwnProperty('__sellado_otro')) other.value = r.__sellado_otro || '';
            }
          }
          // Cuerpo restaura
          if (/cuerpo/i.test(paramText)){
            const box = ensureCauseBox(paramTd);
            const sel = box.querySelector('select.rosca-cause');
            const other = box.querySelector('input.rosca-cause-other');
            if (sel && r.hasOwnProperty('__cuerpo_causa')) sel.value = r.__cuerpo_causa || sel.value;
            if (other) {
              const isOtro = (sel?.value === 'Otro') || (r.__cuerpo_causa === 'Otro');
              other.style.display = isOtro ? '' : 'none';
              if (r.hasOwnProperty('__cuerpo_otro')) other.value = r.__cuerpo_otro || '';
            }
          }
          // Retenedor restaura
          if (/retenedor/i.test(paramText)){
            const box = ensureRetenedorCauseBox(paramTd);
            const sel = box.querySelector('select.retenedor-cause');
            const other = box.querySelector('input.retenedor-cause-other');
            if (sel && r.hasOwnProperty('__retenedor_causa')) sel.value = r.__retenedor_causa || sel.value;
            if (other) {
              const isOtro = (sel?.value === 'Otro') || (r.__retenedor_causa === 'Otro');
              other.style.display = isOtro ? '' : 'none';
              if (r.hasOwnProperty('__retenedor_otro')) other.value = r.__retenedor_otro || '';
            }
          }
          // Insertos restaura
          if (/insertos?/i.test(paramText)){
            const box = ensureRetenedorCauseBox(paramTd);
            const sel = box.querySelector('select.retenedor-cause');
            const other = box.querySelector('input.retenedor-cause-other');
            if (sel && r.hasOwnProperty('__insertos_causa')) sel.value = r.__insertos_causa || sel.value;
            if (other) {
              const isOtro = (sel?.value === 'Otro') || (r.__insertos_causa === 'Otro');
              other.style.display = isOtro ? '' : 'none';
              if (r.hasOwnProperty('__insertos_otro')) other.value = r.__insertos_otro || '';
            }
          }
          // Mariposa restaura
          if (/mariposa/i.test(paramText)){
            const box = ensureMariposaCauseBox(paramTd);
            const sel = box.querySelector('select.mariposa-cause');
            const other = box.querySelector('input.mariposa-cause-other');
            if (sel && r.hasOwnProperty('__mariposa_causa')) sel.value = r.__mariposa_causa || sel.value;
            if (other) {
              const isOtro = (sel?.value === 'Otro') || (r.__mariposa_causa === 'Otro');
              other.style.display = isOtro ? '' : 'none';
              if (r.hasOwnProperty('__mariposa_otro')) other.value = r.__mariposa_otro || '';
            }
          }
          // Piñón restaura
          if (/piñón|pinon/i.test(paramText)){
            const box = ensureMariposaCauseBox(paramTd);
            const sel = box.querySelector('select.mariposa-cause');
            const other = box.querySelector('input.mariposa-cause-other');
            if (sel && r.hasOwnProperty('__pinon_causa')) sel.value = r.__pinon_causa || sel.value;
            if (other) {
              const isOtro = (sel?.value === 'Otro') || (r.__pinon_causa === 'Otro');
              other.style.display = isOtro ? '' : 'none';
              if (r.hasOwnProperty('__pinon_otro')) other.value = r.__pinon_otro || '';
            }
          }
          // Legacy fallback
          if (!r.hasOwnProperty('__equipNumber') && r.hasOwnProperty('__input') && eqInput) eqInput.value = r.__input ?? '';
        }
      } catch {}
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
        } else {
          const ctrl = td.querySelector('input, textarea, select');
          if (ctrl) {
            if (ctrl.type === "checkbox") ctrl.checked = (String(val).toLowerCase() === 'true');
            else ctrl.value = val;
          } else if (isEditableCell(td)) {
            td.textContent = String(val);
          }
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

  function setupControls(table) {
    // Ensure any inputs/selects/textareas within the table persist on change
    qsa('input, textarea, select', table).forEach(ctrl => {
      const handler = () => saveStateThrottled();
      ctrl.addEventListener('input', handler);
      ctrl.addEventListener('change', handler);
      // For checkboxes/radios ensure change is captured
      ctrl.addEventListener('click', handler);
    });
    // Delegate in case dynamic controls are added later
    table.addEventListener('input', (e) => {
      if (e.target && (e.target.matches('input, textarea, select'))) saveStateThrottled();
    });
    table.addEventListener('change', (e) => {
      if (e.target && (e.target.matches('input, textarea, select'))) saveStateThrottled();
    });
  }

  function getTipoInspeccionSelected() {
    try {
      const pre = qs('#tipoPre');
      const post = qs('#tipoPost');
      const recep = qs('#tipoRecep');
      if (pre?.checked) return 'Pre-Trabajo';
      if (post?.checked) return 'Post-trabajo';
      if (recep?.checked) return 'Recepción';
      return '';
    } catch { return ''; }
  }

  function setTipoInspeccionSelected(value) {
    try {
      const v = String(value || '').toLowerCase();
      const pre = qs('#tipoPre');
      const post = qs('#tipoPost');
      const recep = qs('#tipoRecep');
      if (pre) pre.checked = (v === 'pre-trabajo');
      if (post) post.checked = (v === 'post-trabajo');
      if (recep) recep.checked = (v === 'recepción');
    } catch {}
  }

  function setupTipoInspeccion() {
    const group = qs('#tipoInspeccionGroup');
    if (!group) return;
    const inputs = [qs('#tipoPre'), qs('#tipoPost'), qs('#tipoRecep')].filter(Boolean);
    const enforceSingle = (target) => {
      inputs.forEach(inp => { if (inp !== target) inp.checked = false; });
      if (!inputs.some(i => i.checked) && target) target.checked = true;
      saveStateThrottled();
    };
    inputs.forEach(inp => {
      inp.addEventListener('change', (e) => enforceSingle(e.currentTarget));
      inp.addEventListener('click', (e) => enforceSingle(e.currentTarget));
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enforceSingle(e.currentTarget); }
      });
    });
  }

  function detectDelimiter(sample){
    try {
      const line = (sample.replace(/\r\n?/g,'\n').split('\n').find(l=>l.trim().length>0)) || '';
      const cands = [',',';','\t','|'];
      let best = { d: ',', n: 0 };
      for (const d of cands){ const n = (line.split(d).length - 1); if (n > best.n) best = { d, n }; }
      return best.d === '\t' ? '\t' : best.d;
    } catch { return ','; }
  }

  function parseCSV(text){
    const delim = detectDelimiter(text);
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.length > 0);
    const rows = [];
    for (const line of lines){
      const out = []; let cur=''; let inQ=false;
      for (let i=0;i<line.length;i++){
        const ch = line[i];
        if (ch==='\"'){
          if (inQ && line[i+1]==='\"'){ cur+='\"'; i++; }
          else { inQ = !inQ; }
        } else if (!inQ && ch === (delim==='\t' ? '\t' : delim)){
          out.push(cur); cur='';
        } else { cur+=ch; }
      }
      out.push(cur);
      rows.push(out);
    }
    const headers = rows.shift() || [];
    return { headers, rows };
  }

  let invCache = null;
  async function loadInventoryOnce(){
    if (invCache) return invCache;
    try {
      const res = await fetch('./invsistejm.csv', { cache: 'no-cache' });
      if (!res.ok) return null;
      const text = await res.text();
      invCache = parseCSV(text);
      return invCache;
    } catch { return null; }
  }

  function pickHeaderIndex(headers, name){
    const idx = headers.findIndex(h => String(h).trim().toLowerCase() === String(name).trim().toLowerCase());
    return idx;
  }

  function setProductFromTipo(tipo){
    try {
      const el = qs('#productDisplay');
      if (!el) return;
      const val = String(tipo || '').trim();
      if (!val) return;
      el.textContent = val;
    } catch {}
  }

  function parseNumber(val){
    try {
      const s = String(val ?? '').replace(',', '.');
      const m = s.match(/[-+]?[0-9]*\.?[0-9]+/);
      return m ? parseFloat(m[0]) : NaN;
    } catch { return NaN; }
  }

  function setDiametroValue(value){
    try {
      const table = qs('table.inspection');
      const tr = table ? findRowByParamContains(table, 'Diámetro') : null;
      if (!tr) return;
      const td = tr.cells[1];
      const inp = td ? td.querySelector('input[type="number"]') : null;
      if (!inp) return;
      let num = parseNumber(value);
      if (isNaN(num)) { setNAIndicator(td, true); inp.value = ''; return; }
      // Heurística: si parece cm grande, convertir a pulgadas
      if (num > 20) { num = num / 2.54; }
      inp.value = String(+num.toFixed(2));
      setNAIndicator(td, false);
    } catch {}
  }

  function setSerialFromValue(value){
    try {
      const table = qs('table.inspection');
      const tr = table ? findRowByParamContains(table, 'Serial') : null;
      if (!tr) return;
      const td = tr.cells[1];
      const badges = td ? Array.from(td.querySelectorAll('.badge')) : [];
      const hasSerial = !!String(value || '').trim();
      badges.forEach(x => x.classList.toggle('active', x.textContent.trim().toLowerCase() === (hasSerial ? 'visible' : 'no visible')));
      // Mostrar valor del serial cuando sea Visible
      let pill = td.querySelector('.serial-value');
      if (hasSerial) {
        if (!pill) { pill = document.createElement('span'); pill.className = 'pill serial-value'; td.appendChild(pill); }
        pill.textContent = `Serial: ${String(value).trim()}`;
        pill.style.display = '';
      } else {
        if (pill) pill.remove();
      }
    } catch {}
  }

  function setFiguraBadge(text){
    try {
      const table = qs('table.inspection');
      const tr = table ? findRowByParamContains(table, 'Figura') : null;
      if (!tr) return;
      const td = tr.cells[1];
      let badge = td.querySelector('.badge');
      if (!badge) { badge = document.createElement('span'); badge.className = 'badge'; td.insertBefore(badge, td.firstChild); }
      const val = String(text || '').trim();
      badge.textContent = val || 'N/A';
    } catch {}
  }

  function setLongitudFt(value){
    try {
      const table = qs('table.inspection');
      const tr = table ? findRowByParamContains(table, 'Longitud') : null;
      if (!tr) return;
      const td = tr.cells[1];
      const inp = td ? td.querySelector('input[type="number"]') : null;
      if (!inp) return;
      let num = parseNumber(value);
      if (isNaN(num)) { setNAIndicator(td, true); inp.value = ''; return; }
      // Heurística: si parece cm (>20), convertir a pies
      if (num > 20) { num = num / 30.48; }
      inp.value = String(+num.toFixed(2));
      setNAIndicator(td, false);
    } catch {}
  }

  function setNAIndicator(td, show){
    try {
      if (!td) return;
      let na = td.querySelector('.na-ind');
      if (show) {
        if (!na) { na = document.createElement('span'); na.className = 'badge na-ind'; na.textContent = 'N/A'; td.appendChild(na); }
      } else {
        if (na) na.remove();
      }
    } catch {}
  }

  function setDefaultsBueno(){
    try {
      const table = qs('table.inspection');
      if (!table) return;
      const rows = Array.from(table.tBodies[0].rows);
      for (const tr of rows){
        const td = tr.cells?.[1];
        if (!td) continue;
        if (/evaluaci[oó]n/i.test(td.textContent || '')) break;
        const badges = Array.from(td.querySelectorAll('.badge'));
        const bueno = badges.find(b => b.textContent.trim().toLowerCase() === 'bueno');
        if (bueno) {
          badges.forEach(b => b.classList.toggle('active', b === bueno));
          // Oculta causas al quedar en 'Bueno'
          updateCauseVisibility(td);
        }
      }
      applyAutoEvaluation(table);
    } catch {}
  }

  function updateCauseVisibility(paramTd){
    try {
      const txt = (paramTd?.textContent || '').toLowerCase();
      const active = paramTd?.querySelector('.badge.active');
      const isMalo = !!active && active.textContent.trim().toLowerCase() === 'malo';
      if (/rosca|hembra|sellado|cuerpo/.test(txt)){
        const box = typeof ensureCauseBox === 'function' ? ensureCauseBox(paramTd) : paramTd.querySelector('.detail-box');
        if (box) box.style.display = isMalo ? '' : 'none';
      } else if (/retenedor|insertos?/.test(txt)){
        const box = typeof ensureRetenedorCauseBox === 'function' ? ensureRetenedorCauseBox(paramTd) : paramTd.querySelector('.detail-box');
        if (box) box.style.display = isMalo ? '' : 'none';
      } else if (/mariposa|piñ[oó]n|pinon/.test(txt)){
        const box = typeof ensureMariposaCauseBox === 'function' ? ensureMariposaCauseBox(paramTd) : paramTd.querySelector('.detail-box');
        if (box) box.style.display = isMalo ? '' : 'none';
      }
    } catch {}
  }

  function normalizeText(s){ return String(s || '').trim().toLowerCase(); }

  async function populateProductTypesFromInventory(){
    try {
      const sel = qs('#productSelect');
      if (!sel) return;
      const inv = await loadInventoryOnce();
      if (!inv || !Array.isArray(inv.headers) || !Array.isArray(inv.rows)) {
        toast('No se pudo cargar inventario');
        // retry once shortly after
        setTimeout(() => { if (!invCache) populateProductTypesFromInventory(); }, 1000);
        return;
      }
      const idxTipo = pickHeaderIndex(inv.headers, 'TIPO');
      if (idxTipo < 0) { toast('No se encontró columna TIPO en inventario'); return; }
      const current = sel.value;
      const set = new Set();
      for (const r of inv.rows){
        const t = String(r[idxTipo] || '').trim();
        if (t) set.add(t);
      }
      const list = Array.from(set).sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
      if (!list.length) { toast('Inventario sin tipos'); return; }
      // Preserve a placeholder if present; otherwise clear and rebuild
      const placeholder = Array.from(sel.options).find(o => !o.value);
      sel.innerHTML = '';
      if (placeholder){
        const ph = document.createElement('option');
        ph.value = '';
        ph.textContent = placeholder.textContent || 'Selecciona tipo';
        sel.appendChild(ph);
      }
      for (const t of list){
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t; sel.appendChild(opt);
      }
      if (current && list.includes(current)) sel.value = current;
      toast(`Tipos cargados: ${list.length}`);
    } catch {}
  }

  function setupInventoryLookup(){
    const input = qs('#equipNumberInput');
    if (!input) return;
    input.addEventListener('blur', () => lookupEquipoActivoAndAutofill());
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); lookupEquipoActivoAndAutofill(); }});
    input.addEventListener('change', () => lookupEquipoActivoAndAutofill());
  }

  async function lookupEquipoActivoAndAutofill(){
    const input = qs('#equipNumberInput');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    const inv = await loadInventoryOnce();
    if (!inv || !Array.isArray(inv.headers) || !Array.isArray(inv.rows)) return;
    const idxEquipo = pickHeaderIndex(inv.headers, 'EQUIPO / ACTIVO');
    const idxDiam = pickHeaderIndex(inv.headers, 'DIAMETRO');
    const idxSerial = pickHeaderIndex(inv.headers, 'SERIAL');
    const idxLong = pickHeaderIndex(inv.headers, 'LONGITUD');
    const idxFig = pickHeaderIndex(inv.headers, 'FIGURA');
    if (idxEquipo < 0) return;
    const matches = inv.rows.filter(r => normalizeText(r[idxEquipo]) === normalizeText(val));
    if (matches.length === 1){
      const row = matches[0];
      const { product: tipo, extras } = getProductAndTipos(inv.headers, row);
      const diam = idxDiam >= 0 ? row[idxDiam] : '';
      const serial = idxSerial >= 0 ? row[idxSerial] : '';
      const longv = idxLong >= 0 ? row[idxLong] : '';
      const fig = idxFig >= 0 ? row[idxFig] : '';
      setProductFromTipo(tipo || '');
      setDiametroValue(diam || null);
      setFiguraBadge(fig || '');
      setLongitudFt(longv || null);
      setSerialFromValue(serial || '');
      // Defaults: marcar 'Bueno' en todas las filas que tienen esa opción
      setDefaultsBueno();
      window._invLastMatch = { headers: inv.headers, row };
      window._invLastTipos = { tipo1: extras[0] || '', tipo2: extras[1] || '', tipo3: extras[2] || '' };
      toast('Equipo encontrado');
      saveStateThrottled();
    } else {
      toast('Equipo no encontrado');
    }
  }

  function init() {
    console.log('[init] app init');
    const table = qs('table.inspection');
    if (table) {
      setupBadges(table);
      enableContentEditing(table);
      setupControls(table);
      setupTipoInspeccion();
      populateEquipoDatalistFromInventory();
      const equipInp = qs('#equipNumberInput');
      if (equipInp) {
        equipInp.addEventListener('focus', () => { if (!invCache) populateEquipoDatalistFromInventory(); });
        equipInp.addEventListener('input', () => { /* el datalist filtra por el navegador */ });
      }
      setupInventoryLookup();
      restoreState();
      setupEquipmentAuto();
      enhanceFocus(table);
      setupExport();
      setupSaveButton();
      // Enforce auto-evaluation: recalc on any badge click and lock row 20
      table.addEventListener('click', (e) => {
        const badge = e.target.closest('.badge');
        if (!badge) return;
        const td = badge.closest('td');
        const isEval = td && /evaluaci[oó]n/i.test(td.textContent || '');
        if (isEval) {
          e.preventDefault();
          e.stopPropagation();
          applyAutoEvaluation(table);
          return false;
        }
        // Defer apply to allow badge state update by existing handlers
        setTimeout(() => { try { applyAutoEvaluation(table); } catch {} }, 0);
      }, true);
      // Initial compute
      try { applyAutoEvaluation(table); } catch {}
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

