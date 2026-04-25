// Drag-to-control circular pad. Works for touch, mouse, pen — uses Pointer
// Events so the same code path covers all of them. Emits normalized (x, y)
// in [-1, 1] (screen coords: x grows right, y grows down) and (0, 0) on
// release.

interface Opts {
  size?: number;                                     // outer diameter (px)
  onChange: (x: number, y: number) => void;
}

export class VirtualJoystick {
  private el: HTMLElement;
  private thumb: HTMLDivElement;
  private active = false;
  private centerX = 0;
  private centerY = 0;
  private radius: number;
  private pointerId = -1;

  /** Initialise on an existing host element (already styled in CSS). */
  constructor(host: HTMLElement, private opts: Opts) {
    this.el = host;
    const size = opts.size ?? 130;
    this.radius = size / 2;
    if (!this.el.style.width) this.el.style.width = `${size}px`;
    if (!this.el.style.height) this.el.style.height = `${size}px`;

    this.thumb = document.createElement('div');
    this.thumb.className = 'vjoy-thumb';
    this.el.appendChild(this.thumb);

    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onUp);
    // Suppress scroll/pinch when touching the pad.
    this.el.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  }

  private onDown = (e: PointerEvent): void => {
    if (this.active) return;
    e.preventDefault();
    const r = this.el.getBoundingClientRect();
    this.centerX = r.left + r.width / 2;
    this.centerY = r.top + r.height / 2;
    this.active = true;
    this.pointerId = e.pointerId;
    this.el.setPointerCapture(e.pointerId);
    this.update(e.clientX, e.clientY);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.active || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.update(e.clientX, e.clientY);
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    try { this.el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    this.active = false;
    this.pointerId = -1;
    this.thumb.style.transform = 'translate(-50%, -50%)';
    this.opts.onChange(0, 0);
  };

  private update(x: number, y: number): void {
    let dx = x - this.centerX;
    let dy = y - this.centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > this.radius) {
      dx = (dx / dist) * this.radius;
      dy = (dy / dist) * this.radius;
    }
    this.thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.opts.onChange(dx / this.radius, dy / this.radius);
  }
}
