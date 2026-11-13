/**
 * Sticker Studio: cut an object out of a photo, fix the mask with a brush,
 * add an outline and keep the result in the sticker library.
 *
 * Zero dependencies: the cut-out is a salient-object pass with u2netp (ONNX,
 * local) and falls back to a border flood-fill, the brush paints on the
 * resulting canvas, and the outline is an 8-way dilation of the silhouette.
 * Everything runs locally in the browser.
 */

import { cutoutWithAI } from "./segmenter.js";

const LIBRARY_KEY = "notscrl_stickers";
const MAX_SIDE = 720;

export class StickerStudio {
  constructor(storage) {
    this.storage = storage;
    this.onSaved = null;

    this.modal = document.getElementById("sticker-modal");
    this.canvas = document.getElementById("sticker-canvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    this.stage = document.getElementById("sticker-stage");
    this.empty = document.getElementById("sticker-empty");
    this.controls = document.getElementById("sticker-controls");
    this.fileInput = document.getElementById("sticker-file");
    this.hint = document.getElementById("sticker-hint");
    this.saveBtn = document.getElementById("btn-sticker-save");

    this.image = null;
    this.base = null; // original pixels, used to restore erased areas
    this.work = null; // current cut-out
    this.tolerance = 24;
    this.brush = 28;
    this.brushMode = "erase";
    this.outline = false;
    this.outlineWidth = 8;
    this.outlineColor = "#ffffff";
    this.painting = false;

    if (!this.modal) return;
    this.bind();
  }

  bind() {
    const on = (id, evt, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(evt, fn);
    };
    on("btn-close-sticker", "click", () => this.close());
    on("btn-sticker-cancel", "click", () => this.close());
    on("btn-sticker-upload", "click", () => this.fileInput.click());
    on("btn-sticker-change", "click", () => this.fileInput.click());
    on("btn-sticker-save", "click", () => this.save());
    on("btn-sticker-auto", "click", () => this.detect());

    this.fileInput?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) this.loadFile(file);
    });

    document
      .querySelectorAll("#sticker-modal [data-brush]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          this.brushMode = btn.dataset.brush;
          document
            .querySelectorAll("#sticker-modal [data-brush]")
            .forEach((b) => b.classList.toggle("active", b === btn));
          this.canvas.style.cursor =
            this.brushMode === "erase" ? "cell" : "copy";
        });
      });

    on("sticker-brush", "input", (event) => {
      this.brush = Number(event.target.value);
    });
    on("sticker-tolerance", "input", (event) => {
      this.tolerance = Number(event.target.value);
    });
    on("sticker-outline", "change", (event) => {
      this.outline = event.target.checked;
      this.render();
    });
    on("sticker-outline-width", "input", (event) => {
      this.outlineWidth = Number(event.target.value);
      if (this.outline) this.render();
    });

    document
      .querySelectorAll("#sticker-swatches button")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          this.outlineColor = btn.dataset.color;
          document
            .querySelectorAll("#sticker-swatches button")
            .forEach((b) => b.classList.toggle("active", b === btn));
          if (this.outline) this.render();
        });
      });

    this.canvas?.addEventListener("pointerdown", (event) => {
      if (!this.work) return;
      this.painting = true;
      this.canvas.setPointerCapture(event.pointerId);
      this.paint(event);
    });
    this.canvas?.addEventListener("pointermove", (event) => {
      if (this.painting) this.paint(event);
    });
    const stop = (event) => {
      if (!this.painting) return;
      this.painting = false;
      try {
        this.canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* capture already released */
      }
    };
    this.canvas?.addEventListener("pointerup", stop);
    this.canvas?.addEventListener("pointercancel", stop);

    this.modal.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.close();
    });
  }

  open() {
    this.modal.classList.remove("hidden");
    this.modal.setAttribute("aria-hidden", "false");
    if (!this.image) {
      this.empty.classList.remove("hidden");
      this.controls.classList.add("hidden");
      this.saveBtn.disabled = true;
    }
    this.modal.querySelector("button")?.focus({ preventScroll: true });
  }

  close() {
    this.modal.classList.add("hidden");
    this.modal.setAttribute("aria-hidden", "true");
  }

  async loadFile(file) {
    try {
      const img = await loadStickerImage(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      this.base = document.createElement("canvas");
      this.base.width = w;
      this.base.height = h;
      this.base.getContext("2d").drawImage(img, 0, 0, w, h);
      this.image = img;
      this.empty.classList.add("hidden");
      this.controls.classList.remove("hidden");
      this.saveBtn.disabled = false;
      await this.cut();
    } catch (error) {
      this.showHint("No se pudo abrir esa imagen.");
      console.error(error);
    }
  }

  // Salient-object pass first; the border flood fill stays as the fallback
  // (and as the "Detectar" button when the model misses).
  async cut() {
    if (!this.base) return;
    this.setBusy(true);
    this.showHint("Recortando el sujeto…");
    let result = null;
    try {
      result = await cutoutWithAI(this.base);
    } catch {
      this.showHint("IA no disponible aquí. Usando recorte por bordes.");
    }
    if (result) {
      this.work = result;
      this.showHint("");
      this.render();
    } else {
      this.detect();
    }
    this.setBusy(false);
  }

  setBusy(busy) {
    this.modal.classList.toggle("busy", busy);
    this.saveBtn.disabled = busy || !this.work;
    const auto = document.getElementById("btn-sticker-auto");
    if (auto) auto.disabled = busy;
  }

  // Border flood fill: whatever is connected to the edges and close to the
  // average border colour becomes transparent.
  detect() {
    if (!this.base) return;
    const w = this.base.width;
    const h = this.base.height;
    const src = this.base
      .getContext("2d")
      .getImageData(0, 0, w, h);
    const px = src.data;
    const bg = borderColor(px, w, h);
    const limit = Math.pow(this.tolerance * 2.2, 2) * 3;
    const seen = new Uint8Array(w * h);
    const stack = [];
    const push = (x, y) => {
      const i = y * w + x;
      if (!seen[i]) {
        seen[i] = 1;
        stack.push(i);
      }
    };
    for (let x = 0; x < w; x++) {
      push(x, 0);
      push(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      push(0, y);
      push(w - 1, y);
    }
    let cleared = 0;
    while (stack.length) {
      const i = stack.pop();
      const p = i * 4;
      if (px[p + 3] === 0) continue;
      const dr = px[p] - bg[0];
      const dg = px[p + 1] - bg[1];
      const db = px[p + 2] - bg[2];
      if (dr * dr + dg * dg + db * db > limit) continue;
      px[p + 3] = 0;
      cleared++;
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    out.getContext("2d").putImageData(src, 0, 0);
    this.work = out;

    const ratio = cleared / (w * h);
    if (ratio > 0.985) {
      this.showHint("Se comiÃ³ casi todo. Baja la tolerancia o pinta para recuperar.");
    } else if (ratio < 0.02) {
      this.showHint("No encontrÃ³ fondo. Sube la tolerancia o borra a mano.");
    } else {
      this.showHint("");
    }
    this.render();
  }

  render() {
    if (!this.work) return;
    const w = this.work.width;
    const h = this.work.height;
    const pad = this.outline ? Math.ceil(this.outlineWidth) + 2 : 0;
    this.canvas.width = w + pad * 2;
    this.canvas.height = h + pad * 2;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.outline && pad) {
      const silhouette = document.createElement("canvas");
      silhouette.width = w;
      silhouette.height = h;
      const sctx = silhouette.getContext("2d");
      sctx.drawImage(this.work, 0, 0);
      sctx.globalCompositeOperation = "source-in";
      sctx.fillStyle = this.outlineColor;
      sctx.fillRect(0, 0, w, h);
      const r = this.outlineWidth;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        ctx.drawImage(
          silhouette,
          pad + Math.cos(a) * r,
          pad + Math.sin(a) * r,
        );
      }
    }
    ctx.drawImage(this.work, pad, pad);
  }

  paint(event) {
    const rect = this.canvas.getBoundingClientRect();
    const pad = this.outline ? Math.ceil(this.outlineWidth) + 2 : 0;
    const x = ((event.clientX - rect.left) / rect.width) * this.canvas.width - pad;
    const y = ((event.clientY - rect.top) / rect.height) * this.canvas.height - pad;
    const r = this.brush / 2;
    const wctx = this.work.getContext("2d");
    wctx.save();
    wctx.beginPath();
    wctx.arc(x, y, r, 0, Math.PI * 2);
    if (this.brushMode === "erase") {
      wctx.globalCompositeOperation = "destination-out";
      wctx.fill();
    } else {
      wctx.clip();
      wctx.drawImage(this.base, 0, 0);
    }
    wctx.restore();
    this.render();
  }

  showHint(text) {
    if (!this.hint) return;
    this.hint.textContent = text;
    this.hint.classList.toggle("hidden", !text);
  }

  async save() {
    if (!this.work) return;
    try {
      const out = this.buildExport();
      const blob = await new Promise((resolve) =>
        out.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("no blob");
      const key = await this.storage.saveOriginal(blob);
      const list = readLibrary();
      const entry = {
        key,
        w: out.width,
        h: out.height,
        title: `Sticker ${list.length + 1}`,
        ts: Date.now(),
      };
      list.unshift(entry);
      writeLibrary(list);
      this.onSaved?.(entry);
      this.close();
    } catch (error) {
      this.showHint("No se pudo guardar. Revisa el espacio del navegador.");
      console.error(error);
    }
  }

  // Trimmed export with the outline baked in, so the sticker is reusable.
  buildExport() {
    const pad = this.outline ? Math.ceil(this.outlineWidth) + 2 : 0;
    const full = document.createElement("canvas");
    full.width = this.work.width + pad * 2;
    full.height = this.work.height + pad * 2;
    const ctx = full.getContext("2d");
    if (this.outline && pad) {
      const silhouette = document.createElement("canvas");
      silhouette.width = this.work.width;
      silhouette.height = this.work.height;
      const sctx = silhouette.getContext("2d");
      sctx.drawImage(this.work, 0, 0);
      sctx.globalCompositeOperation = "source-in";
      sctx.fillStyle = this.outlineColor;
      sctx.fillRect(0, 0, silhouette.width, silhouette.height);
      const r = this.outlineWidth;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        ctx.drawImage(
          silhouette,
          pad + Math.cos(a) * r,
          pad + Math.sin(a) * r,
        );
      }
    }
    ctx.drawImage(this.work, pad, pad);

    const box = alphaBounds(full);
    if (!box) return full;
    const trimmed = document.createElement("canvas");
    trimmed.width = box.width;
    trimmed.height = box.height;
    trimmed
      .getContext("2d")
      .drawImage(full, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
    return trimmed;
  }
}

function loadStickerImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = url;
  });
}

// Average of the pixels hugging the border; the usual backdrop colour.
function borderColor(px, w, h) {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const sample = (x, y) => {
    const p = (y * w + x) * 4;
    if (px[p + 3] < 8) return;
    r += px[p];
    g += px[p + 1];
    b += px[p + 2];
    n++;
  };
  for (let x = 0; x < w; x += 3) {
    sample(x, 0);
    sample(x, h - 1);
  }
  for (let y = 0; y < h; y += 3) {
    sample(0, y);
    sample(w - 1, y);
  }
  return n ? [r / n, g / n, b / n] : [255, 255, 255];
}

function alphaBounds(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function readLibrary() {
  try {
    const raw = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLibrary(list) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* quota: the sticker stays in IndexedDB but not in the index */
  }
}

