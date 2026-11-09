const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function load(file, names, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/^import .*;$/gm, '').replace(/export (class|const|function)/g, '$1');
  return vm.runInNewContext(`${source}\n;({${names.join(',')}})`, {
    console, structuredClone, setTimeout, clearTimeout, crypto, ...globals
  });
}

const { CanvasEngine } = load('js/canvas.js', ['CanvasEngine']);

test('Deleting the first, middle or last page shifts later content and can be undone', async () => {
  class Text { constructor() { this.type = 'text'; } }
  const { CanvasEngine: Engine } = load('js/canvas.js', ['CanvasEngine'], {
    window: { __notScrlObjects: { TextItem: Text } }
  });
  for (const index of [0, 1, 2]) {
    const engine = Object.assign(Object.create(Engine.prototype), {
      slideCount: 3, slideWidth: 1080, slideHeight: 1350, history: [], historyIndex: -1,
      items: [50, 1150, 2230].map((x, i) => ({ type: 'text', text: String(i), x, y: 40, width: 100, height: 80 })),
      selectItem(item) { this.selectedItem = item; },
      focusSlide(page) { this.page = page; }, fitToScreen() {}, triggerChange() {}
    });
    engine.saveHistory('Before deletion');
    assert.equal(engine.removeSlide(index), true);
    assert.equal(engine.slideCount, 2);
    assert.deepEqual(Array.from(engine.items, item => item.text), ['0','1','2'].filter((_, i) => i !== index));
    for (const item of engine.items) {
      const originalPage = Number(item.text);
      assert.equal(item.x, [50,1150,2230][originalPage] - (originalPage > index ? 1080 : 0));
    }
    assert.equal(engine.page, Math.min(index, 1));
    await engine.restoreHistory(engine.history[0]);
    assert.equal(engine.slideCount, 3);
    assert.deepEqual(Array.from(engine.items, item => item.x), [50,1150,2230]);
    await engine.restoreHistory(engine.history[1]);
    assert.equal(engine.slideCount, 2);
    engine.removeSlide(0);
    assert.equal(engine.removeSlide(0), false);
    assert.equal(engine.slideCount, 1);
    assert.equal(engine.removeSlide(-1), false);
  }
});

test('Cropping hides pixels without moving, resizing or changing zoom, including repeated crops', () => {
  const { ImageItem } = load('js/objects.js', ['ImageItem']);
  const { ImageCropper } = load('js/cropper.js', ['ImageCropper']);
  const item = new ImageItem({ complete: true, naturalWidth: 2000, naturalHeight: 1000 }, 220, 310, 800, 600);
  item.rotation = 35;
  item.fitOffset = { x: .3, y: -.2, zoom: 1.5 };
  let before;
  item.drawImageCover({ drawImage(...args) { before = args; } }, 0, 0, 800, 600);
  const cropper = Object.assign(Object.create(ImageCropper.prototype), {
    targetItem: item, imgRect: { width: 1000, height: 500 },
    cropBox: { style: { left: '400px', top: '180px', width: '200px', height: '150px' } },
    engine: { triggerChange() {}, saveHistory() {} }, close() {}
  });
  for (const left of ['400px', '450px']) {
    cropper.cropBox.style.left = left;
    cropper.applyCrop();
    assert.deepEqual([item.x, item.y, item.width, item.height, item.rotation], [220,310,800,600,35]);
    let after;
    item.drawImageCover({ drawImage(...args) { after = args; } }, 0, 0, 800, 600);
    assert.ok(after);
    assert.ok(after[3] < before[3]);
    assert.ok(Math.abs(after[7] / after[3] - before[7] / before[3]) < 1e-10);
    assert.ok(Math.abs(after[5] - (before[5] + (after[1] - before[1]) * before[7] / before[3])) < 1e-10);
    assert.ok(Math.abs(after[6] - (before[6] + (after[2] - before[2]) * before[8] / before[4])) < 1e-10);
  }
  item.crop = { x: 0, y: 0, width: 1, height: 1 };
  let reset;
  item.drawImageCover({ drawImage(...args) { reset = args; } }, 0, 0, 800, 600);
  assert.equal(reset[0], before[0]);
  for (let i = 1; i < reset.length; i++) assert.ok(Math.abs(reset[i] - before[i]) < 1e-9);
});

test('Mobile slide fitting respects both screen dimensions and retains the active page', () => {
  for (const width of [320, 375, 390, 768, 1440]) {
    for (const height of [160, 350, 640]) {
      for (const slideHeight of [1080, 1350, 1920]) {
        const engine = Object.assign(Object.create(CanvasEngine.prototype), {
          viewportWidth: width, viewportHeight: height, slideWidth: 1080,
          slideHeight, slideCount: 10, panX: 0, zoom: .2,
          resizeCanvas() {}, render() {}
        });
        engine.focusSlide(7);
        assert.ok(engine.zoom * engine.slideWidth <= width);
        assert.ok(engine.zoom * engine.slideHeight <= height);
        assert.equal(engine.getActiveSlideIndex(), 7);
        engine.fitToScreen(true);
        assert.equal(engine.getActiveSlideIndex(), 7);
      }
    }
  }
});

test('Full-page photos use the active page, remove inset styling and keep matching sources uncropped', () => {
  const { ImageItem } = load('js/objects.js', ['ImageItem']);
  for (const height of [1350, 1080, 1920]) {
    const engine = Object.assign(Object.create(CanvasEngine.prototype), {
      slideWidth: 1080, slideHeight: height, slideCount: 3,
      viewportWidth: 390, zoom: .2, panX: 195 - 1620 * .2,
      history: [], historyIndex: -1, triggerChange() {}
    });
    const item = new ImageItem({ src: 'preview', complete: true, naturalWidth: 2160, naturalHeight: height * 2 }, 20, 80, 300, 200);
    Object.assign(item, { originalKey: 'original', rotation: 90, frameStyle: 'polaroid', borderRadius: 8,
      crop: { x: .2, y: .1, width: .5, height: .6 }, cropReference: { x: 0, y: 0, width: 1, height: 1 }, fitOffset: { x: .5, y: .2, zoom: 2 } });
    engine.items = [item];
    engine.saveHistory('Before');
    engine.fillImageToSlide(item);
    assert.deepEqual([item.x, item.y, item.width, item.height], [1080, 0, 1080, height]);
    assert.equal(item.rotation, 0);
    assert.equal(item.frameStyle, 'none');
    assert.equal(item.borderRadius, 0);
    assert.equal(item.cropReference, null);
    assert.equal(item.originalKey, 'original');
    let drawn;
    item.drawImageCover({ drawImage(...args) { drawn = args; } }, 0, 0, item.width, item.height);
    assert.deepEqual(drawn.slice(1), [0, 0, 2160, height * 2, 0, 0, 1080, height]);
    assert.equal(engine.history.length, 2);
    assert.equal(engine.history[0].items[0].rotation, 90);
    assert.equal(engine.history[0].items[0].crop.x, .2);
  }
});

test('Snapshots contain cloneable image sources and independent nested settings', () => {
  const engine = Object.create(CanvasEngine.prototype);
  const item = { type: 'image', image: { src: 'data:image/png;base64,AA==' }, shadow: { enabled: false }, fitOffset: { x: .5 } };
  const snapshot = engine.serializeItem(item);
  assert.equal(snapshot.image, undefined);
  assert.equal(snapshot.imageSrc, item.image.src);
  item.shadow.enabled = true;
  item.fitOffset.x = -.5;
  assert.equal(snapshot.shadow.enabled, false);
  assert.equal(snapshot.fitOffset.x, .5);
});

test('Photo imports run sequentially, limit dimensions and release temporary resources', async () => {
  let active = 0, peak = 0, revoked = 0;
  const sizes = [];
  class MockImage {
    constructor() { this.naturalWidth = 4000; this.naturalHeight = 3000; }
    async decode() {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
    }
  }
  class Item { constructor(image) { this.image = image; } }
  const { NotScrlMobileApp } = load('js/app.js', ['NotScrlMobileApp'], {
    window: { addEventListener() {} }, Image: MockImage, ImageItem: Item,
    TextItem: class {}, StickerItem: class {},
    URL: { createObjectURL: () => 'blob:photo', revokeObjectURL: () => revoked++ },
    document: { createElement() { return { width: 0, height: 0,
      getContext() { return { drawImage() {} }; },
      toDataURL() { sizes.push([this.width, this.height]); return 'data:image/jpeg;base64,AA=='; }
    }; } }
  });
  const items = [];
  const app = Object.assign(Object.create(NotScrlMobileApp.prototype), {
    storage: { projectId: 'one', async saveOriginal(file) { assert.equal(file.type, 'image/jpeg'); return 'original'; } }, studio: { toast() { assert.fail('Import failed'); } },
    engine: { slideWidth: 1080, slideHeight: 1350, addItem(item) { items.push(item); } },
    getSpawnX() { return 0; }
  });
  await Promise.all([app.handleFiles([{ type: 'image/jpeg' }, { type: 'image/jpeg' }]),
    app.handleFiles([{ type: 'image/jpeg' }])]);
  assert.equal(peak, 1);
  assert.equal(items.length, 3);
  assert.equal(revoked, 3);
  assert.deepEqual(sizes, [[1280, 960], [1280, 960], [1280, 960]]);
  assert.ok(items.every(item => item.originalKey === 'original'));
});

test('Original files are stored unchanged and only acknowledged after the transaction commits', async () => {
  let tx, stored;
  const file = new Blob(['original camera bytes'], { type: 'image/jpeg' });
  const storage = storageWithDatabase({ transaction(name) {
    assert.equal(name, 'originals');
    return tx = { objectStore() { return { put(value) { stored = value; } }; } };
  } });
  let committed = false;
  const saving = storage.saveOriginal(file).then(key => { committed = true; return key; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stored, file);
  assert.equal(committed, false);
  tx.oncomplete();
  assert.ok(await saving);
});

test('Export draws from originals one at a time, preserves crop and leaves editor previews intact', async () => {
  let active = 0, peak = 0, released = 0;
  const rendered = [];
  class MockImage {
    set src(value) { this.source = value; if (!value) active--; }
    async decode() { active++; peak = Math.max(peak, active); }
  }
  const ctx = { translate() {}, fillRect() {} };
  const { CanvasExporter } = load('js/exporter.js', ['CanvasExporter'], {
    Image: MockImage,
    URL: { createObjectURL: file => `blob:${file}`, revokeObjectURL() { released++; } },
    document: { createElement: () => ({ getContext: () => ctx }) }
  });
  const items = ['one', 'two'].map(originalKey => ({ originalKey, image: { src: 'preview' }, crop: { x: .25 },
    render() { rendered.push([this.image.source, this.crop.x]); }
  }));
  const exporter = new CanvasExporter({ slideWidth: 1080, totalWidth: 2160, totalHeight: 1350, background: '#fff', items },
    { async loadOriginal(key) { return key; } });
  const canvas = await exporter.renderOriginals(0);
  assert.deepEqual(rendered, [['blob:one', .25], ['blob:two', .25]]);
  assert.equal(peak, 1);
  assert.equal(active, 0);
  assert.equal(released, 2);
  assert.equal(items[0].image.src, 'preview');
  assert.equal(canvas.width, 1080);
});

test('Missing originals stop export instead of silently substituting previews', async () => {
  const canvas = { getContext: () => ({ translate() {}, fillRect() {} }) };
  const { CanvasExporter } = load('js/exporter.js', ['CanvasExporter'], {
    document: { createElement: () => canvas }
  });
  const exporter = new CanvasExporter({ slideWidth: 1080, totalWidth: 1080, totalHeight: 1350, background: '#fff',
    items: [{ originalKey: 'missing', render() { assert.fail('Preview must not be exported'); } }] },
    { async loadOriginal() { throw new Error('Missing original'); } });
  await assert.rejects(exporter.renderOriginals(0), /Missing original/);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});

test('Restoring an empty saved project preserves its format, background and empty state', async () => {
  const { CanvasEngine: Engine } = load('js/canvas.js', ['CanvasEngine'], {
    window: { __notScrlObjects: {} }
  });
  const engine = Object.assign(Object.create(Engine.prototype), {
    items: [{ type: 'text' }], history: [], historyIndex: -1, selectedItem: null,
    selectItem() {}, fitToScreen() {}, triggerChange() {}
  });
  await engine.restoreProject({ items: [], slideCount: 2, slideWidth: 1080, slideHeight: 1920, aspectRatioName: '9:16', background: '#ffffff' });
  assert.equal(engine.items.length, 0);
  assert.equal(engine.slideCount, 2);
  assert.equal(engine.aspectRatioName, '9:16');
  assert.equal(engine.background, '#ffffff');
  assert.equal(engine.history.length, 1);
});

test('Image restoration waits for decoding and retains text and crop properties', async () => {
  let decoded = false;
  class MockImage { async decode() { await Promise.resolve(); decoded = true; } }
  class Item { constructor(image) { this.image = image; } }
  const { CanvasEngine: Engine } = load('js/canvas.js', ['CanvasEngine'], {
    Image: MockImage,
    window: { __notScrlObjects: { ImageItem: Item, TextItem: Item, StickerItem: Item } }
  });
  const engine = Object.assign(Object.create(Engine.prototype), { selectItem() {}, fitToScreen() {}, triggerChange() { assert.ok(decoded); } });
  await engine.restoreHistory({ items: [{ type: 'image', imageSrc: 'photo', fitOffset: { x: .4, y: -.2, zoom: 2 }, shadow: {} }, { type: 'text', text: 'Hola', lineHeight: 1.5, shadow: {} }] });
  assert.equal(engine.items[0].image.src, 'photo');
  assert.equal(engine.items[0].fitOffset.zoom, 2);
  assert.equal(engine.items[1].lineHeight, 1.5);
});

function storageWithDatabase(db, localStorage = { setItem() {}, getItem() { return null; } }) {
  const { StorageManager } = load('js/storage.js', ['StorageManager'], { window: {}, localStorage });
  const manager = new StorageManager({ items: [], slideCount: 3, slideWidth: 1080, slideHeight: 1350, aspectRatioName: '4:5', background: '#fff' });
  manager.dbPromise = Promise.resolve(db);
  return manager;
}

test('Saved status is emitted only after the database transaction commits', async () => {
  let transaction;
  const written = [];
  const storage = storageWithDatabase({ transaction() {
    return transaction = { objectStore() { return { put(data, key) { written.push([data, key]); } }; } };
  } });
  const states = [];
  storage.onStatus = state => states.push(state);
  const saving = storage.saveProject();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(states.length, 0);
  assert.equal(written.length, 2);
  assert.equal(written[0][1], 'active_project');
  assert.equal(written[1][1], `project_${written[0][0].id}`);
  transaction.oncomplete();
  await saving;
  assert.equal(states[0], 'saved');
  assert.equal(storage.lastSaveInLibrary, true);
});

test('A database quota failure uses the local backup without claiming library persistence', async () => {
  const db = { transaction() { throw new Error('QuotaExceededError'); } };
  const storage = storageWithDatabase(db);
  let status;
  storage.onStatus = state => { status = state; };
  assert.ok(await storage.saveProject());
  assert.equal(status, 'fallback');
  assert.equal(storage.lastSaveInLibrary, false);
});

test('Recovery prefers a newer local backup after a database failure', async () => {
  const oldProject = { items: [], timestamp: 1, name: 'Anterior' };
  const db = { transaction() { return { objectStore() { return { get() {
    const request = {};
    queueMicrotask(() => { request.result = oldProject; request.onsuccess(); });
    return request;
  } }; } }; } };
  const storage = storageWithDatabase(db, { getItem() { return JSON.stringify({ items: [], timestamp: 2, name: 'Recuperado' }); } });
  assert.equal((await storage.loadProject()).name, 'Recuperado');
});

test('Thumbnails and exported slides share page coordinates and preserve native output dimensions', () => {
  const calls = [];
  const context = { scale(...args) { calls.push(['scale', ...args]); }, translate(...args) { calls.push(['translate', ...args]); }, fillRect() {} };
  const { CanvasExporter } = load('js/exporter.js', ['CanvasExporter'], {
    document: { createElement() { return { getContext() { return context; } }; } }
  });
  for (const slideHeight of [1080, 1350, 1920]) {
    const exporter = new CanvasExporter({ slideWidth: 1080, slideHeight, totalWidth: 3240, totalHeight: slideHeight, background: '#fff', items: [] });
    const thumbnail = exporter.renderThumbnail(1, 180);
    assert.equal(thumbnail.width, 180);
    assert.equal(thumbnail.height, Math.round(slideHeight / 6));
    const slide = exporter.renderSlide(1);
    assert.equal(slide.width, 1080);
    assert.equal(slide.height, slideHeight);
    assert.deepEqual(calls.at(-1), ['translate', -1080, 0]);
  }
});

test('Closing the page writes the latest recovery snapshot before waiting for the database', async () => {
  let backup;
  let openDatabase;
  const local = { setItem(key, value) { backup = value; }, getItem() { return backup; } };
  const storage = storageWithDatabase(null, local);
  storage.projectId = 'draft-exit';
  storage.projectName = 'Último cambio antes de cerrar';
  const earlier = storage.captureProject().timestamp;
  storage.dbPromise = new Promise(resolve => { openDatabase = resolve; });
  const pending = storage.saveOnExit();
  assert.equal(JSON.parse(backup).name, 'Último cambio antes de cerrar');
  assert.equal(JSON.parse(backup).status, 'draft');
  assert.ok(JSON.parse(backup).timestamp > earlier);
  openDatabase(null);
  await pending;
  const reopened = storageWithDatabase(null, local);
  const recovered = await reopened.loadProject();
  assert.equal(recovered.id, 'draft-exit');
  assert.equal(recovered.name, 'Último cambio antes de cerrar');
});

test('Closing starts the ready database transaction synchronously when the backup is too large', async () => {
  const writes = [];
  let transaction;
  const db = { transaction() {
    return transaction = { objectStore() { return { put(data, key) { writes.push([key, data]); } }; } };
  } };
  const storage = storageWithDatabase(db, { setItem() { throw new Error('QuotaExceededError'); } });
  storage.db = db;
  storage.projectId = 'large-photo-draft';
  const pending = storage.saveOnExit();
  assert.equal(writes.length, 2);
  assert.equal(writes[1][0], 'project_large-photo-draft');
  transaction.oncomplete();
  assert.ok(await pending);
  assert.equal(storage.lastSaveInLibrary, true);
});

test('An older transaction cannot report all changes saved while a newer edit is pending', async () => {
  let transaction;
  const storage = storageWithDatabase({ transaction() {
    return transaction = { objectStore() { return { put() {} }; } };
  } });
  storage.projectId = 'draft-pending';
  const states = [];
  storage.onStatus = state => states.push(state);
  const pending = storage.saveProject();
  await new Promise(resolve => setImmediate(resolve));
  storage.projectName = 'Nuevo título';
  storage.scheduleAutoSave();
  transaction.oncomplete();
  await pending;
  clearTimeout(storage.saveTimeout);
  assert.equal(states.at(-1), 'saving');
  assert.ok(!states.includes('saved'));
});

test('Opening the app without a draft does not create a phantom project on exit', () => {
  let writes = 0;
  const storage = storageWithDatabase(null, { setItem() { writes++; } });
  assert.equal(storage.saveOnExit(), undefined);
  storage.scheduleAutoSave();
  assert.equal(storage.saveTimeout, null);
  assert.equal(writes, 0);
  assert.equal(storage.projectId, null);
});
