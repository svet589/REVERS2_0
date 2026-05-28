// app.js — главный файл UI, инициализация интерфейса

import REVERS from '../core/p2p-engine.js';

class REVERSApp {
  constructor() {
    this.currentChat = null;       // Текущий открытый чат
    this.currentScreen = 'chats';  // 'chats' | 'chat'
    this.replyTo = null;           // Сообщение для ответа
    this.searchResults = [];
    this.searchIndex = 0;
    
    this.init();
  }

  async init() {
    // Строим DOM
    this.buildDOM();
    
    // Ждём готовности ядра
    REVERS.onReady(() => {
      this.onEngineReady();
    });
    
    // Запускаем ядро
    await REVERS.init();
  }

  // ============ СТРУКТУРА DOM ============
  
  buildDOM() {
    const app = document.getElementById('app');
    
    app.innerHTML = `
      <div class="app-header">
        <h1>REVERS</h1>
      </div>
      
      <!-- Главный экран (чаты) -->
      <div id="chatsScreen" class="screen">
        <div class="chats-header">
          <button class="menu-btn" id="menuBtn">☰</button>
          <div class="chats-title">Чаты</div>
        </div>
        <div class="chats-list" id="chatsList"></div>
      </div>
      
      <!-- Экран чата -->
      <div id="chatScreen" class="screen hidden">
        <div class="chat-header">
          <button class="back-btn" id="backBtn">←</button>
          <span class="current-chat-name" id="chatName">Чат</span>
          <div class="chat-actions">
            <button class="action-icon" id="searchBtn" title="Поиск">🔍</button>
            <button class="action-icon" id="stickerToggleBtn" title="Стикеры">😊</button>
            <button class="action-icon" id="callBtn" title="Видеозвонок">📹</button>
            <button class="action-icon" id="audioCallBtn" title="Аудиозвонок">📞</button>
            <button class="delete-chat-btn" id="deleteChatBtn" title="Удалить чат">🗑️</button>
          </div>
          <div class="connection-status">
            <div class="status-led" id="statusLed"></div>
            <span id="statusText">Offline</span>
          </div>
        </div>
        
        <!-- Панель поиска -->
        <div class="search-bar hidden" id="searchBar">
          <input type="text" class="search-input" id="searchInput" placeholder="Поиск...">
          <span class="search-counter" id="searchCounter">0/0</span>
          <button class="action-icon" id="searchPrevBtn">⬆️</button>
          <button class="action-icon" id="searchNextBtn">⬇️</button>
          <button class="action-icon" id="searchCloseBtn">✖</button>
        </div>
        
        <!-- Панель стикеров -->
        <div class="sticker-panel" id="stickerPanel">
          <div class="sticker">👍</div><div class="sticker">😂</div>
          <div class="sticker">❤️</div><div class="sticker">😮</div>
          <div class="sticker">😢</div><div class="sticker">🔥</div>
          <div class="sticker">🎉</div><div class="sticker">💯</div>
          <div class="sticker">🤔</div><div class="sticker">🥳</div>
          <div class="sticker">😎</div><div class="sticker">🙏</div>
        </div>
        
        <!-- Область сообщений -->
        <div class="messages-area" id="messagesArea"></div>
        
        <!-- Панель ввода -->
        <div class="input-panel">
          <div class="message-input-wrapper">
            <input type="text" class="message-input" id="messageInput" placeholder="Сообщение...">
            <label class="file-label" for="fileInput">📎</label>
            <input type="file" id="fileInput">
            <button class="send-btn" id="sendBtn">➤</button>
          </div>
        </div>
      </div>
      
      <!-- Боковое меню -->
      <div class="sidebar" id="sidebar">
        <div class="sidebar-header">REVERS</div>
        <div class="sidebar-menu">
          <button class="menu-item" id="accountMenuBtn">👤 Аккаунт</button>
          <button class="menu-item" id="savedMenuBtn">📔 Сохранённые</button>
          <button class="menu-item" id="groupsMenuBtn">👥 Группы</button>
          <button class="menu-item" id="channelsMenuBtn">📢 Каналы</button>
          <button class="menu-item" id="wallpaperMenuBtn">🖼️ Обои</button>
          <button class="menu-item" id="settingsMenuBtn">⚙️ Настройки</button>
        </div>
      </div>
      <div class="overlay" id="overlay"></div>
      
      <!-- Модалки -->
      <div class="modal" id="accountModal">
        <h3>Аккаунт</h3>
        <div style="text-align:center">
          <img id="modalAvatar" class="avatar-modal-img" src="">
          <button id="changeAvatarBtn" class="secondary" style="margin-top:8px;">Сменить аватар</button>
          <input type="file" id="modalAvatarInput" accept="image/*" style="display:none">
        </div>
        <div style="text-align:center; word-break:break-all;">
          <small style="color:#8E8E9A">Мой ID:</small>
          <div style="color:white; font-family:monospace; font-size:0.75rem;" id="myIdDisplay">—</div>
          <button id="copyIdBtn" class="secondary" style="margin-top:4px;">📋 Копировать</button>
        </div>
        <input type="text" id="nicknameInput" placeholder="Имя...">
        <button id="saveAccountBtn">Сохранить</button>
        <button id="closeAccountBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="groupsModal">
        <h3>👥 Группы</h3>
        <div id="groupsList"></div>
        <button id="createGroupBtn">➕ Создать группу</button>
        <button id="closeGroupsBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="createGroupModal">
        <h3>Создать группу</h3>
        <input type="text" id="groupNameInput" placeholder="Название группы">
        <button id="confirmGroupBtn">Создать</button>
        <button id="cancelGroupBtn" class="secondary">Отмена</button>
      </div>
      
      <div class="modal" id="channelsModal">
        <h3>📢 Каналы</h3>
        <div id="channelsList"></div>
        <button id="createChannelBtn">➕ Создать канал</button>
        <button id="closeChannelsBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="createChannelModal">
        <h3>Создать канал</h3>
        <input type="text" id="channelNameInput" placeholder="Название канала">
        <button id="confirmChannelBtn">Создать</button>
        <button id="cancelChannelBtn" class="secondary">Отмена</button>
      </div>
      
      <div class="modal" id="settingsModal">
        <h3>⚙️ Настройки</h3>
        <div class="setting-row">
          <span class="setting-label">🌓 Тёмная тема</span>
          <div id="themeToggle" class="toggle-switch active"></div>
        </div>
        <div class="setting-row">
          <span class="setting-label">🔊 Звук</span>
          <div id="soundToggle" class="toggle-switch active"></div>
        </div>
        <div class="setting-row">
          <span class="setting-label">🔔 Уведомления</span>
          <div id="notifToggle" class="toggle-switch active"></div>
        </div>
        <button id="closeSettingsBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="wallpaperModal">
        <h3>🖼️ Обои чата</h3>
        <div id="wallpaperList"></div>
        <button id="resetWallpaperBtn" class="secondary">Сбросить</button>
        <button id="closeWallpaperBtn" class="secondary">Закрыть</button>
      </div>
      
      <!-- Просмотр изображений -->
      <div class="image-viewer" id="imageViewer">
        <img id="fullscreenImage" src="">
      </div>
    `;

    // Привязываем события
    this.bindEvents();
  }

  // ============ ПРИВЯЗКА СОБЫТИЙ ============

  bindEvents() {
    // Навигация
    document.getElementById('menuBtn').addEventListener('click', () => this.openSidebar());
    document.getElementById('overlay').addEventListener('click', () => this.closeSidebar());
    document.getElementById('backBtn').addEventListener('click', () => this.goToChats());
    
    // Отправка сообщений
    document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
    document.getElementById('messageInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
    
    // Файлы
    document.getElementById('fileInput').addEventListener('change', (e) => {
      if (e.target.files[0]) this.sendFile(e.target.files[0]);
    });
    
    // Стикеры
    document.getElementById('stickerToggleBtn').addEventListener('click', () => {
      document.getElementById('stickerPanel').classList.toggle('active');
    });
    document.querySelectorAll('.sticker').forEach(el => {
      el.addEventListener('click', () => this.sendSticker(el.textContent));
    });
    
    // Поиск
    document.getElementById('searchBtn').addEventListener('click', () => this.toggleSearch());
    document.getElementById('searchCloseBtn').addEventListener('click', () => this.toggleSearch(false));
    
    // Звонки
    document.getElementById('callBtn').addEventListener('click', () => this.startCall(true));
    document.getElementById('audioCallBtn').addEventListener('click', () => this.startCall(false));
    
    // Удаление чата
    document.getElementById('deleteChatBtn').addEventListener('click', () => this.deleteCurrentChat());
    
    // Меню
    document.getElementById('accountMenuBtn').addEventListener('click', () => this.openModal('accountModal'));
    document.getElementById('groupsMenuBtn').addEventListener('click', () => this.openModal('groupsModal'));
    document.getElementById('channelsMenuBtn').addEventListener('click', () => this.openModal('channelsModal'));
    document.getElementById('settingsMenuBtn').addEventListener('click', () => this.openModal('settingsModal'));
    document.getElementById('wallpaperMenuBtn').addEventListener('click', () => this.openModal('wallpaperModal'));
    
    // Закрытие модалок
    document.querySelectorAll('.modal button[id$="Btn"]').forEach(btn => {
      if (btn.id.startsWith('close') || btn.id.startsWith('cancel')) {
        btn.addEventListener('click', () => this.closeAllModals());
      }
    });
    
    // Аккаунт
    document.getElementById('saveAccountBtn').addEventListener('click', () => this.saveAccount());
    document.getElementById('changeAvatarBtn').addEventListener('click', () => {
      document.getElementById('modalAvatarInput').click();
    });
    document.getElementById('modalAvatarInput').addEventListener('change', (e) => {
      if (e.target.files[0]) this.changeAvatar(e.target.files[0]);
    });
    document.getElementById('copyIdBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(REVERS.getMyId());
    });
    
    // Группы
    document.getElementById('createGroupBtn').addEventListener('click', () => this.openModal('createGroupModal'));
    document.getElementById('confirmGroupBtn').addEventListener('click', () => this.createGroup());
    
    // Каналы
    document.getElementById('createChannelBtn').addEventListener('click', () => this.openModal('createChannelModal'));
    document.getElementById('confirmChannelBtn').addEventListener('click', () => this.createChannel());
    
    // Настройки
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
    document.getElementById('soundToggle').addEventListener('click', () => this.toggleSound());
    
    // Просмотр изображений
    document.getElementById('imageViewer').addEventListener('click', () => {
      document.getElementById('imageViewer').classList.remove('active');
    });
    
    // Обои
    document.getElementById('resetWallpaperBtn').addEventListener('click', () => this.resetWallpaper());
  }

  // ============ ДВИЖОК ГОТОВ ============

  onEngineReady() {
    console.log('✅ UI подключён к REVERS Engine');
    
    // Показываем ID
    document.getElementById('myIdDisplay').textContent = REVERS.getMyId();
    
    // Загружаем аватар
    const profile = REVERS.getMyProfile();
    if (profile.avatar) {
      document.getElementById('modalAvatar').src = profile.avatar;
    }
    if (profile.name !== 'User') {
      document.getElementById('nicknameInput').value = profile.name;
    }
    
    // Обработка входящих сообщений
    REVERS.onMessage((msg) => {
      if (this.currentChat && this.currentChat.id === msg.from) {
        this.addMessageToUI(msg);
      }
      this.renderChatsList();
    });
    
    // Обновление списка чатов
    REVERS.onChatUpdate(() => {
      this.renderChatsList();
    });
    
    // Входящие звонки
    REVERS.onIncomingCall((data) => {
      if (confirm(`📹 Входящий ${data.video ? 'видео' : 'аудио'} звонок от ${data.peerId}. Ответить?`)) {
        REVERS.answerCall(data.peerId, data.video);
      }
    });
    
    // Удалённый поток
    REVERS.onRemoteStream(({ peerId, stream }) => {
      // Здесь можно показать видео в UI
      console.log('📹 Получен поток от', peerId);
    });
    
    // Загружаем настройки
    this.loadSettings();
    
    // Рендерим список чатов
    this.renderChatsList();
    
    // Загружаем обои
    this.loadWallpaper();
    
    this.closeSidebar();
  }

  // ============ НАВИГАЦИЯ ============

  openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('active');
  }

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
  }

  goToChats() {
    document.getElementById('chatScreen').classList.add('hidden');
    document.getElementById('chatsScreen').classList.remove('hidden');
    this.currentChat = null;
    this.currentScreen = 'chats';
    this.replyTo = null;
    this.renderChatsList();
  }

  openChat(chat) {
    this.currentChat = chat;
    this.currentScreen = 'chat';
    
    document.getElementById('chatsScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.remove('hidden');
    document.getElementById('chatName').textContent = chat.name;
    
    this.renderMessages(chat);
    this.closeSidebar();
    document.getElementById('searchBar').classList.add('hidden');
    document.getElementById('stickerPanel').classList.remove('active');
    this.replyTo = null;
  }

  openModal(id) {
    this.closeAllModals();
    document.getElementById(id).classList.add('active');
    this.closeSidebar();
    
    if (id === 'groupsModal') this.renderGroupsList();
    if (id === 'channelsModal') this.renderChannelsList();
  }

  closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  }

  // ============ ОТПРАВКА СООБЩЕНИЙ ============

  sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !this.currentChat) return;
    
    let success = false;
    
    if (this.currentChat.type === 'group') {
      success = REVERS.sendGroupMessage(this.currentChat.id, text);
    } else if (this.currentChat.type === 'channel') {
      success = REVERS.sendChannelMessage(this.currentChat.id, text);
    } else {
      success = REVERS.sendMessage(this.currentChat.id, text);
    }
    
    if (success) {
      this.addMessageToUI({
        from: REVERS.getMyId(),
        text,
        time: Date.now(),
        type: 'text'
      }, true);
      
      input.value = '';
      this.replyTo = null;
      this.renderChatsList();
    }
  }

  sendFile(file) {
    if (!this.currentChat) return;
    
    REVERS.sendFile(this.currentChat.id, file).then(success => {
      if (success) {
        this.addMessageToUI({
          from: REVERS.getMyId(),
          text: `📎 ${file.name}`,
          time: Date.now(),
          type: 'file',
          fileName: file.name,
          fileSize: file.size
        }, true);
      }
    });
  }

  sendSticker(emoji) {
    if (!this.currentChat) return;
    
    if (this.currentChat.type === 'group') {
      REVERS.sendGroupMessage(this.currentChat.id, emoji);
    } else if (this.currentChat.type === 'channel') {
      REVERS.sendChannelMessage(this.currentChat.id, emoji);
    } else {
      REVERS.sendMessage(this.currentChat.id, emoji);
    }
    
    this.addMessageToUI({
      from: REVERS.getMyId(),
      text: emoji,
      time: Date.now(),
      type: 'text'
    }, true);
    
    document.getElementById('stickerPanel').classList.remove('active');
  }

  // ============ ЗВОНКИ ============

  async startCall(video = true) {
    if (!this.currentChat || this.currentChat.type !== 'contact') return;
    
    const success = await REVERS.startCall(this.currentChat.id, video);
    if (!success) {
      alert('Не удалось начать звонок. Проверьте доступ к камере/микрофону.');
    }
  }

  // ============ ГРУППЫ ============

  createGroup() {
    const name = document.getElementById('groupNameInput').value.trim();
    if (!name) return;
    
    const groupKey = REVERS.createGroup(name);
    this.closeAllModals();
    this.openChat({ id: groupKey, name: `👥 ${name}`, type: 'group' });
    document.getElementById('groupNameInput').value = '';
  }

  renderGroupsList() {
    const container = document.getElementById('groupsList');
    container.innerHTML = '';
    
    const chats = REVERS.getAllChats();
    const groups = chats.filter(c => c.type === 'group');
    
    if (groups.length === 0) {
      container.innerHTML = '<p style="color:#8E8E9A; text-align:center;">Нет групп</p>';
      return;
    }
    
    groups.forEach(g => {
      const div = document.createElement('div');
      div.style.cssText = 'background:#2A2A3A; border-radius:16px; padding:12px; margin:8px 0; display:flex; justify-content:space-between; align-items:center;';
      div.innerHTML = `<strong style="color:white">${g.name}</strong>`;
      
      const btn = document.createElement('button');
      btn.textContent = 'Открыть';
      btn.style.cssText = 'background:#E63946; border:none; padding:6px 12px; border-radius:20px; color:white; cursor:pointer;';
      btn.addEventListener('click', () => {
        this.closeAllModals();
        this.openChat(g);
      });
      
      div.appendChild(btn);
      container.appendChild(div);
    });
  }

  // ============ КАНАЛЫ ============

  createChannel() {
    const name = document.getElementById('channelNameInput').value.trim();
    if (!name) return;
    
    const channelKey = REVERS.createChannel(name);
    this.closeAllModals();
    this.openChat({ id: channelKey, name: `📢 ${name}`, type: 'channel' });
    document.getElementById('channelNameInput').value = '';
  }

  renderChannelsList() {
    const container = document.getElementById('channelsList');
    container.innerHTML = '';
    
    const chats = REVERS.getAllChats();
    const channels = chats.filter(c => c.type === 'channel');
    
    if (channels.length === 0) {
      container.innerHTML = '<p style="color:#8E8E9A; text-align:center;">Нет каналов</p>';
      return;
    }
    
    channels.forEach(c => {
      const div = document.createElement('div');
      div.style.cssText = 'background:#2A2A3A; border-radius:16px; padding:12px; margin:8px 0; display:flex; justify-content:space-between; align-items:center;';
      div.innerHTML = `<strong style="color:white">${c.name}</strong>`;
      
      const btn = document.createElement('button');
      btn.textContent = 'Открыть';
      btn.style.cssText = 'background:#E63946; border:none; padding:6px 12px; border-radius:20px; color:white; cursor:pointer;';
      btn.addEventListener('click', () => {
        this.closeAllModals();
        this.openChat(c);
      });
      
      div.appendChild(btn);
      container.appendChild(div);
    });
  }

  // ============ РЕНДЕР ЧАТОВ ============

  renderChatsList() {
    const container = document.getElementById('chatsList');
    container.innerHTML = '';
    
    const chats = REVERS.getAllChats();
    
    if (chats.length === 0) {
      container.innerHTML = '<p style="color:#8E8E9A; text-align:center; padding:20px;">Нет чатов. Добавьте контакт через ID.</p>';
      return;
    }
    
    chats.forEach(chat => {
      const div = document.createElement('div');
      div.className = 'chat-item';
      
      const avatarEmoji = chat.type === 'group' ? '👥' : chat.type === 'channel' ? '📢' : '💬';
      const time = chat.lastTime ? new Date(chat.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      
      div.innerHTML = `
        <div class="chat-avatar">${avatarEmoji}</div>
        <div class="chat-info">
          <div class="chat-name">${this.escapeHtml(chat.name)}</div>
          <div class="chat-preview">${this.escapeHtml(chat.lastMsg || '')}</div>
        </div>
        <div class="chat-time">${time}</div>
        ${chat.unread ? `<div class="unread-badge">${chat.unread}</div>` : ''}
      `;
      
      div.addEventListener('click', () => this.openChat(chat));
      container.appendChild(div);
    });
  }

  renderMessages(chat) {
    const area = document.getElementById('messagesArea');
    area.innerHTML = '';
    
    let history = [];
    
    if (chat.type === 'group') {
      history = REVERS.getGroupHistory(chat.id);
    } else if (chat.type === 'channel') {
      history = REVERS.getChannelHistory(chat.id);
    } else {
      history = REVERS.getChatHistory(chat.id);
    }
    
    if (!history || history.length === 0) return;
    
    history.forEach((msg, idx) => {
      const isOutgoing = msg.from === REVERS.getMyId();
      this.renderMessage(msg, isOutgoing, idx);
    });
    
    area.scrollTop = area.scrollHeight;
  }

  renderMessage(msg, isOutgoing, idx) {
    const area = document.getElementById('messagesArea');
    
    const div = document.createElement('div');
    div.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
    div.setAttribute('data-idx', idx);
    
    let html = `<div class="bubble">`;
    
    // Ответ на сообщение
    if (this.replyTo && idx === this.replyTo.idx) {
      html += `<div class="reply-context">↩️ ${this.escapeHtml(this.replyTo.text?.substring(0, 50) || '')}</div>`;
    }
    
    // Текст
    html += `<div class="message-text">${this.escapeHtml(msg.text || '')}</div>`;
    
    // Файл
    if (msg.type === 'file' && msg.fileName) {
      html += `<div class="file-attachment">📄 ${this.escapeHtml(msg.fileName)}</div>`;
      if (msg.fileData && msg.fileType?.startsWith('image/')) {
        html += `<img src="${msg.fileData}" class="file-preview-img" onclick="document.getElementById('fullscreenImage').src='${msg.fileData}'; document.getElementById('imageViewer').classList.add('active')">`;
      }
    }
    
    // Время
    html += `<div class="message-time">${new Date(msg.time).toLocaleTimeString()}</div>`;
    html += `</div>`;
    
    div.innerHTML = html;
    
    // Клик для ответа
    if (!isOutgoing) {
      div.addEventListener('click', () => {
        this.replyTo = { text: msg.text, from: msg.from, idx };
        document.getElementById('messageInput').focus();
      });
    }
    
    area.appendChild(div);
  }

  addMessageToUI(msg, isOutgoing = false) {
    const area = document.getElementById('messagesArea');
    this.renderMessage(msg, isOutgoing, area.children.length);
    area.scrollTop = area.scrollHeight;
  }

  // ============ ПОИСК ============

  toggleSearch(show = true) {
    const bar = document.getElementById('searchBar');
    if (show) {
      bar.classList.remove('hidden');
      document.getElementById('searchInput').focus();
    } else {
      bar.classList.add('hidden');
      this.clearHighlights();
    }
  }

  clearHighlights() {
    document.querySelectorAll('.highlight').forEach(el => {
      el.outerHTML = el.textContent;
    });
  }

  // ============ АККАУНТ ============

  saveAccount() {
    const name = document.getElementById('nicknameInput').value.trim();
    if (name) {
      REVERS.setMyName(name);
    }
    this.closeAllModals();
  }

  changeAvatar(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      REVERS.setMyAvatar(base64);
      document.getElementById('modalAvatar').src = base64;
    };
    reader.readAsDataURL(file);
  }

  // ============ НАСТРОЙКИ ============

  loadSettings() {
    const darkTheme = localStorage.getItem('revers_darkTheme') !== 'false';
    const sound = localStorage.getItem('revers_sound') !== 'false';
    
    document.getElementById('themeToggle').classList.toggle('active', darkTheme);
    document.getElementById('soundToggle').classList.toggle('active', sound);
    
    if (!darkTheme) document.body.classList.add('light-theme');
  }

  toggleTheme() {
    const toggle = document.getElementById('themeToggle');
    toggle.classList.toggle('active');
    document.body.classList.toggle('light-theme');
    localStorage.setItem('revers_darkTheme', toggle.classList.contains('active'));
  }

  toggleSound() {
    const toggle = document.getElementById('soundToggle');
    toggle.classList.toggle('active');
    localStorage.setItem('revers_sound', toggle.classList.contains('active'));
  }

  // ============ ОБОИ ============

  loadWallpaper() {
    const wallpaper = localStorage.getItem('revers_wallpaper');
    if (wallpaper) {
      document.getElementById('messagesArea').style.backgroundImage = `url('${wallpaper}')`;
    }
  }

  resetWallpaper() {
    localStorage.removeItem('revers_wallpaper');
    document.getElementById('messagesArea').style.backgroundImage = 'none';
    this.closeAllModals();
  }

  // ============ УДАЛЕНИЕ ЧАТА ============

  deleteCurrentChat() {
    if (!this.currentChat) return;
    if (confirm('Удалить этот чат?')) {
      // Удаляем из localStorage
      const data = JSON.parse(localStorage.getItem('revers_messages') || '{}');
      if (data.chats) {
        data.chats = data.chats.filter(([id]) => id !== this.currentChat.id);
        localStorage.setItem('revers_messages', JSON.stringify(data));
      }
      this.goToChats();
    }
  }

  // ============ ХЕЛПЕРЫ ============

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
  new REVERSApp();
});
