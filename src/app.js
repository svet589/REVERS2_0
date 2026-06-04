/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of REVERS Messenger.
 *
 * REVERS Messenger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * REVERS Messenger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with REVERS Messenger. If not, see <https://www.gnu.org/licenses/>.
 *
 * Copyright (C) 2025 svet589 <https://github.com/svet589>
 */
// src/app.js — точка входа REVERS Messenger v3.2
// Лицензия: GNU GPL v3
// Разработчик: https://github.com/svet589

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
import { THEMES } from './utils/constants.js';
import { $ } from './utils/dom.js';
import identity from './core/identity.js';
import swarmManager from './core/swarm-manager.js';

class REVERSApp {
  constructor() {
    this.eventBus = new EventBus();
    this.screens = {};
    this.modals = {};
    this.currentScreen = null;
    this._bindGlobalEvents();
    this._init();
  }

  async _init() {
    await identity.ready();
    await swarmManager.start();

    initMessageHandlers(this.eventBus);
    initCallHandlers(this.eventBus);
    initGroupHandlers(this.eventBus);
    initStickerHandlers(this.eventBus);
    initFileHandlers(this.eventBus);
    initPollHandlers(this.eventBus);
    initProfileHandlers(this.eventBus);

    this.screens.chats = new ChatsScreen(this.eventBus);
    this.screens.chat = new ChatScreen(this.eventBus);
    this.screens.topics = new TopicsScreen(this.eventBus);
    this.screens.profile = new ProfileScreen(this.eventBus);
    this.screens.sidebar = new Sidebar(this.eventBus);

    this.modals.group = new GroupModal(this.eventBus);
    this.modals.settings = new SettingsModal(this.eventBus);
    this.modals.qr = new QrModal(this.eventBus);
    this.modals.scanner = new ScannerModal(this.eventBus);
    this.modals.giftShop = new GiftShopModal(this.eventBus);

    this.screens.sidebar.render();
    this.modals.group.render();
    this.modals.settings.render();
    this.modals.qr.render();
    this.modals.scanner.render();
    this.modals.giftShop.render();

    this.eventBus.on('navigate:chats', () => this._showScreen('chats'));
    this.eventBus.on('navigate:chat', (chat) => this._showChat(chat));
    this.eventBus.on('navigate:topics', (group) => this._showTopics(group));
    this.eventBus.on('navigate:topic', ({ groupId, topicId, topicName }) => this._showTopic(groupId, topicId, topicName));
    this.eventBus.on('navigate:profile', (userId) => this._showProfile(userId));
    this.eventBus.on('openModal', (modalId) => this._openModal(modalId));
    this.eventBus.on('openBrowser', () => this._openBrowser());

    this._applyTheme();
    this._updateDHTStatus();
    setInterval(() => this._updateDHTStatus(), 10000);

    this._showScreen('chats');

    window.REVERSApp = this;
    console.log('🚀 REVERS Messenger v3.2 запущен');
  }

  _bindGlobalEvents() {
    $('#menuBtn')?.addEventListener('click', () => this.screens.sidebar?.open());
    $('#overlay')?.addEventListener('click', () => this.screens.sidebar?.close());
    $('#backBtn')?.addEventListener('click', () => this.eventBus.emit('navigate:chats'));
    $('#chatMenuBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.eventBus.emit('toggleChatMenu');
    });

    $('#searchChatsBtn')?.addEventListener('click', () => {
      $('#searchChatsBar')?.classList.toggle('hidden');
      $('#searchChatsInput')?.focus();
    });
    $('#searchChatsCloseBtn')?.addEventListener('click', () => {
      $('#searchChatsBar')?.classList.add('hidden');
      const input = $('#searchChatsInput');
      if (input) input.value = '';
      this.eventBus.emit('getAllChats');
    });
    $('#searchChatsInput')?.addEventListener('input', (e) => {
      this.eventBus.emit('searchChats', { query: e.target.value });
    });

    $('#addContactBtn')?.addEventListener('click', () => this.eventBus.emit('openModal', 'addContactModal'));

    $('#sendBtn')?.addEventListener('click', () => {
      const text = $('#messageInput')?.value?.trim();
      if (!text) return;
      this.eventBus.emit('sendCurrentMessage', { text });
      $('#messageInput').value = '';
    });
    $('#messageInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const text = e.target.value?.trim();
        if (!text) return;
        this.eventBus.emit('sendCurrentMessage', { text });
        e.target.value = '';
      }
    });

    $('#stickerToggleBtn')?.addEventListener('click', () => this.eventBus.emit('toggleStickers'));
    $('#voiceRecordBtn')?.addEventListener('click', () => this.eventBus.emit('toggleVoiceRecord'));

    $('#fileInput')?.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        this.eventBus.emit('sendFile', { file: e.target.files[0] });
        e.target.value = '';
      }
    });

    $('#replyBarClose')?.addEventListener('click', () => $('#replyBar')?.classList.add('hidden'));
    $('#unpinBtn')?.addEventListener('click', () => this.eventBus.emit('unpinMessage'));

    document.querySelectorAll('[id$="Btn"]').forEach(btn => {
      if (btn.id.startsWith('close') || btn.id.startsWith('cancel')) {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        });
      }
    });

    document.addEventListener('click', () => {
      document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden'));
    });

    $('#imageViewer')?.addEventListener('click', () => $('#imageViewer')?.classList.remove('active'));

    console.log('🔘 Глобальные события привязаны');
  }

  _showScreen(name) {
    Object.values(this.screens).forEach(s => s?.hide?.());
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
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
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      this.screens.sidebar?.close();
    }
  }

  async _openBrowser(url = 'https://www.startpage.com') {
    const modal = $('#browserModal');
    if (!modal) return;
    const input = $('#browserUrlInput');
    if (input) input.value = url;
    modal.classList.add('active');

    $('#browserGoBtn')?.addEventListener('click', async () => {
      let u = $('#browserUrlInput')?.value?.trim();
      if (!u) return;
      if (!u.startsWith('http')) u = 'https://' + u;
      modal.classList.remove('active');
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
    if (el) el.style.color = swarmManager._started ? '#4CAF50' : '#8E8E9A';
  }

  _openLink(url) {
    this._openBrowser(url);
  }
}

document.addEventListener('DOMContentLoaded', () => new REVERSApp());
