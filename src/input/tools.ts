import type { CityState } from '../core/cityState';
import { Zone, type TileCoord } from '../core/types';
import {
  applyZone,
  buildRoad,
  demolish,
  lPath,
  planDemolish,
  planRoad,
  planZone,
  rectArea,
  type Plan,
} from '../sim/construction';

export const Tool = {
  Select: 'select',
  Road: 'road',
  Residential: 'residential',
  Commercial: 'commercial',
  Industrial: 'industrial',
  Demolish: 'demolish',
} as const;
export type Tool = (typeof Tool)[keyof typeof Tool];

const ZONE_OF_TOOL: Partial<Record<Tool, Zone>> = {
  [Tool.Residential]: Zone.Residential,
  [Tool.Commercial]: Zone.Commercial,
  [Tool.Industrial]: Zone.Industrial,
};

/**
 * Herramientas de construcción con el clic izquierdo.
 * Carretera: arrastrar traza un recorrido en L. Zonas y demoler: arrastrar marca un rectángulo.
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
    private readonly onChange: () => void,
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

  /** Zona que pinta la herramienta actual, si es una herramienta de zonas. */
  get zone(): Zone | null {
    return ZONE_OF_TOOL[this.tool] ?? null;
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
    const zone = this.zone;
    const error =
      this.tool === Tool.Road
        ? buildRoad(this.state, plan)
        : zone !== null
          ? applyZone(this.state, plan, zone)
          : demolish(this.state, plan);
    if (error) this.onError(error);
    else this.onChange();
  }

  private makePlan(from: TileCoord, to: TileCoord): Plan {
    if (this.tool === Tool.Road) return planRoad(this.state, lPath(from, to));
    const zone = this.zone;
    if (zone !== null) return planZone(this.state, rectArea(from, to), zone);
    return planDemolish(this.state, rectArea(from, to));
  }
}
