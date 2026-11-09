/**
 * Curated SCRL-Style Templates
 * Pre-configured panoramic collages with seamless seam crossings,
 * elegant editorial typography, polaroids, and stickers.
 */

import { ImageItem, TextItem, StickerItem } from './objects.js';
import { SAMPLE_PHOTOS, STICKERS } from './assets.js';

function getSamplePhoto(id) {
  return SAMPLE_PHOTOS.find(p => p.id === id) || SAMPLE_PHOTOS[0];
}

function getSticker(id) {
  return STICKERS.find(s => s.id === id) || STICKERS[0];
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = url;
  });
}

export async function applyTemplate(engine, templateName) {
  engine.items = [];
  engine.selectedItem = null;

  if (templateName === 'panorama') {
    // 3 Slides: Panorama Hero
    engine.slideCount = 3;
    engine.setAspectRatio('4:5');
    engine.background = '#f5f0ea';

    // 1. Wide landscape spanning across slide 1, 2 and 3 seamlessly!
    const mtnData = getSamplePhoto('photo_mountain');
    const mtnImg = await loadImage(mtnData.url);
    const mtnItem = new ImageItem(mtnImg, 180, 260, 2400, 750);
    mtnItem.borderRadius = 8;
    mtnItem.shadow.enabled = true;
    mtnItem.shadow.blur = 28;
    engine.addItem(mtnItem);

    // 2. Large Editorial Headline
    const title = new TextItem('CHASING HORIZONS', 220, 120, 900, 100);
    title.fontFamily = "'Playfair Display', Georgia, serif";
    title.fontSize = 58;
    title.fontWeight = '700';
    title.color = '#1c1917';
    title.textAlign = 'left';
    engine.addItem(title);

    // 3. Subtitle spanning slide 2
    const subtitle = new TextItem('A CONTINUOUS VISUAL STORY • ISSUE 08', 1240, 140, 680, 50);
    subtitle.fontFamily = "'Inter', sans-serif";
    subtitle.fontSize = 18;
    subtitle.fontWeight = '600';
    subtitle.letterSpacing = 4;
    subtitle.color = '#78716c';
    subtitle.textAlign = 'left';
    engine.addItem(subtitle);

    // 4. Polaroid portrait photo on slide 3
    const archData = getSamplePhoto('photo_minimal_arch');
    const archImg = await loadImage(archData.url);
    const archItem = new ImageItem(archImg, 2380, 620, 540, 620);
    archItem.frameStyle = 'polaroid';
    archItem.caption = 'altitude 3,200m';
    archItem.rotation = -3;
    archItem.shadow.enabled = true;
    archItem.shadow.blur = 24;
    engine.addItem(archItem);

    // 5. Aesthetic Stamp Sticker on Slide 1
    const stampData = getSticker('stamp_scrl_aesthetic');
    const stampImg = await loadImage(stampData.url);
    const stampItem = new StickerItem(stampImg, 180, 1080, 140, 140, 'Issue Stamp');
    stampItem.rotation = 6;
    engine.addItem(stampItem);

    // 6. Washi tape on slide 3 polaroid
    const tapeData = getSticker('washi_tape_cream');
    const tapeImg = await loadImage(tapeData.url);
    const tapeItem = new StickerItem(tapeImg, 2540, 595, 200, 48, 'Washi Tape');
    tapeItem.rotation = -4;
    engine.addItem(tapeItem);

  } else if (templateName === 'editorial') {
    // 3 Slides: Vogue Editorial High Fashion
    engine.slideCount = 3;
    engine.setAspectRatio('4:5');
    engine.background = '#ffffff';

    // Slide 1 Headline
    const t1 = new TextItem('MODERN\nFORMS', 160, 280, 600, 180);
    t1.fontFamily = "'Cinzel', serif";
    t1.fontSize = 68;
    t1.fontWeight = '700';
    t1.textAlign = 'left';
    t1.color = '#0f172a';
    engine.addItem(t1);

    // Arch photo bridging slide 1 and slide 2 across seam 1!
    const archData = getSamplePhoto('photo_minimal_arch');
    const archImg = await loadImage(archData.url);
    const archItem = new ImageItem(archImg, 720, 200, 720, 900);
    archItem.borderRadius = 4;
    archItem.shadow.enabled = true;
    archItem.shadow.blur = 36;
    engine.addItem(archItem);

    // Muse photo bridging slide 2 and slide 3 across seam 2!
    const museData = getSamplePhoto('photo_editorial_portrait');
    const museImg = await loadImage(museData.url);
    const museItem = new ImageItem(museImg, 1780, 280, 680, 850);
    museItem.borderRadius = 4;
    museItem.shadow.enabled = true;
    museItem.shadow.blur = 36;
    engine.addItem(museItem);

    // Elegant quote on slide 3
    const quote = new TextItem('"Simplicity is the keynote of all true elegance."', 2460, 340, 580, 120);
    quote.fontFamily = "'Playfair Display', serif";
    quote.fontStyle = 'italic';
    quote.fontSize = 26;
    quote.color = '#475569';
    quote.textAlign = 'left';
    engine.addItem(quote);

    // Starburst accent
    const starData = getSticker('starburst_retro');
    const starImg = await loadImage(starData.url);
    const starItem = new StickerItem(starImg, 860, 130, 80, 80, 'Retro Star');
    engine.addItem(starItem);

  } else if (templateName === 'scrapbook') {
    // 3 Slides: Nostalgic Photo Dump & Polaroid Collage
    engine.slideCount = 3;
    engine.setAspectRatio('4:5');
    engine.background = '#ede8df';

    // Polaroid 1 on Slide 1
    const p1Data = getSamplePhoto('photo_ocean');
    const p1Img = await loadImage(p1Data.url);
    const p1 = new ImageItem(p1Img, 140, 240, 620, 720);
    p1.frameStyle = 'polaroid';
    p1.caption = 'ocean breeze';
    p1.rotation = -5;
    p1.shadow.enabled = true;
    engine.addItem(p1);

    // Polaroid 2 crossing Seam 1 (between Slide 1 and Slide 2!)
    const p2Data = getSamplePhoto('photo_analog_grain');
    const p2Img = await loadImage(p2Data.url);
    const p2 = new ImageItem(p2Img, 820, 360, 640, 740);
    p2.frameStyle = 'polaroid';
    p2.caption = 'golden dunes';
    p2.rotation = 4;
    p2.shadow.enabled = true;
    engine.addItem(p2);

    // Polaroid 3 crossing Seam 2 (between Slide 2 and Slide 3!)
    const p3Data = getSamplePhoto('photo_mountain');
    const p3Img = await loadImage(p3Data.url);
    const p3 = new ImageItem(p3Img, 1680, 220, 680, 760);
    p3.frameStyle = 'polaroid';
    p3.caption = 'take me back';
    p3.rotation = -3;
    p3.shadow.enabled = true;
    engine.addItem(p3);

    // Handwritten Title
    const dumpTitle = new TextItem('the scrapbook collection', 900, 140, 700, 80);
    dumpTitle.fontFamily = "'Caveat', cursive";
    dumpTitle.fontSize = 54;
    dumpTitle.fontWeight = '700';
    dumpTitle.color = '#3e362e';
    engine.addItem(dumpTitle);

    // Tapes and Paperclip
    const tapeData = getSticker('washi_tape_blush');
    const tapeImg = await loadImage(tapeData.url);
    const tape1 = new StickerItem(tapeImg, 340, 210, 200, 48, 'Washi Tape Blush');
    tape1.rotation = -8;
    engine.addItem(tape1);

    const tape2 = new StickerItem(tapeImg, 1020, 330, 210, 50, 'Washi Tape Blush');
    tape2.rotation = 6;
    engine.addItem(tape2);

    const clipData = getSticker('polaroid_clip');
    const clipImg = await loadImage(clipData.url);
    const clipItem = new StickerItem(clipImg, 1780, 170, 40, 95, 'Paperclip');
    engine.addItem(clipItem);

  } else if (templateName === 'filmstrip') {
    // 3 Slides: 35mm Analog Film Roll
    engine.slideCount = 3;
    engine.setAspectRatio('4:5');
    engine.background = '#0d0d11';

    // 3 Film strip images
    const photos = ['photo_ocean', 'photo_mountain', 'photo_analog_grain'];
    for (let i = 0; i < 3; i++) {
      const pData = getSamplePhoto(photos[i]);
      const pImg = await loadImage(pData.url);
      const filmItem = new ImageItem(pImg, 120 + i * 1040, 360, 920, 640);
      filmItem.frameStyle = 'film';
      engine.addItem(filmItem);
    }

    // Monospace header
    const filmTitle = new TextItem('KODACHROME 400 • FRAME 24A-26A', 500, 180, 1000, 60);
    filmTitle.fontFamily = "'Courier Prime', monospace";
    filmTitle.fontSize = 28;
    filmTitle.fontWeight = '700';
    filmTitle.letterSpacing = 4;
    filmTitle.color = '#f59e0b'; // Amber film label
    engine.addItem(filmTitle);

    // Barcode on slide 3
    const barcodeData = getSticker('film_35mm_barcode');
    const barcodeImg = await loadImage(barcodeData.url);
    const barcodeItem = new StickerItem(barcodeImg, 2750, 1080, 220, 75, 'Film Barcode');
    engine.addItem(barcodeItem);

  } else {
    // Blank Canvas
    engine.slideCount = 3;
    engine.setAspectRatio('4:5');
    engine.background = '#f5f0ea';
  }

  engine.fitToScreen();
  engine.saveHistory(`Apply ${templateName} template`);
}
