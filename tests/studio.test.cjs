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
