// src/ui/modals/GroupModal.js — модалка создания/управления группами
import { createElement, clearElement, $ } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/formatters.js';

export class GroupModal {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.unsubscribers = [];
  }

  render() {
    // Создание группы
    this.eventBus.on('openModal', (modalId) => {
      if (modalId === 'createGroupModal') this._showCreateGroup();
      if (modalId === 'groupsModal') this._showGroupsList();
    });
  }

  _showCreateGroup() {
    const modal = $('#createGroupModal');
    if (!modal) return;
    modal.classList.add('active');

    $('#confirmGroupBtn')?.addEventListener('click', () => {
      const name = $('#groupNameInput')?.value?.trim();
      const type = $('#groupTypeSelect')?.value || 'chat';
      if (name) {
        this.eventBus.emit('createGroup', { name, type });
        modal.classList.remove('active');
        $('#groupNameInput').value = '';
      }
    }, { once: true });
  }

  _showGroupsList() {
    const modal = $('#groupsModal');
    if (!modal) return;
    modal.classList.add('active');

    const list = $('#groupsList');
    if (!list) return;
    clearElement(list);

    this.eventBus.once('allChats', (chats) => {
      const groups = chats.filter(c => c.type === 'group');
      if (!groups.length) {
        list.innerHTML = '<p style="color:#8E8E9A;text-align:center;">Нет групп</p>';
        return;
      }

      groups.forEach(g => {
        const item = createElement('div', {
          style: 'background:#2A2A3A;border-radius:16px;padding:12px;margin:8px 0;display:flex;justify-content:space-between;align-items:center;'
        });
        item.innerHTML = `<strong style="color:white">${escapeHtml(g.name)}</strong>`;
        
        const btn = createElement('button', {
          html: 'Открыть',
          style: 'background:#E63946;border:none;padding:6px 12px;border-radius:20px;color:white;cursor:pointer;',
          onClick: () => {
            modal.classList.remove('active');
            this.eventBus.emit('navigate:chat', g);
          }
        });
        
        item.appendChild(btn);
        list.appendChild(item);
      });
    });

    this.eventBus.emit('getAllChats');
  }

  destroy() {
    this.unsubscribers.forEach(u => u());
  }
}
