/**
 * Panoramic Multi-Slide Canvas Engine (Mobile-First Optimized)
 * Enhanced with Smart Magnetic Alignment Guides (Slide centers, borders, other items),
 * Slide Centering, Auto-Fit, and Blank Canvas Reset.
 */

export class CanvasEngine {
  constructor(canvasElement, containerElement) {
    this.enabled = false;
    this.canvas = canvasElement;
    this.container = containerElement;
    this.ctx = canvasElement.getContext('2d');

    // Slide configuration
    this.slideCount = 3;
    this.slideWidth = 1080;
    this.slideHeight = 1350; // 4:5 Portrait default
    this.aspectRatioName = '4:5';

    // Canvas background
    this.background = '#f5f0ea';

    // Items list & selection
    this.items = [];
    this.selectedItem = null;

    // Viewport transform (Pan & Zoom)
    this.zoom = 0.28;
    this.panX = 20;
    this.panY = 40;
    this.isPanning = false;
    this.startPanPoint = { x: 0, y: 0 };
    this.isSpacePressed = false;

    // Transform interaction state
    this.activeHandle = null;
    this.dragStart = { x: 0, y: 0 };
    this.itemInitialState = null;

    // Smart Snapping & Dynamic Alignment Guides
    this.showGuides = true;
    this.snapThreshold = 22; // Generous threshold for easy snapping on small items
    this.activeSnapLines = [];

    // History for Undo / Redo
    this.history = [];
    this.historyIndex = -1;
    this.isRestoringHistory = false;

    // Touch interaction helpers
    this.lastTapTime = 0;
    this.touchStartDist = 0;
    this.touchStartZoom = 1;

    // Change listeners
    this.onSelectionChange = null;
    this.onCanvasChange = null;

    this.init();
  }

  get totalWidth() {
    return this.slideWidth * this.slideCount;
  }

  get totalHeight() {
    return this.slideHeight;
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => {
      if (this.enabled) this.fitToScreen(this.viewMode === 'slide');
    });

    this.bindEvents();
    this.fitToScreen();
    this.saveHistory('Initial state');
  }

  resizeCanvas() {
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.viewportWidth = rect.width;
    this.viewportHeight = rect.height;
  }

  setAspectRatio(ratio) {
    if (ratio === '4:5') {
      this.slideWidth = 1080;
      this.slideHeight = 1350;
      this.aspectRatioName = '4:5';
    } else if (ratio === '1:1') {
      this.slideWidth = 1080;
      this.slideHeight = 1080;
      this.aspectRatioName = '1:1';
    } else if (ratio === '9:16') {
      this.slideWidth = 1080;
      this.slideHeight = 1920;
      this.aspectRatioName = '9:16';
    }
    this.fitToScreen();
    this.triggerChange();
  }

  setSlideCount(count) {
    const newCount = Math.max(1, Math.min(10, count));
    if (newCount !== this.slideCount) {
      this.slideCount = newCount;
      this.fitToScreen();
      this.triggerChange();
      this.saveHistory(`Change slides to ${newCount}`);
    }
  }

  removeSlide(index = this.getActiveSlideIndex()) {
    if (this.slideCount <= 1 || !Number.isInteger(index) || index < 0 || index >= this.slideCount) return false;
    this.selectItem(null);
    this.items = this.items.filter(item => {
      const page = this.getItemSlideIndex(item);
      if (page === index) return false;
      if (page > index) item.x -= this.slideWidth;
      return true;
    });
    this.items.forEach((item, i) => { item.zIndex = i; });
    this.slideCount--;
    this.focusSlide(Math.min(index, this.slideCount - 1));
    this.triggerChange();
    this.saveHistory(`Eliminar página ${index + 1}`);
    return true;
  }

  // Clear everything to a clean white canvas
  clearToBlankCanvas() {
    this.items = [];
    this.selectItem(null);
    this.background = '#ffffff';
    this.fitToScreen();
    this.saveHistory('Lienzo en blanco');
    this.triggerChange();
  }

  getActiveSlideIndex() {
    const center = (this.viewportWidth / 2 - this.panX) / this.zoom;
    return Math.max(0, Math.min(this.slideCount - 1, Math.floor(center / this.slideWidth) || 0));
  }

  focusSlide(index) {
    this.fitToScreen(true, Math.max(0, Math.min(this.slideCount - 1, index)));
  }

  fitToScreen(forceSlideFit = null, slideIndex = null) {
    const previousSlide = slideIndex ?? this.getActiveSlideIndex();
    this.resizeCanvas();
    const isMobile = this.viewportWidth <= 640 || this.viewportWidth < this.viewportHeight;
    const paddingX = Math.max(12, Math.min(32, this.viewportWidth * 0.05));
    const paddingY = Math.max(16, Math.min(48, this.viewportHeight * 0.06));
    // The canvas toolbar floats over the workspace, so the artwork starts below it.
    const topInset = isMobile ? 46 : 0;
    const availW = Math.max(40, this.viewportWidth - paddingX * 2);
    const availH = Math.max(40, this.viewportHeight - paddingY * 2 - topInset);

    // On mobile or portrait orientation, fit to slide height so slides fill the vertical screen natively!
    const shouldFitSlideHeight = forceSlideFit !== null ? forceSlideFit : isMobile;

    if (shouldFitSlideHeight) {
      // Scale slide height to comfortably fill vertical workspace (~90%)
      this.zoom = Math.min(availW / this.slideWidth, availH / this.slideHeight);
      const activeSlide = Math.min(this.slideCount - 1, previousSlide);
      const targetCenterX = activeSlide * this.slideWidth + this.slideWidth / 2;
      this.panX = this.viewportWidth / 2 - targetCenterX * this.zoom;
      this.panY = topInset + paddingY + (availH - this.slideHeight * this.zoom) / 2;
      this.viewMode = 'slide';
    } else {
      // Full panoramic ribbon overview (all slides in view)
      const scaleW = availW / this.totalWidth;
      const scaleH = availH / this.totalHeight;
      this.zoom = Math.min(scaleW, scaleH);
      this.panX = (this.viewportWidth - this.totalWidth * this.zoom) / 2;
      this.panY = topInset + paddingY + (availH - this.totalHeight * this.zoom) / 2;
      this.viewMode = 'panorama';
    }

    this.render();
  }

  screenToCanvas(screenX, screenY) {
    return {
      x: (screenX - this.panX) / this.zoom,
      y: (screenY - this.panY) / this.zoom
    };
  }

  canvasToScreen(canvasX, canvasY) {
    return {
      x: canvasX * this.zoom + this.panX,
      y: canvasY * this.zoom + this.panY
    };
  }

  addItem(item) {
    item.zIndex = this.items.length;
    this.items.push(item);
    this.selectItem(item);
    this.saveHistory(`Add ${item.type}`);
    this.triggerChange();
  }

  removeItem(item) {
    const index = this.items.indexOf(item);
    if (index > -1) {
      this.items.splice(index, 1);
      if (this.selectedItem === item) {
        this.selectItem(null);
      }
      this.saveHistory(`Delete item`);
      this.triggerChange();
    }
  }

  selectItem(item) {
    if (this.selectedItem !== item) {
      this.selectedItem = item;
      this.render();
      if (this.onSelectionChange) {
        this.onSelectionChange(item);
      }
    }
  }

  // Determine which slide an item is centered in (0 to slideCount - 1)
  getItemSlideIndex(item) {
    const cx = item.x + item.width / 2;
    return Math.max(0, Math.min(this.slideCount - 1, Math.floor(cx / this.slideWidth)));
  }

  // Quick Action: Center item horizontally and vertically in its slide
  centerItemInSlide(item) {
    if (!item) return;
    const s = this.getItemSlideIndex(item);
    const slideCenterX = s * this.slideWidth + this.slideWidth / 2;
    const slideCenterY = this.slideHeight / 2;

    item.x = Math.round(slideCenterX - item.width / 2);
    item.y = Math.round(slideCenterY - item.height / 2);
    this.triggerChange();
    this.saveHistory(`Center item in slide ${s + 1}`);
  }

  fillImageToSlide(item) {
    if (!item || item.type !== 'image') return;
    const slide = this.getActiveSlideIndex();
    Object.assign(item, {
      x: slide * this.slideWidth, y: 0,
      width: this.slideWidth, height: this.slideHeight, rotation: 0,
      crop: { x: 0, y: 0, width: 1, height: 1 },
      cropReference: null,
      fitOffset: { x: 0, y: 0, zoom: 1 },
      clipShape: 'rect', frameStyle: 'none', borderRadius: 0, borderWidth: 0
    });
    this.triggerChange();
    this.saveHistory(`Photo fills slide ${slide + 1}`);
  }

  // Quick Action: Fit item inside current slide
  fitItemToSlide(item) {
    if (!item) return;
    const s = this.getItemSlideIndex(item);
    const targetW = Math.round(this.slideWidth * 0.85);
    const aspect = item.width / item.height;

    item.width = targetW;
    item.height = Math.round(targetW / aspect);

    const slideCenterX = s * this.slideWidth + this.slideWidth / 2;
    const slideCenterY = this.slideHeight / 2;

    item.x = Math.round(slideCenterX - item.width / 2);
    item.y = Math.round(slideCenterY - item.height / 2);

    this.triggerChange();
    this.saveHistory(`Fit item to slide ${s + 1}`);
  }

  // Quick Action: Snap item directly centered across nearest slide fold / seam
  snapToNearestSeam(item) {
    if (!item) return;
    const centerX = item.x + item.width / 2;
    let closestSeamX = this.slideWidth;
    let minDiff = Infinity;
    for (let s = 1; s < this.slideCount; s++) {
      const sx = s * this.slideWidth;
      const diff = Math.abs(centerX - sx);
      if (diff < minDiff) {
        minDiff = diff;
        closestSeamX = sx;
      }
    }
    item.x = Math.round(closestSeamX - item.width / 2);
    this.triggerChange();
    this.saveHistory('Snap to nearest fold');
  }

  bringForward(item) {
    const idx = this.items.indexOf(item);
    if (idx < this.items.length - 1) {
      const temp = this.items[idx];
      this.items[idx] = this.items[idx + 1];
      this.items[idx + 1] = temp;
      this.reindexLayers();
      this.triggerChange();
    }
  }

  sendBackward(item) {
    const idx = this.items.indexOf(item);
    if (idx > 0) {
      const temp = this.items[idx];
      this.items[idx] = this.items[idx - 1];
      this.items[idx - 1] = temp;
      this.reindexLayers();
      this.triggerChange();
    }
  }

  bringToFront(item) {
    const idx = this.items.indexOf(item);
    if (idx > -1 && idx < this.items.length - 1) {
      this.items.splice(idx, 1);
      this.items.push(item);
      this.reindexLayers();
      this.triggerChange();
    }
  }

  sendToBack(item) {
    const idx = this.items.indexOf(item);
    if (idx > 0) {
      this.items.splice(idx, 1);
      this.items.unshift(item);
      this.reindexLayers();
      this.triggerChange();
    }
  }

  reindexLayers() {
    this.items.forEach((it, i) => { it.zIndex = i; });
    this.saveHistory('Reorder layers');
  }

  duplicateItem(item) {
    if (!item) return;
    const offset = 40;
    const copy = Object.assign(Object.create(Object.getPrototypeOf(item)), item);
    Object.assign(copy, this.serializeItem(item));
    delete copy.imageSrc;
    copy.id = 'item_' + Date.now();
    copy.x += offset;
    copy.y += offset;
    this.addItem(copy);
  }

  saveHistory(label = '') {
    if (this.isRestoringHistory) return;
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    const snapshot = {
      label,
      slideCount: this.slideCount,
      slideWidth: this.slideWidth,
      slideHeight: this.slideHeight,
      aspectRatioName: this.aspectRatioName,
      background: this.background,
      items: this.items.map(it => this.serializeItem(it))
    };
    this.history.push(snapshot);
    if (this.history.length > 25) this.history.shift();
    this.historyIndex = this.history.length - 1;
    this.onHistoryChange?.();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreHistory(this.history[this.historyIndex]);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreHistory(this.history[this.historyIndex]);
    }
  }

  serializeItem(item) {
    const data = { ...item };
    delete data.image;
    const snapshot = structuredClone(data);
    snapshot.imageSrc =
      item.mediaType === 'video' || !item.image ? '' : item.image.src;
    return snapshot;
  }

  async restoreHistory(snapshot, resetHistory = false) {
    const revision = this.restoreRevision = (this.restoreRevision || 0) + 1;
    this.isRestoringHistory = true;
    this.slideCount = snapshot.slideCount;
    this.slideWidth = snapshot.slideWidth;
    this.slideHeight = snapshot.slideHeight;
    this.aspectRatioName = snapshot.aspectRatioName;
    this.background = snapshot.background;
    this.selectItem(null);
    const { ImageItem, TextItem, StickerItem } = window.__notScrlObjects;
    const restored = await Promise.all(snapshot.items.map(async data => {
      let item;
      if (data.type === 'image' || data.type === 'sticker') {
        if (data.mediaType === 'video') {
          item = await this.restoreVideoItem(data);
        } else {
          const image = new Image();
          image.src = data.imageSrc;
          try { await image.decode(); } catch { /* Keep the layer available if its source is missing. */ }
          item = data.type === 'sticker'
            ? new StickerItem(image, data.x, data.y, data.width, data.height, data.title)
            : new ImageItem(image, data.x, data.y, data.width, data.height);
        }
      } else {
        item = new TextItem(data.text, data.x, data.y, data.width, data.height);
      }
      const { image, imageSrc, id, ...properties } = data;
      Object.assign(item, properties);
      item.shadow = { ...data.shadow };
      return item;
    }));
    if (revision !== this.restoreRevision) return;
    this.items = restored;
    this.isRestoringHistory = false;
    if (resetHistory) {
      this.history = [];
      this.historyIndex = -1;
      this.saveHistory('Abrir proyecto');
    }
    this.fitToScreen();
    this.triggerChange();
  }

  async restoreVideoItem(data) {
    const { ImageItem } = window.__notScrlObjects;
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;

    if (data.originalKey && this.loadMediaBlob) {
      try {
        const blob = await this.loadMediaBlob(data.originalKey);
        video.src = URL.createObjectURL(blob);
        await new Promise((resolve) => {
          video.onloadeddata = resolve;
          video.onerror = resolve;
        });
        video.play?.().catch(() => {});
      } catch {
        /* Keep the frame as an empty slot if the video is unavailable. */
      }
    }

    const item = new ImageItem(video, data.x, data.y, data.width, data.height);
    item.mediaType = 'video';
    return item;
  }

  async restoreProject(snapshot) {
    if (snapshot) await this.restoreHistory(snapshot, true);
  }

  triggerChange() {
    if (this.isRestoringHistory) return;
    this.render();
    if (this.onCanvasChange) {
      this.onCanvasChange();
    }
  }

  hasAnimatedMedia() {
    return this.items.some(
      (item) => item.mediaType === 'video' || item.mediaType === 'gif'
    );
  }

  ensureAnimationLoop() {
    if (typeof requestAnimationFrame !== 'function' || this.animationFrame) return;
    this.animationFrame = requestAnimationFrame(() => {
      this.animationFrame = null;
      if (!this.hasAnimatedMedia()) return;
      this.render();
    });
  }

  bindEvents() {
    const canvas = this.canvas;

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const zoomDelta = -e.deltaY * 0.002;
        const newZoom = Math.min(Math.max(0.02, this.zoom + zoomDelta), 2.5);
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
        this.zoom = newZoom;
      } else {
        this.panX -= e.deltaX;
        this.panY -= e.deltaY;
      }
      this.render();
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.closest('input,textarea,select,dialog,[role=dialog]') || document.querySelector('.mobile-modal-overlay:not(.hidden)')) return;

      if (e.code === 'Space' && !this.isSpacePressed) {
        e.preventDefault();
        this.isSpacePressed = true;
        this.canvas.style.cursor = 'grab';
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedItem) {
        e.preventDefault();
        this.removeItem(this.selectedItem);
      }

      if (this.selectedItem && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        if (e.key === 'ArrowLeft') this.selectedItem.x -= step;
        if (e.key === 'ArrowRight') this.selectedItem.x += step;
        if (e.key === 'ArrowUp') this.selectedItem.y -= step;
        if (e.key === 'ArrowDown') this.selectedItem.y += step;
        this.triggerChange();
        this.saveHistory('Mover elemento');
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        this.canvas.style.cursor = 'default';
      }
    });

    this.bindTouchEvents();
  }

  bindTouchEvents() {
    const canvas = this.canvas;
    let initialTouchDist = 0;
    let initialZoom = 1;
    let touchPanStart = { x: 0, y: 0 };
    let isTouchPanning = false;

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!this.enabled || this.isRestoringHistory) return;
      const now = Date.now();
      if (e.touches.length === 1 && (now - this.lastTapTime < 300)) {
        if (this.selectedItem && this.selectedItem.type === 'image' && this.onDoubleTapItem) {
          this.onDoubleTapItem(this.selectedItem);
          this.lastTapTime = 0;
          return;
        }
        const nextMode = this.viewMode === 'slide' ? false : true;
        this.fitToScreen(nextMode);
        this.lastTapTime = 0;
        return;
      }
      this.lastTapTime = now;

      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        initialZoom = this.zoom;
        this.activeHandle = null;
        isTouchPanning = false;
        const rect = canvas.getBoundingClientRect();
        this.pinchAnchor = this.screenToCanvas((t1.clientX + t2.clientX) / 2 - rect.left, (t1.clientY + t2.clientY) / 2 - rect.top);
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const canvasPoint = this.screenToCanvas(touch.clientX - rect.left, touch.clientY - rect.top);

        let handleHit = null;
        if (this.selectedItem) {
          handleHit = this.hitTestHandles(this.selectedItem, canvasPoint, true);
        }

        if (handleHit) {
          this.activeHandle = handleHit;
          this.dragStart = { ...canvasPoint };
          this.itemInitialState = {
            x: this.selectedItem.x,
            y: this.selectedItem.y,
            width: this.selectedItem.width,
            height: this.selectedItem.height,
            rotation: this.selectedItem.rotation,
            aspectRatio: this.selectedItem.width / this.selectedItem.height,
            corners: {
              nw: this.selectedItem.localToGlobal(0, 0),
              ne: this.selectedItem.localToGlobal(this.selectedItem.width, 0),
              se: this.selectedItem.localToGlobal(this.selectedItem.width, this.selectedItem.height),
              sw: this.selectedItem.localToGlobal(0, this.selectedItem.height)
            }
          };
          return;
        }

        let hitItem = null;
        for (let i = this.items.length - 1; i >= 0; i--) {
          if (this.items[i].containsPoint(canvasPoint.x, canvasPoint.y)) {
            hitItem = this.items[i];
            break;
          }
        }

        if (hitItem) {
          this.selectItem(hitItem);
          this.activeHandle = 'body';
          this.dragStart = { ...canvasPoint };
          this.itemInitialState = {
            x: hitItem.x,
            y: hitItem.y,
            width: hitItem.width,
            height: hitItem.height,
            rotation: hitItem.rotation
          };
        } else {
          isTouchPanning = true;
          touchPanStart = { x: touch.clientX - this.panX, y: touch.clientY - this.panY };
          this.selectItem(null);
        }
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (initialTouchDist > 0) {
          this.zoom = Math.min(Math.max(0.02, initialZoom * (dist / initialTouchDist)), 2.5);
          const rect = canvas.getBoundingClientRect();
          this.panX = (t1.clientX + t2.clientX) / 2 - rect.left - this.pinchAnchor.x * this.zoom;
          this.panY = (t1.clientY + t2.clientY) / 2 - rect.top - this.pinchAnchor.y * this.zoom;
          this.render();
        }
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (isTouchPanning) {
          this.panX = touch.clientX - touchPanStart.x;
          this.panY = touch.clientY - touchPanStart.y;
          this.render();
        } else if (this.activeHandle && this.selectedItem) {
          e.preventDefault();
          const rect = canvas.getBoundingClientRect();
          const canvasPoint = this.screenToCanvas(touch.clientX - rect.left, touch.clientY - rect.top);
          this.handleDragMove(canvasPoint);
        }
      }
    }, { passive: false });

    const endTouch = () => {
      isTouchPanning = false;
      initialTouchDist = 0;
      if (this.activeHandle) {
        this.activeHandle = null;
        this.activeSnapLines = [];
        this.saveHistory('Transform item');
        this.render();
      }
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  onMouseDown(e) {
    if (!this.enabled || this.isRestoringHistory) return;
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPoint = this.screenToCanvas(screenX, screenY);

    if (this.isSpacePressed || e.button === 1) {
      this.isPanning = true;
      this.startPanPoint = { x: e.clientX - this.panX, y: e.clientY - this.panY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button !== 0) return;

    if (this.selectedItem) {
      const handleHit = this.hitTestHandles(this.selectedItem, canvasPoint, false);
      if (handleHit) {
        this.activeHandle = handleHit;
        this.dragStart = { ...canvasPoint };
        this.itemInitialState = {
          x: this.selectedItem.x,
          y: this.selectedItem.y,
          width: this.selectedItem.width,
          height: this.selectedItem.height,
          rotation: this.selectedItem.rotation,
          aspectRatio: this.selectedItem.width / this.selectedItem.height,
          corners: {
            nw: this.selectedItem.localToGlobal(0, 0),
            ne: this.selectedItem.localToGlobal(this.selectedItem.width, 0),
            se: this.selectedItem.localToGlobal(this.selectedItem.width, this.selectedItem.height),
            sw: this.selectedItem.localToGlobal(0, this.selectedItem.height)
          }
        };
        return;
      }
    }

    let hitItem = null;
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].containsPoint(canvasPoint.x, canvasPoint.y)) {
        hitItem = this.items[i];
        break;
      }
    }

    if (hitItem) {
      this.selectItem(hitItem);
      this.activeHandle = 'body';
      this.dragStart = { ...canvasPoint };
      this.itemInitialState = {
        x: hitItem.x,
        y: hitItem.y,
        width: hitItem.width,
        height: hitItem.height,
        rotation: hitItem.rotation
      };
    } else {
      this.selectItem(null);
    }
  }

  onMouseMove(e) {
    if (!this.enabled || this.isRestoringHistory) return;
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvasPoint = this.screenToCanvas(screenX, screenY);

    if (this.isPanning) {
      this.panX = e.clientX - this.startPanPoint.x;
      this.panY = e.clientY - this.startPanPoint.y;
      this.render();
      return;
    }

    if (!this.activeHandle || !this.selectedItem) {
      this.updateCursor(canvasPoint);
      return;
    }

    this.handleDragMove(canvasPoint);
  }

  // Enhanced Magnetic Snapping: checks slide centers, seams, slide vertical thirds, and OTHER items!
  handleDragMove(canvasPoint) {
    const item = this.selectedItem;
    const init = this.itemInitialState;
    const dx = canvasPoint.x - this.dragStart.x;
    const dy = canvasPoint.y - this.dragStart.y;

    this.activeSnapLines = [];

    if (this.activeHandle === 'body') {
      let newX = init.x + dx;
      let newY = init.y + dy;

      const itemW = item.width;
      const itemH = item.height;
      const leftX = newX;
      const centerX = newX + itemW / 2;
      const rightX = newX + itemW;
      const topY = newY;
      const centerY = newY + itemH / 2;
      const bottomY = newY + itemH;

      // 1. Slide X Targets (Borders & Centers of all slides)
      const xTargets = [];
      for (let s = 0; s <= this.slideCount; s++) {
        xTargets.push({ x: s * this.slideWidth, type: 'border' });
        if (s < this.slideCount) {
          xTargets.push({ x: s * this.slideWidth + this.slideWidth / 2, type: 'center' });
        }
      }

      // 2. Other items' X & Y targets
      const yTargets = [
        { y: this.slideHeight / 2, type: 'center' },
        { y: this.slideHeight * 0.25, type: 'third' },
        { y: this.slideHeight * 0.75, type: 'third' }
      ];

      for (const other of this.items) {
        if (other === item) continue;
        xTargets.push({ x: other.centerX, type: 'item' });
        xTargets.push({ x: other.x, type: 'item' });
        xTargets.push({ x: other.x + other.width, type: 'item' });

        yTargets.push({ y: other.centerY, type: 'item' });
        yTargets.push({ y: other.y, type: 'item' });
        yTargets.push({ y: other.y + other.height, type: 'item' });
      }

      // Test magnetic snap X
      for (const tgt of xTargets) {
        if (Math.abs(centerX - tgt.x) < this.snapThreshold) {
          newX = tgt.x - itemW / 2;
          this.activeSnapLines.push({ type: 'v', x: tgt.x, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
        if (Math.abs(leftX - tgt.x) < this.snapThreshold) {
          newX = tgt.x;
          this.activeSnapLines.push({ type: 'v', x: tgt.x, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
        if (Math.abs(rightX - tgt.x) < this.snapThreshold) {
          newX = tgt.x - itemW;
          this.activeSnapLines.push({ type: 'v', x: tgt.x, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
      }

      // Test magnetic snap Y
      for (const tgt of yTargets) {
        if (Math.abs(centerY - tgt.y) < this.snapThreshold) {
          newY = tgt.y - itemH / 2;
          this.activeSnapLines.push({ type: 'h', y: tgt.y, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
        if (Math.abs(topY - tgt.y) < this.snapThreshold) {
          newY = tgt.y;
          this.activeSnapLines.push({ type: 'h', y: tgt.y, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
        if (Math.abs(bottomY - tgt.y) < this.snapThreshold) {
          newY = tgt.y - itemH;
          this.activeSnapLines.push({ type: 'h', y: tgt.y, color: tgt.type === 'item' ? '#ec4899' : '#06b6d4' });
          break;
        }
      }

      item.x = Math.round(newX);
      item.y = Math.round(newY);
      this.triggerChange();
      return;
    }

    if (this.activeHandle === 'rot') {
      const cx = init.x + init.width / 2;
      const cy = init.y + init.height / 2;
      const rad = Math.atan2(canvasPoint.y - cy, canvasPoint.x - cx);
      let deg = (rad * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;

      const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
      for (const sa of snapAngles) {
        if (Math.abs(deg - sa) < 5) {
          deg = sa % 360;
          break;
        }
      }
      item.rotation = Math.round(deg);
      this.triggerChange();
      return;
    }

    // Resize Handles with Stationary Opposite Anchor Corner
    const rad = (init.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Identify stationary opposite anchor corner in canvas coordinates
    let anchor;
    if (init.corners) {
      if (this.activeHandle === 'se') anchor = init.corners.nw;
      else if (this.activeHandle === 'sw') anchor = init.corners.ne;
      else if (this.activeHandle === 'ne') anchor = init.corners.sw;
      else if (this.activeHandle === 'nw') anchor = init.corners.se;
    }

    if (!anchor) {
      anchor = { x: init.x, y: init.y };
    }

    // Vector from anchor to current canvas pointer
    const dxA = canvasPoint.x - anchor.x;
    const dyA = canvasPoint.y - anchor.y;

    // Project onto item's local orientation
    const projX = dxA * cos + dyA * sin;
    const projY = -dxA * sin + dyA * cos;

    let wRaw = init.width;
    let hRaw = init.height;

    if (this.activeHandle === 'se') {
      wRaw = projX;
      hRaw = projY;
    } else if (this.activeHandle === 'sw') {
      wRaw = -projX;
      hRaw = projY;
    } else if (this.activeHandle === 'ne') {
      wRaw = projX;
      hRaw = -projY;
    } else if (this.activeHandle === 'nw') {
      wRaw = -projX;
      hRaw = -projY;
    }

    const keepAspect = item.type === 'image' || item.type === 'sticker';
    const ar = init.aspectRatio || (init.width / init.height);

    let newW, newH;
    if (keepAspect) {
      // Smooth responsive diagonal tracking cursor along aspect ratio
      const rawDiag = (wRaw + hRaw * ar) / 2;
      newW = Math.max(40, rawDiag);
      newH = newW / ar;
    } else {
      newW = Math.max(40, wRaw);
      newH = Math.max(30, hRaw);
    }

    // Determine new center point so the opposite anchor remains strictly locked in world space
    let newCx, newCy;
    if (this.activeHandle === 'se') {
      // Anchor is nw. Center is (+newW/2, +newH/2) from anchor in local frame.
      newCx = anchor.x + (newW / 2) * cos - (newH / 2) * sin;
      newCy = anchor.y + (newW / 2) * sin + (newH / 2) * cos;
    } else if (this.activeHandle === 'sw') {
      // Anchor is ne. Center is (-newW/2, +newH/2) from anchor in local frame.
      newCx = anchor.x + (-newW / 2) * cos - (newH / 2) * sin;
      newCy = anchor.y + (-newW / 2) * sin + (newH / 2) * cos;
    } else if (this.activeHandle === 'ne') {
      // Anchor is sw. Center is (+newW/2, -newH/2) from anchor in local frame.
      newCx = anchor.x + (newW / 2) * cos - (-newH / 2) * sin;
      newCy = anchor.y + (newW / 2) * sin + (-newH / 2) * cos;
    } else if (this.activeHandle === 'nw') {
      // Anchor is se. Center is (-newW/2, -newH/2) from anchor in local frame.
      newCx = anchor.x + (-newW / 2) * cos - (-newH / 2) * sin;
      newCy = anchor.y + (-newW / 2) * sin + (-newH / 2) * cos;
    }

    item.width = Math.round(newW);
    item.height = Math.round(newH);
    item.x = Math.round(newCx - item.width / 2);
    item.y = Math.round(newCy - item.height / 2);

    this.triggerChange();
  }

  onMouseUp() {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = this.isSpacePressed ? 'grab' : 'default';
    }

    if (this.activeHandle) {
      this.activeHandle = null;
      this.activeSnapLines = [];
      this.saveHistory('Transform item');
      this.render();
    }
  }

  hitTestHandles(item, canvasPoint, isTouch = false) {
    const handles = item.getHandles(this.zoom);
    const radius = (isTouch ? 32 : 14) / this.zoom;

    for (const [key, pos] of Object.entries(handles)) {
      const dist = Math.hypot(canvasPoint.x - pos.x, canvasPoint.y - pos.y);
      if (dist <= radius) {
        return key;
      }
    }
    return null;
  }

  updateCursor(canvasPoint) {
    if (this.isSpacePressed) {
      this.canvas.style.cursor = 'grab';
      return;
    }

    if (this.selectedItem) {
      const handle = this.hitTestHandles(this.selectedItem, canvasPoint, false);
      if (handle) {
        if (handle === 'rot') {
          this.canvas.style.cursor = 'crosshair';
          return;
        }
        this.canvas.style.cursor = 'nwse-resize';
        return;
      }
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].containsPoint(canvasPoint.x, canvasPoint.y)) {
        this.canvas.style.cursor = 'move';
        return;
      }
    }

    this.canvas.style.cursor = 'default';
  }

  render() {
    const ctx = this.ctx;
    ctx.save();

    ctx.fillStyle = '#111310';
    ctx.fillRect(0, 0, this.viewportWidth, this.viewportHeight);

    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    this.renderCanvasBackground(ctx);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.totalWidth, this.totalHeight);
    ctx.clip();
    for (const item of this.items) item.render(ctx);
    ctx.restore();

    if (this.showGuides) {
      this.renderSlideGuides(ctx);
    }

    this.renderSnapLines(ctx);

    if (this.selectedItem) {
      this.renderSelectionHandles(ctx, this.selectedItem);
    }

    ctx.restore();
    this.ensureAnimationLoop();
    this.onViewChange?.();
  }

  renderCanvasBackground(ctx) {
    const w = this.totalWidth;
    const h = this.totalHeight;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 36 / this.zoom;
    ctx.shadowOffsetY = 16 / this.zoom;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    if (this.background.startsWith('linear-gradient')) {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      const matches = this.background.match(/#(?:[0-9a-fA-F]{3}){1,2}|rgba?\([^)]+\)/g);
      if (matches && matches.length >= 2) {
        grad.addColorStop(0, matches[0]);
        grad.addColorStop(1, matches[1]);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = '#ffffff';
      }
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, w, h);
    }
  }

  renderSlideGuides(ctx) {
    const h = this.totalHeight;

    // Clean subtle vertical dashed dividers (No text "SEAM")
    for (let s = 1; s < this.slideCount; s++) {
      const x = s * this.slideWidth;

      ctx.save();
      ctx.strokeStyle = 'rgba(80, 84, 70, 0.45)';
      ctx.lineWidth = 2 / this.zoom;
      ctx.setLineDash([8 / this.zoom, 8 / this.zoom]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.restore();
    }

  }

  // Visual Dynamic Smart Snap Alignment Lines with crosshairs
  renderSnapLines(ctx) {
    if (!this.activeSnapLines || this.activeSnapLines.length === 0) return;

    ctx.save();
    ctx.lineWidth = 2.5 / this.zoom;
    ctx.setLineDash([6 / this.zoom, 6 / this.zoom]);

    for (const line of this.activeSnapLines) {
      ctx.strokeStyle = line.color || '#06b6d4';
      ctx.beginPath();
      if (line.type === 'v') {
        ctx.moveTo(line.x, 0);
        ctx.lineTo(line.x, this.totalHeight);
      } else if (line.type === 'h') {
        ctx.moveTo(0, line.y);
        ctx.lineTo(this.totalWidth, line.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  renderSelectionHandles(ctx, item) {
    ctx.save();

    const cx = item.centerX;
    const cy = item.centerY;
    ctx.translate(cx, cy);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.translate(-item.width / 2, -item.height / 2);

    ctx.strokeStyle = '#ed7952';
    ctx.lineWidth = 2.5 / this.zoom;
    ctx.strokeRect(0, 0, item.width, item.height);

    const rotDist = 38 / this.zoom;
    ctx.beginPath();
    ctx.moveTo(item.width / 2, 0);
    ctx.lineTo(item.width / 2, -rotDist);
    ctx.strokeStyle = '#ed7952';
    ctx.stroke();

    const handleRadius = 9 / this.zoom;
    const drawPoint = (hx, hy, isRot = false) => {
      ctx.beginPath();
      ctx.arc(hx, hy, isRot ? handleRadius + 3 / this.zoom : handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = isRot ? '#ed7952' : '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#ed7952';
      ctx.lineWidth = 2.5 / this.zoom;
      ctx.stroke();
    };

    const w = item.width;
    const h = item.height;

    drawPoint(0, 0);
    drawPoint(w, 0);
    drawPoint(w, h);
    drawPoint(0, h);

    drawPoint(w / 2, -rotDist, true);

    ctx.restore();
  }
}
