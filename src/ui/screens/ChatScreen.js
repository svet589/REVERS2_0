// src/ui/screens/ChatScreen.js — экран чата
import { MessageBubble } from '../components/MessageBubble.js';
import { StickerPanel } from '../components/StickerPanel.js';
import { CONNECTION_ICONS, UI } from '../../utils/constants.js';
import { createElement, clearElement, $, scrollToBottom } from '../../utils/dom.js';
import { getRaw } from '../../utils/storage.js';
import { escapeHtml } from '../../utils/formatters.js';

export class ChatScreen {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.container = $('#chatScreen');
    this.currentChat = null;
    this._currentTopic = null;
    this.replyTo = null;
    this._editingMessage = null;
    this.isRecording = false;
    this.voiceStartTime = null;
    this.voiceRecorder = null;
    this.typingTimeout = null;
    this.stickerPanel = new StickerPanel(eventBus);
    this.unsubscribers = [];
  }

  render(chat) {
    this.currentChat = chat;
    this._currentTopic = null;
    this.replyTo = null;
    this._editingMessage = null;

    this.container?.classList.remove('hidden');
    $('#chatName').textContent = chat.name;

    // Загружаем черновик
    const draft = getRaw(UI.DRAFT_PREFIX + chat.id);
    const input = $('#messageInput');
    if (input) input.value = draft || '';

    this._updateConnectionIcon();
    this._loadHistory();
    this._bindEvents();
  }

  _bindEvents() {
    // Отправка
    $('#sendBtn')?.addEventListener('click', () => this._sendMessage());
    $('#messageInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._sendMessage();
    });
    $('#messageInput')?.addEventListener('input', () => this._handleTyping());
    $('#messageInput')?.addEventListener('blur', () => this._saveDraft());

    // Файлы
    $('#fileInput')?.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        this.eventBus.emit('sendFile', { peerId: this._getPeerId(), file: e.target.files[0] });
        e.target.value = '';
      }
    });

    // Голосовые
    $('#voiceRecordBtn')?.addEventListener('click', () => this._toggleVoiceRecord());

    // Стикеры
    $('#stickerToggleBtn')?.addEventListener('click', () => this.stickerPanel.toggle());

    // Ответ
    $('#replyBarClose')?.addEventListener('click', () => {
      this.replyTo = null;
      $('#replyBar')?.classList.add('hidden');
    });

    // Меню чата
    $('#chatMenuBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._showChatMenu();
    });

    // Клик вне меню — закрыть
    document.addEventListener('click', () => {
      document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden'));
    });

    // Кнопка назад
    $('#backBtn')?.addEventListener('click', () => this._goBack());

    // События EventBus
    this.unsubscribers.push(
      this.eventBus.on('newMessage', (msg) => {
        if (msg.room === this.currentChat?.id || msg.from === this.currentChat?.id) {
          this._appendMessage(msg);
        }
      }),
      this.eventBus.on('stickerSent', ({ sticker }) => {
        this._sendStickerMessage(sticker);
      }),
      this.eventBus.on('peerConnection', (event) => {
        if (event.peerId === this.currentChat?.id) {
          this._updateConnectionIcon();
        }
      }),
      this.eventBus.on('messageSent', ({ peerId }) => {
        if (peerId === this.currentChat?.id) {
          this._loadHistory();
        }
      })
    );
  }

  async _loadHistory() {
    const area = $('#messagesArea');
    if (!area) return;

    clearElement(area);

    // Объявления и голосования для групп
    if (this.currentChat?.type === 'group') {
      this.eventBus.emit('getAnnouncements', { groupKey: this.currentChat.id });
      this.eventBus.emit('getPolls', { groupKey: this.currentChat.id });
    }

    // История сообщений
    this.eventBus.once('chatHistory', ({ history }) => {
      if (!history || history.length === 0) return;

      history.forEach(msg => {
        const isOutgoing = msg.from === this._getMyId();
        const bubble = new MessageBubble(msg, isOutgoing, this.replyTo);
        const wrapper = createElement('div', {
          className: `message ${isOutgoing ? 'outgoing' : 'incoming'}`,
          dataset: { msgIdx: history.indexOf(msg) }
        });

        wrapper.appendChild(bubble.render());

        // Контекстное меню
        wrapper.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this._showContextMenu(e, msg, history.indexOf(msg));
        });

        // Реакции
        let timer;
        wrapper.addEventListener('touchstart', () => {
          timer = setTimeout(() => this._showReactions(wrapper), 500);
        });
        wrapper.addEventListener('touchend', () => clearTimeout(timer));
        wrapper.addEventListener('touchmove', () => clearTimeout(timer));

        area.appendChild(wrapper);
      });

      scrollToBottom(area);
    });

    this.eventBus.emit('getChatHistory', { peerId: this._getPeerId() });
  }

  _appendMessage(msg) {
    const area = $('#messagesArea');
    if (!area) return;

    const isOutgoing = msg.from === this._getMyId();
    const bubble = new MessageBubble(msg, isOutgoing);
    const wrapper = createElement('div', {
      className: `message ${isOutgoing ? 'outgoing' : 'incoming'}`
    });
    wrapper.appendChild(bubble.render());
    area.appendChild(wrapper);
    scrollToBottom(area);
  }

  _sendMessage() {
    const input = $('#messageInput');
    const text = input?.value?.trim();
    if (!text || !this.currentChat) return;

    // Анимация
    input.style.transform = 'scale(0.98)';
    setTimeout(() => input.style.transform = '', 100);

    if (this._editingMessage) {
      this._editingMessage.text = text;
      this._editingMessage.edited = true;
      this._editingMessage = null;
      $('#editIndicator')?.classList.add('hidden');
      this._loadHistory();
    } else if (this.currentChat.type === 'group') {
      this.eventBus.emit('sendGroupMessage', { groupKey: this.currentChat.id, text });
    } else if (this.currentChat.type === 'channel') {
      this.eventBus.emit('sendChannelMessage', { channelKey: this.currentChat.id, text });
    } else {
      const peerId = this.currentChat.type === 'saved' ? 'me' : this.currentChat.id;
      this.eventBus.emit('sendMessage', { peerId, text });
    }

    input.value = '';
    this.replyTo = null;
    $('#replyBar')?.classList.add('hidden');
    this._saveDraft();
  }

  _sendStickerMessage(sticker) {
    const text = typeof sticker === 'string' ? sticker : '🖼️';
    const peerId = this.currentChat?.type === 'saved' ? 'me' : this.currentChat?.id;
    if (this.currentChat?.type === 'group') {
      this.eventBus.emit('sendGroupMessage', { groupKey: this.currentChat.id, text });
    } else {
      this.eventBus.emit('sendMessage', { peerId, text });
    }
  }

  _handleTyping() {
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    if (this.currentChat?.type === 'contact') {
      this.eventBus.emit('sendTyping', { peerId: this.currentChat.id });
    }
    this.typingTimeout = setTimeout(() => {}, 1000);
  }

  async _toggleVoiceRecord() {
    const btn = $('#voiceRecordBtn');
    if (this.isRecording) {
      btn.textContent = '🎤';
      this.isRecording = false;
      if (this.voiceRecorder) {
        const recorder = await this.voiceRecorder;
        if (recorder?.stop) {
          const audio = await new Promise(resolve => {
            recorder.recorder.onstop = () => {
              setTimeout(() => {
                const blob = new Blob(recorder.chunks || [], { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              }, 100);
            };
            recorder.stop();
          });
          if (audio && this.currentChat) {
            const dur = Math.round((Date.now() - this.voiceStartTime) / 1000);
            const peerId = this.currentChat.type === 'saved' ? 'me' : this.currentChat.id;
            this.eventBus.emit('sendVoice', { peerId, audioBase64: audio, duration: dur || 1 });
          }
        }
        this.voiceRecorder = null;
      }
    } else {
      btn.textContent = '🔴';
      this.isRecording = true;
      this.voiceStartTime = Date.now();
      this.eventBus.emit('startRecording');
      this.eventBus.once('recordingStarted', (recorder) => {
        this.voiceRecorder = recorder;
      });
    }
  }

  _showChatMenu() {
    document.querySelectorAll('.chat-dropdown').forEach(d => d.classList.add('hidden'));
    if (!this.currentChat) return;

    const type = this.currentChat.type;
    const id = type === 'saved' ? 'savedDropdown' :
               type === 'group' ? 'groupDropdown' :
               type === 'channel' ? 'channelDropdown' : 'contactDropdown';
    $(`#${id}`)?.classList.remove('hidden');
  }

  _showContextMenu(e, msg, idx) {
    e.preventDefault();
    e.stopPropagation();
    const menu = $('#contextMenu');
    if (!menu) return;

    menu.classList.remove('hidden');
    menu.style.left = Math.min(e.clientX || e.touches?.[0]?.clientX, innerWidth - 190) + 'px';
    menu.style.top = (e.clientY || e.touches?.[0]?.clientY) + 'px';
    menu._target = { msg, idx };
  }

  _showReactions(target) {
    this.eventBus.emit('showReactions', { target });
  }

  _goBack() {
    if (this._currentTopic) {
      this._currentTopic = null;
      this.eventBus.emit('navigate:topics', { groupId: this.currentChat?.id });
    } else {
      this._saveDraft();
      this.eventBus.emit('navigate:chats');
    }
  }

  _saveDraft() {
    if (!this.currentChat?.id) return;
    const text = $('#messageInput')?.value || '';
    this.eventBus.emit('saveDraft', { chatId: this.currentChat.id, text });
  }

  _updateConnectionIcon() {
    const icon = $('#connectionIcon');
    if (!icon || !this.currentChat) return;

    this.eventBus.once('connectionStatus', ({ peerId, connected, relayCount }) => {
      if (peerId === this.currentChat.id) {
        if (connected && relayCount >= 3) icon.textContent = CONNECTION_ICONS.relay3;
        else if (connected && relayCount === 2) icon.textContent = CONNECTION_ICONS.relay2;
        else if (connected) icon.textContent = CONNECTION_ICONS.direct;
        else icon.textContent = CONNECTION_ICONS.offline;
      }
    });
    this.eventBus.emit('checkConnection', { peerId: this.currentChat.id });
  }

  _getPeerId() {
    if (!this.currentChat) return 'me';
    return this.currentChat.type === 'saved' ? 'me' : this.currentChat.id;
  }

  _getMyId() {
    try {
      return JSON.parse(localStorage.getItem('revers_id') || '""');
    } catch(e) {
      return '';
    }
  }

  show() {
    this.container?.classList.remove('hidden');
  }

  hide() {
    this._saveDraft();
    this.container?.classList.add('hidden');
  }

  destroy() {
    this.hide();
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}
