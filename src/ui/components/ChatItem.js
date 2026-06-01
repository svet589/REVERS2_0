// src/ui/components/ChatItem.js — компонент элемента списка чатов
import { formatTime, escapeHtml, truncateText } from '../../utils/formatters.js';
import { createElement } from '../../utils/dom.js';

const AVATAR_EMOJI = {
  saved: '📔',
  group: '👥',
  forum: '📂',
  channel: '📢',
  contact: '💬'
};

export class ChatItem {
  constructor(chat, eventBus) {
    this.chat = chat;
    this.eventBus = eventBus;
  }

  render() {
    const emoji = this._getEmoji();
    const lastMsg = this.chat.lastMsg || '';
    const lastTime = this.chat.lastTime ? formatTime(this.chat.lastTime) : '';

    const item = createElement('div', { className: 'chat-item' });

    // Аватар
    const avatar = createElement('div', { className: 'chat-avatar', html: emoji });
    if (this.chat.avatar) {
      avatar.innerHTML = `<img src="${this.chat.avatar}" style="width:100%;height:100%;object-fit:cover;">`;
    }

    // Инфо
    const info = createElement('div', { className: 'chat-info' });
    const name = createElement('div', { className: 'chat-name', html: escapeHtml(this.chat.name) });
    const preview = createElement('div', {
      className: 'chat-preview',
      html: escapeHtml(truncateText(lastMsg, 40))
    });

    info.appendChild(name);
    info.appendChild(preview);

    // Время
    const time = createElement('div', { className: 'chat-time', html: lastTime });

    // Бейджи
    const badges = createElement('div', { style: 'display:flex;flex-direction:column;gap:4px;align-items:flex-end;' });
    badges.appendChild(time);

    if (this.chat.unread > 0) {
      badges.appendChild(
        createElement('div', { className: 'unread-badge', html: String(this.chat.unread) })
      );
    }

    if (this.chat.draft) {
      badges.appendChild(
        createElement('span', {
          className: 'draft-indicator',
          html: '✏️',
          style: 'font-size:0.7rem;color:#E63946;'
        })
      );
    }

    item.appendChild(avatar);
    item.appendChild(info);
    item.appendChild(badges);

    // Клик — открыть чат
    item.addEventListener('click', () => {
      this.eventBus.emit('navigate:chat', this.chat);
    });

    // Долгий тап — контекстное меню
    let pressTimer;
    item.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => {
        this.eventBus.emit('chatContextMenu', { chat: this.chat, element: item });
      }, 500);
    });
    item.addEventListener('touchend', () => clearTimeout(pressTimer));
    item.addEventListener('touchmove', () => clearTimeout(pressTimer));

    return item;
  }

  _getEmoji() {
    if (this.chat.type === 'saved') return AVATAR_EMOJI.saved;
    if (this.chat.type === 'group') {
      return this.chat.name?.startsWith('📂') ? AVATAR_EMOJI.forum : AVATAR_EMOJI.group;
    }
    if (this.chat.type === 'channel') return AVATAR_EMOJI.channel;
    return AVATAR_EMOJI.contact;
  }
      }
