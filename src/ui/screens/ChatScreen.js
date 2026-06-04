// src/ui/screens/ChatScreen.js — экран чата
import { MessageBubble } from '../components/MessageBubble.js';
import { CONNECTION_ICONS, UI } from '../../utils/constants.js';
import { createElement, clearElement, $, scrollToBottom } from '../../utils/dom.js';
import { getRaw } from '../../utils/storage.js';

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
    this.unsubscribers = [];
  }

  render(chat) {
    this.currentChat = chat;
    this._currentTopic = null;
    this.replyTo = null;
    this._editingMessage = null;

    this.container?.classList.remove('hidden');
    $('#chatName').textContent = chat.name;

    const draft = getRaw(UI.DRAFT_PREFIX + chat.id);
    const input = $('#messageInput');
    if (input) input.value = draft || '';

    this._updateConnectionIcon();
    this._loadHistory();
    this._bindEvents();
  }

  _bindEvents() {
    this.unsubscribers.push(
      this.eventBus.on('newMessage', (msg) => {
        if (msg.room === this.currentChat?.id || msg.from === this.currentChat?.id) {
          this._appendMessage(msg);
        }
      }),
      this.eventBus.on('peerConnection', (event) => {
        if (event.peerId === this.currentChat?.id) this._updateConnectionIcon();
      }),
      this.eventBus.on('messageSent', () => this._loadHistory()),
      this.eventBus.on('getCurrentChat', () => {
        this.eventBus.emit('currentChat', this.currentChat);
      })
    );
  }

  async _loadHistory() {
    const area = $('#messagesArea');
    if (!area) return;
    clearElement(area);

    this.eventBus.once('chatHistory', ({ history }) => {
      if (!history?.length) return;

      history.forEach((msg, idx) => {
        const isOutgoing = msg.from === this._getMyId();
        const bubble = new MessageBubble(msg, isOutgoing, this.replyTo);
        const wrapper = createElement('div', {
          className: `message ${isOutgoing ? 'outgoing' : 'incoming'}`,
          dataset: { msgIdx: idx }
        });
        wrapper.appendChild(bubble.render());
        area.appendChild(wrapper);
      });

      scrollToBottom(area);
    });

    const peerId = this.currentChat?.type === 'saved' ? 'me' : this.currentChat?.id;
    if (peerId) this.eventBus.emit('getChatHistory', { peerId });
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
    const text = $('#messageInput')?.value || '';
    if (this.currentChat?.id) {
      this.eventBus.emit('saveDraft', { chatId: this.currentChat.id, text });
    }
    this.container?.classList.add('hidden');
  }

  destroy() {
    this.hide();
    this.unsubscribers.forEach(u => u());
    this.unsubscribers = [];
  }
  }
