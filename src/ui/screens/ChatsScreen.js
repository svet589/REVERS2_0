// src/ui/screens/ChatsScreen.js — экран списка чатов
import { ChatItem } from '../components/ChatItem.js';
import { FOLDERS } from '../../utils/constants.js';
import { createElement, clearElement, $ } from '../../utils/dom.js';

export class ChatsScreen {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.container = $('#chatsScreen');
    this.currentFolder = 'personal';
    this.unsubscribers = [];
  }

  render() {
    this._renderFolderTabs();
    this._bindEvents();
    this.eventBus.emit('getAllChats');
  }

  _renderFolderTabs() {
    const tabsContainer = $('#folderTabs');
    if (!tabsContainer) return;

    clearElement(tabsContainer);

    Object.entries(FOLDERS).forEach(([id, folder]) => {
      const tab = createElement('div', {
        className: `folder-tab ${this.currentFolder === id ? 'active' : ''}`,
        html: folder.name,
        onClick: () => {
          this.currentFolder = id;
          this._renderFolderTabs();
          this.eventBus.emit('getAllChats');
        }
      });
      tabsContainer.appendChild(tab);
    });
  }

  _bindEvents() {
    // Поиск
    const searchInput = $('#searchChatsInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.eventBus.emit('searchChats', { query: e.target.value });
      });
    }

    $('#searchChatsBtn')?.addEventListener('click', () => {
      const bar = $('#searchChatsBar');
      if (bar) bar.classList.toggle('hidden');
      $('#searchChatsInput')?.focus();
    });

    $('#searchChatsCloseBtn')?.addEventListener('click', () => {
      $('#searchChatsBar')?.classList.add('hidden');
      const input = $('#searchChatsInput');
      if (input) input.value = '';
      this.eventBus.emit('getAllChats');
    });

    // Кнопка добавления
    $('#addContactBtn')?.addEventListener('click', () => {
      this.eventBus.emit('openModal', 'addContactModal');
    });

    // Обновление списка чатов
    this.unsubscribers.push(
      this.eventBus.on('allChats', (chats) => this._renderChatList(chats)),
      this.eventBus.on('chatsUpdated', () => this.eventBus.emit('getAllChats')),
      this.eventBus.on('searchChats', ({ query }) => this._filterChats(query))
    );
  }

  _renderChatList(chats) {
    const list = $('#chatsList');
    if (!list) return;

    clearElement(list);

    // Фильтруем по папке
    const folder = FOLDERS[this.currentFolder];
    const filtered = chats.filter(chat => {
      if (!folder) return true;
      return folder.types.includes(chat.type) || 
        (this.currentFolder === 'personal' && (chat.type === 'contact' || chat.type === 'saved'));
    });

    if (filtered.length === 0) {
      list.appendChild(
        createElement('p', {
          style: 'color:#8E8E9A;text-align:center;padding:20px;',
          html: 'Нет чатов'
        })
      );
      return;
    }

    filtered.forEach(chat => {
      const item = new ChatItem(chat, this.eventBus);
      list.appendChild(item.render());
    });
  }

  _filterChats(query) {
    if (!query || !query.trim()) {
      this.eventBus.emit('getAllChats');
      return;
    }

    this.eventBus.once('allChats', (chats) => {
      const filtered = chats.filter(chat =>
        chat.name.toLowerCase().includes(query.toLowerCase()) ||
        (chat.lastMsg || '').toLowerCase().includes(query.toLowerCase())
      );
      this._renderChatList(filtered);
    });
    this.eventBus.emit('getAllChats');
  }

  show() {
    this.container?.classList.remove('hidden');
    this.eventBus.emit('getAllChats');
  }

  hide() {
    this.container?.classList.add('hidden');
  }

  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}
