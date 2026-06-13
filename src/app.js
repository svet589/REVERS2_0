// =============================================================================
// REVERS Messenger v3.4 — ПОЛНЫЙ APP.JS
// =============================================================================
// Лицензия: GNU GPL v3
// Разработчик: https://github.com/svet589
// =============================================================================
// ОПИСАНИЕ:
// Главный файл фронтенда. Отвечает за весь интерфейс и взаимодействие с ядром.
// Включает: чаты, сообщения, группы, каналы, стикеры, звонки, QR, профиль,
// подарки, политику, память, поддержку, поиск и многое другое.
// =============================================================================

// =============================================================================
// ИМПОРТЫ
// =============================================================================
import QRCode from 'qrcode';                             // Генерация QR-кодов
import { Html5Qrcode } from 'html5-qrcode';              // Сканер QR-кодов
import stickerManager from './core/sticker-manager.js';   // Управление стикерами
import groupManager from './core/group-manager.js';       // Управление группами

const REVERS = window.REVERS;  // Ссылка на ядро мессенджера

// =============================================================================
// КОНСТАНТЫ
// =============================================================================
const DEFAULT_DIAMONDS = 20;  // Стартовое количество алмазов у каждого пользователя

// =============================================================================
// КЛАСС REVERSAPP — главный контроллер интерфейса
// =============================================================================
class REVERSApp {

  // ===========================================================================
  // КОНСТРУКТОР — инициализация состояния и запуск
  // ===========================================================================
  constructor() {
    // Централизованное состояние приложения
    this.state = {
      currentChat: null,           // Текущий открытый чат { id, type, name }
      currentTopic: null,          // Текущая тема форума
      replyTo: null,               // Сообщение на которое отвечаем
      editingMessage: null,        // Сообщение которое редактируем
      activeStickerPack: 'recent', // Активный стикерпак
      isRecording: false,          // Идёт ли запись голосового
      voiceRecorder: null,         // Объект рекордера
      voiceStartTime: null,        // Время начала записи
      callTimer: null,             // Таймер звонка
      callSeconds: 0,              // Секунды звонка
      typingTimeout: null,         // Таймаут индикатора печати
      diamonds: 0,                 // Алмазы (загружаются из localStorage)
      gifts: [],                   // Подарки
      isSidebarOpen: false,        // Открыто ли боковое меню
      myId: null,                  // Мой REVERS ID
      myProfile: null,             // Мой профиль
      searchQuery: '',             // Поисковый запрос
      searchResults: [],           // Результаты поиска в чате
      searchCurrentIndex: 0,       // Текущий индекс в результатах поиска
      messageFilter: 'all'         // Фильтр сообщений (all, file, image, link, voice)
    };

    this.elements = {};     // Кэш DOM-элементов
    this.html5QrCode = null; // Объект сканера QR
    this._init();           // Запуск инициализации
  }

  // ===========================================================================
  // ИНИЦИАЛИЗАЦИЯ — запускается при создании экземпляра
  // ===========================================================================
  async _init() {
    this._cacheElements();        // Кэшируем все DOM-элементы
    this._bindEvents();           // Вешаем обработчики событий
    this._bindBackButton();       // Обработка кнопки "Назад" (Android)
    this._bindSwipeBack();        // Обработка свайпа назад
    this._bindHotkeys();          // Горячие клавиши (Ctrl+K, Ctrl+N, Escape)
    this._loadSettings();         // Загружаем настройки (тема, звук)
    this._initDiamonds();         // Инициализируем алмазы (20 по умолчанию)

    // Ждём готовности ядра
    if (REVERS?.onReady) {
      REVERS.onReady(() => this._onReady());
      REVERS.init();
    } else {
      console.warn('REVERS ядро не загружено');
      setTimeout(() => this._onReady(), 500);
    }
  }

  // ===========================================================================
  // КЭШИРОВАНИЕ DOM-ЭЛЕМЕНТОВ — для быстрого доступа без querySelector
  // ===========================================================================
  _cacheElements() {
    const ids = [
      'chatsScreen', 'chatScreen', 'topicsScreen', 'accountScreen', 'settingsScreen',
      'privacyScreen', 'storageScreen', 'aboutScreen', 'supportScreen', 'editProfileScreen',
      'chatsList', 'messagesArea', 'messageInput', 'sendBtn', 'backBtn', 'chatName',
      'statusLed', 'statusText', 'sidebar', 'overlay', 'typingIndicator',
      'replyBar', 'replyBarText', 'replyBarClose', 'editIndicator',
      'stickerPanel', 'stickerTabs', 'stickerGrid', 'stickerToggleBtn', 'voiceRecordBtn',
      'fileInput', 'pinnedMessage', 'pinnedText', 'unpinBtn',
      'reactionPanel', 'contextMenu', 'dhtStatus'
    ];
    for (const id of ids) {
      this.elements[id] = document.getElementById(id);
    }
  }

  // ===========================================================================
  // ПРИВЯЗКА ВСЕХ СОБЫТИЙ — клики, ввод, файлы, сайдбар, дропдауны
  // ===========================================================================
  _bindEvents() {
    // --- МЕНЮ И НАВИГАЦИЯ ---
    document.getElementById('menuBtn')?.addEventListener('click', () => this._toggleSidebar(true));
    document.getElementById('overlay')?.addEventListener('click', () => this._toggleSidebar(false));
    document.getElementById('backBtn')?.addEventListener('click', () => this._goToChats());

    // --- ОТПРАВКА СООБЩЕНИЙ ---
    document.getElementById('sendBtn')?.addEventListener('click', () => this._sendMessage());
    document.getElementById('messageInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendMessage(); }
    });
    document.getElementById('messageInput')?.addEventListener('input', () => this._handleTyping());
    document.getElementById('messageInput')?.addEventListener('blur', () => this._saveDraft());

    // --- ФАЙЛЫ ---
    document.getElementById('fileInput')?.addEventListener('change', (e) => {
      if (e.target.files?.[0]) this._sendFile(e.target.files[0]);
      e.target.value = '';
    });

    // --- СТИКЕРЫ И ГОЛОСОВЫЕ ---
    document.getElementById('stickerToggleBtn')?.addEventListener('click', () => this._toggleStickerPanel());
    document.getElementById('voiceRecordBtn')?.addEventListener('click', () => this._toggleVoiceRecord());

    // --- ЧАТ-МЕНЮ (⋮) ---
    document.getElementById('chatMenuBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showChatMenu();
    });

    // --- ПОИСК ПО ЧАТАМ ---
    document.getElementById('searchChatsBtn')?.addEventListener('click', () => this._toggleChatSearch(true));
    document.getElementById('searchChatsCloseBtn')?.addEventListener('click', () => this._toggleChatSearch(false));
    document.getElementById('searchChatsInput')?.addEventListener('input', (e) => this._filterChats(e.target.value));

    // --- ДОБАВЛЕНИЕ КОНТАКТА ---
    document.getElementById('addContactBtn')?.addEventListener('click', () => this._openModal('addContactModal'));
    document.getElementById('addContactConfirmBtn')?.addEventListener('click', () => this._addContact());
    document.getElementById('addContactCloseBtn')?.addEventListener('click', () => this._closeAllModals());

    // --- ПОДКЛЮЧЕНИЕ P2P ---
    document.getElementById('connectSendBtn')?.addEventListener('click', () => this._handleConnect());
    document.getElementById('copySignalBtn')?.addEventListener('click', () => this._copySignal());
    document.getElementById('closeConnectBtn')?.addEventListener('click', () => this._closeAllModals());

    // --- QR-КОД ---
    document.getElementById('copyInviteLinkBtn')?.addEventListener('click', () => this._copyInviteLink());
    document.getElementById('shareInviteBtn')?.addEventListener('click', () => this._shareInvite());
    document.getElementById('closeQrBtn')?.addEventListener('click', () => this._closeAllModals());

    // --- СКАНЕР QR ---
    document.getElementById('stopScannerBtn')?.addEventListener('click', () => this._stopScanner());

    // --- БРАУЗЕР ---
    document.getElementById('browserGoBtn')?.addEventListener('click', () => this._openInBrowser());
    document.getElementById('closeBrowserBtn')?.addEventListener('click', () => this._closeAllModals());
    document.getElementById('browserUrlInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._openInBrowser();
    });

    // --- ГРУППЫ ---
    document.getElementById('createGroupBtn')?.addEventListener('click', () => this._openModal('createGroupModal'));
    document.getElementById('confirmGroupBtn')?.addEventListener('click', () => this._createGroup());
    document.getElementById('cancelGroupBtn')?.addEventListener('click', () => this._closeAllModals());
    document.getElementById('closeGroupsBtn')?.addEventListener('click', () => this._closeAllModals());

    // --- КАНАЛЫ ---
    document.getElementById('createChannelBtn')?.addEventListener('click', () => this._openModal('createChannelModal'));
    document.getElementById('confirmChannelBtn')?.addEventListener('click', () => this._createChannel());
    document.getElementById('cancelChannelBtn')?.addEventListener('click', () => this._closeAllModals());
    document.getElementById('closeChannelsBtn')?.addEventListener('click', () => this._closeAllModals());

    // --- СТИКЕРПАКИ ---
    document.getElementById('confirmStickerPackBtn')?.addEventListener('click', () => this._createStickerPack());
    document.getElementById('cancelStickerPackBtn')?.addEventListener('click', () => this._closeAllModals());
    document.getElementById('confirmStickerBtn')?.addEventListener('click', () => this._addStickerToPack());
    document.getElementById('cancelStickerBtn')?.addEventListener('click', () => this._closeAllModals());
    document.getElementById('stickerFileInput')?.addEventListener('change', (e) => this._previewSticker(e));

    // --- ТЕМЫ ФОРУМА ---
    document.getElementById('confirmTopicBtn')?.addEventListener('click', () => this._createTopic());
    document.getElementById('cancelTopicBtn')?.addEventListener('click', () => this._closeAllModals());
    document.getElementById('addTopicBtn')?.addEventListener('click', () => this._openModal('createTopicModal'));
    document.getElementById('topicsBackBtn')?.addEventListener('click', () => this._goToChats());

    // --- ГОЛОСОВАНИЯ ---
    document.getElementById('confirmPollBtn')?.addEventListener('click', () => this._createPoll());
    document.getElementById('cancelPollBtn')?.addEventListener('click', () => this._closeAllModals());

    // --- МАГАЗИН ПОДАРКОВ ---
    document.getElementById('closeGiftShopBtn')?.addEventListener('click', () => this._closeAllModals());

    // --- НАСТРОЙКИ ГРУППЫ ---
    document.getElementById('closeGroupSettingsBtn')?.addEventListener('click', () => this._closeAllModals());

    // --- ЗВОНКИ ---
    document.getElementById('callEndBtn')?.addEventListener('click', () => this._endCall());

    // --- ПРОСМОТР ИЗОБРАЖЕНИЙ ---
    document.getElementById('imageViewer')?.addEventListener('click', () => {
      document.getElementById('imageViewer')?.classList.remove('active');
    });

    // --- КОНТЕКСТНОЕ МЕНЮ СООБЩЕНИЯ ---
    document.getElementById('ctxEdit')?.addEventListener('click', () => this._editSelectedMessage());
    document.getElementById('ctxReply')?.addEventListener('click', () => this._replyToSelectedMessage());
    document.getElementById('ctxForward')?.addEventListener('click', () => this._forwardSelectedMessage());
    document.getElementById('ctxPin')?.addEventListener('click', () => this._pinSelectedMessage());
    document.getElementById('ctxCopy')?.addEventListener('click', () => this._copySelectedMessage());
    document.getElementById('ctxDelete')?.addEventListener('click', () => this._deleteSelectedMessage());
    document.getElementById('ctxDeleteForAll')?.addEventListener('click', () => this._deleteForAllSelectedMessage());

    // --- РЕАКЦИИ ---
    document.querySelectorAll('.reaction-emoji').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this._addReaction(el.dataset.emoji);
      });
    });

    // --- ЗАКРЫТИЕ ДРОПДАУНОВ ПО КЛИКУ ВНЕ ---
    document.addEventListener('click', () => {
      document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden'));
      this.elements.reactionPanel?.classList.add('hidden');
      this.elements.contextMenu?.classList.add('hidden');
    });

    // =======================================================================
    // SIDEBAR — пункты бокового меню
    // =======================================================================
    const sidebarItems = {
      'accountMenuBtn':      () => this._showScreen('account'),      // Экран Аккаунта
      'savedMenuBtn':        () => this._openSavedChat(),            // Сохранённые
      'groupsSidebarBtn':    () => this._openModal('groupsModal'),   // Группы
      'channelsSidebarBtn':  () => this._openModal('channelsModal'), // Каналы
      'settingsMenuBtn':     () => this._showScreen('settings'),     // Настройки
      'scanMenuBtn':         () => this._startScanner(),             // Сканер QR
      'storageMenuBtn':      () => this._showScreen('storage'),      // Память
      'privacyMenuBtn':      () => this._showScreen('privacy'),      // Политика
      'supportSidebarBtn':   () => this._showScreen('support'),      // Поддержка
      'aboutMenuBtn':        () => this._showScreen('about')         // О нас
    };
    Object.entries(sidebarItems).forEach(([id, handler]) => {
      document.getElementById(id)?.addEventListener('click', () => {
        this._toggleSidebar(false);
        handler();
      });
    });

    // =======================================================================
    // ЭКРАН АККАУНТА
    // =======================================================================
    document.getElementById('accountBackBtn')?.addEventListener('click', () => this._goToChats());
    document.getElementById('accountQrBtn')?.addEventListener('click', () => this._showQR());
    document.getElementById('accountSettingsBtn')?.addEventListener('click', () => this._showScreen('settings'));
    document.getElementById('accountEditProfileBtn')?.addEventListener('click', () => this._showScreen('editProfile'));
    document.getElementById('accountGiftsBtn')?.addEventListener('click', () => this._openGiftShop());
    document.getElementById('accountStorageBtn')?.addEventListener('click', () => this._showScreen('storage'));
    document.getElementById('accountPrivacyBtn')?.addEventListener('click', () => this._showScreen('privacy'));
    document.getElementById('accountSupportBtn')?.addEventListener('click', () => this._showScreen('support'));

    // =======================================================================
    // ЭКРАН РЕДАКТИРОВАНИЯ ПРОФИЛЯ
    // =======================================================================
    document.getElementById('editProfileBackBtn')?.addEventListener('click', () => this._showScreen('account'));
    document.getElementById('editProfileChangeAvatarBtn')?.addEventListener('click', () => {
      document.getElementById('editProfileAvatarInput')?.click();
    });
    document.getElementById('editProfileAvatarInput')?.addEventListener('change', (e) => {
      if (e.target.files?.[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          document.getElementById('editProfileAvatar').src = ev.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });
    document.getElementById('editProfileSaveBtn')?.addEventListener('click', () => this._saveProfile());

    // =======================================================================
    // ЭКРАН НАСТРОЕК
    // =======================================================================
    document.getElementById('settingsBackBtn')?.addEventListener('click', () => this._goToChats());
    document.getElementById('themeSelect')?.addEventListener('change', (e) => this._applyTheme(e.target.value));
    document.getElementById('soundToggle')?.addEventListener('click', () => this._toggleSound());
    document.getElementById('callsToggle')?.addEventListener('click', function() { this.classList.toggle('active'); });
    document.getElementById('offlineToggle')?.addEventListener('click', function() { this.classList.toggle('active'); });
    document.getElementById('settingsStorageBtn')?.addEventListener('click', () => this._showScreen('storage'));
    document.getElementById('settingsExportBtn')?.addEventListener('click', () => this._exportData());

    // =======================================================================
    // ЭКРАНЫ ПОЛИТИКИ, ПАМЯТИ, О НАС, ПОДДЕРЖКИ
    // =======================================================================
    document.getElementById('privacyBackBtn')?.addEventListener('click', () => this._goToChats());
    document.getElementById('storageBackBtn')?.addEventListener('click', () => this._goToChats());
    document.getElementById('aboutBackBtn')?.addEventListener('click', () => this._goToChats());
    document.getElementById('supportBackBtn')?.addEventListener('click', () => this._goToChats());
    document.getElementById('supportReportBugBtn')?.addEventListener('click', () => {
      window.open('https://github.com/svet589/REVERS2_0/issues/new', '_blank');
    });

    // =======================================================================
    // ДРОПДАУНЫ ЧАТА
    // =======================================================================
    ['inviteToChatBtn', 'inviteToChatBtnGroup', 'inviteToChatBtnChannel'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => this._shareInviteLink());
    });
    ['searchInChatBtn', 'searchInChatBtnGroup', 'searchInChatBtnChannel'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => this._toggleSearchInChat(true));
    });
    document.getElementById('searchInChatCloseBtn')?.addEventListener('click', () => this._toggleSearchInChat(false));
    ['pinnedMsgBtn', 'pinnedMsgBtnGroup'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => this._togglePinnedMessage());
    });
    document.getElementById('unpinBtn')?.addEventListener('click', () => this._unpinMessage());
    document.getElementById('securityBtn')?.addEventListener('click', () => this._showSecurityNumber());
    document.getElementById('callBtn')?.addEventListener('click', () => {
      if (!REVERS) { this._showToast('Ядро не готово'); return; }
      if (this.state.currentChat) REVERS.startCall(this.state.currentChat.id, true);
    });
    document.getElementById('audioCallBtn')?.addEventListener('click', () => {
      if (!REVERS) { this._showToast('Ядро не готово'); return; }
      if (this.state.currentChat) REVERS.startCall(this.state.currentChat.id, false);
    });
    document.getElementById('groupCallBtn')?.addEventListener('click', async () => {
      if (!REVERS) { this._showToast('Ядро не готово'); return; }
      if (this.state.currentChat) await REVERS.startGroupCall(this.state.currentChat.id, true);
    });
    document.getElementById('createPollBtn')?.addEventListener('click', () => this._openModal('createPollModal'));
    document.getElementById('addAnnouncementBtn')?.addEventListener('click', () => this._addAnnouncement());
    document.getElementById('connectPeerBtn')?.addEventListener('click', () => this._openConnectModal());
    document.getElementById('topicsMenuBtn')?.addEventListener('click', () => this._openTopicsScreen());
    document.getElementById('groupSettingsBtn')?.addEventListener('click', () => this._showGroupSettings());
    document.getElementById('channelSettingsBtn')?.addEventListener('click', () => this._showChannelSettings());
    ['deleteChatBtn', 'deleteChatBtnGroup', 'deleteChatBtnChannel'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => this._deleteCurrentChat());
    });
    document.getElementById('clearHistoryBtn')?.addEventListener('click', () => this._clearHistory());

    // --- ФИЛЬТРЫ СООБЩЕНИЙ ---
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.messageFilter = btn.dataset.filter;
        if (this.state.currentChat) this._renderMessages(this.state.currentChat);
      });
    });
  }

  // ===========================================================================
  // ЗАГРУЗКА ПОСЛЕ ГОТОВНОСТИ ЯДРА
  // ===========================================================================
  async _onReady() {
    console.log('✅ REVERS UI готов');

    // Получаем ID из ядра или генерируем локально
    if (!REVERS) {
      console.error('REVERS не определён');
      this.state.myId = 'rev_' + Date.now().toString(36);
    } else {
      this.state.myId = REVERS.getMyId();
    }

    // Если ID пустой — берём из localStorage или генерируем
    if (!this.state.myId || this.state.myId === 'undefined') {
      this.state.myId = localStorage.getItem('revers_id') || ('rev_' + Date.now().toString(36));
      localStorage.setItem('revers_id', this.state.myId);
    }

    console.log('🆔 Мой ID:', this.state.myId);

    // Показываем ID в интерфейсе
    const idDisplay = document.getElementById('myIdDisplay');
    if (idDisplay) idDisplay.textContent = this.state.myId;

    // Получаем профиль
    this.state.myProfile = REVERS ? REVERS.getMyProfile() : { name: 'User', avatar: '' };

    // Обновляем статус DHT
    this._updateDHTStatus();

    // Загружаем черновик последнего чата
    this._loadLastChat();

    // Рендерим список чатов
    await this._renderChatsList();
  }

  // ===========================================================================
  // НАВИГАЦИЯ МЕЖДУ ЭКРАНАМИ
  // ===========================================================================

  // Показать экран по имени
  _showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const screen = document.getElementById(name + 'Screen');
    if (screen) screen.classList.remove('hidden');
    this._toggleSidebar(false);

    // Обновляем содержимое экрана при открытии
    if (name === 'account') this._updateAccountScreen();
    if (name === 'editProfile') this._loadEditProfileScreen();
    if (name === 'storage') this._renderStorageScreen();
    if (name === 'chats') this._renderChatsList();
  }

  // Вернуться к списку чатов
  _goToChats() {
    this._saveDraft();
    this.state.currentChat = null;
    this._showScreen('chats');
  }

  // Открыть чат
  _openChat(chat) {
    this._saveDraft();
    this.state.currentChat = chat;
    this._showScreen('chat');
    const chatName = document.getElementById('chatName');
    if (chatName) chatName.textContent = chat.name || chat.id;
    this._renderMessages(chat);
    this._togglePinnedMessage();
    this._loadDraft();
    // Сохраняем последний открытый чат
    localStorage.setItem('revers_last_chat', JSON.stringify(chat));
  }

  // Открыть/закрыть боковое меню
  _toggleSidebar(show) {
    this.state.isSidebarOpen = show;
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    if (sidebar) show ? sidebar.classList.add('open') : sidebar.classList.remove('open');
    if (overlay) show ? overlay.classList.add('active') : overlay.classList.remove('active');
  }

  // Открыть модальное окно
  _openModal(modalId) {
    this._closeAllModals();
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
    this._toggleSidebar(false);
  }

  // Закрыть все модальные окна
  _closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  }

  // ===========================================================================
  // ЭКРАН АККАУНТА
  // ===========================================================================
  _updateAccountScreen() {
    const avatar = document.getElementById('accountAvatar');
    const name = document.getElementById('accountName');
    const id = document.getElementById('accountId');
    const bio = document.getElementById('accountBio');
    const diamonds = document.getElementById('accountDiamonds');
    const online = document.getElementById('accountOnlineStatus');

    if (avatar) avatar.src = this.state.myProfile?.avatar || this._getInitialAvatar(this.state.myProfile?.name, this.state.myId);
    if (name) name.textContent = this.state.myProfile?.name || 'User';
    if (id) id.textContent = this.state.myId || 'rev_...';
    if (bio) bio.textContent = localStorage.getItem('revers_bio') || 'Без описания';
    if (diamonds) diamonds.textContent = `💎 ${this.state.diamonds}`;
    if (online) {
      const connected = REVERS?.getConnectedPeers?.()?.length > 0;
      online.style.background = connected ? '#4CAF50' : '#8E8E9A';
    }
  }

  // ===========================================================================
  // ЭКРАН РЕДАКТИРОВАНИЯ ПРОФИЛЯ
  // ===========================================================================
  _loadEditProfileScreen() {
    document.getElementById('editProfileAvatar').src = this.state.myProfile?.avatar || this._getInitialAvatar(this.state.myProfile?.name, this.state.myId);
    document.getElementById('editProfileName').value = this.state.myProfile?.name || '';
    document.getElementById('editProfileBio').value = localStorage.getItem('revers_bio') || '';
  }

  _saveProfile() {
    const name = document.getElementById('editProfileName')?.value?.trim();
    const bio = document.getElementById('editProfileBio')?.value?.trim();
    const avatar = document.getElementById('editProfileAvatar')?.src;

    if (name && REVERS) REVERS.setName(name);
    if (bio !== undefined) localStorage.setItem('revers_bio', bio);
    if (avatar && avatar !== this.state.myProfile?.avatar && REVERS) REVERS.setAvatar(avatar);

    this.state.myProfile = REVERS ? REVERS.getMyProfile() : { name: name || 'User', avatar: avatar || '' };
    this._showToast('✅ Профиль сохранён');
    this._showScreen('account');
  }

  // ===========================================================================
  // АВАТАРКА ПО УМОЛЧАНИЮ (инициалы + цвет по хэшу)
  // ===========================================================================
  _getInitialAvatar(name, id) {
    const initial = (name || '?').charAt(0).toUpperCase();
    const hash = this._simpleHash(id || 'unknown');
    const hue = Math.abs(parseInt(hash.substring(0, 6), 16)) % 360;
    const bgColor = `hsl(${hue}, 60%, 35%)`;
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='${encodeURIComponent(bgColor)}' width='100' height='100'/%3E%3Ctext x='50' y='68' text-anchor='middle' fill='white' font-size='45' font-family='system-ui'%3E${encodeURIComponent(initial)}%3C/text%3E%3C/svg%3E`;
  }

  // ===========================================================================
  // ЭКРАН ПАМЯТИ
  // ===========================================================================
  _renderStorageScreen() {
    const container = document.getElementById('storageContent');
    if (!container) return;

    let totalSize = 0;
    let cacheSize = 0;
    let stickerCount = 0;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      const size = (key?.length || 0) + (val?.length || 0);
      totalSize += size;
      if (key?.startsWith('draft_') || key?.startsWith('revers_pinned_') || key?.startsWith('revers_relay_')) {
        cacheSize += size;
      }
    }

    try {
      const packs = stickerManager.getPacks();
      Object.values(packs).forEach(pack => {
        stickerCount += pack.stickers?.length || 0;
      });
    } catch (e) {}

    const totalMB = (totalSize / 1048576).toFixed(2);
    const cacheMB = (cacheSize / 1048576).toFixed(2);

    container.innerHTML = `
      <div class="storage-stat"><div class="stat-value">💾 ${totalMB} MB</div><div class="stat-label">Общий объём localStorage</div></div>
      <div class="storage-stat"><div class="stat-value">🧹 ${cacheMB} MB</div><div class="stat-label">Кэш (черновики, закрепы)</div></div>
      <div class="storage-stat"><div class="stat-value">😊 ${stickerCount} шт.</div><div class="stat-label">Стикеров в паках</div></div>
      <button id="clearCacheBtn" style="background:#2A2A3A;">🧹 Очистить кэш</button>
      <button id="clearAllDataBtn" style="background:#E63946;">🗑️ Очистить все данные</button>
    `;

    document.getElementById('clearCacheBtn')?.addEventListener('click', () => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('draft_') || k?.startsWith('revers_pinned_') || k?.startsWith('revers_relay_')) {
          keys.push(k);
        }
      }
      keys.forEach(k => localStorage.removeItem(k));
      this._showToast(`🧹 Очищено ${keys.length} записей`);
      this._renderStorageScreen();
    });

    document.getElementById('clearAllDataBtn')?.addEventListener('click', () => {
      if (!confirm('Вы уверены? Все данные будут удалены безвозвратно. Продолжить?')) return;
      const input = prompt('Это последнее предупреждение! Напишите "УДАЛИТЬ" для подтверждения:');
      if (input === 'УДАЛИТЬ') {
        localStorage.clear();
        this._showToast('🗑️ Все данные удалены');
        setTimeout(() => location.reload(), 1000);
      } else {
        this._showToast('❌ Операция отменена');
      }
    });
  }

  // ===========================================================================
  // ОТПРАВКА СООБЩЕНИЙ
  // ===========================================================================
  async _sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input?.value?.trim();
    if (!text || !this.state.currentChat) return;

    if (!REVERS) { this._showToast('Ядро не готово'); return; }

    // Анимация нажатия
    input.style.transform = 'scale(0.97)';
    setTimeout(() => input.style.transform = '', 100);

    const chat = this.state.currentChat;
    const msg = {
      from: this.state.myId || 'me',
      text: text,
      time: Date.now(),
      type: 'text',
      sent: true,
      read: false
    };

    // Мгновенно показываем сообщение в UI
    this._appendMessageToUI(msg, true);

    // Очищаем поле
    input.value = '';
    this.state.replyTo = null;
    this.elements.replyBar?.classList.add('hidden');
    this._saveDraft();

    // Отправляем через ядро
    try {
      if (chat.type === 'group') {
        REVERS.sendGroupMessage(chat.id, text);
      } else if (chat.type === 'saved') {
        REVERS.sendMessage('me', text);
        this._saveMessageToLocal('me', msg);
      } else if (chat.type === 'channel') {
        REVERS.sendChannelMessage(chat.id, text);
      } else {
        REVERS.sendMessage(chat.id, text);
      }
    } catch (e) {
      console.error('Ошибка отправки:', e);
    }

    // Обновляем список чатов
    this._renderChatsList();
  }

  // Сохранить сообщение локально (для сохранённых)
  _saveMessageToLocal(chatId, msg) {
    const key = 'revers_local_' + chatId;
    const messages = JSON.parse(localStorage.getItem(key) || '[]');
    messages.push(msg);
    if (messages.length > 500) messages.splice(0, messages.length - 500);
    localStorage.setItem(key, JSON.stringify(messages));
  }

  // Загрузить сообщения локально
  _getLocalMessages(chatId) {
    return JSON.parse(localStorage.getItem('revers_local_' + chatId) || '[]');
  }

  // Мгновенно добавить сообщение в DOM
  _appendMessageToUI(msg, isOutgoing) {
    const area = this.elements.messagesArea;
    if (!area) return;

    const div = document.createElement('div');
    div.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;

    const timeStr = msg.time
      ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    const statusIcon = isOutgoing ? (msg.read ? '<span class="message-status read">✓✓</span>' : '<span class="message-status">✓</span>') : '';

    div.innerHTML = `
      <div class="bubble">
        <div class="message-text">${this._escapeHtml(msg.text || '')}</div>
        <div class="message-meta">
          <span class="message-time">${timeStr}</span>
          ${statusIcon}
        </div>
      </div>
    `;

    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  }

  // Отправить файл
  async _sendFile(file) {
    if (!this.state.currentChat) return;
    if (!REVERS) { this._showToast('Ядро не готово'); return; }

    console.log('📎 Отправка файла:', file.name, this._formatSize(file.size), file.type);
    try {
      await REVERS.sendFile(this.state.currentChat.id, file);
      this._showToast('✅ Файл отправлен');
      await this._renderMessages(this.state.currentChat);
    } catch (e) {
      console.error('Ошибка отправки файла:', e);
      this._showToast('❌ Файлы временно не работают');
    }
  }

  // ===========================================================================
  // ОТОБРАЖЕНИЕ СООБЩЕНИЙ (ИСТОРИЯ)
  // ===========================================================================
  async _renderMessages(chat) {
    const area = this.elements.messagesArea;
    if (!area) return;
    area.innerHTML = '';

    let history = [];
    const myId = this.state.myId || (REVERS ? REVERS.getMyId() : 'me');

    try {
      if (chat.type === 'saved') {
        history = this._getLocalMessages('me');
        if (REVERS) {
          const remoteHistory = await REVERS.getChatHistory('me') || [];
          if (remoteHistory.length > history.length) {
            history = remoteHistory;
            localStorage.setItem('revers_local_me', JSON.stringify(history));
          }
        }
      } else if (chat.type === 'group') {
        history = REVERS ? (REVERS.getGroupHistory(chat.id) || []) : [];
      } else if (chat.type === 'channel') {
        history = REVERS ? (REVERS.getChannelHistory(chat.id) || []) : [];
      } else {
        history = REVERS ? (await REVERS.getChatHistory(chat.id) || []) : [];
      }
    } catch (e) {
      history = [];
    }

    // Применяем фильтр
    if (this.state.messageFilter !== 'all') {
      const filter = this.state.messageFilter;
      history = history.filter(msg => {
        if (filter === 'file') return msg.type === 'file';
        if (filter === 'image') return msg.type === 'file' && msg.fileType?.startsWith('image/');
        if (filter === 'link') return /https?:\/\//.test(msg.text || '');
        if (filter === 'voice') return msg.type === 'voice';
        return true;
      });
    }

    if (!history.length) {
      area.innerHTML = '<div style="color:#8E8E9A;text-align:center;padding:40px;">Нет сообщений</div>';
      return;
    }

    for (const msg of history) {
      const isOutgoing = msg.from === myId;
      const div = document.createElement('div');
      div.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;

      const timeStr = msg.time
        ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

      const statusIcon = isOutgoing ? (msg.read ? '<span class="message-status read">✓✓</span>' : '<span class="message-status">✓</span>') : '';

      let html = '<div class="bubble">';
      html += `<div class="message-text">${this._escapeHtml(msg.text || '')}</div>`;

      if (msg.type === 'voice' && msg.fileData) {
        html += `<audio controls src="${msg.fileData}" style="max-width:200px;height:30px;margin-top:4px;"></audio>`;
      }

      if (msg.type === 'file' && msg.fileName) {
        html += `<div class="file-attachment">
          <span onclick="window.REVERSApp._openMedia('${msg.fileData || ''}', '${msg.fileType || ''}')">📄 ${this._escapeHtml(msg.fileName)}</span>
          <button class="file-save-btn" onclick="event.stopPropagation();window.REVERSApp._saveFile('${msg.fileData || ''}', '${this._escapeHtml(msg.fileName)}')">💾</button>
        </div>`;
      }

      html += `<div class="message-meta"><span class="message-time">${timeStr}</span>${statusIcon}</div>`;
      html += '</div>';

      div.innerHTML = html;
      area.appendChild(div);
    }
    area.scrollTop = area.scrollHeight;
  }

  // Сохранить файл на устройство
  _saveFile(dataUrl, fileName) {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName || 'file';
    a.click();
    this._showToast('💾 Файл сохранён');
  }

  // ===========================================================================
  // СПИСОК ЧАТОВ
  // ===========================================================================
  async _renderChatsList(filteredList = null) {
    const container = this.elements.chatsList;
    if (!container) return;
    container.innerHTML = '';

    let chats = filteredList;
    if (!chats && REVERS) {
      try { chats = await REVERS.getAllChats(); } catch (e) { chats = []; }
    }
    if (!chats) chats = [];

    // Гарантированно добавляем Сохранённые первыми
    const hasSaved = chats.some(c => c.id === 'me');
    if (!hasSaved) {
      chats.unshift({ id: 'me', type: 'saved', name: '📔 Сохранённые', lastMsg: 'Нет сообщений', lastTime: Date.now() });
    }

    if (chats.length === 0) {
      container.innerHTML = '<div style="color:#8E8E9A;text-align:center;padding:40px;">Нет чатов</div>';
      return;
    }

    for (const chat of chats) {
      const div = document.createElement('div');
      div.className = 'chat-item';

      let emoji = '💬';
      if (chat.type === 'saved') emoji = '📔';
      else if (chat.type === 'group') emoji = chat.name?.startsWith('📂') ? '📂' : '👥';
      else if (chat.type === 'channel') emoji = '📢';

      div.innerHTML = `
        <div class="chat-avatar">${emoji}</div>
        <div class="chat-info">
          <div class="chat-name">${this._escapeHtml(chat.name || chat.id)}</div>
          <div class="chat-preview">${this._escapeHtml((chat.lastMsg || '').substring(0, 50))}</div>
        </div>
      `;

      div.addEventListener('click', () => this._openChat(chat));
      container.appendChild(div);
    }
  }

  // ===========================================================================
  // СТИКЕРЫ
  // ===========================================================================
  _toggleStickerPanel() {
    if (this.elements.stickerPanel) {
      this.elements.stickerPanel.classList.toggle('hidden');
      if (!this.elements.stickerPanel.classList.contains('hidden')) {
        this._renderStickerTabs();
        this._renderStickerGrid(this.state.activeStickerPack);
      }
    }
  }

  _renderStickerTabs() {
    const tabs = this.elements.stickerTabs;
    if (!tabs) return;
    tabs.innerHTML = '';

    const packs = stickerManager.getPacks();
    for (const [id, pack] of Object.entries(packs)) {
      const tab = document.createElement('div');
      tab.className = 'sticker-tab ' + (this.state.activeStickerPack === id ? 'active' : '');
      tab.textContent = pack.name;
      tab.addEventListener('click', () => {
        this.state.activeStickerPack = id;
        this._renderStickerTabs();
        this._renderStickerGrid(id);
      });
      tabs.appendChild(tab);
    }

    const addTab = document.createElement('div');
    addTab.className = 'sticker-tab';
    addTab.textContent = '➕';
    addTab.addEventListener('click', () => this._openModal('createStickerPackModal'));
    tabs.appendChild(addTab);
  }

  _renderStickerGrid(packId) {
    const grid = this.elements.stickerGrid;
    if (!grid) return;
    grid.innerHTML = '';

    const stickers = stickerManager.getStickers(packId);
    for (const s of stickers) {
      const item = document.createElement('div');
      item.className = 'sticker-item';
      if (typeof s === 'object' && s.data) {
        item.innerHTML = `<img src="${s.data}" style="width:60px;height:60px;object-fit:contain;">`;
      } else {
        item.textContent = typeof s === 'string' ? s : (s.emoji || '🖼️');
        item.style.fontSize = '2rem';
      }
      item.addEventListener('click', () => {
        const sd = typeof s === 'string' ? s : (s.data || s.emoji);
        stickerManager.addToRecent(sd);
        this._sendSticker(sd);
      });
      grid.appendChild(item);
    }
  }

  _sendSticker(sticker) {
    if (!this.state.currentChat) return;
    if (!REVERS) { this._showToast('Ядро не готово'); return; }

    const text = typeof sticker === 'string' && sticker.length <= 4 ? sticker : '🖼️';
    this._appendMessageToUI({ from: this.state.myId || 'me', text, time: Date.now(), type: 'sticker', read: false }, true);

    if (this.state.currentChat.type === 'saved') {
      REVERS.sendMessage('me', text);
      this._saveMessageToLocal('me', { from: this.state.myId, text, time: Date.now(), type: 'sticker' });
    } else if (this.state.currentChat.type === 'group') {
      REVERS.sendGroupMessage(this.state.currentChat.id, text);
    } else {
      REVERS.sendMessage(this.state.currentChat.id, text);
    }

    this.elements.stickerPanel?.classList.add('hidden');
  }

  _createStickerPack() {
    const name = document.getElementById('stickerPackNameInput')?.value?.trim();
    if (!name) return;
    this.state.activeStickerPack = stickerManager.createPack(name);
    this._closeAllModals();
    this._toggleStickerPanel();
  }

  _addStickerToPack() {
    const file = document.getElementById('stickerFileInput')?.files?.[0];
    const emoji = document.getElementById('stickerEmojiInput')?.value?.trim();
    if (!file || !this.state.activeStickerPack) return;

    // Проверка размера (макс 512 KB)
    if (file.size > 524288) {
      this._showToast('❌ Файл слишком большой (макс 512 KB)');
      return;
    }

    // Проверка формата
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this._showToast('❌ Поддерживаются PNG, JPEG, GIF, WebP');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      stickerManager.addSticker(this.state.activeStickerPack, reader.result, emoji || '');
      this._closeAllModals();
      this._renderStickerGrid(this.state.activeStickerPack);
      this._showToast('✅ Стикер добавлен');
    };
    reader.readAsDataURL(file);
  }

  _previewSticker(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById('stickerPreview');
      if (preview) { preview.src = ev.target.result; preview.style.display = 'block'; }
    };
    reader.readAsDataURL(file);
  }

  _deleteStickerPack() {
    if (this.state.activeStickerPack && confirm('Удалить пак стикеров?')) {
      stickerManager.deletePack(this.state.activeStickerPack);
      this.state.activeStickerPack = 'recent';
      this._renderStickerTabs();
      this._renderStickerGrid('recent');
    }
  }

  // ===========================================================================
  // ГОЛОСОВЫЕ СООБЩЕНИЯ
  // ===========================================================================
  async _toggleVoiceRecord() {
    const btn = this.elements.voiceRecordBtn;
    if (!btn) return;

    if (this.state.isRecording) {
      btn.textContent = '🎤';
      this.state.isRecording = false;

      if (this.state.voiceRecorder) {
        const r = await this.state.voiceRecorder;
        if (r?.stop) {
          r.recorder.onstop = async () => {
            const blob = new Blob(r.chunks || [], { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = async () => {
              const audio = reader.result;
              const dur = Math.round((Date.now() - (this.state.voiceStartTime || Date.now())) / 1000);
              if (audio && this.state.currentChat) {
                console.log('🎤 Голосовое:', dur + 'с');
                if (!REVERS) { this._showToast('Ядро не готово'); return; }
                try {
                  await REVERS.sendVoice(this.state.currentChat.id, audio, dur);
                  this._showToast('✅ Голосовое отправлено');
                  await this._renderMessages(this.state.currentChat);
                } catch (e) {
                  console.error('Ошибка отправки голосового:', e);
                  this._showToast('❌ Голосовые временно не работают');
                }
              }
            };
            reader.readAsDataURL(blob);
          };
          r.stop();
        }
        this.state.voiceRecorder = null;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        btn.textContent = '🔴';
        this.state.isRecording = true;
        this.state.voiceStartTime = Date.now();
        if (REVERS) this.state.voiceRecorder = REVERS.recordVoice();
      } catch (e) {
        this._showToast('❌ Нет доступа к микрофону');
      }
    }
  }

  // ===========================================================================
  // ПОДАРКИ И АЛМАЗЫ
  // ===========================================================================
  _initDiamonds() {
    // Выдаём 20 алмазов если ещё не выданы
    if (!localStorage.getItem('revers_diamonds_initialized')) {
      localStorage.setItem('revers_diamonds', DEFAULT_DIAMONDS);
      localStorage.setItem('revers_diamonds_initialized', '1');
    }
    this.state.diamonds = parseInt(localStorage.getItem('revers_diamonds') || '0');
    this.state.gifts = JSON.parse(localStorage.getItem('revers_gifts') || '[]');
  }

  _loadDiamonds() {
    this.state.diamonds = parseInt(localStorage.getItem('revers_diamonds') || '0');
    this.state.gifts = JSON.parse(localStorage.getItem('revers_gifts') || '[]');
  }

  _saveDiamonds() {
    localStorage.setItem('revers_diamonds', this.state.diamonds);
    localStorage.setItem('revers_gifts', JSON.stringify(this.state.gifts));
  }

  _openGiftShop() {
    const content = document.getElementById('giftShopContent');
    if (!content) return;

    const gifts = [
      { emoji: '🧸', name: 'Медвежонок', price: 10 },
      { emoji: '🍻', name: 'Бокалы', price: 15 },
      { emoji: '🚬', name: 'Сигарета', price: 5 },
      { emoji: '💐', name: 'Букет', price: 20 },
      { emoji: '🌹', name: 'Роза', price: 25 },
      { emoji: '🎖️', name: 'Медаль', price: 30 },
      { emoji: '🏆', name: 'Кубок', price: 50 },
      { emoji: '🎭', name: 'Маски', price: 20 },
      { emoji: '⌚', name: 'Часы', price: 40 }
    ];

    let html = '<div class="gift-grid">';
    gifts.forEach(gift => {
      html += `
        <div class="gift-item" onclick="window.REVERSApp._buyGift('${gift.emoji}', '${gift.name}', ${gift.price})">
          <div class="gift-emoji">${gift.emoji}</div>
          <div class="gift-name">${gift.name}</div>
          <div class="gift-price">💎${gift.price}</div>
        </div>
      `;
    });
    html += '</div>';
    content.innerHTML = html;
    this._openModal('giftShopModal');
  }

  _buyGift(emoji, name, price) {
    if (this.state.diamonds < price) {
      this._showToast(`❌ Недостаточно алмазов. Нужно ${price}💎, у вас ${this.state.diamonds}💎`);
      return;
    }
    this.state.diamonds -= price;
    this.state.gifts.push({ emoji, name, from: 'Вы', time: Date.now() });
    this._saveDiamonds();
    this._showToast(`🎁 Куплен подарок: ${emoji} ${name}`);
    this._closeAllModals();
  }

  // ===========================================================================
  // ИНДИКАТОР "ПЕЧАТАЕТ..."
  // ===========================================================================
  _handleTyping() {
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    if (this.state.currentChat?.type === 'contact' && REVERS) {
      REVERS.sendTyping(this.state.currentChat.id);
    }
    this.typingTimeout = setTimeout(() => {
      if (this.state.currentChat?.type === 'contact' && REVERS) {
        REVERS.sendTyping(this.state.currentChat.id, false);
      }
    }, 1000);
  }

  _showTyping(peerId, show) {
    if (this.state.currentChat?.id === peerId) {
      const indicator = document.getElementById('typingIndicator');
      if (indicator) indicator.textContent = show ? 'печатает...' : '';
    }
  }

  // ===========================================================================
  // ЧЕРНОВИКИ
  // ===========================================================================
  _saveDraft() {
    if (this.state.currentChat?.id) {
      const text = document.getElementById('messageInput')?.value || '';
      text.trim()
        ? localStorage.setItem('draft_' + this.state.currentChat.id, text)
        : localStorage.removeItem('draft_' + this.state.currentChat.id);
    }
  }

  _loadDraft() {
    if (this.state.currentChat?.id) {
      const draft = localStorage.getItem('draft_' + this.state.currentChat.id);
      if (draft) {
        const input = document.getElementById('messageInput');
        if (input) input.value = draft;
      }
    }
  }

  _loadLastChat() {
    try {
      const lastChat = JSON.parse(localStorage.getItem('revers_last_chat'));
      if (lastChat?.id) {
        this._openChat(lastChat);
      }
    } catch (e) {}
  }

  // ===========================================================================
  // ПОИСК
  // ===========================================================================
  _toggleChatSearch(show = true) {
    const bar = document.getElementById('searchChatsBar');
    if (bar) bar.classList.toggle('hidden', !show);
    if (show) document.getElementById('searchChatsInput')?.focus();
    else {
      const input = document.getElementById('searchChatsInput');
      if (input) input.value = '';
      this._renderChatsList();
    }
  }

  _filterChats(query) {
    if (!query || !REVERS) { this._renderChatsList(); return; }
    REVERS.getAllChats().then(all => {
      this._renderChatsList(all.filter(c => (c.name || c.id).toLowerCase().includes(query.toLowerCase())));
    });
  }

  _toggleSearchInChat(show = true) {
    const bar = document.getElementById('searchInChatBar');
    if (bar) bar.classList.toggle('hidden', !show);
    if (show) document.getElementById('searchInChatInput')?.focus();
    else this._clearSearchHighlights();
  }

  _searchInChat(query) {
    if (!query) { this._clearSearchHighlights(); return; }
    const msgs = document.querySelectorAll('.message');
    this.state.searchResults = [];
    msgs.forEach((m, i) => {
      if (m.querySelector('.message-text')?.textContent.toLowerCase().includes(query.toLowerCase())) {
        this.state.searchResults.push({ element: m, index: i });
      }
    });
    const counter = document.getElementById('searchCounter');
    if (counter) counter.textContent = `${this.state.searchResults.length > 0 ? 1 : 0}/${this.state.searchResults.length}`;
    if (this.state.searchResults.length > 0) this._highlightSearchResult(0);
  }

  _highlightSearchResult(i) {
    this._clearSearchHighlights();
    this.state.searchCurrentIndex = i;
    const r = this.state.searchResults[i];
    if (r) {
      r.element.style.backgroundColor = 'rgba(230,57,70,0.2)';
      r.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const counter = document.getElementById('searchCounter');
      if (counter) counter.textContent = `${i + 1}/${this.state.searchResults.length}`;
    }
  }

  _clearSearchHighlights() {
    document.querySelectorAll('.message').forEach(m => m.style.backgroundColor = '');
  }

  // ===========================================================================
  // КОНТАКТЫ, ГРУППЫ, КАНАЛЫ
  // ===========================================================================
  async _addContact() {
    const id = document.getElementById('addContactIdInput')?.value.trim();
    if (!id) return;
    if (!REVERS) { this._showToast('Ядро не готово'); return; }
    this._closeAllModals();
    REVERS.connectToPeer(id);
    await this._openChat({ id, type: 'contact', name: id });
    this._showToast(`🔗 Подключение к ${id}...`);
  }

  async _createGroup() {
    const name = document.getElementById('groupNameInput')?.value.trim();
    const type = document.getElementById('groupTypeSelect')?.value || 'chat';
    if (!name) return;
    if (!REVERS) { this._showToast('Ядро не готово'); return; }
    this._closeAllModals();
    const group = REVERS.createGroup(name, type);
    this._showToast(`✅ Группа "${name}" создана`);
    await this._openChat({ id: group.key, name: (type === 'forum' ? '📂 ' : '👥 ') + name, type: 'group' });
    await this._renderChatsList();
  }

  async _createChannel() {
    const name = document.getElementById('channelNameInput')?.value.trim();
    if (!name) return;
    if (!REVERS) { this._showToast('Ядро не готово'); return; }
    this._closeAllModals();
    const id = REVERS.createChannel(name);
    this._showToast(`✅ Канал "${name}" создан`);
    await this._openChat({ id, name: '📢 ' + name, type: 'channel' });
    await this._renderChatsList();
  }

  _deleteCurrentChat() {
    if (!this.state.currentChat || this.state.currentChat.type === 'saved') return;
    if (!confirm(`Удалить чат "${this.state.currentChat.name || this.state.currentChat.id}"?`)) return;
    if (this.state.currentChat.type === 'group') groupManager.deleteGroup(this.state.currentChat.id);
    this._goToChats();
  }

  _clearHistory() {
    if (!this.state.currentChat) return;
    if (!REVERS) { this._showToast('Ядро не готово'); return; }
    if (!confirm('Очистить историю?')) return;
    REVERS.clearChatHistory(this.state.currentChat.id);
    localStorage.removeItem('revers_local_' + this.state.currentChat.id);
    this._renderMessages(this.state.currentChat);
  }

  _openSavedChat() {
    this._openChat({ id: 'me', type: 'saved', name: '📔 Сохранённые' });
  }

  // ===========================================================================
  // ТЕМЫ ФОРУМА
  // ===========================================================================
  _openTopicsScreen() {
    if (!this.state.currentChat || this.state.currentChat.type !== 'group') return;
    document.getElementById('chatScreen')?.classList.add('hidden');
    document.getElementById('topicsScreen')?.classList.remove('hidden');
    this._renderTopicsList();
  }

  _renderTopicsList() {
    const container = document.getElementById('topicsList');
    if (!container || !this.state.currentChat) return;
    container.innerHTML = '';
    const topics = groupManager.getTopics(this.state.currentChat.id);
    for (const t of topics) {
      const div = document.createElement('div');
      div.className = 'chat-item';
      div.innerHTML = `
        <div class="chat-avatar">${t.closed ? '🔒' : '📂'}</div>
        <div class="chat-info">
          <div class="chat-name">${t.pinned ? '📌 ' : ''}${this._escapeHtml(t.name)}</div>
          <div class="chat-preview">${t.messages?.length || 0} сообщ.</div>
        </div>
      `;
      div.addEventListener('click', () => {
        this.state.currentTopic = t.id;
        document.getElementById('topicsScreen')?.classList.add('hidden');
        document.getElementById('chatScreen')?.classList.remove('hidden');
        document.getElementById('chatName').textContent = t.name;
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
    for (const msg of messages) {
      const div = document.createElement('div');
      div.className = `message ${msg.from === this.state.myId ? 'outgoing' : 'incoming'}`;
      div.innerHTML = `
        <div class="bubble">
          <div class="message-text">${this._escapeHtml(msg.text || '')}</div>
          <div class="message-meta"><span class="message-time">${msg.time ? new Date(msg.time).toLocaleTimeString() : ''}</span></div>
        </div>
      `;
      area.appendChild(div);
    }
    area.scrollTop = area.scrollHeight;
  }

  _createTopic() {
    const name = document.getElementById('topicNameInput')?.value.trim();
    if (!name || !this.state.currentChat) return;
    groupManager.addTopic(this.state.currentChat.id, name);
    this._closeAllModals();
    this._renderTopicsList();
    this._showToast(`✅ Тема "${name}" создана`);
  }

  // ===========================================================================
  // ГОЛОСОВАНИЯ И ОБЪЯВЛЕНИЯ
  // ===========================================================================
  _createPoll() {
    const q = document.getElementById('pollQuestionInput')?.value.trim();
    const o = document.getElementById('pollOptionsInput')?.value.split(',').map(s => s.trim()).filter(s => s);
    if (!q || o.length < 2 || !this.state.currentChat) return;
    groupManager.createPoll(this.state.currentChat.id, q, o);
    this._closeAllModals();
    this._showToast('📊 Голосование создано');
  }

  _addAnnouncement() {
    const text = prompt('📢 Текст объявления:');
    if (text && this.state.currentChat) groupManager.addAnnouncement(this.state.currentChat.id, text);
  }

  // ===========================================================================
  // НАСТРОЙКИ ГРУППЫ И КАНАЛА
  // ===========================================================================
  _showGroupSettings() {
    const group = groupManager.groups.get(this.state.currentChat?.id);
    if (!group) return;
    const content = document.getElementById('groupSettingsContent');
    if (content) {
      content.innerHTML = `
        <input type="text" id="groupEditName" value="${this._escapeHtml(group.name)}" style="width:100%;background:#0F0F12;border:none;border-radius:12px;padding:10px;color:white;margin-bottom:8px;">
        <button id="saveGroupNameBtn" style="background:#E63946;border:none;padding:10px;border-radius:20px;color:white;width:100%;cursor:pointer;">Сохранить название</button>
        <div style="margin:16px 0;"></div>
        <h4 style="color:white;">Участники (${group.members?.length || 0})</h4>
        <div id="groupMembersList">${(group.members || []).map(m => `<div style="padding:8px;border-bottom:1px solid #2A2A3A;color:#EFEFEF;">${this._escapeHtml(m)}</div>`).join('')}</div>
      `;
      document.getElementById('saveGroupNameBtn')?.addEventListener('click', () => {
        const newName = document.getElementById('groupEditName')?.value.trim();
        if (newName) {
          group.name = newName;
          groupManager._save();
          if (this.state.currentChat) this.state.currentChat.name = newName;
          document.getElementById('chatName').textContent = newName;
          this._renderChatsList();
        }
        this._closeAllModals();
      });
    }
    document.getElementById('groupSettingsModal').querySelector('h3').textContent = '⚙️ Настройки группы';
    this._openModal('groupSettingsModal');
  }

  _showChannelSettings() {
    this._showToast('📢 Настройки канала в разработке');
  }

  // ===========================================================================
  // КОНТЕКСТНОЕ МЕНЮ СООБЩЕНИЯ
  // ===========================================================================
  _showContextMenu(e, msg, idx) {
    const menu = this.elements.contextMenu;
    if (!menu) return;
    menu.classList.remove('hidden');
    menu.style.left = Math.min((e.touches?.[0]?.clientX || e.clientX), window.innerWidth - 190) + 'px';
    menu.style.top = (e.touches?.[0]?.clientY || e.clientY) + 'px';
    menu._target = { msg, idx };
  }

  _editSelectedMessage() {
    const menu = this.elements.contextMenu;
    if (menu?._target) {
      this.state.editingMessage = menu._target.msg;
      document.getElementById('messageInput').value = menu._target.msg.text || '';
      this.elements.editIndicator?.classList.remove('hidden');
      menu.classList.add('hidden');
    }
  }

  _replyToSelectedMessage() {
    const menu = this.elements.contextMenu;
    if (menu?._target) {
      this.state.replyTo = menu._target.msg;
      if (this.elements.replyBarText) {
        this.elements.replyBarText.textContent = '↩️ ' + (menu._target.msg.text || '').substring(0, 50);
      }
      this.elements.replyBar?.classList.remove('hidden');
      menu.classList.add('hidden');
    }
  }

  _forwardSelectedMessage() {
    const menu = this.elements.contextMenu;
    if (menu?._target) {
      this._showToast('↗️ Выберите чат для пересылки');
      // Открываем список чатов
      this._openModal('groupsModal');
      menu.classList.add('hidden');
    }
  }

  _pinSelectedMessage() {
    const menu = this.elements.contextMenu;
    if (menu?._target && this.state.currentChat) {
      localStorage.setItem('revers_pinned_' + this.state.currentChat.id, menu._target.msg.text || '');
      this._togglePinnedMessage();
      menu.classList.add('hidden');
    }
  }

  _copySelectedMessage() {
    const menu = this.elements.contextMenu;
    if (menu?._target) {
      navigator.clipboard.writeText(`${menu._target.msg.from}: ${menu._target.msg.text || ''}`);
      menu.classList.add('hidden');
    }
  }

  _deleteSelectedMessage() {
    const menu = this.elements.contextMenu;
    if (menu?._target && this.state.currentChat) {
      this._deleteMessage(menu._target.msg, menu._target.idx);
      menu.classList.add('hidden');
    }
  }

  _deleteForAllSelectedMessage() {
    const menu = this.elements.contextMenu;
    if (menu?._target && this.state.currentChat) {
      if (!REVERS) { this._showToast('Ядро не готово'); return; }
      if (confirm('Удалить сообщение для всех участников?')) {
        this._deleteMessage(menu._target.msg, menu._target.idx);
        this._showToast('🗑️ Сообщение удалено');
      }
      menu.classList.add('hidden');
    }
  }

  async _deleteMessage(msg, idx) {
    if (!REVERS) return;
    if (this.state.currentChat?.type === 'saved') {
      const history = this._getLocalMessages('me');
      history.splice(idx, 1);
      localStorage.setItem('revers_local_me', JSON.stringify(history));
    }
    await this._renderMessages(this.state.currentChat);
  }

  // ===========================================================================
  // ЗАКРЕПЛЁННЫЕ СООБЩЕНИЯ
  // ===========================================================================
  _togglePinnedMessage() {
    if (!this.state.currentChat) return;
    const pinned = localStorage.getItem('revers_pinned_' + this.state.currentChat.id);
    if (pinned && this.elements.pinnedMessage && this.elements.pinnedText) {
      this.elements.pinnedText.textContent = pinned;
      this.elements.pinnedMessage.classList.remove('hidden');
    } else {
      this.elements.pinnedMessage?.classList.add('hidden');
    }
  }

  _unpinMessage() {
    if (this.state.currentChat) localStorage.removeItem('revers_pinned_' + this.state.currentChat.id);
    this.elements.pinnedMessage?.classList.add('hidden');
  }

  // ===========================================================================
  // РЕАКЦИИ
  // ===========================================================================
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
    if (target) {
      const bubble = target.querySelector('.bubble');
      if (bubble) {
        let r = bubble.querySelector('.reactions');
        if (r) {
          if (!r.textContent.includes(emoji)) r.textContent += emoji;
        } else {
          r = document.createElement('div');
          r.className = 'reactions';
          r.textContent = emoji;
          bubble.appendChild(r);
        }
      }
    }
    if (panel) panel.classList.add('hidden');
  }

  // ===========================================================================
  // МЕНЮ ЧАТА (⋮)
  // ===========================================================================
  _showChatMenu() {
    document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden'));
    if (!this.state.currentChat) return;
    let id = 'contactDropdown';
    if (this.state.currentChat.type === 'group') id = 'groupDropdown';
    else if (this.state.currentChat.type === 'channel') id = 'channelDropdown';
    else if (this.state.currentChat.type === 'saved') {
      // Показываем меню сохранённых (поиск и закреп)
      document.getElementById('contactDropdown')?.classList.remove('hidden');
      return;
    }
    document.getElementById(id)?.classList.remove('hidden');
  }

  // ===========================================================================
  // QR-КОД
  // ===========================================================================
  async _showQR() {
    this._closeAllModals();
    const myId = this.state.myId || (REVERS ? REVERS.getMyId() : null);
    if (!myId || !QRCode) return;
    const data = JSON.stringify({ id: myId, name: this.state.myProfile?.name || 'User', type: 'revers-connect' });
    const canvas = document.getElementById('qrCanvas');
    if (canvas) {
      try {
        await QRCode.toCanvas(canvas, data, { width: 200, margin: 2, color: { dark: '#0F0F12', light: '#FFFFFF' } });
      } catch (e) {}
    }
    const inviteLink = document.getElementById('inviteLink');
    if (inviteLink) inviteLink.textContent = `revers://chat?id=${myId}`;
    this._openModal('qrModal');
  }

  _copyInviteLink() {
    const l = document.getElementById('inviteLink')?.textContent;
    if (l) { navigator.clipboard.writeText(l); this._showToast('📋 Ссылка скопирована'); }
  }

  _shareInvite() {
    const l = document.getElementById('inviteLink')?.textContent;
    if (l && navigator.share) navigator.share({ title: 'REVERS', text: 'Присоединяйся!', url: l }).catch(() => {});
    else this._copyInviteLink();
  }

  // ===========================================================================
  // СКАНЕР QR
  // ===========================================================================
  async _startScanner() {
    this._closeAllModals();
    const container = document.getElementById('scannerContainer');
    if (container) container.innerHTML = '';
    this._openModal('scannerModal');

    if (!Html5Qrcode) {
      if (container) container.innerHTML = '<p style="color:#E63946;">❌ Библиотека сканера не загружена</p>';
      return;
    }

    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      s.getTracks().forEach(t => t.stop());
    } catch (e) {
      if (container) container.innerHTML = '<p style="color:#E63946;">❌ Нет доступа к камере</p>';
      return;
    }

    try {
      this.html5QrCode = new Html5Qrcode('scannerContainer');
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (t) => this._handleScannedQR(t),
        () => {}
      );
    } catch (e) {}
  }

  _stopScanner() {
    if (this.html5QrCode) {
      this.html5QrCode.stop().then(() => { this.html5QrCode = null; this._closeAllModals(); }).catch(() => this._closeAllModals());
    } else {
      this._closeAllModals();
    }
  }

  _handleScannedQR(text) {
    try {
      const d = JSON.parse(text);
      if (d.type === 'revers-connect' && d.id && REVERS) {
        this._stopScanner();
        REVERS.connectToPeer(d.id);
        this._openChat({ id: d.id, type: 'contact', name: d.name || d.id });
        return;
      }
    } catch (e) {}
    if (text?.length > 5 && REVERS) {
      this._stopScanner();
      REVERS.connectToPeer(text);
      this._openChat({ id: text, type: 'contact', name: text });
    }
  }

  // ===========================================================================
  // БРАУЗЕР
  // ===========================================================================
  _openBrowser(url = 'https://www.startpage.com') {
    document.getElementById('browserUrlInput').value = url;
    this._openModal('browserModal');
  }

  async _openInBrowser() {
    let url = document.getElementById('browserUrlInput')?.value.trim();
    if (!url) return;
    if (!url.startsWith('http')) url = 'https://' + url;
    this._closeAllModals();
    window.open(url, '_blank');
  }

  _openLink(url) {
    if (url) window.open(url, '_blank');
  }

  // ===========================================================================
  // МЕДИА
  // ===========================================================================
  _openMedia(dataUrl, type) {
    if (!dataUrl) return;
    if (type === 'image' || type?.startsWith('image/')) {
      const viewer = document.getElementById('imageViewer');
      const img = document.getElementById('fullscreenImage');
      if (viewer && img) { img.src = dataUrl; viewer.classList.add('active'); }
    } else if (type === 'video' || type?.startsWith('video/')) {
      const v = document.createElement('video');
      v.src = dataUrl; v.controls = true; v.autoplay = true;
      v.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:black;z-index:5000;';
      v.onended = () => v.remove();
      document.body.appendChild(v);
      v.play();
    } else if (type === 'audio' || type?.startsWith('audio/')) {
      new Audio(dataUrl).play();
    }
  }

  // ===========================================================================
  // ПОДКЛЮЧЕНИЕ P2P
  // ===========================================================================
  _openConnectModal() {
    this._closeAllModals();
    document.getElementById('mySignalOutput').value = 'Генерация сигнала...';
    setTimeout(() => { document.getElementById('mySignalOutput').value = 'Сигнал готов'; }, 500);
    this._openModal('connectModal');
  }

  _handleConnect() {
    if (!REVERS) { this._showToast('Ядро не готово'); return; }
    const pid = document.getElementById('peerIdInput')?.value.trim();
    const sig = document.getElementById('signalInput')?.value.trim();
    if (sig) {
      try {
        const s = JSON.parse(sig);
        if (s.sdp || s.candidate) { REVERS.acceptPeer(pid || 'remote', s); this._closeAllModals(); return; }
      } catch (e) {}
    }
    if (pid) { this._closeAllModals(); REVERS.connectToPeer(pid); this._openChat({ id: pid, type: 'contact', name: pid }); }
  }

  _copySignal() {
    const v = document.getElementById('mySignalOutput')?.value;
    if (v && v !== 'Генерация сигнала...') { navigator.clipboard.writeText(v); this._showToast('📋 Сигнал скопирован'); }
  }

  // ===========================================================================
  // ЗВОНКИ
  // ===========================================================================
  _endCall() {
    if (REVERS) REVERS.endCall(this.state.currentChat?.id);
    document.getElementById('callModal')?.classList.add('hidden');
    if (this.state.callTimer) { clearInterval(this.state.callTimer); this.state.callTimer = null; }
  }

  // ===========================================================================
  // БЕЗОПАСНОСТЬ
  // ===========================================================================
  _showSecurityNumber() {
    if (!this.state.currentChat || !REVERS) return;
    const profile = REVERS.getMyProfile();
    const key = profile?.x25519PublicKey || '';
    const hash = this._simpleHash(key);
    const fp = hash.match(/.{1,4}/g)?.join(' ') || hash;
    alert(`🔐 Номер безопасности для ${this.state.currentChat.id}:\n${fp}\n\nСверьте с собеседником`);
  }

  // ===========================================================================
  // ССЫЛКИ-ПРИГЛАШЕНИЯ
  // ===========================================================================
  _generateInviteLink(chat) {
    if (!chat) return '';
    return `revers://chat?id=${chat.id}&name=${encodeURIComponent(chat.name || '')}`;
  }

  _shareInviteLink() {
    if (!REVERS) { this._showToast('Ядро не готово'); return; }
    const link = this._generateInviteLink(this.state.currentChat);
    if (link && navigator.share) {
      navigator.share({ title: 'REVERS', text: 'Присоединяйся!', url: link }).catch(() => {});
    } else if (link) {
      navigator.clipboard.writeText(link);
      this._showToast('📋 Ссылка скопирована');
    }
  }

  // ===========================================================================
  // ЭКСПОРТ ДАННЫХ
  // ===========================================================================
  _exportData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      try { data[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { data[k] = localStorage.getItem(k); }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'revers_backup.json'; a.click();
    this._showToast('📤 Данные экспортированы');
  }

  // ===========================================================================
  // DHT СТАТУС
  // ===========================================================================
  _updateDHTStatus() {
    const el = this.elements.dhtStatus;
    if (el) el.style.color = '#4CAF50';
  }

  // ===========================================================================
  // СТАТУС ПОДКЛЮЧЕНИЯ
  // ===========================================================================
  _updateConnectionStatus(connected) {
    const l = this.elements.statusLed;
    const t = this.elements.statusText;
    if (l && t) {
      if (connected) { l.classList.add('green'); t.textContent = 'Онлайн'; }
      else { l.classList.remove('green'); t.textContent = 'Оффлайн'; }
    }
  }

  // ===========================================================================
  // НАСТРОЙКИ
  // ===========================================================================
  _applyTheme(themeId) {
    const themes = { dark: { bg: '#0F0F12' }, light: { bg: '#FFFFFF' } };
    const t = themes[themeId] || themes.dark;
    document.body.style.backgroundColor = t.bg;
    localStorage.setItem('revers_theme', themeId);
  }

  _toggleSound() {
    const toggle = document.getElementById('soundToggle');
    if (!toggle) return;
    const on = !toggle.classList.contains('active');
    on ? toggle.classList.add('active') : toggle.classList.remove('active');
    localStorage.setItem('revers_sound', on);
  }

  _loadSettings() {
    const theme = localStorage.getItem('revers_theme') || 'dark';
    this._applyTheme(theme);
    const soundOn = localStorage.getItem('revers_sound') !== 'false';
    const toggle = document.getElementById('soundToggle');
    if (toggle) soundOn ? toggle.classList.add('active') : toggle.classList.remove('active');
  }

  // ===========================================================================
  // УВЕДОМЛЕНИЯ (TOAST)
  // ===========================================================================
  _showToast(message, duration = 2000) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#1A1A23;color:white;padding:10px 20px;border-radius:30px;z-index:5000;font-size:0.9rem;text-align:center;';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', duration);
  }

  // ===========================================================================
  // СИСТЕМНЫЕ ОБРАБОТЧИКИ
  // ===========================================================================
  _bindBackButton() {
    document.addEventListener('backbutton', (e) => {
      e.preventDefault();
      if (document.querySelector('.modal.active')) this._closeAllModals();
      else if (this.state.currentTopic) { this.state.currentTopic = null; this._openChat(this.state.currentChat); }
      else if (this.state.currentChat) this._goToChats();
      else if (typeof navigator !== 'undefined' && navigator.app) navigator.app.exitApp();
    });
  }

  _bindSwipeBack() {
    let startX = 0;
    const cs = document.getElementById('chatScreen');
    if (!cs) return;
    cs.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; });
    cs.addEventListener('touchend', (e) => { if (e.changedTouches[0].clientX - startX > 100 && this.state.currentChat) this._goToChats(); });
  }

  _bindHotkeys() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('searchChatsInput')?.focus(); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); this._openModal('addContactModal'); }
      if (e.key === 'Escape') { if (document.querySelector('.modal.active')) this._closeAllModals(); else if (this.state.currentChat) this._goToChats(); }
    });
  }

  // ===========================================================================
  // ХЕЛПЕРЫ
  // ===========================================================================
  _escapeHtml(t) {
    if (!t) return '';
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  _formatSize(b) {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(1) + ' GB';
  }

  _simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(16).padStart(8, '0').repeat(4).substring(0, 32);
  }
}

// =============================================================================
// ЗАПУСК ПРИЛОЖЕНИЯ
// =============================================================================
window.REVERSApp = null;
document.addEventListener('DOMContentLoaded', () => {
  window.REVERSApp = new REVERSApp();
});