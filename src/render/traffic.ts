import { Container, Graphics, GraphicsContext, Sprite } from 'pixi.js';
import type { CityState } from '../core/cityState';
import { Road } from '../core/types';
import { TRAFFIC } from '../data/config';
import { CAR_FRAMES, CAR_MODELS } from '../data/sprites';
import type { RoadNetwork } from '../sim/network';
import { tex } from './assets';
import { tileToWorld } from './iso';

/** Un auto o un peatón que va de casilla en casilla por las calles. Es solo decorativo. */
interface Agent {
  x: number;
  y: number;
  nx: number;
  ny: number;
  /** Avance entre la casilla actual y la siguiente (0 a 1). */
  t: number;
  speed: number;
  /** Desplazamiento lateral desde el centro de la calle, en casillas. */
  offset: number;
  view: Container;
  car: boolean;
  model: string;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function frameFor(dx: number, dy: number): keyof typeof CAR_FRAMES {
  if (dx > 0) return 'SE';
  if (dx < 0) return 'NW';
  if (dy > 0) return 'SW';
  return 'NE';
}

/**
 * Autos y peatones que circulan por las calles conectadas a la autopista.
 * La cantidad sigue a la población. No afectan la simulación.
 */
export class Traffic {
  private readonly agents: Agent[] = [];
  private readonly person: GraphicsContext[];
  private visible = true;

  constructor(
    private readonly state: CityState,
    private readonly network: RoadNetwork,
    private readonly bandOf: (x: number, y: number) => Container,
    private readonly random: () => number = Math.random,
  ) {
    this.person = TRAFFIC.pedestrianColors.map((color) =>
      new GraphicsContext()
        .rect(-2.5, -11, 5, 8)
        .fill(color)
        .circle(0, -14, 3)
        .fill(0xf1c7a0)
        .rect(-2.5, -3, 2, 3)
        .rect(0.5, -3, 2, 3)
        .fill(0x2b3644),
    );
  }

  /**
   * Avanza la animación. speedFactor: multiplicador de la velocidad del juego (0 en pausa).
   * visible: si se dibujan (con el zoom muy alejado se ocultan).
   */
  update(deltaMs: number, speedFactor: number, visible = true): void {
    if (visible !== this.visible) {
      this.visible = visible;
      for (const a of this.agents) a.view.visible = visible;
    }
    this.adjustCount();
    if (speedFactor <= 0) return;
    const dt = (deltaMs / 1000) * speedFactor;
    for (let k = this.agents.length - 1; k >= 0; k--) {
      const a = this.agents[k]!;
      if (!this.isRoad(a.x, a.y) || !this.isRoad(a.nx, a.ny)) {
        this.remove(k);
        continue;
      }
      a.t += a.speed * dt;
      while (a.t >= 1) {
        a.t -= 1;
        const next = this.pickNext(a.nx, a.ny, a.x, a.y);
        a.x = a.nx;
        a.y = a.ny;
        a.nx = next[0];
        a.ny = next[1];
        this.reparent(a);
        if (a.car) this.setCarFrame(a);
      }
      this.place(a);
    }
  }

  private isRoad(x: number, y: number): boolean {
    return this.state.inBounds(x, y) && this.state.getRoad(x, y) !== Road.None;
  }

  /** Cantidad objetivo según la población; se agregan o quitan de a poco. */
  private adjustCount(): void {
    const pop = this.state.stats.population;
    const cars = Math.min(TRAFFIC.maxCars, Math.floor(pop / TRAFFIC.residentsPerCar));
    const people = Math.min(TRAFFIC.maxPedestrians, Math.floor(pop / TRAFFIC.residentsPerPedestrian));
    let nCars = 0;
    for (const a of this.agents) if (a.car) nCars++;
    const nPeople = this.agents.length - nCars;
    if (nCars < cars) this.spawn(true);
    else if (nCars > cars) this.removeOne(true);
    if (nPeople < people) this.spawn(false);
    else if (nPeople > people) this.removeOne(false);
  }

  private spawn(car: boolean): void {
    const st = this.state;
    // Hasta 20 intentos de encontrar una calle conectada al azar.
    for (let tries = 0; tries < 20; tries++) {
      const i = Math.floor(this.random() * st.roads.length);
      if (st.roads[i] === Road.None || this.network.connected[i] !== 1) continue;
      const x = i % st.size;
      const y = (i - x) / st.size;
      if (!st.isTileUnlocked(x, y) && st.roads[i] !== Road.Highway) continue;
      const next = this.pickNext(x, y, -1, -1);
      const model = CAR_MODELS[Math.floor(this.random() * CAR_MODELS.length)]!;
      const view = car
        ? new Sprite()
        : new Graphics(this.person[Math.floor(this.random() * this.person.length)]);
      const a: Agent = {
        x,
        y,
        nx: next[0],
        ny: next[1],
        t: this.random(),
        speed: (car ? TRAFFIC.carSpeed : TRAFFIC.pedestrianSpeed) * (0.8 + this.random() * 0.4),
        offset: car ? TRAFFIC.laneOffset : TRAFFIC.sidewalkOffset * (this.random() < 0.5 ? 1 : -1),
        view,
        car,
        model,
      };
      if (car) {
        (view as Sprite).anchor.set(0.5, 0.75);
        view.scale.set(TRAFFIC.carScale);
        this.setCarFrame(a);
      }
      view.visible = this.visible;
      this.agents.push(a);
      this.reparent(a);
      this.place(a);
      return;
    }
  }

  private removeOne(car: boolean): void {
    const k = this.agents.findIndex((a) => a.car === car);
    if (k >= 0) this.remove(k);
  }

  private remove(k: number): void {
    const a = this.agents[k]!;
    a.view.destroy();
    this.agents.splice(k, 1);
  }

  /** Siguiente casilla: cualquier calle vecina menos la de donde viene (salvo en una calle sin salida). */
  private pickNext(x: number, y: number, fromX: number, fromY: number): [number, number] {
    const options: Array<[number, number]> = [];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if ((nx !== fromX || ny !== fromY) && this.isRoad(nx, ny)) options.push([nx, ny]);
    }
    if (options.length === 0) return this.isRoad(fromX, fromY) ? [fromX, fromY] : [x, y];
    return options[Math.floor(this.random() * options.length)]!;
  }

  private setCarFrame(a: Agent): void {
    const frame = CAR_FRAMES[frameFor(a.nx - a.x, a.ny - a.y)];
    (a.view as Sprite).texture = tex(`${a.model}_${frame}.png`);
  }

  /** Se dibuja en la banda de la casilla más adelantada de las dos, para quedar delante de ambas. */
  private reparent(a: Agent): void {
    const front = a.x + a.y >= a.nx + a.ny ? [a.x, a.y] : [a.nx, a.ny];
    const band = this.bandOf(front[0]!, front[1]!);
    if (a.view.parent !== band) band.addChild(a.view);
  }

  private place(a: Agent): void {
    const dx = a.nx - a.x;
    const dy = a.ny - a.y;
    // A la derecha del sentido de marcha: (-dy, dx) en coordenadas de casilla.
    const ox = -dy * a.offset;
    const oy = dx * a.offset;
    const tx = a.x + 0.5 + dx * a.t + ox;
    const ty = a.y + 0.5 + dy * a.t + oy;
    const p = tileToWorld(tx, ty);
    a.view.position.set(p.x, p.y);
  }
}
