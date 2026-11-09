/**
 * High-Resolution Slicing and Export Engine
 * Generates pixel-perfect 1080p Instagram slides without guides or handles.
 * Slices the panoramic ribbon into individual slide PNGs and creates a instant ZIP package.
 */

import { SimpleZip } from './zip.js';

export class CanvasExporter {
  constructor(engine) {
    this.engine = engine;
  }

  renderThumbnail(index, width = 180) {
    const engine = this.engine;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round(width * engine.slideHeight / engine.slideWidth);
    const ctx = canvas.getContext('2d');
    ctx.scale(width / engine.slideWidth, width / engine.slideWidth);
    ctx.translate(-index * engine.slideWidth, 0);
    this.renderContent(ctx, engine.totalWidth, engine.totalHeight);
    return canvas;
  }

  renderContent(ctx, width, height) {
    const engine = this.engine;
    if (engine.background.startsWith('linear-gradient')) {
      const colors = engine.background.match(/#(?:[0-9a-fA-F]{3}){1,2}|rgba?\([^)]+\)/g);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, colors?.[0] || '#ffffff');
      gradient.addColorStop(1, colors?.[1] || '#ffffff');
      ctx.fillStyle = gradient;
    } else ctx.fillStyle = engine.background;
    ctx.fillRect(0, 0, width, height);
    for (const item of engine.items) item.render(ctx);
  }

  renderSlide(index) {
    return this.renderThumbnail(index, this.engine.slideWidth);
  }

  toBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen'));
    }, 'image/png'));
  }

  /**
   * Renders the complete panoramic canvas offscreen at full 1:1 native resolution
   * @returns {HTMLCanvasElement}
   */
  renderFullMasterCanvas() {
    const engine = this.engine;
    const master = document.createElement('canvas');
    master.width = engine.totalWidth;
    master.height = engine.totalHeight;
    const ctx = master.getContext('2d');

    this.renderContent(ctx, master.width, master.height);
    return master;
  }

  /**
   * Downloads a single slide as PNG
   */
  async downloadSlide(slideNumber) {
    if (slideNumber < 1 || slideNumber > this.engine.slideCount) return;
    const canvas = this.renderSlide(slideNumber - 1);
    const blob = await this.toBlob(canvas);
    canvas.width = canvas.height = 0;
    this.triggerDownload(blob, `notscrl-slide-${String(slideNumber).padStart(2, '0')}.png`);
  }

  /**
   * Downloads the complete un-sliced panoramic banner
   */
  async downloadFullPanorama() {
    const master = this.renderFullMasterCanvas();
    const blob = await this.toBlob(master);
    master.width = master.height = 0;
    this.triggerDownload(blob, `notscrl-full-panorama-${this.engine.slideCount}-slides.png`);
  }

  /**
   * Slices all slides and packs them into a single ZIP file for 1-click download
   */
  async downloadAllAsZip(onProgress = null) {
    const zip = new SimpleZip();

    for (let i = 0; i < this.engine.slideCount; i++) {
      if (onProgress) {
        onProgress(`Preparando página ${i + 1} de ${this.engine.slideCount}…`, (i + 1) / (this.engine.slideCount + 1));
      }
      const canvas = this.renderSlide(i);
      const blob = await this.toBlob(canvas);
      canvas.width = canvas.height = 0;
      const filename = `slide_${String(i + 1).padStart(2, '0')}.png`;
      await zip.addFile(filename, blob);
    }

    if (onProgress) {
      onProgress('Preparando tu descarga…', 0.95);
    }

    const zipBlob = zip.generate();
    this.triggerDownload(zipBlob, `notscrl-instagram-carousel.zip`);

    if (onProgress) {
      onProgress('Tu carrusel está listo. Descarga iniciada.', 1.0);
    }
  }

  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }
}
