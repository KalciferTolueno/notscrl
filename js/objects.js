/**
 * Canvas Object Layer System
 * Supports Images with Custom Shape Clipping (Circle, Star, Heart, Arch, Flower),
 * Frames (Polaroid, Film 35mm), Typography, and Stickers.
 */

let nextId = 1;

export class CanvasItem {
  constructor(type, x, y, width, height) {
    this.id = 'item_' + (nextId++);
    this.type = type; // 'image', 'text', 'sticker'
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rotation = 0; // degrees
    this.opacity = 1.0;
    this.zIndex = 0;
    this.isLocked = false;
    this.shadow = {
      enabled: false,
      color: 'rgba(0, 0, 0, 0.35)',
      blur: 24,
      offsetX: 0,
      offsetY: 10
    };
  }

  get centerX() {
    return this.x + this.width / 2;
  }
  get centerY() {
    return this.y + this.height / 2;
  }

  globalToLocal(gx, gy) {
    const cx = this.centerX;
    const cy = this.centerY;
    const rad = (-this.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const dx = gx - cx;
    const dy = gy - cy;

    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    return {
      x: lx + this.width / 2,
      y: ly + this.height / 2
    };
  }

  localToGlobal(lx, ly) {
    const cx = this.centerX;
    const cy = this.centerY;
    const rad = (this.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const dx = lx - this.width / 2;
    const dy = ly - this.height / 2;

    const gx = dx * cos - dy * sin + cx;
    const gy = dx * sin + dy * cos + cy;

    return { x: gx, y: gy };
  }

  containsPoint(gx, gy) {
    const local = this.globalToLocal(gx, gy);
    return local.x >= 0 && local.x <= this.width && local.y >= 0 && local.y <= this.height;
  }

  getHandles(zoom = 1) {
    const w = this.width;
    const h = this.height;
    const rotDistance = 38 / zoom;

    const localHandles = {
      nw: { x: 0, y: 0 },
      ne: { x: w, y: 0 },
      se: { x: w, y: h },
      sw: { x: 0, y: h },
      rot: { x: w / 2, y: -rotDistance }
    };

    const globalHandles = {};
    for (const [key, pt] of Object.entries(localHandles)) {
      globalHandles[key] = this.localToGlobal(pt.x, pt.y);
    }
    return globalHandles;
  }

  render(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;

    const cx = this.centerX;
    const cy = this.centerY;
    ctx.translate(cx, cy);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.translate(-this.width / 2, -this.height / 2);

    if (this.shadow.enabled) {
      ctx.shadowColor = this.shadow.color;
      ctx.shadowBlur = this.shadow.blur;
      ctx.shadowOffsetX = this.shadow.offsetX;
      ctx.shadowOffsetY = this.shadow.offsetY;
    }

    this.draw(ctx);

    ctx.restore();
  }

  draw(ctx) {}
}

export class ImageItem extends CanvasItem {
  constructor(image, x, y, width, height) {
    super('image', x, y, width, height);
    this.image = image;
    this.naturalWidth = image.naturalWidth || width;
    this.naturalHeight = image.naturalHeight || height;
    this.aspectRatio = this.naturalWidth / this.naturalHeight;

    // Styling, Clipping & Frames
    this.clipShape = 'rect'; // 'rect', 'circle', 'star', 'heart', 'arch', 'flower'
    this.frameStyle = 'none'; // 'none', 'polaroid', 'film'
    this.borderRadius = 0;
    this.borderWidth = 0;
    this.borderColor = '#ffffff';
    this.caption = '';

    // Non-destructive Internal Cropping ({ x, y, width, height } normalized 0..1)
    this.crop = { x: 0, y: 0, width: 1, height: 1 };

    // Manual Pan & Zoom Framing Offset inside shapes/frames ({ x: -1..1, y: -1..1, zoom: 1..3 })
    this.fitOffset = { x: 0, y: 0, zoom: 1.0 };
  }

  /**
   * Draws the image into destination rectangle (dx, dy, dw, dh) preserving aspect ratio (object-fit: cover).
   * ZERO distortion, zero squishing, with optional manual pan and zoom framing.
   */
  drawImageCover(ctx, dx, dy, dw, dh) {
    if (!this.image || !this.image.complete || !this.image.naturalWidth) return;

    const natW = this.image.naturalWidth || this.naturalWidth || dw;
    const natH = this.image.naturalHeight || this.naturalHeight || dh;
    const crop = this.crop || { x: 0, y: 0, width: 1, height: 1 };
    const fit = this.fitOffset || { x: 0, y: 0, zoom: 1.0 };

    // Base cropped source region in natural image coordinates
    const sxBase = Math.max(0, Math.min(natW, crop.x * natW));
    const syBase = Math.max(0, Math.min(natH, crop.y * natH));
    const swBase = Math.max(1, Math.min(natW - sxBase, crop.width * natW));
    const shBase = Math.max(1, Math.min(natH - syBase, crop.height * natH));

    const srcAspect = swBase / shBase;
    const destAspect = dw / dh;

    let swUsed = swBase;
    let shUsed = shBase;

    // Cover math: match aspect ratio precisely so scaleX === scaleY (no distortion)
    if (destAspect > srcAspect) {
      // Destination is wider: use full width of crop, reduce height
      shUsed = swBase / destAspect;
    } else {
      // Destination is taller: use full height of crop, reduce width
      swUsed = shBase * destAspect;
    }

    // Apply manual framing zoom (>= 1.0)
    const zoom = Math.max(1.0, Math.min(4.0, fit.zoom || 1.0));
    swUsed = Math.max(10, swUsed / zoom);
    shUsed = Math.max(10, shUsed / zoom);

    // Margins available for user panning
    const maxShiftX = (swBase - swUsed) / 2;
    const maxShiftY = (shBase - shUsed) / 2;

    const shiftX = Math.max(-maxShiftX, Math.min(maxShiftX, (fit.x || 0) * maxShiftX));
    const shiftY = Math.max(-maxShiftY, Math.min(maxShiftY, (fit.y || 0) * maxShiftY));

    const centerX = sxBase + swBase / 2 + shiftX;
    const centerY = syBase + shBase / 2 + shiftY;

    const sx = Math.max(0, Math.min(natW - swUsed, centerX - swUsed / 2));
    const sy = Math.max(0, Math.min(natH - shUsed, centerY - shUsed / 2));

    ctx.drawImage(this.image, sx, sy, swUsed, shUsed, dx, dy, dw, dh);
  }

  draw(ctx) {
    const w = this.width;
    const h = this.height;

    // 1. Polaroid Frame Mode
    if (this.frameStyle === 'polaroid') {
      const padSide = Math.max(12, w * 0.06);
      const padTop = Math.max(12, h * 0.06);
      const padBottom = Math.max(36, h * 0.22);

      ctx.fillStyle = '#faf8f5';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#e7e2d7';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, w, h);

      const imgW = w - padSide * 2;
      const imgH = h - padTop - padBottom;

      if (imgW > 0 && imgH > 0 && this.image.complete) {
        this.drawImageCover(ctx, padSide, padTop, imgW, imgH);
      }

      if (this.caption) {
        ctx.fillStyle = '#262626';
        ctx.font = `italic ${Math.max(16, h * 0.06)}px 'Caveat', cursive, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.caption, w / 2, h - padBottom / 2);
      }
      return;
    }

    // 2. 35mm Analog Film Frame Mode
    if (this.frameStyle === 'film') {
      const borderH = Math.max(18, h * 0.12);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#262626';
      const holeW = Math.max(8, w * 0.04);
      const holeH = Math.max(10, borderH * 0.55);
      const holeSpacing = Math.max(16, w * 0.08);

      for (let x = holeSpacing / 2; x < w - holeW; x += holeSpacing) {
        ctx.fillRect(x, (borderH - holeH) / 2, holeW, holeH);
        ctx.fillRect(x, h - borderH + (borderH - holeH) / 2, holeW, holeH);
      }

      const imgH = h - borderH * 2;
      if (w > 0 && imgH > 0 && this.image.complete) {
        this.drawImageCover(ctx, 0, borderH, w, imgH);
      }
      return;
    }

    // 3. Shape Mask Clipping (Circle, Star, Heart, Arch, Flower, or Rounded Rect)
    ctx.save();
    this.createShapePath(ctx, w, h);
    ctx.clip();

    if (this.image && this.image.complete) {
      this.drawImageCover(ctx, 0, 0, w, h);
    }
    ctx.restore();

    // Optional Stroke around the Shape
    if (this.borderWidth > 0) {
      ctx.save();
      this.createShapePath(ctx, w, h);
      ctx.strokeStyle = this.borderColor;
      ctx.lineWidth = this.borderWidth;
      ctx.stroke();
      ctx.restore();
    }
  }

  createShapePath(ctx, w, h) {
    ctx.beginPath();

    if (this.clipShape === 'circle') {
      const r = Math.min(w, h) / 2;
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    } else if (this.clipShape === 'star') {
      const r = Math.min(w, h) / 2;
      this.drawStarPath(ctx, w / 2, h / 2, 5, r, r * 0.44);
    } else if (this.clipShape === 'heart') {
      this.drawHeartPath(ctx, w, h);
    } else if (this.clipShape === 'arch') {
      // Architectural Arch (Dome top, flat bottom)
      const r = w / 2;
      ctx.moveTo(0, h);
      ctx.lineTo(0, r);
      ctx.arc(r, r, r, Math.PI, 0, false);
      ctx.lineTo(w, h);
      ctx.closePath();
    } else if (this.clipShape === 'flower') {
      this.drawFlowerPath(ctx, w, h);
    } else {
      // Standard Rectangle with optional border radius
      if (this.borderRadius > 0) {
        if (ctx.roundRect) {
          ctx.roundRect(0, 0, w, h, this.borderRadius);
        } else {
          ctx.rect(0, 0, w, h);
        }
      } else {
        ctx.rect(0, 0, w, h);
      }
    }
  }

  drawStarPath(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  drawHeartPath(ctx, w, h) {
    // Proportional heart curve strictly centered inside min(w, h)
    const s = Math.min(w, h);
    const ox = (w - s) / 2;
    const oy = (h - s) / 2;
    const topCurveHeight = s * 0.3;

    ctx.moveTo(ox + s / 2, oy + s);
    // Left curve
    ctx.bezierCurveTo(ox, oy + s * 0.65, ox, oy + topCurveHeight, ox + s / 2, oy + topCurveHeight);
    // Right curve
    ctx.bezierCurveTo(ox + s, oy + topCurveHeight, ox + s, oy + s * 0.65, ox + s / 2, oy + s);
    ctx.closePath();
  }

  drawFlowerPath(ctx, w, h) {
    // 8-petal daisy / scalloped floral silhouette centered inside min(w, h)
    const cx = w / 2;
    const cy = h / 2;
    const s = Math.min(w, h);
    const R = s * 0.44;
    const r = R * 0.22;
    const petals = 8;

    for (let i = 0; i < petals; i++) {
      const angle = (i * 2 * Math.PI) / petals;
      const px = cx + Math.cos(angle) * (R - r);
      const py = cy + Math.sin(angle) * (R - r);
      ctx.arc(px, py, r * 1.5, angle - Math.PI / 2, angle + Math.PI / 2);
    }
    ctx.closePath();
  }
}

export class TextItem extends CanvasItem {
  constructor(text, x, y, width = 360, height = 120) {
    super('text', x, y, width, height);
    this.text = text || 'EDITORIAL TITLE';
    this.fontFamily = "'Playfair Display', Georgia, serif";
    this.fontSize = 48;
    this.fontWeight = '700';
    this.fontStyle = 'normal';
    this.color = '#111827';
    this.textAlign = 'center';
    this.letterSpacing = 2;
    this.lineHeight = 1.25;
    this.backgroundColor = 'transparent';
    this.padding = 12;
  }

  draw(ctx) {
    const w = this.width;
    const h = this.height;

    if (this.backgroundColor && this.backgroundColor !== 'transparent') {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.font = `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
    ctx.fillStyle = this.color;
    ctx.textBaseline = 'middle';

    const lines = this.text.split('\n');
    const totalLineHeight = this.fontSize * this.lineHeight;
    const startY = (h - (lines.length - 1) * totalLineHeight) / 2;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ly = startY + i * totalLineHeight;

      let lx = this.padding;
      if (this.textAlign === 'center') {
        lx = w / 2;
        ctx.textAlign = 'center';
      } else if (this.textAlign === 'right') {
        lx = w - this.padding;
        ctx.textAlign = 'right';
      } else {
        ctx.textAlign = 'left';
      }

      if (this.letterSpacing > 0 && ctx.letterSpacing !== undefined) {
        ctx.letterSpacing = `${this.letterSpacing}px`;
      }
      ctx.fillText(line, lx, ly);
    }
  }
}

export class StickerItem extends CanvasItem {
  constructor(image, x, y, width = 160, height = 60, title = 'Sticker') {
    super('sticker', x, y, width, height);
    this.image = image;
    this.title = title;
  }

  draw(ctx) {
    if (this.image && this.image.complete) {
      ctx.drawImage(this.image, 0, 0, this.width, this.height);
    }
  }
}
