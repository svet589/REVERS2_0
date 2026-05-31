// REVERS Messenger v3.2 — ИТОГОВЫЙ
// Лицензия: GNU GPL v3
// Разработчик: https://github.com/svet589

import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import stickerManager from './core/sticker-manager.js';
import messageHandler from './core/message-handler.js';
import groupManager from './core/group-manager.js';
import callManager from './core/call-manager.js';
import swarmManager from './core/swarm-manager.js';
import p2pNetwork from './core/p2p-network.js';
import identity from './core/identity.js';

class REVERSApp {
  constructor() {
    this.currentChat = null;
    this._currentTopic = null;
    this.replyTo = null;
    this._editingMessage = null;
    this.html5QrCode = null;
    this.isRecording = false;
    this.voiceRecorder = null;
    this.voiceStartTime = null;
    this._activeStickerPack = 'recent';
    this._selectedMsg = null;
    this._currentGroupCallId = null;
    this._callTimer = null;
    this._callSeconds = 0;
    this.typingTimeout = null;
    this.folders = { personal: { name: '💬 Личное' }, groups: { name: '👥 Группы' }, channels: { name: '📢 Каналы' } };
    this._themes = {
      default: { bg: '#0F0F12', accent: '#E63946', name: 'Тёмная' },
      night: { bg: '#000000', accent: '#4CAF50', name: 'Ночная' },
      light: { bg: '#FFFFFF', accent: '#2196F3', name: 'Светлая' }
    };
    this._currentTheme = localStorage.getItem('revers_theme') || 'default';
    this._readObserver = null;
    this._buildDOM();
    this._bindEvents();
    this._bindBackButton();
    this._bindSwipeBack();
    this._bindHotkeys();
    this._init();
  }

  async _init() {
    await identity.ready();
    await swarmManager.start();
    this._applyTheme(this._currentTheme);
    this._setupReadObserver();
    this._loadFontSize();
    this._onReady();
  }

  _buildDOM() {
    const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle fill=%22%232A2A3A%22 cx=%2250%22 cy=%2250%22 r=%2250%22/%3E%3Ctext x=%2250%22 y=%2267%22 text-anchor=%22middle%22 fill=%22%23E63946%22 font-size=%2240%22%3E🦊%3C/text%3E%3C/svg%3E';
    document.getElementById('app').innerHTML = `
      <div class="app-header"><h1>REVERS</h1><span id="dhtStatus">🌐</span></div>
      <div id="chatsScreen" class="screen">
        <div class="chats-header"><button class="menu-btn" id="menuBtn">☰</button><div class="chats-title">Чаты</div><div style="display:flex;gap:8px;"><button class="action-icon" id="searchChatsBtn">🔍</button><button class="action-icon" id="addContactBtn">➕</button></div></div>
        <div class="folder-tabs" id="folderTabs"></div>
        <div class="search-bar hidden" id="searchChatsBar"><input type="text" class="search-input" id="searchChatsInput" placeholder="Поиск..."><button class="action-icon" id="searchChatsCloseBtn">✖</button></div>
        <div class="chats-list" id="chatsList"></div>
      </div>
      <div id="chatScreen" class="screen hidden">
        <div class="chat-header"><button class="back-btn" id="backBtn">←</button><span class="current-chat-name" id="chatName">Чат</span><span id="typingIndicator" style="font-size:0.7rem;color:#4CAF50;"></span><span id="connectionIcon"></span><div class="connection-status"><div class="status-led" id="statusLed"></div><span id="statusText">Оффлайн</span></div><button class="menu-btn" id="chatMenuBtn">⋮</button></div>
        <div class="chat-dropdown hidden" id="contactDropdown"><button class="dropdown-item" id="inviteToChatBtn">🔗 Пригласить</button><button class="dropdown-item" id="searchInChatBtn">🔍 Поиск</button><button class="dropdown-item" id="pinnedMsgBtn">📌 Закреп</button><div class="dropdown-divider"></div><button class="dropdown-item" id="callBtn">📹 Видеозвонок</button><button class="dropdown-item" id="audioCallBtn">📞 Аудиозвонок</button><button class="dropdown-item" id="connectPeerBtn">🔗 Подключиться</button><div class="dropdown-divider"></div><button class="dropdown-item" id="exportChatBtn">💾 JSON</button><button class="dropdown-item" id="exportHTMLBtn">📄 HTML</button><div class="dropdown-divider"></div><button class="dropdown-item" id="increaseFontBtn">🔤 +</button><button class="dropdown-item" id="decreaseFontBtn">🔤 -</button><div class="dropdown-divider"></div><button class="dropdown-item danger" id="deleteChatBtn">🗑️ Удалить</button><button class="dropdown-item danger" id="clearHistoryBtn">🧹 Очистить</button></div>
        <div class="chat-dropdown hidden" id="groupDropdown"><button class="dropdown-item" id="inviteToChatBtn">🔗 Пригласить</button><button class="dropdown-item" id="topicsMenuBtn">📂 Темы</button><button class="dropdown-item" id="searchInChatBtn">🔍 Поиск</button><button class="dropdown-item" id="pinnedMsgBtn">📌 Закреп</button><div class="dropdown-divider"></div><button class="dropdown-item" id="groupCallBtn">👥 Групповой звонок</button><button class="dropdown-item" id="createPollBtn">📊 Голосование</button><button class="dropdown-item" id="addAnnouncementBtn">📌 Объявление</button><div class="dropdown-divider"></div><button class="dropdown-item" id="groupSettingsBtn">⚙️ Настройки</button><button class="dropdown-item" id="exportChatBtn">💾 JSON</button><button class="dropdown-item" id="exportHTMLBtn">📄 HTML</button><div class="dropdown-divider"></div><button class="dropdown-item" id="increaseFontBtn">🔤 +</button><button class="dropdown-item" id="decreaseFontBtn">🔤 -</button><div class="dropdown-divider"></div><button class="dropdown-item danger" id="deleteChatBtn">🗑️ Удалить</button></div>
        <div class="chat-dropdown hidden" id="channelDropdown"><button class="dropdown-item" id="inviteToChatBtn">🔗 Пригласить</button><button class="dropdown-item" id="searchInChatBtn">🔍 Поиск</button><button class="dropdown-item" id="channelSettingsBtn">⚙️ Настройки</button><button class="dropdown-item" id="exportChatBtn">💾 JSON</button><button class="dropdown-item" id="exportHTMLBtn">📄 HTML</button><div class="dropdown-divider"></div><button class="dropdown-item" id="increaseFontBtn">🔤 +</button><button class="dropdown-item" id="decreaseFontBtn">🔤 -</button><div class="dropdown-divider"></div><button class="dropdown-item danger" id="deleteChatBtn">🗑️ Удалить</button></div>
        <div class="chat-dropdown hidden" id="savedDropdown"><button class="dropdown-item" id="searchInChatBtn">🔍 Поиск</button><button class="dropdown-item" id="pinnedMsgBtn">📌 Закреп</button><button class="dropdown-item" id="exportChatBtn">💾 JSON</button><button class="dropdown-item" id="exportHTMLBtn">📄 HTML</button></div>
        <div class="search-bar hidden" id="searchInChatBar"><input type="text" class="search-input" id="searchInChatInput" placeholder="Поиск..."><span class="search-counter" id="searchCounter">0/0</span><button class="action-icon" id="searchPrevBtn">⬆️</button><button class="action-icon" id="searchNextBtn">⬇️</button><button class="action-icon" id="searchInChatCloseBtn">✖</button></div>
        <div id="pinnedMessage" class="pinned-message hidden"><div id="pinnedText"></div><button id="unpinBtn">✖</button></div>
        <div class="messages-area" id="messagesArea"></div>
        <div class="reply-bar hidden" id="replyBar"><div class="reply-bar-text" id="replyBarText"></div><button class="reply-bar-close" id="replyBarClose">✖</button></div>
        <div class="edit-indicator hidden" id="editIndicator" style="padding:4px 16px;background:#1A1A23;color:#E63946;font-size:0.7rem;">✏️ Редактирование</div>
        <div class="input-panel"><button class="sticker-btn" id="stickerToggleBtn">😊</button><button class="sticker-btn" id="voiceRecordBtn">🎤</button><div class="message-input-wrapper"><input type="text" class="message-input" id="messageInput" placeholder="Сообщение..."><label class="file-label" for="fileInput">📎</label><input type="file" id="fileInput"><button class="send-btn" id="sendBtn">➤</button></div></div>
        <div class="sticker-panel hidden" id="stickerPanel"><div class="sticker-tabs" id="stickerTabs"></div><div class="sticker-grid" id="stickerGrid"></div><div class="sticker-pack-actions hidden" id="stickerPackActions"><button id="addStickerToPackBtn">➕</button><button id="deleteStickerPackBtn" class="danger">🗑️</button></div></div>
      </div>
      <div id="topicsScreen" class="screen hidden"><div class="chat-header"><button class="back-btn" id="topicsBackBtn">←</button><span class="current-chat-name">Темы</span><button class="action-icon" id="addTopicBtn">➕</button></div><div class="topics-list" id="topicsList"></div></div>
      <div class="reaction-panel hidden" id="reactionPanel"><div class="reaction-emoji" data-emoji="👍">👍</div><div class="reaction-emoji" data-emoji="😂">😂</div><div class="reaction-emoji" data-emoji="❤️">❤️</div><div class="reaction-emoji" data-emoji="😮">😮</div><div class="reaction-emoji" data-emoji="🔥">🔥</div><div class="reaction-emoji" data-emoji="💯">💯</div></div>
      <div class="context-menu hidden" id="contextMenu"><button class="dropdown-item" id="ctxEdit">✏️ Редактировать</button><button class="dropdown-item" id="ctxReply">↩️ Ответить</button><button class="dropdown-item" id="ctxPin">📌 Закрепить</button><button class="dropdown-item" id="ctxCopy">📋 Копировать</button><div class="dropdown-divider"></div><button class="dropdown-item danger" id="ctxDelete">🗑️ Удалить</button></div>
      <div class="sidebar" id="sidebar"><div class="sidebar-header">REVERS</div><div class="sidebar-menu"><button class="menu-item" id="qrMenuBtn">🔳 QR</button><button class="menu-item" id="scanMenuBtn">📷 Сканер</button><button class="menu-item" id="savedMenuBtn">📔 Сохранённые</button><button class="menu-item" id="browserMenuBtn">🌐 Браузер</button><button class="menu-item" id="accountMenuBtn">👤 Аккаунт</button><button class="menu-item" id="groupsMenuBtn">👥 Группы</button><button class="menu-item" id="channelsMenuBtn">📢 Каналы</button><button class="menu-item" id="settingsMenuBtn">⚙️ Настройки</button><button class="menu-item" id="aboutMenuBtn">ℹ️ О нас</button></div></div>
      <div class="overlay" id="overlay"></div>
      <div class="modal" id="addContactModal"><h3>➕ Добавить</h3><input type="text" id="addContactIdInput" placeholder="ID"><button id="addContactConfirmBtn">Добавить</button><button id="addContactCloseBtn" class="secondary">Закрыть</button></div>
      <div class="modal" id="connectModal"><h3>🔗 Подключиться</h3><input type="text" id="peerIdInput" placeholder="ID"><input type="text" id="signalInput" placeholder="Сигнал"><button id="connectSendBtn">Подключиться</button><textarea id="mySignalOutput" readonly style="width:100%;height:60px;background:#0F0F12;color:#2A9D8F;border:none;border-radius:12px;padding:8px;font-size:0.65rem;resize:none;margin-top:4px;"></textarea><button id="copySignalBtn" class="secondary">📋</button><button id="closeConnectBtn" class="secondary">Закрыть</button></div>
      <div class="modal" id="qrModal"><h3>🔳 QR</h3><canvas id="qrCanvas" style="width:200px;height:200px;background:white;border-radius:20px;margin:0 auto;display:block;"></canvas><code id="inviteLink" style="color:#2A9D8F;font-size:0.6rem;display:block;margin-top:8px;word-break:break-all;"></code><button id="copyInviteLinkBtn" class="secondary">📋</button><button id="shareInviteBtn" class="secondary">📤</button><button id="closeQrBtn" class="secondary">Закрыть</button></div>
      <div class="modal" id="scannerModal"><h3>📷 Сканер</h3><div id="scannerContainer"></div><button id="stopScannerBtn" class="secondary">Отмена</button></div>
      <div class="modal" id="browserModal"><h3>🌐 Браузер</h3><input type="text" id="browserUrlInput" placeholder="https://..."><button id="browserGoBtn">Открыть</button><button id="closeBrowserBtn" class="secondary">Закрыть</button></div>
      <div class="modal" id="accountModal"><h3>Аккаунт</h3><img id="modalAvatar" class="avatar-modal-img" src="${identity.getProfile().avatar || defaultAvatar}"><button id="changeAvatarBtn" class="secondary">Сменить</button><input type="file" id="modalAvatarInput" accept="image/*" style="display:none"><div id="myIdDisplay" style="color:white;font-family:monospace;font-size:0.7rem;word-break:break-all;">${identity.id}</div><button id="copyIdBtn" class="secondary">📋 ID</button><input type="text" id="nicknameInput" value="${identity.name}"><button id="saveAccountBtn">Сохранить</button><button id="closeAccountBtn" class="secondary">Закрыть</button></div>
      <div class="modal" id="groupsModal"><h3>👥 Группы</h3><div id="groupsList"></div><button id="createGroupBtn">➕ Создать</button><button id="closeGroupsBtn" class="secondary">Закрыть</button></div>
      <div class="modal" id="createGroupModal"><h3>Группа</h3><input type="text" id="groupNameInput" placeholder="Название"><select id="groupTypeSelect"><option value="chat">💬 Чат</option><option value="forum">📂 Форум</option></select><button id="confirmGroupBtn">Создать</button><button id="cancelGroupBtn" class="secondary">Отмена</button></div>
      <div class="modal" id="channelsModal"><h3>📢 Каналы</h3><div id="channelsList"></div><button id="createChannelBtn">➕ Создать</button><button id="closeChannelsBtn" class="secondary">Закрыть</button></div>
      <div class="modal" id="createChannelModal"><h3>Канал</h3><input type="text" id="channelNameInput" placeholder="Название"><button id="confirmChannelBtn">Создать</button><button id="cancelChannelBtn" class="secondary">Отмена</button></div>
      <div class="modal" id="groupSettingsModal"><h3>⚙️ Настройки</h3><div id="groupSettingsContent"></div><button id="closeGroupSettingsBtn" class="secondary">Закрыть</button></div>
      <div class="modal" id="createTopicModal"><h3>📂 Тема</h3><input type="text" id="topicNameInput" placeholder="Название"><div class="setting-row"><span>🔒 Закрытая</span><div id="topicClosedToggle" class="toggle-switch"></div></div><button id="confirmTopicBtn">Создать</button><button id="cancelTopicBtn" class="secondary">Отмена</button></div>
      <div class="modal" id="createPollModal"><h3>📊 Голосование</h3><input type="text" id="pollQuestionInput" placeholder="Вопрос"><input type="text" id="pollOptionsInput" placeholder="Варианты через запятую"><div class="setting-row"><span>Анонимное</span><div id="pollAnonymousToggle" class="toggle-switch"></div></div><button id="confirmPollBtn">Создать</button><button id="cancelPollBtn" class="secondary">Отмена</button></div>
      <div class="modal" id="settingsModal"><h3>⚙️ Настройки</h3><div class="setting-row"><span>🌓 Тема</span><select id="themeSelect">${Object.entries(this._themes).map(([id, t]) => `<option value="${id}" ${id === this._currentTheme ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div><div class="setting-row"><span>🔊 Звук</span><div id="soundToggle" class="toggle-switch active"></div></div><div class="setting-row"><span>📞 Звонки</span><div id="callsToggle" class="toggle-switch active"></div></div><div class="setting-row"><span>💾 Офлайн</span><div id="offlineToggle" class="toggle-switch active"></div></div><button id="closeSettingsBtn" class="secondary">Закрыть</button></div>
      <div class="modal" id="aboutModal"><h3>ℹ️ REVERS v3.2</h3><div style="color:#EFEFEF;font-size:0.85rem;"><p>P2P • X25519+ML-KEM • ChaCha20</p><p>Паутина • DHT • Анонимность</p><p style="font-size:0.7rem;color:#6C6C7A;">© 2025 GNU GPL v3</p></div><button id="closeAboutBtn" class="secondary">Закрыть</button></div>
      <div class="modal" id="createStickerPackModal"><h3>🎨 Пак</h3><input type="text" id="stickerPackNameInput" placeholder="Название"><button id="confirmStickerPackBtn">Создать</button><button id="cancelStickerPackBtn" class="secondary">Отмена</button></div>
      <div class="modal" id="addStickerModal"><h3>➕ Стикер</h3><input type="file" id="stickerFileInput" accept="image/*"><img id="stickerPreview" style="max-width:120px;max-height:120px;display:none;"><input type="text" id="stickerEmojiInput" placeholder="Эмодзи"><button id="confirmStickerBtn">Добавить</button><button id="cancelStickerBtn" class="secondary">Отмена</button></div>
      <div class="image-viewer" id="imageViewer"><img id="fullscreenImage"></div>
      <div class="call-modal hidden" id="callModal"><div class="call-header"><span id="callPeerName">Звонок</span><span id="callDuration">00:00</span></div><div class="call-video" id="callVideo"></div><div class="call-chat" id="callChat"></div><div class="call-input"><input type="text" id="callMessageInput" placeholder="Сообщение..."><button id="callSendBtn">➤</button></div><div class="call-controls"><button id="callMicBtn">🔇</button><button id="callCamBtn">📷</button><button id="callEndBtn">❌</button></div></div>
    `;
  }

  _bindEvents() {
    document.getElementById('menuBtn').addEventListener('click', () => this._toggleSidebar(true));
    document.getElementById('overlay').addEventListener('click', () => this._toggleSidebar(false));
    document.getElementById('backBtn').addEventListener('click', () => this._goToChats());
    document.getElementById('sendBtn').addEventListener('click', () => this._sendMessage());
    document.getElementById('messageInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._sendMessage(); });
    document.getElementById('messageInput').addEventListener('input', () => this._handleTyping());
    document.getElementById('messageInput').addEventListener('blur', () => this._saveDraft());
    document.getElementById('fileInput').addEventListener('change', (e) => { if (e.target.files[0]) this._sendFile(e.target.files[0]); e.target.value = ''; });
    document.getElementById('replyBarClose').addEventListener('click', () => { this.replyTo = null; document.getElementById('replyBar').classList.add('hidden'); });
    document.getElementById('chatMenuBtn').addEventListener('click', (e) => { e.stopPropagation(); this._showChatMenu(); });
    document.addEventListener('click', () => { document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden')); document.getElementById('reactionPanel').classList.add('hidden'); document.getElementById('contextMenu').classList.add('hidden'); });
    document.getElementById('inviteToChatBtn').addEventListener('click', () => { if (this.currentChat) this._shareInviteLink(this.currentChat); });
    document.getElementById('exportChatBtn').addEventListener('click', () => this._exportChat());
    document.getElementById('exportHTMLBtn').addEventListener('click', () => this._exportChatAsHTML());
    document.getElementById('increaseFontBtn').addEventListener('click', () => this._increaseFontSize());
    document.getElementById('decreaseFontBtn').addEventListener('click', () => this._decreaseFontSize());
    document.getElementById('searchInChatBtn').addEventListener('click', () => this._toggleSearchInChat());
    document.getElementById('searchInChatCloseBtn').addEventListener('click', () => this._toggleSearchInChat(false));
    document.getElementById('searchInChatInput').addEventListener('input', () => this._searchInChat());
    document.getElementById('searchPrevBtn').addEventListener('click', () => this._navigateSearch(-1));
    document.getElementById('searchNextBtn').addEventListener('click', () => this._navigateSearch(1));
    document.getElementById('pinnedMsgBtn').addEventListener('click', () => this._togglePinnedMessage());
    document.getElementById('unpinBtn').addEventListener('click', () => this._unpinMessage());
    document.getElementById('callBtn').addEventListener('click', () => { if (this.currentChat) callManager.startCall(this.currentChat.id, true); });
    document.getElementById('audioCallBtn').addEventListener('click', () => { if (this.currentChat) callManager.startCall(this.currentChat.id, false); });
    document.getElementById('groupCallBtn').addEventListener('click', async () => { if (this.currentChat) this._currentGroupCallId = await callManager.startGroupCall(this.currentChat.id, true); });
    document.getElementById('createPollBtn').addEventListener('click', () => this._openModal('createPollModal'));
    document.getElementById('confirmPollBtn').addEventListener('click', () => this._createPoll());
    document.getElementById('cancelPollBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('addAnnouncementBtn').addEventListener('click', () => this._addAnnouncement());
    document.getElementById('connectPeerBtn').addEventListener('click', () => this._openConnectModal());
    document.getElementById('voiceRecordBtn').addEventListener('click', () => this._toggleVoiceRecord());
    document.getElementById('deleteChatBtn').addEventListener('click', () => this._deleteCurrentChat());
    document.getElementById('clearHistoryBtn').addEventListener('click', () => this._clearHistory());
    document.getElementById('stickerToggleBtn').addEventListener('click', () => this._toggleStickerPanel());
    document.getElementById('confirmStickerPackBtn').addEventListener('click', () => this._createStickerPack());
    document.getElementById('cancelStickerPackBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('addStickerToPackBtn').addEventListener('click', () => this._openModal('addStickerModal'));
    document.getElementById('confirmStickerBtn').addEventListener('click', () => this._addStickerToPack());
    document.getElementById('cancelStickerBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('stickerFileInput').addEventListener('change', (e) => { if (e.target.files[0]) this._previewSticker(e.target.files[0]); });
    document.getElementById('deleteStickerPackBtn').addEventListener('click', () => this._deleteStickerPack());
    document.getElementById('topicsMenuBtn').addEventListener('click', () => this._openTopicsScreen());
    document.getElementById('topicsBackBtn').addEventListener('click', () => this._closeTopicsScreen());
    document.getElementById('addTopicBtn').addEventListener('click', () => this._openModal('createTopicModal'));
    document.getElementById('groupSettingsBtn').addEventListener('click', () => this._showGroupSettings());
    document.getElementById('channelSettingsBtn').addEventListener('click', () => this._showChannelSettings());
    document.getElementById('closeGroupSettingsBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('confirmTopicBtn').addEventListener('click', () => this._createTopic());
    document.getElementById('cancelTopicBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('topicClosedToggle').addEventListener('click', function() { this.classList.toggle('active'); });
    document.getElementById('pollAnonymousToggle').addEventListener('click', function() { this.classList.toggle('active'); });
    document.getElementById('ctxEdit').addEventListener('click', () => this._editSelectedMessage());
    document.getElementById('ctxReply').addEventListener('click', () => this._replyToSelectedMessage());
    document.getElementById('ctxPin').addEventListener('click', () => this._pinSelectedMessage());
    document.getElementById('ctxCopy').addEventListener('click', () => this._copySelectedMessage());
    document.getElementById('ctxDelete').addEventListener('click', () => this._deleteSelectedMessage());
    document.getElementById('searchChatsBtn').addEventListener('click', () => this._toggleChatSearch());
    document.getElementById('searchChatsCloseBtn').addEventListener('click', () => this._toggleChatSearch(false));
    document.getElementById('searchChatsInput').addEventListener('input', (e) => this._searchChatsGlobal(e.target.value));
    document.getElementById('addContactBtn').addEventListener('click', () => this._openModal('addContactModal'));
    document.getElementById('addContactConfirmBtn').addEventListener('click', () => this._addContact());
    document.getElementById('addContactCloseBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('connectSendBtn').addEventListener('click', () => this._handleConnect());
    document.getElementById('copySignalBtn').addEventListener('click', () => { const v = document.getElementById('mySignalOutput').value; if (v && v !== 'Генерация...') { navigator.clipboard.writeText(v); alert('Скопировано!'); } });
    document.getElementById('closeConnectBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('qrMenuBtn').addEventListener('click', () => this._showQR());
    document.getElementById('closeQrBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('copyInviteLinkBtn').addEventListener('click', () => { const l = document.getElementById('inviteLink').textContent; if (l) { navigator.clipboard.writeText(l); alert('Скопировано!'); } });
    document.getElementById('shareInviteBtn').addEventListener('click', () => { const l = document.getElementById('inviteLink').textContent; if (l && navigator.share) navigator.share({ title: 'REVERS', text: 'Присоединяйся!', url: l }).catch(() => {}); });
    document.getElementById('scanMenuBtn').addEventListener('click', () => this._startScanner());
    document.getElementById('stopScannerBtn').addEventListener('click', () => this._stopScanner());
    document.getElementById('browserMenuBtn').addEventListener('click', () => this._openBrowser());
    document.getElementById('closeBrowserBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('browserGoBtn').addEventListener('click', () => this._openInBrowser());
    document.getElementById('browserUrlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._openInBrowser(); });
    document.getElementById('savedMenuBtn').addEventListener('click', () => { this._toggleSidebar(false); this._openChat({ id: 'me', type: 'saved', name: '📔 Сохранённые' }); });
    document.getElementById('accountMenuBtn').addEventListener('click', () => this._openModal('accountModal'));
    document.getElementById('groupsMenuBtn').addEventListener('click', () => { this._renderGroupsList(); this._openModal('groupsModal'); });
    document.getElementById('channelsMenuBtn').addEventListener('click', () => { this._renderChannelsList(); this._openModal('channelsModal'); });
    document.getElementById('settingsMenuBtn').addEventListener('click', () => this._openModal('settingsModal'));
    document.getElementById('aboutMenuBtn').addEventListener('click', () => this._openModal('aboutModal'));
    document.getElementById('themeSelect').addEventListener('change', (e) => this._applyTheme(e.target.value));
    document.getElementById('soundToggle').addEventListener('click', () => this._toggleSound());
    document.getElementById('callsToggle').addEventListener('click', () => this._toggleCalls());
    document.getElementById('offlineToggle').addEventListener('click', () => this._toggleOffline());
    document.getElementById('saveAccountBtn').addEventListener('click', () => { const n = document.getElementById('nicknameInput').value.trim(); if (n) identity.setName(n); this._closeAllModals(); });
    document.getElementById('changeAvatarBtn').addEventListener('click', () => document.getElementById('modalAvatarInput').click());
    document.getElementById('modalAvatarInput').addEventListener('change', (e) => { if (e.target.files[0]) { const r = new FileReader(); r.onload = (ev) => { identity.setAvatar(ev.target.result); document.getElementById('modalAvatar').src = ev.target.result; }; r.readAsDataURL(e.target.files[0]); } });
    document.getElementById('copyIdBtn').addEventListener('click', () => { navigator.clipboard.writeText(identity.id); alert('ID скопирован!'); });
    document.getElementById('createGroupBtn').addEventListener('click', () => this._openModal('createGroupModal'));
    document.getElementById('confirmGroupBtn').addEventListener('click', () => this._createGroup());
    document.getElementById('cancelGroupBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('createChannelBtn').addEventListener('click', () => this._openModal('createChannelModal'));
    document.getElementById('confirmChannelBtn').addEventListener('click', () => this._createChannel());
    document.getElementById('cancelChannelBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('callSendBtn').addEventListener('click', () => this._sendCallMessage());
    document.getElementById('callMessageInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._sendCallMessage(); });
    document.getElementById('callMicBtn').addEventListener('click', () => callManager.toggleAudio(this.currentChat?.id));
    document.getElementById('callCamBtn').addEventListener('click', () => callManager.toggleVideo(this.currentChat?.id));
    document.getElementById('callEndBtn').addEventListener('click', () => this._endCall());
    document.querySelectorAll('.reaction-emoji').forEach(el => el.addEventListener('click', (e) => { e.stopPropagation(); this._addReaction(el.dataset.emoji); }));
    document.querySelectorAll('[id$="Btn"]').forEach(btn => { if (btn.id.startsWith('close') || btn.id.startsWith('cancel')) btn.addEventListener('click', () => this._closeAllModals()); });
    document.getElementById('imageViewer').addEventListener('click', () => document.getElementById('imageViewer').classList.remove('active'));
  }

  _bindBackButton() {
    document.addEventListener('backbutton', (e) => {
      e.preventDefault();
      if (document.querySelector('.modal.active')) this._closeAllModals();
      else if (this._currentTopic) { this._currentTopic = null; this._openChat(this.currentChat); }
      else if (this.currentChat) this._goToChats();
      else navigator.app.exitApp();
    });
  }

  _bindSwipeBack() {
    let startX = 0;
    document.getElementById('chatScreen').addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; });
    document.getElementById('chatScreen').addEventListener('touchend', (e) => { if (e.changedTouches[0].clientX - startX > 100 && this.currentChat) this._goToChats(); });
  }

  _bindHotkeys() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('searchChatsInput')?.focus(); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); this._openModal('addContactModal'); }
      if (e.key === 'Escape') { if (document.querySelector('.modal.active')) this._closeAllModals(); else if (this.currentChat) this._goToChats(); }
    });
  }

  _setupReadObserver() {
    this._readObserver = new IntersectionObserver((entries) => { entries.forEach(e => { if (e.isIntersecting) e.target.style.opacity = '1'; }); }, { threshold: 0.5 });
  }

  _applyTheme(id) { this._currentTheme = id; localStorage.setItem('revers_theme', id); const t = this._themes[id]; document.body.style.backgroundColor = t.bg; document.documentElement.style.setProperty('--accent', t.accent); }

  _onReady() {
    window.REVERSApp = this;
    this._initWelcomeGroup(); this._updateDHTStatus(); this._renderFolderTabs();
    messageHandler.onMessage((msg) => { if (msg.type === 'typing') this._showTyping(msg.from, msg.typing !== false); else if (msg.type === 'p2p-signal') this._handleIncomingSignal(msg); else if (this.currentChat && (this.currentChat.id === msg.from || this.currentChat.id === msg.room)) this._renderMessages(this.currentChat); this._renderChatsList(); });
    messageHandler.onChatUpdate(() => this._renderChatsList());
    callManager.onIncoming((d) => { if (confirm(`📹 Входящий ${d.video ? 'видео' : 'аудио'} звонок от ${d.peerId}. Ответить?`)) callManager.acceptCall(d.peerId, d.video).then(pc => { if (pc) pc.setRemoteDescription(new RTCSessionDescription(d.sdp)).then(() => pc.createAnswer().then(a => pc.setLocalDescription(a))); }); });
    callManager.onStream(({ peerId, stream }) => { document.getElementById('callModal').classList.remove('hidden'); document.getElementById('callPeerName').textContent = peerId; this._startCallTimer(); const v = document.getElementById('callVideo'); v.innerHTML = ''; const el = document.createElement('video'); el.srcObject = stream; el.autoplay = true; el.playsInline = true; el.style.width = '100%'; el.style.height = '200px'; v.appendChild(el); });
    callManager.onMessage(({ peerId, text, from }) => { const c = document.getElementById('callChat'); c.innerHTML += `<div style="color:#EFEFEF;font-size:0.8rem;margin:2px 0;"><b>${from}:</b> ${this._esc(text)}</div>`; c.scrollTop = c.scrollHeight; });
    callManager.onEnd(() => { document.getElementById('callModal').classList.add('hidden'); this._stopCallTimer(); });
    this._loadSettings(); this._renderChatsList(); this._toggleSidebar(false);
  }

  _initWelcomeGroup() { const k = localStorage.getItem('revers_welcome'); if (k && groupManager.groups.get(k)) return; if (k) localStorage.removeItem('revers_welcome'); const g = groupManager.createGroup('🖐 REVERS Welcome', 'forum'); const grp = groupManager.groups.get(g.key); if (grp) { grp.topics = [{ id: 'general', name: '💬 Общий чат', closed: false, pinned: true, created: Date.now(), messages: [] }, { id: 'rules', name: '📜 Правила', closed: true, pinned: true, created: Date.now(), messages: [] }, { id: 'help', name: '❓ Помощь', closed: false, pinned: false, created: Date.now(), messages: [] }]; groupManager._save(); } localStorage.setItem('revers_welcome', g.key); }
  _updateDHTStatus() { document.getElementById('dhtStatus').style.color = swarmManager._started ? '#4CAF50' : '#8E8E9A'; }
  _updateConnectionIcon() { if (!this.currentChat) return; const i = document.getElementById('connectionIcon'); const p = this.currentChat.id; if (p2pNetwork.isConnected(p)) { const e = p2pNetwork.peers.get(p); i.textContent = e?.relayChain?.length >= 3 ? '🕸️3' : e?.relayChain?.length === 2 ? '🕸️2' : '🔓'; } else i.textContent = swarmManager.isConnected(p) ? '🌐' : '💾'; }

  _showChatMenu() { document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden')); if (!this.currentChat) return; const id = this.currentChat.type === 'saved' ? 'savedDropdown' : this.currentChat.type === 'group' ? 'groupDropdown' : this.currentChat.type === 'channel' ? 'channelDropdown' : 'contactDropdown'; document.getElementById(id)?.classList.remove('hidden'); }

  _handleTyping() { if (this.typingTimeout) clearTimeout(this.typingTimeout); if (this.currentChat?.type === 'contact') messageHandler.sendTyping(this.currentChat.id); this.typingTimeout = setTimeout(() => { if (this.currentChat?.type === 'contact') messageHandler.sendTyping(this.currentChat.id, false); }, 1000); }
  _showTyping(pid, show) { if (this.currentChat?.id === pid) document.getElementById('typingIndicator').textContent = show ? 'печатает...' : ''; }

  _renderFolderTabs() { const t = document.getElementById('folderTabs'); if (!t) return; t.innerHTML = ''; Object.entries(this.folders).forEach(([id, f]) => { const tab = document.createElement('div'); tab.className = 'folder-tab'; tab.textContent = f.name; tab.addEventListener('click', () => this._renderChatsList(id)); t.appendChild(tab); }); }

  _searchChatsGlobal(q) { if (!q) { this._renderChatsList(); return; } messageHandler.getAllChats().then(all => this._renderChatsList(null, all.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || (c.lastMsg || '').toLowerCase().includes(q.toLowerCase())))); }
  _toggleSearchInChat(show = true) { const b = document.getElementById('searchInChatBar'); b.classList.toggle('hidden', !show); if (show) document.getElementById('searchInChatInput')?.focus(); else { const i = document.getElementById('searchInChatInput'); if (i) i.value = ''; this._clearSearchHighlights(); } }
  _searchInChat() { const q = document.getElementById('searchInChatInput')?.value?.toLowerCase(); document.querySelectorAll('.message-text').forEach(m => m.innerHTML = m.textContent); if (!q) return; let c = 0; document.querySelectorAll('.message-text').forEach(m => { const t = m.textContent; if (t.toLowerCase().includes(q)) { m.innerHTML = t.replace(new RegExp(q, 'gi'), '<span class="highlight">$&</span>'); c++; } }); document.getElementById('searchCounter').textContent = c > 0 ? '1/' + c : '0/0'; }
  _navigateSearch() {}; _clearSearchHighlights() { document.querySelectorAll('.highlight').forEach(el => el.outerHTML = el.textContent); }

  _saveDraft() { if (!this.currentChat?.id) return; const t = document.getElementById('messageInput')?.value || ''; t.trim() ? localStorage.setItem('draft_' + this.currentChat.id, t) : localStorage.removeItem('draft_' + this.currentChat.id); }
  _loadDraft() { if (!this.currentChat?.id) return; const d = localStorage.getItem('draft_' + this.currentChat.id); if (d) document.getElementById('messageInput').value = d; }

  _increaseFontSize() { const c = parseFloat(getComputedStyle(document.body).fontSize); document.body.style.fontSize = Math.min(c + 0.1, 1.3) + 'rem'; localStorage.setItem('revers_font_size', document.body.style.fontSize); }
  _decreaseFontSize() { const c = parseFloat(getComputedStyle(document.body).fontSize); document.body.style.fontSize = Math.max(c - 0.1, 0.7) + 'rem'; localStorage.setItem('revers_font_size', document.body.style.fontSize); }
  _loadFontSize() { const s = localStorage.getItem('revers_font_size'); if (s) document.body.style.fontSize = s; }

  _exportChat() { if (!this.currentChat) return; const h = this.currentChat.type === 'group' ? groupManager.groups.get(this.currentChat.id)?.history : messageHandler.getChatHistory(this.currentChat.id).then(h => { if (!h) return; const b = new Blob([JSON.stringify(h, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = (this.currentChat.name || 'chat') + '.json'; a.click(); URL.revokeObjectURL(u); }); }
  _exportChatAsHTML() { if (!this.currentChat) return; const ms = document.querySelectorAll('.message'); const n = this._esc(this.currentChat.name || 'Чат'); let h = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${n}</title><style>body{background:#0F0F12;color:#EFEFEF;font-family:system-ui;padding:20px;max-width:600px;margin:0 auto;}.message{margin:8px 0;padding:10px 14px;border-radius:16px;}.outgoing{text-align:right;background:#1A1A23;}.incoming{background:#2A2A3A;}.time{font-size:0.7rem;color:#7A7A8A;}</style></head><body><h1>${n}</h1>`; ms.forEach(m => h += m.outerHTML); h += '</body></html>'; const b = new Blob([h], { type: 'text/html' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = n + '.html'; a.click(); URL.revokeObjectURL(u); }

  _scheduleMessage(peerId, text, delayMs) { if (!peerId || !text) return; const id = 'sched_' + Date.now().toString(36); const s = JSON.parse(localStorage.getItem('revers_scheduled') || '[]'); s.push({ peerId, text, sendAt: Date.now() + delayMs, id }); localStorage.setItem('revers_scheduled', JSON.stringify(s)); setTimeout(() => { messageHandler.sendMessage(peerId, text); const u = JSON.parse(localStorage.getItem('revers_scheduled') || '[]').filter(x => x.id !== id); localStorage.setItem('revers_scheduled', JSON.stringify(u)); }, delayMs); }

  _togglePinnedMessage() { const p = localStorage.getItem('revers_pinned_' + this.currentChat?.id); if (p) { document.getElementById('pinnedMessage').classList.remove('hidden'); document.getElementById('pinnedText').textContent = p; } }
  _pinMessage(msg) { localStorage.setItem('revers_pinned_' + this.currentChat.id, msg.text); document.getElementById('pinnedMessage').classList.remove('hidden'); document.getElementById('pinnedText').textContent = msg.text; }
  _unpinMessage() { localStorage.removeItem('revers_pinned_' + this.currentChat?.id); document.getElementById('pinnedMessage').classList.add('hidden'); }

  _showContextMenu(e, msg, idx) { e.preventDefault(); e.stopPropagation(); const m = document.getElementById('contextMenu'); m.classList.remove('hidden'); m.style.left = Math.min((e.touches?.[0]?.clientX || e.clientX), innerWidth - 190) + 'px'; m.style.top = (e.touches?.[0]?.clientY || e.clientY) + 'px'; m._target = { msg, idx }; }
  _editSelectedMessage() { const m = document.getElementById('contextMenu'); this._editingMessage = m._target.msg; document.getElementById('messageInput').value = m._target.msg.text; document.getElementById('messageInput').focus(); document.getElementById('editIndicator').classList.remove('hidden'); m.classList.add('hidden'); }
  _replyToSelectedMessage() { const m = document.getElementById('contextMenu'); this.replyTo = m._target.msg; document.getElementById('replyBarText').textContent = '↩️ ' + (m._target.msg.text || '').substring(0, 50); document.getElementById('replyBar').classList.remove('hidden'); document.getElementById('messageInput').focus(); m.classList.add('hidden'); }
  _pinSelectedMessage() { const m = document.getElementById('contextMenu'); this._pinMessage(m._target.msg); m.classList.add('hidden'); }
  _copySelectedMessage() { const m = document.getElementById('contextMenu'); const msg = m._target.msg; navigator.clipboard.writeText(`${msg.from}: ${msg.text}\n${new Date(msg.time).toLocaleString()}`); m.classList.add('hidden'); }
  _deleteSelectedMessage() { const m = document.getElementById('contextMenu'); this._deleteMessage(m._target.msg, m._target.idx); m.classList.add('hidden'); }
  _deleteMessage(msg, idx) { if (!this.currentChat) return; if (this.currentChat.type === 'saved') messageHandler.getChatHistory('me').then(h => { h.splice(idx, 1); messageHandler.clearChatHistory('me'); h.forEach(x => messageHandler.sendMessage('me', x.text)); }); else if (this.currentChat.type === 'group') { const h = groupManager.groups.get(this.currentChat.id)?.history; if (h) h.splice(idx, 1); } this._renderMessages(this.currentChat); }
  _clearHistory() { if (!this.currentChat || !confirm('Очистить?')) return; messageHandler.clearChatHistory(this.currentChat.type === 'saved' ? 'me' : this.currentChat.id); this._renderMessages(this.currentChat); }

  _showReactions(target) { const p = document.getElementById('reactionPanel'); const r = target.getBoundingClientRect(); p.style.top = (r.top - 50) + 'px'; p.style.left = Math.min(r.left + r.width/2 - 90, innerWidth - 200) + 'px'; p.classList.remove('hidden'); p._target = target; }
  _addReaction(emoji) { const t = document.getElementById('reactionPanel')._target; if (!t) { document.getElementById('reactionPanel').classList.add('hidden'); return; } const b = t.querySelector('.bubble'); if (!b) return; const ex = b.querySelector('.reactions'); if (ex) { if (!ex.textContent.includes(emoji)) ex.textContent += emoji; } else { const r = document.createElement('div'); r.className = 'reactions'; r.textContent = emoji; b.appendChild(r); } document.getElementById('reactionPanel').classList.add('hidden'); }

  _toggleStickerPanel() { const p = document.getElementById('stickerPanel'); p.classList.toggle('hidden'); if (!p.classList.contains('hidden')) { this._renderStickerTabs(); this._renderStickerGrid('recent'); } }
  _renderStickerTabs() { const tabs = document.getElementById('stickerTabs'); tabs.innerHTML = ''; Object.entries(stickerManager.getPacks()).forEach(([id, pack]) => { const tab = document.createElement('div'); tab.className = 'sticker-tab ' + (this._activeStickerPack === id ? 'active' : ''); tab.textContent = pack.name; tab.addEventListener('click', () => { this._activeStickerPack = id; this._renderStickerTabs(); this._renderStickerGrid(id); }); tabs.appendChild(tab); }); const add = document.createElement('div'); add.className = 'sticker-tab'; add.textContent = '➕'; add.addEventListener('click', () => this._openModal('createStickerPackModal')); tabs.appendChild(add); }
  _renderStickerGrid(packId) { const grid = document.getElementById('stickerGrid'); grid.innerHTML = ''; stickerManager.getStickers(packId).forEach(s => { const d = document.createElement('div'); d.className = 'sticker-item'; if (typeof s === 'object' && s.data) d.innerHTML = '<img src="' + s.data + '" style="width:80px;height:80px;">'; else { d.textContent = typeof s === 'string' ? s : s.emoji || '🖼️'; d.style.fontSize = '2.5rem'; } d.addEventListener('click', () => { const sd = typeof s === 'string' ? s : s.data || s.emoji; stickerManager.addToRecent(sd); this._sendSticker(sd); }); grid.appendChild(d); }); document.getElementById('stickerPackActions').classList.toggle('hidden', packId === 'recent' || packId === 'default'); if (!document.getElementById('stickerPackActions').classList.contains('hidden')) document.getElementById('addStickerToPackBtn').dataset.packId = packId; }
  _sendSticker(sticker) { if (!this.currentChat) return; const msg = typeof sticker === 'string' ? sticker : '🖼️'; if (this.currentChat.type === 'saved') messageHandler.sendMessage('me', msg); else if (this.currentChat.type === 'group') groupManager.sendGroupMessage(this.currentChat.id, msg); else messageHandler.sendMessage(this.currentChat.id, msg); this._renderMessages(this.currentChat); document.getElementById('stickerPanel').classList.add('hidden'); }
  _createStickerPack() { const n = document.getElementById('stickerPackNameInput').value.trim(); if (!n) return; this._activeStickerPack = stickerManager.createPack(n); this._closeAllModals(); this._toggleStickerPanel(); }
  _addStickerToPack() { const pid = document.getElementById('addStickerToPackBtn').dataset.packId; const f = document.getElementById('stickerFileInput').files[0]; if (!f || !pid) return; const r = new FileReader(); r.onload = () => { stickerManager.addSticker(pid, r.result, document.getElementById('stickerEmojiInput').value.trim()); this._closeAllModals(); this._renderStickerGrid(pid); }; r.readAsDataURL(f); }
  _previewSticker(f) { const r = new FileReader(); r.onload = (e) => { const p = document.getElementById('stickerPreview'); p.src = e.target.result; p.style.display = 'block'; }; r.readAsDataURL(f); }
  _deleteStickerPack() { if (this._activeStickerPack && confirm('Удалить?')) { stickerManager.deletePack(this._activeStickerPack); this._activeStickerPack = 'recent'; this._renderStickerTabs(); this._renderStickerGrid('recent'); } }

  async _showQR() { this._closeAllModals(); const d = JSON.stringify({ id: identity.id, name: identity.name, type: 'revers-connect' }); const c = document.getElementById('qrCanvas'); try { await QRCode.toCanvas(c, d, { width: 200, margin: 2, color: { dark: '#0F0F12', light: '#FFFFFF' } }); } catch(e) {} document.getElementById('inviteLink').textContent = 'revers://chat?id=' + identity.id; document.getElementById('qrModal').classList.add('active'); }
  async _startScanner() { this._closeAllModals(); const c = document.getElementById('scannerContainer'); c.innerHTML = ''; document.getElementById('scannerModal').classList.add('active'); try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); s.getTracks().forEach(t => t.stop()); } catch(e) { c.innerHTML = '<p style="color:#E63946;text-align:center;">❌ Нет доступа к камере</p>'; return; } try { this.html5QrCode = new Html5Qrcode('scannerContainer'); await this.html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, (t) => this._handleScannedQR(t), () => {}); } catch(e) {} }
  _stopScanner() { if (this.html5QrCode) { this.html5QrCode.stop().then(() => { this.html5QrCode = null; this._closeAllModals(); }).catch(() => this._closeAllModals()); } else this._closeAllModals(); }
  _handleScannedQR(t) { try { const d = JSON.parse(t); if (d.type === 'revers-connect' && d.id) { this._stopScanner(); p2pNetwork.connectToPeer(d.id); this._openChat({ id: d.id, type: 'contact', name: d.name || d.id }); return; } } catch(e) {} if (t.length > 5) { this._stopScanner(); this._openChat({ id: t, type: 'contact', name: t }); } }

  _openBrowser(url = 'https://www.startpage.com') { document.getElementById('browserUrlInput').value = url; this._openModal('browserModal'); }
  async _openInBrowser() { let u = document.getElementById('browserUrlInput').value.trim(); if (!u) return; if (!u.startsWith('http')) u = 'https://' + u; this._closeAllModals(); try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url: u }); } catch(e) { window.open(u, '_system'); } }
  _openLink(url) { this._openInBrowserDirect(url); }
  async _openInBrowserDirect(url) { try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url }); } catch(e) { window.open(url, '_system'); } }

  _handleIncomingSignal(msg) { if (msg.initiator) { document.getElementById('signalInput').value = JSON.stringify(msg.signal); this._openModal('connectModal'); } else p2pNetwork.applySignal(msg.from, msg.signal); }
  _openConnectModal() { this._closeAllModals(); document.getElementById('connectModal').classList.add('active'); document.getElementById('mySignalOutput').value = 'Генерация...'; const pid = this.currentChat?.id || 'peer_'; const orig = p2pNetwork.onMessageCallback; p2pNetwork.onMessageCallback = (m) => { if (m.type === 'p2p-signal' && m.initiator && m.to === pid) document.getElementById('mySignalOutput').value = JSON.stringify(m.signal); if (orig) orig(m); }; p2pNetwork.connectToPeer(pid); setTimeout(() => { if (document.getElementById('mySignalOutput').value === 'Генерация...') document.getElementById('mySignalOutput').value = 'Не получен.'; }, 5000); }
  _handleConnect() { const pid = document.getElementById('peerIdInput').value.trim(); const sig = document.getElementById('signalInput').value.trim(); if (sig) { try { const s = JSON.parse(sig); if (s.sdp || s.candidate) { p2pNetwork.acceptPeer(pid || 'remote', s); this._closeAllModals(); this._updateConnectionStatus(true); return; } } catch(e) {} } if (pid) { p2pNetwork.connectToPeer(pid); document.getElementById('mySignalOutput').value = 'Генерация...'; } }

  async _toggleVoiceRecord() { const btn = document.getElementById('voiceRecordBtn'); if (this.isRecording) { btn.textContent = '🎤'; this.isRecording = false; if (this.voiceRecorder) { const r = await this.voiceRecorder; if (r?.stop) { const audio = await new Promise(resolve => { r.recorder.onstop = () => { setTimeout(() => { const blob = new Blob(r.chunks || [], { type: 'audio/webm' }); const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); }, 100); }; r.stop(); }); if (audio && this.currentChat) { const dur = Math.round((Date.now() - this.voiceStartTime) / 1000); const tid = this.currentChat.type === 'saved' ? 'me' : this.currentChat.id; messageHandler.sendVoice(tid, audio, dur || 1); this._renderMessages(this.currentChat); this._renderChatsList(); } } this.voiceRecorder = null; } } else { try { const ts = await navigator.mediaDevices.getUserMedia({ audio: true }); ts.getTracks().forEach(t => t.stop()); } catch(e) { alert('❌ Нет доступа к микрофону'); return; } btn.textContent = '🔴'; this.isRecording = true; this.voiceStartTime = Date.now(); this.voiceRecorder = messageHandler.recordVoice(); } }

  async _sendMessage() { const i = document.getElementById('messageInput'); const t = i.value.trim(); if (!t || !this.currentChat) return; i.style.transform = 'scale(0.98)'; setTimeout(() => i.style.transform = '', 100); if (this._editingMessage) { this._editingMessage.text = t; this._editingMessage.edited = true; this._editingMessage = null; document.getElementById('editIndicator').classList.add('hidden'); this._renderMessages(this.currentChat); } else if (this.currentChat.type === 'group') { const g = groupManager.groups.get(this.currentChat.id); if (g?.type === 'forum' && this._currentTopic) { groupManager.sendToTopic(this.currentChat.id, this._currentTopic, t); this._renderTopicMessages(); } else if (g?.type === 'forum') { groupManager.sendToTopic(this.currentChat.id, 'general', t); this._renderMessages(this.currentChat); } else { await groupManager.sendGroupMessage(this.currentChat.id, t); this._renderMessages(this.currentChat); } } else if (this.currentChat.type === 'saved') { await messageHandler.sendMessage('me', t); this._renderMessages(this.currentChat); } else if (this.currentChat.type === 'channel') { messageHandler.sendChannelMessage(this.currentChat.id, t); this._renderMessages(this.currentChat); } else { const sent = await messageHandler.sendMessage(this.currentChat.id, t); if (!sent) alert('💾 Сообщение уйдёт, когда друг появится в сети'); this._renderMessages(this.currentChat); } i.value = ''; this.replyTo = null; document.getElementById('replyBar').classList.add('hidden'); this._renderChatsList(); }
  async _sendFile(file) { if (!this.currentChat) return; const tid = this.currentChat.type === 'saved' ? 'me' : this.currentChat.id; await messageHandler.sendFile(tid, file); this._renderMessages(this.currentChat); }
  _createGroup() { const n = document.getElementById('groupNameInput').value.trim(); const t = document.getElementById('groupTypeSelect')?.value || 'chat'; if (!n) return; const g = groupManager.createGroup(n, t); this._closeAllModals(); this._openChat({ id: g.key, name: (t === 'forum' ? '📂 ' : '👥 ') + n, type: 'group' }); }
  _createChannel() { const n = document.getElementById('channelNameInput').value.trim(); if (!n) return; const k = messageHandler.createChannel(n); this._closeAllModals(); this._openChat({ id: k, name: '📢 ' + n, type: 'channel' }); }

  _showGroupSettings() { if (!this.currentChat || this.currentChat.type !== 'group') return; const g = groupManager.groups.get(this.currentChat.id); if (!g) return; const c = document.getElementById('groupSettingsContent'); c.innerHTML = `<div class="setting-row"><span>Тип:</span><span>${g.type === 'forum' ? '📂 Форум' : '💬 Чат'}</span></div><div class="setting-row"><span>Темы:</span><span>${g.topics.length}</span></div><div class="setting-row"><span>Участники:</span><span>${g.members.length}</span></div><div style="text-align:center;margin:8px 0;"><p style="font-size:0.8rem;">Аватар:</p><img id="groupAvatarPreview" class="avatar-modal-img" src="${g.avatar || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle fill=%22%232A2A3A%22 cx=%2250%22 cy=%2250%22 r=%2250%22/%3E%3Ctext x=%2250%22 y=%2267%22 text-anchor=%22middle%22 fill=%22%23E63946%22 font-size=%2240%22%3E👥%3C/text%3E%3C/svg%3E'}" style="width:60px;height:60px;"><button id="changeGroupAvatarBtn" class="secondary">Сменить</button><input type="file" id="groupAvatarInput" style="display:none"></div><button id="deleteGroupSettingsBtn" style="background:#E63946;width:100%;padding:8px;border-radius:12px;color:white;">🗑️ Удалить</button>`; document.getElementById('deleteGroupSettingsBtn').addEventListener('click', () => { if (confirm('Удалить?')) { groupManager.deleteGroup(this.currentChat.id); this._goToChats(); this._closeAllModals(); } }); document.getElementById('changeGroupAvatarBtn').addEventListener('click', () => document.getElementById('groupAvatarInput').click()); document.getElementById('groupAvatarInput').addEventListener('change', (e) => { if (e.target.files[0]) { const r = new FileReader(); r.onload = (ev) => { groupManager.setGroupAvatar(this.currentChat.id, ev.target.result); document.getElementById('groupAvatarPreview').src = ev.target.result; }; r.readAsDataURL(e.target.files[0]); } }); this._openModal('groupSettingsModal'); }
  _showChannelSettings() { if (!this.currentChat || this.currentChat.type !== 'channel') return; const ch = messageHandler.channels.get(this.currentChat.id); if (!ch) return; const c = document.getElementById('groupSettingsContent'); c.innerHTML = `<div class="setting-row"><span>Название:</span><span>${this._esc(ch.name)}</span></div><div style="text-align:center;margin:8px 0;"><p style="font-size:0.8rem;">Аватар:</p><img id="channelAvatarPreview" class="avatar-modal-img" src="${ch.avatar || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle fill=%22%232A2A3A%22 cx=%2250%22 cy=%2250%22 r=%2250%22/%3E%3Ctext x=%2250%22 y=%2267%22 text-anchor=%22middle%22 fill=%22%23E63946%22 font-size=%2240%22%3E📢%3C/text%3E%3C/svg%3E'}" style="width:60px;height:60px;"><button id="changeChannelAvatarBtn" class="secondary">Сменить</button><input type="file" id="channelAvatarInput" style="display:none"></div><button id="deleteChannelSettingsBtn" style="background:#E63946;width:100%;padding:8px;border-radius:12px;color:white;">🗑️ Удалить</button>`; document.getElementById('changeChannelAvatarBtn').addEventListener('click', () => document.getElementById('channelAvatarInput').click()); document.getElementById('channelAvatarInput').addEventListener('change', (e) => { if (e.target.files[0]) { const r = new FileReader(); r.onload = (ev) => { ch.avatar = ev.target.result; document.getElementById('channelAvatarPreview').src = ev.target.result; messageHandler._saveChannels(); }; r.readAsDataURL(e.target.files[0]); } }); document.getElementById('deleteChannelSettingsBtn').addEventListener('click', () => { if (confirm('Удалить?')) { messageHandler.channels.delete(this.currentChat.id); messageHandler._saveChannels(); this._goToChats(); this._closeAllModals(); } }); document.getElementById('groupSettingsModal').querySelector('h3').textContent = '⚙️ Настройки канала'; this._openModal('groupSettingsModal'); }

  _openTopicsScreen() { if (!this.currentChat || this.currentChat.type !== 'group') return; document.getElementById('chatScreen').classList.add('hidden'); document.getElementById('topicsScreen').classList.remove('hidden'); this._renderTopicsList(); }
  _closeTopicsScreen() { document.getElementById('topicsScreen').classList.add('hidden'); document.getElementById('chatsScreen').classList.remove('hidden'); this.currentChat = null; this._currentTopic = null; this._renderChatsList(); }
  _renderTopicsList() { if (!this.currentChat) return; const c = document.getElementById('topicsList'); c.innerHTML = ''; groupManager.getTopics(this.currentChat.id).forEach(t => { const d = document.createElement('div'); d.className = 'chat-item'; d.innerHTML = `<div class="chat-avatar">${t.closed ? '🔒' : '📂'}</div><div class="chat-info"><div class="chat-name">${t.pinned ? '📌 ' : ''}${this._esc(t.name)}</div><div class="chat-preview">${t.messages.length} сообщ.</div></div>`; d.addEventListener('click', () => { this._currentTopic = t.id; document.getElementById('topicsScreen').classList.add('hidden'); document.getElementById('chatScreen').classList.remove('hidden'); document.getElementById('chatName').textContent = t.name; this._renderTopicMessages(); }); c.appendChild(d); }); }
  _createTopic() { const n = document.getElementById('topicNameInput').value.trim(); if (!n || !this.currentChat) return; const cl = document.getElementById('topicClosedToggle').classList.contains('active'); const t = groupManager.addTopic(this.currentChat.id, n); if (t && cl) groupManager.toggleCloseTopic(this.currentChat.id, t.id); this._closeAllModals(); this._renderTopicsList(); }
  _renderTopicMessages() { if (!this.currentChat || !this._currentTopic) return; const area = document.getElementById('messagesArea'); area.innerHTML = ''; groupManager.getTopicMessages(this.currentChat.id, this._currentTopic).forEach(msg => { const d = document.createElement('div'); d.className = 'message ' + (msg.from === identity.id ? 'outgoing' : 'incoming'); d.innerHTML = '<div class="bubble"><div class="message-text">' + this._esc(msg.text) + '</div><div class="message-time">' + new Date(msg.time).toLocaleTimeString() + '</div></div>'; area.appendChild(d); }); area.scrollTop = area.scrollHeight; }

  async _createPoll() { const q = document.getElementById('pollQuestionInput').value.trim(); const o = document.getElementById('pollOptionsInput').value.split(',').map(s => s.trim()).filter(Boolean); const a = document.getElementById('pollAnonymousToggle').classList.contains('active'); if (!q || o.length < 2 || !this.currentChat) return; await groupManager.createPoll(this.currentChat.id, q, o, a); this._closeAllModals(); this._renderMessages(this.currentChat); }
  async _addAnnouncement() { if (!this.currentChat) return; const t = prompt('Текст:'); if (t) { await groupManager.addAnnouncement(this.currentChat.id, t); this._renderMessages(this.currentChat); } }

  _sendCallMessage() { const i = document.getElementById('callMessageInput'); const t = i.value.trim(); if (!t) return; if (this._currentGroupCallId) callManager.sendGroupCallMessage(this._currentGroupCallId, t); else if (this.currentChat) callManager.sendCallMessage(this.currentChat.id, t); i.value = ''; }
  _startCallTimer() { this._callSeconds = 0; document.getElementById('callDuration').textContent = '00:00'; this._callTimer = setInterval(() => { this._callSeconds++; const m = Math.floor(this._callSeconds / 60).toString().padStart(2, '0'); const s = (this._callSeconds % 60).toString().padStart(2, '0'); document.getElementById('callDuration').textContent = m + ':' + s; }, 1000); }
  _stopCallTimer() { if (this._callTimer) clearInterval(this._callTimer); }
  _endCall() { callManager.endCall(this.currentChat?.id); document.getElementById('callModal').classList.add('hidden'); this._stopCallTimer(); }

  _generateInviteLink(chat) { if (!chat) return ''; return 'revers://chat?id=' + chat.id + '&name=' + encodeURIComponent(chat.name); }
  _shareInviteLink(chat) { const l = this._generateInviteLink(chat); if (navigator.share) navigator.share({ title: 'REVERS', text: 'Присоединяйся!', url: l }).catch(() => {}); else { navigator.clipboard.writeText(l); alert('Скопировано!'); } }

  _openChat(chat) {
    this._saveDraft(); this.currentChat = chat; this._currentTopic = null;
    document.getElementById('chatsScreen').classList.add('hidden');
    const g = groupManager.groups.get(chat.id);
    if (g?.type === 'forum') { document.getElementById('chatScreen').classList.add('hidden'); document.getElementById('topicsScreen').classList.remove('hidden'); this._renderTopicsList(); }
    else { document.getElementById('topicsScreen').classList.add('hidden'); document.getElementById('chatScreen').classList.remove('hidden'); document.getElementById('chatName').textContent = chat.name; this._updateConnectionStatus(p2pNetwork.isConnected(chat.id)); this._updateConnectionIcon(); this._renderMessages(chat); }
    this._toggleSidebar(false); document.getElementById('stickerPanel').classList.add('hidden'); document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden'));
    this._togglePinnedMessage(); this.replyTo = null; this._editingMessage = null; document.getElementById('replyBar').classList.add('hidden'); document.getElementById('editIndicator').classList.add('hidden');
    this._loadDraft();
  }

  _goToChats() { this._saveDraft(); document.getElementById('chatScreen').classList.add('hidden'); document.getElementById('topicsScreen').classList.add('hidden'); document.getElementById('chatsScreen').classList.remove('hidden'); this.currentChat = null; this._currentTopic = null; this.replyTo = null; this._renderChatsList(); }

  async _renderChatsList(folderId = null, filteredList = null) {
    const c = document.getElementById('chatsList'); c.innerHTML = '';
    const chats = filteredList || await messageHandler.getAllChats();
    if (!chats.length) { c.innerHTML = '<p style="color:#8E8E9A;text-align:center;padding:20px;">Нет чатов</p>'; return; }
    let display = chats;
    if (folderId && this.folders[folderId]) display = chats.filter(chat => chat.type === folderId || (folderId === 'personal' && (chat.type === 'contact' || chat.type === 'saved')));
    display.forEach(chat => { const d = document.createElement('div'); d.className = 'chat-item'; const emoji = chat.type === 'saved' ? '📔' : chat.type === 'group' ? (chat.name.startsWith('📂') ? '📂' : '👥') : chat.type === 'channel' ? '📢' : '💬'; d.innerHTML = `<div class="chat-avatar">${emoji}</div><div class="chat-info"><div class="chat-name">${this._esc(chat.name)}</div><div class="chat-preview">${this._esc(chat.lastMsg || '')}</div></div><div class="chat-time">${chat.lastTime ? new Date(chat.lastTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</div>`; d.addEventListener('click', () => this._openChat(chat)); c.appendChild(d); });
  }

  async _renderMessages(chat) {
    const area = document.getElementById('messagesArea'); area.innerHTML = '';
    let history = [];
    if (chat.type === 'saved') history = await messageHandler.getChatHistory('me');
    else if (chat.type === 'group') history = groupManager.groups.get(chat.id)?.history || [];
    else if (chat.type === 'channel') history = messageHandler.getChannelHistory(chat.id);
    else history = await messageHandler.getChatHistory(chat.id);
    if (chat.type === 'group') { groupManager.getAnnouncements(chat.id).forEach(a => { const d = document.createElement('div'); d.className = 'announcement'; d.innerHTML = '<div class="bubble"><b>📌</b> ' + this._esc(a.text) + '</div>'; area.appendChild(d); }); groupManager.getPolls(chat.id).forEach(p => this._renderPoll(p, area)); }
    history.forEach((msg, idx) => {
      const isOutgoing = msg.from === identity.id;
      const div = document.createElement('div'); div.className = 'message ' + (isOutgoing ? 'outgoing' : 'incoming'); div.dataset.msgIdx = idx;
      let html = '<div class="bubble">';
      if (this.replyTo && this.replyTo === msg) html += '<div class="reply-context">↩️ ' + this._esc((this.replyTo.text || '').substring(0, 50)) + '</div>';
      html += '<div class="message-text">' + this._esc(msg.text || '').replace(/(https?:\/\/[^\s]+)/g, '<a onclick="window.REVERSApp._openLink(\'$1\')" style="color:#2A9D8F;text-decoration:underline;cursor:pointer;">$1</a>') + '</div>';
      if (msg.edited) html += '<span style="font-size:0.6rem;color:#8E8E9A;"> (изм.)</span>';
      if (msg.type === 'voice' && msg.fileData) html += '<audio controls src="' + msg.fileData + '" style="max-width:200px;height:30px;margin-top:4px;"></audio>';
      if (msg.type === 'file' && msg.fileName) { const im = msg.fileType?.startsWith('image/'); const vi = msg.fileType?.startsWith('video/'); html += '<div class="file-attachment" onclick="window.REVERSApp._openMedia(\'' + (msg.fileData || '') + '\',\'' + (msg.fileType || '') + '\')">📄 ' + this._esc(msg.fileName) + ' (' + this._formatSize(msg.fileSize) + ')</div>'; if (im && msg.fileData) html += '<img src="' + msg.fileData + '" class="file-preview-img" onclick="event.stopPropagation();window.REVERSApp._openMedia(\'' + msg.fileData + '\',\'image\')">'; if (vi && msg.fileData) html += '<div class="file-attachment" onclick="window.REVERSApp._openMedia(\'' + msg.fileData + '\',\'video\')">🎬 Воспроизвести</div>'; }
      if (msg.reactions) html += '<div class="reactions">' + msg.reactions + '</div>';
      html += '<div class="message-time">' + new Date(msg.time).toLocaleTimeString() + '</div>';
      if (isOutgoing) { if (msg.error) html += '<span style="color:#E63946;">❌</span>'; else if (msg.offline) html += '<span style="color:#FFC107;">⏳</span>'; else if (msg.delivered) html += '<span style="color:#2196F3;">✓✓</span>'; else if (msg.sent) html += '<span style="color:#8E8E9A;">✓</span>'; }
      html += '</div>';
      div.innerHTML = html;
      if (this._readObserver) this._readObserver.observe(div);
      div.addEventListener('contextmenu', (e) => this._showContextMenu(e, msg, idx));
      let timer; div.addEventListener('touchstart', () => { timer = setTimeout(() => this._showReactions(div), 500); }); div.addEventListener('touchend', () => clearTimeout(timer)); div.addEventListener('touchmove', () => clearTimeout(timer));
      area.appendChild(div);
    });
    area.scrollTop = area.scrollHeight;
  }

  _renderPoll(poll, area) { const d = document.createElement('div'); d.className = 'poll-container'; let h = '<div class="bubble"><b>📊 ' + this._esc(poll.question) + '</b><br>'; poll.options.forEach((o, i) => { h += '<button class="poll-option" onclick="groupManager.votePoll(\'' + (this.currentChat?.id || '') + '\',\'' + poll.id + '\',' + i + ')" ' + (poll.closed ? 'disabled' : '') + '>' + this._esc(o.text) + ' (' + o.count + ')</button><br>'; }); h += '<small>' + (poll.anonymous ? '🔒' : '👁️') + ' · ' + poll.totalVotes + ' голосов</small></div>'; d.innerHTML = h; area.appendChild(d); }
  _openMedia(d, t) { if (!d) return; if (t?.startsWith('image/')) { document.getElementById('fullscreenImage').src = d; document.getElementById('imageViewer').classList.add('active'); } else if (t?.startsWith('video/')) { document.getElementById('videoPlayerEl').src = d; document.getElementById('videoPlayer').classList.remove('hidden'); document.getElementById('videoPlayerEl').play(); } else if (t?.startsWith('audio/')) new Audio(d).play(); }
  _renderGroupsList() { const c = document.getElementById('groupsList'); c.innerHTML = ''; messageHandler.getAllChats().then(all => { const gs = all.filter(ch => ch.type === 'group'); if (!gs.length) { c.innerHTML = '<p style="color:#8E8E9A;">Нет групп</p>'; return; } gs.forEach(g => { const d = document.createElement('div'); d.style.cssText = 'background:#2A2A3A;border-radius:16px;padding:12px;margin:8px 0;display:flex;justify-content:space-between;'; d.innerHTML = '<strong style="color:white">' + g.name + '</strong>'; const b = document.createElement('button'); b.textContent = 'Открыть'; b.style.cssText = 'background:#E63946;border:none;padding:6px 12px;border-radius:20px;color:white;cursor:pointer;'; b.addEventListener('click', () => { this._closeAllModals(); this._openChat(g); }); d.appendChild(b); c.appendChild(d); }); }); }
  _renderChannelsList() { const c = document.getElementById('channelsList'); c.innerHTML = ''; messageHandler.getAllChats().then(all => { const cs = all.filter(ch => ch.type === 'channel'); if (!cs.length) { c.innerHTML = '<p style="color:#8E8E9A;">Нет каналов</p>'; return; } cs.forEach(ch => { const d = document.createElement('div'); d.style.cssText = 'background:#2A2A3A;border-radius:16px;padding:12px;margin:8px 0;display:flex;justify-content:space-between;'; d.innerHTML = '<strong style="color:white">' + ch.name + '</strong>'; const b = document.createElement('button'); b.textContent = 'Открыть'; b.style.cssText = 'background:#E63946;border:none;padding:6px 12px;border-radius:20px;color:white;cursor:pointer;'; b.addEventListener('click', () => { this._closeAllModals(); this._openChat(ch); }); d.appendChild(b); c.appendChild(d); }); }); }
  _formatSize(bytes) { if (!bytes) return ''; if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'; return (bytes / 1073741824).toFixed(1) + ' GB'; }
  _deleteCurrentChat() { if (!this.currentChat || this.currentChat.type === 'saved') return; if (!confirm('Удалить?')) return; if (this.currentChat.type === 'group') groupManager.deleteGroup(this.currentChat.id); else if (this.currentChat.type === 'channel') { messageHandler.channels.delete(this.currentChat.id); messageHandler._saveChannels(); } this._goToChats(); }
  _updateConnectionStatus(connected) { const l = document.getElementById('statusLed'); const t = document.getElementById('statusText'); if (connected) { l.classList.add('green'); t.textContent = 'P2P'; } else { l.classList.remove('green'); t.textContent = 'Оффлайн'; } }
  _toggleSidebar(show) { document.getElementById('sidebar').classList.toggle('open', show); document.getElementById('overlay').classList.toggle('active', show); }
  _openModal(id) { this._closeAllModals(); document.getElementById(id).classList.add('active'); this._toggleSidebar(false); }
  _closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
  _toggleTheme() { const t = document.getElementById('themeToggle'); t.classList.toggle('active'); document.body.classList.toggle('light-theme'); localStorage.setItem('revers_dark', t.classList.contains('active')); }
  _toggleSound() { document.getElementById('soundToggle').classList.toggle('active'); }
  _toggleCalls() { const t = document.getElementById('callsToggle'); t.classList.toggle('active'); callManager.setAllowIncomingCalls(t.classList.contains('active')); }
  _toggleOffline() { document.getElementById('offlineToggle').classList.toggle('active'); }
  _loadSettings() { if (localStorage.getItem('revers_dark') === 'false') document.body.classList.add('light-theme'); }
  _esc(text) { if (!text) return ''; const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
}

document.addEventListener('DOMContentLoaded', () => new REVERSApp());