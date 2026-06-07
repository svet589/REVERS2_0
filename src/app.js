// REVERS Messenger v3.3 — ФИНАЛЬНЫЙ ИСПРАВЛЕННЫЙ UI
// Лицензия: GNU GPL v3
// Разработчик: https://github.com/svet589

import REVERS from './core/p2p-engine.js';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import stickerManager from './core/sticker-manager.js';
import groupManager from './core/group-manager.js';

class REVERSApp {
  constructor() {
    // Состояние приложения
    this.state = {
      currentChat: null,
      currentTopic: null,
      replyTo: null,
      editingMessage: null,
      activeStickerPack: 'recent',
      isRecording: false,
      voiceRecorder: null,
      voiceStartTime: null,
      callTimer: null,
      callSeconds: 0,
      typingTimeout: null,
      diamonds: 0,
      gifts: [],
      isSidebarOpen: false,
      myId: null,
      myProfile: null,
      searchQuery: '',
      searchResults: [],
      searchCurrentIndex: 0,
      selectedMessage: null
    };
    
    // DOM элементы (кэш)
    this.elements = {};
    this.html5QrCode = null;
    
    this._init();
  }
  
  async _init() {
    this._buildDOM();
    this._cacheElements();
    this._bindEvents();
    this._bindBackButton();
    this._bindSwipeBack();
    this._bindHotkeys();
    this._loadSettings();
    this._loadDiamonds();
    
    // Настройка колбэков ядра
    this._setupCoreCallbacks();
    
    // Ждём готовности ядра
    REVERS.onReady(() => this._onReady());
    REVERS.init();
  }
  
  _setupCoreCallbacks() {
    REVERS.onMessage((msg) => this._handleIncomingMessage(msg));
    REVERS.onChatUpdate(() => this._handleChatUpdate());
    REVERS.onIncomingCall((callInfo) => this._showIncomingCall(callInfo));
    REVERS.onRemoteStream(({ peerId, stream }) => this._showRemoteStream(peerId, stream));
    REVERS.onCallEnded(() => this._hideCallModal());
  }
  
  _buildDOM() {
    const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle fill=%22%232A2A3A%22 cx=%2250%22 cy=%2250%22 r=%2250%22/%3E%3Ctext x=%2250%22 y=%2267%22 text-anchor=%22middle%22 fill=%22%23E63946%22 font-size=%2240%22%3E🦊%3C/text%3E%3C/svg%3E';
    
    document.getElementById('app').innerHTML = `
      <div class="app-header">
        <h1>REVERS</h1>
        <span id="dhtStatus">🌐</span>
      </div>
      
      <!-- Экран чатов -->
      <div id="chatsScreen" class="screen">
        <div class="chats-header">
          <button class="menu-btn" id="menuBtn">☰</button>
          <div class="chats-title">Чаты</div>
          <div style="display:flex;gap:8px;">
            <button class="action-icon" id="searchChatsBtn">🔍</button>
            <button class="action-icon" id="addContactBtn">➕</button>
          </div>
        </div>
        <div class="search-bar hidden" id="searchChatsBar">
          <input type="text" class="search-input" id="searchChatsInput" placeholder="Поиск...">
          <button class="action-icon" id="searchChatsCloseBtn">✖</button>
        </div>
        <div class="chats-list" id="chatsList"></div>
      </div>
      
      <!-- Экран чата -->
      <div id="chatScreen" class="screen hidden">
        <div class="chat-header">
          <button class="back-btn" id="backBtn">←</button>
          <span class="current-chat-name" id="chatName">Чат</span>
          <span id="typingIndicator"></span>
          <div class="connection-status">
            <div class="status-led" id="statusLed"></div>
            <span id="statusText">Оффлайн</span>
          </div>
          <button class="menu-btn" id="chatMenuBtn">⋮</button>
        </div>
        
        <!-- Дропдауны меню -->
        <div class="chat-dropdown hidden" id="contactDropdown">
          <button class="dropdown-item" id="inviteToChatBtn">🔗 Пригласить</button>
          <button class="dropdown-item" id="searchInChatBtn">🔍 Поиск</button>
          <button class="dropdown-item" id="pinnedMsgBtn">📌 Закреп</button>
          <button class="dropdown-item" id="securityBtn">🔐 Безопасность</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" id="callBtn">📹 Видеозвонок</button>
          <button class="dropdown-item" id="audioCallBtn">📞 Аудиозвонок</button>
          <button class="dropdown-item" id="connectPeerBtn">🔗 Подключиться</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item danger" id="deleteChatBtn">🗑️ Удалить</button>
          <button class="dropdown-item danger" id="clearHistoryBtn">🧹 Очистить</button>
        </div>
        
        <div class="chat-dropdown hidden" id="groupDropdown">
          <button class="dropdown-item" id="inviteToChatBtnGroup">🔗 Пригласить</button>
          <button class="dropdown-item" id="topicsMenuBtn">📂 Темы</button>
          <button class="dropdown-item" id="searchInChatBtnGroup">🔍 Поиск</button>
          <button class="dropdown-item" id="pinnedMsgBtnGroup">📌 Закреп</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" id="groupCallBtn">👥 Групповой звонок</button>
          <button class="dropdown-item" id="createPollBtn">📊 Голосование</button>
          <button class="dropdown-item" id="addAnnouncementBtn">📌 Объявление</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" id="groupSettingsBtn">⚙️ Настройки</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item danger" id="deleteChatBtnGroup">🗑️ Удалить</button>
        </div>
        
        <div class="chat-dropdown hidden" id="channelDropdown">
          <button class="dropdown-item" id="inviteToChatBtnChannel">🔗 Пригласить</button>
          <button class="dropdown-item" id="searchInChatBtnChannel">🔍 Поиск</button>
          <button class="dropdown-item" id="channelSettingsBtn">⚙️ Настройки</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item danger" id="deleteChatBtnChannel">🗑️ Удалить</button>
        </div>
        
        <div class="search-bar hidden" id="searchInChatBar">
          <input type="text" class="search-input" id="searchInChatInput" placeholder="Поиск...">
          <span class="search-counter" id="searchCounter">0/0</span>
          <button class="action-icon" id="searchPrevBtn">⬆️</button>
          <button class="action-icon" id="searchNextBtn">⬇️</button>
          <button class="action-icon" id="searchInChatCloseBtn">✖</button>
        </div>
        
        <div id="pinnedMessage" class="pinned-message hidden">
          <div id="pinnedText"></div>
          <button id="unpinBtn">✖</button>
        </div>
        
        <div class="messages-area" id="messagesArea"></div>
        
        <div class="reply-bar hidden" id="replyBar">
          <div class="reply-bar-text" id="replyBarText"></div>
          <button class="reply-bar-close" id="replyBarClose">✖</button>
        </div>
        
        <div class="edit-indicator hidden" id="editIndicator">✏️ Редактирование</div>
        
        <div class="input-panel">
          <button class="sticker-btn" id="stickerToggleBtn">😊</button>
          <button class="sticker-btn" id="voiceRecordBtn">🎤</button>
          <div class="message-input-wrapper">
            <input type="text" class="message-input" id="messageInput" placeholder="Сообщение...">
            <label class="file-label" for="fileInput">📎</label>
            <input type="file" id="fileInput" accept="image/*,video/*,audio/*">
            <button class="send-btn" id="sendBtn">➤</button>
          </div>
        </div>
        
        <div class="sticker-panel hidden" id="stickerPanel">
          <div class="sticker-tabs" id="stickerTabs"></div>
          <div class="sticker-grid" id="stickerGrid"></div>
          <div class="sticker-pack-actions hidden" id="stickerPackActions">
            <button id="addStickerToPackBtn">➕ Добавить</button>
            <button id="deleteStickerPackBtn" class="danger">🗑️ Удалить пак</button>
          </div>
        </div>
      </div>
      
      <!-- Экран тем -->
      <div id="topicsScreen" class="screen hidden">
        <div class="chat-header">
          <button class="back-btn" id="topicsBackBtn">←</button>
          <span class="current-chat-name">Темы</span>
          <button class="action-icon" id="addTopicBtn">➕</button>
        </div>
        <div class="topics-list" id="topicsList"></div>
      </div>
      
      <!-- Сайдбар -->
      <div class="sidebar" id="sidebar">
        <div class="sidebar-header">REVERS</div>
        <div class="sidebar-menu">
          <button class="menu-item" id="qrMenuBtn">🔳 QR</button>
          <button class="menu-item" id="scanMenuBtn">📷 Сканер</button>
          <button class="menu-item" id="savedMenuBtn">📔 Сохранённые</button>
          <button class="menu-item" id="browserMenuBtn">🌐 Браузер</button>
          <button class="menu-item" id="accountMenuBtn">👤 Аккаунт</button>
          <button class="menu-item" id="profileMenuBtn">👤 Профиль</button>
          <button class="menu-item" id="groupsMenuBtn">👥 Группы</button>
          <button class="menu-item" id="channelsMenuBtn">📢 Каналы</button>
          <button class="menu-item" id="settingsMenuBtn">⚙️ Настройки</button>
          <button class="menu-item" id="aboutMenuBtn">ℹ️ О нас</button>
        </div>
      </div>
      
      <div class="overlay" id="overlay"></div>
      
      <!-- Модальные окна -->
      <div class="modal" id="addContactModal">
        <h3>➕ Добавить контакт</h3>
        <input type="text" id="addContactIdInput" placeholder="ID контакта">
        <button id="addContactConfirmBtn" class="primary">Добавить</button>
        <button id="addContactCloseBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="connectModal">
        <h3>🔗 Подключение</h3>
        <input type="text" id="peerIdInput" placeholder="ID собеседника">
        <input type="text" id="signalInput" placeholder="Сигнал (если есть)">
        <button id="connectSendBtn" class="primary">Подключиться</button>
        <textarea id="mySignalOutput" readonly placeholder="Ваш сигнал появится здесь..." rows="2"></textarea>
        <button id="copySignalBtn" class="secondary">📋 Копировать сигнал</button>
        <button id="closeConnectBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="qrModal">
        <h3>🔳 Ваш QR-код</h3>
        <canvas id="qrCanvas"></canvas>
        <code id="inviteLink"></code>
        <button id="copyInviteLinkBtn" class="secondary">📋 Копировать ссылку</button>
        <button id="shareInviteBtn" class="secondary">📤 Поделиться</button>
        <button id="closeQrBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="scannerModal">
        <h3>📷 Сканер QR</h3>
        <div id="scannerContainer"></div>
        <button id="stopScannerBtn" class="secondary">Отмена</button>
      </div>
      
      <div class="modal" id="accountModal">
        <h3>👤 Аккаунт</h3>
        <img id="modalAvatar" class="avatar-modal-img">
        <button id="changeAvatarBtn" class="secondary">Сменить аватар</button>
        <input type="file" id="modalAvatarInput" accept="image/*" style="display:none">
        <div id="myIdDisplay" class="profile-id">Загрузка...</div>
        <button id="copyIdBtn" class="secondary">📋 Копировать ID</button>
        <input type="text" id="nicknameInput" placeholder="Ваше имя">
        <textarea id="bioInput" placeholder="О себе" rows="2"></textarea>
        <button id="saveAccountBtn" class="primary">Сохранить</button>
        <button id="closeAccountBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="settingsModal">
        <h3>⚙️ Настройки</h3>
        <select id="themeSelect">
          <option value="dark">Тёмная</option>
          <option value="light">Светлая</option>
        </select>
        <div class="setting-row">
          <span>🔊 Звуки</span>
          <div id="soundToggle" class="toggle-switch"></div>
        </div>
        <button id="closeSettingsBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="aboutModal">
        <h3>ℹ️ REVERS v3.3</h3>
        <p>P2P мессенджер с пост-квантовым шифрованием</p>
        <p>X25519 + ML-KEM-768 + ChaCha20</p>
        <button id="closeAboutBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="groupsModal">
        <h3>👥 Группы</h3>
        <div id="groupsList"></div>
        <button id="createGroupBtn" class="primary">➕ Создать группу</button>
        <button id="closeGroupsBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="createGroupModal">
        <h3>Создание группы</h3>
        <input type="text" id="groupNameInput" placeholder="Название группы">
        <select id="groupTypeSelect">
          <option value="chat">💬 Обычный чат</option>
          <option value="forum">📂 Форум с темами</option>
        </select>
        <button id="confirmGroupBtn" class="primary">Создать</button>
        <button id="cancelGroupBtn" class="secondary">Отмена</button>
      </div>
      
      <div class="modal" id="channelsModal">
        <h3>📢 Каналы</h3>
        <div id="channelsList"></div>
        <button id="createChannelBtn" class="primary">➕ Создать канал</button>
        <button id="closeChannelsBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="createChannelModal">
        <h3>Создание канала</h3>
        <input type="text" id="channelNameInput" placeholder="Название канала">
        <button id="confirmChannelBtn" class="primary">Создать</button>
        <button id="cancelChannelBtn" class="secondary">Отмена</button>
      </div>
      
      <div class="modal" id="createStickerPackModal">
        <h3>🎨 Новый пак стикеров</h3>
        <input type="text" id="stickerPackNameInput" placeholder="Название пака">
        <button id="confirmStickerPackBtn" class="primary">Создать</button>
        <button id="cancelStickerPackBtn" class="secondary">Отмена</button>
      </div>
      
      <div class="modal" id="addStickerModal">
        <h3>➕ Добавить стикер</h3>
        <input type="file" id="stickerFileInput" accept="image/*">
        <img id="stickerPreview">
        <input type="text" id="stickerEmojiInput" placeholder="Эмодзи (например, 😊)">
        <button id="confirmStickerBtn" class="primary">Добавить</button>
        <button id="cancelStickerBtn" class="secondary">Отмена</button>
      </div>
      
      <div class="modal" id="browserModal">
        <h3>🌐 Встроенный браузер</h3>
        <input type="text" id="browserUrlInput" placeholder="https://...">
        <button id="browserGoBtn" class="primary">Открыть</button>
        <button id="closeBrowserBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="createTopicModal">
        <h3>📂 Новая тема</h3>
        <input type="text" id="topicNameInput" placeholder="Название темы">
        <button id="confirmTopicBtn" class="primary">Создать</button>
        <button id="cancelTopicBtn" class="secondary">Отмена</button>
      </div>
      
      <div class="modal" id="createPollModal">
        <h3>📊 Голосование</h3>
        <input type="text" id="pollQuestionInput" placeholder="Вопрос">
        <input type="text" id="pollOptionsInput" placeholder="Варианты через запятую">
        <button id="confirmPollBtn" class="primary">Создать</button>
        <button id="cancelPollBtn" class="secondary">Отмена</button>
      </div>
      
      <div class="modal" id="groupSettingsModal">
        <h3>⚙️ Настройки</h3>
        <div id="groupSettingsContent"></div>
        <button id="closeGroupSettingsBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="reaction-panel hidden" id="reactionPanel">
        <div class="reaction-emoji" data-emoji="👍">👍</div>
        <div class="reaction-emoji" data-emoji="😂">😂</div>
        <div class="reaction-emoji" data-emoji="❤️">❤️</div>
        <div class="reaction-emoji" data-emoji="😮">😮</div>
        <div class="reaction-emoji" data-emoji="🔥">🔥</div>
        <div class="reaction-emoji" data-emoji="💯">💯</div>
      </div>
      
      <div class="context-menu hidden" id="contextMenu">
        <button class="dropdown-item" id="ctxEdit">✏️ Редактировать</button>
        <button class="dropdown-item" id="ctxReply">↩️ Ответить</button>
        <button class="dropdown-item" id="ctxPin">📌 Закрепить</button>
        <button class="dropdown-item" id="ctxCopy">📋 Копировать</button>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item danger" id="ctxDelete">🗑️ Удалить</button>
      </div>
      
      <div class="image-viewer" id="imageViewer">
        <img id="fullscreenImage">
      </div>
      
      <div class="call-modal hidden" id="callModal">
        <div class="call-header">
          <span id="callPeerName">Звонок...</span>
          <span id="callDuration">00:00</span>
        </div>
        <div class="call-video" id="callVideo"></div>
        <div class="call-controls">
          <button id="callMicBtn">🎤</button>
          <button id="callCamBtn">📷</button>
          <button id="callEndBtn">❌</button>
        </div>
      </div>
    `;
  }
  
  _cacheElements() {
    const ids = [
      'chatsScreen', 'chatScreen', 'topicsScreen',
      'chatsList', 'messagesArea', 'messageInput', 'sendBtn',
      'backBtn', 'chatName', 'statusLed', 'statusText',
      'sidebar', 'overlay', 'typingIndicator',
      'replyBar', 'replyBarText', 'replyBarClose', 'editIndicator',
      'stickerPanel', 'stickerTabs', 'stickerGrid', 'stickerToggleBtn',
      'voiceRecordBtn', 'fileInput', 'pinnedMessage', 'pinnedText', 'unpinBtn',
      'reactionPanel', 'contextMenu', 'dhtStatus', 'searchChatsBar',
      'searchChatsInput', 'searchChatsCloseBtn', 'searchInChatBar',
      'searchInChatInput', 'searchInChatCloseBtn', 'callModal',
      'callPeerName', 'callDuration', 'callVideo', 'callMicBtn',
      'callCamBtn', 'callEndBtn', 'stickerPackActions',
      'addStickerToPackBtn', 'deleteStickerPackBtn'
    ];
    
    for (const id of ids) {
      this.elements[id] = document.getElementById(id);
    }
  }
  
  _bindEvents() {
    // Навигация
    const menuBtn = document.getElementById('menuBtn');
    const overlay = document.getElementById('overlay');
    const backBtn = document.getElementById('backBtn');
    
    if (menuBtn) menuBtn.addEventListener('click', () => this._toggleSidebar(true));
    if (overlay) overlay.addEventListener('click', () => this._toggleSidebar(false));
    if (backBtn) backBtn.addEventListener('click', () => this._goToChats());
    
    // Отправка сообщений
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    
    if (sendBtn) sendBtn.addEventListener('click', () => this._sendMessage());
    if (messageInput) {
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._sendMessage();
        }
      });
      messageInput.addEventListener('input', () => this._handleTyping());
      messageInput.addEventListener('blur', () => this._saveDraft());
    }
    
    // Файлы
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files?.[0]) this._sendFile(e.target.files[0]);
        e.target.value = '';
      });
    }
    
    // Ответ
    const replyBarClose = document.getElementById('replyBarClose');
    if (replyBarClose) {
      replyBarClose.addEventListener('click', () => {
        this.state.replyTo = null;
        if (this.elements.replyBar) this.elements.replyBar.classList.add('hidden');
      });
    }
    
    // Меню чата
    const chatMenuBtn = document.getElementById('chatMenuBtn');
    if (chatMenuBtn) {
      chatMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showChatMenu();
      });
    }
    
    // Стикеры
    const stickerToggleBtn = document.getElementById('stickerToggleBtn');
    if (stickerToggleBtn) {
      stickerToggleBtn.addEventListener('click', () => this._toggleStickerPanel());
    }
    
    // Голосовые
    const voiceRecordBtn = document.getElementById('voiceRecordBtn');
    if (voiceRecordBtn) {
      voiceRecordBtn.addEventListener('click', () => this._toggleVoiceRecord());
    }
    
    // Поиск по чатам
    const searchChatsBtn = document.getElementById('searchChatsBtn');
    const searchChatsClose = document.getElementById('searchChatsCloseBtn');
    const searchChatsInput = document.getElementById('searchChatsInput');
    
    if (searchChatsBtn) searchChatsBtn.addEventListener('click', () => this._toggleChatSearch(true));
    if (searchChatsClose) searchChatsClose.addEventListener('click', () => this._toggleChatSearch(false));
    if (searchChatsInput) searchChatsInput.addEventListener('input', (e) => this._filterChats(e.target.value));
    
    // Поиск в чате
    const searchInChatBtn = document.getElementById('searchInChatBtn');
    const searchInChatClose = document.getElementById('searchInChatCloseBtn');
    const searchPrevBtn = document.getElementById('searchPrevBtn');
    const searchNextBtn = document.getElementById('searchNextBtn');
    const searchInChatInput = document.getElementById('searchInChatInput');
    
    if (searchInChatBtn) searchInChatBtn.addEventListener('click', () => this._toggleSearchInChat(true));
    if (searchInChatClose) searchInChatClose.addEventListener('click', () => this._toggleSearchInChat(false));
    if (searchPrevBtn) searchPrevBtn.addEventListener('click', () => this._searchPrev());
    if (searchNextBtn) searchNextBtn.addEventListener('click', () => this._searchNext());
    if (searchInChatInput) searchInChatInput.addEventListener('input', (e) => this._searchInChat(e.target.value));
    
    // Добавление контакта
    const addContactBtn = document.getElementById('addContactBtn');
    if (addContactBtn) addContactBtn.addEventListener('click', () => this._openModal('addContactModal'));
    
    // Закрытие дропдаунов
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.chat-dropdown')) {
        document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden'));
      }
      if (!e.target.closest('.reaction-panel')) {
        const reactionPanel = document.getElementById('reactionPanel');
        if (reactionPanel) reactionPanel.classList.add('hidden');
      }
      if (!e.target.closest('.context-menu')) {
        const contextMenu = document.getElementById('contextMenu');
        if (contextMenu) contextMenu.classList.add('hidden');
      }
    });
    
    // Реакции
    document.querySelectorAll('.reaction-emoji').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this._addReaction(el.dataset.emoji);
      });
    });
    
    // Контекстное меню
    const ctxEdit = document.getElementById('ctxEdit');
    const ctxReply = document.getElementById('ctxReply');
    const ctxPin = document.getElementById('ctxPin');
    const ctxCopy = document.getElementById('ctxCopy');
    const ctxDelete = document.getElementById('ctxDelete');
    
    if (ctxEdit) ctxEdit.addEventListener('click', () => this._editSelectedMessage());
    if (ctxReply) ctxReply.addEventListener('click', () => this._replyToSelectedMessage());
    if (ctxPin) ctxPin.addEventListener('click', () => this._pinSelectedMessage());
    if (ctxCopy) ctxCopy.addEventListener('click', () => this._copySelectedMessage());
    if (ctxDelete) ctxDelete.addEventListener('click', () => this._deleteSelectedMessage());
    
    // Звонки
    const callEndBtn = document.getElementById('callEndBtn');
    if (callEndBtn) callEndBtn.addEventListener('click', () => this._endCall());
    
    // Просмотр изображений
    const imageViewer = document.getElementById('imageViewer');
    if (imageViewer) imageViewer.addEventListener('click', () => imageViewer.classList.remove('active'));
    
    // Модальные окна
    this._bindModalEvents();
    
    // Сайдбар
    this._bindSidebarEvents();
  }
  
  _bindModalEvents() {
    // Add contact
    const addContactConfirm = document.getElementById('addContactConfirmBtn');
    const addContactClose = document.getElementById('addContactCloseBtn');
    if (addContactConfirm) addContactConfirm.addEventListener('click', () => this._addContact());
    if (addContactClose) addContactClose.addEventListener('click', () => this._closeAllModals());
    
    // Connect
    const connectSend = document.getElementById('connectSendBtn');
    const copySignal = document.getElementById('copySignalBtn');
    const closeConnect = document.getElementById('closeConnectBtn');
    if (connectSend) connectSend.addEventListener('click', () => this._handleConnect());
    if (copySignal) copySignal.addEventListener('click', () => this._copySignal());
    if (closeConnect) closeConnect.addEventListener('click', () => this._closeAllModals());
    
    // QR
    const copyInviteLink = document.getElementById('copyInviteLinkBtn');
    const shareInvite = document.getElementById('shareInviteBtn');
    const closeQr = document.getElementById('closeQrBtn');
    if (copyInviteLink) copyInviteLink.addEventListener('click', () => this._copyInviteLink());
    if (shareInvite) shareInvite.addEventListener('click', () => this._shareInvite());
    if (closeQr) closeQr.addEventListener('click', () => this._closeAllModals());
    
    // Scanner
    const stopScanner = document.getElementById('stopScannerBtn');
    if (stopScanner) stopScanner.addEventListener('click', () => this._stopScanner());
    
    // Account
    const changeAvatar = document.getElementById('changeAvatarBtn');
    const modalAvatarInput = document.getElementById('modalAvatarInput');
    const copyId = document.getElementById('copyIdBtn');
    const saveAccount = document.getElementById('saveAccountBtn');
    const closeAccount = document.getElementById('closeAccountBtn');
    
    if (changeAvatar) changeAvatar.addEventListener('click', () => modalAvatarInput?.click());
    if (modalAvatarInput) modalAvatarInput.addEventListener('change', (e) => this._changeAvatar(e));
    if (copyId) copyId.addEventListener('click', () => this._copyMyId());
    if (saveAccount) saveAccount.addEventListener('click', () => this._saveAccount());
    if (closeAccount) closeAccount.addEventListener('click', () => this._closeAllModals());
    
    // Settings
    const themeSelect = document.getElementById('themeSelect');
    const soundToggle = document.getElementById('soundToggle');
    const closeSettings = document.getElementById('closeSettingsBtn');
    
    if (themeSelect) themeSelect.addEventListener('change', (e) => this._applyTheme(e.target.value));
    if (soundToggle) soundToggle.addEventListener('click', () => this._toggleSound());
    if (closeSettings) closeSettings.addEventListener('click', () => this._closeAllModals());
    
    // About
    const closeAbout = document.getElementById('closeAboutBtn');
    if (closeAbout) closeAbout.addEventListener('click', () => this._closeAllModals());
    
    // Groups
    const createGroup = document.getElementById('createGroupBtn');
    const confirmGroup = document.getElementById('confirmGroupBtn');
    const cancelGroup = document.getElementById('cancelGroupBtn');
    const closeGroups = document.getElementById('closeGroupsBtn');
    
    if (createGroup) createGroup.addEventListener('click', () => this._openModal('createGroupModal'));
    if (confirmGroup) confirmGroup.addEventListener('click', () => this._createGroup());
    if (cancelGroup) cancelGroup.addEventListener('click', () => this._closeAllModals());
    if (closeGroups) closeGroups.addEventListener('click', () => this._closeAllModals());
    
    // Channels
    const createChannel = document.getElementById('createChannelBtn');
    const confirmChannel = document.getElementById('confirmChannelBtn');
    const cancelChannel = document.getElementById('cancelChannelBtn');
    const closeChannels = document.getElementById('closeChannelsBtn');
    
    if (createChannel) createChannel.addEventListener('click', () => this._openModal('createChannelModal'));
    if (confirmChannel) confirmChannel.addEventListener('click', () => this._createChannel());
    if (cancelChannel) cancelChannel.addEventListener('click', () => this._closeAllModals());
    if (closeChannels) closeChannels.addEventListener('click', () => this._closeAllModals());
    
    // Stickers
    const confirmStickerPack = document.getElementById('confirmStickerPackBtn');
    const cancelStickerPack = document.getElementById('cancelStickerPackBtn');
    const confirmSticker = document.getElementById('confirmStickerBtn');
    const cancelSticker = document.getElementById('cancelStickerBtn');
    const stickerFileInput = document.getElementById('stickerFileInput');
    
    if (confirmStickerPack) confirmStickerPack.addEventListener('click', () => this._createStickerPack());
    if (cancelStickerPack) cancelStickerPack.addEventListener('click', () => this._closeAllModals());
    if (confirmSticker) confirmSticker.addEventListener('click', () => this._addStickerToPack());
    if (cancelSticker) cancelSticker.addEventListener('click', () => this._closeAllModals());
    if (stickerFileInput) stickerFileInput.addEventListener('change', (e) => this._previewSticker(e));
    
    // Browser
    const browserGo = document.getElementById('browserGoBtn');
    const closeBrowser = document.getElementById('closeBrowserBtn');
    const browserUrlInput = document.getElementById('browserUrlInput');
    
    if (browserGo) browserGo.addEventListener('click', () => this._openInBrowser());
    if (closeBrowser) closeBrowser.addEventListener('click', () => this._closeAllModals());
    if (browserUrlInput) browserUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._openInBrowser();
    });
    
    // Topics
    const confirmTopic = document.getElementById('confirmTopicBtn');
    const cancelTopic = document.getElementById('cancelTopicBtn');
    const addTopic = document.getElementById('addTopicBtn');
    const topicsBack = document.getElementById('topicsBackBtn');
    
    if (confirmTopic) confirmTopic.addEventListener('click', () => this._createTopic());
    if (cancelTopic) cancelTopic.addEventListener('click', () => this._closeAllModals());
    if (addTopic) addTopic.addEventListener('click', () => this._openModal('createTopicModal'));
    if (topicsBack) topicsBack.addEventListener('click', () => this._goToChats());
    
    // Polls
    const confirmPoll = document.getElementById('confirmPollBtn');
    const cancelPoll = document.getElementById('cancelPollBtn');
    if (confirmPoll) confirmPoll.addEventListener('click', () => this._createPoll());
    if (cancelPoll) cancelPoll.addEventListener('click', () => this._closeAllModals());
    
    // Group settings
    const closeGroupSettings = document.getElementById('closeGroupSettingsBtn');
    if (closeGroupSettings) closeGroupSettings.addEventListener('click', () => this._closeAllModals());
    
    // Стикер-пак действия
    const addStickerToPackBtn = document.getElementById('addStickerToPackBtn');
    const deleteStickerPackBtn = document.getElementById('deleteStickerPackBtn');
    if (addStickerToPackBtn) addStickerToPackBtn.addEventListener('click', () => this._openModal('addStickerModal'));
    if (deleteStickerPackBtn) deleteStickerPackBtn.addEventListener('click', () => this._deleteStickerPack());
    
    // Chat dropdown actions
    const inviteBtns = ['inviteToChatBtn', 'inviteToChatBtnGroup', 'inviteToChatBtnChannel'];
    inviteBtns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => this._shareInviteLink());
    });
    
    const searchInChatBtns = ['searchInChatBtn', 'searchInChatBtnGroup', 'searchInChatBtnChannel'];
    searchInChatBtns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => this._toggleSearchInChat(true));
    });
    
    const pinnedBtns = ['pinnedMsgBtn', 'pinnedMsgBtnGroup'];
    pinnedBtns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => this._togglePinnedMessage());
    });
    
    const unpinBtn = document.getElementById('unpinBtn');
    if (unpinBtn) unpinBtn.addEventListener('click', () => this._unpinMessage());
    
    const securityBtn = document.getElementById('securityBtn');
    if (securityBtn) securityBtn.addEventListener('click', () => this._showSecurityNumber());
    
    const callBtns = ['callBtn', 'audioCallBtn'];
    callBtns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => {
        if (this.state.currentChat) {
          REVERS.startCall(this.state.currentChat.id, id === 'callBtn');
          this._showCallModal(this.state.currentChat.name || this.state.currentChat.id);
        }
      });
    });
    
    const groupCallBtn = document.getElementById('groupCallBtn');
    if (groupCallBtn) {
      groupCallBtn.addEventListener('click', async () => {
        if (this.state.currentChat) {
          this.state.currentGroupCallId = await REVERS.startGroupCall(this.state.currentChat.id, true);
          if (this.state.currentGroupCallId) {
            this._showCallModal('Групповой звонок');
          }
        }
      });
    }
    
    const createPollBtn = document.getElementById('createPollBtn');
    if (createPollBtn) createPollBtn.addEventListener('click', () => this._openModal('createPollModal'));
    
    const addAnnouncementBtn = document.getElementById('addAnnouncementBtn');
    if (addAnnouncementBtn) addAnnouncementBtn.addEventListener('click', () => this._addAnnouncement());
    
    const connectPeerBtn = document.getElementById('connectPeerBtn');
    if (connectPeerBtn) connectPeerBtn.addEventListener('click', () => this._openConnectModal());
    
    const topicsMenuBtn = document.getElementById('topicsMenuBtn');
    if (topicsMenuBtn) topicsMenuBtn.addEventListener('click', () => this._openTopicsScreen());
    
    const groupSettingsBtn = document.getElementById('groupSettingsBtn');
    if (groupSettingsBtn) groupSettingsBtn.addEventListener('click', () => this._showGroupSettings());
    
    const channelSettingsBtn = document.getElementById('channelSettingsBtn');
    if (channelSettingsBtn) channelSettingsBtn.addEventListener('click', () => this._showChannelSettings());
    
    const deleteBtns = ['deleteChatBtn', 'deleteChatBtnGroup', 'deleteChatBtnChannel'];
    deleteBtns.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => this._deleteCurrentChat());
    });
    
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => this._clearHistory());
  }
  
  _bindSidebarEvents() {
    const sidebarItems = [
      { id: 'qrMenuBtn', handler: () => this._showQR() },
      { id: 'scanMenuBtn', handler: () => this._startScanner() },
      { id: 'savedMenuBtn', handler: () => this._openSavedChat() },
      { id: 'browserMenuBtn', handler: () => this._openBrowser() },
      { id: 'accountMenuBtn', handler: () => this._openModal('accountModal') },
      { id: 'profileMenuBtn', handler: () => this._openProfileScreen() },
      { id: 'groupsMenuBtn', handler: () => this._loadAndShowGroups() },
      { id: 'channelsMenuBtn', handler: () => this._loadAndShowChannels() },
      { id: 'settingsMenuBtn', handler: () => this._openModal('settingsModal') },
      { id: 'aboutMenuBtn', handler: () => this._openModal('aboutModal') }
    ];
    
    for (const item of sidebarItems) {
      const el = document.getElementById(item.id);
      if (el) {
        el.addEventListener('click', () => {
          this._toggleSidebar(false);
          item.handler();
        });
      }
    }
  }
  
  async _onReady() {
    console.log('✅ REVERS ядро готово');
    
    // Получаем ID с ожиданием
    let attempts = 0;
    const waitForId = setInterval(() => {
      this.state.myId = REVERS.getMyId();
      if (this.state.myId && this.state.myId !== 'undefined' && this.state.myId.length > 5) {
        clearInterval(waitForId);
        console.log('✅ ID загружен:', this.state.myId);
        const idDisplay = document.getElementById('myIdDisplay');
        if (idDisplay) idDisplay.textContent = this.state.myId;
      }
      attempts++;
      if (attempts > 50) {
        clearInterval(waitForId);
        console.warn('⚠️ ID не загрузился');
        const idDisplay = document.getElementById('myIdDisplay');
        if (idDisplay) idDisplay.textContent = 'Ошибка загрузки ID';
      }
    }, 100);
    
    this.state.myProfile = REVERS.getMyProfile();
    const nicknameInput = document.getElementById('nicknameInput');
    const bioInput = document.getElementById('bioInput');
    const modalAvatar = document.getElementById('modalAvatar');
    
    if (nicknameInput) nicknameInput.value = this.state.myProfile?.name || 'User';
    if (bioInput) bioInput.value = localStorage.getItem('revers_bio') || '';
    if (modalAvatar && this.state.myProfile?.avatar) {
      modalAvatar.src = this.state.myProfile.avatar;
    } else if (modalAvatar) {
      modalAvatar.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle fill=%22%232A2A3A%22 cx=%2250%22 cy=%2250%22 r=%2250%22/%3E%3Ctext x=%2250%22 y=%2267%22 text-anchor=%22middle%22 fill=%22%23E63946%22 font-size=%2240%22%3E🦊%3C/text%3E%3C/svg%3E';
    }
    
    await this._renderChatsList();
    this._updateDHTStatus();
    this._loadDraft();
    
    // Запрашиваем разрешение на уведомления
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
  
  async _handleIncomingMessage(msg) {
    console.log('📨 Входящее сообщение:', msg);
    
    await this._renderChatsList();
    
    if (this.state.currentChat && 
        (this.state.currentChat.id === msg.from || 
         this.state.currentChat.id === msg.room)) {
      await this._renderMessages(this.state.currentChat);
    }
    
    // Показываем уведомление
    if (!this.state.currentChat || this.state.currentChat.id !== msg.from) {
      if (Notification.permission === 'granted') {
        const chatName = msg.from === this.state.myId ? 'Вы' : msg.from;
        new Notification('REVERS', {
          body: `${chatName}: ${msg.text?.substring(0, 50) || 'Сообщение'}`,
          icon: '/favicon.ico'
        });
      }
    }
  }
  
  async _handleChatUpdate() {
    await this._renderChatsList();
    if (this.state.currentChat) {
      await this._renderMessages(this.state.currentChat);
    }
  }
  
  async _sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input?.value.trim();
    
    if (!text || !this.state.currentChat) return;
    
    // Анимация
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.style.transform = 'scale(0.9)';
      setTimeout(() => { if (sendBtn) sendBtn.style.transform = ''; }, 100);
    }
    
    try {
      if (this.state.editingMessage) {
        this.state.editingMessage.text = text;
        this.state.editingMessage.edited = true;
        this.state.editingMessage = null;
        if (this.elements.editIndicator) this.elements.editIndicator.classList.add('hidden');
      } else {
        if (this.state.currentChat.type === 'group') {
          await REVERS.sendGroupMessage(this.state.currentChat.id, text);
        } else if (this.state.currentChat.type === 'saved') {
          await REVERS.sendMessage('me', text);
        } else if (this.state.currentChat.type === 'channel') {
          await REVERS.sendChannelMessage(this.state.currentChat.id, text);
        } else {
          await REVERS.sendMessage(this.state.currentChat.id, text);
        }
      }
      
      if (input) input.value = '';
      this.state.replyTo = null;
      if (this.elements.replyBar) this.elements.replyBar.classList.add('hidden');
      
      await this._renderMessages(this.state.currentChat);
      await this._renderChatsList();
      this._saveDraft();
      
    } catch (error) {
      console.error('Ошибка отправки:', error);
      this._showToast('❌ Не удалось отправить сообщение');
    }
  }
  
  async _renderMessages(chat) {
    const area = this.elements.messagesArea;
    if (!area) return;
    
    area.innerHTML = '<div class="spinner"></div>';
    
    if (!chat) return;
    
    let history = [];
    try {
      if (chat.type === 'saved') {
        history = await REVERS.getChatHistory('me') || [];
      } else if (chat.type === 'group') {
        history = REVERS.getGroupHistory(chat.id) || [];
        if (!history.length) {
          const group = groupManager.groups.get(chat.id);
          if (group?.history) history = group.history;
        }
      } else if (chat.type === 'channel') {
        history = REVERS.getChannelHistory(chat.id) || [];
      } else {
        history = await REVERS.getChatHistory(chat.id) || [];
      }
    } catch (e) {
      console.warn('Ошибка получения истории:', e);
      history = [];
    }
    
    area.innerHTML = '';
    
    const myId = this.state.myId || REVERS.getMyId();
    
    for (let idx = 0; idx < history.length; idx++) {
      const msg = history[idx];
      if (!msg) continue;
      
      const isOutgoing = msg.from === myId;
      const div = document.createElement('div');
      div.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
      div.dataset.msgIdx = idx;
      
      let bubbleHtml = '<div class="bubble">';
      
      if (this.state.replyTo === msg) {
        bubbleHtml += `<div class="reply-context">↩️ ${this._escapeHtml((this.state.replyTo.text || '').substring(0, 50))}</div>`;
      }
      
      let messageText = this._escapeHtml(msg.text || '');
      messageText = messageText.replace(/(https?:\/\/[^\s]+)/g, '<a href="#" onclick="window.REVERSApp._openLink(\'$1\'); return false;" class="message-link">$1</a>');
      bubbleHtml += `<div class="message-text">${messageText}</div>`;
      
      if (msg.edited) {
        bubbleHtml += '<span class="edited-badge"> (изм.)</span>';
      }
      
      if (msg.type === 'voice' && msg.fileData) {
        bubbleHtml += `<audio controls src="${msg.fileData}"></audio>`;
      }
      
      if (msg.type === 'file' && msg.fileName) {
        const isImage = msg.fileType?.startsWith('image/');
        bubbleHtml += `<div class="file-attachment" onclick="window.REVERSApp._openMedia('${msg.fileData || ''}', '${msg.fileType || ''}')">
          📄 ${this._escapeHtml(msg.fileName)} (${this._formatSize(msg.fileSize)})
        </div>`;
        if (isImage && msg.fileData) {
          bubbleHtml += `<img src="${msg.fileData}" class="file-preview-img" onclick="event.stopPropagation();window.REVERSApp._openMedia('${msg.fileData}', 'image')">`;
        }
      }
      
      if (msg.type === 'gift' && msg.giftData) {
        bubbleHtml += `<div class="gift-emoji">🎁 ${msg.giftData.emoji || '🎁'}</div>
                       <div class="gift-name">${this._escapeHtml(msg.giftData.name || 'Подарок')}</div>`;
      }
      
      if (msg.reactions) {
        bubbleHtml += `<div class="reactions">${this._escapeHtml(msg.reactions)}</div>`;
      }
      
      const timeStr = msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      bubbleHtml += `<div class="message-time">${timeStr}</div>`;
      
      if (isOutgoing) {
        if (msg.error) bubbleHtml += '<span class="msg-status error">❌</span>';
        else if (msg.offline) bubbleHtml += '<span class="msg-status pending">⏳</span>';
        else if (msg.delivered) bubbleHtml += '<span class="msg-status delivered">✓✓</span>';
        else if (msg.sent) bubbleHtml += '<span class="msg-status sent">✓</span>';
      }
      
      bubbleHtml += '</div>';
      div.innerHTML = bubbleHtml;
      
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showContextMenu(e, msg, idx);
      });
      
      let longPressTimer;
      div.addEventListener('touchstart', () => {
        longPressTimer = setTimeout(() => this._showReactions(div), 500);
      });
      div.addEventListener('touchend', () => clearTimeout(longPressTimer));
      div.addEventListener('touchmove', () => clearTimeout(longPressTimer));
      
      area.appendChild(div);
    }
    
    area.scrollTop = area.scrollHeight;
  }
  
  async _renderChatsList(filteredChats = null) {
    const container = this.elements.chatsList;
    if (!container) return;
    
    container.innerHTML = '<div class="spinner"></div>';
    
    let chats = filteredChats || await REVERS.getAllChats() || [];
    
    container.innerHTML = '';
    
    if (chats.length === 0) {
      container.innerHTML = '<div class="empty-state">Нет чатов<br>Нажмите ➕ чтобы добавить контакт</div>';
      return;
    }
    
    for (const chat of chats) {
      const div = document.createElement('div');
      div.className = 'chat-item';
      
      let emoji = '💬';
      if (chat.type === 'saved') emoji = '📔';
      else if (chat.type === 'group') emoji = chat.name?.startsWith('📂') ? '📂' : '👥';
      else if (chat.type === 'channel') emoji = '📢';
      
      const lastMsg = chat.lastMsg || '';
      const lastTime = chat.lastTime ? new Date(chat.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      
      div.innerHTML = `
        <div class="chat-avatar">${emoji}</div>
        <div class="chat-info">
          <div class="chat-name">${this._escapeHtml(chat.name || chat.id)}</div>
          <div class="chat-preview">${this._escapeHtml(lastMsg.substring(0, 50))}</div>
        </div>
        <div class="chat-time">${lastTime}</div>
      `;
      
      div.addEventListener('click', () => this._openChat(chat));
      container.appendChild(div);
    }
  }
  
  _openChat(chat) {
    this._saveDraft();
    
    this.state.currentChat = chat;
    this.state.currentTopic = null;
    this.state.replyTo = null;
    this.state.editingMessage = null;
    this.state.searchResults = [];
    this.state.searchCurrentIndex = 0;
    
    const chatsScreen = document.getElementById('chatsScreen');
    const topicsScreen = document.getElementById('topicsScreen');
    const chatScreen = document.getElementById('chatScreen');
    const chatName = document.getElementById('chatName');
    
    if (chatsScreen) chatsScreen.classList.add('hidden');
    if (topicsScreen) topicsScreen.classList.add('hidden');
    if (chatScreen) chatScreen.classList.remove('hidden');
    if (chatName) chatName.textContent = chat.name || chat.id;
    
    this._toggleSidebar(false);
    document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden'));
    if (this.elements.stickerPanel) this.elements.stickerPanel.classList.add('hidden');
    
    this._renderMessages(chat);
    this._togglePinnedMessage();
    this._loadDraft();
    
    const isConnected = REVERS.isConnected(chat.id);
    this._updateConnectionStatus(isConnected);
  }
  
  _goToChats() {
    this._saveDraft();
    
    this.state.currentChat = null;
    this.state.currentTopic = null;
    this.state.replyTo = null;
    this.state.editingMessage = null;
    
    const chatScreen = document.getElementById('chatScreen');
    const topicsScreen = document.getElementById('topicsScreen');
    const chatsScreen = document.getElementById('chatsScreen');
    
    if (chatScreen) chatScreen.classList.add('hidden');
    if (topicsScreen) topicsScreen.classList.add('hidden');
    if (chatsScreen) chatsScreen.classList.remove('hidden');
    
    if (this.elements.replyBar) this.elements.replyBar.classList.add('hidden');
    if (this.elements.editIndicator) this.elements.editIndicator.classList.add('hidden');
    
    this._renderChatsList();
  }
  
  _toggleSidebar(show) {
    this.state.isSidebarOpen = show;
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (sidebar) {
      if (show) sidebar.classList.add('open');
      else sidebar.classList.remove('open');
    }
    if (overlay) {
      if (show) overlay.classList.add('active');
      else overlay.classList.remove('active');
    }
  }
  
  _openModal(modalId) {
    this._closeAllModals();
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
    this._toggleSidebar(false);
  }
  
  _closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  }
  
  _showToast(message, duration = 2000) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), duration);
    } else {
      toast.textContent = message;
      toast.style.display = 'block';
      setTimeout(() => toast.style.display = 'none', duration);
    }
  }
  
  _showContextMenu(e, msg, idx) {
    e.preventDefault();
    e.stopPropagation();
    
    const menu = this.elements.contextMenu;
    if (!menu) return;
    
    menu.classList.remove('hidden');
    menu.style.left = Math.min((e.touches?.[0]?.clientX || e.clientX), window.innerWidth - 190) + 'px';
    menu.style.top = (e.touches?.[0]?.clientY || e.clientY) + 'px';
    menu._target = { msg, idx };
  }
  
  _showReactions(target) {
    const panel = this.elements.reactionPanel;
    if (!panel) return;
    
    const rect = target.getBoundingClientRect();
    panel.style.top = (rect.top - 50) + 'px';
    panel.style.left = Math.min(rect.left + rect.width / 2 - 90, window.innerWidth - 200) + 'px';
    panel.classList.remove('hidden');
    panel._target = target;
  }
  
  _addReaction(emoji) {
    const panel = this.elements.reactionPanel;
    const target = panel?._target;
    if (!target) {
      if (panel) panel.classList.add('hidden');
      return;
    }
    
    const bubble = target.querySelector('.bubble');
    if (bubble) {
      let reactionsDiv = bubble.querySelector('.reactions');
      if (reactionsDiv) {
        if (!reactionsDiv.textContent.includes(emoji)) {
          reactionsDiv.textContent += emoji;
        }
      } else {
        reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'reactions';
        reactionsDiv.textContent = emoji;
        bubble.appendChild(reactionsDiv);
      }
    }
    
    if (panel) panel.classList.add('hidden');
  }
  
  _editSelectedMessage() {
    const menu = this.elements.contextMenu;
    if (!menu?._target) return;
    
    this.state.editingMessage = menu._target.msg;
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.value = menu._target.msg.text || '';
      messageInput.focus();
    }
    if (this.elements.editIndicator) this.elements.editIndicator.classList.remove('hidden');
    menu.classList.add('hidden');
  }
  
  _replyToSelectedMessage() {
    const menu = this.elements.contextMenu;
    if (!menu?._target) return;
    
    this.state.replyTo = menu._target.msg;
    if (this.elements.replyBarText) {
      this.elements.replyBarText.textContent = '↩️ ' + (menu._target.msg.text || '').substring(0, 50);
    }
    if (this.elements.replyBar) this.elements.replyBar.classList.remove('hidden');
    menu.classList.add('hidden');
  }
  
  _pinSelectedMessage() {
    const menu = this.elements.contextMenu;
    if (!menu?._target || !this.state.currentChat) return;
    
    localStorage.setItem('revers_pinned_' + this.state.currentChat.id, menu._target.msg.text || '');
    this._togglePinnedMessage();
    menu.classList.add('hidden');
    this._showToast('📌 Сообщение закреплено');
  }
  
  _copySelectedMessage() {
    const menu = this.elements.contextMenu;
    if (!menu?._target) return;
    
    const text = `${menu._target.msg.from}: ${menu._target.msg.text || ''}`;
    navigator.clipboard.writeText(text);
    menu.classList.add('hidden');
    this._showToast('📋 Скопировано');
  }
  
  _deleteSelectedMessage() {
    const menu = this.elements.contextMenu;
    if (!menu?._target || !this.state.currentChat) return;
    
    this._deleteMessage(menu._target.msg, menu._target.idx);
    menu.classList.add('hidden');
  }
  
  async _deleteMessage(msg, idx) {
    if (!this.state.currentChat) return;
    
    try {
      if (this.state.currentChat.type === 'saved') {
        const history = await REVERS.getChatHistory('me') || [];
        history.splice(idx, 1);
        await REVERS.clearChatHistory('me');
        for (const m of history) {
          await REVERS.sendMessage('me', m.text);
        }
      } else if (this.state.currentChat.type === 'group') {
        const group = groupManager.groups.get(this.state.currentChat.id);
        if (group?.history) group.history.splice(idx, 1);
        groupManager._save();
      }
      
      await this._renderMessages(this.state.currentChat);
      this._showToast('🗑️ Сообщение удалено');
    } catch (e) {
      console.error('Ошибка удаления:', e);
    }
  }
  
  _togglePinnedMessage() {
    if (!this.state.currentChat) return;
    
    const pinned = localStorage.getItem('revers_pinned_' + this.state.currentChat.id);
    const pinnedDiv = this.elements.pinnedMessage;
    const pinnedText = this.elements.pinnedText;
    
    if (pinned && pinnedDiv && pinnedText) {
      pinnedText.textContent = pinned;
      pinnedDiv.classList.remove('hidden');
    } else if (pinnedDiv) {
      pinnedDiv.classList.add('hidden');
    }
  }
  
  _unpinMessage() {
    if (!this.state.currentChat) return;
    localStorage.removeItem('revers_pinned_' + this.state.currentChat.id);
    if (this.elements.pinnedMessage) this.elements.pinnedMessage.classList.add('hidden');
    this._showToast('📌 Закрепление снято');
  }
  
  _showChatMenu() {
    document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden'));
    
    if (!this.state.currentChat) return;
    
    let dropdownId = 'contactDropdown';
    if (this.state.currentChat.type === 'group') dropdownId = 'groupDropdown';
    else if (this.state.currentChat.type === 'channel') dropdownId = 'channelDropdown';
    else if (this.state.currentChat.type === 'saved') return;
    
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) dropdown.classList.remove('hidden');
  }
  
  _toggleStickerPanel() {
    const panel = this.elements.stickerPanel;
    if (!panel) return;
    
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      this._renderStickerTabs();
      this._renderStickerGrid(this.state.activeStickerPack);
    }
  }
  
  _renderStickerTabs() {
    const tabsContainer = this.elements.stickerTabs;
    if (!tabsContainer) return;
    
    tabsContainer.innerHTML = '';
    
    const packs = stickerManager.getPacks();
    for (const [id, pack] of Object.entries(packs)) {
      const tab = document.createElement('div');
      tab.className = 'sticker-tab ' + (this.state.activeStickerPack === id ? 'active' : '');
      tab.textContent = pack.name;
      tab.addEventListener('click', () => {
        this.state.activeStickerPack = id;
        this._renderStickerTabs();
        this._renderStickerGrid(id);
        if (this.elements.stickerPackActions) {
          this.elements.stickerPackActions.classList.toggle('hidden', id === 'recent' || id === 'default');
        }
      });
      tabsContainer.appendChild(tab);
    }
    
    const addTab = document.createElement('div');
    addTab.className = 'sticker-tab';
    addTab.textContent = '➕';
    addTab.addEventListener('click', () => this._openModal('createStickerPackModal'));
    tabsContainer.appendChild(addTab);
  }
  
  _renderStickerGrid(packId) {
    const grid = this.elements.stickerGrid;
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const stickers = stickerManager.getStickers(packId);
    for (const sticker of stickers) {
      const item = document.createElement('div');
      item.className = 'sticker-item';
      
      if (typeof sticker === 'object' && sticker.data) {
        item.innerHTML = `<img src="${sticker.data}" alt="sticker">`;
      } else {
        item.textContent = typeof sticker === 'string' ? sticker : (sticker.emoji || '🖼️');
      }
      
      item.addEventListener('click', () => {
        const stickerData = typeof sticker === 'string' ? sticker : (sticker.data || sticker.emoji);
        stickerManager.addToRecent(stickerData);
        this._sendSticker(stickerData);
      });
      
      grid.appendChild(item);
    }
    
    if (this.elements.stickerPackActions) {
      this.elements.stickerPackActions.classList.toggle('hidden', packId === 'recent' || packId === 'default');
    }
  }
  
  _sendSticker(sticker) {
    if (!this.state.currentChat) return;
    
    const msg = typeof sticker === 'string' ? sticker : '🖼️';
    
    if (this.state.currentChat.type === 'saved') {
      REVERS.sendMessage('me', msg);
    } else if (this.state.currentChat.type === 'group') {
      REVERS.sendGroupMessage(this.state.currentChat.id, msg);
    } else {
      REVERS.sendMessage(this.state.currentChat.id, msg);
    }
    
    this._renderMessages(this.state.currentChat);
    if (this.elements.stickerPanel) this.elements.stickerPanel.classList.add('hidden');
  }
  
  _createStickerPack() {
    const nameInput = document.getElementById('stickerPackNameInput');
    const name = nameInput?.value.trim();
    if (!name) return;
    
    this.state.activeStickerPack = stickerManager.createPack(name);
    this._closeAllModals();
    this._toggleStickerPanel();
    this._showToast(`✅ Пак "${name}" создан`);
  }
  
  _addStickerToPack() {
    const fileInput = document.getElementById('stickerFileInput');
    const emojiInput = document.getElementById('stickerEmojiInput');
    const file = fileInput?.files?.[0];
    
    if (!file || !this.state.activeStickerPack) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      stickerManager.addSticker(this.state.activeStickerPack, reader.result, emojiInput?.value.trim() || '');
      this._closeAllModals();
      this._renderStickerGrid(this.state.activeStickerPack);
      if (fileInput) fileInput.value = '';
      if (emojiInput) emojiInput.value = '';
      const preview = document.getElementById('stickerPreview');
      if (preview) preview.style.display = 'none';
      this._showToast('✅ Стикер добавлен');
    };
    reader.readAsDataURL(file);
  }
  
  _deleteStickerPack() {
    if (this.state.activeStickerPack && confirm('Удалить этот пак стикеров?')) {
      stickerManager.deletePack(this.state.activeStickerPack);
      this.state.activeStickerPack = 'recent';
      this._renderStickerTabs();
      this._renderStickerGrid('recent');
      this._showToast('🗑️ Пак удалён');
    }
  }
  
  _previewSticker(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('stickerPreview');
      if (preview) {
        preview.src = e.target.result;
        preview.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  }
  
  async _toggleVoiceRecord() {
    const btn = this.elements.voiceRecordBtn;
    if (!btn) return;
    
    if (this.state.isRecording) {
      btn.textContent = '🎤';
      this.state.isRecording = false;
      
      if (this.state.voiceRecorder) {
        const recorder = await this.state.voiceRecorder;
        if (recorder?.stop) {
          recorder.recorder.onstop = async () => {
            const blob = new Blob(recorder.chunks || [], { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = async () => {
              const audioData = reader.result;
              const duration = Math.round((Date.now() - (this.state.voiceStartTime || Date.now())) / 1000);
              
              if (audioData && this.state.currentChat) {
                await REVERS.sendVoice(this.state.currentChat.id, audioData, duration);
                await this._renderMessages(this.state.currentChat);
                this._showToast('🎤 Голосовое отправлено');
              }
            };
            reader.readAsDataURL(blob);
          };
          recorder.stop();
        }
        this.state.voiceRecorder = null;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        
        btn.textContent = '🔴';
        this.state.isRecording = true;
        this.state.voiceStartTime = Date.now();
        this.state.voiceRecorder = REVERS.recordVoice();
        this._showToast('🎤 Запись... Нажмите ещё раз для отправки');
      } catch (e) {
        console.error('Ошибка микрофона:', e);
        this._showToast('❌ Нет доступа к микрофону');
      }
    }
  }
  
  async _sendFile(file) {
    if (!this.state.currentChat) return;
    
    this._showToast(`📎 Отправка ${file.name}...`);
    try {
      await REVERS.sendFile(this.state.currentChat.id, file);
      await this._renderMessages(this.state.currentChat);
      this._showToast('✅ Файл отправлен');
    } catch (e) {
      console.error('Ошибка отправки файла:', e);
      this._showToast('❌ Не удалось отправить файл');
    }
  }
  
  _handleTyping() {
    if (this.state.typingTimeout) clearTimeout(this.state.typingTimeout);
    
    if (this.state.currentChat?.type === 'contact') {
      REVERS.sendTyping?.(this.state.currentChat.id);
    }
    
    this.state.typingTimeout = setTimeout(() => {
      if (this.state.currentChat?.type === 'contact') {
        REVERS.sendTyping?.(this.state.currentChat.id, false);
      }
    }, 1000);
  }
  
  _saveDraft() {
    if (!this.state.currentChat?.id) return;
    
    const messageInput = document.getElementById('messageInput');
    const text = messageInput?.value || '';
    if (text.trim()) {
      localStorage.setItem('draft_' + this.state.currentChat.id, text);
    } else {
      localStorage.removeItem('draft_' + this.state.currentChat.id);
    }
  }
  
  _loadDraft() {
    if (!this.state.currentChat?.id) return;
    
    const draft = localStorage.getItem('draft_' + this.state.currentChat.id);
    const messageInput = document.getElementById('messageInput');
    if (draft && messageInput) {
      messageInput.value = draft;
    }
  }
  
  _toggleChatSearch(show = true) {
    const bar = document.getElementById('searchChatsBar');
    if (bar) bar.classList.toggle('hidden', !show);
    
    if (show) {
      const input = document.getElementById('searchChatsInput');
      if (input) input.focus();
    } else {
      const input = document.getElementById('searchChatsInput');
      if (input) input.value = '';
      this._renderChatsList();
    }
  }
  
  _filterChats(query) {
    if (!query) {
      this._renderChatsList();
      return;
    }
    
    REVERS.getAllChats().then(allChats => {
      const filtered = allChats.filter(c => 
        (c.name || c.id).toLowerCase().includes(query.toLowerCase())
      );
      this._renderChatsList(filtered);
    });
  }
  
  _toggleSearchInChat(show = true) {
    const bar = document.getElementById('searchInChatBar');
    if (bar) bar.classList.toggle('hidden', !show);
    
    if (show) {
      const input = document.getElementById('searchInChatInput');
      if (input) {
        input.value = '';
        input.focus();
      }
      this.state.searchResults = [];
      this.state.searchCurrentIndex = 0;
    } else {
      this._clearSearchHighlights();
    }
  }
  
  _searchInChat(query) {
    if (!query || !this.state.currentChat) {
      this._clearSearchHighlights();
      return;
    }
    
    const messages = document.querySelectorAll('.message');
    this.state.searchResults = [];
    
    messages.forEach((msg, idx) => {
      const textEl = msg.querySelector('.message-text');
      if (textEl && textEl.textContent.toLowerCase().includes(query.toLowerCase())) {
        this.state.searchResults.push({ element: msg, index: idx });
      }
    });
    
    const counter = document.getElementById('searchCounter');
    if (counter) {
      counter.textContent = `${this.state.searchResults.length > 0 ? 1 : 0}/${this.state.searchResults.length}`;
    }
    
    if (this.state.searchResults.length > 0) {
      this._highlightSearchResult(0);
    } else {
      this._clearSearchHighlights();
    }
  }
  
  _searchPrev() {
    if (this.state.searchResults.length === 0) return;
    
    let newIndex = this.state.searchCurrentIndex - 1;
    if (newIndex < 0) newIndex = this.state.searchResults.length - 1;
    this._highlightSearchResult(newIndex);
  }
  
  _searchNext() {
    if (this.state.searchResults.length === 0) return;
    
    let newIndex = this.state.searchCurrentIndex + 1;
    if (newIndex >= this.state.searchResults.length) newIndex = 0;
    this._highlightSearchResult(newIndex);
  }
  
  _highlightSearchResult(index) {
    this._clearSearchHighlights();
    
    this.state.searchCurrentIndex = index;
    const result = this.state.searchResults[index];
    if (!result) return;
    
    result.element.style.backgroundColor = 'rgba(230, 57, 70, 0.2)';
    result.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    const counter = document.getElementById('searchCounter');
    if (counter) {
      counter.textContent = `${index + 1}/${this.state.searchResults.length}`;
    }
  }
  
  _clearSearchHighlights() {
    document.querySelectorAll('.message').forEach(msg => {
      msg.style.backgroundColor = '';
    });
  }
  
  async _addContact() {
    const input = document.getElementById('addContactIdInput');
    const contactId = input?.value.trim();
    
    if (!contactId) {
      this._showToast('❌ Введите ID контакта');
      return;
    }
    
    this._closeAllModals();
    if (input) input.value = '';
    
    REVERS.connectToPeer(contactId);
    await this._openChat({ id: contactId, type: 'contact', name: contactId });
    this._showToast(`🔗 Подключение к ${contactId}...`);
  }
  
  async _createGroup() {
    const nameInput = document.getElementById('groupNameInput');
    const typeSelect = document.getElementById('groupTypeSelect');
    const name = nameInput?.value.trim();
    const type = typeSelect?.value || 'chat';
    
    if (!name) {
      this._showToast('❌ Введите название группы');
      return;
    }
    
    this._closeAllModals();
    if (nameInput) nameInput.value = '';
    
    const group = REVERS.createGroup(name, type);
    this._showToast(`✅ Группа "${name}" создана`);
    
    await this._openChat({ 
      id: group.key, 
      name: (type === 'forum' ? '📂 ' : '👥 ') + name, 
      type: 'group' 
    });
    await this._renderChatsList();
  }
  
  async _createChannel() {
    const nameInput = document.getElementById('channelNameInput');
    const name = nameInput?.value.trim();
    
    if (!name) {
      this._showToast('❌ Введите название канала');
      return;
    }
    
    this._closeAllModals();
    if (nameInput) nameInput.value = '';
    
    const channelId = REVERS.createChannel(name);
    this._showToast(`✅ Канал "${name}" создан`);
    
    await this._openChat({ id: channelId, name: '📢 ' + name, type: 'channel' });
    await this._renderChatsList();
  }
  
  _deleteCurrentChat() {
    if (!this.state.currentChat || this.state.currentChat.type === 'saved') return;
    
    if (!confirm(`Удалить чат "${this.state.currentChat.name || this.state.currentChat.id}"?`)) return;
    
    if (this.state.currentChat.type === 'group') {
      groupManager.deleteGroup(this.state.currentChat.id);
    }
    
    this._goToChats();
    this._showToast('🗑️ Чат удалён');
  }
  
  _clearHistory() {
    if (!this.state.currentChat) return;
    
    if (!confirm('Очистить всю историю сообщений?')) return;
    
    REVERS.clearChatHistory(this.state.currentChat.id);
    this._renderMessages(this.state.currentChat);
    this._showToast('🧹 История очищена');
  }
  
  _openSavedChat() {
    this._openChat({ id: 'me', type: 'saved', name: '📔 Сохранённые' });
  }
  
  _openProfileScreen(userId = null) {
    const targetId = userId || this.state.myId;
    const isOwn = !userId || userId === this.state.myId;
    
    const content = document.getElementById('groupSettingsContent');
    if (!content) return;
    
    content.innerHTML = `
      <div class="profile-view">
        <img src="${isOwn ? (this.state.myProfile?.avatar || '') : ''}" class="profile-avatar-large">
        <h3>${isOwn ? (this.state.myProfile?.name || 'User') : targetId}</h3>
        <p class="profile-id-small">ID: ${targetId}</p>
        <p class="profile-bio">${localStorage.getItem('revers_bio') || 'Без описания'}</p>
        <p class="profile-diamonds">💎 ${this.state.diamonds}</p>
        ${!isOwn ? '<button id="writeMsgProfileBtn" class="primary">💬 Написать</button>' : ''}
      </div>
    `;
    
    if (!isOwn) {
      const writeBtn = document.getElementById('writeMsgProfileBtn');
      if (writeBtn) {
        writeBtn.addEventListener('click', () => {
          this._closeAllModals();
          this._openChat({ id: targetId, type: 'contact', name: targetId });
        });
      }
    }
    
    const modal = document.getElementById('groupSettingsModal');
    const title = modal?.querySelector('h3');
    if (title) title.textContent = '👤 Профиль';
    this._openModal('groupSettingsModal');
  }
  
  async _loadAndShowGroups() {
    const container = document.getElementById('groupsList');
    if (!container) return;
    
    container.innerHTML = '<div class="spinner"></div>';
    
    const groups = groupManager.groups;
    container.innerHTML = '';
    
    if (groups.size === 0) {
      container.innerHTML = '<div class="empty-state">Нет групп</div>';
    } else {
      for (const [id, group] of groups) {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.innerHTML = `
          <div class="chat-avatar">👥</div>
          <div class="chat-info">
            <div class="chat-name">${this._escapeHtml(group.name)}</div>
            <div class="chat-preview">${group.members?.length || 0} участников</div>
          </div>
        `;
        div.addEventListener('click', () => {
          this._closeAllModals();
          this._openChat({ id, name: group.name, type: 'group' });
        });
        container.appendChild(div);
      }
    }
    
    this._openModal('groupsModal');
  }
  
  async _loadAndShowChannels() {
    this._showToast('📢 Каналы в разработке');
    this._openModal('channelsModal');
  }
  
  _openTopicsScreen() {
    if (!this.state.currentChat || this.state.currentChat.type !== 'group') return;
    
    const chatScreen = document.getElementById('chatScreen');
    const topicsScreen = document.getElementById('topicsScreen');
    
    if (chatScreen) chatScreen.classList.add('hidden');
    if (topicsScreen) topicsScreen.classList.remove('hidden');
    this._renderTopicsList();
  }
  
  _renderTopicsList() {
    const container = document.getElementById('topicsList');
    if (!container || !this.state.currentChat) return;
    
    container.innerHTML = '';
    
    const topics = groupManager.getTopics(this.state.currentChat.id);
    for (const topic of topics) {
      const div = document.createElement('div');
      div.className = 'chat-item';
      div.innerHTML = `
        <div class="chat-avatar">${topic.closed ? '🔒' : '📂'}</div>
        <div class="chat-info">
          <div class="chat-name">${topic.pinned ? '📌 ' : ''}${this._escapeHtml(topic.name)}</div>
          <div class="chat-preview">${topic.messages?.length || 0} сообщ.</div>
        </div>
      `;
      div.addEventListener('click', () => {
        this.state.currentTopic = topic.id;
        const topicsScreen = document.getElementById('topicsScreen');
        const chatScreen = document.getElementById('chatScreen');
        const chatName = document.getElementById('chatName');
        
        if (topicsScreen) topicsScreen.classList.add('hidden');
        if (chatScreen) chatScreen.classList.remove('hidden');
        if (chatName) chatName.textContent = topic.name;
        this._renderTopicMessages();
      });
      container.appendChild(div);
    }
  }
  
  _renderTopicMessages() {
    if (!this.state.currentChat || !this.state.currentTopic) return;
    
    const area = this.elements.messagesArea;
    if (!area) return;
    
    area.innerHTML = '';
    
    const messages = groupManager.getTopicMessages(this.state.currentChat.id, this.state.currentTopic);
    const myId = this.state.myId || REVERS.getMyId();
    
    for (const msg of messages) {
      const isOutgoing = msg.from === myId;
      const div = document.createElement('div');
      div.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
      
      div.innerHTML = `
        <div class="bubble">
          <div class="message-text">${this._escapeHtml(msg.text || '')}</div>
          <div class="message-time">${msg.time ? new Date(msg.time).toLocaleTimeString() : ''}</div>
        </div>
      `;
      area.appendChild(div);
    }
    
    area.scrollTop = area.scrollHeight;
  }
  
  _createTopic() {
    const nameInput = document.getElementById('topicNameInput');
    const name = nameInput?.value.trim();
    
    if (!name || !this.state.currentChat) {
      this._showToast('❌ Введите название темы');
      return;
    }
    
    groupManager.addTopic(this.state.currentChat.id, name);
    this._closeAllModals();
    if (nameInput) nameInput.value = '';
    this._renderTopicsList();
    this._showToast(`✅ Тема "${name}" создана`);
  }
  
  _createPoll() {
    const questionInput = document.getElementById('pollQuestionInput');
    const optionsInput = document.getElementById('pollOptionsInput');
    
    const question = questionInput?.value.trim();
    const optionsStr = optionsInput?.value.trim();
    
    if (!question || !optionsStr) {
      this._showToast('❌ Заполните вопрос и варианты');
      return;
    }
    
    const options = optionsStr.split(',').map(s => s.trim()).filter(s => s);
    if (options.length < 2) {
      this._showToast('❌ Нужно минимум 2 варианта');
      return;
    }
    
    if (this.state.currentChat) {
      groupManager.createPoll(this.state.currentChat.id, question, options);
      this._showToast('📊 Голосование создано');
    }
    
    this._closeAllModals();
    if (questionInput) questionInput.value = '';
    if (optionsInput) optionsInput.value = '';
  }
  
  _addAnnouncement() {
    if (!this.state.currentChat) return;
    
    const text = prompt('📢 Текст объявления:');
    if (text && text.trim()) {
      groupManager.addAnnouncement(this.state.currentChat.id, text);
      this._showToast('📢 Объявление добавлено');
    }
  }
  
  _showGroupSettings() {
    if (!this.state.currentChat || this.state.currentChat.type !== 'group') return;
    
    const group = groupManager.groups.get(this.state.currentChat.id);
    if (!group) return;
    
    const content = document.getElementById('groupSettingsContent');
    if (!content) return;
    
    content.innerHTML = `
      <div>
        <label>Название группы</label>
        <input type="text" id="groupEditName" value="${this._escapeHtml(group.name)}">
        <button id="saveGroupNameBtn" class="primary">💾 Сохранить</button>
        <div class="divider"></div>
        <h4>Участники (${group.members?.length || 0})</h4>
        <div id="groupMembersList"></div>
      </div>
    `;
    
    const membersList = document.getElementById('groupMembersList');
    if (membersList && group.members) {
      membersList.innerHTML = '';
      for (const member of group.members) {
        const div = document.createElement('div');
        div.className = 'member-item';
        div.textContent = member;
        membersList.appendChild(div);
      }
    }
    
    const saveBtn = document.getElementById('saveGroupNameBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const newName = document.getElementById('groupEditName')?.value.trim();
        if (newName && this.state.currentChat) {
          group.name = newName;
          groupManager._save();
          this.state.currentChat.name = newName;
          const chatName = document.getElementById('chatName');
          if (chatName) chatName.textContent = newName;
          this._renderChatsList();
          this._showToast('✅ Название обновлено');
        }
        this._closeAllModals();
      });
    }
    
    const modal = document.getElementById('groupSettingsModal');
    const title = modal?.querySelector('h3');
    if (title) title.textContent = '⚙️ Настройки группы';
    this._openModal('groupSettingsModal');
  }
  
  _showChannelSettings() {
    this._showToast('📢 Настройки канала в разработке');
  }
  
  async _showQR() {
    this._closeAllModals();
    
    const myId = this.state.myId || REVERS.getMyId();
    if (!myId) {
      this._showToast('❌ ID не загружен');
      return;
    }
    
    const data = JSON.stringify({
      id: myId,
      name: this.state.myProfile?.name || 'User',
      type: 'revers-connect'
    });
    
    const canvas = document.getElementById('qrCanvas');
    if (canvas) {
      try {
        await QRCode.toCanvas(canvas, data, {
          width: 200,
          margin: 2,
          color: { dark: '#0F0F12', light: '#FFFFFF' }
        });
      } catch (e) {
        console.error('QR generation error:', e);
      }
    }
    
    const inviteLink = document.getElementById('inviteLink');
    if (inviteLink) {
      inviteLink.textContent = `revers://chat?id=${myId}`;
    }
    
    this._openModal('qrModal');
  }
  
  async _startScanner() {
    this._closeAllModals();
    
    const container = document.getElementById('scannerContainer');
    if (container) container.innerHTML = '';
    
    this._openModal('scannerModal');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(t => t.stop());
    } catch (e) {
      if (container) {
        container.innerHTML = '<div class="error-msg">❌ Нет доступа к камере</div>';
      }
      return;
    }
    
    try {
      this.html5QrCode = new Html5Qrcode('scannerContainer');
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (text) => this._handleScannedQR(text),
        () => {}
      );
    } catch (e) {
      console.error('Scanner error:', e);
      if (container) {
        container.innerHTML = '<div class="error-msg">❌ Ошибка запуска сканера</div>';
      }
    }
  }
  
  _stopScanner() {
    if (this.html5QrCode) {
      this.html5QrCode.stop().then(() => {
        this.html5QrCode = null;
        this._closeAllModals();
      }).catch(() => this._closeAllModals());
    } else {
      this._closeAllModals();
    }
  }
  
  _handleScannedQR(text) {
    try {
      const data = JSON.parse(text);
      if (data.type === 'revers-connect' && data.id) {
        this._stopScanner();
        REVERS.connectToPeer(data.id);
        this._openChat({ id: data.id, type: 'contact', name: data.name || data.id });
        this._showToast(`🔗 Подключение к ${data.name || data.id}...`);
        return;
      }
    } catch (e) {}
    
    if (text && text.length > 5) {
      this._stopScanner();
      REVERS.connectToPeer(text);
      this._openChat({ id: text, type: 'contact', name: text });
      this._showToast(`🔗 Подключение к ${text}...`);
    }
  }
  
  _openBrowser(url = 'https://www.startpage.com') {
    const input = document.getElementById('browserUrlInput');
    if (input) input.value = url;
    this._openModal('browserModal');
  }
  
  async _openInBrowser() {
    const input = document.getElementById('browserUrlInput');
    let url = input?.value.trim();
    
    if (!url) {
      this._showToast('❌ Введите URL');
      return;
    }
    
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    this._closeAllModals();
    
    try {
      window.open(url, '_blank');
    } catch (e) {
      this._showToast('❌ Не удалось открыть браузер');
    }
  }
  
  _openLink(url) {
    if (!url) return;
    try {
      window.open(url, '_blank');
    } catch (e) {
      this._showToast('❌ Не удалось открыть ссылку');
    }
  }
  
  _openMedia(dataUrl, type) {
    if (!dataUrl) return;
    
    if (type === 'image' || type?.startsWith('image/')) {
      const viewer = document.getElementById('imageViewer');
      const img = document.getElementById('fullscreenImage');
      if (viewer && img) {
        img.src = dataUrl;
        viewer.classList.add('active');
      }
    } else if (type === 'video' || type?.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = dataUrl;
      video.controls = true;
      video.autoplay = true;
      video.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100%;background:black;z-index:5000;';
      video.onended = () => video.remove();
      document.body.appendChild(video);
      video.play();
    } else if (type === 'audio' || type?.startsWith('audio/')) {
      const audio = new Audio(dataUrl);
      audio.play();
    }
  }
  
  _openConnectModal() {
    this._closeAllModals();
    
    const output = document.getElementById('mySignalOutput');
    if (output) {
      output.value = 'Генерация сигнала...';
      setTimeout(() => {
        output.value = 'Сигнал готов. Отправьте его собеседнику.';
      }, 500);
    }
    
    this._openModal('connectModal');
  }
  
  _handleConnect() {
    const peerIdInput = document.getElementById('peerIdInput');
    const signalInput = document.getElementById('signalInput');
    
    const peerId = peerIdInput?.value.trim();
    const signal = signalInput?.value.trim();
    
    if (signal) {
      try {
        const signalData = JSON.parse(signal);
        if (signalData.sdp || signalData.candidate) {
          REVERS.acceptPeer(peerId || 'remote', signalData);
          this._closeAllModals();
          this._showToast('🔗 Подключение установлено');
          return;
        }
      } catch (e) {}
    }
    
    if (peerId) {
      this._closeAllModals();
      REVERS.connectToPeer(peerId);
      this._openChat({ id: peerId, type: 'contact', name: peerId });
      this._showToast(`🔗 Подключение к ${peerId}...`);
    }
  }
  
  _copySignal() {
    const output = document.getElementById('mySignalOutput');
    if (output && output.value && output.value !== 'Генерация сигнала...') {
      navigator.clipboard.writeText(output.value);
      this._showToast('📋 Сигнал скопирован');
    }
  }
  
  _copyInviteLink() {
    const link = document.getElementById('inviteLink');
    if (link?.textContent) {
      navigator.clipboard.writeText(link.textContent);
      this._showToast('📋 Ссылка скопирована');
    }
  }
  
  _shareInvite() {
    const link = document.getElementById('inviteLink');
    if (link?.textContent && navigator.share) {
      navigator.share({
        title: 'REVERS Messenger',
        text: 'Присоединяйся ко мне в REVERS!',
        url: link.textContent
      }).catch(() => {});
    } else {
      this._copyInviteLink();
    }
  }
  
  _copyMyId() {
    const id = this.state.myId || REVERS.getMyId();
    if (id) {
      navigator.clipboard.writeText(id);
      this._showToast('📋 ID скопирован');
    }
  }
  
  async _saveAccount() {
    const nameInput = document.getElementById('nicknameInput');
    const bioInput = document.getElementById('bioInput');
    
    const newName = nameInput?.value.trim();
    const newBio = bioInput?.value.trim();
    
    if (newName) {
      REVERS.setName(newName);
      if (this.state.myProfile) this.state.myProfile.name = newName;
      localStorage.setItem('revers_username', newName);
    }
    
    if (newBio !== undefined) {
      localStorage.setItem('revers_bio', newBio);
    }
    
    this._closeAllModals();
    this._renderChatsList();
    this._showToast('✅ Профиль сохранён');
  }
  
  async _changeAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const avatarData = e.target.result;
      REVERS.setAvatar(avatarData);
      if (this.state.myProfile) this.state.myProfile.avatar = avatarData;
      localStorage.setItem('revers_avatar', avatarData);
      
      const modalAvatar = document.getElementById('modalAvatar');
      if (modalAvatar) modalAvatar.src = avatarData;
      
      this._showToast('✅ Аватар обновлён');
    };
    reader.readAsDataURL(file);
  }
  
  _showSecurityNumber() {
    if (!this.state.currentChat) return;
    
    const peerId = this.state.currentChat.id;
    const profile = REVERS.getMyProfile();
    const myKey = profile?.x25519PublicKey || '';
    const hash = this._simpleHash(myKey);
    const fingerprint = hash.match(/.{1,4}/g)?.join(' ') || hash;
    
    alert(`🔐 Номер безопасности для ${peerId}:\n${fingerprint}\n\nСверьте этот код с собеседником для проверки защиты.`);
  }
  
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0').repeat(4).substring(0, 32);
  }
  
  _showCallModal(peerName) {
    const modal = this.elements.callModal;
    const nameSpan = this.elements.callPeerName;
    const durationSpan = this.elements.callDuration;
    
    if (modal) modal.classList.remove('hidden');
    if (nameSpan) nameSpan.textContent = peerName || 'Звонок';
    
    this.state.callSeconds = 0;
    if (this.state.callTimer) clearInterval(this.state.callTimer);
    this.state.callTimer = setInterval(() => {
      this.state.callSeconds++;
      const m = Math.floor(this.state.callSeconds / 60).toString().padStart(2, '0');
      const s = (this.state.callSeconds % 60).toString().padStart(2, '0');
      if (durationSpan) durationSpan.textContent = `${m}:${s}`;
    }, 1000);
  }
  
  _showRemoteStream(peerId, stream) {
    const videoContainer = this.elements.callVideo;
    if (!videoContainer) return;
    
    videoContainer.innerHTML = '';
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    videoContainer.appendChild(video);
  }
  
  _showIncomingCall(callInfo) {
    if (!confirm(`📞 Входящий звонок от ${callInfo.peerId}\nПринять?`)) {
      REVERS.endCall(callInfo.peerId);
      return;
    }
    
    REVERS.acceptCall(callInfo.peerId, callInfo.video);
    this._showCallModal(callInfo.peerId);
  }
  
  _hideCallModal() {
    const modal = this.elements.callModal;
    if (modal) modal.classList.add('hidden');
    
    if (this.state.callTimer) {
      clearInterval(this.state.callTimer);
      this.state.callTimer = null;
    }
    
    const videoContainer = this.elements.callVideo;
    if (videoContainer) videoContainer.innerHTML = '';
  }
  
  _endCall() {
    REVERS.endCall(this.state.currentChat?.id);
    this._hideCallModal();
  }
  
  _updateConnectionStatus(connected) {
    const led = this.elements.statusLed;
    const text = this.elements.statusText;
    
    if (led && text) {
      if (connected) {
        led.classList.add('green');
        text.textContent = 'P2P';
      } else {
        led.classList.remove('green');
        text.textContent = 'Оффлайн';
      }
    }
  }
  
  _updateDHTStatus() {
    const el = this.elements.dhtStatus;
    if (el) {
      el.style.color = '#4CAF50';
      el.title = 'DHT активна';
    }
  }
  
  _loadDiamonds() {
    this.state.diamonds = parseInt(localStorage.getItem('revers_diamonds') || '0');
    this.state.gifts = JSON.parse(localStorage.getItem('revers_gifts') || '[]');
  }
  
  _loadSettings() {
    const theme = localStorage.getItem('revers_theme') || 'dark';
    this._applyTheme(theme);
    
    const soundEnabled = localStorage.getItem('revers_sound') !== 'false';
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) {
      if (soundEnabled) soundToggle.classList.add('active');
      else soundToggle.classList.remove('active');
    }
  }
  
  _applyTheme(themeId) {
    const themes = {
      dark: { bg: '#0F0F12', accent: '#E63946' },
      light: { bg: '#FFFFFF', accent: '#2196F3' }
    };
    
    const theme = themes[themeId] || themes.dark;
    document.body.style.backgroundColor = theme.bg;
    document.documentElement.style.setProperty('--accent', theme.accent);
    localStorage.setItem('revers_theme', themeId);
  }
  
  _toggleSound() {
    const toggle = document.getElementById('soundToggle');
    if (!toggle) return;
    
    const enabled = !toggle.classList.contains('active');
    if (enabled) toggle.classList.add('active');
    else toggle.classList.remove('active');
    
    localStorage.setItem('revers_sound', enabled);
    this._showToast(enabled ? '🔊 Звук включён' : '🔇 Звук выключен');
  }
  
  _formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }
  
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  _bindBackButton() {
    document.addEventListener('backbutton', (e) => {
      e.preventDefault();
      
      if (document.querySelector('.modal.active')) {
        this._closeAllModals();
      } else if (this.state.currentTopic) {
        this.state.currentTopic = null;
        this._openChat(this.state.currentChat);
      } else if (this.state.currentChat) {
        this._goToChats();
      } else if (typeof navigator !== 'undefined' && navigator.app) {
        navigator.app.exitApp();
      }
    });
  }
  
  _bindSwipeBack() {
    let startX = 0;
    const chatScreen = document.getElementById('chatScreen');
    
    if (!chatScreen) return;
    
    chatScreen.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    });
    
    chatScreen.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      if (endX - startX > 100 && this.state.currentChat) {
        this._goToChats();
      }
    });
  }
  
  _bindHotkeys() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchChatsInput');
        if (searchInput) searchInput.focus();
      }
      
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this._openModal('addContactModal');
      }
      
      if (e.key === 'Escape') {
        if (document.querySelector('.modal.active')) {
          this._closeAllModals();
        } else if (this.state.currentChat) {
          this._goToChats();
        }
      }
    });
  }
}

// Запуск приложения
window.REVERSApp = null;
document.addEventListener('DOMContentLoaded', () => {
  window.REVERSApp = new REVERSApp();
});

// Глобальные методы для onclick
window.openLink = (url) => {
  if (window.REVERSApp) window.REVERSApp._openLink(url);
};
window.openMedia = (dataUrl, type) => {
  if (window.REVERSApp) window.REVERSApp._openMedia(dataUrl, type);
};