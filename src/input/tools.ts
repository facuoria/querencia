import type { CityState } from '../core/cityState';
import type { TileCoord } from '../core/types';
import {
  buildRoad,
  demolish,
  lPath,
  planDemolish,
  planRoad,
  rectArea,
  type Plan,
} from '../sim/construction';

export const Tool = {
  Select: 'select',
  Road: 'road',
  Demolish: 'demolish',
} as const;
export type Tool = (typeof Tool)[keyof typeof Tool];

/**
 * Herramientas de construcción con el clic izquierdo.
 * Carretera: arrastrar traza un recorrido en L. Demoler: arrastrar marca un rectángulo.
 */
export class ToolController {
  tool: Tool = Tool.Select;
  /** Plan en curso mientras se arrastra, para la vista previa. */
  plan: Plan | null = null;
  private dragStart: TileCoord | null = null;
  private hover: TileCoord | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly state: CityState,
    private readonly onError: (message: string) => void,
  ) {
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this.begin();
      else if (e.button === 2) this.cancel();
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.finish();
    });
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    this.cancel();
  }

  /** Se llama una vez por cuadro con la casilla bajo el cursor. */
  setHover(tile: TileCoord | null): void {
    this.hover = tile;
    if (this.dragStart && tile) this.plan = this.makePlan(this.dragStart, tile);
  }

  cancel(): void {
    this.dragStart = null;
    this.plan = null;
  }

  private begin(): void {
    if (this.tool === Tool.Select || !this.hover) return;
    this.dragStart = { ...this.hover };
    this.plan = this.makePlan(this.dragStart, this.hover);
  }

  private finish(): void {
    const plan = this.plan;
    this.cancel();
    if (!plan) return;
    const error = this.tool === Tool.Road ? buildRoad(this.state, plan) : demolish(this.state, plan);
    if (error) this.onError(error);
  }

  private makePlan(from: TileCoord, to: TileCoord): Plan {
    return this.tool === Tool.Road
      ? planRoad(this.state, lPath(from, to))
      : planDemolish(this.state, rectArea(from, to));
  }
}
