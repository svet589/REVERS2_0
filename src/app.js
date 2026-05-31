// REVERS Messenger v1.3 — P2P мессенджер
// Лицензия: GNU GPL v3
// Разработчик: https://github.com/svet589

import REVERS from './core/p2p-engine.js';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import stickerManager from './core/sticker-manager.js';
import groupManager from './core/group-manager.js';

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
          <div style="display:flex; gap:8px;">
            <button class="action-icon" id="searchChatsBtn" title="Поиск чатов">🔍</button>
            <button class="action-icon" id="addContactBtn" title="Добавить по ID">➕</button>
          </div>
        </div>
        <div class="search-bar hidden" id="searchChatsBar">
          <input type="text" class="search-input" id="searchChatsInput" placeholder="Поиск чатов...">
          <button class="action-icon" id="searchChatsCloseBtn">✖</button>
        </div>
        <div class="chats-list" id="chatsList"></div>
      </div>
      <div id="chatScreen" class="screen hidden">
        <div class="chat-header">
          <button class="back-btn" id="backBtn">←</button>
          <span class="current-chat-name" id="chatName">Чат</span>
          <div class="connection-status" id="connectionStatus">
            <div class="status-led" id="statusLed"></div>
            <span id="statusText">Оффлайн</span>
          </div>
          <button class="menu-btn" id="chatMenuBtn" style="font-size:1.4rem;">⋮</button>
        </div>
        <div class="chat-dropdown hidden" id="contactDropdown">
          <button class="dropdown-item" id="inviteToChatBtn">🔗 Пригласить</button>
          <button class="dropdown-item" id="searchInChatBtn">🔍 Поиск</button>
          <button class="dropdown-item" id="pinnedMsgBtn">📌 Закреп</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" id="callBtn">📹 Видеозвонок</button>
          <button class="dropdown-item" id="audioCallBtn">📞 Аудиозвонок</button>
          <button class="dropdown-item" id="connectPeerBtn">🔗 Подключиться</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" id="voiceRecordBtn">🎤 Голосовое</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item danger" id="deleteChatBtn">🗑️ Удалить чат</button>
          <button class="dropdown-item danger" id="clearHistoryBtn">🧹 Очистить историю</button>
        </div>
        <div class="chat-dropdown hidden" id="groupDropdown">
          <button class="dropdown-item" id="inviteToChatBtn">🔗 Пригласить</button>
          <button class="dropdown-item" id="topicsMenuBtn">📂 Темы</button>
          <button class="dropdown-item" id="searchInChatBtn">🔍 Поиск</button>
          <button class="dropdown-item" id="pinnedMsgBtn">📌 Закреп</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" id="groupSettingsBtn">⚙️ Настройки группы</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item danger" id="deleteChatBtn">🗑️ Удалить группу</button>
        </div>
        <div class="chat-dropdown hidden" id="channelDropdown">
          <button class="dropdown-item" id="inviteToChatBtn">🔗 Пригласить</button>
          <button class="dropdown-item" id="searchInChatBtn">🔍 Поиск</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item danger" id="deleteChatBtn">🗑️ Удалить канал</button>
        </div>
        <div class="chat-dropdown hidden" id="savedDropdown">
          <button class="dropdown-item" id="searchInChatBtn">🔍 Поиск</button>
          <button class="dropdown-item" id="pinnedMsgBtn">📌 Закреп</button>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item" id="voiceRecordBtn">🎤 Голосовое</button>
        </div>
        <div class="search-bar hidden" id="searchInChatBar">
          <input type="text" class="search-input" id="searchInChatInput" placeholder="Поиск в чате...">
          <span class="search-counter" id="searchCounter">0/0</span>
          <button class="action-icon" id="searchPrevBtn">⬆️</button>
          <button class="action-icon" id="searchNextBtn">⬇️</button>
          <button class="action-icon" id="searchInChatCloseBtn">✖</button>
        </div>
        <div id="pinnedMessage" class="pinned-message hidden">
          <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" id="pinnedText"></div>
          <button style="background:none; border:none; color:#8E8E9A; cursor:pointer;" id="unpinBtn">✖</button>
        </div>
        <div class="messages-area" id="messagesArea"></div>
        <div class="reply-bar hidden" id="replyBar">
          <div class="reply-bar-text" id="replyBarText"></div>
          <button class="reply-bar-close" id="replyBarClose">✖</button>
        </div>
        <div class="input-panel">
          <button class="sticker-btn" id="stickerToggleBtn">😊</button>
          <div class="message-input-wrapper">
            <input type="text" class="message-input" id="messageInput" placeholder="Сообщение...">
            <label class="file-label" for="fileInput">📎</label>
            <input type="file" id="fileInput">
            <button class="send-btn" id="sendBtn">➤</button>
          </div>
        </div>
        <div class="sticker-panel hidden" id="stickerPanel">
          <div class="sticker-tabs" id="stickerTabs"></div>
          <div class="sticker-grid" id="stickerGrid"></div>
          <div class="sticker-pack-actions hidden" id="stickerPackActions">
            <button id="addStickerToPackBtn">➕ Добавить стикер</button>
            <button id="deleteStickerPackBtn" class="danger">🗑️ Удалить пак</button>
          </div>
        </div>
      </div>
      <div id="topicsScreen" class="screen hidden">
        <div class="chat-header">
          <button class="back-btn" id="topicsBackBtn">←</button>
          <span class="current-chat-name">Темы</span>
          <button class="action-icon" id="addTopicBtn">➕</button>
        </div>
        <div class="topics-list" id="topicsList"></div>
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
      <div class="sidebar" id="sidebar">
        <div class="sidebar-header">REVERS</div>
        <div class="sidebar-menu">
          <button class="menu-item" id="qrMenuBtn">🔳 Мой QR</button>
          <button class="menu-item" id="scanMenuBtn">📷 Сканировать QR</button>
          <button class="menu-item" id="savedMenuBtn">📔 Сохранённые</button>
          <button class="menu-item" id="browserMenuBtn">🌐 Браузер</button>
          <button class="menu-item" id="accountMenuBtn">👤 Аккаунт</button>
          <button class="menu-item" id="groupsMenuBtn">👥 Группы</button>
          <button class="menu-item" id="channelsMenuBtn">📢 Каналы</button>
          <button class="menu-item" id="settingsMenuBtn">⚙️ Настройки</button>
          <button class="menu-item" id="aboutMenuBtn">ℹ️ О нас</button>
        </div>
      </div>
      <div class="overlay" id="overlay"></div>
      <div class="modal" id="addContactModal">
        <h3>➕ Добавить контакт</h3>
        <input type="text" id="addContactIdInput" placeholder="ID собеседника">
        <button id="addContactConfirmBtn">Добавить</button>
        <button id="addContactCloseBtn" class="secondary">Закрыть</button>
      </div>
      <div class="modal" id="connectModal">
        <h3>🔗 Подключиться</h3>
        <input type="text" id="peerIdInput" placeholder="ID собеседника">
        <input type="text" id="signalInput" placeholder="Или вставьте сигнал (JSON)">
        <button id="connectSendBtn">Подключиться</button>
        <div style="text-align:center; margin-top:8px;">
          <small style="color:#8E8E9A">Мой сигнал:</small>
          <textarea id="mySignalOutput" readonly style="width:100%; height:60px; background:#0F0F12; color:#2A9D8F; border:none; border-radius:12px; padding:8px; font-size:0.65rem; resize:none; margin-top:4px;"></textarea>
          <button id="copySignalBtn" class="secondary" style="margin-top:4px;">📋 Копировать сигнал</button>
        </div>
        <button id="closeConnectBtn" class="secondary">Закрыть</button>
      </div>
      <div class="modal" id="qrModal">
        <h3>🔳 Мой QR-код</h3>
        <div style="text-align:center; background:white; padding:20px; border-radius:20px;">
          <canvas id="qrCanvas" style="width:200px; height:200px;"></canvas>
        </div>
        <div style="background:#1A1A23; border-radius:12px; padding:8px; margin-top:8px; word-break:break-all;">
          <code style="color:#2A9D8F; font-size:0.6rem;" id="inviteLink"></code>
        </div>
        <button id="copyInviteLinkBtn" class="secondary" style="margin-top:4px;">📋 Копировать ссылку</button>
        <button id="shareInviteBtn" class="secondary" style="margin-top:4px;">📤 Поделиться</button>
        <button id="closeQrBtn" class="secondary">Закрыть</button>
      </div>
      <div class="modal" id="scannerModal">
        <h3>📷 Сканировать QR</h3>
        <div id="scannerContainer" style="width:100%; border-radius:16px; overflow:hidden;"></div>
        <p style="color:#8E8E9A; font-size:0.7rem; text-align:center;">Наведите камеру на QR-код</p>
        <button id="stopScannerBtn" class="secondary">Отмена</button>
      </div>
      <div class="modal" id="browserModal">
        <h3>🌐 Браузер</h3>
        <input type="text" id="browserUrlInput" placeholder="Введите адрес...">
        <button id="browserGoBtn">Открыть</button>
        <button id="closeBrowserBtn" class="secondary">Закрыть</button>
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
        <div class="setting-row">
          <span class="setting-label">Тип:</span>
          <select id="groupTypeSelect" style="background:#2A2A3A; border:none; border-radius:12px; padding:8px; color:white; font-size:0.9rem;">
            <option value="chat">💬 Чат</option>
            <option value="forum">📂 Форум</option>
          </select>
        </div>
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
      <div class="modal" id="groupSettingsModal">
        <h3>⚙️ Настройки группы</h3>
        <div id="groupSettingsContent"></div>
        <button id="closeGroupSettingsBtn" class="secondary">Закрыть</button>
      </div>
      <div class="modal" id="createTopicModal">
        <h3>📂 Новая тема</h3>
        <input type="text" id="topicNameInput" placeholder="Название темы">
        <div class="setting-row">
          <span class="setting-label">🔒 Закрытая тема</span>
          <div id="topicClosedToggle" class="toggle-switch"></div>
        </div>
        <button id="confirmTopicBtn">Создать</button>
        <button id="cancelTopicBtn" class="secondary">Отмена</button>
      </div>
      <div class="modal" id="settingsModal">
        <h3>⚙️ Настройки</h3>
        <div class="setting-row"><span class="setting-label">🌓 Тёмная тема</span><div id="themeToggle" class="toggle-switch active"></div></div>
        <div class="setting-row"><span class="setting-label">🔊 Звук</span><div id="soundToggle" class="toggle-switch active"></div></div>
        <button id="closeSettingsBtn" class="secondary">Закрыть</button>
      </div>
      <div class="modal" id="aboutModal">
        <h3>ℹ️ О REVERS Messenger</h3>
        <div style="color:#EFEFEF; font-size:0.85rem; line-height:1.6;">
          <p><strong>REVERS v1.3</strong></p>
          <p>P2P мессенджер с полной анонимностью.</p>
          <p>• Никаких серверов • Сквозное шифрование</p>
          <p>• Не собираем данные • Открытый код</p>
          <p>• Форум-группы • Стикеры • Звонки</p>
          <br>
          <p><strong>📜 Политика конфиденциальности:</strong></p>
          <p style="font-size:0.75rem; color:#8E8E9A;">
            REVERS не собирает, не хранит и не передаёт третьим лицам никакие персональные данные.
          </p>
          <br>
          <p style="font-size:0.7rem; color:#6C6C7A; text-align:center;">© 2025 REVERS Messenger — GNU GPL v3</p>
        </div>
        <button id="closeAboutBtn" class="secondary">Закрыть</button>
      </div>
      <div class="modal" id="createStickerPackModal">
        <h3>🎨 Создать стикерпак</h3>
        <input type="text" id="stickerPackNameInput" placeholder="Название пакета">
        <button id="confirmStickerPackBtn">Создать</button>
        <button id="cancelStickerPackBtn" class="secondary">Отмена</button>
      </div>
      <div class="modal" id="addStickerModal">
        <h3>➕ Добавить стикер</h3>
        <input type="file" id="stickerFileInput" accept="image/*">
        <p style="color:#8E8E9A; font-size:0.7rem; text-align:center;">Выберите изображение</p>
        <div style="text-align:center;">
          <img id="stickerPreview" style="max-width:150px; max-height:150px; display:none; margin:10px auto;">
        </div>
        <input type="text" id="stickerEmojiInput" placeholder="Эмодзи (например: 😊)">
        <button id="confirmStickerBtn">Добавить</button>
        <button id="cancelStickerBtn" class="secondary">Отмена</button>
      </div>
      <div class="image-viewer" id="imageViewer"><img id="fullscreenImage" src=""></div>
    `;
  }

  _bindEvents() {
    document.getElementById('menuBtn').addEventListener('click', () => this._toggleSidebar(true));
    document.getElementById('overlay').addEventListener('click', () => this._toggleSidebar(false));
    document.getElementById('backBtn').addEventListener('click', () => this._goToChats());
    document.getElementById('sendBtn').addEventListener('click', () => this._sendMessage());
    document.getElementById('messageInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._sendMessage(); });
    document.getElementById('fileInput').addEventListener('change', (e) => { if (e.target.files[0]) this._sendFile(e.target.files[0]); e.target.value = ''; });
    document.getElementById('replyBarClose').addEventListener('click', () => { this.replyTo = null; document.getElementById('replyBar').classList.add('hidden'); });
    document.getElementById('chatMenuBtn').addEventListener('click', (e) => { e.stopPropagation(); this._showChatMenu(); });
    document.addEventListener('click', () => { document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden')); document.getElementById('reactionPanel').classList.add('hidden'); document.getElementById('contextMenu').classList.add('hidden'); });
    document.getElementById('inviteToChatBtn').addEventListener('click', () => { if (this.currentChat) this._shareInviteLink(this.currentChat); });
    document.getElementById('searchInChatBtn').addEventListener('click', () => this._toggleSearchInChat());
    document.getElementById('searchInChatCloseBtn').addEventListener('click', () => this._toggleSearchInChat(false));
    document.getElementById('searchInChatInput').addEventListener('input', () => this._searchInChat());
    document.getElementById('searchPrevBtn').addEventListener('click', () => this._navigateSearch(-1));
    document.getElementById('searchNextBtn').addEventListener('click', () => this._navigateSearch(1));
    document.getElementById('pinnedMsgBtn').addEventListener('click', () => this._togglePinnedMessage());
    document.getElementById('unpinBtn').addEventListener('click', () => this._unpinMessage());
    document.getElementById('topicsMenuBtn').addEventListener('click', () => this._openTopicsScreen());
    document.getElementById('topicsBackBtn').addEventListener('click', () => this._closeTopicsScreen());
    document.getElementById('addTopicBtn').addEventListener('click', () => this._openModal('createTopicModal'));
    document.getElementById('groupSettingsBtn').addEventListener('click', () => this._showGroupSettings());
    document.getElementById('closeGroupSettingsBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('confirmTopicBtn').addEventListener('click', () => this._createTopic());
    document.getElementById('cancelTopicBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('topicClosedToggle').addEventListener('click', function() { this.classList.toggle('active'); });
    document.getElementById('callBtn').addEventListener('click', () => { if (this.currentChat) REVERS.startCall(this.currentChat.id, true); });
    document.getElementById('audioCallBtn').addEventListener('click', () => { if (this.currentChat) REVERS.startCall(this.currentChat.id, false); });
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
    document.querySelectorAll('.reaction-emoji').forEach(el => { el.addEventListener('click', (e) => { e.stopPropagation(); this._addReaction(el.dataset.emoji); }); });
    document.getElementById('ctxEdit').addEventListener('click', () => this._editSelectedMessage());
    document.getElementById('ctxReply').addEventListener('click', () => this._replyToSelectedMessage());
    document.getElementById('ctxPin').addEventListener('click', () => this._pinSelectedMessage());
    document.getElementById('ctxCopy').addEventListener('click', () => this._copySelectedMessage());
    document.getElementById('ctxDelete').addEventListener('click', () => this._deleteSelectedMessage());
    document.getElementById('searchChatsBtn').addEventListener('click', () => this._toggleChatSearch());
    document.getElementById('searchChatsCloseBtn').addEventListener('click', () => this._toggleChatSearch(false));
    document.getElementById('searchChatsInput').addEventListener('input', (e) => this._filterChats(e.target.value));
    document.getElementById('addContactBtn').addEventListener('click', () => this._openModal('addContactModal'));
    document.getElementById('addContactConfirmBtn').addEventListener('click', () => this._addContact());
    document.getElementById('addContactCloseBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('connectSendBtn').addEventListener('click', () => this._handleConnect());
    document.getElementById('copySignalBtn').addEventListener('click', () => { const v = document.getElementById('mySignalOutput').value; if (v && v !== 'Генерация...') { navigator.clipboard.writeText(v); alert('Скопировано!'); } });
    document.getElementById('closeConnectBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('qrMenuBtn').addEventListener('click', () => this._showQR());
    document.getElementById('closeQrBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('copyInviteLinkBtn').addEventListener('click', () => { const l = document.getElementById('inviteLink').textContent; if (l) { navigator.clipboard.writeText(l); alert('Скопировано!'); } });
    document.getElementById('shareInviteBtn').addEventListener('click', () => { const l = document.getElementById('inviteLink').textContent; if (l && navigator.share) { navigator.share({ title: 'REVERS', text: 'Присоединяйся!', url: l }).catch(() => {}); } });
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
    document.querySelectorAll('[id$="Btn"]').forEach(btn => { if (btn.id.startsWith('close') || btn.id.startsWith('cancel')) btn.addEventListener('click', () => this._closeAllModals()); });
    document.getElementById('saveAccountBtn').addEventListener('click', () => { const n = document.getElementById('nicknameInput').value.trim(); if (n) REVERS.setName(n); this._closeAllModals(); });
    document.getElementById('changeAvatarBtn').addEventListener('click', () => document.getElementById('modalAvatarInput').click());
    document.getElementById('modalAvatarInput').addEventListener('change', (e) => { if (e.target.files[0]) { const r = new FileReader(); r.onload = (ev) => { REVERS.setAvatar(ev.target.result); document.getElementById('modalAvatar').src = ev.target.result; }; r.readAsDataURL(e.target.files[0]); } });
    document.getElementById('copyIdBtn').addEventListener('click', () => { navigator.clipboard.writeText(REVERS.getMyId()); alert('ID скопирован!'); });
    document.getElementById('createGroupBtn').addEventListener('click', () => this._openModal('createGroupModal'));
    document.getElementById('confirmGroupBtn').addEventListener('click', () => this._createGroup());
    document.getElementById('createChannelBtn').addEventListener('click', () => this._openModal('createChannelModal'));
    document.getElementById('confirmChannelBtn').addEventListener('click', () => this._createChannel());
    document.getElementById('themeToggle').addEventListener('click', () => this._toggleTheme());
    document.getElementById('soundToggle').addEventListener('click', () => this._toggleSound());
    document.getElementById('imageViewer').addEventListener('click', () => { document.getElementById('imageViewer').classList.remove('active'); });
  }

  _onReady() {
    window.REVERSApp = this;
    this._initWelcomeGroup();
    document.getElementById('myIdDisplay').textContent = REVERS.getMyId();
    REVERS.onMessage((msg) => {
      if (msg.type === 'p2p-signal') this._handleIncomingSignal(msg);
      else if (this.currentChat && (this.currentChat.id === msg.from || this.currentChat.id === msg.room)) this._renderMessages(this.currentChat);
      this._renderChatsList();
    });
    REVERS.onChatUpdate(() => this._renderChatsList());
    REVERS.onIncomingCall((data) => {
      if (confirm(`📹 Входящий ${data.video ? 'видео' : 'аудио'} звонок от ${data.peerId}. Ответить?`)) {
        REVERS.acceptCall(data.peerId, data.video).then(pc => {
          if (pc) pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => { pc.createAnswer().then(answer => { pc.setLocalDescription(answer); }); });
        });
      }
    });
    this._loadSettings();
    this._renderChatsList();
    this._toggleSidebar(false);
  }

  _initWelcomeGroup() {
    const key = localStorage.getItem('revers_welcome');
    if (key) return;
    const g = REVERS.createGroup('🖐 REVERS Welcome', 'forum');
    groupManager.groups.get(g.key).topics = [
      { id: 'general', name: '💬 Общий чат', closed: false, pinned: true, created: Date.now(), messages: [] },
      { id: 'rules', name: '📜 Правила', closed: true, pinned: true, created: Date.now(), messages: [] },
      { id: 'help', name: '❓ Помощь', closed: false, pinned: false, created: Date.now(), messages: [] }
    ];
    groupManager._save();
    localStorage.setItem('revers_welcome', g.key);
  }

  _showChatMenu() {
    document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden'));
    if (!this.currentChat) return;
    const type = this.currentChat.type;
    const menu = document.getElementById(
      type === 'saved' ? 'savedDropdown' :
      type === 'group' ? 'groupDropdown' :
      type === 'channel' ? 'channelDropdown' : 'contactDropdown'
    );
    if (menu) menu.classList.remove('hidden');
  }

  _toggleChatSearch(show = true) { document.getElementById('searchChatsBar').classList.toggle('hidden', !show); if (show) document.getElementById('searchChatsInput').focus(); else { document.getElementById('searchChatsInput').value = ''; this._renderChatsList(); } }
  async _filterChats(query) { const all = await REVERS.getAllChats(); this._renderChatsList(query ? all.filter(c => c.name.toLowerCase().includes(query.toLowerCase())) : all); }
  _addContact() { const id = document.getElementById('addContactIdInput').value.trim(); if (!id) return; this._closeAllModals(); this._openChat({ id, type: 'contact', name: id }); REVERS.connectToPeer(id); document.getElementById('addContactIdInput').value = ''; }
  _toggleSearchInChat(show = true) { document.getElementById('searchInChatBar').classList.toggle('hidden', !show); if (show) document.getElementById('searchInChatInput').focus(); else { document.getElementById('searchInChatInput').value = ''; this._clearSearchHighlights(); } }
  _searchInChat() { const q = document.getElementById('searchInChatInput').value.toLowerCase(); document.querySelectorAll('.message-text').forEach(m => m.innerHTML = m.textContent); if (!q) return; let c = 0; document.querySelectorAll('.message-text').forEach(m => { const t = m.textContent; if (t.toLowerCase().includes(q)) { m.innerHTML = t.replace(new RegExp(q, 'gi'), '<span class="highlight">$&</span>'); c++; } }); document.getElementById('searchCounter').textContent = c > 0 ? '1/' + c : '0/0'; }
  _navigateSearch(dir) {}
  _clearSearchHighlights() { document.querySelectorAll('.highlight').forEach(el => el.outerHTML = el.textContent); }
  _togglePinnedMessage() { const p = localStorage.getItem('revers_pinned_' + this.currentChat?.id); if (p) { document.getElementById('pinnedMessage').classList.remove('hidden'); document.getElementById('pinnedText').textContent = p; } }
  _pinMessage(msg) { localStorage.setItem('revers_pinned_' + this.currentChat.id, msg.text); document.getElementById('pinnedMessage').classList.remove('hidden'); document.getElementById('pinnedText').textContent = msg.text; }
  _unpinMessage() { localStorage.removeItem('revers_pinned_' + this.currentChat?.id); document.getElementById('pinnedMessage').classList.add('hidden'); }
  
  _showContextMenu(e, msg, idx) {
    e.preventDefault(); e.stopPropagation();
    const menu = document.getElementById('contextMenu');
    menu.classList.remove('hidden');
    const x = Math.min((e.touches ? e.touches[0].clientX : e.clientX), window.innerWidth - 190);
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu._target = { msg, idx };
  }

  _editSelectedMessage() { const m = document.getElementById('contextMenu'); this._editingMessage = m._target.msg; document.getElementById('messageInput').value = m._target.msg.text; document.getElementById('messageInput').focus(); m.classList.add('hidden'); }
  _replyToSelectedMessage() { const m = document.getElementById('contextMenu'); const { msg } = m._target; this.replyTo = { text: msg.text, from: msg.from }; document.getElementById('replyBarText').textContent = '↩️ ' + (msg.text || '').substring(0, 50); document.getElementById('replyBar').classList.remove('hidden'); document.getElementById('messageInput').focus(); m.classList.add('hidden'); }
  _pinSelectedMessage() { const m = document.getElementById('contextMenu'); this._pinMessage(m._target.msg); m.classList.add('hidden'); }
  _copySelectedMessage() { navigator.clipboard.writeText(document.getElementById('contextMenu')._target.msg.text); document.getElementById('contextMenu').classList.add('hidden'); }
  _deleteSelectedMessage() { const m = document.getElementById('contextMenu'); this._deleteMessage(m._target.msg, m._target.idx); m.classList.add('hidden'); }
  _deleteMessage(msg, idx) { if (!this.currentChat) return; if (this.currentChat.type === 'saved') { REVERS.getChatHistory('me').then(h => { h.splice(idx, 1); REVERS.clearChatHistory('me'); h.forEach(x => REVERS.sendMessage('me', x.text)); }); } else if (this.currentChat.type === 'group') { const h = REVERS.getGroupHistory(this.currentChat.id); h.splice(idx, 1); } else if (this.currentChat.type === 'channel') { const h = REVERS.getChannelHistory(this.currentChat.id); h.splice(idx, 1); } else { REVERS.getChatHistory(this.currentChat.id).then(h => { h.splice(idx, 1); REVERS.clearChatHistory(this.currentChat.id); h.forEach(x => REVERS.sendMessage(this.currentChat.id, x.text)); }); } this._renderMessages(this.currentChat); }
  _clearHistory() { if (!this.currentChat || !confirm('Очистить историю?')) return; REVERS.clearChatHistory(this.currentChat.type === 'saved' ? 'me' : this.currentChat.id); this._renderMessages(this.currentChat); this._renderChatsList(); }
  _toggleStickerPanel() { const p = document.getElementById('stickerPanel'); p.classList.toggle('hidden'); if (!p.classList.contains('hidden')) { this._renderStickerTabs(); this._renderStickerGrid('recent'); } }
  _renderStickerTabs() { const tabs = document.getElementById('stickerTabs'); const packs = stickerManager.getPacks(); tabs.innerHTML = ''; Object.entries(packs).forEach(([id, pack]) => { const tab = document.createElement('div'); tab.className = `sticker-tab ${this._activeStickerPack === id ? 'active' : ''}`; tab.textContent = pack.name; tab.addEventListener('click', () => { this._activeStickerPack = id; this._renderStickerTabs(); this._renderStickerGrid(id); }); tabs.appendChild(tab); }); const add = document.createElement('div'); add.className = 'sticker-tab'; add.textContent = '➕'; add.addEventListener('click', () => this._openModal('createStickerPackModal')); tabs.appendChild(add); }
  _renderStickerGrid(packId) { const grid = document.getElementById('stickerGrid'); const stickers = stickerManager.getStickers(packId); grid.innerHTML = ''; stickers.forEach(s => { const d = document.createElement('div'); d.className = 'sticker-item'; if (typeof s === 'object' && s.data) d.innerHTML = `<img src="${s.data}" style="width:64px;height:64px;object-fit:contain;">`; else { d.textContent = typeof s === 'string' ? s : s.emoji || '🖼️'; d.style.fontSize = '2rem'; } d.addEventListener('click', () => { const sd = typeof s === 'string' ? s : s.data || s.emoji; stickerManager.addToRecent(sd); this._sendSticker(sd); }); grid.appendChild(d); }); document.getElementById('stickerPackActions').classList.toggle('hidden', packId === 'recent' || packId === 'default'); if (!document.getElementById('stickerPackActions').classList.contains('hidden')) document.getElementById('addStickerToPackBtn').dataset.packId = packId; }
  _sendSticker(sticker) { if (!this.currentChat) return; const msg = typeof sticker === 'string' && sticker.length <= 4 ? sticker : '🖼️'; if (this.currentChat.type === 'saved') REVERS.sendMessage('me', msg); else if (this.currentChat.type === 'group') REVERS.sendGroupMessage(this.currentChat.id, msg); else if (this.currentChat.type === 'channel') REVERS.sendChannelMessage(this.currentChat.id, msg); else REVERS.sendMessage(this.currentChat.id, msg); this._renderMessages(this.currentChat); document.getElementById('stickerPanel').classList.add('hidden'); }
  _createStickerPack() { const n = document.getElementById('stickerPackNameInput').value.trim(); if (!n) return; this._activeStickerPack = stickerManager.createPack(n); this._closeAllModals(); this._toggleStickerPanel(); document.getElementById('stickerPackNameInput').value = ''; }
  _addStickerToPack() { const pid = document.getElementById('addStickerToPackBtn').dataset.packId; const f = document.getElementById('stickerFileInput').files[0]; if (!f || !pid) return; const r = new FileReader(); r.onload = () => { stickerManager.addSticker(pid, r.result, document.getElementById('stickerEmojiInput').value.trim()); this._closeAllModals(); this._renderStickerGrid(pid); document.getElementById('stickerFileInput').value = ''; document.getElementById('stickerEmojiInput').value = ''; document.getElementById('stickerPreview').style.display = 'none'; }; r.readAsDataURL(f); }
  _previewSticker(f) { const r = new FileReader(); r.onload = (e) => { const p = document.getElementById('stickerPreview'); p.src = e.target.result; p.style.display = 'block'; }; r.readAsDataURL(f); }
  _deleteStickerPack() { if (this._activeStickerPack && confirm('Удалить пак?')) { stickerManager.deletePack(this._activeStickerPack); this._activeStickerPack = 'recent'; this._renderStickerTabs(); this._renderStickerGrid('recent'); } }
  _showReactions(target) { const p = document.getElementById('reactionPanel'); const r = target.getBoundingClientRect(); p.style.top = (r.top - 50) + 'px'; p.style.left = Math.min(r.left + r.width/2 - 90, window.innerWidth - 200) + 'px'; p.classList.remove('hidden'); p._target = target; }
  _addReaction(emoji) { const p = document.getElementById('reactionPanel'); const t = p._target; if (!t) return; const ex = t.querySelector('.reactions'); if (ex) { if (!ex.textContent.includes(emoji)) ex.textContent += emoji; } else { const r = document.createElement('div'); r.className = 'reactions'; r.textContent = emoji; t.querySelector('.bubble').appendChild(r); } p.classList.add('hidden'); }

  // Браузер
  _openBrowser(url) { document.getElementById('browserUrlInput').value = url || 'https://www.startpage.com'; this._openModal('browserModal'); }
  async _openInBrowser() { let url = document.getElementById('browserUrlInput').value.trim(); if (!url) return; if (!url.startsWith('http')) url = 'https://' + url; this._closeAllModals(); try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url, presentationStyle: 'popover' }); } catch(e) { window.open(url, '_system'); } }
  async _openInBrowserDirect(url) { try { const { Browser } = await import('@capacitor/browser'); await Browser.open({ url, presentationStyle: 'popover' }); } catch(e) { window.open(url, '_system'); } }
  _openLink(url) { this._openInBrowserDirect(url); }

  async _showQR() { this._closeAllModals(); const d = JSON.stringify({ id: REVERS.getMyId(), name: REVERS.getMyProfile().name, type: 'revers-connect', version: 1 }); const c = document.getElementById('qrCanvas'); try { await QRCode.toCanvas(c, d, { width: 200, margin: 2, color: { dark: '#0F0F12', light: '#FFFFFF' } }); } catch(e) { const ctx = c.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 200, 200); ctx.fillStyle = '#E63946'; ctx.font = '14px monospace'; ctx.textAlign = 'center'; ctx.fillText('REVERS', 100, 90); } document.getElementById('inviteLink').textContent = `revers://chat?id=${REVERS.getMyId()}&name=${encodeURIComponent(REVERS.getMyProfile().name)}`; document.getElementById('qrModal').classList.add('active'); }
  async _startScanner() { this._closeAllModals(); const c = document.getElementById('scannerContainer'); c.innerHTML = ''; document.getElementById('scannerModal').classList.add('active'); try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); s.getTracks().forEach(t => t.stop()); } catch(e) { c.innerHTML = '<div style="text-align:center;padding:40px;color:#E63946;"><p>❌ Нет доступа к камере</p></div>'; return; } try { this.html5QrCode = new Html5Qrcode('scannerContainer'); await this.html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, (t) => this._handleScannedQR(t), () => {}); } catch(e) { c.innerHTML = '<div style="text-align:center;padding:40px;color:#E63946;"><p>❌ Ошибка сканера</p></div>'; } }
  _stopScanner() { if (this.html5QrCode) { this.html5QrCode.stop().then(() => { this.html5QrCode = null; this._closeAllModals(); }).catch(() => this._closeAllModals()); } else this._closeAllModals(); }
  _handleScannedQR(t) { try { const d = JSON.parse(t); if (d.type === 'revers-connect' && d.id) { this._stopScanner(); REVERS.connectToPeer(d.id); this._openChat({ id: d.id, type: 'contact', name: d.name || d.id }); return; } } catch(e) {} if (t.length > 5) { this._stopScanner(); this._openChat({ id: t, type: 'contact', name: t }); } }
  _handleIncomingSignal(msg) { if (msg.initiator) { document.getElementById('signalInput').value = JSON.stringify(msg.signal); this._openModal('connectModal'); } else REVERS.applySignal(msg.from, msg.signal); }
  _openConnectModal() { this._closeAllModals(); document.getElementById('connectModal').classList.add('active'); document.getElementById('mySignalOutput').value = 'Генерация...'; const pid = this.currentChat?.id || 'peer_' + Date.now(); const orig = REVERS.p2pNetwork.onMessageCallback; REVERS.p2pNetwork.onMessageCallback = (m) => { if (m.type === 'p2p-signal' && m.initiator && m.to === pid) document.getElementById('mySignalOutput').value = JSON.stringify(m.signal); if (orig) orig(m); }; REVERS.connectToPeer(pid); setTimeout(() => { const o = document.getElementById('mySignalOutput'); if (!o.value || o.value === 'Генерация...') o.value = 'Не получен.'; }, 5000); }
  _handleConnect() { const pid = document.getElementById('peerIdInput').value.trim(); const sig = document.getElementById('signalInput').value.trim(); if (sig) { try { const s = JSON.parse(sig); if (s.sdp || s.candidate) { REVERS.acceptPeer(pid || 'remote', s); this._closeAllModals(); this._updateConnectionStatus(true); return; } } catch(e) { alert('Неверный сигнал'); } } if (pid) { REVERS.connectToPeer(pid); document.getElementById('mySignalOutput').value = 'Генерация...'; } }
  async _toggleVoiceRecord() { const btn = document.getElementById('voiceRecordBtn'); if (this.isRecording) { btn.textContent = '🎤 Голосовое'; this.isRecording = false; if (this.voiceRecorder) { const r = await this.voiceRecorder; if (r?.stop) { const audio = await new Promise(resolve => { r.recorder.onstop = () => { setTimeout(() => { const blob = new Blob(r.chunks || [], { type: 'audio/webm' }); const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); }, 100); }; r.stop(); }); if (audio && this.currentChat) { const dur = Math.round((Date.now() - this.voiceStartTime) / 1000); const tid = this.currentChat.type === 'saved' ? 'me' : this.currentChat.id; REVERS.sendVoice(tid, audio, dur || 1); this._renderMessages(this.currentChat); this._renderChatsList(); } } this.voiceRecorder = null; } } else { try { const ts = await navigator.mediaDevices.getUserMedia({ audio: true }); ts.getTracks().forEach(t => t.stop()); } catch(e) { alert('❌ Нет доступа к микрофону'); return; } btn.textContent = '🔴 Запись...'; this.isRecording = true; this.voiceStartTime = Date.now(); this.voiceRecorder = REVERS.recordVoice(); } }

  _sendMessage() {
    const input = document.getElementById('messageInput'); const text = input.value.trim();
    if (!text || !this.currentChat) return;
    if (this._editingMessage) { this._editingMessage.text = text; this._editingMessage.edited = true; this._editingMessage = null; }
    else if (this._currentTopic) { groupManager.sendToTopic(this.currentChat.id, this._currentTopic, text); this._renderTopicMessages(); }
    else if (this.currentChat.type === 'saved') REVERS.sendMessage('me', text);
    else if (this.currentChat.type === 'group') REVERS.sendGroupMessage(this.currentChat.id, text);
    else if (this.currentChat.type === 'channel') REVERS.sendChannelMessage(this.currentChat.id, text);
    else REVERS.sendMessage(this.currentChat.id, text);
    this._renderMessages(this.currentChat); input.value = ''; this.replyTo = null; document.getElementById('replyBar').classList.add('hidden'); this._renderChatsList();
  }

  _sendFile(file) { if (!this.currentChat) return; const tid = this.currentChat.type === 'saved' ? 'me' : this.currentChat.id; REVERS.sendFile(tid, file).then(() => { this._renderMessages(this.currentChat); }); }
  _createGroup() { const n = document.getElementById('groupNameInput').value.trim(); const t = document.getElementById('groupTypeSelect')?.value || 'chat'; if (!n) return; const g = REVERS.createGroup(n, t); this._closeAllModals(); this._openChat({ id: g.key, name: (t === 'forum' ? '📂 ' : '👥 ') + n, type: 'group' }); document.getElementById('groupNameInput').value = ''; }
  _createChannel() { const n = document.getElementById('channelNameInput').value.trim(); if (!n) return; const k = REVERS.createChannel(n); this._closeAllModals(); this._openChat({ id: k, name: '📢 ' + n, type: 'channel' }); document.getElementById('channelNameInput').value = ''; }

  _showGroupSettings() {
    if (!this.currentChat || this.currentChat.type !== 'group') return;
    const g = groupManager.groups.get(this.currentChat.id); if (!g) return;
    const c = document.getElementById('groupSettingsContent');
    c.innerHTML = `
      <div class="setting-row"><span class="setting-label">Тип:</span><span style="color:#8E8E9A;">${g.type === 'forum' ? '📂 Форум' : '💬 Чат'}</span></div>
      <div class="setting-row"><span class="setting-label">Темы:</span><span style="color:#8E8E9A;">${g.topics.length}</span></div>
      <div class="setting-row"><span class="setting-label">Участники:</span><span style="color:#8E8E9A;">${g.members.length}</span></div>
      <div style="text-align:center; margin:8px 0;">
        <p style="color:#8E8E9A; font-size:0.8rem;">Аватар группы:</p>
        <img id="groupAvatarPreview" class="avatar-modal-img" src="${g.avatar || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ccircle fill=%22%232A2A3A%22 cx=%2250%22 cy=%2250%22 r=%2250%22/%3E%3Ctext x=%2250%22 y=%2267%22 text-anchor=%22middle%22 fill=%22%23E63946%22 font-size=%2240%22%3E👥%3C/text%3E%3C/svg%3E'}" style="width:60px; height:60px; margin:0 auto; display:block;">
        <button id="changeGroupAvatarBtn" class="secondary" style="margin-top:8px;">Сменить аватар</button>
        <input type="file" id="groupAvatarInput" accept="image/*" style="display:none">
      </div>
      <button id="toggleGroupTypeBtn" style="background:#2A2A3A; border:none; padding:8px; border-radius:12px; color:white; width:100%; margin-top:8px;">Переключить на ${g.type === 'forum' ? '💬 Чат' : '📂 Форум'}</button>
      <button id="deleteGroupSettingsBtn" style="background:#E63946; border:none; padding:8px; border-radius:12px; color:white; width:100%; margin-top:4px;">🗑️ Удалить группу</button>
    `;
    document.getElementById('toggleGroupTypeBtn').addEventListener('click', () => { groupManager.setGroupType(this.currentChat.id, g.type === 'forum' ? 'chat' : 'forum'); this._closeAllModals(); this._renderMessages(this.currentChat); });
    document.getElementById('deleteGroupSettingsBtn').addEventListener('click', () => { if (confirm('Удалить группу?')) { groupManager.deleteGroup(this.currentChat.id); this._goToChats(); this._closeAllModals(); } });
    document.getElementById('changeGroupAvatarBtn').addEventListener('click', () => document.getElementById('groupAvatarInput').click());
    document.getElementById('groupAvatarInput').addEventListener('change', (e) => {
      if (e.target.files[0]) {
        const r = new FileReader();
        r.onload = (ev) => { groupManager.setGroupAvatar(this.currentChat.id, ev.target.result); document.getElementById('groupAvatarPreview').src = ev.target.result; };
        r.readAsDataURL(e.target.files[0]);
      }
    });
    this._openModal('groupSettingsModal');
  }

  _openTopicsScreen() { if (!this.currentChat || this.currentChat.type !== 'group') return; document.getElementById('chatScreen').classList.add('hidden'); document.getElementById('topicsScreen').classList.remove('hidden'); this._renderTopicsList(); }
  _closeTopicsScreen() { document.getElementById('topicsScreen').classList.add('hidden'); document.getElementById('chatScreen').classList.remove('hidden'); }
  _renderTopicsList() {
    if (!this.currentChat) return; const topics = groupManager.getTopics(this.currentChat.id);
    const container = document.getElementById('topicsList'); container.innerHTML = '';
    topics.forEach(topic => {
      const d = document.createElement('div'); d.className = 'chat-item';
      const last = topic.messages[topic.messages.length - 1];
      d.innerHTML = `<div class="chat-avatar">${topic.closed ? '🔒' : '📂'}</div><div class="chat-info"><div class="chat-name">${topic.pinned ? '📌 ' : ''}${this._esc(topic.name)}</div><div class="chat-preview">${last?.text || 'Нет сообщений'} · ${topic.messages.length}</div></div>`;
      d.addEventListener('click', () => { this._currentTopic = topic.id; this._closeTopicsScreen(); this._renderTopicMessages(); });
      let timer; d.addEventListener('touchstart', () => { timer = setTimeout(() => { const act = prompt('1.Переименовать\n2.Закрепить/открепить\n3.Закрыть/открыть\n4.Удалить'); if (act === '1') { const nm = prompt('Название:'); if (nm) topic.name = nm; } if (act === '2') groupManager.togglePinTopic(this.currentChat.id, topic.id); if (act === '3') groupManager.toggleCloseTopic(this.currentChat.id, topic.id); if (act === '4' && confirm('Удалить тему?')) groupManager.removeTopic(this.currentChat.id, topic.id); this._renderTopicsList(); }, 500); }); d.addEventListener('touchend', () => clearTimeout(timer));
      container.appendChild(d);
    });
  }
  _createTopic() { const n = document.getElementById('topicNameInput').value.trim(); if (!n || !this.currentChat) return; const closed = document.getElementById('topicClosedToggle').classList.contains('active'); groupManager.addTopic(this.currentChat.id, n); if (closed) { const ts = groupManager.getTopics(this.currentChat.id); const t = ts[ts.length - 1]; if (t) groupManager.toggleCloseTopic(this.currentChat.id, t.id); } this._closeAllModals(); this._renderTopicsList(); document.getElementById('topicNameInput').value = ''; }
  _renderTopicMessages() { if (!this.currentChat || !this._currentTopic) return; const msgs = groupManager.getTopicMessages(this.currentChat.id, this._currentTopic); const area = document.getElementById('messagesArea'); area.innerHTML = ''; msgs.forEach(msg => { const d = document.createElement('div'); d.className = `message ${msg.from === REVERS.getMyId() ? 'outgoing' : 'incoming'}`; d.innerHTML = `<div class="bubble"><div class="message-text">${this._esc(msg.text)}</div><div class="message-time">${new Date(msg.time).toLocaleTimeString()}</div></div>`; area.appendChild(d); }); area.scrollTop = area.scrollHeight; }

  _generateInviteLink(chat) { if (!chat) return ''; const type = chat.type === 'group' ? 'group' : chat.type === 'channel' ? 'channel' : 'chat'; return `revers://${type}?id=${chat.id}&name=${encodeURIComponent(chat.name)}`; }
  _shareInviteLink(chat) { const l = this._generateInviteLink(chat); if (navigator.share) { navigator.share({ title: 'REVERS', text: 'Присоединяйся!', url: l }).catch(() => {}); } else { navigator.clipboard.writeText(l); alert('Ссылка скопирована!'); } }

  _openChat(chat) {
    this.currentChat = chat; this._currentTopic = null;
    document.getElementById('chatsScreen').classList.add('hidden');
    const g = groupManager.groups.get(chat.id);
    if (g?.type === 'forum') {
      document.getElementById('chatScreen').classList.add('hidden');
      document.getElementById('topicsScreen').classList.remove('hidden');
      this._renderTopicsList();
    } else {
      document.getElementById('topicsScreen').classList.add('hidden');
      document.getElementById('chatScreen').classList.remove('hidden');
      document.getElementById('chatName').textContent = chat.name;
      this._updateConnectionStatus(REVERS.isConnected(chat.id));
      this._renderMessages(chat);
    }
    this._toggleSidebar(false);
    document.getElementById('stickerPanel').classList.add('hidden');
    document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden'));
    document.getElementById('reactionPanel').classList.add('hidden');
    document.getElementById('contextMenu').classList.add('hidden');
    this._togglePinnedMessage(); this.replyTo = null; this._editingMessage = null;
    document.getElementById('replyBar').classList.add('hidden');
  }

  _goToChats() { document.getElementById('chatScreen').classList.add('hidden'); document.getElementById('topicsScreen').classList.add('hidden'); document.getElementById('chatsScreen').classList.remove('hidden'); this.currentChat = null; this._currentTopic = null; this.replyTo = null; document.getElementById('replyBar').classList.add('hidden'); this._renderChatsList(); }

  async _renderChatsList(list = null) {
    const c = document.getElementById('chatsList'); c.innerHTML = '';
    const chats = list || await REVERS.getAllChats();
    if (!chats.length) { c.innerHTML = '<p style="color:#8E8E9A; text-align:center; padding:20px;">Нет чатов</p>'; return; }
    chats.forEach(chat => { const d = document.createElement('div'); d.className = 'chat-item'; const emoji = chat.type === 'saved' ? '📔' : chat.type === 'group' ? (chat.name.startsWith('📂') ? '📂' : '👥') : chat.type === 'channel' ? '📢' : '💬'; d.innerHTML = `<div class="chat-avatar">${emoji}</div><div class="chat-info"><div class="chat-name">${this._esc(chat.name)}</div><div class="chat-preview">${this._esc(chat.lastMsg || '')}</div></div><div class="chat-time">${chat.lastTime ? new Date(chat.lastTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</div>`; d.addEventListener('click', () => this._openChat(chat)); c.appendChild(d); });
  }

  async _renderMessages(chat) {
    const area = document.getElementById('messagesArea'); area.innerHTML = '';
    let history = [];
    if (chat.type === 'saved') history = await REVERS.getChatHistory('me');
    else if (chat.type === 'group') history = REVERS.getGroupHistory(chat.id);
    else if (chat.type === 'channel') history = REVERS.getChannelHistory(chat.id);
    else history = await REVERS.getChatHistory(chat.id);
    history.forEach((msg, idx) => {
      const isOutgoing = msg.from === REVERS.getMyId();
      const div = document.createElement('div'); div.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`; div.dataset.msgIdx = idx;
      let html = '<div class="bubble">';
      const linkedText = this._esc(msg.text || '').replace(/(https?:\/\/[^\s]+)/g, '<a onclick="window.REVERSApp._openLink(\'$1\')" style="color:#2A9D8F; text-decoration:underline; cursor:pointer;">$1</a>');
      html += `<div class="message-text">${linkedText}</div>`;
      if (msg.edited) html += '<span style="font-size:0.6rem; color:#8E8E9A;"> (изм.)</span>';
      if (isOutgoing) html += `<div class="message-status">${msg.read ? '✓✓' : '✓'}</div>`;
      if (msg.type === 'voice' && msg.fileData) html += `<audio controls src="${msg.fileData}" style="max-width:200px; height:30px; margin-top:4px;"></audio>`;
      if (msg.type === 'file' && msg.fileName) {
        const isImage = msg.fileType?.startsWith('image/');
        const isVideo = msg.fileType?.startsWith('video/');
        const isAudio = msg.fileType?.startsWith('audio/');
        html += `<div class="file-attachment">📄 ${this._esc(msg.fileName)} (${this._formatSize(msg.fileSize)})</div>`;
        if (isImage && msg.fileData) html += `<img src="${msg.fileData}" class="file-preview-img" onclick="event.stopPropagation(); document.getElementById('fullscreenImage').src='${msg.fileData}'; document.getElementById('imageViewer').classList.add('active')">`;
        if (isVideo && msg.fileData) html += `<video controls src="${msg.fileData}" style="max-width:200px; max-height:150px; border-radius:12px; margin-top:4px;"></video>`;
        if (isAudio && msg.fileData) html += `<audio controls src="${msg.fileData}" style="max-width:200px; height:30px; margin-top:4px;"></audio>`;
      }
      if (msg.reactions) html += `<div class="reactions">${msg.reactions}</div>`;
      html += `<div class="message-time">${new Date(msg.time).toLocaleTimeString()}</div></div>`;
      div.innerHTML = html;
      div.addEventListener('contextmenu', (e) => this._showContextMenu(e, msg, idx));
      let pressTimer; div.addEventListener('touchstart', () => { pressTimer = setTimeout(() => this._showReactions(div), 500); }); div.addEventListener('touchend', () => clearTimeout(pressTimer)); div.addEventListener('touchmove', () => clearTimeout(pressTimer));
      area.appendChild(div);
    });
    area.scrollTop = area.scrollHeight;
  }

  _renderGroupsList() { const c = document.getElementById('groupsList'); c.innerHTML = ''; REVERS.getAllChats().then(all => { const groups = all.filter(ch => ch.type === 'group'); if (!groups.length) { c.innerHTML = '<p style="color:#8E8E9A; text-align:center;">Нет групп</p>'; return; } groups.forEach(g => { const d = document.createElement('div'); d.style.cssText = 'background:#2A2A3A; border-radius:16px; padding:12px; margin:8px 0; display:flex; justify-content:space-between; align-items:center;'; d.innerHTML = `<strong style="color:white">${g.name}</strong>`; const btn = document.createElement('button'); btn.textContent = 'Открыть'; btn.style.cssText = 'background:#E63946; border:none; padding:6px 12px; border-radius:20px; color:white; cursor:pointer;'; btn.addEventListener('click', () => { this._closeAllModals(); this._openChat(g); }); d.appendChild(btn); c.appendChild(d); }); }); }
  _renderChannelsList() { const c = document.getElementById('channelsList'); c.innerHTML = ''; REVERS.getAllChats().then(all => { const channels = all.filter(ch => ch.type === 'channel'); if (!channels.length) { c.innerHTML = '<p style="color:#8E8E9A; text-align:center;">Нет каналов</p>'; return; } channels.forEach(ch => { const d = document.createElement('div'); d.style.cssText = 'background:#2A2A3A; border-radius:16px; padding:12px; margin:8px 0; display:flex; justify-content:space-between; align-items:center;'; d.innerHTML = `<strong style="color:white">${ch.name}</strong>`; const btn = document.createElement('button'); btn.textContent = 'Открыть'; btn.style.cssText = 'background:#E63946; border:none; padding:6px 12px; border-radius:20px; color:white; cursor:pointer;'; btn.addEventListener('click', () => { this._closeAllModals(); this._openChat(ch); }); d.appendChild(btn); c.appendChild(d); }); }); }

  _formatSize(bytes) { if (!bytes) return ''; if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'; return (bytes / 1073741824).toFixed(1) + ' GB'; }
  _deleteCurrentChat() { if (!this.currentChat || this.currentChat.type === 'saved') return; if (confirm('Удалить этот чат?')) this._goToChats(); }
  _updateConnectionStatus(connected) { const l = document.getElementById('statusLed'); const t = document.getElementById('statusText'); if (connected) { l.classList.add('green'); t.textContent = 'P2P'; } else { l.classList.remove('green'); t.textContent = 'Оффлайн'; } }
  _toggleSidebar(show) { document.getElementById('sidebar').classList.toggle('open', show); document.getElementById('overlay').classList.toggle('active', show); }
  _openModal(id) { this._closeAllModals(); document.getElementById(id).classList.add('active'); this._toggleSidebar(false); }
  _closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
  _toggleTheme() { const t = document.getElementById('themeToggle'); t.classList.toggle('active'); document.body.classList.toggle('light-theme'); localStorage.setItem('revers_dark', t.classList.contains('active')); }
  _toggleSound() { document.getElementById('soundToggle').classList.toggle('active'); }
  _loadSettings() { if (localStorage.getItem('revers_dark') === 'false') { document.body.classList.add('light-theme'); document.getElementById('themeToggle').classList.remove('active'); } }
  _esc(text) { if (!text) return ''; const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
}

document.addEventListener('DOMContentLoaded', () => new REVERSApp());