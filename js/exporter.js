/**
 * High-Resolution Slicing and Export Engine
 * Generates pixel-perfect 1080p Instagram slides without guides or handles.
 * Slices the panoramic ribbon into individual slide PNGs and creates a instant ZIP package.
 */

import { SimpleZip } from './zip.js';

export function pageCountLabel(count) {
  return `${count} ${count === 1 ? 'página' : 'páginas'}`;
}

export class CanvasExporter {
  constructor(engine, storage = null) {
    this.engine = engine;
    this.storage = storage;
  }

  renderThumbnail(index, width = 180) {
    const engine = this.engine;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round(width * engine.slideHeight / engine.slideWidth);
    canvas.setAttribute?.('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    ctx.scale(width / engine.slideWidth, width / engine.slideWidth);
    ctx.translate(-index * engine.slideWidth, 0);
    this.renderContent(ctx, engine.totalWidth, engine.totalHeight);
    return canvas;
  }

  renderContent(ctx, width, height) {
    this.renderBackground(ctx, width, height);
    for (const item of this.engine.items) {
      if (item.visible === false) continue;
      item.render(ctx);
    }
  }

  renderBackground(ctx, width, height) {
    const engine = this.engine;
    if (engine.background.startsWith('linear-gradient')) {
      const colors = engine.background.match(/#(?:[0-9a-fA-F]{3}){1,2}|rgba?\([^)]+\)/g);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, colors?.[0] || '#ffffff');
      gradient.addColorStop(1, colors?.[1] || '#ffffff');
      ctx.fillStyle = gradient;
    } else ctx.fillStyle = engine.background;
    ctx.fillRect(0, 0, width, height);
  }

  async renderOriginals(index = null) {
    const engine = this.engine;
    const canvas = document.createElement('canvas');
    canvas.width = index === null ? engine.totalWidth : engine.slideWidth;
    canvas.height = engine.totalHeight;
    const ctx = canvas.getContext('2d');
    if (index !== null) ctx.translate(-index * engine.slideWidth, 0);
    this.renderBackground(ctx, engine.totalWidth, engine.totalHeight);
    const items = engine.items.map(item => Object.assign(Object.create(Object.getPrototypeOf(item)), item));
    try {
      for (const item of items) {
        if (item.visible === false) continue;
        if (!item.originalKey || item.mediaType === 'video') {
          item.render(ctx);
          continue;
        }
        const file = await this.storage.loadOriginal(item.originalKey);
        const url = URL.createObjectURL(file);
        const image = new Image();
        try {
          image.src = url;
          await image.decode();
          item.image = image;
          item.render(ctx);
        } finally {
          image.src = '';
          URL.revokeObjectURL(url);
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      return canvas;
    } catch (error) {
      canvas.width = canvas.height = 0;
      throw error;
    }
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
    const canvas = await this.renderOriginals(slideNumber - 1);
    let blob;
    try { blob = await this.toBlob(canvas); }
    finally { canvas.width = canvas.height = 0; }
    this.triggerDownload(blob, `notscrl-slide-${String(slideNumber).padStart(2, '0')}.png`);
  }

  /**
   * Downloads the complete un-sliced panoramic banner
   */
  async downloadFullPanorama() {
    const master = await this.renderOriginals();
    let blob;
    try { blob = await this.toBlob(master); }
    finally { master.width = master.height = 0; }
    this.triggerDownload(blob, `notscrl-full-panorama-${this.engine.slideCount}-slides.png`);
  }

  /**
   * Records the full panorama while videos and GIFs play.
   */
  async downloadVideo({ duration = 6, fps = 30, bitrate = 50000000, codec = 'vp9' } = {}, onProgress = null) {
    const engine = this.engine;
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Este navegador no permite grabar vídeo.');
    }
    const seconds = Math.min(30, Math.max(1, Number(duration) || 6));
    const rate = Math.min(60, Math.max(1, Number(fps) || 30));
    const canvas = document.createElement('canvas');
    canvas.width = engine.totalWidth;
    canvas.height = engine.totalHeight;
    if (typeof canvas.captureStream !== 'function') {
      throw new Error('Este navegador no permite capturar el lienzo.');
    }
    const ctx = canvas.getContext('2d');
    this.renderContent(ctx, canvas.width, canvas.height);

    // Restart video items so the recording begins at their first frame.
    for (const item of engine.items) {
      const media = item.image;
      if (item.mediaType === 'video' && media) {
        try { media.currentTime = 0; } catch { /* not seekable */ }
        media.play?.().catch(() => {});
      }
    }

    const stream = canvas.captureStream(rate);
    const mimeType = codec === 'vp8'
      ? 'video/webm;codecs=vp8'
      : (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm;codecs=vp8');
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      recorder.onerror = () => reject(new Error('No se pudo grabar el vídeo.'));
    });

    let frame = 0;
    let lastDraw = 0;
    const interval = 1000 / rate;
    const loop = (now) => {
      if (now - lastDraw >= interval) {
        this.renderContent(ctx, canvas.width, canvas.height);
        lastDraw = now;
      }
      frame = requestAnimationFrame(loop);
    };

    onProgress?.(`Grabando ${seconds} s a ${rate} fps…`);
    recorder.start(250);
    frame = requestAnimationFrame(loop);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    cancelAnimationFrame(frame);
    recorder.stop();
    const blob = await stopped;
    stream.getTracks().forEach((track) => track.stop());
    canvas.width = canvas.height = 0;
    this.triggerDownload(blob, `notscrl-video-${engine.slideCount}-slides.webm`);
    return blob;
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
      const canvas = await this.renderOriginals(i);
      let blob;
      try { blob = await this.toBlob(canvas); }
      finally { canvas.width = canvas.height = 0; }
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

  /**
   * Downloads every slide as its own PNG, no ZIP involved.
   * Browsers throttle multiple downloads from one gesture, so the status
   * message tells the user to allow them if a prompt appears.
   */
  async downloadAllSlides(onProgress = null) {
    const total = this.engine.slideCount;
    for (let i = 0; i < total; i++) {
      const canvas = await this.renderOriginals(i);
      let blob;
      try { blob = await this.toBlob(canvas); }
      finally { canvas.width = canvas.height = 0; }
      this.triggerDownload(blob, `notscrl-slide-${String(i + 1).padStart(2, '0')}.png`);
      if (onProgress) onProgress(`Descargando página ${i + 1} de ${total}…`);
      await new Promise((resolve) => setTimeout(resolve, 250));
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
