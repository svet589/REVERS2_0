// app.js — точка входа UI

import REVERS from './core/p2p-engine.js';
import './styles.css';

class REVERSApp {
  constructor() {
    this.currentChat = null;
    this.replyTo = null;
    this._pendingSignals = new Map();
    
    this._buildDOM();
    this._bindEvents();
    REVERS.onReady(() => this._onReady());
    REVERS.init();
  }

  _buildDOM() {
    const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle fill=%22%232A2A3A%22 cx=%2250%22 cy=%2250%22 r=%2250%22/%3E%3Ctext x=%2250%22 y=%2267%22 text-anchor=%22middle%22 fill=%22%23E63946%22 font-size=%2240%22%3E🦊%3C/text%3E%3C/svg%3E';
    
    document.getElementById('app').innerHTML = `
      <div class="app-header"><h1>REVERS</h1></div>
      
      <div id="chatsScreen" class="screen">
        <div class="chats-header">
          <button class="menu-btn" id="menuBtn">☰</button>
          <div class="chats-title">Чаты</div>
        </div>
        <div class="chats-list" id="chatsList"></div>
      </div>
      
      <div id="chatScreen" class="screen hidden">
        <div class="chat-header">
          <button class="back-btn" id="backBtn">←</button>
          <span class="current-chat-name" id="chatName">Чат</span>
          <div class="chat-actions">
            <button class="action-icon" id="connectPeerBtn" title="Подключиться">🔗</button>
            <button class="action-icon" id="stickerToggleBtn" title="Стикеры">😊</button>
            <button class="action-icon" id="callBtn" title="Видеозвонок">📹</button>
            <button class="action-icon" id="audioCallBtn" title="Аудиозвонок">📞</button>
            <button class="delete-chat-btn" id="deleteChatBtn" title="Удалить">🗑️</button>
          </div>
          <div class="connection-status">
            <div class="status-led" id="statusLed"></div>
            <span id="statusText">Оффлайн</span>
          </div>
        </div>
        
        <div class="sticker-panel" id="stickerPanel">
          <div class="sticker">👍</div><div class="sticker">😂</div><div class="sticker">❤️</div>
          <div class="sticker">😮</div><div class="sticker">😢</div><div class="sticker">🔥</div>
          <div class="sticker">🎉</div><div class="sticker">💯</div><div class="sticker">🤔</div>
          <div class="sticker">🥳</div><div class="sticker">😎</div><div class="sticker">🙏</div>
        </div>
        
        <div class="messages-area" id="messagesArea"></div>
        
        <div class="input-panel">
          <div class="message-input-wrapper">
            <input type="text" class="message-input" id="messageInput" placeholder="Сообщение...">
            <label class="file-label" for="fileInput">📎</label>
            <input type="file" id="fileInput">
            <button class="send-btn" id="sendBtn">➤</button>
          </div>
        </div>
      </div>
      
      <div class="sidebar" id="sidebar">
        <div class="sidebar-header">REVERS</div>
        <div class="sidebar-menu">
          <button class="menu-item" id="savedMenuBtn">📔 Сохранённые</button>
          <button class="menu-item" id="accountMenuBtn">👤 Аккаунт</button>
          <button class="menu-item" id="groupsMenuBtn">👥 Группы</button>
          <button class="menu-item" id="channelsMenuBtn">📢 Каналы</button>
          <button class="menu-item" id="settingsMenuBtn">⚙️ Настройки</button>
        </div>
      </div>
      <div class="overlay" id="overlay"></div>
      
      <div class="modal" id="connectModal">
        <h3>🔗 Подключиться</h3>
        <input type="text" id="peerIdInput" placeholder="ID собеседника">
        <input type="text" id="signalInput" placeholder="Или вставьте сигнал (JSON)">
        <button id="connectSendBtn">Подключиться</button>
        <div style="text-align:center; margin-top:8px;">
          <small style="color:#8E8E9A">Мой сигнал для отправки:</small>
          <textarea id="mySignalOutput" readonly style="width:100%; height:60px; background:#0F0F12; color:#2A9D8F; border:none; border-radius:12px; padding:8px; font-size:0.65rem; resize:none; margin-top:4px;"></textarea>
          <button id="copySignalBtn" class="secondary" style="margin-top:4px;">📋 Копировать сигнал</button>
        </div>
        <button id="closeConnectBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="accountModal">
        <h3>Аккаунт</h3>
        <div style="text-align:center">
          <img id="modalAvatar" class="avatar-modal-img" src="${REVERS.getMyProfile().avatar || defaultAvatar}">
          <button id="changeAvatarBtn" class="secondary" style="margin-top:8px;">Сменить аватар</button>
          <input type="file" id="modalAvatarInput" accept="image/*" style="display:none">
        </div>
        <div style="text-align:center; word-break:break-all;">
          <small style="color:#8E8E9A">Мой ID:</small>
          <div style="color:white; font-family:monospace; font-size:0.7rem;" id="myIdDisplay">${REVERS.getMyId()}</div>
          <button id="copyIdBtn" class="secondary" style="margin-top:4px;">📋 Копировать</button>
        </div>
        <input type="text" id="nicknameInput" placeholder="Имя..." value="${REVERS.getMyProfile().name}">
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
        <div class="setting-row"><span class="setting-label">🌓 Тёмная тема</span><div id="themeToggle" class="toggle-switch active"></div></div>
        <div class="setting-row"><span class="setting-label">🔊 Звук</span><div id="soundToggle" class="toggle-switch active"></div></div>
        <button id="closeSettingsBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="image-viewer" id="imageViewer"><img id="fullscreenImage" src=""></div>
    `;
  }

  _bindEvents() {
    document.getElementById('menuBtn').addEventListener('click', () => this._toggleSidebar(true));
    document.getElementById('overlay').addEventListener('click', () => this._toggleSidebar(false));
    document.getElementById('backBtn').addEventListener('click', () => this._goToChats());
    
    // Сообщения
    document.getElementById('sendBtn').addEventListener('click', () => this._sendMessage());
    document.getElementById('messageInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._sendMessage();
    });
    document.getElementById('fileInput').addEventListener('change', (e) => {
      if (e.target.files[0]) this._sendFile(e.target.files[0]);
    });
    
    // Стикеры
    document.getElementById('stickerToggleBtn').addEventListener('click', () => {
      document.getElementById('stickerPanel').classList.toggle('active');
    });
    document.querySelectorAll('.sticker').forEach(el => {
      el.addEventListener('click', () => this._sendSticker(el.textContent));
    });
    
    // Подключение
    document.getElementById('connectPeerBtn').addEventListener('click', () => this._openConnectModal());
    document.getElementById('connectSendBtn').addEventListener('click', () => this._handleConnect());
    document.getElementById('copySignalBtn').addEventListener('click', () => {
      const text = document.getElementById('mySignalOutput').value;
      if (text) {
        navigator.clipboard.writeText(text);
        alert('Сигнал скопирован! Отправьте его собеседнику.');
      }
    });
    
    // Звонки
    document.getElementById('callBtn').addEventListener('click', () => {
      if (this.currentChat) REVERS.startCall(this.currentChat.id, true);
    });
    document.getElementById('audioCallBtn').addEventListener('click', () => {
      if (this.currentChat) REVERS.startCall(this.currentChat.id, false);
    });
    
    // Удаление
    document.getElementById('deleteChatBtn').addEventListener('click', () => this._deleteCurrentChat());
    
    // Меню
    document.getElementById('savedMenuBtn').addEventListener('click', () => {
      this._toggleSidebar(false);
      this._openChat({ id: 'me', type: 'saved', name: '📔 Сохранённые' });
    });
    document.getElementById('accountMenuBtn').addEventListener('click', () => this._openModal('accountModal'));
    document.getElementById('groupsMenuBtn').addEventListener('click', () => {
      this._renderGroupsList();
      this._openModal('groupsModal');
    });
    document.getElementById('channelsMenuBtn').addEventListener('click', () => {
      this._renderChannelsList();
      this._openModal('channelsModal');
    });
    document.getElementById('settingsMenuBtn').addEventListener('click', () => this._openModal('settingsModal'));
    
    // Закрытие модалок
    document.querySelectorAll('[id$="Btn"]').forEach(btn => {
      if (btn.id.startsWith('close') || btn.id.startsWith('cancel')) {
        btn.addEventListener('click', () => this._closeAllModals());
      }
    });
    
    // Аккаунт
    document.getElementById('saveAccountBtn').addEventListener('click', () => {
      const name = document.getElementById('nicknameInput').value.trim();
      if (name) REVERS.setName(name);
      this._closeAllModals();
    });
    document.getElementById('changeAvatarBtn').addEventListener('click', () => {
      document.getElementById('modalAvatarInput').click();
    });
    document.getElementById('modalAvatarInput').addEventListener('change', (e) => {
      if (e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          REVERS.setAvatar(ev.target.result);
          document.getElementById('modalAvatar').src = ev.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });
    document.getElementById('copyIdBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(REVERS.getMyId());
      alert('ID скопирован!');
    });
    
    // Группы
    document.getElementById('createGroupBtn').addEventListener('click', () => this._openModal('createGroupModal'));
    document.getElementById('confirmGroupBtn').addEventListener('click', () => this._createGroup());
    
    // Каналы
    document.getElementById('createChannelBtn').addEventListener('click', () => this._openModal('createChannelModal'));
    document.getElementById('confirmChannelBtn').addEventListener('click', () => this._createChannel());
    
    // Настройки
    document.getElementById('themeToggle').addEventListener('click', () => this._toggleTheme());
    document.getElementById('soundToggle').addEventListener('click', () => this._toggleSound());
    
    // Просмотр изображений
    document.getElementById('imageViewer').addEventListener('click', () => {
      document.getElementById('imageViewer').classList.remove('active');
    });
  }

  _onReady() {
    document.getElementById('myIdDisplay').textContent = REVERS.getMyId();
    
    REVERS.onMessage((msg) => {
      if (msg.type === 'p2p-signal') {
        this._handleIncomingSignal(msg);
      } else if (this.currentChat && this.currentChat.id === msg.from) {
        this._renderMessages(this.currentChat);
      }
      this._renderChatsList();
    });
    
    REVERS.onChatUpdate(() => this._renderChatsList());
    
    REVERS.onIncomingCall((data) => {
      if (confirm(`📹 Входящий ${data.video ? 'видео' : 'аудио'} звонок от ${data.peerId}. Ответить?`)) {
        REVERS.acceptCall(data.peerId, data.video).then(pc => {
          if (pc) pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
            pc.createAnswer().then(answer => {
              pc.setLocalDescription(answer);
              REVERS.sendMessage(data.peerId, JSON.stringify({
                type: 'call-signal',
                callType: 'answer',
                sdp: answer
              }));
            });
          });
        });
      }
    });
    
    REVERS.onRemoteStream(({ peerId, stream }) => {
      console.log('📹 Получен видеопоток от', peerId);
    });
    
    this._loadSettings();
    this._renderChatsList();
    this._toggleSidebar(false);
  }

  _handleIncomingSignal(msg) {
    if (msg.initiator) {
      // Это offer от инициатора — нужно принять
      this._pendingSignals.set(msg.from, msg.signal);
      document.getElementById('signalInput').value = JSON.stringify(msg.signal);
      this._openModal('connectModal');
    } else {
      // Это answer — применяем
      REVERS.applySignal(msg.from, msg.signal);
    }
  }

  _openConnectModal() {
    this._closeAllModals();
    document.getElementById('connectModal').classList.add('active');
    document.getElementById('mySignalOutput').value = '';
    
    // Создаём offer если ещё нет
    if (this.currentChat && !REVERS.isConnected(this.currentChat.id)) {
      REVERS.connectToPeer(this.currentChat.id);
    }
  }

  _handleConnect() {
    const peerId = document.getElementById('peerIdInput').value.trim();
    const signalInput = document.getElementById('signalInput').value.trim();
    
    if (peerId && signalInput) {
      try {
        const signal = JSON.parse(signalInput);
        REVERS.acceptPeer(peerId, signal);
        this._closeAllModals();
        this._updateConnectionStatus(true);
      } catch (e) {
        alert('Неверный формат сигнала');
      }
    } else if (peerId) {
      REVERS.connectToPeer(peerId);
      // Ждём сигнал
      setTimeout(() => {
        const pending = this._pendingSignals.get(peerId);
        if (pending) {
          document.getElementById('mySignalOutput').value = JSON.stringify(pending);
        }
      }, 2000);
    }
  }

  _sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text || !this.currentChat) return;
    
    let ok = false;
    if (this.currentChat.type === 'saved') {
      ok = REVERS.sendMessage('me', text);
    } else if (this.currentChat.type === 'group') {
      ok = REVERS.sendGroupMessage(this.currentChat.id, text);
    } else if (this.currentChat.type === 'channel') {
      ok = REVERS.sendChannelMessage(this.currentChat.id, text);
    } else {
      ok = REVERS.sendMessage(this.currentChat.id, text);
    }
    
    if (ok || this.currentChat.type === 'saved' || this.currentChat.type === 'group' || this.currentChat.type === 'channel') {
      this._renderMessages(this.currentChat);
      input.value = '';
      this.replyTo = null;
      this._renderChatsList();
    }
  }

  _sendFile(file) {
    if (!this.currentChat) return;
    const targetId = this.currentChat.type === 'saved' ? 'me' : this.currentChat.id;
    REVERS.sendFile(targetId, file).then(() => {
      this._renderMessages(this.currentChat);
    });
  }

  _sendSticker(emoji) {
    if (!this.currentChat) return;
    if (this.currentChat.type === 'saved') REVERS.sendMessage('me', emoji);
    else if (this.currentChat.type === 'group') REVERS.sendGroupMessage(this.currentChat.id, emoji);
    else if (this.currentChat.type === 'channel') REVERS.sendChannelMessage(this.currentChat.id, emoji);
    else REVERS.sendMessage(this.currentChat.id, emoji);
    this._renderMessages(this.currentChat);
    document.getElementById('stickerPanel').classList.remove('active');
  }

  _createGroup() {
    const name = document.getElementById('groupNameInput').value.trim();
    if (!name) return;
    const key = REVERS.createGroup(name);
    this._closeAllModals();
    this._openChat({ id: key, name: '👥 ' + name, type: 'group' });
    document.getElementById('groupNameInput').value = '';
  }

  _createChannel() {
    const name = document.getElementById('channelNameInput').value.trim();
    if (!name) return;
    const key = REVERS.createChannel(name);
    this._closeAllModals();
    this._openChat({ id: key, name: '📢 ' + name, type: 'channel' });
    document.getElementById('channelNameInput').value = '';
  }

  _openChat(chat) {
    this.currentChat = chat;
    document.getElementById('chatsScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.remove('hidden');
    document.getElementById('chatName').textContent = chat.name;
    this._updateConnectionStatus(REVERS.isConnected(chat.id));
    this._renderMessages(chat);
    this._toggleSidebar(false);
    document.getElementById('stickerPanel').classList.remove('active');
    this.replyTo = null;
  }

  _goToChats() {
    document.getElementById('chatScreen').classList.add('hidden');
    document.getElementById('chatsScreen').classList.remove('hidden');
    this.currentChat = null;
    this.replyTo = null;
    this._renderChatsList();
  }

  _renderChatsList() {
    const container = document.getElementById('chatsList');
    container.innerHTML = '';
    const chats = REVERS.getAllChats();
    if (!chats.length) {
      container.innerHTML = '<p style="color:#8E8E9A; text-align:center; padding:20px;">Нет чатов</p>';
      return;
    }
    chats.forEach(chat => {
      const div = document.createElement('div');
      div.className = 'chat-item';
      const emoji = chat.type === 'saved' ? '📔' : chat.type === 'group' ? '👥' : chat.type === 'channel' ? '📢' : '💬';
      div.innerHTML = `
        <div class="chat-avatar">${emoji}</div>
        <div class="chat-info">
          <div class="chat-name">${this._esc(chat.name)}</div>
          <div class="chat-preview">${this._esc(chat.lastMsg || '')}</div>
        </div>
        <div class="chat-time">${chat.lastTime ? new Date(chat.lastTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</div>
      `;
      div.addEventListener('click', () => this._openChat(chat));
      container.appendChild(div);
    });
  }

  _renderMessages(chat) {
    const area = document.getElementById('messagesArea');
    area.innerHTML = '';
    let history = [];
    if (chat.type === 'saved') history = REVERS.getChatHistory('me');
    else if (chat.type === 'group') history = REVERS.getGroupHistory(chat.id);
    else if (chat.type === 'channel') history = REVERS.getChannelHistory(chat.id);
    else history = REVERS.getChatHistory(chat.id);
    
    history.forEach(msg => {
      const isOutgoing = msg.from === REVERS.getMyId();
      const div = document.createElement('div');
      div.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
      let html = '<div class="bubble">';
      html += `<div class="message-text">${this._esc(msg.text || '')}</div>`;
      if (msg.type === 'file' && msg.fileName) {
        html += `<div class="file-attachment">📄 ${this._esc(msg.fileName)}</div>`;
        if (msg.fileData && msg.fileType?.startsWith('image/')) {
          html += `<img src="${msg.fileData}" class="file-preview-img" onclick="document.getElementById('fullscreenImage').src='${msg.fileData}'; document.getElementById('imageViewer').classList.add('active')">`;
        }
      }
      html += `<div class="message-time">${new Date(msg.time).toLocaleTimeString()}</div></div>`;
      div.innerHTML = html;
      if (!isOutgoing) {
        div.addEventListener('click', () => {
          this.replyTo = { text: msg.text, from: msg.from };
          document.getElementById('messageInput').focus();
        });
      }
      area.appendChild(div);
    });
    area.scrollTop = area.scrollHeight;
  }

  _renderGroupsList() {
    const container = document.getElementById('groupsList');
    container.innerHTML = '';
    const groups = REVERS.getAllChats().filter(c => c.type === 'group');
    if (!groups.length) {
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
      btn.addEventListener('click', () => { this._closeAllModals(); this._openChat(g); });
      div.appendChild(btn);
      container.appendChild(div);
    });
  }

  _renderChannelsList() {
    const container = document.getElementById('channelsList');
    container.innerHTML = '';
    const channels = REVERS.getAllChats().filter(c => c.type === 'channel');
    if (!channels.length) {
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
      btn.addEventListener('click', () => { this._closeAllModals(); this._openChat(c); });
      div.appendChild(btn);
      container.appendChild(div);
    });
  }

  _deleteCurrentChat() {
    if (!this.currentChat || this.currentChat.type === 'saved') return;
    if (confirm('Удалить этот чат?')) {
      this._goToChats();
    }
  }

  _updateConnectionStatus(connected) {
    const led = document.getElementById('statusLed');
    const text = document.getElementById('statusText');
    if (connected) {
      led.classList.add('green');
      text.textContent = 'P2P Online';
    } else {
      led.classList.remove('green');
      text.textContent = 'Оффлайн';
    }
  }

  _toggleSidebar(show) {
    document.getElementById('sidebar').classList.toggle('open', show);
    document.getElementById('overlay').classList.toggle('active', show);
  }

  _openModal(id) { this._closeAllModals(); document.getElementById(id).classList.add('active'); this._toggleSidebar(false); }
  _closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }

  _toggleTheme() {
    const toggle = document.getElementById('themeToggle');
    toggle.classList.toggle('active');
    document.body.classList.toggle('light-theme');
    localStorage.setItem('revers_dark', toggle.classList.contains('active'));
  }

  _toggleSound() {
    document.getElementById('soundToggle').classList.toggle('active');
  }

  _loadSettings() {
    if (localStorage.getItem('revers_dark') === 'false') {
      document.body.classList.add('light-theme');
      document.getElementById('themeToggle').classList.remove('active');
    }
  }

  _esc(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => new REVERSApp());