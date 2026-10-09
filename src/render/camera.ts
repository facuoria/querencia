import type { Container } from 'pixi.js';
import { CAMERA } from '../data/config';

export interface ViewRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface ScreenSize {
  width: number;
  height: number;
}

/** Cámara escrita a mano: (x, y) es el punto del mundo en el centro de la pantalla. */
export class Camera {
  x = 0;
  y = 0;
  zoom: number = CAMERA.initialZoom;

  constructor(
    private readonly world: Container,
    private readonly screen: ScreenSize,
    private readonly bounds: ViewRect,
  ) {}

  apply(): void {
    this.clamp();
    this.world.scale.set(this.zoom);
    this.world.position.set(
      Math.round(this.screen.width / 2 - this.x * this.zoom),
      Math.round(this.screen.height / 2 - this.y * this.zoom),
    );
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.screen.width / 2) / this.zoom + this.x,
      y: (sy - this.screen.height / 2) / this.zoom + this.y,
    };
  }

  panByScreen(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  /** Zoom manteniendo fijo el punto del mundo bajo el cursor. */
  zoomAt(factor: number, sx: number, sy: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.min(CAMERA.maxZoom, Math.max(CAMERA.minZoom, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  centerOn(wx: number, wy: number): void {
    this.x = wx;
    this.y = wy;
  }

  viewRect(): ViewRect {
    const tl = this.screenToWorld(0, 0);
    const br = this.screenToWorld(this.screen.width, this.screen.height);
    return { left: tl.x, top: tl.y, right: br.x, bottom: br.y };
  }

  private clamp(): void {
    this.x = Math.min(this.bounds.right, Math.max(this.bounds.left, this.x));
    this.y = Math.min(this.bounds.bottom, Math.max(this.bounds.top, this.y));
  }
}
