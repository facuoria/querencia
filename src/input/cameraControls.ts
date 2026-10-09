import { CAMERA } from '../data/config';
import type { Camera } from '../render/camera';

const PAN_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, 1],
  KeyW: [0, 1],
  ArrowDown: [0, -1],
  KeyS: [0, -1],
  ArrowLeft: [1, 0],
  KeyA: [1, 0],
  ArrowRight: [-1, 0],
  KeyD: [-1, 0],
};

/** Paneo con clic derecho/central o espacio + clic izquierdo, zoom con la rueda y paneo con teclado. */
export class CameraControls {
  /** Última posición del puntero sobre el canvas, o null si está afuera. */
  pointer: { x: number; y: number } | null = null;

  private dragging = false;
  private spaceHeld = false;
  private lastDrag = { x: 0, y: 0 };
  private readonly keys = new Set<string>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
    private readonly onRecenter: () => void,
  ) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', () => (this.pointer = null));
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.spaceHeld = false;
    });
  }

  /** Aplica el paneo con teclado. Se llama una vez por cuadro. */
  update(deltaMs: number): void {
    let dx = 0;
    let dy = 0;
    for (const code of this.keys) {
      const dir = PAN_KEYS[code];
      if (dir) {
        dx += dir[0];
        dy += dir[1];
      }
    }
    if (dx === 0 && dy === 0) return;
    const step = (CAMERA.keyPanSpeed * deltaMs) / 1000;
    const len = Math.hypot(dx, dy);
    this.camera.panByScreen((dx / len) * step, (dy / len) * step);
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const isPanButton = e.button === 1 || e.button === 2 || (e.button === 0 && this.spaceHeld);
    if (!isPanButton) return;
    e.preventDefault();
    this.dragging = true;
    this.lastDrag = { x: e.clientX, y: e.clientY };
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.style.cursor = 'grabbing';
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!this.dragging) return;
    this.camera.panByScreen(e.clientX - this.lastDrag.x, e.clientY - this.lastDrag.y);
    this.lastDrag = { x: e.clientX, y: e.clientY };
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    this.canvas.style.cursor = this.spaceHeld ? 'grab' : '';
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const factor = e.deltaY < 0 ? CAMERA.wheelZoomStep : 1 / CAMERA.wheelZoomStep;
    this.camera.zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === 'Space') {
      this.spaceHeld = true;
      if (!this.dragging) this.canvas.style.cursor = 'grab';
      e.preventDefault();
      return;
    }
    if (e.code === 'Home') {
      this.onRecenter();
      return;
    }
    if (e.code in PAN_KEYS) {
      this.keys.add(e.code);
      e.preventDefault();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      this.spaceHeld = false;
      if (!this.dragging) this.canvas.style.cursor = '';
    }
    this.keys.delete(e.code);
  };
}
