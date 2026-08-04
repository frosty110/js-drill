/*
 * Reusable static-infographic cards, study sets, and full-screen workspace.
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
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      drill-infographic{display:block;margin:22px 0 4px}
      drill-infographic-set{display:block;margin:22px 0 6px}
      .infographic-card{overflow:hidden;background:var(--ds-surface-2,#1b1e24);border:1px solid var(--panel-2,#343840);border-radius:var(--radius-lg,14px)}
      .infographic-card__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 16px 12px;border-bottom:1px solid var(--panel-2,#343840)}
      .infographic-card__eyebrow{display:block;color:var(--accent,#f5b62b);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px}
      .infographic-card__head h3{margin:0;color:var(--text-strong,#f4f5f7);font-size:17px;line-height:1.3}
      .infographic-card__prompt{margin:4px 0 0;color:var(--muted,#a7adb7);font-size:12px;line-height:1.45}
      .infographic-card__badge{flex:none;border:1px solid var(--panel-2,#343840);border-radius:999px;padding:4px 8px;color:var(--muted,#a7adb7);background:var(--panel,#22262d);font-size:10px;font-weight:700}
      .infographic-card__preview{display:block;width:100%;border:0;padding:0;background:var(--ds-code-bg,#111318);cursor:zoom-in;text-align:center}
      .infographic-card__preview img{display:block;width:100%;height:auto;object-fit:contain}
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
      .infographic-set{border:1px solid var(--panel-2,#343840);border-radius:var(--radius-lg,14px);background:var(--ds-surface-2,#1b1e24);overflow:hidden}
      .infographic-set__head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px;border-bottom:1px solid var(--panel-2,#343840);background:linear-gradient(135deg,rgba(245,182,43,.08),transparent 55%)}
      .infographic-set__eyebrow{display:block;color:var(--accent,#f5b62b);font-size:10px;font-weight:850;letter-spacing:.09em;text-transform:uppercase;margin-bottom:4px}
      .infographic-set__head h3{margin:0;color:var(--text-strong,#f4f5f7);font-size:19px;line-height:1.3}
      .infographic-set__head p{margin:7px 0 0;color:var(--muted,#a7adb7);font-size:13px;line-height:1.5;max-width:650px}
      .infographic-set__count{flex:none;border:1px solid var(--panel-2,#343840);border-radius:999px;background:var(--panel,#22262d);color:var(--text-strong,#f4f5f7);font-size:11px;font-weight:800;padding:5px 9px;white-space:nowrap}
      .infographic-study{padding:20px 18px 24px;border-bottom:1px solid var(--panel-2,#343840)}
      .infographic-study:last-child{border-bottom:0}
      .infographic-study__head{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:start;margin-bottom:10px}
      .infographic-study__index{grid-row:1/4;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--ds-accent-soft,#413515);color:var(--ds-accent-hi,#ffd36b);font-size:13px;font-weight:900}
      .infographic-study__kind{font-size:10px;line-height:1.2;text-transform:uppercase;letter-spacing:.08em;color:var(--accent,#f5b62b);font-weight:800}
      .infographic-study__head h4{margin:0;color:var(--text-strong,#f4f5f7);font-size:18px;line-height:1.3}
      .infographic-study__purpose{margin:2px 0 0;color:var(--muted,#a7adb7);font-size:12px;line-height:1.45}
      .infographic-study__description{margin:12px 0 16px;padding:12px 14px;border-left:3px solid var(--accent,#f5b62b);background:var(--panel,#22262d);border-radius:0 8px 8px 0;color:var(--text,#d9dce1);font-size:13.5px;line-height:1.55}
      .infographic-study__guide{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(240px,.8fr);gap:14px;margin-bottom:16px}
      .infographic-study__panel{border:1px solid var(--panel-2,#343840);border-radius:10px;background:var(--ds-code-bg,#111318);padding:14px}
      .infographic-study__panel h5{margin:0 0 10px;color:var(--muted,#a7adb7);font-size:10px;text-transform:uppercase;letter-spacing:.08em}
      .infographic-flow{list-style:none;padding:0;margin:0;display:grid;gap:10px}
      .infographic-flow li{display:grid;grid-template-columns:28px 1fr;gap:9px;align-items:start}
      .infographic-flow__step{width:27px;height:27px;border:1px solid var(--accent,#f5b62b);border-radius:50%;display:grid;place-items:center;color:var(--accent,#f5b62b);font-size:11px;font-weight:900}
      .infographic-flow strong{display:block;color:var(--text-strong,#f4f5f7);font-size:12.5px;line-height:1.35}
      .infographic-flow p{margin:2px 0 0;color:var(--muted,#a7adb7);font-size:12px;line-height:1.45}
      .infographic-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:14px}
      .infographic-fact{border-left:2px solid var(--accent,#f5b62b);padding:2px 0 2px 8px;min-width:0}
      .infographic-fact strong{display:block;color:var(--text-strong,#f4f5f7);font-size:13px;line-height:1.25}
      .infographic-fact span{display:block;color:var(--accent,#f5b62b);font-size:10px;font-weight:750;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
      .infographic-fact small{display:block;color:var(--muted,#a7adb7);font-size:10.5px;line-height:1.35;margin-top:3px}
      .infographic-bullets{margin:0;padding-left:17px;color:var(--text,#d9dce1)}
      .infographic-bullets li{margin:5px 0;font-size:11.5px;line-height:1.45}
      .infographic-bullets--tradeoffs li::marker{color:var(--bad,#ff765d)}
      .infographic-study drill-infographic{margin:0}
      .infographic-card--compact{border-radius:10px}
      @media(max-width:620px){
        drill-infographic{margin-left:-4px;margin-right:-4px}
        drill-infographic-set{margin-left:-4px;margin-right:-4px}
        .infographic-card__head{padding:14px 12px 11px}
        .infographic-set__head{padding:15px 13px;gap:10px}
        .infographic-set__head h3{font-size:17px}
        .infographic-set__count{font-size:10px;padding:4px 7px}
        .infographic-study{padding:17px 12px 21px}
        .infographic-study__guide{grid-template-columns:1fr}
        .infographic-study__description{font-size:13px}
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
            <button class="infographic-viewer__button" type="button" data-action="copy-link" title="Copy a link to this sheet">Link</button>
            <a class="infographic-viewer__button" data-action="download" title="Download PNG">↓ PNG</a>
          </div>
          <button class="infographic-viewer__button infographic-viewer__button--close" type="button" data-action="close" aria-label="Close infographic">${dsIcon('x', 18)}</button>
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
      this.root.querySelector('[data-action="copy-link"]').addEventListener('click', e => this.copyLink(e.currentTarget));
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

    open({ src, title, alt, downloadName, opener, sheetId }) {
      this.opener = opener || document.activeElement;
      this.sheetId = sheetId || null;
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
      // Announce so a host page can put the open sheet in the URL. The viewer
      // stays route-agnostic; system-design.html owns the hash.
      document.dispatchEvent(new CustomEvent('drill-infographic-open', {
        detail: { sheetId: this.sheetId, src, title }
      }));
    }

    // Why this button exists: the app is installed as a PWA (display:standalone)
    // and read on a phone ~80% of the time, so for most of its use there is NO
    // ADDRESS BAR. Routing the sheet into the URL is necessary but useless on
    // its own — without a way to get the URL back out, the user cannot hand it
    // to anyone. Copies the STATIC page URL, not the app hash, because the
    // recipient is usually an AI that has to be able to fetch it.
    copyLink(button) {
      const url = this.shareUrl();
      if (!url) return;
      const done = ok => {
        const was = button.textContent;
        button.textContent = ok ? 'Copied' : 'Copy failed';
        setTimeout(() => { button.textContent = was; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => done(true), () => done(false));
      } else {
        // Clipboard API needs a secure context; older iOS Safari lands here.
        try {
          const ta = document.createElement('textarea');
          ta.value = url; ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;top:-1000px';
          document.body.appendChild(ta); ta.select();
          done(document.execCommand('copy'));
          ta.remove();
        } catch (_) { done(false); }
      }
    }

    // Read the sheet straight off the current route. The host page has already
    // written it there — that is the contract this button depends on — so there
    // is nothing extra to thread through, and the two can't disagree.
    shareUrl() {
      const R = window.DrillRoutes;
      if (!R) return window.location.href;
      try {
        const hit = R.parseAppHash(window.location.hash, 'system-design.html');
        if (hit && hit.kind === 'sdSheet') return R.shareUrl('sdSheet', hit.params);
      } catch (_) { /* fall through to the raw URL */ }
      return window.location.href;
    }

    close() {
      if (this.root.hidden) return;
      this.root.hidden = true;
      document.body.style.overflow = this.previousOverflow;
      this.pointers.clear();
      if (this.opener && typeof this.opener.focus === 'function') this.opener.focus();
      const sheetId = this.sheetId;
      this.sheetId = null;
      document.dispatchEvent(new CustomEvent('drill-infographic-close', { detail: { sheetId } }));
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
      const eyebrow = this.getAttribute('eyebrow') || 'Lesson infographic';
      const heading = this.getAttribute('heading') || title;
      const description = this.getAttribute('description') || 'Tap to explore · zoom, drag, download, or save locally';
      const width = Number(this.getAttribute('image-width')) || 1600;
      const height = Number(this.getAttribute('image-height')) || 2000;
      const compact = this.hasAttribute('compact');
      const sheetId = this.getAttribute('sheet-id') || null;
      this.innerHTML = `
        <article class="infographic-card${compact ? ' infographic-card--compact' : ''}">
          ${compact ? '' : `<div class="infographic-card__head">
            <div>
              <span class="infographic-card__eyebrow">${escapeHtml(eyebrow)}</span>
              <h3>${escapeHtml(heading)}</h3>
              <p class="infographic-card__prompt">${escapeHtml(description)}</p>
            </div>
            <span class="infographic-card__badge">PNG</span>
          </div>`}
          <button class="infographic-card__preview" type="button" aria-label="Open ${this.escape(title)} infographic full screen">
            <img src="${this.escape(src)}" alt="${this.escape(alt)}" loading="lazy" width="${width}" height="${height}">
          </button>
          <div class="infographic-card__actions">
            <button class="ds-btn ds-btn--ghost infographic-card__open" type="button">Explore full screen</button>
            <a class="ds-btn ds-btn--primary" href="${this.escape(src)}" download="${this.escape(downloadName)}">Download PNG</a>
          </div>
        </article>`;
      const open = event => sharedWorkspace().open({ src, title, alt, downloadName, sheetId, opener: event.currentTarget });
      this.querySelector('.infographic-card__preview').addEventListener('click', open);
      this.querySelector('.infographic-card__open').addEventListener('click', open);
    }

    escape(value) {
      return escapeHtml(value);
    }
  }

  class DrillInfographicSet extends HTMLElement {
    set data(value) {
      this._data = value;
      this.render();
    }

    get data() { return this._data; }

    connectedCallback() {
      installStyles();
      this.render();
    }

    renderBullets(items, extraClass = '') {
      if (!Array.isArray(items) || !items.length) return '';
      return `<ul class="infographic-bullets ${extraClass}">${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }

    // `summary` and `purpose` are optional by design — see the FILLER gate in
    // tools/validate-system-design.js. They were once required, which produced
    // 146 auto-derived strings that restated the title back at the reader, so
    // absent now means "nothing worth saying" rather than "render a template".
    render() {
      if (!this.isConnected || !this._data || !Array.isArray(this._data.items)) return;
      const set = this._data;
      const items = set.items;
      this.innerHTML = `<section class="infographic-set" aria-label="${escapeHtml(set.title)}">
        <header class="infographic-set__head">
          <div><span class="infographic-set__eyebrow">Visual study set</span><h3>${escapeHtml(set.title)}</h3>${set.summary ? `<p>${escapeHtml(set.summary)}</p>` : ''}</div>
          <span class="infographic-set__count">${items.length} graphic${items.length === 1 ? '' : 's'}</span>
        </header>
        <div class="infographic-set__items">${items.map((item, index) => {
          const flow = (item.flow || []).map(step => `<li><span class="infographic-flow__step">${escapeHtml(step.step)}</span><div><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.detail)}</p></div></li>`).join('');
          const facts = (item.numbers || []).map(fact => `<div class="infographic-fact"><strong>${escapeHtml(fact.value)}</strong><span>${escapeHtml(fact.label)}</span><small>${escapeHtml(fact.detail)}</small></div>`).join('');
          return `<article class="infographic-study">
            <header class="infographic-study__head"><span class="infographic-study__index">${index + 1}</span><span class="infographic-study__kind">${escapeHtml(item.kind)}</span><h4>${escapeHtml(item.title)}</h4>${item.purpose ? `<p class="infographic-study__purpose">${escapeHtml(item.purpose)}</p>` : ''}</header>
            <p class="infographic-study__description">${escapeHtml(item.description)}</p>
            <div class="infographic-study__guide">
              <section class="infographic-study__panel"><h5>Trace the flow</h5><ol class="infographic-flow">${flow}</ol></section>
              <aside class="infographic-study__panel">
                ${facts ? `<h5>Scale and numbers</h5><div class="infographic-facts">${facts}</div>` : ''}
                <h5>Priorities</h5>${this.renderBullets(item.priorities)}
                <h5 style="margin-top:14px">Trade-offs</h5>${this.renderBullets(item.tradeoffs, 'infographic-bullets--tradeoffs')}
              </aside>
            </div>
            <drill-infographic compact sheet-id="${escapeHtml(item.id)}" src="${escapeHtml(item.src)}" title="${escapeHtml(item.title)}" alt="${escapeHtml(item.alt)}" download-name="${escapeHtml(item.downloadName)}" image-width="${Number(item.width) || 1600}" image-height="${Number(item.height) || 2000}"></drill-infographic>
          </article>`;
        }).join('')}</div>
      </section>`;
    }
  }

  installStyles();
  customElements.define('drill-infographic', DrillInfographic);
  customElements.define('drill-infographic-set', DrillInfographicSet);
  window.DrillInfographicViewer = { open: options => sharedWorkspace().open(options) };
})();
