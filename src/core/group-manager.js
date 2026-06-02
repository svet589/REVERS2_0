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
      topics: type === 'forum' ? [{ id: 'general', name: '💬 Общий чат', closed: false, pinned: true, created: Date.now() }] : [],
      history: [],
      created: Date.now()
    };
    this.groups.set(key, group);
    this._save();
    return group;
  }

  addTopic(groupKey, name) {
    const g = this.groups.get(groupKey);
    if (!g || g.type !== 'forum') return null;
    const topic = { id: 'topic_' + Date.now().toString(36), name, closed: false, pinned: false, created: Date.now(), messages: [] };
    g.topics.push(topic);
    this._save();
    return topic;
  }

  removeTopic(groupKey, topicId) {
    const g = this.groups.get(groupKey);
    if (!g) return false;
    g.topics = g.topics.filter(t => t.id !== topicId);
    this._save();
    return true;
  }

  togglePinTopic(groupKey, topicId) {
    const g = this.groups.get(groupKey);
    const t = g?.topics.find(t => t.id === topicId);
    if (t) t.pinned = !t.pinned;
    this._save();
  }

  toggleCloseTopic(groupKey, topicId) {
    const g = this.groups.get(groupKey);
    const t = g?.topics.find(t => t.id === topicId);
    if (t) t.closed = !t.closed;
    this._save();
  }

  sendToTopic(groupKey, topicId, text) {
    const g = this.groups.get(groupKey);
    const t = g?.topics.find(t => t.id === topicId);
    if (!t || (t.closed && g.admin !== this._myId())) return false;
    const msg = { from: this._myId(), text, time: Date.now(), type: 'text' };
    t.messages.push(msg);
    this._save();
    return msg;
  }

  getTopics(groupKey) {
    const g = this.groups.get(groupKey);
    return [...(g?.topics || [])].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.created - a.created);
  }

  getTopicMessages(groupKey, topicId) {
    return this.groups.get(groupKey)?.topics.find(t => t.id === topicId)?.messages || [];
  }

  setGroupType(groupKey, type) {
    const g = this.groups.get(groupKey);
    if (!g) return;
    g.type = type;
    if (type === 'forum' && !g.topics.length) g.topics.push({ id: 'general', name: '💬 Общий чат', closed: false, pinned: true, created: Date.now() });
    this._save();
  }

  updateGroupName(groupKey, name) { const g = this.groups.get(groupKey); if (g) { g.name = name; this._save(); } }
  deleteGroup(groupKey) { this.groups.delete(groupKey); this._save(); }

  sendGroupMessage(key, text) {
    const g = this.groups.get(key);
    if (!g) return false;
    g.history.push({ from: this._myId(), text, time: Date.now(), type: 'text' });
    this._save();
    return true;
  }

  _myId() { return localStorage.getItem('revers_id') || 'unknown'; }
  _save() { try { localStorage.setItem('revers_groups_v2', JSON.stringify(Array.from(this.groups.entries()))); } catch(e) {} }
  _load() { try { const d = JSON.parse(localStorage.getItem('revers_groups_v2')); if (d) this.groups = new Map(d); } catch(e) {} }
}

export default new GroupManager();
