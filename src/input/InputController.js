import { WORLD_WIDTH } from '../core/Config.js';

/** Mouse, keyboard and touch input in one place. */
export class InputController {
  constructor({ stage, canvas, engine }) {
    this.stage = stage;
    this.canvas = canvas;
    this.engine = engine;

    this.keys = new Set();
    this.pointerTarget = null;
    this.pointerDown = false;
    this.pointerType = 'mouse';
    this.mode = 'pointer';
    this.attached = false;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onContextMenu = (event) => event.preventDefault();
    this.onBlur = () => this.keys.clear();
  }

  attach() {
    if (this.attached) return;
    this.attached = true;

    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.stage.addEventListener('pointermove', this.onPointerMove, { passive: true });
    this.stage.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
    window.addEventListener('pointercancel', this.onPointerUp, { passive: true });
    this.stage.addEventListener('pointerleave', this.onPointerLeave);
    this.stage.addEventListener('contextmenu', this.onContextMenu);
    this.stage.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
  }

  worldX(clientX) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width) return null;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, ratio)) * WORLD_WIDTH;
  }

  onPointerMove(event) {
    this.pointerType = event.pointerType || 'mouse';
    if (this.pointerType !== 'mouse' && !this.pointerDown) return;
    const x = this.worldX(event.clientX);
    if (x === null) return;
    this.pointerTarget = x;
    this.mode = 'pointer';
  }

  onPointerDown(event) {
    if (event.button !== undefined && event.button > 0) return;
    const target = event.target;
    if (target && typeof target.closest === 'function' && target.closest('button, .hud, .screen, .rl-overlay')) {
      return;
    }
    this.pointerType = event.pointerType || 'mouse';
    this.pointerDown = true;
    const x = this.worldX(event.clientX);
    if (x !== null) {
      this.pointerTarget = x;
      this.mode = 'pointer';
    }
    if (typeof event.preventDefault === 'function' && this.pointerType !== 'mouse') event.preventDefault();
    this.engine.handlePrimaryAction();
  }

  onPointerUp() {
    this.pointerDown = false;
  }

  onPointerLeave() {
    if (this.pointerType === 'mouse' && !this.pointerDown) this.pointerTarget = null;
  }

  onKeyDown(event) {
    const code = event.code;

    const overlayActive = Boolean(this.engine.roguelite?.isOverlayActive?.());
    if (overlayActive) {
      if (code === 'Escape' || code === 'Enter' || code === 'Space' || /^Digit[1-3]$/.test(code) || code === 'KeyI') {
        event.preventDefault();
        this.engine.roguelite?.handleKey?.(code, event);
      }
      return;
    }

    if (code === 'KeyI' || code === 'Tab') {
      const run = this.engine.roguelite?.run;
      if (run && !run.ended) {
        event.preventDefault();
        this.engine.roguelite?.toggleInventory?.();
      }
      return;
    }

    if (event.repeat) {
      if (code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown') event.preventDefault();
      return;
    }

    if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') {
      event.preventDefault();
      this.engine.handlePrimaryAction();
      return;
    }

    if (code === 'KeyP' || code === 'Escape') {
      event.preventDefault();
      this.engine.togglePause();
      return;
    }

    if (code === 'KeyM') {
      this.engine.toggleSound();
      return;
    }

    if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD') {
      event.preventDefault();
      this.keys.add(code);
      this.mode = 'keyboard';
      return;
    }

    this.keys.add(code);
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  axis() {
    let axis = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) axis -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) axis += 1;
    return axis;
  }

  /** Touch/devices without hover should keep the last pointer target. */
  get usingPointer() {
    return this.mode === 'pointer' && this.pointerTarget !== null;
  }
}
