/*
 * Reusable static-infographic card + full-screen image workspace.
 *
 * Usage:
 *   <drill-infographic src="...png" title="Caching" download-name="caching.png"></drill-infographic>
 *
 * One shared viewer serves every card. It supports fit-to-screen, actual 100%
 * pixels, incremental zoom, wheel/pinch zoom, pointer drag, download, Escape,
 * backdrop close, and focus restoration. No framework dependency.
 */
(function () {
  'use strict';

  const STYLE_ID = 'drill-infographic-styles';
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      drill-infographic{display:block;margin:22px 0 4px}
      .infographic-card{overflow:hidden;background:var(--ds-surface-2,#1b1e24);border:1px solid var(--panel-2,#343840);border-radius:var(--radius-lg,14px)}
      .infographic-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 16px 12px;border-bottom:1px solid var(--panel-2,#343840)}
      .infographic-card__eyebrow{display:block;color:var(--accent,#f5b62b);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px}
      .infographic-card__head h3{margin:0;color:var(--text-strong,#f4f5f7);font-size:17px;line-height:1.3}
      .infographic-card__prompt{margin:4px 0 0;color:var(--muted,#a7adb7);font-size:12px;line-height:1.45}
      .infographic-card__badge{flex:none;border:1px solid var(--panel-2,#343840);border-radius:999px;padding:4px 8px;color:var(--muted,#a7adb7);background:var(--panel,#22262d);font-size:10px;font-weight:700}
      .infographic-card__preview{display:block;width:100%;border:0;padding:0;background:var(--ds-code-bg,#111318);cursor:zoom-in;text-align:center}
      .infographic-card__preview img{display:block;width:100%;height:auto;aspect-ratio:4/5;object-fit:contain}
      .infographic-card__actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;border-top:1px solid var(--panel-2,#343840)}
      .infographic-card__actions .ds-btn{min-height:44px;text-decoration:none}
      .infographic-card__actions .ds-btn:hover{text-decoration:none}
      .infographic-viewer[hidden]{display:none}
      .infographic-viewer{position:fixed;inset:0;z-index:1000;display:grid;grid-template-rows:auto 1fr;background:rgba(8,9,12,.97);color:#f4f5f7;overscroll-behavior:none}
      .infographic-viewer__bar{display:flex;align-items:center;gap:8px;min-height:64px;padding:8px 12px;background:#181b21;border-bottom:1px solid #343840;box-shadow:0 4px 20px rgba(0,0,0,.35)}
      .infographic-viewer__title{flex:1;min-width:0;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .infographic-viewer__controls{display:flex;gap:6px;align-items:center}
      .infographic-viewer__button{min-width:44px;height:44px;padding:0 12px;border:1px solid #3a404b;border-radius:8px;background:#242832;color:#f4f5f7;font:700 13px/1 system-ui,sans-serif;cursor:pointer;display:inline-grid;place-items:center;text-decoration:none;touch-action:manipulation}
      .infographic-viewer__button:hover,.infographic-viewer__button:focus-visible{border-color:#f5b62b;outline:none}
      .infographic-viewer__button--close{font-size:25px;padding:0;min-width:44px;background:#342a12;border-color:#725716}
      .infographic-viewer__stage{position:relative;overflow:hidden;min-width:0;min-height:0;cursor:grab;touch-action:none;user-select:none;background-color:#0e1014;background-image:linear-gradient(#1a1e25 1px,transparent 1px),linear-gradient(90deg,#1a1e25 1px,transparent 1px);background-size:32px 32px}
      .infographic-viewer__stage.is-dragging{cursor:grabbing}
      .infographic-viewer__image{position:absolute;left:0;top:0;width:auto;height:auto;max-width:none;max-height:none;transform-origin:0 0;will-change:transform;pointer-events:none;box-shadow:0 16px 60px rgba(0,0,0,.55)}
      .infographic-viewer__help{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);padding:6px 10px;border-radius:999px;background:rgba(17,19,24,.82);color:#a7adb7;font:600 11px/1.2 system-ui,sans-serif;pointer-events:none;white-space:nowrap}
      @media(max-width:620px){
        drill-infographic{margin-left:-4px;margin-right:-4px}
        .infographic-card__head{padding:14px 12px 11px}
        .infographic-viewer__bar{padding:7px;gap:6px;flex-wrap:wrap}
        .infographic-viewer__title{flex-basis:calc(100% - 52px);order:0}
        .infographic-viewer__controls{order:2;width:100%;display:grid;grid-template-columns:repeat(5,1fr)}
        .infographic-viewer__button--close{order:1}
        .infographic-viewer__controls .infographic-viewer__button{padding:0;min-width:0}
        .infographic-viewer__help{bottom:8px}
      }
    `;
    document.head.appendChild(style);
  }

  class InfographicWorkspace {
    constructor() {
      this.scale = 1;
      this.x = 0;
      this.y = 0;
      this.fitScale = 1;
      this.pointers = new Map();
      this.dragOrigin = null;
      this.pinchOrigin = null;
      this.opener = null;
      this.previousOverflow = '';
      this.root = document.createElement('div');
      this.root.className = 'infographic-viewer';
      this.root.hidden = true;
      this.root.setAttribute('role', 'dialog');
      this.root.setAttribute('aria-modal', 'true');
      this.root.setAttribute('aria-label', 'Infographic viewer');
      this.root.innerHTML = `
        <div class="infographic-viewer__bar">
          <div class="infographic-viewer__title"></div>
          <div class="infographic-viewer__controls">
            <button class="infographic-viewer__button" type="button" data-action="fit" title="Fit image to screen">Fit</button>
            <button class="infographic-viewer__button" type="button" data-action="actual" title="View at one image pixel per screen pixel">100%</button>
            <button class="infographic-viewer__button" type="button" data-action="out" aria-label="Zoom out">−</button>
            <button class="infographic-viewer__button" type="button" data-action="in" aria-label="Zoom in">+</button>
            <a class="infographic-viewer__button" data-action="download" title="Download PNG">↓ PNG</a>
          </div>
          <button class="infographic-viewer__button infographic-viewer__button--close" type="button" data-action="close" aria-label="Close infographic">×</button>
        </div>
        <div class="infographic-viewer__stage">
          <img class="infographic-viewer__image" alt="">
          <div class="infographic-viewer__help">Drag to pan · wheel or pinch to zoom · Esc to close</div>
        </div>`;
      document.body.appendChild(this.root);
      this.stage = this.root.querySelector('.infographic-viewer__stage');
      this.image = this.root.querySelector('.infographic-viewer__image');
      this.titleNode = this.root.querySelector('.infographic-viewer__title');
      this.closeButton = this.root.querySelector('[data-action="close"]');
      this.download = this.root.querySelector('[data-action="download"]');
      this.bind();
    }

    bind() {
      this.root.querySelector('[data-action="fit"]').addEventListener('click', () => this.fit());
      this.root.querySelector('[data-action="actual"]').addEventListener('click', () => this.actual());
      this.root.querySelector('[data-action="in"]').addEventListener('click', () => this.zoomAt(1.25));
      this.root.querySelector('[data-action="out"]').addEventListener('click', () => this.zoomAt(0.8));
      this.closeButton.addEventListener('click', () => this.close());
      this.stage.addEventListener('dblclick', event => {
        if (Math.abs(this.scale - this.fitScale) < .01) this.zoomAt(1 / this.scale, event.clientX, event.clientY);
        else this.fit();
      });
      this.stage.addEventListener('wheel', event => {
        event.preventDefault();
        this.zoomAt(Math.exp(-event.deltaY * .0015), event.clientX, event.clientY);
      }, { passive: false });
      this.stage.addEventListener('pointerdown', event => this.pointerDown(event));
      this.stage.addEventListener('pointermove', event => this.pointerMove(event));
      this.stage.addEventListener('pointerup', event => this.pointerUp(event));
      this.stage.addEventListener('pointercancel', event => this.pointerUp(event));
      window.addEventListener('resize', () => { if (!this.root.hidden) this.fit(); });
      document.addEventListener('keydown', event => {
        if (this.root.hidden) return;
        if (event.key === 'Tab') {
          const focusable = [...this.root.querySelectorAll('button, a[href]')];
          const first = focusable[0], last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          return;
        }
        if (event.key === 'Escape') { event.preventDefault(); this.close(); }
        if (event.key === '+' || event.key === '=') { event.preventDefault(); this.zoomAt(1.25); }
        if (event.key === '-') { event.preventDefault(); this.zoomAt(.8); }
        if (event.key === '0') { event.preventDefault(); this.fit(); }
        if (event.key === '1') { event.preventDefault(); this.actual(); }
      });
    }

    open({ src, title, alt, downloadName, opener }) {
      this.opener = opener || document.activeElement;
      this.titleNode.textContent = title;
      this.image.alt = alt;
      this.download.href = src;
      this.download.download = downloadName;
      this.previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.root.hidden = false;
      this.image.onload = () => this.fit();
      this.image.src = src;
      if (this.image.complete && this.image.naturalWidth) this.fit();
      this.closeButton.focus();
    }

    close() {
      if (this.root.hidden) return;
      this.root.hidden = true;
      document.body.style.overflow = this.previousOverflow;
      this.pointers.clear();
      if (this.opener && typeof this.opener.focus === 'function') this.opener.focus();
    }

    fit() {
      if (!this.image.naturalWidth || !this.stage.clientWidth) return;
      const pad = Math.min(32, this.stage.clientWidth * .035);
      this.fitScale = Math.min(
        (this.stage.clientWidth - pad * 2) / this.image.naturalWidth,
        (this.stage.clientHeight - pad * 2) / this.image.naturalHeight
      );
      this.scale = this.fitScale;
      this.center();
    }

    actual() {
      this.scale = 1;
      this.center();
    }

    center() {
      this.x = (this.stage.clientWidth - this.image.naturalWidth * this.scale) / 2;
      this.y = (this.stage.clientHeight - this.image.naturalHeight * this.scale) / 2;
      this.paint();
    }

    zoomAt(factor, clientX, clientY) {
      if (!this.image.naturalWidth) return;
      const rect = this.stage.getBoundingClientRect();
      const px = clientX == null ? rect.left + rect.width / 2 : clientX;
      const py = clientY == null ? rect.top + rect.height / 2 : clientY;
      const localX = px - rect.left;
      const localY = py - rect.top;
      const imageX = (localX - this.x) / this.scale;
      const imageY = (localY - this.y) / this.scale;
      const next = clamp(this.scale * factor, Math.min(this.fitScale * .5, .1), 4);
      this.x = localX - imageX * next;
      this.y = localY - imageY * next;
      this.scale = next;
      this.paint();
    }

    paint() {
      this.image.style.transform = `translate(${this.x}px,${this.y}px) scale(${this.scale})`;
    }

    pointerDown(event) {
      try { this.stage.setPointerCapture(event.pointerId); } catch (error) { /* synthetic/legacy pointer */ }
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.stage.classList.add('is-dragging');
      if (this.pointers.size === 1) this.dragOrigin = { px: event.clientX, py: event.clientY, x: this.x, y: this.y };
      if (this.pointers.size === 2) this.startPinch();
    }

    pointerMove(event) {
      if (!this.pointers.has(event.pointerId)) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.pointers.size === 2) {
        const points = [...this.pointers.values()];
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        const cx = (points[0].x + points[1].x) / 2;
        const cy = (points[0].y + points[1].y) / 2;
        if (this.pinchOrigin && this.pinchOrigin.distance) {
          const target = clamp(this.pinchOrigin.scale * distance / this.pinchOrigin.distance, Math.min(this.fitScale * .5, .1), 4);
          this.scale = this.pinchOrigin.scale;
          this.x = this.pinchOrigin.x;
          this.y = this.pinchOrigin.y;
          this.zoomAt(target / this.scale, cx, cy);
        }
      } else if (this.dragOrigin) {
        this.x = this.dragOrigin.x + event.clientX - this.dragOrigin.px;
        this.y = this.dragOrigin.y + event.clientY - this.dragOrigin.py;
        this.paint();
      }
    }

    pointerUp(event) {
      this.pointers.delete(event.pointerId);
      if (!this.pointers.size) {
        this.dragOrigin = null;
        this.pinchOrigin = null;
        this.stage.classList.remove('is-dragging');
      } else {
        const point = [...this.pointers.values()][0];
        this.dragOrigin = { px: point.x, py: point.y, x: this.x, y: this.y };
        this.pinchOrigin = null;
      }
    }

    startPinch() {
      const points = [...this.pointers.values()];
      this.pinchOrigin = {
        distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        scale: this.scale, x: this.x, y: this.y
      };
      this.dragOrigin = null;
    }
  }

  let workspace;
  function sharedWorkspace() {
    if (!workspace) workspace = new InfographicWorkspace();
    return workspace;
  }

  class DrillInfographic extends HTMLElement {
    connectedCallback() {
      if (this.dataset.ready) return;
      this.dataset.ready = 'true';
      installStyles();
      const src = this.getAttribute('src');
      const title = this.getAttribute('title') || 'System design';
      const downloadName = this.getAttribute('download-name') || 'system-design-infographic.png';
      const alt = this.getAttribute('alt') || `Quick-review infographic for ${title}`;
      this.innerHTML = `
        <article class="infographic-card">
          <div class="infographic-card__head">
            <div>
              <span class="infographic-card__eyebrow">Lesson infographic</span>
              <h3>Quick-review study sheet</h3>
              <p class="infographic-card__prompt">Tap to explore · zoom, drag, download, or save locally</p>
            </div>
            <span class="infographic-card__badge">PNG</span>
          </div>
          <button class="infographic-card__preview" type="button" aria-label="Open ${this.escape(title)} infographic full screen">
            <img src="${this.escape(src)}" alt="${this.escape(alt)}" loading="lazy" width="1600" height="2000">
          </button>
          <div class="infographic-card__actions">
            <button class="ds-btn ds-btn--ghost infographic-card__open" type="button">Explore full screen</button>
            <a class="ds-btn ds-btn--primary" href="${this.escape(src)}" download="${this.escape(downloadName)}">Download PNG</a>
          </div>
        </article>`;
      const open = event => sharedWorkspace().open({ src, title, alt, downloadName, opener: event.currentTarget });
      this.querySelector('.infographic-card__preview').addEventListener('click', open);
      this.querySelector('.infographic-card__open').addEventListener('click', open);
    }

    escape(value) {
      return String(value || '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[character]));
    }
  }

  installStyles();
  customElements.define('drill-infographic', DrillInfographic);
  window.DrillInfographicViewer = { open: options => sharedWorkspace().open(options) };
})();
