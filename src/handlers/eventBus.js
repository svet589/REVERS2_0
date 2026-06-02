// SPDX-License-Identifier: GPL-3.0-or-later
// src/handlers/eventBus.js — шина событий
export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    this.on(event, wrapper);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter(cb => cb !== callback));
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(cb => {
      try { cb(data); } catch (e) { console.error(`[EventBus] ${event}:`, e); }
    });
  }

  clear(event) {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }
}
