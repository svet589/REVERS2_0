// src/ui/screens/ProfileScreen.js — экран профиля
import { GiftShop } from '../components/GiftShop.js';
import { GIFT_CATALOG } from '../../utils/constants.js';
import { escapeHtml, formatFullDate } from '../../utils/formatters.js';
import { createElement, clearElement, $ } from '../../utils/dom.js';

export class ProfileScreen {
  constructor(eventBus, userId = null) {
    this.eventBus = eventBus;
    this.userId = userId;
    this.isOwn = false;
    this.profile = null;
    this.diamonds = 0;
    this.gifts = [];
    this.giftShop = new GiftShop(eventBus);
    this.unsubscribers = [];
    this.container = null;
  }

  async render() {
    // Создаём контейнер если нет
    if (!this.container) {
      this.container = createElement('div', { id: 'profileScreen', className: 'screen' });
      document.getElementById('app')?.appendChild(this.container);
    }

    this.container.classList.remove('hidden');
    clearElement(this.container);

    // Загружаем профиль
    if (this.userId) {
      this.eventBus.emit('getUserProfile', { userId: this.userId });
      this.eventBus.once('userProfile', (profile) => this._renderProfile(profile));
    } else {
      this.eventBus.emit('getMyProfile');
      this.eventBus.once('myProfile', (profile) => this._renderProfile(profile, true));
    }

    this._bindEvents();
  }

  _renderProfile(profile, isOwn = false) {
    this.profile = profile;
    this.isOwn = isOwn;

    const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle fill=%22%232A2A3A%22 cx=%2250%22 cy=%2250%22 r=%2250%22/%3E%3Ctext x=%2250%22 y=%2267%22 text-anchor=%22middle%22 fill=%22%23E63946%22 font-size=%2240%22%3E🦊%3C/text%3E%3C/svg%3E';

    this.container.innerHTML = `
      <div class="profile-screen">
        <div class="profile-header">
          <button class="back-btn" id="profileBackBtn">←</button>
          <span class="profile-title">Профиль</span>
          <div></div>
        </div>
        <div class="profile-content">
          <div class="profile-avatar-section">
            <img src="${profile.avatar || defaultAvatar}" class="profile-avatar" id="profileAvatar">
            ${isOwn ? '<button class="profile-change-avatar" id="changeAvatarBtn">📷 Сменить</button>' : ''}
          </div>
          <h2 class="profile-name">${escapeHtml(profile.name || 'Пользователь')}</h2>
          <p class="profile-id">ID: ${escapeHtml(profile.id || '')}</p>
          <p class="profile-bio">${escapeHtml(profile.bio || '')}</p>
          <div class="profile-stats">
            <div class="profile-stat">
              <span class="stat-value">💎 ${this.diamonds}</span>
              <span class="stat-label">Алмазов</span>
            </div>
            <div class="profile-stat">
              <span class="stat-value">🎁 ${this.gifts.length}</span>
              <span class="stat-label">Подарков</span>
            </div>
          </div>
          <div class="profile-actions">
            ${isOwn ? `
              <button id="editBioBtn">✏️ Редактировать</button>
            ` : `
              <button id="sendGiftBtn">🎁 Подарить</button>
              <button id="writeMessageBtn">💬 Написать</button>
            `}
          </div>
          <div class="profile-gifts-section">
            <h3>🎁 Подарки</h3>
            <div class="profile-gifts-grid" id="profileGiftsGrid">
              ${this.gifts.length === 0 ? '<p style="color:#8E8E9A;text-align:center;">Нет подарков</p>' : ''}
            </div>
          </div>
        </div>
        <div id="giftShopContainer" class="gift-shop-container hidden"></div>
      </div>
    `;

    // Рендерим подарки
    if (this.gifts.length > 0) {
      this._renderGifts();
    }

    // Обработчики
    this._bindProfileEvents(isOwn);
  }

  _bindProfileEvents(isOwn) {
    $('#profileBackBtn')?.addEventListener('click', () => this.hide());

    if (isOwn) {
      $('#changeAvatarBtn')?.addEventListener('click', () => {
        const input = createElement('input', { type: 'file', accept: 'image/*' });
        input.addEventListener('change', (e) => {
          if (e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              $('#profileAvatar').src = ev.target.result;
              this.eventBus.emit('updateMyProfile', { avatar: ev.target.result });
            };
            reader.readAsDataURL(e.target.files[0]);
          }
        });
        input.click();
      });

      $('#editBioBtn')?.addEventListener('click', () => {
        const newBio = prompt('О себе:', this.profile?.bio || '');
        if (newBio !== null) {
          this.eventBus.emit('updateMyProfile', { bio: newBio });
          const bioEl = this.container?.querySelector('.profile-bio');
          if (bioEl) bioEl.textContent = newBio;
        }
      });
    } else {
      $('#sendGiftBtn')?.addEventListener('click', () => {
        this._showGiftShop();
      });

      $('#writeMessageBtn')?.addEventListener('click', () => {
        this.eventBus.emit('navigate:chat', {
          id: this.profile?.id,
          type: 'contact',
          name: this.profile?.name || this.profile?.id
        });
      });
    }
  }

  _renderGifts() {
    const grid = $('#profileGiftsGrid');
    if (!grid) return;

    clearElement(grid);

    this.gifts.forEach(gift => {
      const item = createElement('div', {
        className: 'profile-gift-item',
        style: 'text-align:center;padding:8px;'
      });
      item.innerHTML = `
        <div style="font-size:2rem;">${gift.gift?.emoji || '🎁'}</div>
        <div style="color:#EFEFEF;font-size:0.7rem;">${escapeHtml(gift.gift?.name || '')}</div>
        <div style="color:#8E8E9A;font-size:0.6rem;">от ${escapeHtml(gift.fromName || gift.from || '')}</div>
        <div style="color:#6C6C7A;font-size:0.55rem;">${formatFullDate(gift.time)}</div>
      `;
      grid.appendChild(item);
    });
  }

  _showGiftShop() {
    const container = $('#giftShopContainer');
    if (!container) return;

    container.classList.remove('hidden');
    this.giftShop.show(container);
  }

  _bindEvents() {
    this.unsubscribers.push(
      this.eventBus.on('diamonds', (amount) => {
        this.diamonds = amount;
        this.giftShop.setDiamonds(amount);
      }),
      this.eventBus.on('diamondsSpent', ({ remaining }) => {
        this.diamonds = remaining;
        this.giftShop.setDiamonds(remaining);
      }),
      this.eventBus.on('giftSent', () => this.hide()),
      this.eventBus.on('myGifts', (gifts) => {
        this.gifts = gifts;
      })
    );
  }

  show() {
    if (this.isOwn) {
      this.eventBus.emit('getDiamonds');
      this.eventBus.emit('getMyGifts');
    }
    this.render();
  }

  hide() {
    this.container?.classList.add('hidden');
    this.giftShop.hide();
  }

  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.container?.remove();
  }
      }
