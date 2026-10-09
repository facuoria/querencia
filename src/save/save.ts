import { CityState, type MonthReport, type TaxRates } from '../core/cityState';
import { SAVE } from '../data/config';

/** Versión del formato. Si cambia de forma incompatible, las partidas viejas se ignoran. */
const FORMAT_VERSION = 1;

const ARRAYS = ['terrain', 'roads', 'zones', 'buildingLevel', 'service', 'serviceLevel', 'fire', 'unlockedSectors'] as const;
type ArrayKey = (typeof ARRAYS)[number];

interface SaveData {
  version: number;
  size: number;
  savedAt: string;
  arrays: Record<ArrayKey, string>;
  money: number;
  day: number;
  taxRates: TaxRates;
  lastMonth: MonthReport | null;
  monthsNegative: number;
  sectorsBought: number;
  maxPopulation: number;
  announcedMilestone: number;
  /** Población al guardar (solo para mostrarla en la pantalla de inicio). */
  population?: number;
}

function toBase64(bytes: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

function fromBase64(text: string, into: Uint8Array): void {
  const raw = atob(text);
  if (raw.length !== into.length) throw new Error('Tamaño inesperado en la partida guardada');
  for (let i = 0; i < raw.length; i++) into[i] = raw.charCodeAt(i);
}

export function serialize(state: CityState): string {
  const arrays = {} as Record<ArrayKey, string>;
  for (const key of ARRAYS) arrays[key] = toBase64(state[key]);
  const data: SaveData = {
    version: FORMAT_VERSION,
    size: state.size,
    savedAt: new Date().toISOString(),
    arrays,
    money: state.money,
    day: state.day,
    taxRates: { ...state.taxRates },
    lastMonth: state.lastMonth,
    monthsNegative: state.monthsNegative,
    sectorsBought: state.sectorsBought,
    maxPopulation: state.maxPopulation,
    announcedMilestone: state.announcedMilestone,
    population: state.stats.population,
  };
  return JSON.stringify(data);
}

/** Arma el estado a partir de una partida guardada. Devuelve null si no se puede leer. */
export function deserialize(text: string): CityState | null {
  try {
    const data = JSON.parse(text) as SaveData;
    if (data.version !== FORMAT_VERSION) return null;
    const state = new CityState(data.size);
    for (const key of ARRAYS) fromBase64(data.arrays[key], state[key]);
    state.money = data.money;
    state.day = data.day;
    state.taxRates = { ...data.taxRates };
    state.lastMonth = data.lastMonth;
    state.monthsNegative = data.monthsNegative;
    state.sectorsBought = data.sectorsBought;
    state.maxPopulation = data.maxPopulation;
    state.announcedMilestone = data.announcedMilestone;
    state.takeChanges();
    return state;
  } catch {
    return null;
  }
}

/** Guarda en el navegador. Devuelve false si no se pudo (por ejemplo, sin espacio o en modo privado). */
export function saveGame(state: CityState): boolean {
  try {
    localStorage.setItem(SAVE.key, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): CityState | null {
  try {
    const text = localStorage.getItem(SAVE.key);
    return text ? deserialize(text) : null;
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE.key);
  } catch {
    // Sin acceso al almacenamiento: no hay nada que borrar.
  }
}

/** Datos básicos de la partida guardada, para la pantalla de inicio. */
export function saveSummary(): { savedAt: string; population: number } | null {
  try {
    const text = localStorage.getItem(SAVE.key);
    if (!text) return null;
    const data = JSON.parse(text) as SaveData;
    if (data.version !== FORMAT_VERSION) return null;
    return { savedAt: data.savedAt, population: data.population ?? data.maxPopulation };
  } catch {
    return null;
  }
}
