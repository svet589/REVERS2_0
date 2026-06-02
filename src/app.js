// src/app.js — точка входа REVERS Messenger v3.2
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

import { EventBus } from './handlers/eventBus.js';
import { initMessageHandlers } from './handlers/messageHandlers.js';
import { initCallHandlers } from './handlers/callHandlers.js';
import { initGroupHandlers } from './handlers/groupHandlers.js';
import { initStickerHandlers } from './handlers/stickerHandlers.js';
import { initFileHandlers } from './handlers/fileHandlers.js';
import { initPollHandlers } from './handlers/pollHandlers.js';
import { initProfileHandlers } from './handlers/profileHandlers.js';
import { ChatsScreen } from './ui/screens/ChatsScreen.js';
import { ChatScreen } from './ui/screens/ChatScreen.js';
import { TopicsScreen } from './ui/screens/TopicsScreen.js';
import { ProfileScreen } from './ui/screens/ProfileScreen.js';
import { Sidebar } from './ui/screens/Sidebar.js';
import { GroupModal } from './ui/modals/GroupModal.js';
import { SettingsModal } from './ui/modals/SettingsModal.js';
import { QrModal } from './ui/modals/QrModal.js';
import { ScannerModal } from './ui/modals/ScannerModal.js';
import { GiftShopModal } from './ui/modals/GiftShopModal.js';
import { THEMES, UI } from './utils/constants.js';
import { $ } from './utils/dom.js';
import identity from './core/identity.js';
import swarmManager from './core/swarm-manager.js';

class REVERSApp {
  constructor() {
    this.eventBus = new EventBus();
    this.screens = {};
    this.modals = {};
    this.currentScreen = null;
    this._init();
  }

  async _init() {
    await identity.ready();
    await swarmManager.start();

    // Инициализация обработчиков
    initMessageHandlers(this.eventBus);
    initCallHandlers(this.eventBus);
    initGroupHandlers(this.eventBus);
    initStickerHandlers(this.eventBus);
    initFileHandlers(this.eventBus);
    initPollHandlers(this.eventBus);
    initProfileHandlers(this.eventBus);

    // Инициализация экранов
    this.screens.chats = new ChatsScreen(this.eventBus);
    this.screens.chat = new ChatScreen(this.eventBus);
    this.screens.topics = new TopicsScreen(this.eventBus);
    this.screens.profile = new ProfileScreen(this.eventBus);
    this.screens.sidebar = new Sidebar(this.eventBus);

    // Инициализация модалок
    this.modals.group = new GroupModal(this.eventBus);
    this.modals.settings = new SettingsModal(this.eventBus);
    this.modals.qr = new QrModal(this.eventBus);
    this.modals.scanner = new ScannerModal(this.eventBus);
    this.modals.giftShop = new GiftShopModal(this.eventBus);

    // Рендер бокового меню и модалок
    this.screens.sidebar.render();
    this.modals.group.render();
    this.modals.settings.render();
    this.modals.qr.render();
    this.modals.scanner.render();
    this.modals.giftShop.render();

    // Навигация
    this.eventBus.on('navigate:chats', () => this._showScreen('chats'));
    this.eventBus.on('navigate:chat', (chat) => this._showChat(chat));
    this.eventBus.on('navigate:topics', (group) => this._showTopics(group));
    this.eventBus.on('navigate:topic', ({ groupId, topicId, topicName }) => this._showTopic(groupId, topicId, topicName));
    this.eventBus.on('navigate:profile', (userId) => this._showProfile(userId));
    this.eventBus.on('openModal', (modalId) => this._openModal(modalId));
    this.eventBus.on('openBrowser', () => this._openBrowser());

    // Применяем тему
    this._applyTheme();

    // DHT статус
    this._updateDHTStatus();
    setInterval(() => this._updateDHTStatus(), 10000);

    // СТАРТОВЫЙ РЕНДЕР — ЭТО БЫЛО ПРОПУЩЕНО
    this._showScreen('chats');

    // Сохраняем ссылку для onclick
    window.REVERSApp = this;

    console.log('🚀 REVERS Messenger v3.2 запущен');
  }

  _showScreen(name) {
    // Скрываем все
    Object.values(this.screens).forEach(s => s?.hide?.());
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));

    // Показываем нужный
    const screen = this.screens[name];
    if (screen) {
      screen.show();
      this.currentScreen = name;
    }
  }

  _showChat(chat) {
    this._showScreen('chat');
    this.screens.chat.render(chat);
  }

  _showTopics(group) {
    this._showScreen('topics');
    this.screens.topics.render(group);
  }

  _showTopic(groupId, topicId, topicName) {
    // Возвращаемся в чат и загружаем сообщения темы
    const chat = { id: groupId, type: 'group', name: topicName };
    this.screens.chat._currentTopic = topicId;
    this._showChat(chat);
  }

  _showProfile(userId = null) {
    this.screens.profile = new ProfileScreen(this.eventBus, userId);
    this.screens.profile.render();
    this.screens.profile.show();
  }

  _openModal(modalId) {
    // Закрываем все модалки
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));

    // Открываем нужную
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      this.screens.sidebar?.close();
    }
  }

  async _openBrowser(url = 'https://www.startpage.com') {
    const browserModal = $('#browserModal');
    if (!browserModal) return;

    const input = $('#browserUrlInput');
    if (input) input.value = url;

    browserModal.classList.add('active');

    $('#browserGoBtn')?.addEventListener('click', async () => {
      let u = $('#browserUrlInput')?.value?.trim();
      if (!u) return;
      if (!u.startsWith('http')) u = 'https://' + u;
      browserModal.classList.remove('active');

      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: u });
      } catch(e) {
        window.open(u, '_system');
      }
    }, { once: true });
  }

  _applyTheme() {
    const themeId = localStorage.getItem('revers_theme') || 'default';
    const theme = THEMES[themeId];
    if (theme) {
      document.body.style.backgroundColor = theme.bg;
      document.documentElement.style.setProperty('--accent', theme.accent);
    }
  }

  _updateDHTStatus() {
    const el = $('#dhtStatus');
    if (el) {
      el.style.color = swarmManager._started ? '#4CAF50' : '#8E8E9A';
    }
  }

  // Публичный метод для ссылок из сообщений
  _openLink(url) {
    this._openBrowser(url);
  }
}

document.addEventListener('DOMContentLoaded', () => new REVERSApp());
