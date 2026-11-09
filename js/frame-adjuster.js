/**
 * NotSCRL Manual Frame & Shape Adjuster Tool
 * Allows the user to manually reposition (pan) and zoom photos inside any shape mask
 * (Circle, Star, Heart, Arch, Flower, Polaroid, Film 35mm, or Rounded Rect).
 */

export class FrameAdjuster {
  constructor(engine) {
    this.engine = engine;
    this.targetItem = null;

    this.modal = document.getElementById('frame-modal');
    this.canvas = document.getElementById('frame-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.zoomSlider = document.getElementById('frame-zoom-slider');
    this.zoomLabel = document.getElementById('frame-zoom-val');

    // Pan offset normalized (-1 to 1) and Zoom factor (1.0 to 3.5)
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;

    // Interaction dragging state
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.initialPan = { x: 0, y: 0 };

    this.bindEvents();
  }

  bindEvents() {
    if (!this.modal) return;

    // Close button
    const closeBtn = document.getElementById('btn-close-frame-adjust');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Reset / Center button
    const resetBtn = document.getElementById('btn-frame-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.panX = 0;
        this.panY = 0;
        this.zoom = 1.0;
        if (this.zoomSlider) this.zoomSlider.value = 1.0;
        if (this.zoomLabel) this.zoomLabel.textContent = '1.0x';
        this.renderPreview();
      });
    }

    // Apply button
    const applyBtn = document.getElementById('btn-frame-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyAdjustment());
    }

    // Zoom slider
    if (this.zoomSlider) {
      this.zoomSlider.addEventListener('input', (e) => {
        this.zoom = parseFloat(e.target.value) || 1.0;
        if (this.zoomLabel) this.zoomLabel.textContent = `${this.zoom.toFixed(1)}x`;
        this.renderPreview();
      });
    }

    // Canvas Mouse & Touch Dragging
    this.bindCanvasInteractions();
  }

  bindCanvasInteractions() {
    const canvas = this.canvas;
    if (!canvas) return;

    const onStart = (clientX, clientY) => {
      this.isDragging = true;
      this.dragStart = { x: clientX, y: clientY };
      this.initialPan = { x: this.panX, y: this.panY };
    };

    const onMove = (clientX, clientY) => {
      if (!this.isDragging) return;
      const dx = clientX - this.dragStart.x;
      const dy = clientY - this.dragStart.y;

      // Sensitivity factor relative to canvas size and zoom
      const sensitivity = 0.008 / Math.max(0.5, this.zoom * 0.8);
      this.panX = Math.max(-1.0, Math.min(1.0, this.initialPan.x - dx * sensitivity));
      this.panY = Math.max(-1.0, Math.min(1.0, this.initialPan.y - dy * sensitivity));

      this.renderPreview();
    };

    const onEnd = () => {
      this.isDragging = false;
    };

    // Mouse
    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onStart(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) onMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) onEnd();
    });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        onStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      if (this.isDragging) onEnd();
    });
  }

  open(imageItem) {
    if (!imageItem || imageItem.type !== 'image') return;
    this.targetItem = imageItem;

    const fit = imageItem.fitOffset || { x: 0, y: 0, zoom: 1.0 };
    this.panX = fit.x || 0;
    this.panY = fit.y || 0;
    this.zoom = fit.zoom || 1.0;

    if (this.zoomSlider) this.zoomSlider.value = this.zoom;
    if (this.zoomLabel) this.zoomLabel.textContent = `${this.zoom.toFixed(1)}x`;

    this.modal.classList.remove('hidden');

    // Layout canvas dimensions
    setTimeout(() => {
      this.resizeCanvas();
      this.renderPreview();
    }, 40);
  }

  resizeCanvas() {
    const wrap = document.getElementById('frame-canvas-wrap');
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const size = Math.min(380, Math.max(260, Math.min(rect.width - 24, rect.height - 24)));

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;

    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.stageSize = size;
  }

  renderPreview() {
    if (!this.ctx || !this.targetItem || !this.stageSize) return;

    const ctx = this.ctx;
    const S = this.stageSize;
    ctx.clearRect(0, 0, S, S);

    // Dark backdrop
    ctx.fillStyle = '#06070a';
    ctx.fillRect(0, 0, S, S);

    const pad = 24;
    const destW = S - pad * 2;
    const destH = S - pad * 2;
    const destX = pad;
    const destY = pad;

    // Mock item geometry on preview stage
    const item = this.targetItem;
    const originalFit = item.fitOffset;
    item.fitOffset = { x: this.panX, y: this.panY, zoom: this.zoom };

    ctx.save();
    ctx.translate(destX, destY);

    // 1. Draw shape clipping mask with image inside
    ctx.save();
    item.createShapePath(ctx, destW, destH);
    ctx.clip();
    item.drawImageCover(ctx, 0, 0, destW, destH);
    ctx.restore();

    // 2. Draw subtle shape outline
    ctx.save();
    item.createShapePath(ctx, destW, destH);
    ctx.strokeStyle = '#ed7952';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 3. Draw alignment crosshair inside shape
    ctx.save();
    item.createShapePath(ctx, destW, destH);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(destW / 2, 0);
    ctx.lineTo(destW / 2, destH);
    ctx.moveTo(0, destH / 2);
    ctx.lineTo(destW, destH / 2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Revert temporary item preview
    item.fitOffset = originalFit;
  }

  applyAdjustment() {
    if (!this.targetItem) return;

    this.targetItem.fitOffset = {
      x: this.panX,
      y: this.panY,
      zoom: this.zoom
    };

    this.engine.triggerChange();
    this.engine.saveHistory('Ajustar encuadre de forma');
    this.close();
  }

  close() {
    this.modal.classList.add('hidden');
    this.targetItem = null;
  }
}
