// src/ui/screens/TopicsScreen.js — экран тем форума
import { escapeHtml } from '../../utils/formatters.js';
import { createElement, clearElement, $ } from '../../utils/dom.js';

export class TopicsScreen {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.container = $('#topicsScreen');
    this.currentGroup = null;
    this.unsubscribers = [];
  }

  render(group) {
    this.currentGroup = group;
    this.container?.classList.remove('hidden');
    
    // Заголовок
    const nameEl = this.container?.querySelector('.current-chat-name');
    if (nameEl) nameEl.textContent = group.name || 'Темы';

    this._loadTopics();
    this._bindEvents();
  }

  _bindEvents() {
    $('#topicsBackBtn')?.addEventListener('click', () => {
      this.eventBus.emit('navigate:chat', { id: this.currentGroup?.id, type: 'group', name: this.currentGroup?.name });
    });

    $('#addTopicBtn')?.addEventListener('click', () => {
      this.eventBus.emit('openModal', 'createTopicModal');
    });

    this.unsubscribers.push(
      this.eventBus.on('topicAdded', ({ groupKey }) => {
        if (groupKey === this.currentGroup?.id) this._loadTopics();
      }),
      this.eventBus.on('topicRemoved', ({ groupKey }) => {
        if (groupKey === this.currentGroup?.id) this._loadTopics();
      }),
      this.eventBus.on('topicUpdated', ({ groupKey }) => {
        if (groupKey === this.currentGroup?.id) this._loadTopics();
      })
    );
  }

  _loadTopics() {
    if (!this.currentGroup?.id) return;

    const list = $('#topicsList');
    if (!list) return;
    clearElement(list);

    this.eventBus.once('topicsLoaded', ({ topics }) => {
      if (!topics || topics.length === 0) {
        list.appendChild(
          createElement('p', {
            style: 'color:#8E8E9A;text-align:center;padding:20px;',
            html: 'Нет тем'
          })
        );
        return;
      }

      topics.forEach(topic => {
        const item = this._renderTopicItem(topic);
        list.appendChild(item);
      });
    });

    this.eventBus.emit('getTopics', { groupKey: this.currentGroup.id });
  }

  _renderTopicItem(topic) {
    const item = createElement('div', { className: 'chat-item' });

    // Иконка
    const icon = createElement('div', {
      className: 'chat-avatar',
      html: topic.closed ? '🔒' : '📂'
    });

    // Инфо
    const info = createElement('div', { className: 'chat-info' });
    const name = createElement('div', {
      className: 'chat-name',
      html: `${topic.pinned ? '📌 ' : ''}${escapeHtml(topic.name)}`
    });
    const meta = createElement('div', {
      className: 'chat-preview',
      html: `${topic.messages?.length || 0} сообщ.`
    });

    info.appendChild(name);
    info.appendChild(meta);

    item.appendChild(icon);
    item.appendChild(info);

    // Клик — открыть тему
    item.addEventListener('click', () => {
      this.eventBus.emit('navigate:topic', {
        groupId: this.currentGroup.id,
        topicId: topic.id,
        topicName: topic.name
      });
    });

    // Долгий тап — управление
    let timer;
    item.addEventListener('touchstart', () => {
      timer = setTimeout(() => this._showTopicMenu(topic), 500);
    });
    item.addEventListener('touchend', () => clearTimeout(timer));
    item.addEventListener('touchmove', () => clearTimeout(timer));

    return item;
  }

  _showTopicMenu(topic) {
    const actions = [
      topic.closed ? '🔓 Открыть тему' : '🔒 Закрыть тему',
      topic.pinned ? '📌 Открепить' : '📌 Закрепить',
      '✏️ Переименовать',
      '🗑️ Удалить тему'
    ];
    
    const choice = prompt('Действие:\n1. ' + actions.join('\n2. '));
    if (!choice) return;

    const idx = parseInt(choice) - 1;
    if (idx === 0) {
      this.eventBus.emit('toggleCloseTopic', { groupKey: this.currentGroup.id, topicId: topic.id });
    } else if (idx === 1) {
      this.eventBus.emit('togglePinTopic', { groupKey: this.currentGroup.id, topicId: topic.id });
    } else if (idx === 2) {
      const newName = prompt('Новое название:', topic.name);
      if (newName) {
        topic.name = newName;
        this._loadTopics();
      }
    } else if (idx === 3 && confirm('Удалить тему навсегда?')) {
      this.eventBus.emit('removeTopic', { groupKey: this.currentGroup.id, topicId: topic.id });
    }
  }

  show() {
    this.container?.classList.remove('hidden');
  }

  hide() {
    this.container?.classList.add('hidden');
  }

  destroy() {
    this.hide();
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}
