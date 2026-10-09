import type { CityState } from '../core/cityState';
import { TIME } from '../data/config';

export interface GameDate {
  day: number;
  /** 0 a 11. */
  month: number;
  year: number;
}

export function dateOf(totalDays: number): GameDate {
  const day = (totalDays % TIME.daysPerMonth) + 1;
  const months = Math.floor(totalDays / TIME.daysPerMonth);
  return { day, month: months % TIME.monthsPerYear, year: Math.floor(months / TIME.monthsPerYear) + 1 };
}

/** Reloj de juego en tiempo real, con pausa y velocidades. */
export class GameClock {
  /** Índice dentro de TIME.speeds. 0 es pausa. */
  speedIndex: number = TIME.initialSpeed;
  private lastSpeed: number = TIME.initialSpeed;
  private accumulated = 0;

  constructor(private readonly state: CityState) {}

  get paused(): boolean {
    return this.speedIndex === 0;
  }

  setSpeed(index: number): void {
    if (index < 0 || index >= TIME.speeds.length) return;
    this.speedIndex = index;
    if (index > 0) this.lastSpeed = index;
  }

  togglePause(): void {
    this.setSpeed(this.paused ? this.lastSpeed : 0);
  }

  /** Avanza el reloj. Devuelve cuántos días nuevos pasaron. */
  update(deltaMs: number): number {
    const mult = TIME.speeds[this.speedIndex] ?? 0;
    this.accumulated += deltaMs * mult;
    let days = 0;
    while (this.accumulated >= TIME.msPerDay) {
      this.accumulated -= TIME.msPerDay;
      this.state.day++;
      days++;
    }
    return days;
  }
}
