'use strict';

const CANVAS_W = 360;
const CANVAS_H = 210;
const STORAGE_KEY = 'symbolang-playground-v1';

const COLORS = {
  ink:    '#1a1a2e',
  accent: '#00e5c0',
  dim:    '#8a8a90',
};

const GLYPH_NAMES = {
  H: 'hex', D: 'dots', C: 'chevron', A: 'arc', G: 'grid',
  R: 'relay', B: 'bowtie', M: 'stack', Q: 'quad',
  N: 'tri·n', S: 'tri·s', E: 'tri·e', W: 'tri·w',
};

// ---- Logo defaults ----
// x/y are CENTER coordinates (transform: translate(-50%,-50%) applied)

const LOGO_DEFAULTS = [
  {
    id: 'resilient-link',
    name: 'Resilient Link',
    formula: 'H · A · H',
    layers: [
      { char: 'H', wght: 800, morf: 900, size: 100, color: 'ink',    x:  65, y: 105 },
      { char: 'A', wght: 700, morf: 700, size: 100, color: 'accent', x: 180, y: 105 },
      { char: 'H', wght: 800, morf: 900, size: 100, color: 'ink',    x: 295, y: 105 },
    ],
  },
  {
    id: 'observable-gateway',
    name: 'Observable Gateway',
    formula: 'H + G + D',
    layers: [
      { char: 'H', wght: 700, morf: 900, size: 140, color: 'ink',    x: 180, y: 105 },
      { char: 'G', wght: 500, morf: 700, size:  52, color: 'accent', x: 180, y: 105 },
      { char: 'D', wght: 600, morf: 800, size: 130, color: 'ink',    x: 180, y: 105 },
    ],
  },
  {
    id: 'optimized-node',
    name: 'Optimized Node',
    formula: 'D · H · C · C',
    layers: [
      { char: 'D', wght: 500, morf: 300, size:  80, color: 'ink',    x:  50, y: 105 },
      { char: 'H', wght: 600, morf: 500, size:  90, color: 'ink',    x: 160, y: 105 },
      { char: 'C', wght: 800, morf: 800, size:  76, color: 'accent', x: 255, y: 100 },
      { char: 'C', wght: 900, morf: 900, size:  96, color: 'accent', x: 310, y: 105 },
    ],
  },
  {
    id: 'precise-intercept',
    name: 'Precise Intercept',
    formula: 'H + R + D',
    layers: [
      { char: 'H', wght: 900, morf: 900, size: 160, color: 'ink',    x: 180, y: 105 },
      { char: 'R', wght: 900, morf: 900, size:  80, color: 'ink',    x: 180, y: 105 },
      { char: 'D', wght: 900, morf: 900, size:  36, color: 'accent', x: 180, y: 105 },
    ],
  },
];

// ---- State ----

let state = loadState();
let selected = { logoIdx: null, layerIdx: null };
let dragInfo = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // Validate basic shape
    if (!Array.isArray(parsed) || parsed.length !== LOGO_DEFAULTS.length) return defaultState();
    return parsed;
  } catch (_) {
    return defaultState();
  }
}

function defaultState() {
  return LOGO_DEFAULTS.map(logo => ({
    ...logo,
    layers: logo.layers.map(l => ({ ...l })),
  }));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getLayer(logoIdx, layerIdx) {
  return state[logoIdx].layers[layerIdx];
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ---- Build DOM ----

function buildCards() {
  const container = document.getElementById('pg-cards');
  container.innerHTML = '';

  state.forEach((logo, logoIdx) => {
    const card = document.createElement('article');
    card.className = 'logo-card';

    // Header
    const header = document.createElement('div');
    header.className = 'card-header';
    const title = document.createElement('h2');
    title.className = 'card-title';
    title.textContent = logo.name;
    const formula = document.createElement('code');
    formula.className = 'card-formula';
    formula.textContent = logo.formula;
    header.appendChild(title);
    header.appendChild(formula);
    card.appendChild(header);

    // Canvas
    const canvas = document.createElement('div');
    canvas.className = 'card-canvas';
    canvas.dataset.logoIdx = logoIdx;
    canvas.addEventListener('pointerdown', e => {
      if (e.target === canvas) deselect();
    });
    card.appendChild(canvas);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const chips = document.createElement('div');
    chips.className = 'layer-chips';
    chips.dataset.logoIdx = logoIdx;
    footer.appendChild(chips);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn-reset-card';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => resetLogo(logoIdx));
    footer.appendChild(resetBtn);

    card.appendChild(footer);
    container.appendChild(card);
  });

  renderAll();
}

// ---- Rendering ----

function renderAll() {
  state.forEach((_, i) => renderLogo(i));
}

function renderLogo(logoIdx) {
  const canvas = document.querySelector(`.card-canvas[data-logo-idx="${logoIdx}"]`);
  if (!canvas) return;
  canvas.innerHTML = '';

  state[logoIdx].layers.forEach((layer, layerIdx) => {
    canvas.appendChild(makeLayerEl(logoIdx, layerIdx));
  });

  renderChips(logoIdx);
}

function makeLayerEl(logoIdx, layerIdx) {
  const layer = state[logoIdx].layers[layerIdx];

  const el = document.createElement('span');
  el.className = 'glyph-layer sym';
  el.dataset.logoIdx = logoIdx;
  el.dataset.layerIdx = layerIdx;
  el.textContent = layer.char;
  el.style.zIndex = layerIdx + 1;

  applyLayerStyle(el, layer);

  if (selected.logoIdx === logoIdx && selected.layerIdx === layerIdx) {
    el.classList.add('selected');
  }

  el.addEventListener('pointerdown', onPointerDown);
  return el;
}

function applyLayerStyle(el, layer) {
  el.style.fontVariationSettings = `'wght' ${layer.wght}, 'MORF' ${layer.morf}`;
  el.style.fontSize = `${layer.size}px`;
  el.style.color = COLORS[layer.color];
  el.style.left = `${layer.x}px`;
  el.style.top = `${layer.y}px`;
}

function renderChips(logoIdx) {
  const container = document.querySelector(`.layer-chips[data-logo-idx="${logoIdx}"]`);
  if (!container) return;
  container.innerHTML = '';

  state[logoIdx].layers.forEach((layer, layerIdx) => {
    const chip = document.createElement('button');
    chip.className = 'layer-chip';
    if (selected.logoIdx === logoIdx && selected.layerIdx === layerIdx) {
      chip.classList.add('selected');
    }

    const glyph = document.createElement('span');
    glyph.className = 'chip-glyph';
    glyph.style.fontVariationSettings = `'wght' ${layer.wght}, 'MORF' ${layer.morf}`;
    glyph.style.color = COLORS[layer.color];
    glyph.textContent = layer.char;

    const dot = document.createElement('span');
    dot.className = 'chip-dot';
    dot.style.background = COLORS[layer.color];

    chip.appendChild(glyph);
    chip.appendChild(dot);
    chip.title = `${layer.char} · ${GLYPH_NAMES[layer.char] || ''}`;
    chip.addEventListener('click', () => selectLayer(logoIdx, layerIdx));

    container.appendChild(chip);
  });
}

// ---- Selection ----

function selectLayer(logoIdx, layerIdx) {
  selected = { logoIdx, layerIdx };

  document.querySelectorAll('.glyph-layer').forEach(el => {
    const match = +el.dataset.logoIdx === logoIdx && +el.dataset.layerIdx === layerIdx;
    el.classList.toggle('selected', match);
  });

  document.querySelectorAll('.layer-chips').forEach(container => {
    const li = +container.dataset.logoIdx;
    Array.from(container.children).forEach((chip, ci) => {
      chip.classList.toggle('selected', li === logoIdx && ci === layerIdx);
    });
  });

  updatePanel();
}

function deselect() {
  selected = { logoIdx: null, layerIdx: null };
  document.querySelectorAll('.glyph-layer').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.layer-chip').forEach(el => el.classList.remove('selected'));
  updatePanel();
}

// ---- Panel ----

function updatePanel() {
  const hint = document.getElementById('panel-hint');
  const controls = document.getElementById('panel-controls');

  if (selected.logoIdx === null) {
    hint.style.display = '';
    controls.style.display = 'none';
    return;
  }

  hint.style.display = 'none';
  controls.style.display = '';

  const layer = getLayer(selected.logoIdx, selected.layerIdx);
  const logo = state[selected.logoIdx];

  // Preview glyph
  const pg = document.getElementById('panel-glyph');
  pg.textContent = layer.char;
  pg.style.fontVariationSettings = `'wght' ${layer.wght}, 'MORF' ${layer.morf}`;
  pg.style.color = COLORS[layer.color];
  pg.style.fontSize = `${clamp(layer.size, 24, 52)}px`;

  // Meta
  document.getElementById('panel-layer-label').textContent =
    `L${selected.layerIdx + 1} · ${layer.char} · ${GLYPH_NAMES[layer.char] || ''}`;
  document.getElementById('panel-logo-name').textContent = logo.name;

  // Sliders
  setSlider('ctrl-wght', 'val-wght', layer.wght, v => v);
  setSlider('ctrl-morf', 'val-morf', layer.morf, v => v);
  setSlider('ctrl-size', 'val-size', layer.size, v => v + 'px');

  // Position
  document.getElementById('val-x').value = Math.round(layer.x);
  document.getElementById('val-y').value = Math.round(layer.y);

  // Color buttons
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === layer.color);
  });
}

function setSlider(sliderId, outputId, value, fmt) {
  document.getElementById(sliderId).value = value;
  document.getElementById(outputId).value = fmt(value);
}

// ---- Drag ----

function onPointerDown(e) {
  e.preventDefault();
  e.stopPropagation();

  const el = e.currentTarget;
  const logoIdx = +el.dataset.logoIdx;
  const layerIdx = +el.dataset.layerIdx;
  const layer = getLayer(logoIdx, layerIdx);

  selectLayer(logoIdx, layerIdx);
  el.setPointerCapture(e.pointerId);
  el.classList.add('dragging');

  dragInfo = {
    el,
    logoIdx,
    layerIdx,
    startPX: e.clientX,
    startPY: e.clientY,
    startLX: layer.x,
    startLY: layer.y,
  };

  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(e) {
  if (!dragInfo) return;

  const dx = e.clientX - dragInfo.startPX;
  const dy = e.clientY - dragInfo.startPY;

  const newX = clamp(dragInfo.startLX + dx, 0, CANVAS_W);
  const newY = clamp(dragInfo.startLY + dy, 0, CANVAS_H);

  const layer = getLayer(dragInfo.logoIdx, dragInfo.layerIdx);
  layer.x = newX;
  layer.y = newY;

  dragInfo.el.style.left = `${newX}px`;
  dragInfo.el.style.top = `${newY}px`;

  // Live-update position readout
  const vx = document.getElementById('val-x');
  const vy = document.getElementById('val-y');
  if (vx) vx.value = Math.round(newX);
  if (vy) vy.value = Math.round(newY);
}

function onPointerUp(e) {
  if (!dragInfo) return;

  dragInfo.el.classList.remove('dragging');
  dragInfo.el.removeEventListener('pointermove', onPointerMove);
  dragInfo.el.removeEventListener('pointerup', onPointerUp);
  dragInfo.el.removeEventListener('pointercancel', onPointerUp);

  saveState();
  dragInfo = null;
}

// ---- Axis / size controls ----

function initControls() {
  document.getElementById('ctrl-wght').addEventListener('input', e => {
    if (selected.logoIdx === null) return;
    const layer = getLayer(selected.logoIdx, selected.layerIdx);
    layer.wght = +e.target.value;
    document.getElementById('val-wght').value = layer.wght;
    syncSelectedEl();
    syncPanelPreview();
    syncChip();
    saveState();
  });

  document.getElementById('ctrl-morf').addEventListener('input', e => {
    if (selected.logoIdx === null) return;
    const layer = getLayer(selected.logoIdx, selected.layerIdx);
    layer.morf = +e.target.value;
    document.getElementById('val-morf').value = layer.morf;
    syncSelectedEl();
    syncPanelPreview();
    syncChip();
    saveState();
  });

  document.getElementById('ctrl-size').addEventListener('input', e => {
    if (selected.logoIdx === null) return;
    const layer = getLayer(selected.logoIdx, selected.layerIdx);
    layer.size = +e.target.value;
    document.getElementById('val-size').value = layer.size + 'px';
    syncSelectedEl();
    syncPanelPreview();
    saveState();
  });

  document.getElementById('color-picker').addEventListener('click', e => {
    const btn = e.target.closest('.color-btn');
    if (!btn || selected.logoIdx === null) return;
    const layer = getLayer(selected.logoIdx, selected.layerIdx);
    layer.color = btn.dataset.color;
    document.querySelectorAll('.color-btn').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    syncSelectedEl();
    syncPanelPreview();
    syncChip();
    saveState();
  });

  document.getElementById('btn-reset-layer').addEventListener('click', () => {
    if (selected.logoIdx === null) return;
    const def = { ...LOGO_DEFAULTS[selected.logoIdx].layers[selected.layerIdx] };
    state[selected.logoIdx].layers[selected.layerIdx] = def;
    // Re-render just the changed layer element
    const canvas = document.querySelector(`.card-canvas[data-logo-idx="${selected.logoIdx}"]`);
    const oldEl = canvas.querySelector(
      `.glyph-layer[data-layer-idx="${selected.layerIdx}"]`
    );
    const newEl = makeLayerEl(selected.logoIdx, selected.layerIdx);
    canvas.replaceChild(newEl, oldEl);
    updatePanel();
    syncChip();
    saveState();
  });
}

// ---- Sync helpers (no full re-render) ----

function syncSelectedEl() {
  if (selected.logoIdx === null) return;
  const layer = getLayer(selected.logoIdx, selected.layerIdx);
  const el = document.querySelector(
    `.glyph-layer[data-logo-idx="${selected.logoIdx}"][data-layer-idx="${selected.layerIdx}"]`
  );
  if (el) applyLayerStyle(el, layer);
}

function syncPanelPreview() {
  if (selected.logoIdx === null) return;
  const layer = getLayer(selected.logoIdx, selected.layerIdx);
  const pg = document.getElementById('panel-glyph');
  pg.style.fontVariationSettings = `'wght' ${layer.wght}, 'MORF' ${layer.morf}`;
  pg.style.color = COLORS[layer.color];
  pg.style.fontSize = `${clamp(layer.size, 24, 52)}px`;
}

function syncChip() {
  if (selected.logoIdx === null) return;
  const layer = getLayer(selected.logoIdx, selected.layerIdx);
  const container = document.querySelector(
    `.layer-chips[data-logo-idx="${selected.logoIdx}"]`
  );
  if (!container) return;
  const chip = container.children[selected.layerIdx];
  if (!chip) return;
  const glyph = chip.querySelector('.chip-glyph');
  const dot = chip.querySelector('.chip-dot');
  if (glyph) {
    glyph.style.fontVariationSettings = `'wght' ${layer.wght}, 'MORF' ${layer.morf}`;
    glyph.style.color = COLORS[layer.color];
  }
  if (dot) dot.style.background = COLORS[layer.color];
}

// ---- Reset logo ----

function resetLogo(logoIdx) {
  state[logoIdx] = {
    ...LOGO_DEFAULTS[logoIdx],
    layers: LOGO_DEFAULTS[logoIdx].layers.map(l => ({ ...l })),
  };
  if (selected.logoIdx === logoIdx) {
    const validIdx = Math.min(selected.layerIdx, state[logoIdx].layers.length - 1);
    selected.layerIdx = validIdx;
  }
  renderLogo(logoIdx);
  if (selected.logoIdx === logoIdx) updatePanel();
  saveState();
}

// ---- Init ----

document.addEventListener('DOMContentLoaded', () => {
  buildCards();
  initControls();
});
