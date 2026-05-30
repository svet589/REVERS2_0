class StickerManager {
  constructor() {
    this.packs = JSON.parse(localStorage.getItem('revers_stickers') || '{}');
    this.recent = JSON.parse(localStorage.getItem('revers_recent_stickers') || '[]');
  }

  getPacks() {
    return {
      recent: { name: '⭐ Недавние', stickers: this.recent, isSystem: true },
      default: { name: '🦊 Базовые', stickers: ['👍','😂','❤️','😮','😢','🔥','🎉','💯','🤔','🥳','😎','🐏'], isSystem: true },
      ...this.packs
    };
  }

  getStickers(packId) {
    if (packId === 'recent') return this.recent;
    if (packId === 'default') return ['👍','😂','❤️','😮','😢','🔥','🎉','💯','🤔','🥳','😎','🙏','😭','🍻'];
    return this.packs[packId]?.stickers || [];
  }

  createPack(name) {
    const id = 'pack_' + Date.now().toString(36);
    this.packs[id] = { name, stickers: [], created: Date.now() };
    this._save(); return id;
  }

  addSticker(packId, data, emoji = '') {
    if (packId === 'recent' || packId === 'default' || !this.packs[packId]) return false;
    this.packs[packId].stickers.push({ id: 'st_' + Date.now().toString(36), data, emoji, added: Date.now() });
    this._save(); return true;
  }

  addToRecent(stickerData) {
    this.recent = this.recent.filter(s => s !== stickerData);
    this.recent.unshift(stickerData);
    if (this.recent.length > 24) this.recent = this.recent.slice(0, 24);
    localStorage.setItem('revers_recent_stickers', JSON.stringify(this.recent));
  }

  deletePack(packId) {
    if (packId === 'recent' || packId === 'default') return;
    delete this.packs[packId]; this._save();
  }

  _save() { localStorage.setItem('revers_stickers', JSON.stringify(this.packs)); }
}

export default new StickerManager();
