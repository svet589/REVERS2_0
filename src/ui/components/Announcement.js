/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of REVERS Messenger.
 *
 * REVERS Messenger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * REVERS Messenger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with REVERS Messenger. If not, see <https://www.gnu.org/licenses/>.
 *
 * Copyright (C) 2025 svet589 <https://github.com/svet589>
 */
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
