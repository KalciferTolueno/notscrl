import { applyTemplate } from "./templates.js";
import { CanvasExporter, pageCountLabel } from "./exporter.js";

const TEMPLATE_INFO = [
  ["panorama", "Horizontes", "01"],
  ["editorial", "Formas de ver", "02"],
  ["scrapbook", "Pequeños recuerdos", "03"],
  ["filmstrip", "En analógico", "04"],
];

// Preview framing: the slide that holds each template's focal composition.
// Scrapbook's handwritten title sits on the first seam, so its preview window
// is centred on that seam instead of cutting the words at the slide edge.
const TEMPLATE_PREVIEW_SLIDE = {
  panorama: 0,
  editorial: 0,
  scrapbook: 710 / 1080,
  filmstrip: 0,
};
const PREVIEW_WIDTH = 280;
const PREVIEW_MIN_CARD = 126;
const PREVIEW_MIN_TEXT = 10;
const PREVIEW_PAD = 10;

// Renders a 4:5 cover of the template without touching how it builds projects:
// scales the headline to stay legible at the smallest card, keeps it inside the
// frame, and drops the type that cannot reach the legibility floor.
function renderTemplatePreview(model, id) {
  const index = TEMPLATE_PREVIEW_SLIDE[id] || 0;
  const windowX = index * model.slideWidth;
  const texts = model.items.filter((item) => item.type === "text");
  const title = texts.reduce(
    (lead, item) => (item.fontSize > lead.fontSize ? item : lead),
    texts[0],
  );
  const target = Math.ceil((PREVIEW_MIN_TEXT * model.slideWidth) / PREVIEW_MIN_CARD);

  if (title) {
    // Tracking tuned for slide scale would swallow the preview's margins.
    title.letterSpacing = 0;
    const probe = document.createElement("canvas").getContext("2d");
    probe.font = `${title.fontStyle} ${title.fontWeight} ${target}px ${title.fontFamily}`;
    const spacing = title.letterSpacing || 0;
    let width = 0;
    for (const line of title.text.split("\n")) {
      width = Math.max(width, probe.measureText(line).width + spacing * line.length);
    }

    const boxLeft = title.x - windowX;
    const pad = title.padding || 0;
    let start = boxLeft + pad;
    if (title.textAlign === "center") start = boxLeft + title.width / 2 - width / 2;
    else if (title.textAlign === "right") start = boxLeft + title.width - pad - width;

    const right = model.slideWidth - PREVIEW_PAD;
    const shift = Math.max(
      -Math.max(0, PREVIEW_PAD - start),
      Math.min(Math.max(0, start - PREVIEW_PAD), start + width - right),
    );
    const fitted =
      start - shift + width > right
        ? (target * (model.slideWidth - 2 * PREVIEW_PAD)) / width
        : target;

    if ((fitted * PREVIEW_MIN_CARD) / model.slideWidth < PREVIEW_MIN_TEXT) {
      model.items = model.items.filter((item) => item !== title);
    } else {
      const drawn = (width * fitted) / target;
      title.fontSize = fitted;
      if (title.textAlign === "left" && shift > 0 && drawn <= model.slideWidth - 2 * PREVIEW_PAD) {
        title.x = windowX + (model.slideWidth - drawn) / 2 - pad;
      } else {
        title.x -= shift;
      }
    }
  }

  for (const item of model.items) {
    if (item.frameStyle === "polaroid") item.caption = "";
    if (item.type === "image") item.hidePlaceholderText = true;
  }

  return new CanvasExporter(model).renderThumbnail(index, PREVIEW_WIDTH);
}

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

  toast(message, action = null) {
    const el = document.getElementById("studio-toast");
    el.replaceChildren(document.createTextNode(message));
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toast-action";
      button.textContent = action.label;
      button.addEventListener("click", () => {
        el.classList.add("hidden");
        action.run();
      });
      el.appendChild(button);
    }
    el.classList.toggle("toast-actionable", Boolean(action));
    el.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(
      () => el.classList.add("hidden"),
      action ? 6000 : 4000,
    );
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
          if (await this.storage.flush()) {
            this.toast("Borrador guardado.");
            await this.showHome("projects");
          } else
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
              ? "Borrador guardado. Está en Borradores."
              : "No se pudo guardar. Tu edición sigue abierta.",
          );
        } finally {
          button.disabled = false;
        }
      });
    document
      .getElementById("empty-canvas-action")
      .addEventListener("click", () => {
        this.app.openDrawer("photos", "Fotos");
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
      if (this.app.usesDesktopInspector()) {
        this.renderLayers();
        const row = document.querySelector("#layers-list .layer-row");
        if (row) row.focus({ preventScroll: true });
        row?.scrollIntoView({ block: "nearest" });
        return;
      }
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
          this.app.closeExportSheet();
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
    this.bindPageStrip();
    new ResizeObserver(() => {
      if (this.view === "editor") this.engine.fitForViewport();
    }).observe(this.app.workspaceEl);
  }

  bindPageStrip() {
    const strip = document.getElementById("page-strip");
    if (!strip) return;
    let drag = null;
    const finish = (commit) => {
      if (!drag) return;
      const state = drag;
      drag = null;
      clearTimeout(state.timer);
      strip.classList.remove("page-reorder-mode");
      state.thumb.classList.remove("page-reorder-active");
      strip
        .querySelectorAll(".page-reorder-target")
        .forEach((el) => el.classList.remove("page-reorder-target"));
      if (state.active) {
        try {
          state.thumb.releasePointerCapture(state.pointerId);
        } catch {
          /* The browser already released the pointer. */
        }
      }
      if (commit && state.active && state.target !== null && state.target !== state.from) {
        this.movePage(state.from, state.target);
      }
    };
    strip.addEventListener("pointerdown", (event) => {
      if (drag || event.button !== 0) return;
      const thumb = event.target.closest(".page-thumb");
      if (!thumb) return;
      const page = Number(thumb.dataset.page);
      drag = {
        thumb,
        from: page,
        target: page,
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        active: false,
        timer: null,
      };
      const activate = () => {
        if (!drag) return;
        drag.active = true;
        strip.classList.add("page-reorder-mode");
        thumb.classList.add("page-reorder-active");
        try {
          thumb.setPointerCapture(drag.pointerId);
        } catch {
          /* Pointer capture is a progressive enhancement. */
        }
      };
      // Mouse reorders on grab; touch needs a hold so a swipe still scrolls.
      if (event.pointerType === "mouse") activate();
      else drag.timer = setTimeout(activate, 320);
    });
    strip.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.active) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 8) {
          finish(false);
        }
        return;
      }
      event.preventDefault();
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest?.(".page-thumb");
      if (!target || !strip.contains(target)) return;
      const page = Number(target.dataset.page);
      if (page === drag.target) return;
      drag.target = page;
      strip.querySelectorAll(".page-thumb").forEach((el) => {
        el.classList.toggle(
          "page-reorder-target",
          Number(el.dataset.page) === page,
        );
      });
    });
    const release = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      finish(true);
    };
    strip.addEventListener("pointerup", release);
    document.addEventListener("pointerup", release);
    strip.addEventListener("pointercancel", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      finish(false);
    });
    strip.addEventListener("lostpointercapture", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      finish(false);
    });
    strip.addEventListener("contextmenu", (event) => {
      if (drag?.active) event.preventDefault();
    });
    document.addEventListener(
      "touchmove",
      (event) => {
        if (drag?.active) event.preventDefault();
      },
      { passive: false },
    );
    window.addEventListener("blur", () => finish(false));
    strip.addEventListener("keydown", (event) => {
      const thumb = event.target.closest(".page-thumb");
      if (!thumb || !event.altKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const from = Number(thumb.dataset.page);
      const to = from + (event.key === "ArrowRight" ? 1 : -1);
      if (to >= 0 && to < this.engine.slideCount) this.movePage(from, to);
    });
    strip.addEventListener("scroll", () => this.updatePageStripCue(), {
      passive: true,
    });
    window.addEventListener("resize", () => this.updatePageStripCue());
  }

  movePage(from, to) {
    if (!this.engine.moveSlide(from, to)) return false;
    this.suppressPageClick = true;
    setTimeout(() => {
      this.suppressPageClick = false;
    }, 0);
    this.renderPages();
    this.toast(`Página ${from + 1} movida a la posición ${to + 1}.`);
    document
      .querySelector(`#page-strip .page-thumb[data-page="${to}"]`)
      ?.focus({ preventScroll: true });
    return true;
  }

  setSavingStatus(state) {
    const el = document.getElementById("save-status");
    el.dataset.state = state;
    const back = document.getElementById("btn-back-home");
    if (back) back.dataset.state = state;
    el.textContent = {
      saving: "Guardando…",
      saved: "Borrador guardado",
      fallback: "Guardado solo en este proyecto",
      error: "No se pudo guardar. Revisa el espacio.",
    }[state];
  }

  async showHome(section = "home") {
    this.view = section;
    localStorage.setItem("notscrl_view", "home");
    document.getElementById("home-view").dataset.section = section;
    this.engine.enabled = false;
    document.querySelector('meta[name="theme-color"]').content = "#f5f3ee";
    document.getElementById("editor-view").classList.add("hidden");
    document.getElementById("home-view").classList.remove("hidden");
    document
      .getElementById("home-continue")
      .classList.toggle("hidden", section !== "home");
    document
      .getElementById("projects-section")
      .classList.toggle("hidden", section !== "projects");
    document
      .getElementById("templates-section")
      .classList.toggle("hidden", section !== "templates");
    document.getElementById("projects-heading").textContent =
      section === "projects" ? "Tus borradores" : "Borradores recientes";
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
    localStorage.setItem("notscrl_view", "editor");
    this.engine.enabled = true;
    document.querySelector('meta[name="theme-color"]').content = "#181917";
    document.getElementById("home-view").classList.add("hidden");
    document.getElementById("editor-view").classList.remove("hidden");
    document.getElementById("project-name").value = this.storage.projectName;
    this.engine.selectItem(null);
    this.engine.userViewMode = null;
    if (this.app.workspaceEl.getBoundingClientRect().width <= 900)
      this.engine.focusSlide(0);
    else this.engine.fitToScreen(false);
    this.renderPages();
    this.update();
    this.app.syncInspector?.(true);
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
    const shown = projects;
    if (!shown.length) {
      const empty = document.createElement("div");
      empty.className = "empty-drafts";
      empty.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 8h6m-6 4h6m-6 4h3"/></svg><strong>Todavía no hay borradores.</strong><p>Crea tu primer carrusel. Se guarda solo mientras editas.</p><button class="text-link">Crear un carrusel <span aria-hidden="true">↗</span></button>';
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
      meta.textContent = `${pageCountLabel(project.slideCount)}, ${project.aspectRatioName}`;
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
        card.disabled = true;
        try {
          await this.openProject(project);
        } finally {
          card.disabled = false;
        }
      });
      container.appendChild(card);
    }
    this.renderHomeContinue(projects);
  }

  async openProject(project) {
    if (this.busy) return false;
    this.busy = true;
    try {
      const current = await this.storage.flush();
      if (
        !current ||
        (project.id !== this.storage.projectId && !this.storage.lastSaveInLibrary)
      ) {
        this.toast("No se pudo guardar el proyecto actual.");
        return false;
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
      return true;
    } finally {
      this.app.loadingProject = false;
      this.busy = false;
    }
  }

  // Home "Continuar": portada del último borrador + tiras horizontales.
  renderHomeContinue(projects) {
    const hero = document.getElementById("home-hero");
    if (!hero) return;
    hero.replaceChildren();
    const latest = projects[0];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "hero-card";

    if (latest) {
      if (latest.thumbnail) {
        const img = document.createElement("img");
        img.src = latest.thumbnail;
        img.alt = "";
        card.appendChild(img);
      }
      const veil = document.createElement("span");
      veil.className = "hero-veil";
      const copy = document.createElement("span");
      copy.className = "hero-copy";
      const kicker = document.createElement("span");
      kicker.className = "hero-kicker";
      kicker.textContent = `Borrador del ${new Date(latest.timestamp || Date.now()).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}`;
      const title = document.createElement("span");
      title.className = "hero-title";
      title.textContent = latest.name || "Mi carrusel";
      const row = document.createElement("span");
      row.className = "hero-row";
      const facts = document.createElement("span");
      facts.className = "hero-facts";
      facts.textContent = `${pageCountLabel(latest.slideCount)}, ${latest.aspectRatioName}`;
      const go = document.createElement("span");
      go.className = "hero-go";
      go.textContent = "Seguir editando →";
      row.append(facts, go);
      copy.append(kicker, title, row);
      card.append(veil, copy);
      card.setAttribute("aria-label", `Continuar ${title.textContent}`);
      card.addEventListener("click", () => this.openProject(latest));
    } else {
      card.classList.add("hero-empty");
      const empty = document.createElement("span");
      empty.className = "hero-empty-copy";
      empty.innerHTML =
        "<b>¿Qué creamos hoy?</b><span>Toca aquí para empezar tu primer carrusel.</span>";
      card.appendChild(empty);
      card.setAttribute("aria-label", "Crear tu primer carrusel");
      card.addEventListener("click", () =>
        document.getElementById("new-project-dialog").showModal(),
      );
    }
    hero.appendChild(card);

    const rail = document.getElementById("home-draft-rail");
    if (!rail) return;
    const head = document.getElementById("home-drafts-head");
    if (head) head.classList.toggle("hidden", projects.length === 0);
    rail.classList.toggle("hidden", projects.length === 0);
    rail.replaceChildren();
    for (const project of projects.slice(0, 6)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rail-card";
      const thumb = document.createElement("span");
      thumb.className = "rail-thumb";
      if (project.thumbnail) {
        const img = document.createElement("img");
        img.src = project.thumbnail;
        img.alt = "";
        thumb.appendChild(img);
      }
      const name = document.createElement("b");
      name.textContent = project.name || "Sin título";
      const meta = document.createElement("small");
      meta.textContent = pageCountLabel(project.slideCount);
      btn.append(thumb, name, meta);
      btn.setAttribute("aria-label", `Abrir borrador ${name.textContent}`);
      btn.addEventListener("click", () => this.openProject(project));
      rail.appendChild(btn);
    }
    const create = document.createElement("button");
    create.type = "button";
    create.className = "rail-card rail-new";
    create.innerHTML =
      '<span class="rail-thumb">+</span><b>Nuevo</b><small>Carrusel</small>';
    create.addEventListener("click", () =>
      document.getElementById("new-project-dialog").showModal(),
    );
    rail.appendChild(create);
  }

  async renderTemplates() {
    const container = document.getElementById("home-template-list");
    for (const [id, name, number] of TEMPLATE_INFO) {
      const tile = document.createElement("button");
      tile.className = "template-tile";
      tile.innerHTML = `<div class="template-cover"><span class="template-number">${number} / COLECCIÓN</span></div><strong>${name}</strong>`;
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
        const preview = renderTemplatePreview(model, id);
        const cover = tile.querySelector(".template-cover");
        cover.style.background = model.background;
        cover.prepend(preview);
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
          copy.setAttribute("aria-hidden", "true");
          drawerCard.prepend(copy);
        }
      } catch (error) {
        console.warn("No se pudo preparar la plantilla", error);
      }
    }
    this.renderHomeTemplates();
  }

  // Tira de plantillas del Inicio: render real, o relleno si aún no hay.
  renderHomeTemplates() {
    const rail = document.getElementById("home-template-rail");
    if (!rail) return;
    rail.replaceChildren();
    for (const [id, name, number] of TEMPLATE_INFO) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rail-card";
      const thumb = document.createElement("span");
      thumb.className = "rail-thumb";
      const preview = this.templatePreviews.get(id);
      if (preview && preview.width) {
        const img = document.createElement("img");
        img.src = preview.toDataURL("image/jpeg", 0.82);
        img.alt = "";
        thumb.appendChild(img);
      } else {
        const placeholder = document.createElement("span");
        placeholder.className = "rail-noart";
        placeholder.textContent = number;
        thumb.appendChild(placeholder);
      }
      const label = document.createElement("b");
      label.textContent = name;
      const meta = document.createElement("small");
      meta.textContent = `Colección ${number}`;
      btn.append(thumb, label, meta);
      btn.setAttribute("aria-label", `Usar plantilla ${name}`);
      btn.addEventListener("click", () => this.newProject(id));
      rail.appendChild(btn);
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
      btn.setAttribute("aria-keyshortcuts", "Alt+ArrowLeft Alt+ArrowRight");
      btn.title = "Arrastra para mover (Alt + flechas)";
      btn.dataset.page = i;
      btn.appendChild(this.app.exporter.renderThumbnail(i, 64));
      const number = document.createElement("span");
      number.textContent = String(i + 1).padStart(2, "0");
      btn.appendChild(number);
      btn.addEventListener("click", () => {
        if (this.suppressPageClick) {
          this.suppressPageClick = false;
          return;
        }
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
    const deletePage = document.getElementById('btn-delete-page');
    deletePage.disabled = this.engine.slideCount <= 1;
    deletePage.setAttribute('aria-label', `Eliminar página ${index + 1}`);
    deletePage.title = `Eliminar página ${index + 1} y sus elementos (se puede deshacer)`;
    document.getElementById("active-page-label").textContent =
      this.engine.viewMode === "panorama"
        ? `Panorama, ${pageCountLabel(this.engine.slideCount)}`
        : `Página ${String(index + 1).padStart(2, "0")}/${String(this.engine.slideCount).padStart(2, "0")}`;
    document.getElementById("canvas-zoom-label").textContent =
      `${Math.round(this.engine.zoom * 100)}%`;
    const pageStatus = document.getElementById("page-status-pill");
    if (pageStatus) {
      const current = String(index + 1).padStart(2, "0");
      const total = String(this.engine.slideCount).padStart(2, "0");
      pageStatus.textContent = `${current}/${total} (${Math.round(this.engine.zoom * 100)}%)`;
    }
    const fitToggle = document.getElementById("btn-zoom-fit");
    const panorama = this.engine.viewMode === "panorama";
    fitToggle.classList.toggle("active", panorama);
    fitToggle.setAttribute("aria-pressed", String(panorama));
    fitToggle.title = panorama ? "Ver una página" : "Ver panorama completo";
    const strip = document.getElementById("page-strip");
    document.querySelectorAll(".page-thumb").forEach((btn) => {
      const active = Number(btn.dataset.page) === index;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active);
      if (!active) return;
      // Keep the active page thumb clear of the strip's overflow fade.
      const view = strip.getBoundingClientRect();
      const thumb = btn.getBoundingClientRect();
      const inset = 28;
      if (thumb.left < view.left + inset || thumb.right > view.right - inset) {
        strip.scrollLeft += Math.round(thumb.left - view.left - inset);
      }
    });
    this.updatePageStripCue();
  }

  updatePageStripCue() {
    const strip = document.getElementById("page-strip");
    const cue = document.getElementById("page-strip-cue");
    if (!strip || !cue) return;
    const overflow = strip.scrollWidth > strip.clientWidth + 2;
    const more =
      overflow && strip.scrollWidth - strip.clientWidth - strip.scrollLeft > 4;
    strip.classList.toggle("has-overflow", overflow);
    cue.classList.toggle("hidden", !more);
  }

  renderLayers() {
    const list = document.getElementById("layers-list");
    list.replaceChildren();
    if (!this.engine.items.length) {
      list.innerHTML =
        '<p class="template-desc">Tu lienzo está en blanco. Añade una foto, un texto o un sticker para empezar.</p>';
      return;
    }

    const toolbar = document.createElement("div");
    toolbar.className = "layers-toolbar";
    const selected = this.engine.selectedItem;
    const selectedIndex = selected ? this.engine.items.indexOf(selected) : -1;
    const move = (label, direction, disabled) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "layer-move";
      button.textContent = label;
      button.disabled = disabled;
      button.addEventListener("click", () => {
        if (!this.engine.selectedItem) return;
        if (direction > 0) this.engine.bringForward(this.engine.selectedItem);
        else this.engine.sendBackward(this.engine.selectedItem);
        this.renderLayers();
      });
      return button;
    };
    toolbar.append(
      move("Subir", 1, !selected || selectedIndex === this.engine.items.length - 1),
      move("Bajar", -1, !selected || selectedIndex === 0),
    );
    list.appendChild(toolbar);

    const order = [...this.engine.items].reverse();
    let draggedIndex = null;
    order.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "layer-row";
      row.classList.toggle("active", item === this.engine.selectedItem);
      row.classList.toggle("is-hidden", item.visible === false);
      row.draggable = true;

      const eye = document.createElement("button");
      eye.type = "button";
      eye.className = "layer-eye";
      eye.setAttribute(
        "aria-label",
        item.visible === false ? "Mostrar capa" : "Ocultar capa",
      );
      eye.setAttribute("aria-pressed", String(item.visible !== false));
      eye.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
      eye.addEventListener("click", (event) => {
        event.stopPropagation();
        item.visible = item.visible === false;
        if (!item.visible && this.engine.selectedItem === item) {
          this.engine.selectItem(null);
        }
        this.engine.triggerChange();
        this.engine.saveHistory(item.visible ? "Mostrar capa" : "Ocultar capa");
        this.renderLayers();
      });

      const select = document.createElement("button");
      select.type = "button";
      select.className = "layer-select";
      if (item.image) {
        const img = document.createElement("img");
        img.src = item.image.src;
        img.alt = "";
        img.className = "layer-preview";
        select.appendChild(img);
      }
      const label = document.createElement("span");
      label.textContent =
        item.text ||
        item.title ||
        (item.type === "image" ? "Fotografía" : "Sticker");
      const position = document.createElement("small");
      position.textContent = `Capa ${this.engine.items.length - index}`;
      select.append(label, position);
      select.addEventListener("click", () => {
        this.engine.selectItem(item);
        this.engine.focusSlide(this.engine.getItemSlideIndex(item));
        this.app.openDrawer(
          "adjust",
          item.type === "text" ? "Editar texto" : "Editar elemento",
        );
      });

      row.append(eye, select);

      row.addEventListener("dragstart", (event) => {
        draggedIndex = index;
        event.dataTransfer?.setData("text/plain", String(index));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        row.classList.add("dragging");
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        list
          .querySelectorAll(".drop-before, .drop-after")
          .forEach((el) => el.classList.remove("drop-before", "drop-after"));
      });
      row.addEventListener("dragover", (event) => {
        event.preventDefault();
        const rect = row.getBoundingClientRect();
        const after = event.clientY > rect.top + rect.height / 2;
        row.classList.toggle("drop-before", !after);
        row.classList.toggle("drop-after", after);
      });
      row.addEventListener("dragleave", () => {
        row.classList.remove("drop-before", "drop-after");
      });
      row.addEventListener("drop", (event) => {
        event.preventDefault();
        const from = draggedIndex ?? Number(event.dataTransfer?.getData("text/plain"));
        const rect = row.getBoundingClientRect();
        let to = index + (event.clientY > rect.top + rect.height / 2 ? 1 : 0);
        if (from < to) to--;
        if (!Number.isInteger(from) || from === to) {
          this.renderLayers();
          return;
        }
        const dragged = [...this.engine.items].reverse();
        const [moved] = dragged.splice(from, 1);
        dragged.splice(to, 0, moved);
        this.engine.setLayerOrder(dragged);
        this.renderLayers();
      });

      list.appendChild(row);
    });
  }
}
