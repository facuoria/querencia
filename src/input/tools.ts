import type { CityState } from '../core/cityState';
import { ServiceType, Zone, type TileCoord } from '../core/types';
import {
  applyZone,
  buildRoad,
  buildService,
  demolish,
  lPath,
  planDemolish,
  planRoad,
  planService,
  planZone,
  rectArea,
  type Plan,
} from '../sim/construction';
import { buySector, canBuySector, sectorCost, sectorError } from '../sim/sectors';

export const Tool = {
  Select: 'select',
  Road: 'road',
  Residential: 'residential',
  Commercial: 'commercial',
  Industrial: 'industrial',
  Service: 'service',
  Demolish: 'demolish',
  Sector: 'sector',
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
  /** Servicio que coloca la herramienta Service. */
  serviceType: Exclude<ServiceType, 0> = ServiceType.Power;
  /** Plan en curso mientras se arrastra, para la vista previa. */
  plan: Plan | null = null;
  /** Casilla elegida con la herramienta Seleccionar. */
  selected: TileCoord | null = null;
  /** Sector bajo el cursor con la herramienta de comprar terreno. */
  sector: { sx: number; sy: number; buyable: boolean } | null = null;
  private dragStart: TileCoord | null = null;
  private hover: TileCoord | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly state: CityState,
    private readonly onError: (message: string) => void,
    private readonly onChange: (tool: Tool) => void,
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

  setService(type: Exclude<ServiceType, 0>): void {
    this.serviceType = type;
    this.setTool(Tool.Service);
  }

  /** Zona que pinta la herramienta actual, si es una herramienta de zonas. */
  get zone(): Zone | null {
    return ZONE_OF_TOOL[this.tool] ?? null;
  }

  /** Se llama una vez por cuadro con la casilla bajo el cursor. */
  setHover(tile: TileCoord | null): void {
    this.hover = tile;
    if (this.tool === Tool.Sector) {
      this.sector = null;
      this.plan = null;
      if (!tile) return;
      const s = this.state.sectorOf(tile.x, tile.y);
      // Sobre un sector propio no se marca nada.
      if (this.state.isSectorUnlocked(s.x, s.y)) return;
      const error = sectorError(this.state, s.x, s.y);
      this.sector = { sx: s.x, sy: s.y, buyable: canBuySector(this.state, s.x, s.y) };
      this.plan = { tiles: [], cost: sectorCost(this.state), error };
      return;
    }
    this.sector = null;
    if (this.dragStart && tile) this.plan = this.makePlan(this.dragStart, tile);
    else if (this.tool === Tool.Service) this.plan = tile ? planService(this.state, tile, this.serviceType) : null;
  }

  cancel(): void {
    this.dragStart = null;
    this.plan = null;
  }

  private begin(): void {
    if (this.tool === Tool.Select) {
      this.selected = this.hover ? { ...this.hover } : null;
      return;
    }
    if (this.tool === Tool.Sector) {
      if (!this.sector) return;
      const error = buySector(this.state, this.sector.sx, this.sector.sy);
      if (error) this.onError(error);
      else this.onChange(this.tool);
      return;
    }
    if (!this.hover) return;
    this.dragStart = { ...this.hover };
    this.plan = this.makePlan(this.dragStart, this.hover);
  }

  private finish(): void {
    // Solo cuenta si el clic empezó sobre el mapa (no al soltar sobre un botón de la interfaz).
    if (!this.dragStart) return;
    const plan = this.plan;
    this.cancel();
    if (!plan) return;
    const error = this.apply(plan);
    if (error) this.onError(error);
    else this.onChange(this.tool);
  }

  private apply(plan: Plan): string | null {
    if (this.tool === Tool.Road) return buildRoad(this.state, plan);
    if (this.tool === Tool.Service) return buildService(this.state, plan, this.serviceType);
    const zone = this.zone;
    if (zone !== null) return applyZone(this.state, plan, zone);
    return demolish(this.state, plan);
  }

  private makePlan(from: TileCoord, to: TileCoord): Plan {
    if (this.tool === Tool.Road) return planRoad(this.state, lPath(from, to));
    if (this.tool === Tool.Service) return planService(this.state, to, this.serviceType);
    const zone = this.zone;
    if (zone !== null) return planZone(this.state, rectArea(from, to), zone);
    return planDemolish(this.state, rectArea(from, to));
  }
}
