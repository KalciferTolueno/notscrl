/**
 * NotSCRL Application Controller (Mobile-First Architecture)
 * Follows mobile UI design rules: thumb-zone action bars, sliding drawers,
 * tactile touch targets, and peak-end export delight.
 */

import { CanvasEngine } from './canvas.js';
import { ImageItem, TextItem, StickerItem } from './objects.js';
import { CanvasExporter } from './exporter.js';
import { PreviewSimulator } from './preview.js';
import { ImageCropper } from './cropper.js';
import { FrameAdjuster } from './frame-adjuster.js';
import { StorageManager } from './storage.js';
import { Studio } from './studio.js';
import { applyTemplate } from './templates.js';
import { PALETTES, FONTS, SAMPLE_PHOTOS, STICKERS } from './assets.js';

// Expose object types globally for history deserialization
window.__notScrlObjects = { ImageItem, TextItem, StickerItem };

class NotScrlMobileApp {
  constructor() {
    this.canvasEl = document.getElementById('main-canvas');
    this.workspaceEl = document.getElementById('canvas-workspace');

    this.engine = new CanvasEngine(this.canvasEl, this.workspaceEl);
    this.storage = new StorageManager(this.engine);
    this.loadingProject = true;
    this.exporter = new CanvasExporter(this.engine, this.storage);
    this.preview = new PreviewSimulator(this.exporter, document.getElementById('preview-modal'));
    this.cropper = new ImageCropper(this.engine);
    this.frameAdjuster = new FrameAdjuster(this.engine);

    this.engine.onDoubleTapItem = (it) => {
      if (it.clipShape && it.clipShape !== 'rect') {
        this.frameAdjuster.open(it);
      } else {
        this.cropper.open(it);
      }
    };

    this.init();
  }

  async init() {
    this.bindHeader();
    this.bindCanvasControls();
    this.bindContextActionBar();
    this.bindBottomNavAndDrawer();
    this.bindExportSheet();
    this.bindFileUpload();

    // Populate drawer content
    this.populateSamplePhotos();
    this.populateStickers();
    this.populatePalettes();

    // Engine change callbacks
    this.engine.onSelectionChange = (item) => this.onSelectionChanged(item);
    this.engine.onCanvasChange = () => this.onCanvasChanged();
    this.engine.onHistoryChange = () => {
      this.updateHeaderUI();
      if (!this.loadingProject && this.storage.saveTimeout) this.storage.flush();
    };
    this.storage.onStatus = state => this.studio?.setSavingStatus(state);

    // Check for saved project in cache (IndexedDB / localStorage)
    const savedProject = await this.storage.loadProject();
    if (savedProject && Array.isArray(savedProject.items)) {
      this.storage.projectId = savedProject.id || null;
      this.storage.projectName = savedProject.name || 'Mi primer carrusel';
      await this.engine.restoreProject(savedProject);
    } else {
      this.engine.clearToBlankCanvas();
    }

    this.engine.selectItem(null);
    this.loadingProject = false;
    this.studio = new Studio(this);
    this.studio.renderPages();
    this.bindTextStyles();
    this.bindDialogAccessibility();
    if (savedProject) await this.storage.flush();
    this.studio.showHome();
    this.updateHeaderUI();
  }

  // 1. MOBILE TOP HEADER
  bindHeader() {
    // Aspect Ratio
    const ratioSelect = document.getElementById('aspect-ratio-select');
    if (ratioSelect) {
      ratioSelect.addEventListener('change', (e) => {
        this.engine.setAspectRatio(e.target.value);
        this.engine.saveHistory('Cambiar formato');
        this.updateHeaderUI();
      });
    }

    // Slide Count Stepper
    const btnMinus = document.getElementById('btn-minus-slide');
    const btnPlus = document.getElementById('btn-plus-slide');

    for (const button of [btnMinus, document.getElementById('btn-delete-page')]) {
      button?.addEventListener('click', () => {
        const index = this.engine.getActiveSlideIndex();
        if (this.engine.removeSlide(index)) {
          this.updateHeaderUI();
          this.studio.toast(`Página ${index + 1} eliminada. Puedes deshacer.`);
        }
      });
    }

    if (btnPlus) {
      btnPlus.addEventListener('click', () => {
        if (this.engine.slideCount < 10) {
          this.engine.setSlideCount(this.engine.slideCount + 1);
          this.updateHeaderUI();
        }
      });
    }

    // Primary Export CTA
    const btnExport = document.getElementById('btn-open-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.openExportSheet());
    }

    // Clean / Blank Canvas Button
    const btnClear = document.getElementById('btn-clear-canvas');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        this.engine.clearToBlankCanvas();
        this.storage.scheduleAutoSave();
      });
    }
  }

  updateHeaderUI() {
    document.getElementById('aspect-ratio-select').value = this.engine.aspectRatioName;
    document.getElementById('btn-minus-slide').disabled = this.engine.slideCount <= 1;
    document.getElementById('btn-delete-page').disabled = this.engine.slideCount <= 1;
    document.getElementById('btn-plus-slide').disabled = this.engine.slideCount >= 10;
    document.getElementById('btn-undo').disabled = this.engine.historyIndex <= 0 || this.engine.isRestoringHistory;
    document.getElementById('btn-redo').disabled = this.engine.historyIndex >= this.engine.history.length - 1 || this.engine.isRestoringHistory;
    const slideCountEl = document.getElementById('slide-count-display');
    if (slideCountEl) {
      slideCountEl.textContent = this.engine.slideCount;
    }
  }

  // 2. CANVAS FLOATING CONTROLS
  bindCanvasControls() {
    document.getElementById('btn-canvas-controls')?.addEventListener('click', (event) => {
      const expanded = document.getElementById('editor-view').classList.toggle('canvas-controls-open');
      event.currentTarget.setAttribute('aria-expanded', String(expanded));
      event.currentTarget.title = expanded ? 'Ocultar controles del lienzo' : 'Mostrar controles del lienzo';
    });
    // Toggle Guides
    const btnGuides = document.getElementById('btn-toggle-guides');
    if (btnGuides) {
      btnGuides.addEventListener('click', () => {
        this.engine.showGuides = !this.engine.showGuides;
        btnGuides.classList.toggle('active', this.engine.showGuides);
        this.engine.render();
      });
    }

    // Fit / View Toggle
    const btnFit = document.getElementById('btn-zoom-fit');
    if (btnFit) {
      btnFit.addEventListener('click', () => {
        const nextMode = this.engine.viewMode === 'slide' ? false : true;
        this.engine.fitToScreen(nextMode);
      });
    }

    // Double-click canvas to crop or toggle view
    this.canvasEl.addEventListener('dblclick', () => {
      if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
        this.cropper.open(this.engine.selectedItem);
      } else {
        const nextMode = this.engine.viewMode === 'slide' ? false : true;
        this.engine.fitToScreen(nextMode);
      }
    });

    // Undo / Redo
    document.getElementById('btn-undo')?.addEventListener('click', () => this.engine.undo());
    document.getElementById('btn-redo')?.addEventListener('click', () => this.engine.redo());

    // Preview
    document.getElementById('btn-preview-ig')?.addEventListener('click', () => this.preview.open());
  }

  // 3. CONTEXT ACTION BAR (FLOATING AT TOP UNDER HEADER)
  bindContextActionBar() {
    this.contextBar = document.getElementById('context-action-bar');
    for (const id of ['btn-ctx-fill-slide', 'btn-align-fill-slide']) {
      document.getElementById(id)?.addEventListener('click', () => {
        const item = this.engine.selectedItem;
        if (!item || item.type !== 'image') return;
        this.engine.fillImageToSlide(item);
        this.studio.toast('Foto a página completa. Puedes deshacer.');
      });
    }

    // 1. Center inside current slide
    document.getElementById('btn-ctx-center-slide')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.centerItemInSlide(this.engine.selectedItem);
      }
    });

    // 2. Fit to current slide dimensions
    document.getElementById('btn-ctx-fit-slide')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.fitItemToSlide(this.engine.selectedItem);
      }
    });

    // 3. Snap to nearest seam
    document.getElementById('btn-ctx-snap-seam')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.snapToNearestSeam(this.engine.selectedItem);
      }
    });

    // 4. Recortar / Cropper Tool
    document.getElementById('btn-ctx-crop')?.addEventListener('click', () => {
      if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
        this.cropper.open(this.engine.selectedItem);
      }
    });

    // 5. Manual Frame Adjuster (Pan/Zoom within shape)
    document.getElementById('btn-ctx-edit-frame')?.addEventListener('click', () => {
      if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
        this.frameAdjuster.open(this.engine.selectedItem);
      }
    });

    // 6. Open shape selection drawer
    document.getElementById('btn-ctx-shapes')?.addEventListener('click', () => {
      this.openDrawer('adjust', 'Formas y Ajustes');
    });
    document.getElementById('btn-ctx-adjust').addEventListener('click', () => {
      this.openDrawer('adjust', this.engine.selectedItem?.type === 'text' ? 'Editar texto' : 'Editar elemento');
    });

    // 7. Step-by-step layer controls
    document.getElementById('btn-ctx-layer-up')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.bringForward(this.engine.selectedItem);
      }
    });
    document.getElementById('btn-ctx-layer-down')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.sendBackward(this.engine.selectedItem);
      }
    });

    // 8. Rotate 90 deg
    document.getElementById('btn-ctx-rotate')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.selectedItem.rotation = (this.engine.selectedItem.rotation + 90) % 360;
        this.engine.triggerChange();
        this.engine.saveHistory('Rotate 90 deg');
      }
    });

    // 6. Duplicate
    document.getElementById('btn-ctx-duplicate')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.duplicateItem(this.engine.selectedItem);
      }
    });

    // 7. Delete
    document.getElementById('btn-ctx-delete')?.addEventListener('click', () => {
      if (this.engine.selectedItem) {
        this.engine.removeItem(this.engine.selectedItem);
      }
    });

    // Bind Fine-Tuning Drawer Controls
    this.bindFineTuningControls();
  }

  bindFineTuningControls() {
    // Shape Choice Buttons (Normal, Circle, Star, Heart, Arch, Flower, Polaroid, Film)
    const shapeBtns = document.querySelectorAll('#shape-selector-grid .shape-choice-btn');
    shapeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (!this.engine.selectedItem || this.engine.selectedItem.type !== 'image') return;
        const shape = btn.dataset.shape;
        shapeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const it = this.engine.selectedItem;
        if (shape === 'polaroid') {
          it.frameStyle = 'polaroid';
          it.clipShape = 'rect';
        } else if (shape === 'film') {
          it.frameStyle = 'film';
          it.clipShape = 'rect';
        } else {
          it.frameStyle = 'none';
          it.clipShape = shape;

          // For symmetrical 1:1 shapes, ensure dimensions are equalized without distortion
          if (['circle', 'star', 'flower', 'heart'].includes(shape)) {
            const s = Math.min(it.width, it.height);
            const cx = it.x + it.width / 2;
            const cy = it.y + it.height / 2;
            it.width = s;
            it.height = s;
            it.x = Math.round(cx - s / 2);
            it.y = Math.round(cy - s / 2);
            it.aspectRatio = 1.0;
          }
        }

        document.getElementById('mobile-field-polaroid')?.classList.toggle('hidden', it.frameStyle !== 'polaroid');
        this.engine.triggerChange();
        this.engine.saveHistory(`Change shape to ${shape}`);
      });
    });

    // Open Frame Adjuster from drawer
    document.getElementById('btn-open-frame-adjust')?.addEventListener('click', () => {
      if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
        this.frameAdjuster.open(this.engine.selectedItem);
      }
    });

    // Alignment Tools in Drawer
    document.getElementById('btn-align-center-slide')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.centerItemInSlide(this.engine.selectedItem);
    });
    document.getElementById('btn-align-fit-slide')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.fitItemToSlide(this.engine.selectedItem);
    });
    document.getElementById('btn-align-snap-seam')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.snapToNearestSeam(this.engine.selectedItem);
    });
    document.getElementById('btn-align-span-2')?.addEventListener('click', () => {
      if (!this.engine.selectedItem) return;
      const it = this.engine.selectedItem;
      const targetW = this.engine.slideWidth * 2 - 160;
      const aspect = it.width / it.height;
      it.width = targetW;
      it.height = Math.round(targetW / aspect);
      it.x = this.engine.slideWidth - it.width / 2;
      this.engine.triggerChange();
      this.engine.saveHistory('Span 2 slides');
    });

    // Polaroid input
    const polaroidInput = document.getElementById('mobile-input-polaroid');
    if (polaroidInput) {
      polaroidInput.addEventListener('input', (e) => {
        if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
          this.engine.selectedItem.caption = e.target.value;
          this.engine.triggerChange();
        }
      });
    }

    // Text content input
    const textInput = document.getElementById('mobile-input-text');
    if (textInput) {
      textInput.addEventListener('input', (e) => {
        if (this.engine.selectedItem && this.engine.selectedItem.type === 'text') {
          this.engine.selectedItem.text = e.target.value;
          this.engine.triggerChange();
        }
      });
    }

    // Border Radius
    document.getElementById('mobile-slider-radius')?.addEventListener('input', (e) => {
      if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
        this.engine.selectedItem.borderRadius = parseInt(e.target.value, 10);
        this.engine.triggerChange();
      }
    });

    // Opacity
    document.getElementById('mobile-slider-opacity')?.addEventListener('input', (e) => {
      if (this.engine.selectedItem) {
        this.engine.selectedItem.opacity = parseFloat(e.target.value);
        this.engine.triggerChange();
      }
    });

    // Shadow
    document.getElementById('mobile-toggle-shadow')?.addEventListener('change', (e) => {
      if (this.engine.selectedItem) {
        this.engine.selectedItem.shadow.enabled = e.target.checked;
        this.engine.triggerChange();
      }
    });

    // Layer Controls (Step by Step + Send to Front/Back)
    document.getElementById('btn-mobile-step-up')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.bringForward(this.engine.selectedItem);
    });
    document.getElementById('btn-mobile-step-down')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.sendBackward(this.engine.selectedItem);
    });
    document.getElementById('btn-mobile-layer-up')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.bringToFront(this.engine.selectedItem);
    });
    document.getElementById('btn-mobile-layer-down')?.addEventListener('click', () => {
      if (this.engine.selectedItem) this.engine.sendToBack(this.engine.selectedItem);
    });
  }

  // 4. BOTTOM NAVIGATION & BOTTOM SHEET DRAWER
  bindBottomNavAndDrawer() {
    this.drawer = document.getElementById('bottom-sheet-drawer');
    this.drawerTitle = document.getElementById('drawer-title-text');
    this.navBtns = document.querySelectorAll('.nav-tab-btn');
    this.drawerTabs = document.querySelectorAll('.drawer-tab-content');

    const tabTitles = {
      photos: 'Añadir Fotos',
      text: 'Añadir Tipografía',
      stickers: 'Stickers & Vintage',
      templates: 'Plantillas SCRL',
      background: 'Color de Fondo'
    };

    this.navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (!this.drawer.classList.contains('hidden') && document.getElementById(`drawer-tab-${tab}`).classList.contains('active')) {
          this.closeDrawer();
          return;
        }
        this.navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.openDrawer(tab, tabTitles[tab] || 'Opciones');
      });
    });

    // Close Drawer button
    document.getElementById('btn-close-drawer')?.addEventListener('click', () => {
      this.closeDrawer();
    });

    // Add Text Presets
    document.getElementById('btn-add-mobile-heading')?.addEventListener('click', () => {
      const t = new TextItem('TÍTULO EDITORIAL', this.getSpawnX(640), 220, 640, 90);
      t.fontSize = 52;
      t.fontWeight = '700';
      this.engine.addItem(t);
      this.closeDrawer();
    });

    document.getElementById('btn-add-mobile-subheading')?.addEventListener('click', () => {
      const t = new TextItem('SUBTÍTULO MODERNO', this.getSpawnX(560), 320, 560, 50);
      t.fontSize = 24;
      t.fontWeight = '600';
      t.letterSpacing = 2;
      this.engine.addItem(t);
      this.closeDrawer();
    });

    document.getElementById('btn-add-mobile-body')?.addEventListener('click', () => {
      const t = new TextItem('Leyenda continua sobre las diapositivas.', this.getSpawnX(480), 400, 480, 70);
      t.fontSize = 20;
      t.fontFamily = "'Inter', sans-serif";
      this.engine.addItem(t);
      this.closeDrawer();
    });

    // Template Pickers
    document.querySelectorAll('.mobile-template-card').forEach(card => {
      card.addEventListener('click', async () => {
        const tName = card.dataset.template;
        this.closeDrawer();
        await this.studio.newProject(tName === 'blank' ? null : tName);
      });
    });
  }

  openDrawer(tabName, title) {
    this.drawerReturnFocus = this.drawer.classList.contains('hidden') ? document.activeElement : this.drawerReturnFocus;
    document.getElementById('drawer-backdrop').classList.remove('hidden');
    document.getElementById('object-adjustments').classList.remove('hidden');
    document.getElementById('layers-list').classList.add('hidden');
    this.drawerTabs.forEach(t => t.classList.remove('active'));
    const targetTab = document.getElementById(`drawer-tab-${tabName}`);
    if (targetTab) targetTab.classList.add('active');

    if (this.drawerTitle) this.drawerTitle.textContent = title;
    this.drawer.classList.remove('hidden');
    this.drawer.focus({ preventScroll: true });
    this.navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
      btn.setAttribute('aria-expanded', btn.dataset.tab === tabName ? 'true' : 'false');
    });

    // Update adjust drawer values if opened for item
    if (tabName === 'adjust' && this.engine.selectedItem) {
      const it = this.engine.selectedItem;
      const isImg = it.type === 'image';
      const isTxt = it.type === 'text';
      document.getElementById('shape-section-label').classList.toggle('hidden', !isImg);
      if (isTxt) {
        const fields = document.getElementById('object-adjustments');
        fields.prepend(document.getElementById('text-style-controls'));
        fields.prepend(document.getElementById('mobile-field-text'));
      }
      document.getElementById('text-style-controls').classList.toggle('hidden', !isTxt);
      document.getElementById('radius-field').classList.toggle('hidden', !isImg);
      document.getElementById('btn-open-frame-adjust').classList.toggle('hidden', !isImg);

      document.getElementById('shape-selector-grid').style.display = isImg ? 'grid' : 'none';
      document.getElementById('mobile-field-polaroid').classList.toggle('hidden', !isImg || it.frameStyle !== 'polaroid');
      document.getElementById('mobile-field-text').classList.toggle('hidden', !isTxt);

      if (isImg) {
        const currentShape = it.frameStyle === 'polaroid' ? 'polaroid' : (it.frameStyle === 'film' ? 'film' : (it.clipShape || 'rect'));
        document.querySelectorAll('#shape-selector-grid .shape-choice-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.shape === currentShape);
        });

        document.getElementById('mobile-input-polaroid').value = it.caption || '';
        document.getElementById('mobile-slider-radius').value = it.borderRadius || 0;
      }

      if (isTxt) {
        document.getElementById('mobile-input-text').value = it.text || '';
        document.getElementById('text-font').value = it.fontFamily;
        document.getElementById('text-size').value = it.fontSize;
        document.getElementById('text-color').value = it.color;
        document.getElementById('text-align').value = it.textAlign;
      }

      document.getElementById('mobile-slider-opacity').value = it.opacity;
      document.getElementById('mobile-toggle-shadow').checked = it.shadow?.enabled || false;
    }
  }

  closeDrawer() {
    const wasOpen = !this.drawer.classList.contains('hidden');
    this.drawer.classList.add('hidden');
    document.getElementById('drawer-backdrop').classList.add('hidden');
    this.navBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-expanded', 'false'); });
    if (wasOpen && this.drawerReturnFocus?.isConnected) this.drawerReturnFocus.focus({ preventScroll: true });
  }

  getSpawnX(itemWidth) {
    return this.engine.getActiveSlideIndex() * this.engine.slideWidth + (this.engine.slideWidth - itemWidth) / 2;
  }

  // 5. FILE UPLOAD HANDLER
  bindFileUpload() {
    const uploadBtn = document.getElementById('btn-mobile-upload');
    const uploadInput = document.getElementById('mobile-file-input');

    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', (e) => {
        this.handleFiles(e.target.files);
        uploadInput.value = '';
        this.closeDrawer();
      });
    }
  }

  handleFiles(files) {
    if (!files || files.length === 0) return;
    const projectId = this.storage.projectId;
    const selectedFiles = Array.from(files);
    this.uploadQueue = (this.uploadQueue || Promise.resolve()).then(async () => {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (projectId !== this.storage.projectId) break;
        if (!file.type.startsWith('image/')) continue;
        try {
          const url = URL.createObjectURL(file);
          let img;
          const original = new Image();
          try {
            original.src = url;
            await original.decode();
            const scale = Math.min(1, 1280 / Math.max(original.naturalWidth, original.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(original.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(original.naturalHeight * scale));
            try {
              canvas.getContext('2d').drawImage(original, 0, 0, canvas.width, canvas.height);
              img = new Image();
              img.src = canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
            } finally {
              canvas.width = canvas.height = 0;
            }
          } finally {
            original.src = '';
            URL.revokeObjectURL(url);
          }
          await img.decode();
          if (projectId !== this.storage.projectId) break;
          const originalKey = await this.storage.saveOriginal(file);
          if (projectId !== this.storage.projectId) break;
          const scale = Math.min(1, this.engine.slideWidth * 0.75 / Math.max(img.naturalWidth, img.naturalHeight));
          const w = img.naturalWidth * scale;
          const h = img.naturalHeight * scale;
          const item = new ImageItem(img, this.getSpawnX(w) + i * 24, Math.max(0, (this.engine.slideHeight - h) / 2) + i * 24, Math.round(w), Math.round(h));
          item.borderRadius = 8;
          item.originalKey = originalKey;
          this.engine.addItem(item);
          await new Promise(resolve => setTimeout(resolve, 0));
        } catch (error) {
          this.studio.toast(error.message || 'Esta foto no se pudo abrir. Prueba con JPG, PNG o WebP.');
        }
      }
    });
    return this.uploadQueue;
  }

  // 6. POPULATE MOBILE SAMPLE GALLERIES
  populateSamplePhotos() {
    const grid = document.getElementById('mobile-sample-photos-grid');
    if (!grid) return;
    grid.innerHTML = '';

    SAMPLE_PHOTOS.forEach(photo => {
      const card = document.createElement('button');
      card.className = 'mobile-photo-card';
      card.innerHTML = `
        <img src="${photo.url}" alt="${photo.title}" loading="lazy"/>
        <div class="mobile-photo-label">${photo.title}</div>
      `;
      card.addEventListener('click', () => {
        const img = new Image();
        img.onload = () => {
          const w = photo.aspect > 1 ? this.engine.slideWidth * 1.3 : this.engine.slideWidth * 0.7;
          const h = w / photo.aspect;
          const item = new ImageItem(img, this.getSpawnX(w), 280, Math.round(w), Math.round(h));
          item.borderRadius = 8;
          this.engine.addItem(item);
          this.closeDrawer();
        };
        img.src = photo.url;
      });
      grid.appendChild(card);
    });
  }

  populateStickers() {
    const grid = document.getElementById('mobile-stickers-grid');
    if (!grid) return;
    grid.innerHTML = '';

    STICKERS.forEach(sticker => {
      const itemEl = document.createElement('button');
      itemEl.className = 'mobile-sticker-card';
      itemEl.innerHTML = `<img src="${sticker.url}" alt="${sticker.title}"/>`;
      itemEl.addEventListener('click', () => {
        const img = new Image();
        img.onload = () => {
          const s = new StickerItem(img, this.getSpawnX(sticker.width * 1.4), 380, sticker.width * 1.4, sticker.height * 1.4, sticker.title);
          this.engine.addItem(s);
          this.closeDrawer();
        };
        img.src = sticker.url;
      });
      grid.appendChild(itemEl);
    });
  }

  populatePalettes() {
    const grid = document.getElementById('mobile-palette-grid');
    if (!grid) return;
    grid.innerHTML = '';

    PALETTES.forEach(pal => {
      const btn = document.createElement('button');
      btn.className = 'mobile-palette-btn';
      btn.title = pal.name;
      btn.setAttribute('aria-label', pal.name);
      btn.style.background = pal.bg;
      btn.addEventListener('click', () => {
        this.engine.background = pal.bg;
        this.engine.triggerChange();
        this.engine.saveHistory(`Background: ${pal.name}`);
        this.closeDrawer();
      });
      grid.appendChild(btn);
    });
  }

  // 7. SELECTION CHANGE CALLBACK
  onSelectionChanged(item) {
    document.getElementById('selection-toolbar').classList.toggle('has-selection', !!item);
    document.getElementById('btn-ctx-fill-slide')?.classList.toggle('hidden', item?.type !== 'image');
    document.getElementById('btn-align-fill-slide')?.classList.toggle('hidden', item?.type !== 'image');
    if (item) {
      document.getElementById('selection-hint').classList.add('hidden');
      this.contextBar.classList.remove('hidden');
      const isImg = item.type === 'image';
      document.getElementById('btn-ctx-crop')?.classList.toggle('hidden', !isImg);
      document.getElementById('btn-ctx-edit-frame')?.classList.toggle('hidden', !isImg);
      document.getElementById('btn-ctx-shapes')?.classList.toggle('hidden', !isImg);
    } else {
      document.getElementById('selection-hint').classList.remove('hidden');
      this.contextBar.classList.add('hidden');
      if (document.getElementById('drawer-tab-adjust')?.classList.contains('active')) {
        this.closeDrawer();
      }
    }
  }

  onCanvasChanged() {
    this.updateHeaderUI();
    if (this.loadingProject) return;
    this.studio?.update();
    // Auto-save project into persistent cache (IndexedDB + localStorage)
    this.storage.scheduleAutoSave();
    if (!this.engine.activeHandle) this.storage.flush();
  }

  bindTextStyles() {
    const font = document.getElementById('text-font');
    FONTS.forEach(entry => {
      const option = document.createElement('option');
      option.value = entry.family;
      option.textContent = entry.name;
      font.appendChild(option);
    });
    const controls = {
      'text-font': ['fontFamily', value => value],
      'text-size': ['fontSize', value => Math.max(10, Math.min(240, Number(value) || 10))],
      'text-color': ['color', value => value],
      'text-align': ['textAlign', value => value]
    };
    for (const [id, [property, convert]] of Object.entries(controls)) {
      document.getElementById(id).addEventListener('input', e => {
        const item = this.engine.selectedItem;
        if (!item || item.type !== 'text') return;
        item[property] = convert(e.target.value);
        this.engine.triggerChange();
      });
    }
    // Commit continuous controls once per interaction, so Undo stays useful.
    document.querySelectorAll('#object-adjustments input, #object-adjustments select, #object-adjustments textarea').forEach(control => {
      control.addEventListener('change', () => {
        if (this.engine.selectedItem) this.engine.saveHistory('Editar elemento');
      });
    });
    document.querySelectorAll('.mobile-template-card').forEach(card => {
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); card.click();
        }
      });
    });
  }

  bindDialogAccessibility() {
    const overlays = [...document.querySelectorAll('.mobile-modal-overlay')];
    overlays.forEach(modal => {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.tabIndex = -1;
      modal.setAttribute('aria-label', {
        'preview-modal': 'Vista previa del carrusel', 'crop-modal': 'Recortar imagen',
        'frame-modal': 'Ajustar encuadre', 'export-modal': 'Exportar carrusel'
      }[modal.id]);
    });
    document.querySelectorAll('button[title]').forEach(btn => {
      if (!btn.textContent.trim() || btn.textContent.trim() === '✕') btn.setAttribute('aria-label', btn.title);
    });
    document.getElementById('btn-close-drawer').setAttribute('aria-label', 'Cerrar herramientas');
    document.getElementById('btn-close-export-sheet').setAttribute('aria-label', 'Cerrar exportación');
    document.getElementById('btn-close-ig-preview').setAttribute('aria-label', 'Cerrar vista previa');
    document.getElementById('frame-zoom-slider').setAttribute('aria-label', 'Zoom de la imagen');
    this.navBtns.forEach(btn => {
      btn.setAttribute('aria-controls', 'bottom-sheet-drawer');
      btn.setAttribute('aria-expanded', 'false');
    });
    const activeModal = () => overlays.filter(el => !el.classList.contains('hidden')).at(-1)
      || (!this.drawer.classList.contains('hidden') ? this.drawer : null);
    let previousModal = null;
    let returnFocus = null;
    const observer = new MutationObserver(() => {
      const modal = activeModal();
      const changed = modal !== previousModal;
      document.getElementById('editor-view').inert = !!modal;
      document.getElementById('home-view').inert = !!modal;
      this.drawer.inert = !!modal && modal !== this.drawer;
      overlays.forEach(el => { el.inert = !!modal && el !== modal; });
      if (changed && modal) {
        if (!previousModal) returnFocus = document.activeElement;
        const first = modal.querySelector('button:not(:disabled),input,textarea,select');
        (first || modal).focus({ preventScroll: true });
      }
      if (changed && !modal && returnFocus?.isConnected && returnFocus.getClientRects().length) {
        returnFocus.focus({ preventScroll: true });
      }
      previousModal = modal;
    });
    [...overlays, this.drawer].forEach(modal => observer.observe(modal, { attributes: true, attributeFilter: ['class'] }));
    document.addEventListener('keydown', e => {
      const modal = activeModal();
      if (!modal || e.key !== 'Tab') return;
      const focusable = [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,select,[tabindex="0"]')]
        .filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
        e.preventDefault(); last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first?.focus();
      }
    });
  }

  // 8. EXPORT SHEET (PEAK-END CELEBRATION)
  bindExportSheet() {
    this.exportModal = document.getElementById('export-modal');
    this.stripContainer = document.getElementById('export-strip-container');
    this.btnZip = document.getElementById('btn-download-zip');
    this.btnPanorama = document.getElementById('btn-download-panorama');

    document.getElementById('btn-close-export-sheet')?.addEventListener('click', () => {
      this.exportModal.classList.add('hidden');
    });

    this.exportModal?.addEventListener('click', (e) => {
      if (e.target === this.exportModal) this.exportModal.classList.add('hidden');
    });

    if (this.btnZip) {
      this.btnZip.addEventListener('click', async () => {
        this.btnZip.disabled = true;
        this.btnZip.innerHTML = '<span class="spinner"></span> Preparando descarga…';
        const status = document.getElementById('export-status-label');
        try {
          await this.exporter.downloadAllAsZip(message => { status.textContent = message; });
          this.studio.toast('Tu historia está lista. Descarga iniciada.');
        } catch (error) {
          status.textContent = 'No se pudo crear el ZIP. Inténtalo otra vez o descarga cada PNG.';
        } finally {
          this.btnZip.disabled = false;
          this.btnZip.textContent = `Descargar ${this.engine.slideCount} páginas · ZIP`;
        }
      });
    }

    if (this.btnPanorama) {
      this.btnPanorama.addEventListener('click', async () => {
        this.btnPanorama.disabled = true;
        try { await this.exporter.downloadFullPanorama(); }
        catch { document.getElementById('export-status-label').textContent = 'No se pudo crear el panorama. Inténtalo otra vez.'; }
        finally { this.btnPanorama.disabled = false; }
      });
    }
  }

  openExportSheet() {
    this.exportModal.classList.remove('hidden');
    const slides = Array.from({ length: this.engine.slideCount }, (_, i) => ({
      index: i + 1, canvas: this.exporter.renderThumbnail(i, 180)
    }));
    document.querySelector('.export-subtitle').textContent = `${this.engine.slideCount} páginas · ${this.engine.slideWidth} × ${this.engine.slideHeight} px · PNG`;
    document.getElementById('export-status-label').textContent = 'Las imágenes se generan en tu dispositivo.';

    this.stripContainer.innerHTML = '';
    slides.forEach(slide => {
      const card = document.createElement('div');
      card.className = 'export-mini-card';

      const thumb = document.createElement('canvas');
      thumb.width = 180;
      thumb.height = slide.canvas.height;
      const ctx = thumb.getContext('2d');
      ctx.drawImage(slide.canvas, 0, 0);

      card.innerHTML = `
        <div class="export-mini-thumb"></div>
        <div class="export-mini-info">
          <span>Página ${slide.index}</span>
          <button class="btn-mini-dl" data-idx="${slide.index}">PNG</button>
        </div>
      `;

      card.querySelector('.export-mini-thumb').appendChild(thumb);
      card.querySelector('.btn-mini-dl').setAttribute('aria-label', `Descargar página ${slide.index} como PNG`);
      card.querySelector('.btn-mini-dl').addEventListener('click', async () => {
        try { await this.exporter.downloadSlide(slide.index); }
        catch { document.getElementById('export-status-label').textContent = 'No se pudo descargar la página. Inténtalo otra vez.'; }
      });
      this.stripContainer.appendChild(card);
    });

    if (this.btnZip) {
      this.btnZip.textContent = `Descargar ${this.engine.slideCount} páginas · ZIP`;
    }
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.__notScrlApp = new NotScrlMobileApp();
});
