/**
 * NotSCRL Application Controller (Mobile-First Architecture)
 * Follows mobile UI design rules: thumb-zone action bars, sliding drawers,
 * tactile touch targets, and peak-end export delight.
 */

import { CanvasEngine } from './canvas.js';
import { ImageItem, TextItem, StickerItem } from './objects.js';import { CanvasExporter, pageCountLabel } from './exporter.js';
import { PreviewSimulator } from './preview.js';
import { ImageCropper } from './cropper.js';
import { FrameAdjuster } from './frame-adjuster.js';
import { StickerStudio, readLibrary } from './sticker-studio.js';
import { StorageManager } from './storage.js';
import { Studio } from './studio.js';
import { applyTemplate } from './templates.js';
import { PALETTES, FONTS, STICKERS } from './assets.js';

// Expose object types globally for history deserialization
window.__notScrlObjects = { ImageItem, TextItem, StickerItem };

class NotScrlMobileApp {
  constructor() {
    this.canvasEl = document.getElementById('main-canvas');
    this.workspaceEl = document.getElementById('canvas-workspace');

    this.engine = new CanvasEngine(this.canvasEl, this.workspaceEl);
    this.storage = new StorageManager(this.engine);
    this.engine.loadMediaBlob = (key) => this.storage.loadOriginal(key);
    this.loadingProject = true;
    this.exporter = new CanvasExporter(this.engine, this.storage);
    this.preview = new PreviewSimulator(this.exporter, document.getElementById('preview-modal'));
    this.cropper = new ImageCropper(this.engine);
    this.frameAdjuster = new FrameAdjuster(this.engine);
    this.stickerStudio = new StickerStudio(this.storage);

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
    this.bindGiphy();
    this.bindStickerSegments();
    this.bindDesktopInspector();
    this.bindSliderValues();

    // Populate drawer content
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
    this.studio?.renderPages();
    this.bindTextStyles();
    this.bindDialogAccessibility();
    if (savedProject) await this.storage.flush();
    // Reopen the project the user left open; the home view stays home.
    if (savedProject && localStorage.getItem('notscrl_view') === 'editor') this.studio.showEditor();
    else this.studio.showHome();
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
    const btnPlus = document.getElementById('btn-plus-slide');

    document.getElementById('btn-delete-page')?.addEventListener('click', () => this.deleteActivePage());

    document.getElementById('btn-duplicate-page')?.addEventListener('click', () => {
      const index = this.engine.getActiveSlideIndex();
      if (this.engine.duplicateSlide(index)) {
        this.updateHeaderUI();
        this.studio?.renderPages();
        this.studio?.toast(`Página ${index + 1} duplicada.`);
      } else if (this.engine.slideCount >= 10) {
        this.studio?.toast('Máximo 10 páginas. Elimina una antes de duplicar.');
      }
    });

    if (btnPlus) {
      btnPlus.addEventListener('click', () => {
        if (this.engine.insertSlide(this.engine.getActiveSlideIndex() + 1)) {
          this.updateHeaderUI();
          this.studio?.renderPages();
        } else {
          this.studio?.toast('Máximo 10 páginas por carrusel. Elimina o reordena las que ya tienes.');
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

  deleteActivePage() {
    const index = this.engine.getActiveSlideIndex();
    if (!this.engine.removeSlide(index)) return;
    this.updateHeaderUI();
    this.studio?.renderPages();
    const historyIndex = this.engine.historyIndex;
    this.studio?.toast(`Página ${index + 1} eliminada.`, {
      label: 'Deshacer',
      run: () => {
        if (this.engine.historyIndex !== historyIndex) {
          this.studio?.toast('Ya hay otros cambios. Usa Deshacer del lienzo.');
          return;
        }
        this.engine.undo();
      }
    });
  }

  updateHeaderUI() {
    document.getElementById('aspect-ratio-select').value = this.engine.aspectRatioName;
    document.getElementById('btn-delete-page').disabled = this.engine.slideCount <= 1;
    const plus = document.getElementById('btn-plus-slide');
    if (plus) {
      const atMax = this.engine.slideCount >= 10;
      plus.title = atMax
        ? 'Máximo 10 páginas por carrusel'
        : 'Añadir página después de la actual (máximo 10)';
    }
    document.getElementById('btn-undo').disabled = this.engine.historyIndex <= 0 || this.engine.isRestoringHistory;
    document.getElementById('btn-redo').disabled = this.engine.historyIndex >= this.engine.history.length - 1 || this.engine.isRestoringHistory;
    const slideCountEl = document.getElementById('slide-count-display');
    if (slideCountEl) {
      slideCountEl.textContent = this.engine.slideCount;
    }
    const slideCountUnit = document.getElementById('slide-count-unit');
    if (slideCountUnit) {
      slideCountUnit.textContent = this.engine.slideCount === 1 ? 'página' : 'páginas';
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
        btnGuides.setAttribute('aria-pressed', String(this.engine.showGuides));
        this.engine.render();
      });
    }

    // Fit / View Toggle
    const btnFit = document.getElementById('btn-zoom-fit');
    if (btnFit) {
      btnFit.addEventListener('click', () => this.engine.toggleViewMode());
    }

    // Double-click canvas to crop or toggle view
    this.canvasEl.addEventListener('dblclick', () => {
      if (this.engine.selectedItem && this.engine.selectedItem.type === 'image') {
        this.cropper.open(this.engine.selectedItem);
      } else {
        this.engine.toggleViewMode();
      }
    });

    // Undo / Redo
    document.getElementById('btn-undo')?.addEventListener('click', () => this.engine.undo());
    document.getElementById('btn-redo')?.addEventListener('click', () => this.engine.redo());

    // Hand tool: pan the canvas without selecting or dragging items.
    const handButton = document.getElementById('btn-hand-tool');
    if (handButton) {
      const syncHand = (on) => {
        handButton.classList.toggle('active', on);
        handButton.setAttribute('aria-pressed', String(on));
      };
      this.engine.onHandModeChange = syncHand;
      handButton.addEventListener('click', () => this.engine.setHandMode(!this.engine.handMode));
      syncHand(this.engine.handMode);
    }

    // Preview
    document.getElementById('btn-preview-ig')?.addEventListener('click', () => this.preview.open());
  }

  // 3. CONTEXT ACTION BAR (FLOATING AT TOP UNDER HEADER)
  bindContextActionBar() {
    this.contextBar = document.getElementById('context-action-bar');
    this.moreBtn = document.getElementById('btn-ctx-more');
    this.moreSheet = document.getElementById('context-more-sheet');
    this.moreBtn?.addEventListener('click', () => {
      this.setMoreOpen(this.moreBtn.getAttribute('aria-expanded') !== 'true');
    });
    this.moreSheet?.addEventListener('click', (event) => {
      if (event.target.closest('.context-btn')) this.setMoreOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || this.moreBtn?.getAttribute('aria-expanded') !== 'true') return;
      event.preventDefault();
      this.setMoreOpen(false);
    });
    document.getElementById('btn-ctx-fill-slide')?.addEventListener('click', () => {
      const item = this.engine.selectedItem;
      if (!item || item.type !== 'image') return;
      this.engine.fillImageToSlide(item);
      this.studio?.toast('Foto a página completa. Puedes deshacer.');
    });

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
      this.openDrawer('adjust', 'Formas y ajustes');
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

  setMoreOpen(open, restoreFocus = true) {
    if (!this.moreBtn || !this.moreSheet) return;
    this.moreSheet.classList.toggle('hidden', !open);
    this.moreBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      this.moreSheet.querySelector('.context-btn:not(.hidden)')?.focus();
    } else if (restoreFocus && this.moreSheet.contains(document.activeElement)) {
      this.moreBtn.focus();
    } else if (this.moreSheet.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  usesDesktopInspector() {
    return !!this.inspectorMedia?.matches;
  }

  bindDesktopInspector() {
    this.inspector = document.getElementById('desktop-inspector');
    if (!this.inspector) return;
    this.inspectorBody = this.inspector.querySelector('.inspector-body');
    this.inspectorTransform = document.getElementById('inspector-transform');
    this.inspectorEmpty = document.getElementById('inspector-empty');
    this.inspectorFields = {
      x: document.getElementById('insp-x'),
      y: document.getElementById('insp-y'),
      rotation: document.getElementById('insp-rotation'),
      width: document.getElementById('insp-width'),
      height: document.getElementById('insp-height')
    };
    this.inspectorAdjustmentsHost = document.getElementById('inspector-adjustments');
    this.inspectorLayersHost = document.getElementById('inspector-layers-host');

    const commit = (property, minimum) => {
      const item = this.engine.selectedItem;
      const input = this.inspectorFields[property];
      if (!item || !input) return;
      const value = Number(String(input.value).replace(',', '.'));
      if (!Number.isFinite(value)) {
        this.syncInspectorFields(true);
        return;
      }
      let next = Math.round(value);
      if (minimum !== undefined) next = Math.max(minimum, next);
      if (property === 'rotation') next = ((next % 360) + 360) % 360;
      if (item[property] === next) {
        if (input.value !== String(next)) input.value = next;
        return;
      }
      item[property] = next;
      input.value = next;
      this.engine.triggerChange();
      // One history entry per committed value, never per keystroke.
      this.engine.saveHistory('Ajustar propiedades');
    };

    for (const [property, minimum] of [['x'], ['y'], ['rotation'], ['width', 1], ['height', 1]]) {
      const input = this.inspectorFields[property];
      input.addEventListener('change', () => commit(property, minimum));
      input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        commit(property, minimum);
        input.select();
      });
    }

    // Desktop replacement for the old bottom action bar.
    const withItem = (fn) => () => {
      if (this.engine.selectedItem) fn(this.engine.selectedItem);
    };
    document.getElementById('insp-crop')?.addEventListener('click', withItem((item) => {
      if (item.type === 'image') this.cropper.open(item);
    }));
    document.getElementById('insp-fill')?.addEventListener('click', withItem((item) => {
      if (item.type !== 'image') return;
      this.engine.fillImageToSlide(item);
      this.studio?.toast('Foto a página completa. Puedes deshacer.');
    }));
    document.getElementById('insp-duplicate')?.addEventListener('click', withItem((item) => {
      this.engine.duplicateItem(item);
    }));
    document.getElementById('insp-delete')?.addEventListener('click', withItem((item) => {
      this.engine.removeItem(item);
    }));

    this.inspectorMedia = window.matchMedia('(min-width: 1024px)');
    this.placeInspectorContent();
    const onChange = () => this.placeInspectorContent();
    if (this.inspectorMedia.addEventListener) this.inspectorMedia.addEventListener('change', onChange);
    else this.inspectorMedia.addListener?.(onChange);
  }

  // Move the object controls to the inspector on desktop and back into the
  // sheet on smaller screens. One node, one surface; listeners survive moves.
  placeInspectorContent() {
    const layers = document.getElementById('layers-list');
    const adjustments = document.getElementById('object-adjustments');
    const drawerTab = document.getElementById('drawer-tab-adjust');
    if (!layers || !adjustments || !drawerTab) return;
    if (this.usesDesktopInspector()) {
      if (!this.drawer.classList.contains('hidden') && document.getElementById('drawer-tab-adjust')?.classList.contains('active')) {
        this.closeDrawer();
      }
      this.inspectorLayersHost.appendChild(layers);
      this.inspectorAdjustmentsHost.appendChild(adjustments);
      layers.classList.remove('hidden');
      adjustments.classList.remove('hidden');
    } else if (layers.parentElement !== drawerTab) {
      drawerTab.prepend(layers);
      adjustments.classList.remove('hidden');
      drawerTab.insertBefore(adjustments, layers.nextSibling);
      layers.classList.add('hidden');
    }
    this.bindInspectorSections();
    this.syncInspector(true);
  }

  // Desktop-only accordion: one category open at a time, all closed by default.
  bindInspectorSections() {
    if (!this.usesDesktopInspector()) return;
    const groups = [...this.inspector.querySelectorAll('#desktop-inspector .adjust-group')];
    const setCollapsed = (group, collapsed) => {
      group.classList.toggle('collapsed', collapsed);
      group
        .querySelector(':scope > .drawer-section-label')
        ?.setAttribute('aria-expanded', String(!collapsed));
    };
    groups.forEach((group) => {
      const label = group.querySelector(':scope > .drawer-section-label');
      if (!label || label.dataset.collapsible) return;
      label.dataset.collapsible = '1';
      label.setAttribute('role', 'button');
      label.setAttribute('tabindex', '0');
      setCollapsed(group, true);
      const toggle = () => {
        const wasCollapsed = group.classList.contains('collapsed');
        groups.forEach((other) =>
          setCollapsed(other, other !== group || !wasCollapsed),
        );
      };
      label.addEventListener('click', toggle);
      label.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
      });
    });
  }

  focusInspector() {
    if (!this.usesDesktopInspector()) return false;
    const target = this.engine.selectedItem ? this.inspectorFields.x : this.inspector;
    this.inspectorBody.scrollTop = 0;
    target?.focus({ preventScroll: true });
    return true;
  }

  syncInspector(full = false) {
    if (!this.inspector || !this.usesDesktopInspector()) return;
    const item = this.engine.selectedItem;
    this.inspector
      .querySelectorAll('[data-image-only]')
      .forEach((button) => button.classList.toggle('hidden', item?.type !== 'image'));
    this.inspectorTransform.classList.toggle('hidden', !item);
    this.inspectorEmpty.classList.toggle('hidden', !!item);
    document.getElementById('object-adjustments')?.classList.toggle('hidden', !item);
    if (!item) {
      this.syncInspectorFields(true);
      if (full) this.studio?.renderLayers();
      return;
    }
    this.syncInspectorFields();
    if (full) {
      this.syncAdjustmentPanel();
      this.studio?.renderLayers();
    }
  }

  syncInspectorFields(force = false) {
    const item = this.engine.selectedItem;
    if (!item) {
      for (const input of Object.values(this.inspectorFields)) input.value = '';
      return;
    }
    const values = {
      x: item.x,
      y: item.y,
      rotation: item.rotation || 0,
      width: item.width,
      height: item.height
    };
    for (const [key, value] of Object.entries(values)) {
      const input = this.inspectorFields[key];
      if (!input || (!force && document.activeElement === input)) continue;
      input.value = Math.round(value);
    }
  }

  // Show the live value of every range input so the number is never guessed.
  bindSliderValues() {
    this.sliderOutputs = new Map();
    document.querySelectorAll('input[type="range"]').forEach((input) => {
      if ('noValue' in input.dataset) return;
      const output = document.createElement('output');
      output.className = 'slider-value';
      if (input.id) output.htmlFor = input.id;
      input.insertAdjacentElement('afterend', output);
      this.sliderOutputs.set(input, output);
      input.addEventListener('input', () => this.updateSliderValue(input));
      this.updateSliderValue(input);
    });
  }

  updateSliderValue(input) {
    const output = this.sliderOutputs?.get(input);
    if (!output) return;
    const value = Number(input.value);
    let text;
    if (input.dataset.format === 'percent') {
      text = `${Math.round(value * 100)}%`;
    } else if (input.dataset.format === 'zoom') {
      text = `${value.toFixed(1)}×`;
    } else {
      const step = Number(input.step) || 1;
      text = `${step < 1 ? value.toFixed(1) : Math.round(value)}${input.dataset.suffix || ''}`;
    }
    output.textContent = text;
  }

  refreshSliderValues() {
    if (!this.sliderOutputs) return;
    for (const input of this.sliderOutputs.keys()) this.updateSliderValue(input);
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
      const maxW = this.engine.slideWidth * 2 - 160;
      const maxH = this.engine.slideHeight - 160;
      const aspect = it.width / it.height;

      // Span both pages without spilling past the page height; keep the aspect.
      let width = maxW;
      let height = Math.round(width / aspect);
      if (height > maxH) {
        height = maxH;
        width = Math.round(height * aspect);
      }

      it.width = width;
      it.height = height;
      it.x = Math.round(this.engine.slideWidth - width / 2);
      it.y = Math.round((this.engine.slideHeight - height) / 2);
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
  }

  // 4. BOTTOM NAVIGATION & BOTTOM SHEET DRAWER
  bindBottomNavAndDrawer() {
    this.drawer = document.getElementById('bottom-sheet-drawer');
    this.navBar = document.getElementById('mobile-bottom-bar');
    this.drawerTitle = document.getElementById('drawer-title-text');
    this.navBtns = document.querySelectorAll('.nav-tab-btn');
    this.drawerTabs = document.querySelectorAll('.drawer-tab-content');

    const tabTitles = {
      photos: 'Fotos',
      text: 'Texto',
      stickers: 'Stickers',
      templates: 'Plantillas',
      background: 'Fondo'
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

    // Template Pickers
    document.querySelectorAll('.mobile-template-card').forEach(card => {
      card.addEventListener('click', async () => {
        const tName = card.dataset.template;
        this.closeDrawer();
        await this.studio.newProject(tName === 'blank' ? null : tName);
      });
    });
    // The sheet grows with its content; keep the artwork framed as it does.
    new ResizeObserver(() => {
      if (this.drawer.classList.contains('hidden')) return;
      this.syncSheetOffset();
      this.frameForDrawer();
    }).observe(this.drawer);
    window.addEventListener('resize', () => {
      if (this.drawer.classList.contains('hidden')) return;
      this.syncSheetOffset();
      this.frameForDrawer();
    });
  }

  usesBottomSheet() {
    return !window.matchMedia('(min-width: 1024px)').matches;
  }

  // Sit the sheet on top of the floating tool rail instead of covering it.
  syncSheetOffset() {
    if (!this.usesBottomSheet()) {
      this.drawer.style.removeProperty('--sheet-rail-offset');
      return;
    }
    const offset = Math.max(
      0,
      Math.round(window.innerHeight - this.navBar.getBoundingClientRect().top)
    );
    this.drawer.style.setProperty('--sheet-rail-offset', `${offset}px`);
  }

  frameForDrawer() {
    // La hoja flota sobre el lienzo: abrirla no debe mover ni reencuadrar la página.
  }

  openDrawer(tabName, title) {
    // On desktop the selected object's controls live in the persistent
    // inspector; keep a single surface for that job.
    if (tabName === 'adjust' && this.usesDesktopInspector()) {
      this.syncInspector(true);
      this.focusInspector();
      return;
    }
    this.drawerReturnFocus = this.drawer.classList.contains('hidden') ? document.activeElement : this.drawerReturnFocus;
    clearTimeout(this.drawer.__closeTimer);
    this.drawer.classList.remove('is-closing');
    document.getElementById('drawer-backdrop').classList.remove('is-closing');
    document.getElementById('drawer-backdrop').classList.remove('hidden');
    if (this.usesBottomSheet()) {
      document.getElementById('object-adjustments').classList.remove('hidden');
      document.getElementById('layers-list').classList.add('hidden');
    }
    this.drawerTabs.forEach(t => t.classList.remove('active'));
    const targetTab = document.getElementById(`drawer-tab-${tabName}`);
    if (targetTab) targetTab.classList.add('active');

    if (tabName === 'text') this.syncTextDrawer?.(this.engine.selectedItem);

    if (tabName === 'stickers' && this.giphyLoaded === false) {
      if (this.getGiphyKey()) {
        this.giphyLoaded = true;
        this.loadGiphy('');
      } else {
        this.showGiphySetup();
      }
    }
    if (tabName === 'stickers') {
      this.selectStickerSegment?.(this.stickerSegment || 'stickers');
    }

    if (this.drawerTitle) this.drawerTitle.textContent = title;
    this.drawer.classList.remove('hidden');
    document.getElementById('editor-view').classList.add('inspector-open');
    this.drawer.focus({ preventScroll: true });
    this.navBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
      btn.setAttribute('aria-expanded', btn.dataset.tab === tabName ? 'true' : 'false');
    });

    // Update adjust drawer values if opened for item
    if (tabName === 'adjust' && this.engine.selectedItem) {
      this.syncAdjustmentPanel();
    }

    this.syncSheetOffset();
    this.frameForDrawer();
  }

  syncAdjustmentPanel() {
    if (!this.engine.selectedItem) return;
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
    this.refreshSliderValues();
  }

  closeDrawer() {
    const wasOpen = !this.drawer.classList.contains('hidden');
    if (!wasOpen) return;
    this.animateClose(this.drawer, () => {
      document.getElementById('drawer-backdrop').classList.add('hidden');
      document.getElementById('editor-view').classList.remove('inspector-open');
      this.navBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-expanded', 'false'); });
      if (this.drawerReturnFocus?.isConnected) this.drawerReturnFocus.focus({ preventScroll: true });
    });
    document.getElementById('drawer-backdrop')?.classList.add('is-closing');
  }

  // Cierra un panel con su animación de salida antes de ocultarlo.
  animateClose(el, onDone, ms = 240) {
    if (!el || el.classList.contains('hidden')) {
      onDone?.();
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('hidden');
      onDone?.();
      return;
    }
    el.classList.add('is-closing');
    clearTimeout(el.__closeTimer);
    el.__closeTimer = setTimeout(() => {
      el.classList.remove('is-closing');
      el.classList.add('hidden');
      onDone?.();
    }, ms);
  }

  openAnimated(el) {
    if (!el) return;
    clearTimeout(el.__closeTimer);
    el.classList.remove('is-closing');
    el.classList.add('hidden');
    // Force a reflow so the entrance animation restarts even if it was open.
    void el.offsetWidth;
    el.classList.remove('hidden');
  }

  closeExportSheet() {
    this.animateClose(this.exportModal, null, 240);
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
        if (file.type.startsWith('video/')) {
          try {
            await this.addVideoFile(file, i);
          } catch (error) {
            this.studio?.toast(error.message || 'Este vídeo no se pudo abrir. Prueba con MP4 o WebM.');
          }
          continue;
        }
        if (!file.type.startsWith('image/')) continue;
        if (file.type === 'image/gif') {
          try {
            await this.addGifFile(file, i);
          } catch (error) {
            this.studio?.toast(error.message || 'Este GIF no se pudo abrir.');
          }
          continue;
        }
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
          item.borderRadius = 0;
          item.originalKey = originalKey;
          this.engine.addItem(item);
          await new Promise(resolve => setTimeout(resolve, 0));
        } catch (error) {
          this.studio?.toast(error.message || 'Esta foto no se pudo abrir. Prueba con JPG, PNG o WebP.');
        }
      }
    });
    return this.uploadQueue;
  }

  async addVideoFile(file, index) {
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.src = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = () => reject(new Error('Este vídeo no se pudo abrir. Prueba con MP4 o WebM.'));
    });
    video.play().catch(() => {});
    const originalKey = await this.storage.saveOriginal(file).catch(() => null);
    await this.addMediaItem(video, 'video', index, originalKey ? { originalKey } : {});
  }

  async addGifFile(file, index) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Este GIF no se pudo abrir.'));
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    await this.addMediaItem(img, 'gif', index, {});
  }

  async addMediaItem(media, mediaType, index, extra) {
    const width = media.videoWidth || media.naturalWidth;
    const height = media.videoHeight || media.naturalHeight;
    const scale = Math.min(1, this.engine.slideWidth * 0.75 / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const item = new ImageItem(
      media,
      this.getSpawnX(w) + index * 24,
      Math.max(0, (this.engine.slideHeight - h) / 2) + index * 24,
      w,
      h
    );
    item.mediaType = mediaType;
    item.borderRadius = 0;
    Object.assign(item, extra);
    this.engine.addItem(item);
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  bindGiphy() {
    this.giphyGrid = document.getElementById('giphy-grid');
    if (!this.giphyGrid) return;
    this.giphySetup = document.getElementById('giphy-setup');
    this.giphyPanel = document.getElementById('giphy-panel');
    this.giphyHelp = document.getElementById('giphy-help');
    this.giphyStatus = document.getElementById('giphy-status');
    this.giphyKeyRow = document.getElementById('giphy-key-row');
    this.giphyKeyInput = document.getElementById('giphy-key-input');
    this.giphyLoaded = false;
    this.giphyKey = '';

    const savedKey = this.getGiphyKey();
    if (savedKey) {
      if (this.giphyKeyInput) this.giphyKeyInput.value = savedKey;
      this.showGiphyPanel();
    } else {
      this.showGiphySetup();
    }

    document.getElementById('giphy-activate')?.addEventListener('click', () => {
      this.showGiphyPanel();
      this.giphyKeyRow?.classList.remove('hidden');
      this.giphyHelp?.classList.remove('hidden');
      this.giphyKeyInput?.focus();
    });

    document.getElementById('giphy-key-save')?.addEventListener('click', () => {
      const key = (this.giphyKeyInput?.value || '').trim();
      if (!key) {
        this.giphyKeyRow?.classList.remove('hidden');
        this.setGiphyStatus('Pega tu clave de GIPHY para activar los GIFs.');
        return;
      }
      this.giphyKey = key;
      const persisted = this.persistGiphyKey(key);
      this.giphyKeyRow?.classList.add('hidden');
      this.giphyHelp?.classList.add('hidden');
      this.giphyLoaded = true;
      if (!persisted) this.studio?.toast('Clave activa solo en esta sesión: el navegador no permite guardarla.');
      this.loadGiphy(document.getElementById('giphy-search-input')?.value || '');
    });

    document.getElementById('giphy-search-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!this.getGiphyKey()) {
        this.showGiphySetup();
        return;
      }
      this.loadGiphy(document.getElementById('giphy-search-input')?.value || '');
    });
  }

  bindStickerSegments() {
    this.stickerSegment = 'stickers';
    const buttons = [...document.querySelectorAll('[data-sticker-segment]')];
    if (!buttons.length) return;
    const select = (name) => {
      if (name !== 'stickers' && name !== 'gifs') return;
      this.stickerSegment = name;
      buttons.forEach(btn => {
        const active = btn.dataset.stickerSegment === name;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
      document.getElementById('segment-stickers')?.classList.toggle('hidden', name !== 'stickers');
      document.getElementById('segment-gifs')?.classList.toggle('hidden', name !== 'gifs');
      if (name === 'gifs') {
        if (!this.getGiphyKey()) this.showGiphySetup();
        else if (!this.giphyLoaded) {
          this.giphyLoaded = true;
          this.loadGiphy('');
        }
      }
      this.frameForDrawer();
    };
    buttons.forEach(btn => btn.addEventListener('click', () => select(btn.dataset.stickerSegment)));
    this.selectStickerSegment = select;
  }

  getGiphyKey() {
    if (this.giphyKey) return this.giphyKey;
    try {
      return localStorage.getItem('notscrl_giphy_key') || '';
    } catch {
      return '';
    }
  }

  persistGiphyKey(key) {
    try {
      if (key) localStorage.setItem('notscrl_giphy_key', key);
      else localStorage.removeItem('notscrl_giphy_key');
      return true;
    } catch {
      return false;
    }
  }

  showGiphySetup() {
    this.giphySetup?.classList.remove('hidden');
    this.giphyPanel?.classList.add('hidden');
    this.setGiphyStatus('');
  }

  showGiphyPanel() {
    this.giphySetup?.classList.add('hidden');
    this.giphyPanel?.classList.remove('hidden');
  }

  async loadGiphy(query) {
    if (!this.giphyGrid) return;
    const key = this.getGiphyKey();
    if (!key) {
      this.showGiphySetup();
      return;
    }
    this.showGiphyPanel();
    this.giphyGrid.innerHTML = '';
    this.setGiphyStatus('Cargando GIFs…');
    try {
      const res = await fetch(`api/giphy/search?q=${encodeURIComponent(query)}`, {
        headers: { 'x-giphy-key': key }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === 'missing_key') {
          this.giphyKeyRow?.classList.remove('hidden');
          this.giphyHelp?.classList.remove('hidden');
          this.setGiphyStatus('Activa los GIFs con tu clave de GIPHY para buscarlos.');
        } else if (res.status === 401 || res.status === 403) {
          this.giphyKeyRow?.classList.remove('hidden');
          this.giphyHelp?.classList.remove('hidden');
          this.setGiphyStatus('GIPHY rechazó esta clave. Revísala o pega otra.');
        } else if (res.status === 429) {
          this.setGiphyStatus('GIPHY limitó las búsquedas por ahora. Inténtalo en unos minutos.');
        } else {
          this.setGiphyStatus('No se pudieron cargar los GIFs. Inténtalo de nuevo.');
        }
        return;
      }
      this.setGiphyStatus('');
      const items = data.items || [];
      items.forEach((gif) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'mobile-sticker-card giphy-cell';
        const image = document.createElement('img');
        image.src = `api/giphy/media?id=${encodeURIComponent(gif.id)}`;
        image.alt = gif.title || 'GIF';
        image.loading = 'lazy';
        cell.appendChild(image);
        cell.addEventListener('click', () => this.addGiphyItem(gif));
        this.giphyGrid.appendChild(cell);
      });
      if (!items.length) this.setGiphyStatus('Sin resultados. Prueba otra búsqueda.');
    } catch {
      this.setGiphyStatus('No se pudieron cargar los GIFs. Revisa tu conexión.');
    }
  }

  addGiphyItem(gif) {
    const img = new Image();
    img.onload = () => {
      const ratio = gif.width && gif.height ? gif.width / gif.height : 1;
      const w = this.engine.slideWidth * 0.7;
      const h = w / ratio;
      const item = new ImageItem(img, this.getSpawnX(w), 280, Math.round(w), Math.round(h));
      item.mediaType = 'gif';
      item.borderRadius = 0;
      this.engine.addItem(item);
      this.closeDrawer();
    };
    img.onerror = () => this.studio?.toast('No se pudo cargar el GIF.');
    img.src = `api/giphy/media?id=${encodeURIComponent(gif.id)}`;
  }

  setGiphyStatus(text) {
    if (!this.giphyStatus) return;
    this.giphyStatus.textContent = text;
    this.giphyStatus.classList.toggle('hidden', !text);
  }

  // 6. POPULATE MOBILE STICKER GALLERY
  populateStickers() {
    const grid = document.getElementById('mobile-stickers-grid');
    if (!grid) return;
    grid.innerHTML = '';

    STICKERS.forEach(sticker => {
      const itemEl = document.createElement('button');
      itemEl.className = 'mobile-sticker-card';
      itemEl.setAttribute('aria-label', `Añadir sticker ${sticker.title}`);
      itemEl.innerHTML = `<img src="${sticker.url}" alt=""/>`;
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

    document
      .getElementById('btn-open-sticker-studio')
      ?.addEventListener('click', () => {
        this.stickerStudio.open();
      });
    this.stickerStudio.onSaved = () => this.renderCustomStickers();
    this.renderCustomStickers();
  }

  async renderCustomStickers() {
    const grid = document.getElementById('custom-stickers-grid');
    if (!grid) return;
    const label = document.getElementById('custom-stickers-label');
    const list = readLibrary();
    grid.replaceChildren();
    label?.classList.toggle('hidden', list.length === 0);
    grid.classList.toggle('hidden', list.length === 0);

    for (const entry of list) {
      let blob;
      try {
        blob = await this.storage.loadOriginal(entry.key);
      } catch {
        continue;
      }
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      const btn = document.createElement('button');
      btn.className = 'mobile-sticker-card custom-sticker-card';
      btn.setAttribute('aria-label', `Añadir sticker ${entry.title || ''}`.trim());
      const img = document.createElement('img');
      img.src = url;
      img.alt = entry.title || 'Sticker';
      img.onload = () => URL.revokeObjectURL(url);
      btn.appendChild(img);
      btn.addEventListener('click', () => this.insertCustomSticker(entry));
      grid.appendChild(btn);
    }
  }

  async insertCustomSticker(entry) {
    const blob = await this.storage.loadOriginal(entry.key);
    const img = new Image();
    const url = URL.createObjectURL(blob);
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
      img.src = url;
    });
    // Downscale and keep a data URL: the sticker then survives a project reload.
    const scale = Math.min(1, 512 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const stickerImg = new Image();
    stickerImg.src = canvas.toDataURL('image/png');
    await stickerImg.decode().catch(() => {});
    const width = Math.min(420, canvas.width);
    const ratio = width / canvas.width;
    const item = new StickerItem(
      stickerImg,
      this.getSpawnX(width),
      380,
      width,
      canvas.height * ratio,
      entry.title,
    );
    this.engine.addItem(item);
    this.closeDrawer();
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
    this.setMoreOpen(false, !!item);
    document.getElementById('selection-toolbar').classList.toggle('has-selection', !!item);
    document.getElementById('btn-ctx-fill-slide')?.classList.toggle('hidden', item?.type !== 'image');
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
    this.syncTextDrawer?.(item);
    this.syncInspector(true);
  }

  onCanvasChanged() {
    this.updateHeaderUI();
    this.syncInspector(false);
    if (this.loadingProject) return;
    this.studio?.update();
    // Auto-save project into persistent cache (IndexedDB + localStorage)
    this.storage.scheduleAutoSave();
    if (!this.engine.activeHandle) this.storage.flush();
  }

  bindTextStyles() {
    const font = document.getElementById('text-font');
    const drawerFont = document.getElementById('drawer-text-font');
    FONTS.forEach(entry => {
      for (const select of [font, drawerFont]) {
        const option = document.createElement('option');
        option.value = entry.family;
        option.textContent = entry.name;
        select?.appendChild(option);
      }
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
    this.bindTextDrawer();
  }

  // Text tool panel: content, font, size, colour, alignment, bold/italic and emojis.
  bindTextDrawer() {
    const input = document.getElementById('drawer-text-input');
    const font = document.getElementById('drawer-text-font');
    const size = document.getElementById('drawer-text-size');
    const color = document.getElementById('drawer-text-color');
    const align = document.getElementById('drawer-text-align');
    const bold = document.getElementById('drawer-text-bold');
    const italic = document.getElementById('drawer-text-italic');
    const grid = document.getElementById('drawer-emoji-grid');
    const add = document.getElementById('btn-add-text');
    if (!input || !font || !size || !color || !align || !bold || !italic || !grid || !add) return;

    const selectedText = () => {
      const item = this.engine.selectedItem;
      return item && item.type === 'text' ? item : null;
    };
    const apply = fn => {
      const item = selectedText();
      if (!item) return;
      fn(item);
      this.engine.triggerChange();
    };
    const commit = () => {
      if (selectedText()) this.engine.saveHistory('Editar texto');
    };
    const clampSize = () => Math.max(10, Math.min(240, Number(size.value) || 48));

    input.addEventListener('input', () => apply(item => { item.text = input.value; }));
    input.addEventListener('change', commit);
    font.addEventListener('change', () => {
      apply(item => { item.fontFamily = font.value; });
      commit();
    });
    size.addEventListener('input', () => apply(item => { item.fontSize = clampSize(); }));
    size.addEventListener('change', commit);
    color.addEventListener('input', () => apply(item => { item.color = color.value; }));
    color.addEventListener('change', commit);
    align.addEventListener('change', () => {
      apply(item => { item.textAlign = align.value; });
      commit();
    });

    const toggle = (button, onValue, offValue, property) => {
      const on = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(on));
      apply(item => { item[property] = on ? onValue : offValue; });
      commit();
    };
    bold.addEventListener('click', () => toggle(bold, '700', '400', 'fontWeight'));
    italic.addEventListener('click', () => toggle(italic, 'italic', 'normal', 'fontStyle'));

    const EMOJIS = ['😀', '😍', '🥰', '😎', '🤩', '😂', '🥳', '😭', '😅', '🙃', '😴', '🤔', '👀', '👍', '👏', '🙌', '🤝', '💪', '✨', '🔥', '💛', '🧡', '❤️', '💚', '💙', '💜', '🌈', '⭐', '🌞', '🌊', '🌸', '🍀', '🎉', '🎈', '📸', '🎧', '☕', '🍕', '✈️', '🏔️'];
    EMOJIS.forEach(emoji => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'emoji-btn';
      button.textContent = emoji;
      button.setAttribute('aria-label', `Insertar ${emoji}`);
      button.addEventListener('click', () => {
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + emoji.length;
        apply(item => { item.text = input.value; });
        commit();
      });
      grid.appendChild(button);
    });

    add.addEventListener('click', () => {
      const fontSize = clampSize();
      const width = 560;
      const item = new TextItem(
        input.value.trim() || 'Tu texto',
        this.getSpawnX(width),
        240,
        width,
        Math.max(80, Math.round(fontSize * 1.5))
      );
      item.fontFamily = font.value || item.fontFamily;
      item.fontSize = fontSize;
      item.color = color.value;
      item.textAlign = align.value;
      item.fontWeight = bold.getAttribute('aria-pressed') === 'true' ? '700' : '400';
      item.fontStyle = italic.getAttribute('aria-pressed') === 'true' ? 'italic' : 'normal';
      this.engine.addItem(item);
      this.studio?.toast?.('Texto añadido.');
    });
  }

  syncTextDrawer(item) {
    const input = document.getElementById('drawer-text-input');
    if (!input || !item || item.type !== 'text') return;
    input.value = item.text || '';
    const font = document.getElementById('drawer-text-font');
    const size = document.getElementById('drawer-text-size');
    const color = document.getElementById('drawer-text-color');
    const align = document.getElementById('drawer-text-align');
    const bold = document.getElementById('drawer-text-bold');
    const italic = document.getElementById('drawer-text-italic');
    if (font) font.value = item.fontFamily || font.value;
    if (size) size.value = item.fontSize || size.value;
    if (color) color.value = item.color || color.value;
    if (align) align.value = item.textAlign || 'center';
    const weight = Number(item.fontWeight);
    bold?.setAttribute('aria-pressed', String(item.fontWeight === 'bold' || weight >= 600));
    italic?.setAttribute('aria-pressed', String(item.fontStyle === 'italic'));
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
      // Keep the tool rail reachable while the sheet is open; switching tools
      // should not require closing the sheet first.
      document.getElementById('editor-view').inert = !!modal && modal !== this.drawer;
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
    this.btnSlides = document.getElementById('btn-download-slides');
    this.btnPanorama = document.getElementById('btn-download-panorama');

    document.getElementById('btn-close-export-sheet')?.addEventListener('click', () => {
      this.closeExportSheet();
    });

    this.exportModal?.addEventListener('click', (e) => {
      if (e.target === this.exportModal) this.closeExportSheet();
    });

    if (this.btnZip) {
      this.btnZip.addEventListener('click', async () => {
        this.btnZip.disabled = true;
        this.btnZip.innerHTML = '<span class="spinner"></span> Preparando descarga…';
        const status = document.getElementById('export-status-label');
        try {
          await this.exporter.downloadAllAsZip(message => { status.textContent = message; });
          this.studio?.toast('Tu historia está lista. Descarga iniciada.');
        } catch (error) {
          status.textContent = 'No se pudo crear el ZIP. Inténtalo otra vez o descarga cada PNG.';
        } finally {
          this.btnZip.disabled = false;
          this.btnZip.textContent = `Descargar las ${pageCountLabel(this.engine.slideCount)} (ZIP)`;
        }
      });
    }

    if (this.btnSlides) {
      this.btnSlides.addEventListener('click', async () => {
        const status = document.getElementById('export-status-label');
        this.btnSlides.disabled = true;
        const total = this.engine.slideCount;
        try {
          status.textContent = 'Preparando las páginas…';
          await this.exporter.downloadAllSlides(message => {
            status.textContent = message;
          });
          status.textContent = `${pageCountLabel(total)} descargadas. Si el navegador pidió permiso para varias descargas, acéptalo.`;
          this.studio?.toast('Páginas descargadas por separado.');
        } catch (error) {
          status.textContent = 'No se pudieron descargar las páginas. Prueba con el ZIP.';
          console.error(error);
        } finally {
          this.btnSlides.disabled = false;
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

    const videoButton = document.getElementById('btn-download-video');
    if (videoButton) {
      videoButton.addEventListener('click', async () => {
        const status = document.getElementById('export-status-label');
        const duration = Number(document.getElementById('export-video-duration')?.value) || 6;
        const fps = Number(document.getElementById('export-video-fps')?.value) || 30;
        const bitrate = Number(document.getElementById('export-video-quality')?.value) || 50000000;
        const codec = document.getElementById('export-video-format')?.value || 'vp9';
        videoButton.disabled = true;
        status.textContent = 'Grabando vídeo…';
        try {
          await this.exporter.downloadVideo({ duration, fps, bitrate, codec }, (message) => {
            status.textContent = message;
          });
          status.textContent = `Vídeo WebM descargado (${duration} s, ${fps} fps).`;
          this.studio?.toast('Vídeo exportado.');
        } catch (error) {
          status.textContent = error.message || 'No se pudo exportar el vídeo.';
        } finally {
          videoButton.disabled = false;
        }
      });
    }
  }

  openExportSheet() {
    const slides = Array.from({ length: this.engine.slideCount }, (_, i) => ({
      index: i + 1, canvas: this.exporter.renderThumbnail(i, 180)
    }));
    document.querySelector('.export-subtitle').textContent = `${pageCountLabel(this.engine.slideCount)}, ${this.engine.slideWidth} × ${this.engine.slideHeight} px`;
    document.getElementById('export-video-options')?.classList.toggle('hidden', !this.engine.hasAnimatedMedia());

    this.stripContainer.innerHTML = '';
    slides.forEach(slide => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'export-mini-card';
      card.setAttribute('aria-label', `Descargar página ${slide.index} como PNG`);

      const thumb = document.createElement('canvas');
      thumb.width = 180;
      thumb.height = slide.canvas.height;
      thumb.setAttribute('aria-hidden', 'true');
      const ctx = thumb.getContext('2d');
      ctx.drawImage(slide.canvas, 0, 0);

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'export-mini-thumb';
      thumbWrap.appendChild(thumb);
      const number = document.createElement('span');
      number.className = 'export-page-number';
      number.textContent = String(slide.index).padStart(2, '0');
      card.append(thumbWrap, number);

      card.addEventListener('click', async () => {
        try { await this.exporter.downloadSlide(slide.index); }
        catch { document.getElementById('export-status-label').textContent = 'No se pudo descargar la página. Inténtalo otra vez.'; }
      });
      this.stripContainer.appendChild(card);
    });

    if (this.btnZip) {
      this.btnZip.textContent = `Descargar las ${pageCountLabel(this.engine.slideCount)} (ZIP)`;
    }
    // Contenido listo antes de mostrarlo: evita el salto de tamaño al abrir.
    this.openAnimated(this.exportModal);
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.__notScrlApp = new NotScrlMobileApp();
});

