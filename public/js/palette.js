/**
 * palette.js — SymbolLang dynamic colour system
 *
 * Self-contained IIFE. On DOMContentLoaded, injects a Q-glyph swatch
 * trigger into .site-nav .nav-right. Clicking it opens a panel with:
 *   - 5 hue presets + custom hex input
 *   - 5 palette types (complementary, split-comp, triadic, analogous, mono)
 *
 * Palette is re-computed whenever primary colour or type changes, and
 * again whenever data-theme flips, ensuring contrast targets are met in
 * both modes. State persists via localStorage.
 */

(function () {
  'use strict';

  // ── Presets & types ────────────────────────────────────────────────────────

  const PRESETS = [
    { name: 'Teal', h: 172, s: 75 },
    { name: 'Indigo', h: 234, s: 70 },
    { name: 'Rose', h: 351, s: 82 },
    { name: 'Amber', h: 43, s: 78 },
    { name: 'Violet', h: 263, s: 68 },
  ];

  // Hue offset for accent2 relative to accent
  const TYPES = [
    { id: 'complementary', label: 'Complementary', angle: 180 },
    { id: 'split', label: 'Split-comp', angle: 150 },
    { id: 'triadic', label: 'Triadic', angle: 120 },
    { id: 'analogous', label: 'Analogous', angle: 30 },
    { id: 'mono', label: 'Mono', angle: 0 },
  ];

  // ── State ──────────────────────────────────────────────────────────────────

  const STORAGE_KEY = 'symbolang-palette';

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved.h === 'number') return saved;
    } catch (_) { }
    return { h: 172, s: 75, type: 'complementary' };
  }

  function saveState(st) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(st)); } catch (_) { }
  }

  const state = loadState();

  // ── Colour math ────────────────────────────────────────────────────────────

  function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  function hslToHex(h, s, l) {
    const [r, g, b] = hslToRgb(h, s, l);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function hexToHsl(hex) {
    const [r, g, b] = hexToRgb(hex).map(x => x / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, Math.round(l * 100)];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
  }

  function srgbLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map(srgbLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function contrastRatio(hex1, hex2) {
    const l1 = luminance(hex1), l2 = luminance(hex2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  /**
   * Binary-search for the lightness that just meets targetContrast against bg.
   * isDark=true  → search upward (brighter) → returns minimum passing L
   * isDark=false → search downward (darker)  → returns maximum passing L
   */
  function findL(h, s, bgHex, targetContrast, isDark) {
    let lo = isDark ? 30 : 10;
    let hi = isDark ? 95 : 65;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const c = contrastRatio(hslToHex(h, s, mid), bgHex);
      if (isDark) {
        if (c < targetContrast) lo = mid; else hi = mid;
      } else {
        if (c < targetContrast) hi = mid; else lo = mid;
      }
    }
    // Add a small margin so we comfortably pass the threshold
    const result = (lo + hi) / 2;
    return isDark ? Math.min(95, result + 2) : Math.max(10, result - 2);
  }

  // ── Palette computation ────────────────────────────────────────────────────

  function computePalette(h, s, type, isDark) {
    // Surfaces (derived before findL so we can pass the real bg)
    const bg    = isDark ? hslToHex(h, 14,  3) : hslToHex(h, 16, 96);
    const panel = isDark ? hslToHex(h, 12,  7) : hslToHex(h,  9, 99);
    const border= isDark ? hslToHex(h, 14, 15) : hslToHex(h, 12, 86);
    const ink   = isDark ? hslToHex(h,  6, 95) : hslToHex(h,  8,  7);

    // Clamp saturation to a tasteful range
    const aS = Math.max(60, Math.min(s, 84));

    // Accent 1: WCAG AA (4.5:1) against bg
    const aL = findL(h, aS, bg, 4.5, isDark);
    const accent = hslToHex(h, aS, aL);

    // Accent 2: hue derived from palette type, same 4.5:1 floor
    const typeObj = TYPES.find(t => t.id === type) || TYPES[0];
    const h2 = (h + typeObj.angle) % 360;
    const s2 = type === 'mono' ? Math.max(40, aS - 28) : Math.max(55, aS - 6);
    // mono: distinguish via lightness shift instead of hue shift
    const aL2raw = type === 'mono'
      ? aL + (isDark ? -18 : 18)
      : findL(h2, s2, bg, 4.5, isDark);
    const accent2 = hslToHex(h2, s2, Math.max(10, Math.min(95, aL2raw)));

    // Neutrals: hue-tinted, surface-relative
    const glyph  = isDark ? hslToHex(h, 10, 78) : hslToHex(h, 16, 18);
    const dim    = isDark ? hslToHex(h,  7, 54) : hslToHex(h, 11, 42);
    const dimmer = isDark ? hslToHex(h,  4, 33) : hslToHex(h,  5, 60);

    // Slide-card: FLIPPED from page theme — light slide on dark page, dark slide on light page
    const slide      = isDark ? hslToHex(h, 10, 90) : hslToHex(h, 20,  7);
    const slideGlyph = isDark ? hslToHex(h, 10, 38) : hslToHex(h,  8, 72);
    const slideInk   = isDark ? hslToHex(h,  8, 12) : hslToHex(h,  5, 92);
    const slideDim   = isDark ? hslToHex(h,  6, 48) : hslToHex(h,  5, 56);

    return { accent, accent2, glyph, dim, dimmer, bg, panel, border, ink,
             slide, slideGlyph, slideInk, slideDim };
  }

  // ── Apply ──────────────────────────────────────────────────────────────────

  let triggerGlyphRef = null;

  function applyPalette() {
    const isDark = document.documentElement.dataset.theme !== 'light';
    const { accent, accent2, glyph, dim, dimmer, bg, panel, border, ink,
            slide, slideGlyph, slideInk, slideDim } =
      computePalette(state.h, state.s, state.type, isDark);

    const r = document.documentElement;
    // Accent colours
    r.style.setProperty('--color-accent',       accent);
    r.style.setProperty('--color-accent2',      accent2);
    // Neutrals
    r.style.setProperty('--color-glyph',        glyph);
    r.style.setProperty('--color-dim',          dim);
    r.style.setProperty('--color-dimmer',       dimmer);
    // Surfaces — overrides both :root and [data-theme="light"] rules
    r.style.setProperty('--color-bg',           bg);
    r.style.setProperty('--color-panel',        panel);
    r.style.setProperty('--color-border',       border);
    r.style.setProperty('--color-ink',          ink);
    // Slide card: flipped surface + dedicated element colours
    r.style.setProperty('--color-slide',        slide);
    r.style.setProperty('--color-slide-glyph',  slideGlyph);
    r.style.setProperty('--color-slide-ink',    slideInk);
    r.style.setProperty('--color-slide-dim',    slideDim);

    if (triggerGlyphRef) {
      triggerGlyphRef.style.color = accent;
      triggerGlyphRef.style.filter = `drop-shadow(0 0 5px ${accent}) drop-shadow(0 0 2px ${accent})`;
    }
  }

  // ── Widget CSS ─────────────────────────────────────────────────────────────

  const WIDGET_CSS = `
    .pal-widget {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    .pal-trigger {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0 2px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pal-trigger .sym {
      font-size: 42px;
      line-height: 1;
      display: block;
      transition: color 0.25s, filter 0.25s;
    }
    .pal-trigger:hover .sym {
      filter: brightness(1.25) drop-shadow(0 0 10px currentColor) !important;
    }

    .pal-panel {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: 228px;
      background: var(--color-panel);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      padding: 1rem 0.9rem;
      display: flex;
      flex-direction: column;
      gap: 0.7rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.45);
      z-index: 9000;
    }
    .pal-panel[hidden] { display: none; }

    .pal-section-label {
      font-family: ui-sans-serif, system-ui, sans-serif;
      font-size: 0.55rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-dim);
    }

    .pal-swatches {
      display: flex;
      gap: 0.35rem;
      align-items: center;
    }
    .pal-swatch {
      width: 22px;
      height: 22px;
      border-radius: 5px;
      border: 2px solid transparent;
      cursor: pointer;
      flex-shrink: 0;
      transition: transform 0.12s, border-color 0.15s;
      outline: none;
    }
    .pal-swatch:hover { transform: scale(1.18); }
    .pal-swatch.active {
      border-color: var(--color-ink);
      transform: scale(1.1);
    }

    .pal-hex {
      flex: 1;
      min-width: 0;
      background: color-mix(in srgb, var(--color-bg) 80%, var(--color-panel));
      border: 1px solid var(--color-border);
      border-radius: 5px;
      color: var(--color-ink);
      font-family: ui-monospace, "SF Mono", monospace;
      font-size: 0.65rem;
      padding: 0.22rem 0.45rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .pal-hex:focus { border-color: var(--color-accent); }
    .pal-hex::placeholder { color: var(--color-dimmer); }

    .pal-types {
      display: flex;
      flex-wrap: wrap;
      gap: 0.28rem;
    }
    .pal-type-btn {
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: color-mix(in srgb, var(--color-bg) 70%, var(--color-panel));
      border: 1px solid var(--color-border);
      border-radius: 20px;
      color: var(--color-dim);
      font-size: 0.6rem;
      letter-spacing: 0.03em;
      padding: 0.18rem 0.55rem;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      outline: none;
    }
    .pal-type-btn:hover { color: var(--color-ink); border-color: var(--color-dim); }
    .pal-type-btn.active {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: var(--color-bg);
      font-weight: 600;
    }
  `;

  // ── Widget builder ─────────────────────────────────────────────────────────

  function buildWidget() {
    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;
    document.head.appendChild(style);

    const widget = document.createElement('div');
    widget.className = 'pal-widget';

    // ── Trigger (Q swatch) ──
    const trigger = document.createElement('button');
    trigger.className = 'pal-trigger';
    trigger.setAttribute('aria-label', 'Colour palette');
    trigger.title = 'Colour palette';

    const glyph = document.createElement('span');
    glyph.className = 'sym';
    glyph.style.fontVariationSettings = "'wght' 500,'MORF' 900";
    glyph.textContent = 'Q';
    trigger.appendChild(glyph);
    triggerGlyphRef = glyph;

    // ── Panel ──
    const panel = document.createElement('div');
    panel.className = 'pal-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Colour palette controls');

    // Section: primary colour
    const swatchLabel = el('div', 'pal-section-label', 'Primary colour');
    const swatchRow = el('div', 'pal-swatches');

    // 5 preset swatches
    PRESETS.forEach(({ name, h, s }) => {
      const btn = el('button', 'pal-swatch');
      btn.title = name;
      const swatchHex = hslToHex(h, s, 60);
      btn.style.background = swatchHex;
      if (h === state.h) btn.classList.add('active');
      btn.addEventListener('click', () => {
        state.h = h;
        state.s = s;
        hexInput.value = hslToHex(h, s, 60);
        swatchRow.querySelectorAll('.pal-swatch').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        saveState(state);
        applyPalette();
      });
      swatchRow.appendChild(btn);
    });

    // Custom hex input
    const hexInput = el('input', 'pal-hex');
    hexInput.type = 'text';
    hexInput.maxLength = 7;
    hexInput.placeholder = '#5eead4';
    hexInput.value = hslToHex(state.h, state.s, 60);
    hexInput.setAttribute('aria-label', 'Custom hex colour');
    hexInput.addEventListener('input', () => {
      const v = hexInput.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        const [h, s] = hexToHsl(v);
        state.h = h;
        state.s = s;
        swatchRow.querySelectorAll('.pal-swatch').forEach(b => b.classList.remove('active'));
        saveState(state);
        applyPalette();
      }
    });
    swatchRow.appendChild(hexInput);

    // Section: palette type
    const typeLabel = el('div', 'pal-section-label', 'Palette type');
    const typeRow = el('div', 'pal-types');

    TYPES.forEach(({ id, label }) => {
      const btn = el('button', 'pal-type-btn' + (id === state.type ? ' active' : ''));
      btn.textContent = label;
      btn.addEventListener('click', () => {
        state.type = id;
        typeRow.querySelectorAll('.pal-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        saveState(state);
        applyPalette();
      });
      typeRow.appendChild(btn);
    });

    panel.append(swatchLabel, swatchRow, typeLabel, typeRow);
    widget.append(trigger, panel);

    // Toggle
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
    });
    document.addEventListener('click', () => { panel.hidden = true; });
    panel.addEventListener('click', e => e.stopPropagation());

    return widget;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    const widget = buildWidget();
    const themeToggle = navRight.querySelector('#theme-toggle');
    navRight.insertBefore(widget, themeToggle);

    applyPalette();

    // Re-compute when theme flips
    new MutationObserver(() => applyPalette()).observe(
      document.documentElement,
      { attributes: true, attributeFilter: ['data-theme'] }
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
