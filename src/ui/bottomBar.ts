import type { CityState } from '../core/cityState';
import { Zone } from '../core/types';
import { COSTS } from '../data/config';
import { SERVICE_LIST } from '../data/services';
import { TEXTS } from '../data/texts';
import { Tool, type ToolController } from '../input/tools';
import { lockedMessage } from '../sim/construction';
import { isServiceUnlocked, isZoneUnlocked, serviceMilestone, zoneMilestone } from '../sim/milestones';
import { sectorCost } from '../sim/sectors';
import { icon, type IconName } from './icons';
import { formatMoney } from './topBar';
import { tooltip, type TipContent } from './tooltip';

interface Item {
  id: string;
  label: string;
  icon: IconName;
  /** Clase de color para las zonas. */
  cls?: string;
  tip: () => TipContent;
  /** Motivo del bloqueo, o null si se puede usar. */
  lockReason: () => string | null;
  isActive: () => boolean;
  activate: () => void;
}

interface ItemView {
  item: Item;
  el: HTMLButtonElement;
}

const t = TEXTS.tools;
const d = TEXTS.toolDescriptions;
const perTile = TEXTS.units.perTile;

/**
 * Barra inferior agrupada por categorías. Cada botón tiene ícono y nombre; el costo, el atajo,
 * la descripción y el motivo del bloqueo están en la ayuda emergente.
 */
export class BottomBar {
  private readonly views: ItemView[] = [];
  private last = '';

  constructor(parent: HTMLElement, tools: ToolController, state: CityState, onLocked: (reason: string) => void) {
    const zoneItem = (tool: Tool, zone: Zone, label: string, ic: IconName, cls: string, key: string, desc: string): Item => ({
      id: tool,
      label,
      icon: ic,
      cls,
      tip: () => ({ title: label, cost: `${formatMoney(COSTS.zone)} ${perTile}`, key, description: desc }),
      lockReason: () => (isZoneUnlocked(state, zone) ? null : lockedMessage(zoneMilestone(zone))),
      isActive: () => tools.tool === tool,
      activate: () => tools.setTool(tool),
    });
    const toolItem = (tool: Tool, label: string, ic: IconName, key: string, desc: string, cost?: () => string): Item => ({
      id: tool,
      label,
      icon: ic,
      tip: () => ({ title: label, cost: cost?.(), key, description: desc }),
      lockReason: () => null,
      isActive: () => tools.tool === tool,
      activate: () => tools.setTool(tool),
    });

    const groups: Array<{ title: string; items: Item[] }> = [
      {
        title: TEXTS.groups.roads,
        items: [toolItem(Tool.Road, t.road, 'route', 'R', d.road, () => `${formatMoney(COSTS.road)} ${perTile}`)],
      },
      {
        title: TEXTS.groups.zones,
        items: [
          zoneItem(Tool.Residential, Zone.Residential, t.residential, 'house', 'zone-res', 'Z', d.residential),
          zoneItem(Tool.Commercial, Zone.Commercial, t.commercial, 'store', 'zone-com', 'X', d.commercial),
          zoneItem(Tool.Industrial, Zone.Industrial, t.industrial, 'factory', 'zone-ind', 'C', d.industrial),
        ],
      },
      {
        title: TEXTS.groups.services,
        items: SERVICE_LIST.map(
          (def): Item => ({
            id: `service-${def.type}`,
            label: TEXTS.serviceShort[def.key],
            icon: def.icon,
            tip: () => ({
              title: def.name,
              cost: `${formatMoney(def.cost)} · ${TEXTS.units.upkeep} ${formatMoney(def.upkeep)}${TEXTS.units.perMonth}`,
              description: TEXTS.serviceDescriptions[def.key],
            }),
            lockReason: () => (isServiceUnlocked(state, def.type) ? null : lockedMessage(serviceMilestone(def.type))),
            isActive: () => tools.tool === Tool.Service && tools.serviceType === def.type,
            activate: () => tools.setService(def.type),
          }),
        ),
      },
      {
        title: TEXTS.groups.tools,
        items: [
          toolItem(Tool.Select, t.select, 'mouse-pointer-2', 'Esc', d.select),
          toolItem(Tool.Sector, TEXTS.sectors.tool, 'map-plus', 'T', d.sector, () => formatMoney(sectorCost(state))),
          toolItem(Tool.Demolish, t.demolish, 'trash-2', 'B', d.demolish, () => t.demolishRefund),
        ],
      },
    ];

    const bar = document.createElement('nav');
    bar.className = 'panel bottom-bar';
    bar.setAttribute('aria-label', TEXTS.groups.tools);
    for (const g of groups) {
      const section = document.createElement('section');
      section.className = 'tool-group';
      const h = document.createElement('h3');
      h.className = 'tool-group-title';
      h.textContent = g.title;
      const row = document.createElement('div');
      row.className = 'tool-group-buttons';
      for (const item of g.items) {
        const b = document.createElement('button');
        b.className = `tool-button ${item.cls ?? ''}`;
        const label = document.createElement('span');
        label.className = 'tool-label';
        label.textContent = item.label;
        const lock = icon('lock', 'sm');
        lock.classList.add('tool-lock');
        b.append(icon(item.icon, 'lg'), label, lock);
        b.addEventListener('click', () => {
          const reason = item.lockReason();
          if (reason) onLocked(reason);
          else item.activate();
        });
        tooltip.attach(b, () => ({ ...item.tip(), locked: item.lockReason() }));
        row.append(b);
        this.views.push({ item, el: b });
      }
      section.append(h, row);
      bar.append(section);
    }
    parent.append(bar);
  }

  update(): void {
    const states = this.views.map(({ item }) => `${item.isActive() ? 1 : 0}${item.lockReason() ? 1 : 0}`).join('');
    if (states === this.last) return;
    this.last = states;
    for (const { item, el } of this.views) {
      const locked = item.lockReason() !== null;
      el.classList.toggle('active', item.isActive());
      el.classList.toggle('locked', locked);
      el.setAttribute('aria-disabled', String(locked));
      el.setAttribute('aria-pressed', String(item.isActive()));
    }
  }
}
