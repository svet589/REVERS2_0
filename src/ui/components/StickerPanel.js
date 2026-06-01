// src/ui/components/StickerPanel.js — панель стикеров
import { createElement, clearElement } from '../../utils/dom.js';

export class StickerPanel {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.activePack = 'recent';
    this.container = document.getElementById('stickerPanel');
    this.tabsContainer = document.getElementById('stickerTabs');
    this.gridContainer = document.getElementById('stickerGrid');
    this.actionsContainer = document.getElementById('stickerPackActions');
    this.visible = false;
  }

  toggle() {
    this.visible = !this.visible;
    this.container.classList.toggle('hidden', !this.visible);
    if (this.visible) {
      this.eventBus.emit('getStickerPacks');
    }
  }

  show() {
    this.visible = true;
    this.container.classList.remove('hidden');
    this.eventBus.emit('getStickerPacks');
  }

  hide() {
    this.visible = false;
    this.container.classList.add('hidden');
  }

  renderPacks(packs) {
    clearElement(this.tabsContainer);

    Object.entries(packs).forEach(([id, pack]) => {
      const tab = createElement('div', {
        className: `sticker-tab ${this.activePack === id ? 'active' : ''}`,
        html: pack.name,
        onClick: () => {
          this.activePack = id;
          this.renderPacks(packs);
          this.eventBus.emit('getStickers', { packId: id });
        }
      });
      this.tabsContainer.appendChild(tab);
    });

    // Кнопка создать пак
    const addTab = createElement('div', {
      className: 'sticker-tab',
      html: '➕',
      onClick: () => this.eventBus.emit('openModal', 'createStickerPackModal')
    });
    this.tabsContainer.appendChild(addTab);

    // Загружаем стикеры активного пака
    this.eventBus.emit('getStickers', { packId: this.activePack });
  }

  renderStickers(packId, stickers) {
    clearElement(this.gridContainer);

    stickers.forEach(sticker => {
      const item = createElement('div', { className: 'sticker-item' });

      if (typeof sticker === 'object' && sticker.data) {
        item.innerHTML = `<img src="${sticker.data}" style="width:80px;height:80px;object-fit:contain;">`;
      } else {
        item.textContent = typeof sticker === 'string' ? sticker : sticker.emoji || '🖼️';
        item.style.fontSize = '2.5rem';
      }

      item.addEventListener('click', () => {
        const stickerData = typeof sticker === 'string' ? sticker : sticker.data || sticker.emoji;
        this.eventBus.emit('addToRecent', { stickerData });
        this.eventBus.emit('sendSticker', { sticker: stickerData });
        this.hide();
      });

      this.gridContainer.appendChild(item);
    });

    // Кнопки управления паком (для пользовательских паков)
    const isUserPack = packId !== 'recent' && packId !== 'default';
    this.actionsContainer.classList.toggle('hidden', !isUserPack);
    if (isUserPack) {
      document.getElementById('addStickerToPackBtn')?.setAttribute('data-pack-id', packId);
    }
  }

  bindEvents() {
    this.eventBus.on('stickerPacks', (packs) => this.renderPacks(packs));
    this.eventBus.on('stickersLoaded', ({ packId, stickers }) => this.renderStickers(packId, stickers));
    this.eventBus.on('recentUpdated', () => {
      if (this.activePack === 'recent') {
        this.eventBus.emit('getStickers', { packId: 'recent' });
      }
    });
    this.eventBus.on('stickerPackCreated', () => this.eventBus.emit('getStickerPacks'));
  }
}
