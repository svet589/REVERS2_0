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
// ============================================================
// group-manager.js — ФИНАЛЬНАЯ ВЕРСИЯ
// ============================================================
import identity from './identity.js';

class GroupManager {
  constructor() {
    this.groups = new Map();
    this._load();
  }

  createGroup(name, type = 'chat') {
    const key = 'group_' + Date.now().toString(36);
    const group = {
      key, name, type,
      admin: this._myId(),
      members: [this._myId()],
      topics: type === 'forum' ? [{ id: 'general', name: '💬 Общий чат', closed: false, pinned: true, created: Date.now(), messages: [] }] : [],
      history: [],
      created: Date.now()
    };
    this.groups.set(key, group);
    this._save();
    return group;
  }

  getGroup(key) { return this.groups.get(key); }

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #5: receiveGroupMessage
  receiveGroupMessage(data) {
    const { group, data: msgData } = data;
    const g = this.groups.get(group);
    if (!g) return;
    g.history.push({
      from: msgData.from || 'unknown',
      text: msgData.text || '',
      time: msgData.time || Date.now(),
      type: 'text'
    });
    this._save();
  }

  sendGroupMessage(key, text) {
    const g = this.groups.get(key);
    if (!g) return false;
    g.history.push({ from: this._myId(), text, time: Date.now(), type: 'text' });
    this._save();
    return true;
  }

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #10: createPoll и addAnnouncement
  createPoll(groupKey, question, options) {
    const g = this.groups.get(groupKey);
    if (!g) return;
    const pollText = `📊 Голосование: ${question}\n${options.map((o, i) => `${i+1}. ${o}`).join('\n')}`;
    g.history.push({ from: this._myId(), text: pollText, time: Date.now(), type: 'poll', pollData: { question, options, votes: {} } });
    this._save();
  }

  addAnnouncement(groupKey, text) {
    const g = this.groups.get(groupKey);
    if (!g) return;
    g.history.push({ from: this._myId(), text: `📢 ${text}`, time: Date.now(), type: 'announcement' });
    this._save();
  }

  addTopic(groupKey, name) {
    const g = this.groups.get(groupKey);
    if (!g || g.type !== 'forum') return null;
    const topic = { id: 'topic_' + Date.now().toString(36), name, closed: false, pinned: false, created: Date.now(), messages: [] };
    g.topics.push(topic);
    this._save();
    return topic;
  }

  getTopics(groupKey) {
    const g = this.groups.get(groupKey);
    if (!g || g.type !== 'forum') return [];
    return [...(g.topics || [])].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }

  _myId() { return (typeof identity !== 'undefined' && identity.id) ? identity.id : localStorage.getItem('revers_id') || 'unknown'; }
  _save() { try { localStorage.setItem('revers_groups_v5', JSON.stringify(Array.from(this.groups.entries()))); } catch(e) {} }
  _load() { try { const d = JSON.parse(localStorage.getItem('revers_groups_v5')); if (d) this.groups = new Map(d); } catch(e) {} }
}

export default new GroupManager();
