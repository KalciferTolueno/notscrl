import { applyTemplate } from "./templates.js";
import { CanvasExporter } from "./exporter.js";

const TEMPLATE_INFO = [
  ["panorama", "Horizontes", "Paisajes que siguen contigo", "01"],
  ["editorial", "Formas de ver", "Tu propia edición de revista", "02"],
  ["scrapbook", "Pequeños recuerdos", "Un diario de tus días favoritos", "03"],
  ["filmstrip", "En analógico", "Historias con alma de 35 mm", "04"],
];

export class Studio {
  constructor(app) {
    this.app = app;
    this.engine = app.engine;
    this.storage = app.storage;
    this.view = "home";
    this.templatePreviews = new Map();
    this.bind();
    this.renderProjects();
    this.renderTemplates();
    this.update();
  }

  toast(message) {
    const el = document.getElementById("studio-toast");
    el.textContent = message;
    el.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add("hidden"), 4000);
  }

  bind() {
    document.querySelectorAll("[data-home-tab]").forEach((btn) => {
      btn.addEventListener("click", () => this.showHome(btn.dataset.homeTab));
    });
    document.querySelector(".wordmark").addEventListener("click", (e) => {
      e.preventDefault();
      this.showHome("home");
    });
    document.querySelectorAll("[data-new-project]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("new-project-dialog").showModal();
      });
    });
    document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
      btn.addEventListener("click", () => btn.closest("dialog").close());
    });
    document.getElementById("btn-help").addEventListener("click", () => {
      document.getElementById("help-dialog").showModal();
    });
    document
      .getElementById("new-project-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!e.target.reportValidity()) return;
        const btn = e.target.querySelector("[type=submit]");
        btn.disabled = true;
        try {
          const created = await this.newProject(null, {
            name:
              document.getElementById("new-project-name").value.trim() ||
              "Mi próxima historia",
            ratio: document.getElementById("new-project-ratio").value,
            count: Number(document.getElementById("new-project-count").value),
          });
          if (created) {
            document.getElementById("new-project-dialog").close();
            e.target.reset();
          }
        } finally {
          btn.disabled = false;
        }
      });
    document
      .getElementById("btn-back-home")
      .addEventListener("click", async () => {
        if (this.busy) return;
        this.busy = true;
        try {
          this.renderPages();
          if (await this.storage.flush()) await this.showHome("projects");
          else
            this.toast(
              "No se pudo guardar el borrador. Tu edición sigue abierta.",
            );
        } finally {
          this.busy = false;
        }
      });
    document
      .getElementById("btn-save-draft")
      .addEventListener("click", async (e) => {
        const button = e.currentTarget;
        button.disabled = true;
        try {
          this.renderPages();
          const saved = await this.storage.flush();
          this.toast(
            saved
              ? "Borrador guardado. Puedes retomarlo desde Borradores."
              : "No se pudo guardar. Tu edición sigue abierta.",
          );
        } finally {
          button.disabled = false;
        }
      });
    document
      .getElementById("empty-canvas-action")
      .addEventListener("click", () => {
        this.app.openDrawer("photos", "Añadir fotos");
      });
    const name = document.getElementById("project-name");
    name.value = this.storage.projectName;
    name.addEventListener("input", () => {
      this.storage.projectName = name.value.trim() || "Sin título";
      this.storage.scheduleAutoSave();
      this.storage.flush();
    });
    name.addEventListener("blur", () => {
      name.value = this.storage.projectName;
    });
    document.getElementById("btn-layers").addEventListener("click", () => {
      this.app.openDrawer("adjust", "Capas del proyecto");
      document.getElementById("object-adjustments").classList.add("hidden");
      document.getElementById("layers-list").classList.remove("hidden");
      this.renderLayers();
    });
    document
      .getElementById("drawer-backdrop")
      .addEventListener("click", () => this.app.closeDrawer());
    let dragY = null;
    const handle = document.querySelector(".drawer-pill-handle");
    handle.addEventListener("pointerdown", (e) => {
      dragY = e.clientY;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointerup", (e) => {
      if (dragY !== null && e.clientY - dragY > 45) this.app.closeDrawer();
      dragY = null;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!this.app.frameAdjuster.modal.classList.contains("hidden"))
          this.app.frameAdjuster.close();
        else if (!this.app.cropper.modal.classList.contains("hidden"))
          this.app.cropper.close();
        else if (!this.app.exportModal.classList.contains("hidden"))
          this.app.exportModal.classList.add("hidden");
        else if (!this.app.preview.modal.classList.contains("hidden"))
          this.app.preview.close();
        else this.app.closeDrawer();
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && !this.app.loadingProject)
        this.storage.saveOnExit();
    });
    window.addEventListener("pagehide", () => {
      if (!this.app.loadingProject) this.storage.saveOnExit();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted && this.view !== "editor") this.renderProjects();
    });
    this.engine.onViewChange = () => this.updateActivePage();
    new ResizeObserver(() => {
      if (this.view === "editor")
        this.engine.fitToScreen(this.engine.viewMode === "slide");
    }).observe(this.app.workspaceEl);
  }

  setSavingStatus(state) {
    const el = document.getElementById("save-status");
    el.dataset.state = state;
    el.textContent = {
      saving: "Guardando…",
      saved: "Borrador guardado",
      fallback: "Guardado · solo proyecto actual",
      error: "No se pudo guardar · revisa el espacio",
    }[state];
    const status = document.getElementById("drafts-storage-status");
    status.dataset.state = state;
    status.textContent = {
      saving: "Guardando los últimos cambios…",
      saved: "Tus borradores están guardados en este dispositivo.",
      fallback:
        "El respaldo actual está guardado. La biblioteca no está disponible.",
      error:
        "No se pudo guardar. Vuelve al editor y revisa el espacio disponible.",
    }[state];
  }

  async showHome(section = "home") {
    this.view = section;
    document.getElementById("home-view").dataset.section = section;
    this.engine.enabled = false;
    document.querySelector('meta[name="theme-color"]').content = "#f5f3ee";
    document.getElementById("editor-view").classList.add("hidden");
    document.getElementById("home-view").classList.remove("hidden");
    document
      .getElementById("home-intro")
      .classList.toggle("hidden", section !== "home");
    document
      .getElementById("projects-section")
      .classList.toggle("hidden", section === "templates");
    document
      .getElementById("templates-section")
      .classList.toggle("hidden", section === "projects");
    document
      .getElementById("projects-section")
      .classList.toggle("only-section", section === "projects");
    document
      .getElementById("templates-section")
      .classList.toggle("only-section", section === "templates");
    document.getElementById("projects-heading").textContent =
      section === "projects" ? "Tus borradores" : "Borradores recientes";
    document
      .getElementById("drafts-info")
      .classList.toggle("hidden", section !== "projects");
    document.getElementById("templates-heading").textContent =
      section === "templates"
        ? "Todas las plantillas"
        : "Para tu próxima historia";
    document.querySelectorAll(".home-nav button").forEach((btn) => {
      const active = btn.dataset.homeTab === section;
      btn.classList.toggle("active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    this.app.closeDrawer();
    document.querySelector(".home-scroll").scrollTop = 0;
    await this.renderProjects();
  }

  showEditor() {
    this.view = "editor";
    this.engine.enabled = true;
    document.querySelector('meta[name="theme-color"]').content = "#181917";
    document.getElementById("home-view").classList.add("hidden");
    document.getElementById("editor-view").classList.remove("hidden");
    document.getElementById("project-name").value = this.storage.projectName;
    this.engine.selectItem(null);
    if (this.app.workspaceEl.getBoundingClientRect().width <= 900)
      this.engine.focusSlide(0);
    else this.engine.fitToScreen(false);
    this.renderPages();
    this.update();
  }

  async newProject(template, settings = {}) {
    if (this.busy) return false;
    this.busy = true;
    try {
      // Preserve the current draft before changing the active project.
      if (
        this.storage.projectId &&
        (!(await this.storage.flush()) || !this.storage.lastSaveInLibrary)
      ) {
        this.toast(
          "No se pudo conservar el proyecto actual. Revisa el almacenamiento del navegador.",
        );
        return false;
      }
      this.storage.projectId = crypto.randomUUID?.() || String(Date.now());
      this.storage.projectName =
        settings.name ||
        TEMPLATE_INFO.find((t) => t[0] === template)?.[1] ||
        "Mi carrusel";
      this.app.loadingProject = true;
      if (template) await applyTemplate(this.engine, template);
      else {
        this.engine.clearToBlankCanvas();
        this.engine.slideCount = settings.count || 3;
        this.engine.setAspectRatio(settings.ratio || "4:5");
      }
      this.engine.selectItem(null);
      this.engine.history = [];
      this.engine.historyIndex = -1;
      this.engine.saveHistory("Nuevo proyecto");
      this.app.loadingProject = false;
      this.showEditor();
      await this.storage.flush();
      this.toast(
        template
          ? "La plantilla es tuya. Dale tu toque."
          : "Tu lienzo está listo. Empieza con una foto.",
      );
      return true;
    } catch (error) {
      this.toast("No se pudo abrir el proyecto. Inténtalo otra vez.");
      console.error(error);
      return false;
    } finally {
      this.busy = false;
      this.app.loadingProject = false;
    }
  }

  async renderProjects() {
    const projects = await this.storage.listProjects();
    if (this.view === "editor") return;
    const container = document.getElementById("project-list");
    container.replaceChildren();
    document.getElementById("draft-count").textContent = projects.length;
    document
      .getElementById("draft-count")
      .classList.toggle("hidden", projects.length === 0);
    const shown = this.view === "home" ? projects.slice(0, 2) : projects;
    if (!shown.length) {
      const empty = document.createElement("div");
      empty.className = "empty-drafts";
      empty.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6m-6 4h6m-6 4h3"/></svg><strong>Aquí siguen tus ideas.</strong><p>Crea tu primer carrusel. Lo guardaremos como borrador mientras editas.</p><button class="text-link">Crear un carrusel <span aria-hidden="true">↗</span></button>';
      empty
        .querySelector("button")
        .addEventListener("click", () =>
          document.getElementById("new-project-dialog").showModal(),
        );
      container.appendChild(empty);
    }
    for (const project of shown) {
      const card = document.createElement("button");
      card.className = "project-card";
      const thumb = document.createElement("div");
      thumb.className = "project-thumb";
      if (project.thumbnail) {
        const img = document.createElement("img");
        img.src = project.thumbnail;
        img.alt = "";
        img.style.cssText = "width:100%;height:100%;object-fit:cover";
        thumb.appendChild(img);
      }
      const info = document.createElement("div");
      info.className = "project-card-info";
      const title = document.createElement("strong");
      title.textContent = project.name || "Mi primer carrusel";
      const meta = document.createElement("small");
      const date = new Date(project.timestamp || Date.now()).toLocaleDateString(
        "es-CL",
        { day: "numeric", month: "short" },
      );
      meta.textContent = `${project.slideCount} páginas · ${project.aspectRatioName}`;
      const saved = document.createElement("small");
      saved.className = "draft-saved-date";
      saved.textContent = `Guardado ${date}`;
      const badge = document.createElement("span");
      badge.className = "draft-badge";
      badge.textContent = "Borrador";
      thumb.appendChild(badge);
      info.append(title, meta, saved);
      card.setAttribute("aria-label", `Editar borrador: ${title.textContent}`);
      const arrow = document.createElement("span");
      arrow.className = "project-arrow";
      arrow.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M5 19l4-1L20 7l-4-4L5 14z"/></svg>';
      card.append(thumb, info, arrow);
      card.addEventListener("click", async () => {
        if (this.busy) return;
        this.busy = true;
        card.disabled = true;
        try {
          const current = await this.storage.flush();
          if (
            !current ||
            (project.id !== this.storage.projectId &&
              !this.storage.lastSaveInLibrary)
          ) {
            this.toast("No se pudo guardar el proyecto actual.");
            return;
          }
          this.app.loadingProject = true;
          this.storage.projectId = project.id;
          this.storage.projectName = project.name || "Mi carrusel";
          await this.engine.restoreProject(
            project.id === current.id ? current : project,
          );
          this.app.loadingProject = false;
          this.showEditor();
          await this.storage.flush();
        } finally {
          this.app.loadingProject = false;
          this.busy = false;
          card.disabled = false;
        }
      });
      container.appendChild(card);
    }
  }

  async renderTemplates() {
    const container = document.getElementById("home-template-list");
    for (const [id, name, description, number] of TEMPLATE_INFO) {
      const tile = document.createElement("button");
      tile.className = "template-tile";
      tile.innerHTML = `<div class="template-cover"><span class="template-number">${number} / COLLECTION</span></div><strong>${name}</strong><small>${description}</small>`;
      tile.addEventListener("click", () => this.newProject(id));
      container.appendChild(tile);
      // Render the actual template with the existing engine's object models.
      const model = {
        items: [],
        slideWidth: 1080,
        slideHeight: 1350,
        slideCount: 3,
        background: "#fff",
        get totalWidth() {
          return this.slideCount * this.slideWidth;
        },
        get totalHeight() {
          return this.slideHeight;
        },
        setAspectRatio() {},
        fitToScreen() {},
        saveHistory() {},
        addItem(item) {
          this.items.push(item);
        },
      };
      try {
        await applyTemplate(model, id);
        const preview = new CanvasExporter(model).renderThumbnail(0, 280);
        tile.querySelector(".template-cover").prepend(preview);
        this.templatePreviews.set(id, preview);
        const drawerCard = document.querySelector(
          `.mobile-template-card[data-template="${id}"]`,
        );
        if (drawerCard) {
          const copy = document.createElement("canvas");
          copy.width = preview.width;
          copy.height = preview.height;
          copy.getContext("2d").drawImage(preview, 0, 0);
          copy.className = "drawer-template-preview";
          drawerCard.prepend(copy);
        }
      } catch (error) {
        console.warn("No se pudo preparar la plantilla", error);
      }
    }
  }

  update() {
    document
      .getElementById("empty-canvas-action")
      .classList.toggle("hidden", this.engine.items.length > 0);
    clearTimeout(this.thumbnailTimer);
    this.thumbnailTimer = setTimeout(() => this.renderPages(), 160);
    this.updateActivePage();
  }

  renderPages() {
    const strip = document.getElementById("page-strip");
    strip.replaceChildren();
    for (let i = 0; i < this.engine.slideCount; i++) {
      const btn = document.createElement("button");
      btn.className = "page-thumb";
      btn.setAttribute("aria-label", `Ir a página ${i + 1}`);
      btn.dataset.page = i;
      btn.appendChild(this.app.exporter.renderThumbnail(i, 64));
      const number = document.createElement("span");
      number.textContent = String(i + 1).padStart(2, "0");
      btn.appendChild(number);
      btn.addEventListener("click", () => {
        this.engine.selectItem(null);
        this.engine.focusSlide(i);
      });
      strip.appendChild(btn);
    }
    this.storage.thumbnail = this.app.exporter
      .renderThumbnail(0, 240)
      .toDataURL("image/jpeg", 0.65);
    this.updateActivePage();
  }

  updateActivePage() {
    const index = this.engine.getActiveSlideIndex();
    document.getElementById("active-page-label").textContent =
      this.engine.viewMode === "panorama"
        ? `PANORAMA · ${this.engine.slideCount} PÁGINAS`
        : `PÁGINA ${String(index + 1).padStart(2, "0")} / ${String(this.engine.slideCount).padStart(2, "0")}`;
    document.getElementById("canvas-zoom-label").textContent =
      `${Math.round(this.engine.zoom * 100)}%`;
    document.querySelectorAll(".page-thumb").forEach((btn) => {
      const active = Number(btn.dataset.page) === index;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active);
    });
  }

  renderLayers() {
    const list = document.getElementById("layers-list");
    list.replaceChildren();
    if (!this.engine.items.length) {
      list.innerHTML =
        '<p class="template-desc">Tu lienzo está en blanco. Añade una foto, un texto o un sticker para empezar.</p>';
    }
    [...this.engine.items].reverse().forEach((item, i) => {
      const btn = document.createElement("button");
      btn.className = "layer-row";
      btn.classList.toggle("active", item === this.engine.selectedItem);
      const label = document.createElement("span");
      label.textContent =
        item.text ||
        item.title ||
        (item.type === "image" ? "Fotografía" : "Sticker");
      if (item.image) {
        const img = document.createElement("img");
        img.src = item.image.src;
        img.alt = "";
        img.className = "layer-preview";
        btn.appendChild(img);
      }
      const order = document.createElement("small");
      order.textContent = `Capa ${this.engine.items.length - i}`;
      btn.append(label, order);
      btn.addEventListener("click", () => {
        this.engine.selectItem(item);
        this.engine.focusSlide(this.engine.getItemSlideIndex(item));
        this.app.openDrawer(
          "adjust",
          item.type === "text" ? "Editar texto" : "Editar elemento",
        );
      });
      list.appendChild(btn);
    });
  }
}
