/**
 * NotSCRL Project Persistent Cache & Storage Engine
 * Auto-persists full projects into browser storage (IndexedDB with localStorage fallback).
 * Reports committed saves and keeps a local fallback when browser quotas allow it.
 */

export class StorageManager {
  constructor(engine) {
    this.engine = engine;
    this.dbName = "NotScrlStorageDB";
    this.storeName = "projects";
    this.projectKey = "active_project";
    this.localKey = "notscrl_active_project_backup";
    this.saveTimeout = null;
    this.projectId = null;
    this.projectName = "Mi carrusel";
    this.db = null;
    this.changeRevision = 0;
    this.lastTimestamp = 0;

    this.dbPromise = this.initDB();
  }

  initDB() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      try {
        const req = window.indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        req.onsuccess = (e) => {
          this.db = e.target.result;
          resolve(this.db);
        };
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  scheduleAutoSave() {
    if (!this.projectId || this.engine.isRestoringHistory) return;
    this.changeRevision++;
    this.onStatus?.("saving");
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveProject();
    }, 350);
  }

  captureProject() {
    this.lastTimestamp = Math.max(Date.now(), this.lastTimestamp + 1);
    return {
      version: 1,
      id:
        this.projectId ||
        (this.projectId = crypto.randomUUID?.() || String(Date.now())),
      name: this.projectName,
      status: "draft",
      thumbnail: this.thumbnail || null,
      timestamp: this.lastTimestamp,
      slideCount: this.engine.slideCount,
      slideWidth: this.engine.slideWidth,
      slideHeight: this.engine.slideHeight,
      aspectRatioName: this.engine.aspectRatioName,
      background: this.engine.background,
      items: this.engine.items.map((it) => this.engine.serializeItem(it)),
    };
  }

  async saveProject() {
    const revision = this.changeRevision;
    try {
      if (this.engine.isRestoringHistory) return null;
      const data = this.captureProject();

      // Write the recovery copy before yielding; pagehide cannot wait for a promise.
      let fallbackSaved = false;
      try {
        localStorage.setItem(this.localKey, JSON.stringify(data));
        fallbackSaved = true;
      } catch {
        /* Large photos can exceed the localStorage quota. */
      }

      // IndexedDB commits the active draft and library entry atomically.
      const db = this.db || (await this.dbPromise);
      let databaseSaved = false;
      if (db) {
        try {
          await new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, "readwrite");
            tx.objectStore(this.storeName).put(data, this.projectKey);
            tx.objectStore(this.storeName).put(data, `project_${data.id}`);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
          });
          databaseSaved = true;
        } catch {
          /* Try the local backup if the database is full or unavailable. */
        }
      }

      if (!databaseSaved && !fallbackSaved)
        throw new Error("No hay espacio de almacenamiento");
      this.lastSaveInLibrary = databaseSaved;
      if (revision === this.changeRevision)
        this.onStatus?.(databaseSaved ? "saved" : "fallback");
      return data;
    } catch (err) {
      console.warn("Error saving project to cache:", err);
      if (revision === this.changeRevision) this.onStatus?.("error");
      return null;
    }
  }

  async flush() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = null;
    return this.saveProject();
  }

  saveOnExit() {
    if (!this.projectId || this.engine.isRestoringHistory) return;
    clearTimeout(this.saveTimeout);
    this.saveTimeout = null;
    return this.saveProject();
  }

  async listProjects() {
    const db = await this.dbPromise;
    if (!db) {
      const current = await this.loadProject();
      return current ? [current] : [];
    }
    const projects = await new Promise((resolve) => {
      const req = db
        .transaction(this.storeName)
        .objectStore(this.storeName)
        .getAll();
      req.onsuccess = () => {
        const unique = new Map();
        req.result.filter((p) => p.id).forEach((p) => unique.set(p.id, p));
        resolve([...unique.values()].sort((a, b) => b.timestamp - a.timestamp));
      };
      req.onerror = () => resolve([]);
    }).catch(() => []);
    const active = await this.loadProject();
    if (active?.id) {
      const previous = projects.findIndex((p) => p.id === active.id);
      if (previous < 0) projects.push(active);
      else if (active.timestamp > projects[previous].timestamp)
        projects[previous] = active;
    }
    return projects.sort((a, b) => b.timestamp - a.timestamp);
  }

  async loadProject() {
    let databaseProject = null;
    // 1. Try IndexedDB
    try {
      const db = await this.dbPromise;
      if (db) {
        const data = await new Promise((resolve) => {
          const tx = db.transaction(this.storeName, "readonly");
          const req = tx.objectStore(this.storeName).get(this.projectKey);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        });
        if (data && Array.isArray(data.items)) {
          databaseProject = data;
        }
      }
    } catch (e) {}

    // 2. Fallback to localStorage
    try {
      const raw = localStorage.getItem(this.localKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) {
          databaseProject =
            !databaseProject || parsed.timestamp > databaseProject.timestamp
              ? parsed
              : databaseProject;
        }
      }
    } catch (e) {}

    this.lastTimestamp = Math.max(
      this.lastTimestamp,
      databaseProject?.timestamp || 0,
    );
    return databaseProject;
  }

  async clearCache() {
    try {
      const db = await this.dbPromise;
      if (db) {
        const tx = db.transaction(this.storeName, "readwrite");
        tx.objectStore(this.storeName).delete(this.projectKey);
      }
      localStorage.removeItem(this.localKey);
    } catch (e) {}
  }
}
