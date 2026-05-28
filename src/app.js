import REVERS from './core/p2p-engine.js';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';

class REVERSApp {
  constructor() {
    this.currentChat = null;
    this.replyTo = null;
    this.html5QrCode = null;
    this.isRecording = false;
    this.voiceRecorder = null;
    this.voiceStartTime = null;
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
            <button class="action-icon" id="voiceRecordBtn" title="Голосовое">🎤</button>
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
          <button class="menu-item" id="qrMenuBtn">🔳 Мой QR</button>
          <button class="menu-item" id="scanMenuBtn">📷 Сканировать QR</button>
          <button class="menu-item" id="savedMenuBtn">📔 Сохранённые</button>
          <button class="menu-item" id="browserMenuBtn">🌐 Браузер</button>
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
      
      <div class="modal" id="qrModal">
        <h3>🔳 Мой QR-код</h3>
        <div style="text-align:center; background:white; padding:20px; border-radius:20px;">
          <canvas id="qrCanvas" style="width:200px; height:200px;"></canvas>
        </div>
        <p style="color:#8E8E9A; font-size:0.8rem; text-align:center;">Покажите этот код собеседнику</p>
        <p style="color:#6C6C7A; font-size:0.65rem; text-align:center; word-break:break-all;">ID: ${REVERS.getMyId()}</p>
        <button id="copyIdFromQrBtn" class="secondary">📋 Копировать ID</button>
        <button id="closeQrBtn" class="secondary">Закрыть</button>
      </div>
      
      <div class="modal" id="scannerModal">
        <h3>📷 Сканировать QR</h3>
        <div id="scannerContainer" style="width:100%; border-radius:16px; overflow:hidden;"></div>
        <p style="color:#8E8E9A; font-size:0.7rem; text-align:center;">Наведите камеру на QR-код собеседника</p>
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
          <button onclick="window.REVERSApp._navigateTo('https://duckduckgo.com')" style="background:none; border:none; color:#8E8E9A; font-size:0.7rem; cursor:pointer;">🔍 Поиск</button>
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
    document.getElementById('stickerToggleBtn').addEventListener('click', () => { document.getElementById('stickerPanel').classList.toggle('active'); });
    document.querySelectorAll('.sticker').forEach(el => { el.addEventListener('click', () => this._sendSticker(el.textContent)); });
    document.getElementById('connectPeerBtn').addEventListener('click', () => this._openConnectModal());
    document.getElementById('connectSendBtn').addEventListener('click', () => this._handleConnect());
    document.getElementById('copySignalBtn').addEventListener('click', () => { const v = document.getElementById('mySignalOutput').value; if (v && v !== 'Генерация сигнала...') { navigator.clipboard.writeText(v); alert('Сигнал скопирован!'); } });
    document.getElementById('closeConnectBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('voiceRecordBtn').addEventListener('click', () => this._toggleVoiceRecord());
    document.getElementById('callBtn').addEventListener('click', () => { if (this.currentChat) REVERS.startCall(this.currentChat.id, true); });
    document.getElementById('audioCallBtn').addEventListener('click', () => { if (this.currentChat) REVERS.startCall(this.currentChat.id, false); });
    document.getElementById('deleteChatBtn').addEventListener('click', () => this._deleteCurrentChat());
    document.getElementById('qrMenuBtn').addEventListener('click', () => this._showQR());
    document.getElementById('closeQrBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('copyIdFromQrBtn').addEventListener('click', () => { navigator.clipboard.writeText(REVERS.getMyId()); alert('ID скопирован!'); });
    document.getElementById('scanMenuBtn').addEventListener('click', () => this._startScanner());
    document.getElementById('stopScannerBtn').addEventListener('click', () => this._stopScanner());
    document.getElementById('browserMenuBtn').addEventListener('click', () => this._openBrowser());
    document.getElementById('closeBrowserBtn').addEventListener('click', () => this._closeAllModals());
    document.getElementById('browserGoBtn').addEventListener('click', () => this._navigateBrowser());
    document.getElementById('browserBackBtn').addEventListener('click', () => { try { document.getElementById('browserFrame').contentWindow.history.back(); } catch(e) {} });
    document.getElementById('browserForwardBtn').addEventListener('click', () => { try { document.getElementById('browserFrame').contentWindow.history.forward(); } catch(e) {} });
    document.getElementById('browserReloadBtn').addEventListener('click', () => { const frame = document.getElementById('browserFrame'); this._navigateTo(frame.src); });
    document.getElementById('browserUrlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._navigateBrowser(); });
    document.getElementById('savedMenuBtn').addEventListener('click', () => { this._toggleSidebar(false); this._openChat({ id: 'me', type: 'saved', name: '📔 Сохранённые' }); });
    document.getElementById('accountMenuBtn').addEventListener('click', () => this._openModal('accountModal'));
    document.getElementById('groupsMenuBtn').addEventListener('click', () => { this._renderGroupsList(); this._openModal('groupsModal'); });
    document.getElementById('channelsMenuBtn').addEventListener('click', () => { this._renderChannelsList(); this._openModal('channelsModal'); });
    document.getElementById('settingsMenuBtn').addEventListener('click', () => this._openModal('settingsModal'));
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
      else if (this.currentChat && this.currentChat.id === msg.from) this._renderMessages(this.currentChat);
      this._renderChatsList();
    });
    REVERS.onChatUpdate(() => this._renderChatsList());
    REVERS.onIncomingCall((data) => {
      if (confirm(`📹 Входящий ${data.video ? 'видео' : 'аудио'} звонок от ${data.peerId}. Ответить?`)) {
        REVERS.acceptCall(data.peerId, data.video).then(pc => {
          if (pc) pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
            pc.createAnswer().then(answer => { pc.setLocalDescription(answer); REVERS.sendMessage(data.peerId, JSON.stringify({ type: 'call-signal', callType: 'answer', sdp: answer })); });
          });
        });
      }
    });
    REVERS.onRemoteStream(({ peerId, stream }) => { console.log('📹 Поток от', peerId); });
    this._loadSettings();
    this._renderChatsList();
    this._toggleSidebar(false);
  }

  _initWelcomeGroup() {
    const existingKey = localStorage.getItem('revers_welcome');
    if (existingKey && REVERS.getAllChats().filter(c => c.id === existingKey).length > 0) return;
    const groupKey = REVERS.createGroup('🖐 REVERS Welcome');
    const messages = [
      '╔══════════════════════╗', '║  ДОБРО ПОЖАЛОВАТЬ!  ║', '╚══════════════════════╝', '',
      '🎉 Добро пожаловать в REVERS!', '', '📋 Твой ID: ' + REVERS.getMyId(), '',
      '🔗 Как добавить друга:', '1. Нажми ☰ → 🔳 Мой QR', '2. Покажи код другу', '3. Или отправь свой ID', '',
      '📹 Видеозвонки работают!', '📎 Отправка файлов', '🎤 Голосовые сообщения', '😊 Стикеры — жми 😊', '',
      '❓ Вопросы? Спроси здесь!'
    ];
    messages.forEach(msg => REVERS.sendGroupMessage(groupKey, msg));
    localStorage.setItem('revers_welcome', groupKey);
  }

  async _showQR() {
    this._closeAllModals();
    const qrData = JSON.stringify({ id: REVERS.getMyId(), name: REVERS.getMyProfile().name, type: 'revers-connect', version: 1 });
    const canvas = document.getElementById('qrCanvas');
    try {
      await QRCode.toCanvas(canvas, qrData, { width: 200, margin: 2, color: { dark: '#0F0F12', light: '#FFFFFF' } });
    } catch(e) {
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 200, 200); ctx.fillStyle = '#E63946'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
      ctx.fillText('REVERS', 100, 90); ctx.fillText('ID: ' + REVERS.getMyId().substring(0, 12), 100, 115);
    }
    document.getElementById('qrModal').classList.add('active');
  }

  async _startScanner() {
    this._closeAllModals();
    const scannerContainer = document.getElementById('scannerContainer');
    scannerContainer.innerHTML = '';
    document.getElementById('scannerModal').classList.add('active');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(track => track.stop());
    } catch(err) {
      scannerContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#E63946;"><p>❌ Нет доступа к камере</p><p style="font-size:0.7rem; color:#8E8E9A;">Разрешите доступ в настройках телефона</p></div>';
      return;
    }
    try {
      this.html5QrCode = new Html5Qrcode('scannerContainer');
      await this.html5QrCode.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => this._handleScannedQR(decodedText),
        () => {}
      );
    } catch(err) {
      scannerContainer.innerHTML = '<div style="text-align:center; padding:40px; color:#E63946;"><p>❌ Ошибка сканера</p></div>';
    }
  }

  _stopScanner() {
    if (this.html5QrCode) { this.html5QrCode.stop().then(() => { this.html5QrCode = null; this._closeAllModals(); }).catch(() => this._closeAllModals()); }
    else this._closeAllModals();
  }

  _handleScannedQR(decodedText) {
    try {
      const data = JSON.parse(decodedText);
      if (data.type === 'revers-connect' && data.id) {
        this._stopScanner();
        const chat = { id: data.id, type: 'contact', name: data.name || data.id };
        if (!REVERS.getChatHistory(data.id).length) REVERS.sendMessage(data.id, '🔗 Подключение через QR');
        REVERS.connectToPeer(data.id);
        this._openChat(chat);
        alert('✅ Подключено к ' + (data.name || data.id));
        return;
      }
    } catch(e) {}
    if (decodedText.length > 5) { this._stopScanner(); const chat = { id: decodedText, type: 'contact', name: decodedText }; REVERS.connectToPeer(decodedText); this._openChat(chat); }
    else alert('❌ Не удалось распознать QR-код');
  }

  _handleIncomingSignal(msg) {
    if (msg.initiator) { document.getElementById('signalInput').value = JSON.stringify(msg.signal); this._openModal('connectModal'); }
    else REVERS.applySignal(msg.from, msg.signal);
  }

  _openConnectModal() {
    this._closeAllModals();
    document.getElementById('connectModal').classList.add('active');
    document.getElementById('mySignalOutput').value = 'Генерация сигнала...';
    const peerId = this.currentChat?.id || 'peer_' + Date.now();
    const origCallback = REVERS.p2pNetwork.onMessageCallback;
    REVERS.p2pNetwork.onMessageCallback = (m) => {
      if (m.type === 'p2p-signal' && m.initiator && m.to === peerId) {
        document.getElementById('mySignalOutput').value = JSON.stringify(m.signal);
      }
      if (origCallback) origCallback(m);
    };
    REVERS.connectToPeer(peerId);
    setTimeout(() => { const out = document.getElementById('mySignalOutput'); if (!out.value || out.value === 'Генерация сигнала...') out.value = 'Не получен. Проверьте интернет.'; }, 5000);
  }

  _handleConnect() {
    const peerId = document.getElementById('peerIdInput').value.trim();
    const signalInput = document.getElementById('signalInput').value.trim();
    if (signalInput) {
      try {
        const signal = JSON.parse(signalInput);
        if (signal.sdp || signal.candidate) { REVERS.acceptPeer(peerId || 'remote-peer', signal); this._closeAllModals(); this._updateConnectionStatus(true); return; }
      } catch(e) { alert('Неверный формат сигнала'); }
    }
    if (peerId) { REVERS.connectToPeer(peerId); document.getElementById('mySignalOutput').value = 'Генерация для ' + peerId + '...'; }
  }

  _openBrowser(url = 'https://duckduckgo.com') {
    this._closeAllModals();
    document.getElementById('browserModal').classList.add('active');
    document.getElementById('browserUrlInput').value = url;
    this._navigateTo(url);
  }

  _navigateTo(url) {
    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) targetUrl = 'https://' + targetUrl;
    document.getElementById('browserUrlInput').value = targetUrl;
    const loadingBar = document.getElementById('browserLoading');
    const loadingFill = document.getElementById('browserLoadingBar');
    loadingBar.style.display = 'block'; loadingFill.style.width = '0%';
    let progress = 0;
    const loadingInterval = setInterval(() => { progress += Math.random() * 15; if (progress > 90) progress = 90; loadingFill.style.width = progress + '%'; }, 200);
    const frame = document.getElementById('browserFrame');
    frame.src = targetUrl;
    frame.onload = () => { clearInterval(loadingInterval); loadingFill.style.width = '100%'; setTimeout(() => { loadingBar.style.display = 'none'; }, 300); };
    frame.onerror = () => { clearInterval(loadingInterval); loadingBar.style.display = 'none'; alert('Не удалось загрузить страницу'); };
  }

  _navigateBrowser() { const url = document.getElementById('browserUrlInput').value.trim(); if (url) this._navigateTo(url); }
  _openLink(url) { this._openBrowser(url); }

  async _toggleVoiceRecord() {
    const btn = document.getElementById('voiceRecordBtn');
    if (this.isRecording) {
      btn.textContent = '🎤'; this.isRecording = false;
      if (this.voiceRecorder) {
        const result = await this.voiceRecorder;
        if (result?.stop) {
          const audioBase64 = await new Promise(resolve => {
            result.recorder.onstop = () => {
              setTimeout(() => {
                const blob = new Blob(result.chunks || [], { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              }, 100);
            };
            result.stop();
          });
          if (audioBase64 && this.currentChat) {
            const duration = Math.round((Date.now() - this.voiceStartTime) / 1000);
            const targetId = this.currentChat.type === 'saved' ? 'me' : this.currentChat.id;
            REVERS.sendVoice(targetId, audioBase64, duration || 1);
            this._renderMessages(this.currentChat); this._renderChatsList();
          }
        }
        this.voiceRecorder = null;
      }
    } else {
      try { const ts = await navigator.mediaDevices.getUserMedia({ audio: true }); ts.getTracks().forEach(t => t.stop()); } catch(e) { alert('❌ Нет доступа к микрофону.'); return; }
      btn.textContent = '🔴'; this.isRecording = true; this.voiceStartTime = Date.now();
      this.voiceRecorder = REVERS.recordVoice();
    }
  }

  _sendMessage() {
    const input = document.getElementById('messageInput'); const text = input.value.trim();
    if (!text || !this.currentChat) return;
    let ok = false;
    if (this.currentChat.type === 'saved') ok = REVERS.sendMessage('me', text);
    else if (this.currentChat.type === 'group') ok = REVERS.sendGroupMessage(this.currentChat.id, text);
    else if (this.currentChat.type === 'channel') ok = REVERS.sendChannelMessage(this.currentChat.id, text);
    else ok = REVERS.sendMessage(this.currentChat.id, text);
    if (ok || this.currentChat.type === 'saved' || this.currentChat.type === 'group' || this.currentChat.type === 'channel') {
      this._renderMessages(this.currentChat); input.value = ''; this.replyTo = null; this._renderChatsList();
    }
  }

  _sendFile(file) {
    if (!this.currentChat) return;
    const targetId = this.currentChat.type === 'saved' ? 'me' : this.currentChat.id;
    REVERS.sendFile(targetId, file).then(() => { this._renderMessages(this.currentChat); });
  }

  _sendSticker(emoji) {
    if (!this.currentChat) return;
    if (this.currentChat.type === 'saved') REVERS.sendMessage('me', emoji);
    else if (this.currentChat.type === 'group') REVERS.sendGroupMessage(this.currentChat.id, emoji);
    else if (this.currentChat.type === 'channel') REVERS.sendChannelMessage(this.currentChat.id, emoji);
    else REVERS.sendMessage(this.currentChat.id, emoji);
    this._renderMessages(this.currentChat); document.getElementById('stickerPanel').classList.remove('active');
  }

  _createGroup() { const n = document.getElementById('groupNameInput').value.trim(); if (!n) return; const k = REVERS.createGroup(n); this._closeAllModals(); this._openChat({ id: k, name: '👥 ' + n, type: 'group' }); document.getElementById('groupNameInput').value = ''; }
  _createChannel() { const n = document.getElementById('channelNameInput').value.trim(); if (!n) return; const k = REVERS.createChannel(n); this._closeAllModals(); this._openChat({ id: k, name: '📢 ' + n, type: 'channel' }); document.getElementById('channelNameInput').value = ''; }

  _openChat(chat) {
    this.currentChat = chat;
    document.getElementById('chatsScreen').classList.add('hidden'); document.getElementById('chatScreen').classList.remove('hidden');
    document.getElementById('chatName').textContent = chat.name;
    this._updateConnectionStatus(REVERS.isConnected(chat.id));
    this._renderMessages(chat); this._toggleSidebar(false); document.getElementById('stickerPanel').classList.remove('active'); this.replyTo = null;
  }

  _goToChats() { document.getElementById('chatScreen').classList.add('hidden'); document.getElementById('chatsScreen').classList.remove('hidden'); this.currentChat = null; this.replyTo = null; this._renderChatsList(); }

  _renderChatsList() {
    const c = document.getElementById('chatsList'); c.innerHTML = '';
    const chats = REVERS.getAllChats();
    if (!chats.length) { c.innerHTML = '<p style="color:#8E8E9A; text-align:center; padding:20px;">Нет чатов</p>'; return; }
    chats.forEach(chat => {
      const d = document.createElement('div'); d.className = 'chat-item';
      const emoji = chat.type === 'saved' ? '📔' : chat.type === 'group' ? '👥' : chat.type === 'channel' ? '📢' : '💬';
      d.innerHTML = `<div class="chat-avatar">${emoji}</div><div class="chat-info"><div class="chat-name">${this._esc(chat.name)}</div><div class="chat-preview">${this._esc(chat.lastMsg || '')}</div></div><div class="chat-time">${chat.lastTime ? new Date(chat.lastTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}</div>`;
      d.addEventListener('click', () => this._openChat(chat)); c.appendChild(d);
    });
  }

  _renderMessages(chat) {
    const area = document.getElementById('messagesArea'); area.innerHTML = '';
    let history = [];
    if (chat.type === 'saved') history = REVERS.getChatHistory('me');
    else if (chat.type === 'group') history = REVERS.getGroupHistory(chat.id);
    else if (chat.type === 'channel') history = REVERS.getChannelHistory(chat.id);
    else history = REVERS.getChatHistory(chat.id);
    history.forEach(msg => {
      const isOutgoing = msg.from === REVERS.getMyId();
      const div = document.createElement('div'); div.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
      let html = '<div class="bubble">';
      const linkifiedText = this._esc(msg.text || '').replace(/(https?:\/\/[^\s]+)/g, '<a onclick="window.REVERSApp._openLink(\'$1\')" style="color:#2A9D8F; text-decoration:underline; cursor:pointer;">$1</a>');
      html += `<div class="message-text">${linkifiedText}</div>`;
      if (msg.type === 'voice' && msg.fileData) html += `<audio controls src="${msg.fileData}" style="max-width:200px; height:30px; margin-top:4px;"></audio>`;
      if (msg.type === 'file' && msg.fileName) {
        html += `<div class="file-attachment">📄 ${this._esc(msg.fileName)}</div>`;
        if (msg.fileData && msg.fileType?.startsWith('image/')) html += `<img src="${msg.fileData}" class="file-preview-img" onclick="document.getElementById('fullscreenImage').src='${msg.fileData}'; document.getElementById('imageViewer').classList.add('active')">`;
      }
      html += `<div class="message-time">${new Date(msg.time).toLocaleTimeString()}</div></div>`;
      div.innerHTML = html;
      if (!isOutgoing) div.addEventListener('click', () => { this.replyTo = { text: msg.text, from: msg.from }; document.getElementById('messageInput').focus(); });
      area.appendChild(div);
    });
    area.scrollTop = area.scrollHeight;
  }

  _renderGroupsList() {
    const c = document.getElementById('groupsList'); c.innerHTML = '';
    const groups = REVERS.getAllChats().filter(ch => ch.type === 'group');
    if (!groups.length) { c.innerHTML = '<p style="color:#8E8E9A; text-align:center;">Нет групп</p>'; return; }
    groups.forEach(g => { const d = document.createElement('div'); d.style.cssText = 'background:#2A2A3A; border-radius:16px; padding:12px; margin:8px 0; display:flex; justify-content:space-between; align-items:center;'; d.innerHTML = `<strong style="color:white">${g.name}</strong>`; const btn = document.createElement('button'); btn.textContent = 'Открыть'; btn.style.cssText = 'background:#E63946; border:none; padding:6px 12px; border-radius:20px; color:white; cursor:pointer;'; btn.addEventListener('click', () => { this._closeAllModals(); this._openChat(g); }); d.appendChild(btn); c.appendChild(d); });
  }

  _renderChannelsList() {
    const c = document.getElementById('channelsList'); c.innerHTML = '';
    const channels = REVERS.getAllChats().filter(ch => ch.type === 'channel');
    if (!channels.length) { c.innerHTML = '<p style="color:#8E8E9A; text-align:center;">Нет каналов</p>'; return; }
    channels.forEach(ch => { const d = document.createElement('div'); d.style.cssText = 'background:#2A2A3A; border-radius:16px; padding:12px; margin:8px 0; display:flex; justify-content:space-between; align-items:center;'; d.innerHTML = `<strong style="color:white">${ch.name}</strong>`; const btn = document.createElement('button'); btn.textContent = 'Открыть'; btn.style.cssText = 'background:#E63946; border:none; padding:6px 12px; border-radius:20px; color:white; cursor:pointer;'; btn.addEventListener('click', () => { this._closeAllModals(); this._openChat(ch); }); d.appendChild(btn); c.appendChild(d); });
  }

  _deleteCurrentChat() { if (!this.currentChat || this.currentChat.type === 'saved') return; if (confirm('Удалить этот чат?')) this._goToChats(); }
  _updateConnectionStatus(connected) { const l = document.getElementById('statusLed'); const t = document.getElementById('statusText'); if (connected) { l.classList.add('green'); t.textContent = 'P2P Online'; } else { l.classList.remove('green'); t.textContent = 'Оффлайн'; } }
  _toggleSidebar(show) { document.getElementById('sidebar').classList.toggle('open', show); document.getElementById('overlay').classList.toggle('active', show); }
  _openModal(id) { this._closeAllModals(); document.getElementById(id).classList.add('active'); this._toggleSidebar(false); }
  _closeAllModals() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('active')); }
  _toggleTheme() { const t = document.getElementById('themeToggle'); t.classList.toggle('active'); document.body.classList.toggle('light-theme'); localStorage.setItem('revers_dark', t.classList.contains('active')); }
  _toggleSound() { document.getElementById('soundToggle').classList.toggle('active'); }
  _loadSettings() { if (localStorage.getItem('revers_dark') === 'false') { document.body.classList.add('light-theme'); document.getElementById('themeToggle').classList.remove('active'); } }
  _esc(text) { if (!text) return ''; const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }
}

document.addEventListener('DOMContentLoaded', () => new REVERSApp());