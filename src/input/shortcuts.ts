import type { GameClock } from '../sim/clock';
import { Tool, type ToolController } from './tools';

/** Atajos de teclado para herramientas y velocidad. */
export function installShortcuts(tools: ToolController, clock: GameClock): void {
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.repeat) return;
    // Evita que Espacio vuelva a "apretar" el último botón de la interfaz que quedó con foco.
    if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
    switch (e.code) {
      case 'Space':
        clock.togglePause();
        e.preventDefault();
        break;
      case 'Digit1':
        clock.setSpeed(1);
        break;
      case 'Digit2':
        clock.setSpeed(2);
        break;
      case 'Digit3':
        clock.setSpeed(3);
        break;
      case 'KeyR':
        tools.setTool(Tool.Road);
        break;
      case 'KeyB':
        tools.setTool(Tool.Demolish);
        break;
      case 'Escape':
        tools.setTool(Tool.Select);
        break;
    }
  });
}
