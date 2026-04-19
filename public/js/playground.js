'use strict';

const CANVAS_W = 360;
const CANVAS_H = 210;
const THUMB_SCALE = 72 / 360; // thumb outer width / canvas width
const STORAGE_KEY = 'symbolang-playground-v3';

const COLORS = { ink: '#1a1a2e', accent: '#00e5c0', dim: '#8a8a90' };
const CANVAS_BG = '#ecedf2';

const GLYPH_NAMES = {
  H:'hex', D:'dots', C:'chevron', A:'arc', G:'grid',
  R:'relay', B:'bowtie', M:'stack', Q:'quad',
  N:'tri·n', S:'tri·s', E:'tri·e', W:'tri·w',
};
const ALL_CHARS = ['H','D','C','A','G','R','B','M','Q','N','S','E','W'];

// ── Presets ─────────────────────────────────────────────────────────────────

const PRESETS = [
  {
    id: 'resilient-link',
    name: 'Resilient Link',
    layers: [
      { char:'H', wght:800, morf:900, size:100, color:'ink',    x: 65,  y:105 },
      { char:'A', wght:700, morf:700, size:100, color:'accent', x:180,  y:105 },
      { char:'H', wght:800, morf:900, size:100, color:'ink',    x:295,  y:105 },
    ],
  },
  {
    id: 'observable-gateway',
    name: 'Observable Gateway',
    layers: [
      { char:'H', wght:700, morf:900, size:140, color:'ink',    x:180, y:105 },
      { char:'G', wght:500, morf:700, size: 52, color:'accent', x:180, y:105 },
      { char:'D', wght:600, morf:800, size:130, color:'ink',    x:180, y:105 },
    ],
  },
  {
    id: 'optimized-node',
    name: 'Optimized Node',
    layers: [
      { char:'D', wght:500, morf:300, size: 80, color:'ink',    x: 50, y:105 },
      { char:'H', wght:600, morf:500, size: 90, color:'ink',    x:160, y:105 },
      { char:'C', wght:800, morf:800, size: 76, color:'accent', x:255, y:100 },
      { char:'C', wght:900, morf:900, size: 96, color:'accent', x:310, y:105 },
    ],
  },
  {
    id: 'precise-intercept',
    name: 'Precise Intercept',
    layers: [
      { char:'H', wght:900, morf:900, size:160, color:'ink',    x:180, y:105 },
      { char:'R', wght:900, morf:900, size: 80, color:'ink',    x:180, y:105 },
      { char:'D', wght:900, morf:900, size: 36, color:'accent', x:180, y:105 },
    ],
  },
];

// ── State ────────────────────────────────────────────────────────────────────

let state = loadState();
// selectedLogoId, selectedLayerIdx live on state

let dndLayerSrc = null;   // layer-list drag index
let canvasDrag  = null;   // canvas pointer drag info

// ── Persistence ──────────────────────────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.logos)) return parsed;
    }
  } catch (_) {}
  return {
    logos: PRESETS.map(p => ({ ...p, layers: p.layers.map(l => ({ ...l })) })),
    selectedLogoId: PRESETS[0].id,
    selectedLayerIdx: null,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function uid() {
  return 'logo_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function getCurrentLogo() {
  return state.logos.find(l => l.id === state.selectedLogoId) || null;
}

function getPreset(id) {
  return PRESETS.find(p => p.id === id) || null;
}

function computeFormula(logo) {
  return logo.layers.map(l => l.char).join(' · ');
}

function layerVarStyle(layer) {
  return `font-variation-settings:'wght' ${layer.wght},'MORF' ${layer.morf}`;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function renderSidebar() {
  const container = document.getElementById('logo-list');
  container.innerHTML = '';

  const sorted = [...state.logos].sort((a, b) => a.name.localeCompare(b.name));

  if (sorted.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'logo-list-empty';
    empty.textContent = 'No logos yet. Click + to create one.';
    container.appendChild(empty);
    return;
  }

  sorted.forEach(logo => {
    const btn = document.createElement('button');
    btn.className = 'logo-item' + (logo.id === state.selectedLogoId ? ' active' : '');
    btn.dataset.id = logo.id;

    // Thumbnail
    const thumbOuter = document.createElement('div');
    thumbOuter.className = 'logo-thumb-outer';
    const thumbInner = document.createElement('div');
    thumbInner.className = 'logo-thumb-inner';
    renderThumbLayers(thumbInner, logo);
    thumbOuter.appendChild(thumbInner);

    // Info
    const info = document.createElement('div');
    info.className = 'logo-item-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'logo-item-name';
    nameEl.textContent = logo.name;
    const formulaEl = document.createElement('div');
    formulaEl.className = 'logo-item-formula';
    formulaEl.textContent = computeFormula(logo);
    info.appendChild(nameEl);
    info.appendChild(formulaEl);

    btn.appendChild(thumbOuter);
    btn.appendChild(info);
    btn.addEventListener('click', () => selectLogo(logo.id));
    container.appendChild(btn);
  });
}

function renderThumbLayers(container, logo) {
  container.innerHTML = '';
  logo.layers.forEach((layer, idx) => {
    const el = document.createElement('span');
    el.style.cssText = `
      position:absolute;
      left:${layer.x}px; top:${layer.y}px;
      transform:translate(-50%,-50%);
      font-family:"SymbolLang";
      font-variation-settings:'wght' ${layer.wght},'MORF' ${layer.morf};
      font-size:${layer.size}px;
      color:${COLORS[layer.color]};
      line-height:1;
      pointer-events:none;
      z-index:${idx + 1};
    `;
    el.textContent = layer.char;
    container.appendChild(el);
  });
}

// ── Editor ────────────────────────────────────────────────────────────────────

function selectLogo(id) {
  state.selectedLogoId = id;
  state.selectedLayerIdx = null;
  saveState();
  renderSidebar();
  renderEditor();
  updatePanel();
}

function renderEditor() {
  const logo = getCurrentLogo();
  const emptyEl = document.getElementById('editor-empty');
  const contentEl = document.getElementById('editor-content');

  if (!logo) {
    emptyEl.style.display = '';
    contentEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  contentEl.style.display = '';

  // Name + formula
  const nameEl = document.getElementById('editor-name');
  if (document.activeElement !== nameEl) nameEl.textContent = logo.name;
  document.getElementById('editor-formula').textContent = computeFormula(logo);

  // Canvas
  renderCanvas(logo);

  // Layer list
  renderLayerList(logo);
}

function renderCanvas(logo) {
  const canvas = document.getElementById('editor-canvas');
  canvas.innerHTML = '';

  logo.layers.forEach((layer, layerIdx) => {
    canvas.appendChild(makeLayerEl(layer, layerIdx));
  });
}

function makeLayerEl(layer, layerIdx) {
  const el = document.createElement('span');
  el.className = 'glyph-layer sym';
  el.dataset.layerIdx = layerIdx;
  el.style.zIndex = layerIdx + 1;
  el.textContent = layer.char;
  applyLayerStyle(el, layer);
  if (state.selectedLayerIdx === layerIdx) el.classList.add('selected');
  el.addEventListener('pointerdown', onCanvasPointerDown);
  return el;
}

function applyLayerStyle(el, layer) {
  el.style.fontVariationSettings = `'wght' ${layer.wght},'MORF' ${layer.morf}`;
  el.style.fontSize = layer.size + 'px';
  el.style.color = COLORS[layer.color];
  el.style.left = layer.x + 'px';
  el.style.top  = layer.y + 'px';
}

// ── Layer list (drag-to-reorder) ──────────────────────────────────────────────

function renderLayerList(logo) {
  const container = document.getElementById('layer-list');
  container.innerHTML = '';

  logo.layers.forEach((layer, idx) => {
    const row = document.createElement('div');
    row.className = 'layer-row' +
      (state.selectedLayerIdx === idx ? ' selected' : '');
    row.draggable = true;
    row.dataset.idx = idx;

    row.innerHTML = `
      <span class="layer-drag-handle" title="Drag to reorder">⠿</span>
      <span class="layer-row-char sym" style="${layerVarStyle(layer)};color:${COLORS[layer.color]}">${layer.char}</span>
      <span class="layer-row-name">${layer.char} · ${GLYPH_NAMES[layer.char] || ''}</span>
      <span class="layer-row-vals">${layer.wght} · ${layer.morf}</span>
      <button class="layer-row-del" title="Remove">×</button>
    `;

    row.addEventListener('click', e => {
      if (!e.target.classList.contains('layer-row-del')) selectLayer(idx);
    });

    row.querySelector('.layer-row-del').addEventListener('click', e => {
      e.stopPropagation();
      removeLayer(idx);
    });

    // DnD
    row.addEventListener('dragstart', e => {
      dndLayerSrc = idx;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.classList.add('dragging'), 0);
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      container.querySelectorAll('.drag-over').forEach(r => r.classList.remove('drag-over'));
      dndLayerSrc = null;
    });

    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      container.querySelectorAll('.drag-over').forEach(r => r.classList.remove('drag-over'));
      row.classList.add('drag-over');
    });

    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));

    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (dndLayerSrc === null || dndLayerSrc === idx) return;
      reorderLayers(dndLayerSrc, idx);
    });

    container.appendChild(row);
  });
}

function reorderLayers(srcIdx, destIdx) {
  const logo = getCurrentLogo();
  if (!logo) return;

  const [moved] = logo.layers.splice(srcIdx, 1);
  logo.layers.splice(destIdx, 0, moved);

  // Keep selection tracking correct
  if (state.selectedLayerIdx !== null) {
    if (state.selectedLayerIdx === srcIdx) {
      state.selectedLayerIdx = destIdx;
    } else if (srcIdx < destIdx) {
      if (state.selectedLayerIdx > srcIdx && state.selectedLayerIdx <= destIdx)
        state.selectedLayerIdx--;
    } else {
      if (state.selectedLayerIdx >= destIdx && state.selectedLayerIdx < srcIdx)
        state.selectedLayerIdx++;
    }
  }

  saveState();
  renderEditor();
  renderSidebarItem(logo.id);
  updatePanel();
}

// ── Layer selection ───────────────────────────────────────────────────────────

function selectLayer(idx) {
  state.selectedLayerIdx = idx;
  document.querySelectorAll('.glyph-layer').forEach(el =>
    el.classList.toggle('selected', +el.dataset.layerIdx === idx)
  );
  document.querySelectorAll('.layer-row').forEach(el =>
    el.classList.toggle('selected', +el.dataset.idx === idx)
  );
  updatePanel();
}

function deselectLayer() {
  state.selectedLayerIdx = null;
  document.querySelectorAll('.glyph-layer, .layer-row').forEach(el =>
    el.classList.remove('selected')
  );
  updatePanel();
}

// ── Canvas drag (move layer) ──────────────────────────────────────────────────

function onCanvasPointerDown(e) {
  e.preventDefault();
  e.stopPropagation();

  const el = e.currentTarget;
  const layerIdx = +el.dataset.layerIdx;
  const logo = getCurrentLogo();
  if (!logo) return;

  selectLayer(layerIdx);
  el.setPointerCapture(e.pointerId);
  el.classList.add('dragging');

  const layer = logo.layers[layerIdx];
  canvasDrag = { el, layerIdx, startPX: e.clientX, startPY: e.clientY, startLX: layer.x, startLY: layer.y };

  el.addEventListener('pointermove', onCanvasPointerMove);
  el.addEventListener('pointerup',   onCanvasPointerUp);
  el.addEventListener('pointercancel', onCanvasPointerUp);
}

function onCanvasPointerMove(e) {
  if (!canvasDrag) return;
  const logo = getCurrentLogo();
  if (!logo) return;

  const dx = e.clientX - canvasDrag.startPX;
  const dy = e.clientY - canvasDrag.startPY;
  const layer = logo.layers[canvasDrag.layerIdx];
  layer.x = clamp(canvasDrag.startLX + dx, 0, CANVAS_W);
  layer.y = clamp(canvasDrag.startLY + dy, 0, CANVAS_H);

  canvasDrag.el.style.left = layer.x + 'px';
  canvasDrag.el.style.top  = layer.y + 'px';

  const vx = document.getElementById('val-x');
  const vy = document.getElementById('val-y');
  if (vx) vx.value = Math.round(layer.x);
  if (vy) vy.value = Math.round(layer.y);
}

function onCanvasPointerUp() {
  if (!canvasDrag) return;
  canvasDrag.el.classList.remove('dragging');
  canvasDrag.el.removeEventListener('pointermove', onCanvasPointerMove);
  canvasDrag.el.removeEventListener('pointerup',   onCanvasPointerUp);
  canvasDrag.el.removeEventListener('pointercancel', onCanvasPointerUp);
  saveState();
  renderSidebarItem(state.selectedLogoId);
  canvasDrag = null;
}

// ── Add / remove layers ───────────────────────────────────────────────────────

function addLayer(char) {
  const logo = getCurrentLogo();
  if (!logo) return;
  logo.layers.push({ char, wght:500, morf:500, size:90, color:'ink', x:180, y:105 });
  state.selectedLayerIdx = logo.layers.length - 1;
  saveState();
  renderEditor();
  renderSidebarItem(logo.id);
  updatePanel();
  document.getElementById('char-picker').hidden = true;
}

function removeLayer(idx) {
  const logo = getCurrentLogo();
  if (!logo || logo.layers.length === 0) return;
  logo.layers.splice(idx, 1);
  if (state.selectedLayerIdx >= logo.layers.length)
    state.selectedLayerIdx = logo.layers.length ? logo.layers.length - 1 : null;
  saveState();
  renderEditor();
  renderSidebarItem(logo.id);
  updatePanel();
}

// ── Logo CRUD ─────────────────────────────────────────────────────────────────

function addLogo() {
  const logo = {
    id: uid(),
    name: 'New Logo',
    layers: [{ char:'H', wght:500, morf:500, size:100, color:'ink', x:180, y:105 }],
  };
  state.logos.push(logo);
  state.selectedLogoId = logo.id;
  state.selectedLayerIdx = null;
  saveState();
  renderSidebar();
  renderEditor();
  updatePanel();
  // Focus name for immediate rename
  const nameEl = document.getElementById('editor-name');
  if (nameEl) { nameEl.focus(); document.execCommand('selectAll', false, null); }
}

function deleteLogo(id) {
  const idx = state.logos.findIndex(l => l.id === id);
  if (idx === -1) return;
  state.logos.splice(idx, 1);
  if (state.selectedLogoId === id) {
    state.selectedLogoId = state.logos.length ? state.logos[0].id : null;
    state.selectedLayerIdx = null;
  }
  saveState();
  renderSidebar();
  renderEditor();
  updatePanel();
}

function renderSidebarItem(id) {
  // Targeted refresh of one sidebar item's thumb + formula
  const logo = state.logos.find(l => l.id === id);
  if (!logo) return;
  const btn = document.querySelector(`.logo-item[data-id="${id}"]`);
  if (!btn) { renderSidebar(); return; }
  const thumbInner = btn.querySelector('.logo-thumb-inner');
  if (thumbInner) renderThumbLayers(thumbInner, logo);
  const formulaEl = btn.querySelector('.logo-item-formula');
  if (formulaEl) formulaEl.textContent = computeFormula(logo);
  const nameEl = btn.querySelector('.logo-item-name');
  if (nameEl) nameEl.textContent = logo.name;
}

// ── Controls panel ────────────────────────────────────────────────────────────

function updatePanel() {
  const hint     = document.getElementById('panel-hint');
  const controls = document.getElementById('panel-controls');
  const logo = getCurrentLogo();

  if (!logo || state.selectedLayerIdx === null || state.selectedLayerIdx >= logo.layers.length) {
    hint.style.display = '';
    controls.style.display = 'none';
    return;
  }

  hint.style.display = 'none';
  controls.style.display = '';

  const layer = logo.layers[state.selectedLayerIdx];

  // Preview
  const pg = document.getElementById('panel-glyph');
  pg.textContent = layer.char;
  pg.style.fontVariationSettings = `'wght' ${layer.wght},'MORF' ${layer.morf}`;
  pg.style.color = COLORS[layer.color];
  pg.style.fontSize = clamp(layer.size, 24, 48) + 'px';

  document.getElementById('panel-layer-label').textContent =
    `L${state.selectedLayerIdx + 1} · ${layer.char} · ${GLYPH_NAMES[layer.char] || ''}`;
  document.getElementById('panel-logo-name').textContent = logo.name;

  document.getElementById('ctrl-wght').value = layer.wght;
  document.getElementById('val-wght').value  = layer.wght;
  document.getElementById('ctrl-morf').value = layer.morf;
  document.getElementById('val-morf').value  = layer.morf;
  document.getElementById('ctrl-size').value = layer.size;
  document.getElementById('val-size').value  = layer.size + 'px';
  document.getElementById('val-x').value     = Math.round(layer.x);
  document.getElementById('val-y').value     = Math.round(layer.y);

  document.querySelectorAll('.color-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.color === layer.color)
  );
}

function syncSelectedEl() {
  if (state.selectedLayerIdx === null) return;
  const logo = getCurrentLogo();
  if (!logo) return;
  const layer = logo.layers[state.selectedLayerIdx];
  const el = document.querySelector(`.glyph-layer[data-layer-idx="${state.selectedLayerIdx}"]`);
  if (el) applyLayerStyle(el, layer);

  // Sync layer row values display
  const row = document.querySelector(`.layer-row[data-idx="${state.selectedLayerIdx}"]`);
  if (row) {
    const charEl  = row.querySelector('.layer-row-char');
    const valsEl  = row.querySelector('.layer-row-vals');
    if (charEl) { charEl.style.fontVariationSettings = layerVarStyle(layer); charEl.style.color = COLORS[layer.color]; }
    if (valsEl)  valsEl.textContent = `${layer.wght} · ${layer.morf}`;
  }
}

function syncPanelPreview() {
  if (state.selectedLayerIdx === null) return;
  const logo = getCurrentLogo();
  if (!logo) return;
  const layer = logo.layers[state.selectedLayerIdx];
  const pg = document.getElementById('panel-glyph');
  pg.style.fontVariationSettings = `'wght' ${layer.wght},'MORF' ${layer.morf}`;
  pg.style.color = COLORS[layer.color];
  pg.style.fontSize = clamp(layer.size, 24, 48) + 'px';
}

// ── Controls wiring ───────────────────────────────────────────────────────────

function initControls() {
  function onAxisChange(field, valId, fmt) {
    document.getElementById('ctrl-' + field).addEventListener('input', e => {
      if (state.selectedLayerIdx === null) return;
      const logo = getCurrentLogo(); if (!logo) return;
      logo.layers[state.selectedLayerIdx][field] = +e.target.value;
      document.getElementById(valId).value = fmt(+e.target.value);
      syncSelectedEl();
      syncPanelPreview();
      saveState();
    });
  }
  onAxisChange('wght', 'val-wght', v => v);
  onAxisChange('morf', 'val-morf', v => v);
  onAxisChange('size', 'val-size', v => v + 'px');

  document.getElementById('color-picker').addEventListener('click', e => {
    const btn = e.target.closest('.color-btn');
    if (!btn || state.selectedLayerIdx === null) return;
    const logo = getCurrentLogo(); if (!logo) return;
    logo.layers[state.selectedLayerIdx].color = btn.dataset.color;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.toggle('active', b === btn));
    syncSelectedEl();
    syncPanelPreview();
    renderSidebarItem(state.selectedLogoId);
    saveState();
  });

  document.getElementById('btn-reset-layer').addEventListener('click', () => {
    const logo = getCurrentLogo(); if (!logo) return;
    const preset = getPreset(logo.id);
    if (!preset || state.selectedLayerIdx >= preset.layers.length) return;
    logo.layers[state.selectedLayerIdx] = { ...preset.layers[state.selectedLayerIdx] };
    renderEditor();
    renderSidebarItem(logo.id);
    updatePanel();
    saveState();
  });

  document.getElementById('btn-new-logo').addEventListener('click', addLogo);

  document.getElementById('btn-delete-logo').addEventListener('click', () => {
    if (!state.selectedLogoId) return;
    const logo = getCurrentLogo();
    if (logo && confirm(`Delete "${logo.name}"?`)) deleteLogo(state.selectedLogoId);
  });

  // Name editing
  const nameEl = document.getElementById('editor-name');
  nameEl.addEventListener('blur', () => {
    const logo = getCurrentLogo(); if (!logo) return;
    const newName = nameEl.textContent.trim() || 'Untitled';
    nameEl.textContent = newName;
    logo.name = newName;
    saveState();
    renderSidebarItem(logo.id);
    renderSidebar(); // re-sort
  });
  nameEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
  });

  // Canvas background click = deselect
  document.getElementById('editor-canvas').addEventListener('pointerdown', e => {
    if (e.target.id === 'editor-canvas') deselectLayer();
  });

  // Add layer
  document.getElementById('btn-add-layer').addEventListener('click', () => {
    const picker = document.getElementById('char-picker');
    picker.hidden = !picker.hidden;
  });

  // Char picker
  const charPicker = document.getElementById('char-picker');
  ALL_CHARS.forEach(char => {
    const btn = document.createElement('button');
    btn.className = 'char-opt';
    btn.title = GLYPH_NAMES[char] || char;
    btn.textContent = char;
    btn.addEventListener('click', () => addLayer(char));
    charPicker.appendChild(btn);
  });

  // Export
  document.getElementById('btn-export-html').addEventListener('click', () => {
    const logo = getCurrentLogo(); if (!logo) return;
    exportHTML(logo);
  });
  document.getElementById('btn-export-svg').addEventListener('click', () => {
    const logo = getCurrentLogo(); if (!logo) return;
    exportSVG(logo);
  });
  document.getElementById('btn-export-png').addEventListener('click', () => {
    const logo = getCurrentLogo(); if (!logo) return;
    exportPNG(logo);
  });
}

// ── Export ────────────────────────────────────────────────────────────────────

function showFeedback(msg) {
  const el = document.getElementById('export-feedback');
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

function buildHTMLString(logo) {
  const layerHTML = logo.layers.map(l => `  <span style="
    position:absolute; left:${l.x}px; top:${l.y}px;
    transform:translate(-50%,-50%);
    font-family:'SymbolLang'; font-size:${l.size}px;
    font-variation-settings:'wght' ${l.wght},'MORF' ${l.morf};
    color:${COLORS[l.color]}; line-height:1;">${l.char}</span>`).join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${logo.name}</title>
<style>
@font-face {
  font-family: 'SymbolLang';
  src: url('SymbolLang.ttf') format('truetype-variations');
  font-weight: 100 900;
}
.sym-logo {
  position: relative;
  width: ${CANVAS_W}px;
  height: ${CANVAS_H}px;
  background: ${CANVAS_BG};
  overflow: hidden;
}
</style>
</head><body>
<div class="sym-logo">
${layerHTML}
</div>
</body></html>`;
}

function exportHTML(logo) {
  const html = buildHTMLString(logo);
  const blob = new Blob([html], { type: 'text/html' });
  downloadBlob(blob, safeName(logo.name) + '.html');
  showFeedback('HTML downloaded ✓');
}

async function buildSVGString(logo) {
  // Fetch font and encode as base64 for embedding
  let fontData = '';
  try {
    const resp = await fetch('fonts/SymbolLang.ttf');
    const buf  = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    fontData = btoa(bin);
  } catch (_) {}

  const fontFace = fontData
    ? `@font-face{font-family:'SymbolLang';src:url('data:font/truetype;base64,${fontData}') format('truetype');font-weight:100 900;}`
    : `@font-face{font-family:'SymbolLang';src:url('SymbolLang.ttf') format('truetype');font-weight:100 900;}`;

  const textEls = logo.layers.map(l =>
    `<text x="${l.x}" y="${l.y}"
      font-family="SymbolLang" font-size="${l.size}"
      style="font-variation-settings:'wght' ${l.wght},'MORF' ${l.morf}"
      fill="${COLORS[l.color]}"
      dominant-baseline="middle" text-anchor="middle">${l.char}</text>`
  ).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <defs><style>${fontFace}</style></defs>
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="${CANVAS_BG}"/>
  ${textEls}
</svg>`;
}

async function exportSVG(logo) {
  try {
    const svg = await buildSVGString(logo);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    downloadBlob(blob, safeName(logo.name) + '.svg');
    showFeedback('SVG downloaded ✓');
  } catch (err) {
    showFeedback('SVG export failed');
    console.error(err);
  }
}

async function exportPNG(logo) {
  showFeedback('Rendering PNG…');
  try {
    const svg = await buildSVGString(logo);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    const scale = 2;

    img.onload = () => {
      const c = document.createElement('canvas');
      c.width  = CANVAS_W * scale;
      c.height = CANVAS_H * scale;
      const ctx = c.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      try {
        const dataUrl = c.toDataURL('image/png');
        downloadDataUrl(dataUrl, safeName(logo.name) + '.png');
        showFeedback('PNG downloaded ✓');
      } catch (_) {
        // Tainted canvas fallback
        downloadBlob(blob, safeName(logo.name) + '.svg');
        showFeedback('PNG blocked by browser — SVG downloaded instead');
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showFeedback('PNG render failed');
    };
    img.src = url;
  } catch (err) {
    showFeedback('PNG export failed');
    console.error(err);
  }
}

function safeName(name) {
  return name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  renderSidebar();
  renderEditor();
  updatePanel();
  initControls();
});
