/*
 * Copyright (C) 2025 svet589 <https://github.com/svet589>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
// ============================================================
// sticker-manager.js — ФИНАЛЬНАЯ ВЕРСИЯ
// ============================================================
const MAX_STICKER_SIZE_BYTES = 512 * 1024;
const MAX_STICKERS_PER_PACK = 100;
const MAX_PACKS = 20;

class StickerManager {
  constructor() {
    this.packs = JSON.parse(localStorage.getItem('revers_stickers') || '{}');
    this.recent = JSON.parse(localStorage.getItem('revers_recent_stickers') || '[]');
  }

  getPacks() {
    return {
      recent: { name: '⭐ Недавние', stickers: this.recent, isSystem: true },
      default: { name: '🦊 Базовые', stickers: ['👍','😂','❤️','😮','😢','🔥','🎉','💯','🤔','🥳','😎','🙏'], isSystem: true },
      ...this.packs
    };
  }

  getPackNames() {
    return Object.keys(this.packs);
  }

  getStickers(packId) {
    if (packId === 'recent') return this.recent;
    if (packId === 'default') return ['👍','😂','❤️','😮','😢','🔥','🎉','💯','🤔','🥳','😎','🙏'];
    return this.packs[packId]?.stickers || [];
  }

  createPack(name) {
    if (this.getPackNames().length >= MAX_PACKS) {
      console.warn('Достигнут лимит стикерпаков');
      return null;
    }
    const id = 'pack_' + Date.now().toString(36);
    this.packs[id] = { name, stickers: [], created: Date.now() };
    this._save();
    return id;
  }

  addSticker(packId, dataUrl, emoji = '') {
    if (packId === 'recent' || packId === 'default') return false;
    if (!this.packs[packId]) return false;
    if (this.packs[packId].stickers.length >= MAX_STICKERS_PER_PACK) {
      console.warn('Достигнут лимит стикеров в паке');
      return false;
    }

    // Проверка размера
    const estimatedSize = dataUrl.length * 0.75;
    if (estimatedSize > MAX_STICKER_SIZE_BYTES) {
      console.warn('Стикер слишком большой');
      return false;
    }

    this.packs[packId].stickers.push({
      id: 'st_' + Date.now().toString(36),
      data: dataUrl,
      emoji,
      added: Date.now()
    });
    this._save();
    return true;
  }

  addToRecent(stickerData) {
    this.recent = this.recent.filter(s => s !== stickerData);
    this.recent.unshift(stickerData);
    if (this.recent.length > 24) this.recent = this.recent.slice(0, 24);
    localStorage.setItem('revers_recent_stickers', JSON.stringify(this.recent));
  }

  deletePack(packId) {
    if (packId === 'recent' || packId === 'default') return;
    delete this.packs[packId];
    // Удаляем стикеры этого пака из недавних
    this.recent = this.recent.filter(s => {
      if (typeof s === 'object' && s.packId === packId) return false;
      return true;
    });
    localStorage.setItem('revers_recent_stickers', JSON.stringify(this.recent));
    this._save();
  }

  _save() {
    try {
      localStorage.setItem('revers_stickers', JSON.stringify(this.packs));
    } catch (e) {}
  }
}

export default new StickerManager();
