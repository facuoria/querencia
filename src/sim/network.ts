import type { CityState } from '../core/cityState';
import { Road } from '../core/types';
import { GROWTH } from '../data/config';

/**
 * Qué calles llegan a la autopista y qué casillas tienen una de esas calles cerca.
 * Se recalcula solo cuando cambia la red de calles.
 */
export class RoadNetwork {
  /** 1 si la calle de esa casilla está conectada a la autopista. */
  readonly connected: Uint8Array;
  /** Distancia (sin diagonales) a la calle conectada más cercana, o 255 si está más lejos que el límite. */
  readonly distance: Uint8Array;
  private version = -1;

  constructor(private readonly state: CityState) {
    this.connected = new Uint8Array(state.size * state.size);
    this.distance = new Uint8Array(state.size * state.size);
  }

  /** Tiene acceso: hay una calle conectada a la autopista a distancia suficiente. */
  hasAccess(x: number, y: number): boolean {
    return this.distance[this.state.index(x, y)]! <= GROWTH.accessDistance;
  }

  update(): void {
    if (this.version === this.state.roadsVersion) return;
    this.version = this.state.roadsVersion;
    const st = this.state;
    const n = st.size;
    this.connected.fill(0);
    this.distance.fill(255);

    // Recorrido por las calles desde la autopista.
    const queue: number[] = [];
    for (let i = 0; i < n * n; i++) {
      if (st.roads[i] === Road.Highway) {
        this.connected[i] = 1;
        queue.push(i);
      }
    }
    for (let h = 0; h < queue.length; h++) {
      const i = queue[h]!;
      const x = i % n;
      const y = (i - x) / n;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        if (!st.inBounds(nx, ny)) continue;
        const j = ny * n + nx;
        if (this.connected[j] || st.roads[j] === Road.None) continue;
        this.connected[j] = 1;
        queue.push(j);
      }
    }

    // Distancia desde las calles conectadas, hasta el límite de acceso.
    const front: number[] = [];
    for (let i = 0; i < n * n; i++) {
      if (this.connected[i]) {
        this.distance[i] = 0;
        front.push(i);
      }
    }
    for (let h = 0; h < front.length; h++) {
      const i = front[h]!;
      const d = this.distance[i]!;
      if (d >= GROWTH.accessDistance) continue;
      const x = i % n;
      const y = (i - x) / n;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        if (!st.inBounds(nx, ny)) continue;
        const j = ny * n + nx;
        if (this.distance[j]! <= d + 1) continue;
        this.distance[j] = d + 1;
        front.push(j);
      }
    }
  }
}
