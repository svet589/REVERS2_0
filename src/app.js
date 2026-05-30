// REVERS Messenger v1.2 — P2P мессенджер
// Лицензия: GNU GPL v3
// Разработчик: https://github.com/svet589

import REVERS from './core/p2p-engine.js';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import stickerManager from './core/sticker-manager.js';

class REVERSApp {
  constructor() {
    this.currentChat = null;
    this.replyTo = null;
    this.html5QrCode = null;
    this.isRecording = false;
    this.voiceRecorder = null;
    this.voiceStartTime = null;
    this._activeStickerPack = 'recent';
    this._editingMessage = null;
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
        
        <div class="chat-dropdown hidden" id="chatDropdown">
          <button class="dropdown-item" id="inviteToChatBtn">🔗 Пригласить</button>
          <button class="dropdown-item" id="searchInChatBtn">🔍 Поиск в чате</button>
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
        <p style="color:#8E8E9A; font-size:0.8rem; text-align:center;">Покажите этот код собеседнику</p>
        <div style="background:#1A1A23; border-radius:12px; padding:8px; margin-top:8px; word-break:break-all;">
          <code style="color:#2A9D8F; font-size:0.6rem;" id="inviteLink"></code>
        </div>
        <button id="copyInviteLinkBtn" class="secondary" style="margin-top:4px;">📋 Копировать ссылку</button>
        <button id="shareInviteBtn" class="secondary" style="margin-top:4px;">📤 Поделиться</button>
        <button id="closeQrBtn" class="secondary" style="margin-top:4px;">Закрыть</button>
      </div>
      
      <div class="modal" id="scannerModal">
        <h3>📷 Сканировать QR</h3>
        <div id="scannerContainer" style="width:100%; border-radius:16px; overflow:hidden;"></div>
        <p style="color:#8E8E9A; font-size:0.7rem; text-align:center;">Наведите камеру на QR-код</p>
        <button id="stopScannerBtn" class="secondary">Отмена</button>
      </div>
      
      <div class="modal" id="browserModal" style="max-width:100%; width:100%; height:100%; border-radius:0; border:none; padding:0; gap:0;">
        <div style="display:flex; align-items:center; gap:6px; padding:8px 12px; background:#0A0A0E; border-bottom:1px solid #1E1E24;">
          <button id="browserBackBtn" style="background:none; border:none; color:#E63946; font-size:1.2rem; cursor:pointer; padding:4px 8px;">◀</button>
          <button id="browserForwardBtn" style="background:none; border:none; color:#E63946; font-size:1.2rem; cursor:pointer; padding:4px 8px;">▶</button>
          <button id="browserReloadBtn" style="background:none; border:none; color:#E63946; font-size:1rem; cursor:pointer; padding:4px 8px;">🔄</button>
          <input type="text" id="browserUrlInput" placeholder="🔍 Поиск или адрес..." style="flex:1; background:#1A1A23; border:1px solid #2A2A3A; border-radius:20px; padding:8px 14px; color:#EFEFEF; font-size:0.8rem; outline:none;">
          <button id="browserGoBtn" style="background:#E63946; border:none; border-radius:50%; width:32px; height:32px; color:white; font-weight:bold; cursor:pointer; font-size:0.9rem;">→</button>
          <button id="closeBrowserBtn" style="background:none; border:none; color:#E63946; font-size:1.2rem; cursor:pointer; padding:4px 8px;">✖</button>
        </div>
        <div id="browserLoading" style="height:2px; background:#1A1A23; display:none;">
          <div id="browserLoadingBar" style="height:100%; width:0%; background:#E63946; transition:width 0.3s;"></div>
        </div>
        <iframe id="browserFrame" style="flex:1; width:100%; border:none; background:#FFFFFF;"></iframe>
        <div style="display:flex; justify-content:space-around; align-items:center; padding:8px 0; background:#0A0A0E; border-top:1px solid #1E1E24;">
          <button onclick="window.REVERSApp._navigateTo('https://www.startpage.com')" style="background:none; border:none; color:#8E8E9A; font-size:0.7rem; cursor:pointer;">🔍 Поиск</button>
          <button onclick="window.REVERSApp._navigateTo('https://github.com')" style="background:none; border:none; color:#8E8E9A; font-size:0.7rem; cursor:pointer;">💻 GitHub</button>
          <button onclick="window.REVERSApp._navigateTo('https://www.torproject.org')" style="background:none; border:none; color:#8E8E9A; font-size:0.7rem; cursor:pointer;">🧅 Tor</button>
          <button onclick="window.REVERSApp._openBrowser()" style="background:none; border:none; color:#8E8E9A; font-size:0.7rem; cursor:pointer;">🏠 Домой</button>
        </div>
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
      
      <div class="modal" id="aboutModal">
        <h3>ℹ️ О REVERS Messenger</h3>
        <div style="color:#EFEFEF; font-size:0.85rem; line-height:1.6;">
          <p><strong>REVERS v1.2</strong></p>
          <p>P2P мессенджер с полной анонимностью.</p>
          <p>• Никаких серверов • Сквозное шифрование</p>
          <p>• Не собираем данные • Открытый код</p>
          <br>
          <p><strong>📜 Политика конфиденциальности:</strong></p>
          <p style="font-size:0.75rem; color:#8E8E9A;">
            REVERS не собирает, не хранит и не передаёт третьим лицам никакие персональные данные. 
            Все сообщения передаются напрямую между устройствами (P2P) и не проходят через серверы.
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
    // Навигация
    document.getElementById('menuBtn').addEventListener('click', () => this._toggleSidebar(true));
    document.getElementById('overlay').addEventListener('click', () => this._toggleSidebar(false));
    document.getElementById('backBtn').addEventListener('click', () => this._goToChats());
    
    // Поиск чатов
    document.getElementById('searchChatsBtn').addEventListener('click', () => this._toggleChatSearch());
    document.getElementById('searchChatsCloseBtn').addEventListener('click', () => this._toggleChatSearch(false));
    document.getElementById('searchChatsInput').addEventListener('input', (e) => this._filterChats(e.target.value));
    
    // Добавление контакта
    document.getElementById('addContactBtn').addEventListener('click', () => this._openModal('addContactModal'));
    document.getElementById('addContactConfirmBtn').addEventListener('click', () => this._addContact());
    document.getElementById('addContactCloseBtn').addEventListener('click', () => this._closeAllModals());
    
    // Отправка сообщений
    document.getElementById('sendBtn').addEventListener('click', () => this._sendMessage());
    document.getElementById('messageInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._sendMessage(); });
    document.getElementById('fileInput').addEventListener('change', (e) => { if (e.target.files[0]) this._sendFile(e.target.files[0]); e.target.value = ''; });
    
    // Ответ
    document.getElementById('replyBarClose').addEventListener('click', () => { this.replyTo = null; document.getElementById('replyBar').classList.add('hidden'); });
    
    // Меню чата
    document.getElementById('chatMenuBtn').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('chatDropdown').classList.toggle('hidden'); });
    document.addEventListener('click', () => { 
      document.getElementById('chatDropdown').classList.add('hidden'); 
      document.getElementById('reactionPanel').classList.add('hidden');
      document.getElementById('contextMenu').classList.add('hidden');
    });
    
    // Действия чата
    document.getElementById('inviteToChatBtn').addEventListener('click', () => { if (this.currentChat) this._shareInviteLink(this.currentChat); });
    document.getElementById('searchInChatBtn').addEventListener('click', () => this._toggleChatSearch());
    document.getElementById('searchInChatCloseBtn').addEventListener('click', () => this._toggleChatSearch(false));
    document.getElementById('searchInChatInput').addEventListener('input', () => this._searchInChat());
    document.getElementById('searchPrevBtn').addEventListener('click', () => this._navigateSearch(-1));
    document.getElementById('searchNextBtn').addEventListener('click', () => this._navigateSearch(1));
    document.getElementById('pinnedMsgBtn').addEventListener('click', () => this._togglePinnedMessage());
    document.getElementById('unpinBtn').addEventListener('click', () => this._unpinMessage());
    document.getElementById('callBtn').addEventListener('click', () => { if (this.currentChat) REVERS.startCall(this.currentChat.id, true); });
    document.getElementById('audioCallBtn').addEventListener('click', () => { if (this.currentChat) REVERS.startCall(this.currentChat.id, false); });
    document.getElementById('connectPeerBtn').addEventListener('click', () => this._openConnectModal());
    document.getElementById('voiceRecordBtn').addEventListener('click', () => this._toggleVoiceRecord());
    document.getElementById('deleteChatBtn').addEventListener('click', () => this._deleteCurrentChat());
    document.getElementById('clearHistoryBtn').addEventListener('click', () => this._clearHistory());
    
    // Стикеры
    document.getElementById('stickerToggleBtn').addEventListener('click', () => this._toggleStickerPanel());
    document.getElementById('confirmStickerPackBtn').addEventListener('click', () => this._createStickerPack());
    document.getElementById('cancelStickerPackBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('addStickerToPackBtn').addEventListener('click', () => this._openModal('addStickerModal'));
    document.getElementById('confirmStickerBtn').addEventListener('click', () => this._addStickerToPack());
    document.getElementById('cancelStickerBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('stickerFileInput').addEventListener('change', (e) => { if (e.target.files[0]) this._previewSticker(e.target.files[0]); });
    document.getElementById('deleteStickerPackBtn').addEventListener('click', () => this._deleteStickerPack());
    
    // Реакции
    document.querySelectorAll('.reaction-emoji').forEach(el => {
      el.addEventListener('click', (e) => { e.stopPropagation(); this._addReaction(el.dataset.emoji); });
    });
    
    // Контекстное меню
    document.getElementById('ctxEdit').addEventListener('click', () => this._editSelectedMessage());
    document.getElementById('ctxReply').addEventListener('click', () => this._replyToSelectedMessage());
    document.getElementById('ctxPin').addEventListener('click', () => this._pinSelectedMessage());
    document.getElementById('ctxCopy').addEventListener('click', () => this._copySelectedMessage());
    document.getElementById('ctxDelete').addEventListener('click', () => this._deleteSelectedMessage());
    
    // Connect modal
    document.getElementById('connectSendBtn').addEventListener('click', () => this._handleConnect());
    document.getElementById('copySignalBtn').addEventListener('click', () => { const v = document.getElementById('mySignalOutput').value; if (v && v !== 'Генерация...') { navigator.clipboard.writeText(v); alert('Скопировано!'); } });
    document.getElementById('closeConnectBtn').addEventListener('click', () => this._closeAllModals());
    
    // QR modal
    document.getElementById('qrMenuBtn').addEventListener('click', () => this._showQR());
    document.getElementById('closeQrBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('copyInviteLinkBtn').addEventListener('click', () => { const link = document.getElementById('inviteLink').textContent; if (link) { navigator.clipboard.writeText(link); alert('Ссылка скопирована!'); } });
    document.getElementById('shareInviteBtn').addEventListener('click', () => { const link = document.getElementById('inviteLink').textContent; if (link && navigator.share) { navigator.share({ title: 'REVERS', text: 'Присоединяйся!', url: link }).catch(() => {}); } });
    
    // Scanner
    document.getElementById('scanMenuBtn').addEventListener('click', () => this._startScanner());
    document.getElementById('stopScannerBtn').addEventListener('click', () => this._stopScanner());
    
    // Browser
    document.getElementById('browserMenuBtn').addEventListener('click', () => this._openBrowser());
    document.getElementById('closeBrowserBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('browserGoBtn').addEventListener('click', () => this._navigateBrowser());
    document.getElementById('browserBackBtn').addEventListener('click', () => { try { document.getElementById('browserFrame').contentWindow.history.back(); } catch(e) {} });
    document.getElementById('browserForwardBtn').addEventListener('click', () => { try { document.getElementById('browserFrame').contentWindow.history.forward(); } catch(e) {} });
    document.getElementById('browserReloadBtn').addEventListener('click', () => { this._navigateTo(document.getElementById('browserFrame').src); });
    document.getElementById('browserUrlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._navigateBrowser(); });
    
    // Меню
    document.getElementById('savedMenuBtn').addEventListener('click', () => { this._toggleSidebar(false); this._openChat({ id: 'me', type: 'saved', name: '📔 Сохранённые' }); });
    document.getElementById('accountMenuBtn').addEventListener('click', () => this._openModal('accountModal'));
    document.getElementById('groupsMenuBtn').addEventListener('click', () => { this._renderGroupsList(); this._openModal('groupsModal'); });
    document.getElementById('channelsMenuBtn').addEventListener('click', () => { this._renderChannelsList(); this._openModal('channelsModal'); });
    document.getElementById('settingsMenuBtn').addEventListener('click', () => this._openModal('settingsModal'));
    document.getElementById('aboutMenuBtn').addEventListener('click', () => this._openModal('aboutModal'));
    
    // Закрытие модалок
    document.querySelectorAll('[id$="Btn"]').forEach(btn => { if (btn.id.startsWith('close') || btn.id.startsWith('cancel')) btn.addEventListener('click', () => this._closeAllModals()); });
    
    // Аккаунт
    document.getElementById('saveAccountBtn').addEventListener('click', () => { const n = document.getElementById('nicknameInput').value.trim(); if (n) REVERS.setName(n); this._closeAllModals(); });
    document.getElementById('changeAvatarBtn').addEventListener('click', () => document.getElementById('modalAvatarInput').click());
    document.getElementById('modalAvatarInput').addEventListener('change', (e) => { if (e.target.files[0]) { const r = new FileReader(); r.onload = (ev) => { REVERS.setAvatar(ev.target.result); document.getElementById('modalAvatar').src = ev.target.result; }; r.readAsDataURL(e.target.files[0]); } });
    document.getElementById('copyIdBtn').addEventListener('click', () => { navigator.clipboard.writeText(REVERS.getMyId()); alert('ID скопирован!'); });
    
    // Группы/каналы
    document.getElementById('createGroupBtn').addEventListener('click', () => this._openModal('createGroupModal'));
    document.getElementById('confirmGroupBtn').addEventListener('click', () => this._createGroup());
    document.getElementById('createChannelBtn').addEventListener('click', () => this._openModal('createChannelModal'));
    document.getElementById('confirmChannelBtn').addEventListener('click', () => this._createChannel());
    
    // Настройки
    document.getElementById('themeToggle').addEventListener('click', () => this._toggleTheme());
    document.getElementById('soundToggle').addEventListener('click', () => this._toggleSound());
    
    // Просмотр изображений
    document.getElementById('imageViewer').addEventListener('click', () => { document.getElementById('imageViewer').classList.remove('active'); });
  }

  // ==================== ИНИЦИАЛИЗАЦИЯ ====================
  
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
    REVERS.onRemoteStream(({ peerId }) => { console.log('📹 Поток от', peerId); });
    this._loadSettings();
    this._renderChatsList();
    this._toggleSidebar(false);
  }

  _initWelcomeGroup() {
    const key = localStorage.getItem('revers_welcome');
    if (key && REVERS.getAllChats().filter(c => c.id === key).length > 0) return;
    const gk = REVERS.createGroup('🖐 REVERS Welcome');
    ['╔══════════════════════╗', '║  ДОБРО ПОЖАЛОВАТЬ!  ║', '╚══════════════════════╝', '', '🎉 Добро пожаловать в REVERS!', '', '📋 Твой ID: ' + REVERS.getMyId(), '', '🔗 Как добавить друга:', '1. Нажми ☰ → 🔳 Мой QR', '2. Покажи код другу', '3. Или отправь ссылку', '', '❓ Вопросы? Спроси здесь!']
      .forEach(msg => REVERS.sendGroupMessage(gk, msg));
    localStorage.setItem('revers_welcome', gk);
  }

  // ==================== ПОИСК И ДОБАВЛЕНИЕ ====================
  
  _toggleChatSearch(show = true) {
    const bar = document.getElementById('searchChatsBar');
    bar.classList.toggle('hidden', !show);
    if (show) document.getElementById('searchChatsInput').focus();
    else { document.getElementById('searchChatsInput').value = ''; this._renderChatsList(); }
  }

  _filterChats(query) {
    const all = REVERS.getAllChats();
    this._renderChatsList(query ? all.filter(c => c.name.toLowerCase().includes(query.toLowerCase())) : all);
  }

  _addContact() {
    const id = document.getElementById('addContactIdInput').value.trim();
    if (!id) return;
    this._closeAllModals();
    this._openChat({ id, type: 'contact', name: id });
    REVERS.connectToPeer(id);
    document.getElementById('addContactIdInput').value = '';
  }

  // ==================== ПОИСК В ЧАТЕ ====================
  
  _searchInChat() {
    const query = document.getElementById('searchInChatInput').value.toLowerCase();
    const messages = document.querySelectorAll('.message-text');
    messages.forEach(m => m.innerHTML = m.textContent);
    if (!query) return;
    let count = 0;
    messages.forEach(m => {
      const text = m.textContent;
      if (text.toLowerCase().includes(query)) {
        m.innerHTML = text.replace(new RegExp(query, 'gi'), '<span class="highlight">$&</span>');
        count++;
      }
    });
    document.getElementById('searchCounter').textContent = count > 0 ? '1/' + count : '0/0';
  }

  _navigateSearch(dir) { /* TODO: навигация по результатам */ }

  // ==================== ЗАКРЕПЛЁННЫЕ ====================
  
  _togglePinnedMessage() {
    const pinned = localStorage.getItem('revers_pinned_' + this.currentChat?.id);
    if (pinned) {
      document.getElementById('pinnedMessage').classList.remove('hidden');
      document.getElementById('pinnedText').textContent = pinned;
    }
  }

  _pinMessage(msg) {
    localStorage.setItem('revers_pinned_' + this.currentChat.id, msg.text);
    document.getElementById('pinnedMessage').classList.remove('hidden');
    document.getElementById('pinnedText').textContent = msg.text;
  }

  _unpinMessage() {
    localStorage.removeItem('revers_pinned_' + this.currentChat?.id);
    document.getElementById('pinnedMessage').classList.add('hidden');
  }

  // ==================== РЕДАКТИРОВАНИЕ И УДАЛЕНИЕ ====================
  
  _showContextMenu(e, msg, idx) {
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById('contextMenu');
    menu.style.top = e.touches ? e.touches[0].clientY + 'px' : e.clientY + 'px';
    menu.style.left = e.touches ? e.touches[0].clientX + 'px' : e.clientX + 'px';
    menu.classList.remove('hidden');
    menu._target = { msg, idx };
  }

  _editSelectedMessage() {
    const menu = document.getElementById('contextMenu');
    const { msg } = menu._target;
    this._editingMessage = msg;
    document.getElementById('messageInput').value = msg.text;
    document.getElementById('messageInput').focus();
    menu.classList.add('hidden');
  }

  _replyToSelectedMessage() {
    const menu = document.getElementById('contextMenu');
    const { msg, idx } = menu._target;
    this.replyTo = { text: msg.text, from: msg.from, idx };
    document.getElementById('replyBarText').textContent = '↩️ ' + (msg.text || '').substring(0, 50);
    document.getElementById('replyBar').classList.remove('hidden');
    document.getElementById('messageInput').focus();
    menu.classList.add('hidden');
  }

  _pinSelectedMessage() {
    const menu = document.getElementById('contextMenu');
    this._pinMessage(menu._target.msg);
    menu.classList.add('hidden');
  }

  _copySelectedMessage() {
    const menu = document.getElementById('contextMenu');
    navigator.clipboard.writeText(menu._target.msg.text);
    menu.classList.add('hidden');
  }

  _deleteSelectedMessage() {
    const menu = document.getElementById('contextMenu');
    const { msg, idx } = menu._target;
    this._deleteMessage(msg, idx);
    menu.classList.add('hidden');
  }

  _deleteMessage(msg, idx) {
    if (!this.currentChat) return;
    let history = [];
    if (this.currentChat.type === 'saved') history = REVERS.getChatHistory('me');
    else if (this.currentChat.type === 'group') history = REVERS.getGroupHistory(this.currentChat.id);
    else if (this.currentChat.type === 'channel') history = REVERS.getChannelHistory(this.currentChat.id);
    else history = REVERS.getChatHistory(this.currentChat.id);
    
    history.splice(idx, 1);
    REVERS._save?.();
    this._renderMessages(this.currentChat);
  }

  _clearHistory() {
    if (!this.currentChat || !confirm('Очистить всю историю?')) return;
    localStorage.removeItem('revers_chats');
    localStorage.removeItem('revers_groups');
    localStorage.removeItem('revers_channels');
    this._renderMessages(this.currentChat);
    this._renderChatsList();
  }

  // ==================== СТИКЕРЫ ====================

  _toggleStickerPanel() {
    const panel = document.getElementById('stickerPanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      this._renderStickerTabs();
      this._renderStickerGrid('recent');
    }
  }

  _renderStickerTabs() {
    const tabs = document.getElementById('stickerTabs');
    const packs = stickerManager.getPacks();
    tabs.innerHTML = '';
    Object.entries(packs).forEach(([id, pack]) => {
      const tab = document.createElement('div');
      tab.className = `sticker-tab ${this._activeStickerPack === id ? 'active' : ''}`;
      tab.textContent = pack.name;
      tab.addEventListener('click', () => { this._activeStickerPack = id; this._renderStickerTabs(); this._renderStickerGrid(id); });
      tabs.appendChild(tab);
    });
    const addTab = document.createElement('div');
    addTab.className = 'sticker-tab'; addTab.textContent = '➕';
    addTab.addEventListener('click', () => this._openModal('createStickerPackModal'));
    tabs.appendChild(addTab);
  }

  _renderStickerGrid(packId) {
    const grid = document.getElementById('stickerGrid');
    const stickers = stickerManager.getStickers(packId);
    grid.innerHTML = '';
    stickers.forEach(sticker => {
      const div = document.createElement('div'); div.className = 'sticker-item';
      if (typeof sticker === 'object' && sticker.data) {
        div.innerHTML = `<img src="${sticker.data}" style="width:64px; height:64px; object-fit:contain;">`;
      } else {
        div.textContent = typeof sticker === 'string' ? sticker : sticker.emoji || '🖼️';
        div.style.fontSize = '2rem';
      }
      div.addEventListener('click', () => {
        const stickerData = typeof sticker === 'string' ? sticker : sticker.data || sticker.emoji;
        stickerManager.addToRecent(stickerData);
        this._sendSticker(stickerData, packId !== 'recent');
      });
      grid.appendChild(div);
    });
    const actions = document.getElementById('stickerPackActions');
    actions.classList.toggle('hidden', packId === 'recent' || packId === 'default');
    if (!actions.classList.contains('hidden')) document.getElementById('addStickerToPackBtn').dataset.packId = packId;
  }

  _sendSticker(sticker, closePanel = true) {
    if (!this.currentChat) return;
    const msg = typeof sticker === 'string' && sticker.length <= 4 ? sticker : '🖼️';
    if (this.currentChat.type === 'saved') REVERS.sendMessage('me', msg);
    else if (this.currentChat.type === 'group') REVERS.sendGroupMessage(this.currentChat.id, msg);
    else if (this.currentChat.type === 'channel') REVERS.sendChannelMessage(this.currentChat.id, msg);
    else REVERS.sendMessage(this.currentChat.id, msg);
    this._renderMessages(this.currentChat);
    if (closePanel) document.getElementById('stickerPanel').classList.add('hidden');
  }

  _createStickerPack() {
    const name = document.getElementById('stickerPackNameInput').value.trim();
    if (!name) return;
    const id = stickerManager.createPack(name);
    this._closeAllModals();
    this._activeStickerPack = id;
    this._toggleStickerPanel();
    document.getElementById('stickerPackNameInput').value = '';
  }

  async _addStickerToPack() {
    const packId = document.getElementById('addStickerToPackBtn').dataset.packId;
    const file = document.getElementById('stickerFileInput').files[0];
    if (!file || !packId) return;
    const reader = new FileReader();
    reader.onload = () => {
      stickerManager.addSticker(packId, reader.result, document.getElementById('stickerEmojiInput').value.trim());
      this._closeAllModals();
      this._renderStickerGrid(packId);
      document.getElementById('stickerFileInput').value = '';
      document.getElementById('stickerEmojiInput').value = '';
      document.getElementById('stickerPreview').style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  _previewSticker(file) {
    const reader = new FileReader();
    reader.onload = (e) => { const p = document.getElementById('stickerPreview'); p.src = e.target.result; p.style.display = 'block'; };
    reader.readAsDataURL(file);
  }

  _deleteStickerPack() {
    if (this._activeStickerPack && confirm('Удалить этот стикерпак?')) {
      stickerManager.deletePack(this._activeStickerPack);
      this._activeStickerPack = 'recent';
      this._renderStickerTabs();
      this._renderStickerGrid('recent');
    }
  }

  // ==================== РЕАКЦИИ ====================
  
  _showReactions(targetMsg) {
    const panel = document.getElementById('reactionPanel');
    const rect = targetMsg.getBoundingClientRect();
    panel.style.top = (rect.top - 50) + 'px';
    panel.style.left = (rect.left + rect.width/2 - 90) + 'px';
    panel.classList.remove('hidden');
    panel._targetMsg = targetMsg;
  }

  _addReaction(emoji) {
    const panel = document.getElementById('reactionPanel');
    const target = panel._targetMsg;
    if (!target) return;
    const existing = target.querySelector('.reactions');
    if (existing) { if (!existing.textContent.includes(emoji)) existing.textContent += emoji; }
    else { const r = document.createElement('div'); r.className = 'reactions'; r.textContent = emoji; target.querySelector('.bubble').appendChild(r); }
    panel.classList.add('hidden');
  }

  // ==================== БРАУЗЕР ====================
  
  _openBrowser(url = 'https://www.startpage.com') {
    this._closeAllModals();
    document.getElementById('browserModal').classList.add('active');
    document.getElementById('browserUrlInput').value = url;
    this._navigateTo(url);
  }

  _navigateTo(url) {
    let u = url;
    if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u;
    document.getElementById('browserUrlInput').value = u;
    const bar = document.getElementById('browserLoading');
    const fill = document.getElementById('browserLoadingBar');
    bar.style.display = 'block'; fill.style.width = '0%';
    let p = 0;
    const iv = setInterval(() => { p += Math.random() * 15; if (p > 90) p = 90; fill.style.width = p + '%'; }, 200);
    const frame = document.getElementById('browserFrame');
    frame.src = u;
    frame.onload = () => { clearInterval(iv); fill.style.width = '100%'; setTimeout(() => bar.style.display = 'none', 300); };
    frame.onerror = () => { clearInterval(iv); bar.style.display = 'none'; };
  }

  _navigateBrowser() { const url = document.getElementById('browserUrlInput').value.trim(); if (url) this._navigateTo(url); }
  _openLink(url) { this._openBrowser(url); }

  // ==================== QR И СКАНЕР ====================
  
  async _showQR() {
    this._closeAllModals();
    const qrData = JSON.stringify({ id: REVERS.getMyId(), name: REVERS.getMyProfile().name, type: 'revers-connect', version: 1 });
    const canvas = document.getElementById('qrCanvas');
    try { await QRCode.toCanvas(canvas, qrData, { width: 200, margin: 2, color: { dark: '#0F0F12', light: '#FFFFFF' } }); }
    catch(e) { const ctx = canvas.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 200, 200); ctx.fillStyle = '#E63946'; ctx.font = '14px monospace'; ctx.textAlign = 'center'; ctx.fillText('REVERS', 100, 90); }
    document.getElementById('inviteLink').textContent = `revers://chat?id=${REVERS.getMyId()}&name=${encodeURIComponent(REVERS.getMyProfile().name)}`;
    document.getElementById('qrModal').classList.add('active');
  }

  async _startScanner() {
    this._closeAllModals();
    const c = document.getElementById('scannerContainer'); c.innerHTML = '';
    document.getElementById('scannerModal').classList.add('active');
    try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); s.getTracks().forEach(t => t.stop()); }
    catch(err) { c.innerHTML = '<div style="text-align:center; padding:40px; color:#E63946;"><p>❌ Нет доступа к камере</p></div>'; return; }
    try { this.html5QrCode = new Html5Qrcode('scannerContainer'); await this.html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, (t) => this._handleScannedQR(t), () => {}); }
    catch(err) { c.innerHTML = '<div style="text-align:center; padding:40px; color:#E63946;"><p>❌ Ошибка сканера</p></div>'; }
  }

  _stopScanner() { if (this.html5QrCode) { this.html5QrCode.stop().then(() => { this.html5QrCode = null; this._closeAllModals(); }).catch(() => this._closeAllModals()); } else this._closeAllModals(); }

  _handleScannedQR(text) {
    try { const d = JSON.parse(text); if (d.type === 'revers-connect' && d.id) { this._stopScanner(); REVERS.connectToPeer(d.id); this._openChat({ id: d.id, type: 'contact', name: d.name || d.id }); return; } } catch(e) {}
    if (text.length > 5) { this._stopScanner(); this._openChat({ id: text, type: 'contact', name: text }); }
  }

  // ==================== P2P ====================
  
  _handleIncomingSignal(msg) { if (msg.initiator) { document.getElementById('signalInput').value = JSON.stringify(msg.signal); this._openModal('connectModal'); } else REVERS.applySignal(msg.from, msg.signal); }

  _openConnectModal() {
    this._closeAllModals();
    document.getElementById('connectModal').classList.add('active');
    document.getElementById('mySignalOutput').value = 'Генерация...';
    const peerId = this.currentChat?.id || 'peer_' + Date.now();
    const orig = REVERS.p2pNetwork.onMessageCallback;
    REVERS.p2pNetwork.onMessageCallback = (m) => { if (m.type === 'p2p-signal' && m.initiator && m.to === peerId) document.getElementById('mySignalOutput').value = JSON.stringify(m.signal); if (orig) orig(m); };
    REVERS.connectToPeer(peerId);
    setTimeout(() => { const o = document.getElementById('mySignalOutput'); if (!o.value || o.value === 'Генерация...') o.value = 'Не получен.'; }, 5000);
  }

  _handleConnect() {
    const pid = document.getElementById('peerIdInput').value.trim();
    const sig = document.getElementById('signalInput').value.trim();
    if (sig) { try { const s = JSON.parse(sig); if (s.sdp || s.candidate) { REVERS.acceptPeer(pid || 'remote', s); this._closeAllModals(); this._updateConnectionStatus(true); return; } } catch(e) { alert('Неверный сигнал'); } }
    if (pid) { REVERS.connectToPeer(pid); document.getElementById('mySignalOutput').value = 'Генерация...'; }
  }

  // ==================== СООБЩЕНИЯ ====================
  
  async _toggleVoiceRecord() { /* без изменений */ }

  _sendMessage() {
    const input = document.getElementById('messageInput'); const text = input.value.trim();
    if (!text || !this.currentChat) return;
    
    if (this._editingMessage) {
      this._editingMessage.text = text;
      this._editingMessage.edited = true;
      this._editingMessage = null;
    } else {
      let ok = false;
      if (this.currentChat.type === 'saved') ok = REVERS.sendMessage('me', text);
      else if (this.currentChat.type === 'group') ok = REVERS.sendGroupMessage(this.currentChat.id, text);
      else if (this.currentChat.type === 'channel') ok = REVERS.sendChannelMessage(this.currentChat.id, text);
      else ok = REVERS.sendMessage(this.currentChat.id, text);
    }
    this._renderMessages(this.currentChat); input.value = ''; this.replyTo = null;
    document.getElementById('replyBar').classList.add('hidden'); this._renderChatsList();
  }

  _sendFile(file) { if (!this.currentChat) return; const tid = this.currentChat.type === 'saved' ? 'me' : this.currentChat.id; REVERS.sendFile(tid, file).then(() => { this._renderMessages(this.currentChat); }); }

  _createGroup() { const n = document.getElementById('groupNameInput').value.trim(); if (!n) return; const k = REVERS.createGroup(n); this._closeAllModals(); this._openChat({ id: k, name: '👥 ' + n, type: 'group' }); document.getElementById('groupNameInput').value = ''; }
  _createChannel() { const n = document.getElementById('channelNameInput').value.trim(); if (!n) return; const k = REVERS.createChannel(n); this._closeAllModals(); this._openChat({ id: k, name: '📢 ' + n, type: 'channel' }); document.getElementById('channelNameInput').value = ''; }

  // ==================== ССЫЛКИ ====================
  
  _generateInviteLink(chat) { if (!chat) return ''; const type = chat.type === 'group' ? 'group' : chat.type === 'channel' ? 'channel' : 'chat'; return `revers://${type}?id=${chat.id}&name=${encodeURIComponent(chat.name)}`; }
  _shareInviteLink(chat) { const link = this._generateInviteLink(chat); if (navigator.share) { navigator.share({ title: 'REVERS', text: 'Присоединяйся!', url: link }).catch(() => {}); } else { navigator.clipboard.writeText(link); alert('Ссылка скопирована!'); } }

  // ==================== UI ====================
  
  _openChat(chat) {
    this.currentChat = chat;
    document.getElementById('chatsScreen').classList.add('hidden'); document.getElementById('chatScreen').classList.remove('hidden');
    document.getElementById('chatName').textContent = chat.name;
    this._updateConnectionStatus(REVERS.isConnected(chat.id));
    this._renderMessages(chat); this._toggleSidebar(false);
    document.getElementById('stickerPanel').classList.add('hidden');
    document.getElementById('chatDropdown').classList.add('hidden');
    document.getElementById('reactionPanel').classList.add('hidden');
    document.getElementById('contextMenu').classList.add('hidden');
    this._togglePinnedMessage();
    this.replyTo = null; this._editingMessage = null;
    document.getElementById('replyBar').classList.add('hidden');
  }

  _goToChats() { document.getElementById('chatScreen').classList.add('hidden'); document.getElementById('chatsScreen').classList.remove('hidden'); this.currentChat = null; this.replyTo = null; document.getElementById('replyBar').classList.add('hidden'); this._renderChatsList(); }

  _renderChatsList(list = null) {
    const c = document.getElementById('chatsList'); c.innerHTML = '';
    const chats = list || REVERS.getAllChats();
    if (!chats.length) { c.innerHTML = '<p style="color:#8E8E9A; text-align:center; padding:20px;">Нет чатов</p>'; return; }
    chats.forEach(chat => { const d = document.createElement('div'); d.className = 'chat-item'; const emoji = chat.type === 'saved' ? '📔' : chat.type === 'group' ? '👥' : chat.type === 'channel' ? '📢' : '💬'; d.innerHTML = `<div class="chat-avatar">${emoji}</div><div class="chat-info"><div class="chat-name">${this._esc(chat.name)}</div><div class="chat-preview">${this._esc(chat.lastMsg || '')}</div></div><div class="chat-time">${chat.lastTime ? new Date(chat.lastTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</div>`; d.addEventListener('click', () => this._openChat(chat)); c.appendChild(d); });
  }

  _renderMessages(chat) {
    const area = document.getElementById('messagesArea'); area.innerHTML = '';
    let history = [];
    if (chat.type === 'saved') history = REVERS.getChatHistory('me');
    else if (chat.type === 'group') history = REVERS.getGroupHistory(chat.id);
    else if (chat.type === 'channel') history = REVERS.getChannelHistory(chat.id);
    else history = REVERS.getChatHistory(chat.id);
    history.forEach((msg, idx) => {
      const isOutgoing = msg.from === REVERS.getMyId();
      const div = document.createElement('div'); div.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`; div.dataset.msgIdx = idx;
      let html = '<div class="bubble">';
      const linkedText = this._esc(msg.text || '').replace(/(https?:\/\/[^\s]+)/g, '<a onclick="window.REVERSApp._openLink(\'$1\')" style="color:#2A9D8F; text-decoration:underline; cursor:pointer;">$1</a>');
      html += `<div class="message-text">${linkedText}</div>`;
      if (msg.edited) html += '<span style="font-size:0.6rem; color:#8E8E9A;"> (изм.)</span>';
      if (msg.type === 'voice' && msg.fileData) html += `<audio controls src="${msg.fileData}" style="max-width:200px; height:30px; margin-top:4px;"></audio>`;
      if (msg.type === 'file' && msg.fileName) { html += `<div class="file-attachment">📄 ${this._esc(msg.fileName)}</div>`; if (msg.fileData && msg.fileType?.startsWith('image/')) html += `<img src="${msg.fileData}" class="file-preview-img" onclick="event.stopPropagation(); document.getElementById('fullscreenImage').src='${msg.fileData}'; document.getElementById('imageViewer').classList.add('active')">`; }
      if (msg.reactions) html += `<div class="reactions">${msg.reactions}</div>`;
      html += `<div class="message-time">${new Date(msg.time).toLocaleTimeString()}</div></div>`;
      div.innerHTML = html;
      div.addEventListener('contextmenu', (e) => this._showContextMenu(e, msg, idx));
      let pressTimer; div.addEventListener('touchstart', () => { pressTimer = setTimeout(() => this._showReactions(div), 500); }); div.addEventListener('touchend', () => clearTimeout(pressTimer)); div.addEventListener('touchmove', () => clearTimeout(pressTimer));
      area.appendChild(div);
    });
    area.scrollTop = area.scrollHeight;
  }

  _renderGroupsList() { const c = document.getElementById('groupsList'); c.innerHTML = ''; const groups = REVERS.getAllChats().filter(ch => ch.type === 'group'); if (!groups.length) { c.innerHTML = '<p style="color:#8E8E9A; text-align:center;">Нет групп</p>'; return; } groups.forEach(g => { const d = document.createElement('div'); d.style.cssText = 'background:#2A2A3A; border-radius:16px; padding:12px; margin:8px 0; display:flex; justify-content:space-between; align-items:center;'; d.innerHTML = `<strong style="color:white">${g.name}</strong>`; const btn = document.createElement('button'); btn.textContent = 'Открыть'; btn.style.cssText = 'background:#E63946; border:none; padding:6px 12px; border-radius:20px; color:white; cursor:pointer;'; btn.addEventListener('click', () => { this._closeAllModals(); this._openChat(g); }); d.appendChild(btn); c.appendChild(d); }); }
  _renderChannelsList() { const c = document.getElementById('channelsList'); c.innerHTML = ''; const channels = REVERS.getAllChats().filter(ch => ch.type === 'channel'); if (!channels.length) { c.innerHTML = '<p style="color:#8E8E9A; text-align:center;">Нет каналов</p>'; return; } channels.forEach(ch => { const d = document.createElement('div'); d.style.cssText = 'background:#2A2A3A; border-radius:16px; padding:12px; margin:8px 0; display:flex; justify-content:space-between; align-items:center;'; d.innerHTML = `<strong style="color:white">${ch.name}</strong>`; const btn = document.createElement('button'); btn.textContent = 'Открыть'; btn.style.cssText = 'background:#E63946; border:none; padding:6px 12px; border-radius:20px; color:white; cursor:pointer;'; btn.addEventListener('click', () => { this._closeAllModals(); this._openChat(ch); }); d.appendChild(btn); c.appendChild(d); }); }

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