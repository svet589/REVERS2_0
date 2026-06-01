// src/ui/components/GiftShop.js — магазин подарков
import { GIFT_CATALOG } from '../../utils/constants.js';
import { escapeHtml } from '../../utils/formatters.js';
import { createElement, clearElement } from '../../utils/dom.js';

export class GiftShop {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.container = null;
    this.diamonds = 0;
    this.selectedGift = null;
  }

  render(container) {
    this.container = container;
    clearElement(container);

    // Заголовок
    const header = createElement('div', {
      style: 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #1E1E24;'
    });
    header.innerHTML = `
      <h3 style="color:white;margin:0;">🎁 Магазин подарков</h3>
      <span id="giftShopDiamonds" style="color:#FFD700;font-weight:bold;">💎 ${this.diamonds}</span>
    `;
    container.appendChild(header);

    // Категории
    const categories = [...new Set(GIFT_CATALOG.map(g => g.category))];
    const tabs = createElement('div', {
      className: 'sticker-tabs',
      style: 'padding:8px 16px;'
    });

    categories.forEach((cat, i) => {
      const tab = createElement('div', {
        className: `sticker-tab ${i === 0 ? 'active' : ''}`,
        html: cat,
        onClick: () => {
          tabs.querySelectorAll('.sticker-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this._renderCategory(cat);
        }
      });
      tabs.appendChild(tab);
    });
    container.appendChild(tabs);

    // Сетка подарков
    const grid = createElement('div', {
      id: 'giftGrid',
      style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:16px;overflow-y:auto;'
    });
    container.appendChild(grid);

    // Показываем первую категорию
    if (categories.length > 0) {
      this._renderCategory(categories[0]);
    }

    // Кнопка отправить
    const sendBtn = createElement('button', {
      id: 'sendGiftBtn',
      html: '🎁 Отправить подарок',
      disabled: true,
      style: 'background:#E63946;border:none;padding:12px;border-radius:12px;color:white;font-weight:bold;cursor:pointer;margin:0 16px 16px;width:calc(100% - 32px);',
      onClick: () => this._sendGift()
    });
    container.appendChild(sendBtn);
  }

  _renderCategory(category) {
    const grid = document.getElementById('giftGrid');
    if (!grid) return;

    clearElement(grid);
    const items = GIFT_CATALOG.filter(g => g.category === category);

    items.forEach(gift => {
      const item = createElement('div', {
        className: 'gift-item',
        style: 'background:#1A1A23;border-radius:16px;padding:12px;text-align:center;cursor:pointer;transition:0.15s;border:2px solid transparent;',
        onClick: () => this._selectGift(gift, item)
      });

      item.innerHTML = `
        <div style="font-size:2.5rem;">${gift.emoji}</div>
        <div style="color:#EFEFEF;font-size:0.8rem;margin-top:4px;">${escapeHtml(gift.name)}</div>
        <div style="color:#FFD700;font-size:0.7rem;">💎 ${gift.price}</div>
      `;

      grid.appendChild(item);
    });
  }

  _selectGift(gift, element) {
    // Снимаем выделение со всех
    document.querySelectorAll('.gift-item').forEach(el => {
      el.style.borderColor = 'transparent';
    });

    // Выделяем выбранный
    element.style.borderColor = '#E63946';
    this.selectedGift = gift;

    // Активируем кнопку
    const sendBtn = document.getElementById('sendGiftBtn');
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = `🎁 Отправить ${gift.name} (💎${gift.price})`;
    }
  }

  _sendGift() {
    if (!this.selectedGift) return;

    if (this.diamonds < this.selectedGift.price) {
      alert(`Недостаточно алмазов! Нужно 💎${this.selectedGift.price}, у вас 💎${this.diamonds}`);
      return;
    }

    this.eventBus.emit('sendGift', { gift: this.selectedGift });
    this.eventBus.emit('spendDiamonds', { amount: this.selectedGift.price });
    this.hide();
  }

  setDiamonds(amount) {
    this.diamonds = amount;
    const el = document.getElementById('giftShopDiamonds');
    if (el) el.textContent = `💎 ${amount}`;
  }

  show(container) {
    this.render(container);
    this.eventBus.emit('getDiamonds');
  }

  hide() {
    if (this.container) {
      clearElement(this.container);
    }
    this.selectedGift = null;
  }
}
