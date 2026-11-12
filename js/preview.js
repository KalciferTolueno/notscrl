/**
 * Realistic Instagram Carousel Mobile Simulator (Mobile-First Touch Gestures)
 * Supports natural swipe inertia, slide counter, and dynamic pagination dots.
 */

export class PreviewSimulator {
  constructor(exporter, containerModal) {
    this.exporter = exporter;
    this.modal = containerModal;
    this.currentSlideIndex = 0;
    this.slideCanvases = [];
    this.isDragging = false;

    this.bindDom();
  }

  bindDom() {
    this.track = this.modal.querySelector('.ig-carousel-track');
    this.dotsContainer = this.modal.querySelector('#ig-dots-wrap') || this.modal.querySelector('.ig-carousel-dots');
    this.counter = this.modal.querySelector('#ig-slide-counter') || this.modal.querySelector('.ig-slide-counter');
    this.closeBtn = this.modal.querySelector('#btn-close-ig-preview') || this.modal.querySelector('.ig-close-btn');

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    this.bindSwipeGestures();
  }

  bindSwipeGestures() {
    const track = this.track;
    if (!track) return;

    let startX = 0;
    let deltaX = 0;
    let isSwiping = false;

    const onStart = (clientX) => {
      isSwiping = true;
      startX = clientX;
      deltaX = 0;
      track.style.transition = 'none';
    };

    const onMove = (clientX) => {
      if (!isSwiping) return;
      deltaX = clientX - startX;
      const baseOffset = -this.currentSlideIndex * 100;
      const percentOffset = (deltaX / (track.clientWidth || 360)) * 100;
      track.style.transform = `translateX(${baseOffset + percentOffset}%)`;
    };

    const onEnd = () => {
      if (!isSwiping) return;
      isSwiping = false;
      track.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)';

      const threshold = (track.clientWidth || 360) * 0.16;
      if (deltaX < -threshold && this.currentSlideIndex < this.slideCanvases.length - 1) {
        this.goToSlide(this.currentSlideIndex + 1);
      } else if (deltaX > threshold && this.currentSlideIndex > 0) {
        this.goToSlide(this.currentSlideIndex - 1);
      } else {
        this.goToSlide(this.currentSlideIndex); // Snap back
      }
    };

    // Mouse drag
    track.addEventListener('mousedown', (e) => onStart(e.clientX));
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', () => onEnd());

    // Touch swipe (Mobile native feel)
    track.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) onStart(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) onMove(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('touchend', () => onEnd());
  }

  open() {
    this.modal.classList.remove('hidden');
    this.refresh();
  }

  close() {
    this.modal.classList.add('hidden');
  }

  refresh() {
    const slides = Array.from({ length: this.exporter.engine.slideCount }, (_, index) => ({
      index: index + 1, canvas: this.exporter.renderThumbnail(index, 480)
    }));
    this.slideCanvases = slides;
    this.currentSlideIndex = 0;
    this.track.style.transform = 'translateX(0)';
    this.modal.style.setProperty('--preview-ratio', this.exporter.engine.slideWidth / this.exporter.engine.slideHeight);

    this.track.innerHTML = '';
    if (this.dotsContainer) this.dotsContainer.innerHTML = '';

    const viewport = this.modal.querySelector('.ig-mobile-viewport');
    if (viewport) {
      viewport.style.aspectRatio = `${this.exporter.engine.slideWidth} / ${this.exporter.engine.slideHeight}`;
    }

    slides.forEach((slide, idx) => {
      const slideDiv = document.createElement('div');
      slideDiv.className = 'ig-carousel-slide';
      slide.canvas.className = 'ig-slide-img';
      slideDiv.appendChild(slide.canvas);
      this.track.appendChild(slideDiv);

      if (this.dotsContainer) {
        const dot = document.createElement('button');
        dot.setAttribute('aria-label', `Ver página ${idx + 1}`);
        dot.setAttribute('aria-pressed', String(idx === 0));
        dot.className = `ig-dot ${idx === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => this.goToSlide(idx));
        this.dotsContainer.appendChild(dot);
      }
    });

    this.updateControls();
  }

  goToSlide(index) {
    const total = this.slideCanvases.length;
    this.currentSlideIndex = Math.max(0, Math.min(total - 1, index));

    this.track.style.transition = 'transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)';
    this.track.style.transform = `translateX(-${this.currentSlideIndex * 100}%)`;

    if (this.dotsContainer) {
      const dots = this.dotsContainer.querySelectorAll('.ig-dot');
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === this.currentSlideIndex);
        d.setAttribute('aria-pressed', i === this.currentSlideIndex);
      });
    }

    this.updateControls();
  }

  updateControls() {
    const total = this.slideCanvases.length;
    if (this.counter) {
      this.counter.textContent = `${this.currentSlideIndex + 1}/${total}`;
    }
  }
}
