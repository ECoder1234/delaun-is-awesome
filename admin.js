// admin mode: type "awesome" anywhere (lowercase) to open a small panel
// that can beat or skip levels and edit the text on the page.
(() => {
  const LAST = 25;
  const SECRET = 'awesome';
  const KEY_ON = 'admin-mode';
  const KEY_TEXT = 'admin-text:' + location.pathname;

  const store = {
    get(s, k) { try { return window[s].getItem(k); } catch (e) { return null; } },
    set(s, k, v) { try { window[s].setItem(k, v); } catch (e) {} },
    del(s, k) { try { window[s].removeItem(k); } catch (e) {} },
  };

  const m = location.pathname.match(/level(\d+)\.html$/);
  const LEVEL = m ? +m[1] : 1;
  const pageFor = n => (n <= 1 || n > LAST ? 'index.html' : `level${n}.html`);

  // ---- saved text edits (only elements you actually typed into) ----------
  const SKIP = 'script,style,button,input,textarea,select,canvas,svg,option';
  function editableEls() {
    return [...document.body.querySelectorAll('*')].filter(el =>
      !el.closest('#admin-panel') && !el.closest(SKIP) &&
      [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  }
  function pathOf(el) {
    const parts = [];
    while (el && el !== document.body && el.parentElement) {
      parts.unshift(el.tagName.toLowerCase() + ':nth-child(' + ([...el.parentElement.children].indexOf(el) + 1) + ')');
      el = el.parentElement;
    }
    return 'body>' + parts.join('>');
  }
  function loadEdits() { try { return JSON.parse(store.get('localStorage', KEY_TEXT)) || {}; } catch (e) { return {}; } }
  const dirty = new Set();
  function saveText() {
    if (!dirty.size) return;
    const edits = loadEdits();
    dirty.forEach(el => { if (el.isConnected) edits[pathOf(el)] = el.innerHTML; });
    dirty.clear();
    store.set('localStorage', KEY_TEXT, JSON.stringify(edits));
  }
  function applyText() {
    const edits = loadEdits();
    for (const path in edits) {
      try { const el = document.querySelector(path); if (el) el.innerHTML = edits[path]; } catch (e) {}
    }
  }
  document.addEventListener('input', e => {
    const host = e.target.closest && e.target.closest('[data-admin-edit]');
    if (host) {
      let top = host;
      while (top.parentElement && top.parentElement.hasAttribute('data-admin-edit')) top = top.parentElement;
      dirty.add(top);
    }
  }, true);

  // ---- panel -------------------------------------------------------------
  const css = `
  #admin-panel { position: fixed; left: 12px; bottom: 12px; z-index: 2147483000; width: 244px;
    background: #f4efe6; color: #1b1b1b; border: 3px solid #1b1b1b; border-radius: 14px;
    font: 500 14px/1.3 Rubik, system-ui, sans-serif; text-align: left; overflow: hidden; }
  #admin-panel * { box-sizing: border-box; font-family: inherit; }
  #admin-panel .ap-head { display: flex; align-items: center; justify-content: space-between;
    background: #f5b700; border-bottom: 3px solid #1b1b1b; padding: 6px 8px 6px 12px; font-weight: 800; }
  #admin-panel .ap-body { padding: 10px 12px 12px; display: grid; gap: 10px; }
  #admin-panel .ap-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #6b655c; margin-bottom: 4px; }
  #admin-panel button { font-size: 13px; font-weight: 700; color: #1b1b1b; background: #fff;
    border: 2px solid #1b1b1b; border-radius: 8px; padding: 5px 8px; cursor: pointer; margin: 0; }
  #admin-panel button:hover { background: #e6dfd2; }
  #admin-panel button.on { background: #4da3ff; }
  #admin-panel .ap-row { display: flex; gap: 6px; flex-wrap: wrap; }
  #admin-panel .ap-row button { flex: 1; }
  #admin-panel .ap-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
  #admin-panel .ap-grid button { padding: 4px 0; }
  #admin-panel .ap-grid button.here { background: #f5b700; }
  #admin-panel .ap-x { background: transparent; border: 0; font-size: 18px; line-height: 1; padding: 0 4px; }
  #admin-panel .ap-x:hover { background: transparent; }
  #admin-panel .ap-note { font-size: 12px; color: #6b655c; }
  #admin-panel.min .ap-body { display: none; }
  [data-admin-edit] { outline: 2px dashed #f5b700; outline-offset: 2px; cursor: text; }`;

  let panel = null, editing = false;

  function open() {
    store.set('sessionStorage', KEY_ON, '1');
    if (panel) { panel.classList.remove('min'); return; }
    const style = document.createElement('style');
    style.id = 'admin-style';
    style.textContent = css;
    document.head.appendChild(style);

    panel = document.createElement('div');
    panel.id = 'admin-panel';
    panel.setAttribute('contenteditable', 'false');
    let grid = '';
    for (let n = 1; n <= LAST; n++) grid += `<button data-go="${n}" class="${n === LEVEL ? 'here' : ''}">${n}</button>`;
    panel.innerHTML = `
      <div class="ap-head"><span>admin mode</span>
        <span><button class="ap-x" data-act="min" title="minimize">–</button><button class="ap-x" data-act="close" title="leave admin mode">×</button></span></div>
      <div class="ap-body">
        <div><div class="ap-label">level ${LEVEL}</div>
          <div class="ap-row"><button data-act="beat">beat it</button><button data-act="skip">skip →</button></div></div>
        <div><div class="ap-label">jump to level</div><div class="ap-grid">${grid}</div></div>
        <div><div class="ap-label">text</div>
          <div class="ap-row"><button data-act="edit">edit text: off</button><button data-act="reset">reset</button></div>
          <div class="ap-note" data-note></div></div>
      </div>`;
    document.body.appendChild(panel);

    panel.addEventListener('mousedown', e => e.stopPropagation());
    panel.addEventListener('click', e => {
      e.stopPropagation();
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.go) { saveIfEditing(); location.href = pageFor(+b.dataset.go); return; }
      const act = b.dataset.act;
      if (act === 'beat') beat();
      else if (act === 'skip') { saveIfEditing(); location.href = pageFor(LEVEL + 1); }
      else if (act === 'edit') setEditing(!editing);
      else if (act === 'reset') { setEditing(false); store.del('localStorage', KEY_TEXT); location.reload(); }
      else if (act === 'min') panel.classList.toggle('min');
      else if (act === 'close') close();
    });
    note(store.get('localStorage', KEY_TEXT) ? 'this page has your text edits' : '');
  }

  function note(t) { const n = panel && panel.querySelector('[data-note]'); if (n) n.textContent = t; }

  function close() {
    setEditing(false);
    store.del('sessionStorage', KEY_ON);
    if (panel) panel.remove();
    const s = document.getElementById('admin-style');
    if (s) s.remove();
    panel = null;
  }

  function beat() {
    const next = document.getElementById('next');
    if (!next) { note('nothing to unlock here'); return; }
    next.disabled = false;
    next.hidden = false;
    next.style.visibility = 'visible';
    note('next level unlocked');
  }

  function setEditing(on) {
    if (on === editing) return;
    editing = on;
    if (on) {
      editableEls().forEach(el => { el.setAttribute('contenteditable', 'true'); el.setAttribute('data-admin-edit', ''); });
      note('click any outlined text and type');
    } else {
      document.querySelectorAll('[data-admin-edit]').forEach(el => { el.removeAttribute('contenteditable'); el.removeAttribute('data-admin-edit'); });
      saveText();
      note(store.get('localStorage', KEY_TEXT) ? 'saved. it stays on this page' : '');
    }
    const b = panel && panel.querySelector('[data-act="edit"]');
    if (b) { b.textContent = 'edit text: ' + (on ? 'on' : 'off'); b.classList.toggle('on', on); }
  }
  function saveIfEditing() { if (editing) setEditing(false); }
  window.addEventListener('pagehide', saveIfEditing);

  // ---- the secret word ---------------------------------------------------
  let typed = '';
  const blocked = t => t && t.closest && t.closest('[data-no-admin]');
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || blocked(e.target)) return;
    if (e.key === 'Backspace') { typed = typed.slice(0, -1); return; }
    if (e.key.length !== 1) return;
    typed = (typed + e.key).slice(-SECRET.length);
    if (typed === SECRET) { typed = ''; open(); }
  }, true);
  // phone keyboards often don't report keys, so also watch text boxes
  document.addEventListener('input', e => {
    const t = e.target;
    if (blocked(t)) return;
    const v = t && (t.value !== undefined ? t.value : t.textContent);
    if (typeof v === 'string' && v.includes(SECRET) && !(t.closest && t.closest('[data-admin-edit]'))) open();
  }, true);

  function init() {
    applyText();
    if (store.get('sessionStorage', KEY_ON)) open();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
