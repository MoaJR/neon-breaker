import { STORAGE_KEYS } from '../core/Config.js';

const DEFAULT_SETTINGS = { sound: true, effects: true };

/** localStorage wrapper that never throws (private mode / disabled storage). */
export class StorageService {
  constructor() {
    this.available = this.probe();
    this.memory = { best: 0, settings: { ...DEFAULT_SETTINGS } };
  }

  probe() {
    try {
      const key = '__neon_probe__';
      window.localStorage.setItem(key, '1');
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  read(key, fallback) {
    if (!this.available) return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  write(key, value) {
    if (!this.available) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota / private mode — silently ignore */
    }
  }

  getBest() {
    const value = this.read(STORAGE_KEYS.best, 0);
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
  }

  setBest(value) {
    this.write(STORAGE_KEYS.best, Math.max(0, Math.floor(value)));
  }

  getSettings() {
    const stored = this.read(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    return {
      sound: stored?.sound !== false,
      effects: stored?.effects !== false,
    };
  }

  setSettings(settings) {
    this.write(STORAGE_KEYS.settings, {
      sound: settings.sound !== false,
      effects: settings.effects !== false,
    });
  }
}
