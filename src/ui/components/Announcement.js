// SPDX-License-Identifier: GPL-3.0-or-later
// src/ui/components/Announcement.js — компонент объявления
import { escapeHtml, formatTime } from '../../utils/formatters.js';
import { createElement } from '../../utils/dom.js';

export class Announcement {
  constructor(announcement, eventBus, groupKey) {
    this.announcement = announcement;
    this.eventBus = eventBus;
    this.groupKey = groupKey;
  }

  render() {
    const container = createElement('div', { className: 'announcement' });
    
    const bubble = createElement('div', { className: 'bubble' });
    
    // Текст объявления
    bubble.appendChild(
      createElement('span', {
        html: `<b>📌 Объявление:</b> ${escapeHtml(this.announcement.text)}`
      })
    );

    // Время
    if (this.announcement.time) {
      bubble.appendChild(
        createElement('div', {
          style: 'font-size:0.65rem;margin-top:4px;opacity:0.7;',
          html: formatTime(this.announcement.time)
        })
      );
    }

    // Кнопка удаления (для админов/модераторов)
    if (this._canDelete()) {
      const deleteBtn = createElement('button', {
        style: 'background:none;border:none;color:white;cursor:pointer;margin-left:8px;font-size:0.8rem;opacity:0.6;',
        html: '✖',
        onClick: (e) => {
          e.stopPropagation();
          this.eventBus.emit('removeAnnouncement', {
            groupKey: this.groupKey,
            announcementId: this.announcement.id
          });
        }
      });
      bubble.appendChild(deleteBtn);
    }

    container.appendChild(bubble);
    return container;
  }

  _canDelete() {
    // Проверяем права через eventBus
    let canDelete = false;
    this.eventBus.emit('checkPermission', {
      groupKey: this.groupKey,
      permission: 'deleteMessages',
      callback: (result) => { canDelete = result; }
    });
    return canDelete;
  }
}
