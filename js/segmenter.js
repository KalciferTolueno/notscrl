/**
 * Sticker cut-out.
 *
 * Preferred path: ISNet (general use, 1024 px) on onnxruntime-web with the
 * WebGPU backend. Fallback: silueta (pruned U²-Net, 320 px) on wasm, which
 * needs no GPU. Both models and runtimes live in js/vendor, so nothing leaves
 * the device; if they can't be fetched (file://) the caller keeps its border
 * flood fill.
 *
 * After the model runs, the mask is cleaned so one sticker is one subject:
 * largest connected blob, holes filled, thin clutter opened away, and backdrop
 * that still touches the subject peeled off by colour.
 */

const ORT_WEBGPU = "js/vendor/ort-webgpu/";
const ORT_WASM = "js/vendor/ort-wasm/";
const ISNET = "js/vendor/models/isnet.onnx";
const SILUETA = "js/vendor/models/silueta.onnx";
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let runtimePromise = null;
let modelPromise = null;

function loadRuntime(kind) {
  if (window.ort) return Promise.resolve(window.ort);
  if (runtimePromise) return runtimePromise;
  const dir = kind === "webgpu" ? ORT_WEBGPU : ORT_WASM;
  const file = kind === "webgpu" ? "ort.webgpu.min.js" : "ort.wasm.min.js";
  runtimePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = dir + file;
    script.onload = () => {
      const ort = window.ort;
      if (!ort) {
        reject(new Error("ort_missing"));
        return;
      }
      ort.env.wasm.wasmPaths = new URL(dir, document.baseURI).href;
      // Single thread: SharedArrayBuffer needs cross-origin isolation we don't have.
      ort.env.wasm.numThreads = 1;
      resolve(ort);
    };
    script.onerror = () => reject(new Error("ort_unavailable"));
    document.head.appendChild(script);
  }).catch((error) => {
    runtimePromise = null;
    throw error;
  });
  return runtimePromise;
}

async function getModel() {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    if (navigator.gpu) {
      try {
        const ort = await loadRuntime("webgpu");
        const session = await ort.InferenceSession.create(
          new URL(ISNET, document.baseURI).href,
          { executionProviders: ["webgpu"] },
        );
        return { ort, session, size: 1024, unit: true };
      } catch (error) {
        console.warn("WebGPU no disponible, usando wasm:", error);
        delete window.ort;
        runtimePromise = null;
      }
    }
    const ort = await loadRuntime("wasm");
    const session = await ort.InferenceSession.create(
      new URL(SILUETA, document.baseURI).href,
      { executionProviders: ["wasm"] },
    );
    return { ort, session, size: 320, unit: false };
  })().catch((error) => {
    modelPromise = null;
    throw error;
  });
  return modelPromise;
}

// Returns a cut-out canvas, or null when the model finds no clear subject.
export async function cutoutWithAI(source) {
  // Illustrations and memes often arrive already cut (transparent PNG). Then
  // the source alpha *is* the answer: don't let a photo-trained model guess.
  const existing = existingCutout(source);
  if (existing) return existing;

  const { ort, session, size, unit } = await getModel();
  const input = new ort.Tensor("float32", toInput(source, size, unit), [
    1,
    3,
    size,
    size,
  ]);
  const feeds = {};
  feeds[session.inputNames[0]] = input;
  const results = await session.run(feeds);
  const output = results[session.outputNames[0]];
  return applyMask(source, output.data, output.dims, unit);
}

// A source that already has a real cut-out (transparent PNG) needs no model.
function existingCutout(source) {
  const w = source.width;
  const h = source.height;
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.canvas.width = w;
  ctx.canvas.height = h;
  ctx.drawImage(source, 0, 0);
  const px = ctx.getImageData(0, 0, w, h).data;
  let clear = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 16) clear++;
  if (clear / (w * h) < 0.08) return null;
  const copy = document.createElement("canvas");
  copy.width = w;
  copy.height = h;
  copy.getContext("2d").drawImage(source, 0, 0);
  return copy;
}

function toInput(source, size, unit) {
  const small = document.createElement("canvas");
  small.width = size;
  small.height = size;
  const ctx = small.getContext("2d");
  ctx.drawImage(source, 0, 0, size, size);
  const px = ctx.getImageData(0, 0, size, size).data;
  const n = size * size;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (unit) {
      // ISNet's export expects plain 0..1 RGB.
      data[i] = px[p] / 255;
      data[n + i] = px[p + 1] / 255;
      data[n * 2 + i] = px[p + 2] / 255;
    } else {
      data[i] = (px[p] / 255 - MEAN[0]) / STD[0];
      data[n + i] = (px[p + 1] / 255 - MEAN[1]) / STD[1];
      data[n * 2 + i] = (px[p + 2] / 255 - MEAN[2]) / STD[2];
    }
  }
  return data;
}

function applyMask(source, values, dims, unit) {
  const mw = dims[dims.length - 1];
  const mh = dims[dims.length - 2];
  if (mw * mh !== values.length) return null;

  const alpha = new Float32Array(values.length);
  if (unit) {
    // The sigmoid output is already 0..1: sharpen the transition band instead
    // of stretching it, so the edge stays tight but antialiased.
    for (let i = 0; i < alpha.length; i++) {
      let a = (values[i] - 0.35) / 0.3;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      alpha[i] = a < 0.06 ? 0 : a;
    }
  } else {
    // Stretch to the 2–98 percentile band so soft edges survive but fog goes.
    const sorted = Float32Array.from(values).sort();
    const lo = sorted[Math.floor(sorted.length * 0.02)];
    const hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))];
    const span = hi - lo || 1;
    for (let i = 0; i < alpha.length; i++) {
      let a = (values[i] - lo) / span;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      alpha[i] = a < 0.06 ? 0 : a;
    }
  }

  // Decisions (islands, holes, peeling, opening) run on a 512 grid: the same
  // judgement at a quarter of the cost. The final alpha keeps the model's full
  // resolution through the upscaled gate.
  const gw = Math.min(512, mw);
  const gh = Math.max(1, Math.round((mh * gw) / mw));
  const coarse = resampleField(alpha, mw, mh, gw, gh);

  let gate = keepMainSubject(coarse, gw, gh);
  if (!gate) return null;
  gate = trimBackdrop(gate, source, gw, gh);
  gate = keepMainSubject(gate, gw, gh) || gate;

  const soft = resampleField(gate, gw, gh, mw, mh);
  const masked = new Float32Array(alpha.length);
  let covered = 0;
  for (let i = 0; i < alpha.length; i++) {
    masked[i] = alpha[i] * soft[i];
    if (masked[i] > 0.5) covered++;
  }
  const ratio = covered / masked.length;
  if (ratio < 0.02 || ratio > 0.98) return null;

  const mask = new ImageData(mw, mh);
  const out = mask.data;
  for (let i = 0; i < masked.length; i++) {
    const p = i * 4;
    out[p] = 255;
    out[p + 1] = 255;
    out[p + 2] = 255;
    out[p + 3] = Math.round(masked[i] * 255);
  }

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = mw;
  maskCanvas.height = mh;
  maskCanvas.getContext("2d").putImageData(mask, 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}

// Largest connected blob (4-way), holes filled, used as a soft gate over the
// model's alpha so fur and whiskers keep their detail inside the subject while
// disconnected leftovers disappear.
function keepMainSubject(alpha, w, h) {
  const bin = new Uint8Array(w * h);
  for (let i = 0; i < bin.length; i++) bin[i] = alpha[i] > 0.5 ? 1 : 0;

  const label = new Int32Array(w * h).fill(-1);
  const sizes = [];
  const stack = [];
  let next = 0;
  for (let start = 0; start < bin.length; start++) {
    if (!bin[start] || label[start] >= 0) continue;
    const id = next++;
    let count = 0;
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      count++;
      const x = i % w;
      const y = (i - x) / w;
      const visit = (nx, ny) => {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
        const j = ny * w + nx;
        if (bin[j] && label[j] < 0) {
          label[j] = id;
          stack.push(j);
        }
      };
      visit(x - 1, y);
      visit(x + 1, y);
      visit(x, y - 1);
      visit(x, y + 1);
    }
    sizes.push(count);
  }
  if (!sizes.length) return null;
  let best = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[best]) best = i;

  const keep = new Uint8Array(w * h);
  for (let i = 0; i < keep.length; i++) keep[i] = label[i] === best ? 1 : 0;

  // Dropping whisker-thin clutter (grass, stems, cables) the model attached to
  // the subject; the body keeps its shape because erode+dilate cancels out.
  const r = Math.max(2, Math.round((Math.max(w, h) / 512) * 3));
  openMask(keep, w, h, r);
  // Closing seals pinholes and thin breaks before the background flood runs,
  // so enclosed areas (a white shirt against a white backdrop) stay filled.
  closeMask(keep, w, h, r);

  // Flood the background from the border: whatever it can't reach is a hole.
  const outside = new Uint8Array(w * h);
  const queue = [];
  const seed = (x, y) => {
    const j = y * w + x;
    if (!keep[j] && !outside[j]) {
      outside[j] = 1;
      queue.push(j);
    }
  };
  for (let x = 0; x < w; x++) {
    seed(x, 0);
    seed(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    seed(0, y);
    seed(w - 1, y);
  }
  while (queue.length) {
    const i = queue.pop();
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }

  // Soft, slightly dilated gate: keeps edge detail just outside the 0.5 cut.
  const gate = new Float32Array(w * h);
  for (let i = 0; i < gate.length; i++) gate[i] = outside[i] ? 0 : 1;
  const soft = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!gate[i]) continue;
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          sum += gate[ny * w + nx];
          n++;
        }
      }
      soft[i] = Math.min(1, (sum / n) * 1.15);
    }
  }
  const dilated = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const v = soft[ny * w + nx];
          if (v > m) m = v;
        }
      }
      dilated[y * w + x] = m;
    }
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = dilated[i];
  return out;
}

// Bilinear resample of a 0..1 field through a canvas (GPU-friendly smoothing).
function resampleField(field, w, h, tw, th) {
  const src = document.createElement("canvas");
  src.width = w;
  src.height = h;
  const data = src.getContext("2d").createImageData(w, h);
  for (let i = 0; i < field.length; i++) {
    const p = i * 4;
    data.data[p] = 255;
    data.data[p + 1] = 255;
    data.data[p + 2] = 255;
    data.data[p + 3] = Math.round(Math.max(0, Math.min(1, field[i])) * 255);
  }
  src.getContext("2d").putImageData(data, 0, 0);

  const dst = document.createElement("canvas");
  dst.width = tw;
  dst.height = th;
  const ctx = dst.getContext("2d");
  ctx.drawImage(src, 0, 0, tw, th);
  const px = ctx.getImageData(0, 0, tw, th).data;
  const out = new Float32Array(tw * th);
  for (let i = 0; i < out.length; i++) out[i] = px[i * 4 + 3] / 255;
  return out;
}

// In-place morphological closing on a binary mask (dilate, then erode).
function closeMask(mask, w, h, r) {
  const grow = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let any = 0;
      for (let dy = -r; dy <= r && !any; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < w && mask[ny * w + nx]) {
            any = 1;
            break;
          }
        }
      }
      grow[y * w + x] = any;
    }
  }
  const shrink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let solid = 1;
      for (let dy = -r; dy <= r && solid; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) {
          solid = 0;
          break;
        }
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w || !grow[ny * w + nx]) {
            solid = 0;
            break;
          }
        }
      }
      shrink[y * w + x] = solid;
    }
  }
  for (let i = 0; i < mask.length; i++) mask[i] = shrink[i];
}

// In-place morphological opening on a binary mask.
function openMask(mask, w, h, r) {
  const erode = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let solid = 1;
      for (let dy = -r; dy <= r && solid; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) {
          solid = 0;
          break;
        }
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w || !mask[ny * w + nx]) {
            solid = 0;
            break;
          }
        }
      }
      erode[y * w + x] = solid;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let any = 0;
      for (let dy = -r; dy <= r && !any; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < w && erode[ny * w + nx]) {
            any = 1;
            break;
          }
        }
      }
      mask[y * w + x] = any;
    }
  }
}

// Peel backdrop that is still attached to the subject (grass, branches, chair
// arms): flood inwards from the frame edge comparing each pixel with its
// neighbour and with a palette of border colours, then peel matching pixels
// that sit on the outline. The eroded core of the blob is never touched.
function trimBackdrop(alpha, source, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(source, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  const palette = [];
  const step = Math.max(4, Math.round(Math.max(w, h) / 64));
  const addColor = (x, y) => {
    const p = (y * w + x) * 4;
    palette.push(px[p], px[p + 1], px[p + 2]);
  };
  for (let x = 0; x < w; x += step) {
    addColor(x, 0);
    addColor(x, h - 1);
  }
  for (let y = 0; y < h; y += step) {
    addColor(0, y);
    addColor(w - 1, y);
  }

  // Core = pixels still opaque after a small erosion; those never get trimmed.
  const core = new Uint8Array(w * h);
  const R = Math.max(3, Math.round(Math.max(w, h) / 300));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] <= 0.5) continue;
      let solid = true;
      for (let dy = -R; dy <= R && solid; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) {
          solid = false;
          break;
        }
        for (let dx = -R; dx <= R; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w || alpha[ny * w + nx] <= 0.5) {
            solid = false;
            break;
          }
        }
      }
      if (solid) core[y * w + x] = 1;
    }
  }

  const limit = 44 * 44 * 3;
  const localLimit = 26 * 26 * 3;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (i, r, g, b) => {
    if (seen[i]) return;
    seen[i] = 1;
    stack.push(i, r, g, b);
  };
  const seedAt = (x, y) => {
    const i = y * w + x;
    const p = i * 4;
    push(i, px[p], px[p + 1], px[p + 2]);
  };
  for (let x = 0; x < w; x += 2) {
    seedAt(x, 0);
    seedAt(x, h - 1);
  }
  for (let y = 0; y < h; y += 2) {
    seedAt(0, y);
    seedAt(w - 1, y);
  }
  while (stack.length) {
    const b = stack.pop();
    const g = stack.pop();
    const r = stack.pop();
    const i = stack.pop();
    if (core[i]) continue;
    const p = i * 4;
    const cr = px[p];
    const cg = px[p + 1];
    const cb = px[p + 2];
    const dr = cr - r;
    const dg = cg - g;
    const db = cb - b;
    let backdrop = dr * dr + dg * dg + db * db <= localLimit;
    if (!backdrop) {
      for (let k = 0; k < palette.length; k += 3) {
        const pr = cr - palette[k];
        const pg = cg - palette[k + 1];
        const pb = cb - palette[k + 2];
        if (pr * pr + pg * pg + pb * pb <= limit) {
          backdrop = true;
          break;
        }
      }
    }
    if (!backdrop) continue;
    alpha[i] = 0;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) push(i - 1, cr, cg, cb);
    if (x < w - 1) push(i + 1, cr, cg, cb);
    if (y > 0) push(i - w, cr, cg, cb);
    if (y < h - 1) push(i + w, cr, cg, cb);
  }

  // Stems and leaves inside the silhouette have no colour path to the border,
  // so peel the ones that still match the backdrop from the outline inwards.
  for (let round = 0; round < 6; round++) {
    const doomed = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (alpha[i] <= 0.05) continue;
        let nearEdge = false;
        for (let dy = -1; dy <= 1 && !nearEdge; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (alpha[(y + dy) * w + (x + dx)] <= 0.05) {
              nearEdge = true;
              break;
            }
          }
        }
        if (!nearEdge) continue;
        const p = i * 4;
        for (let k = 0; k < palette.length; k += 3) {
          const dr = px[p] - palette[k];
          const dg = px[p + 1] - palette[k + 1];
          const db = px[p + 2] - palette[k + 2];
          if (dr * dr + dg * dg + db * db <= limit) {
            doomed.push(i);
            break;
          }
        }
      }
    }
    if (!doomed.length) break;
    for (const i of doomed) alpha[i] = 0;
  }
  return alpha;
}
