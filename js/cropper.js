/**
 * NotSCRL Interactive Mobile Image Cropper
 * Allows non-destructive cropping, custom framing, and instant aspect ratio presets
 * (1:1, 4:5 Instagram, 9:16 Stories, 16:9 Cinema, 3:4 Classic, and Freeform).
 */

export class ImageCropper {
  constructor(engine) {
    this.engine = engine;
    this.targetItem = null;

    this.modal = document.getElementById('crop-modal');
    this.viewport = document.getElementById('crop-viewport');
    this.imgEl = document.getElementById('crop-source-img');
    this.cropBox = document.getElementById('crop-box');

    // Drag interaction state
    this.isDragging = false;
    this.dragMode = null; // 'body', 'nw', 'ne', 'se', 'sw'
    this.startPointer = { x: 0, y: 0 };
    this.initialBox = { x: 0, y: 0, width: 100, height: 100 };

    // Aspect ratio: null for free, or numeric (width / height)
    this.aspectRatio = null;

    // Displayed image geometry relative to viewport
    this.imgRect = { left: 0, top: 0, width: 0, height: 0 };

    this.bindEvents();
  }

  bindEvents() {
    if (!this.modal) return;

    // Close button
    const closeBtn = document.getElementById('btn-close-crop');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    // Backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Reset button
    const resetBtn = document.getElementById('btn-crop-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetCrop());
    }

    // Apply button
    const applyBtn = document.getElementById('btn-crop-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyCrop());
    }

    // Aspect ratio pills
    const aspectBtns = this.modal.querySelectorAll('.crop-aspect-btn');
    aspectBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        aspectBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.setAspectRatio(btn.dataset.ratio);
      });
    });

    // Interaction with the Crop Box (Mouse & Touch)
    this.bindCropBoxInteractions();
  }

  bindCropBoxInteractions() {
    const box = this.cropBox;
    if (!box) return;

    // Pointer start (Mouse & Touch)
    const onStart = (clientX, clientY, target) => {
      const handle = target.dataset?.handle;
      this.dragMode = handle || 'body';
      this.isDragging = true;
      this.startPointer = { x: clientX, y: clientY };

      this.initialBox = {
        left: parseFloat(box.style.left) || 0,
        top: parseFloat(box.style.top) || 0,
        width: parseFloat(box.style.width) || box.offsetWidth,
        height: parseFloat(box.style.height) || box.offsetHeight
      };
    };

    const onMove = (clientX, clientY) => {
      if (!this.isDragging) return;
      const dx = clientX - this.startPointer.x;
      const dy = clientY - this.startPointer.y;

      const imgW = this.imgRect.width;
      const imgH = this.imgRect.height;
      if (imgW <= 0 || imgH <= 0) return;

      const init = this.initialBox;

      if (this.dragMode === 'body') {
        // Move crop box inside image bounds
        let newLeft = Math.max(0, Math.min(imgW - init.width, init.left + dx));
        let newTop = Math.max(0, Math.min(imgH - init.height, init.top + dy));
        box.style.left = `${Math.round(newLeft)}px`;
        box.style.top = `${Math.round(newTop)}px`;
        return;
      }

      // Handle corner resizing
      let newLeft = init.left;
      let newTop = init.top;
      let newW = init.width;
      let newH = init.height;

      const minSize = 40;

      if (this.dragMode === 'se') {
        newW = Math.max(minSize, Math.min(imgW - init.left, init.width + dx));
        newH = this.aspectRatio ? newW / this.aspectRatio : Math.max(minSize, Math.min(imgH - init.top, init.height + dy));
        if (init.top + newH > imgH && this.aspectRatio) {
          newH = imgH - init.top;
          newW = newH * this.aspectRatio;
        }
      } else if (this.dragMode === 'sw') {
        newW = Math.max(minSize, Math.min(init.left + init.width, init.width - dx));
        newH = this.aspectRatio ? newW / this.aspectRatio : Math.max(minSize, Math.min(imgH - init.top, init.height + dy));
        if (init.top + newH > imgH && this.aspectRatio) {
          newH = imgH - init.top;
          newW = newH * this.aspectRatio;
        }
        newLeft = init.left + (init.width - newW);
      } else if (this.dragMode === 'ne') {
        newW = Math.max(minSize, Math.min(imgW - init.left, init.width + dx));
        newH = this.aspectRatio ? newW / this.aspectRatio : Math.max(minSize, Math.min(init.top + init.height, init.height - dy));
        if (init.top + init.height - newH < 0 && this.aspectRatio) {
          newH = init.top + init.height;
          newW = newH * this.aspectRatio;
        }
        newTop = init.top + (init.height - newH);
      } else if (this.dragMode === 'nw') {
        newW = Math.max(minSize, Math.min(init.left + init.width, init.width - dx));
        newH = this.aspectRatio ? newW / this.aspectRatio : Math.max(minSize, Math.min(init.top + init.height, init.height - dy));
        if (init.top + init.height - newH < 0 && this.aspectRatio) {
          newH = init.top + init.height;
          newW = newH * this.aspectRatio;
        }
        newLeft = init.left + (init.width - newW);
        newTop = init.top + (init.height - newH);
      }

      box.style.left = `${Math.round(newLeft)}px`;
      box.style.top = `${Math.round(newTop)}px`;
      box.style.width = `${Math.round(newW)}px`;
      box.style.height = `${Math.round(newH)}px`;
    };

    const onEnd = () => {
      this.isDragging = false;
      this.dragMode = null;
    };

    // Mouse handlers
    box.addEventListener('mousedown', (e) => {
      e.preventDefault();
      onStart(e.clientX, e.clientY, e.target);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) onMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) onEnd();
    });

    // Touch handlers
    box.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        e.preventDefault();
        onStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
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

    this.modal.classList.remove('hidden');

    // Load image into cropper preview
    this.imgEl.src = imageItem.image.src;

    // Reset aspect ratio pill to Libre
    const aspectBtns = this.modal.querySelectorAll('.crop-aspect-btn');
    aspectBtns.forEach((b) => b.classList.toggle('active', b.dataset.ratio === 'free'));
    this.aspectRatio = null;

    this.imgEl.onload = () => {
      this.layoutCropBox();
    };

    // If already loaded / cached
    if (this.imgEl.complete && this.imgEl.naturalWidth > 0) {
      setTimeout(() => this.layoutCropBox(), 30);
    }
  }

  layoutCropBox() {
    // Measure rendered image within the viewport
    const vpRect = this.viewport.parentElement.getBoundingClientRect();
    const natW = this.imgEl.naturalWidth || 800;
    const natH = this.imgEl.naturalHeight || 600;

    // Scale to fit viewport with padding
    const maxW = Math.max(100, vpRect.width - 24);
    const maxH = Math.max(100, vpRect.height - 24);

    const scale = Math.min(maxW / natW, maxH / natH, 1.0);
    const dispW = Math.round(natW * scale);
    const dispH = Math.round(natH * scale);

    this.viewport.style.width = `${dispW}px`;
    this.viewport.style.height = `${dispH}px`;

    this.imgEl.style.width = `${dispW}px`;
    this.imgEl.style.height = `${dispH}px`;

    this.imgRect = {
      width: dispW,
      height: dispH
    };

    // Position crop box based on item's existing crop or full
    const existingCrop = this.targetItem?.crop || { x: 0, y: 0, width: 1, height: 1 };
    const boxLeft = Math.round(existingCrop.x * dispW);
    const boxTop = Math.round(existingCrop.y * dispH);
    const boxW = Math.round(existingCrop.width * dispW);
    const boxH = Math.round(existingCrop.height * dispH);

    this.cropBox.style.left = `${boxLeft}px`;
    this.cropBox.style.top = `${boxTop}px`;
    this.cropBox.style.width = `${boxW}px`;
    this.cropBox.style.height = `${boxH}px`;
  }

  setAspectRatio(ratioKey) {
    const natW = this.imgEl.naturalWidth || 1;
    const natH = this.imgEl.naturalHeight || 1;

    if (ratioKey === 'free') {
      this.aspectRatio = null;
      return;
    } else if (ratioKey === 'original') {
      this.aspectRatio = natW / natH;
    } else if (ratioKey === '1:1') {
      this.aspectRatio = 1.0;
    } else if (ratioKey === '4:5') {
      this.aspectRatio = 4 / 5;
    } else if (ratioKey === '9:16') {
      this.aspectRatio = 9 / 16;
    } else if (ratioKey === '16:9') {
      this.aspectRatio = 16 / 9;
    } else if (ratioKey === '3:4') {
      this.aspectRatio = 3 / 4;
    }

    if (!this.aspectRatio) return;

    // Adjust current crop box to match the ratio centered within image
    const imgW = this.imgRect.width;
    const imgH = this.imgRect.height;
    if (imgW <= 0 || imgH <= 0) return;

    let targetW = imgW * 0.9;
    let targetH = targetW / this.aspectRatio;

    if (targetH > imgH * 0.9) {
      targetH = imgH * 0.9;
      targetW = targetH * this.aspectRatio;
    }

    const newLeft = Math.round((imgW - targetW) / 2);
    const newTop = Math.round((imgH - targetH) / 2);

    this.cropBox.style.left = `${newLeft}px`;
    this.cropBox.style.top = `${newTop}px`;
    this.cropBox.style.width = `${Math.round(targetW)}px`;
    this.cropBox.style.height = `${Math.round(targetH)}px`;
  }

  resetCrop() {
    const imgW = this.imgRect.width;
    const imgH = this.imgRect.height;
    this.cropBox.style.left = '0px';
    this.cropBox.style.top = '0px';
    this.cropBox.style.width = `${imgW}px`;
    this.cropBox.style.height = `${imgH}px`;
    this.aspectRatio = null;

    const aspectBtns = this.modal.querySelectorAll('.crop-aspect-btn');
    aspectBtns.forEach((b) => b.classList.toggle('active', b.dataset.ratio === 'free'));
  }

  applyCrop() {
    if (!this.targetItem) return;

    const imgW = this.imgRect.width;
    const imgH = this.imgRect.height;
    if (imgW <= 0 || imgH <= 0) {
      this.close();
      return;
    }

    const boxLeft = parseFloat(this.cropBox.style.left) || 0;
    const boxTop = parseFloat(this.cropBox.style.top) || 0;
    const boxW = parseFloat(this.cropBox.style.width) || imgW;
    const boxH = parseFloat(this.cropBox.style.height) || imgH;

    // Normalized coordinates (0..1)
    const x = Math.max(0, Math.min(0.95, boxLeft / imgW));
    const y = Math.max(0, Math.min(0.95, boxTop / imgH));
    // Keep the existing source-to-canvas mapping; cropping only hides pixels.
    this.targetItem.cropReference ||= { ...(this.targetItem.crop || { x: 0, y: 0, width: 1, height: 1 }) };
    this.targetItem.crop = {
      x, y,
      width: Math.max(0.05, Math.min(1 - x, boxW / imgW)),
      height: Math.max(0.05, Math.min(1 - y, boxH / imgH))
    };

    this.engine.triggerChange();
    this.engine.saveHistory('Recortar imagen');
    this.close();
  }

  close() {
    this.modal.classList.add('hidden');
    this.targetItem = null;
  }
}
