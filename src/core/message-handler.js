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
// message-handler.js — E2E с кэшированием ключей, подписями, пост-квантом, onion, подарками
import p2pNetwork from './p2p-network.js';
import identity from './identity.js';
import cryptoModule from './crypto-module.js';
import storage from './storage-adapter.js';
import groupManager from './group-manager.js';

class MessageHandler {
  constructor() {
    this.chats = new Map();
    this.channels = new Map();
    this.sharedKeys = new Map();
    this.groupKeys = new Map();
    this.peerProfiles = new Map();
    this.pendingQueue = [];
    this.onChatUpdate = null;
    this.onMessage = null;
    this._fileBuffers = new Map();
    this._pako = null;
    this._init();
  }

  async _init() {
    await storage.ready;
    await identity.ready();
    await cryptoModule.ready();
    this.chats.set('me', []);

    try {
      this._pako = await import('pako');
    } catch(e) {}

    setInterval(() => this._flushPendingQueue(), 5000);
    setInterval(() => this._rotateGroupKeys(), 600000);

    if (this.onChatUpdate) this.onChatUpdate();
  }

  _compress(data) {
    if (!this._pako || !data || data.length < 5000) return data;
    try {
      const compressed = this._pako.gzip(data);
      return btoa(String.fromCharCode(...new Uint8Array(compressed)));
    } catch(e) { return data; }
  }

  _decompress(data) {
    if (!this._pako || !data || data.length < 5000) return data;
    try {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return this._pako.ungzip(bytes, { to: 'string' });
    } catch(e) { return data; }
  }

  async _rotateGroupKeys() {
    for (const [groupKey, oldKey] of this.groupKeys) {
      const group = groupManager.groups.get(groupKey);
      if (!group) continue;
      const newKey = await cryptoModule.computeSharedKey(identity.getX25519SecretKey(), groupKey + Date.now().toString());
      if (!newKey) continue;
      const encrypted = cryptoModule.encrypt(oldKey, JSON.stringify({ type: 'group-key-rotation', groupKey, newKey: Buffer.from(newKey).toString('base64'), timestamp: Date.now() }));
      for (const memberId of group.members) {
        if (memberId !== identity.id) p2pNetwork.sendToPeer(memberId, { type: 'group-key-rotation', data: encrypted });
      }
      this.groupKeys.set(groupKey, newKey);
    }
  }

  async _handleGroupKeyRotation(peerId, data) {
    const oldKey = await this._getSharedKey(peerId);
    if (!oldKey) return;
    const decrypted = cryptoModule.decrypt(oldKey, data);
    if (!decrypted) return;
    try {
      const { groupKey, newKey, timestamp } = JSON.parse(decrypted);
      this.groupKeys.set(groupKey, new Uint8Array(Buffer.from(newKey, 'base64')));
    } catch(e) {}
  }

  async _getSharedKey(peerId) {
    if (this.sharedKeys.has(peerId)) return this.sharedKeys.get(peerId);
    const profile = this.peerProfiles.get(peerId);
    if (!profile?.x25519PublicKey) {
      p2pNetwork.sendToPeer(peerId, { type: 'request-profile' });
      return null;
    }
    const sharedKey = await cryptoModule.computeSharedKey(identity.getX25519SecretKey(), profile.x25519PublicKey);
    if (sharedKey) this.sharedKeys.set(peerId, sharedKey);
    return sharedKey;
  }

  async _getGroupKey(groupKey) {
    if (this.groupKeys.has(groupKey)) return this.groupKeys.get(groupKey);
    const group = groupManager.groups.get(groupKey);
    if (!group?.groupKey) {
      const groupSharedKey = await cryptoModule.computeSharedKey(identity.getX25519SecretKey(), groupKey);
      if (groupSharedKey) {
        this.groupKeys.set(groupKey, groupSharedKey);
        for (const memberId of group.members) {
          if (memberId !== identity.id) this._sendGroupKeyToMember(groupKey, memberId, groupSharedKey);
        }
      }
      return groupSharedKey;
    }
    this.groupKeys.set(groupKey, group.groupKey);
    return group.groupKey;
  }

  async _sendGroupKeyToMember(groupKey, memberId, keyMaterial) {
    const sharedKey = await this._getSharedKey(memberId);
    if (!sharedKey) return;
    const encrypted = cryptoModule.encrypt(sharedKey, JSON.stringify({ type: 'group-key', groupKey, key: Buffer.from(keyMaterial).toString('base64') }));
    p2pNetwork.sendToPeer(memberId, { type: 'group-key', data: encrypted });
  }

  _addToPending(peerId, pendingData, msg) {
    this.pendingQueue.push({ peerId, data: pendingData, msg, attempts: 0, maxAttempts: 10, added: Date.now() });
  }

  async _flushPendingQueue() {
    const now = Date.now();
    const stillPending = [];
    for (const item of this.pendingQueue) {
      if (now - item.added > 300000) continue;
      if (item.attempts >= item.maxAttempts) continue;
      const sharedKey = await this._getSharedKey(item.peerId);
      if (!sharedKey) { stillPending.push(item); continue; }
      let dataToSend = item.data;
      if (!dataToSend && item.msg) {
        const signature = cryptoModule.sign(identity.getX25519SecretKey(), JSON.stringify({ from: identity.id, text: item.msg.text, time: item.msg.time }));
        const encrypted = cryptoModule.encrypt(sharedKey, JSON.stringify({ text: item.msg.text, signature, from: identity.id, time: item.msg.time }));
        if (encrypted) dataToSend = { type: item.msg.type || 'message', data: encrypted };
      }
      if (!dataToSend) { stillPending.push(item); continue; }
      const sent = p2pNetwork.sendToPeer(item.peerId, dataToSend);
      if (sent) { if (item.msg) { item.msg.sent = true; this._saveMsg(item.peerId, item.msg); } }
      else { item.attempts++; stillPending.push(item); }
    }
    this.pendingQueue = stillPending;
  }

  async sendMessage(peerId, text) {
    const msg = { from: identity.id, text, time: Date.now(), type: 'text', sent: false };
    this._saveMsg(peerId, msg);
    if (peerId === 'me') { msg.sent = true; return true; }
    const sharedKey = await this._getSharedKey(peerId);
    if (!sharedKey) { this._addToPending(peerId, null, msg); return false; }
    const signature = cryptoModule.sign(identity.getX25519SecretKey(), JSON.stringify({ from: identity.id, text, time: msg.time }));
    const encrypted = cryptoModule.encrypt(sharedKey, JSON.stringify({ text, signature, from: identity.id, time: msg.time }));
    if (!encrypted) { this._addToPending(peerId, null, msg); return false; }
    const data = { type: 'message', data: encrypted };
    const sent = p2pNetwork.sendToPeer(peerId, data);
    if (sent) msg.sent = true;
    else this._addToPending(peerId, data, msg);
    return sent;
  }

  async sendFile(peerId, file) {
    if (peerId === 'me') {
      const reader = new FileReader();
      return new Promise(resolve => {
        reader.onload = () => {
          this._saveMsg(peerId, { from: identity.id, text: `📎 ${file.name}`, time: Date.now(), type: 'file', fileData: reader.result, fileName: file.name, fileSize: file.size, fileType: file.type, sent: true });
          resolve(true);
        };
        reader.readAsDataURL(file);
      });
    }
    const sharedKey = await this._getSharedKey(peerId);
    if (!sharedKey) return false;
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const compressed = this._compress(reader.result);
        const signature = cryptoModule.sign(identity.getX25519SecretKey(), JSON.stringify({ name: file.name, size: file.size, mime: file.type }));
        const encrypted = cryptoModule.encrypt(sharedKey, JSON.stringify({ type: 'file', name: file.name, size: file.size, mime: file.type, data: compressed, signature }));
        if (!encrypted) { resolve(false); return; }
        const data = { type: 'file', data: encrypted };
        const sent = p2pNetwork.sendToPeer(peerId, data);
        const msg = { from: identity.id, text: `📎 ${file.name}`, time: Date.now(), type: 'file', fileData: reader.result, fileName: file.name, fileSize: file.size, fileType: file.type, sent };
        this._saveMsg(peerId, msg);
        if (!sent) this._addToPending(peerId, data, msg);
        resolve(sent);
      };
      reader.readAsDataURL(file);
    });
  }

  async recordVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = e => chunks.push(e.data);
      return new Promise(resolve => {
        mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(new Blob(chunks, { type: 'audio/webm' })); };
        mr.start();
        resolve({ stop: () => mr.stop(), recorder: mr, chunks });
      });
    } catch(e) { return null; }
  }

  async sendVoice(peerId, audioBase64, duration) {
    const msg = { from: identity.id, text: `🎤 Голосовое (${duration}с)`, time: Date.now(), type: 'voice', fileData: audioBase64, fileType: 'audio/webm', duration, sent: false };
    this._saveMsg(peerId, msg);
    if (peerId === 'me') { msg.sent = true; return true; }
    const sharedKey = await this._getSharedKey(peerId);
    if (!sharedKey) { this._addToPending(peerId, null, msg); return false; }
    const compressed = this._compress(audioBase64);
    const signature = cryptoModule.sign(identity.getX25519SecretKey(), JSON.stringify({ type: 'voice', duration }));
    const encrypted = cryptoModule.encrypt(sharedKey, JSON.stringify({ type: 'voice', data: compressed, duration, signature }));
    if (!encrypted) { this._addToPending(peerId, null, msg); return false; }
    const data = { type: 'voice', data: encrypted };
    const sent = p2pNetwork.sendToPeer(peerId, data);
    if (sent) msg.sent = true;
    else this._addToPending(peerId, data, msg);
    return sent;
  }

  // ========== ПОДАРКИ ==========
  
  async sendGift(peerId, gift) {
    const msg = { from: identity.id, text: `🎁 Подарок: ${gift.emoji} ${gift.name}`, time: Date.now(), type: 'gift', sent: false, giftData: gift };
    this._saveMsg(peerId, msg);
    
    if (peerId === 'me') { msg.sent = true; return true; }
    
    const sharedKey = await this._getSharedKey(peerId);
    if (!sharedKey) { this._addToPending(peerId, null, msg); return false; }
    
    const signature = cryptoModule.sign(identity.getX25519SecretKey(), JSON.stringify({ type: 'gift', gift }));
    const encrypted = cryptoModule.encrypt(sharedKey, JSON.stringify({ type: 'gift', gift, signature, from: identity.id, fromName: identity.name }));
    
    if (!encrypted) { this._addToPending(peerId, null, msg); return false; }
    
    const data = { type: 'gift', data: encrypted };
    const sent = p2pNetwork.sendToPeer(peerId, data);
    if (sent) msg.sent = true;
    else this._addToPending(peerId, data, msg);
    
    return sent;
  }

  async sendGroupMessage(groupKey, text) {
    const group = groupManager.groups.get(groupKey);
    if (!group) return false;
    const groupSharedKey = await this._getGroupKey(groupKey);
    if (!groupSharedKey) return false;
    const signature = cryptoModule.sign(identity.getX25519SecretKey(), text);
    const encrypted = cryptoModule.encrypt(groupSharedKey, JSON.stringify({ text, signature, from: identity.id, groupKey, time: Date.now() }));
    if (!encrypted) return false;
    const data = { type: 'group_message', group: groupKey, data: encrypted };
    group.members.forEach(memberId => { if (memberId !== identity.id) { const sent = p2pNetwork.sendToPeer(memberId, data); if (!sent) this._addToPending(memberId, data, null); } });
    groupManager.sendGroupMessage(groupKey, text);
    return true;
  }

  async handleIncoming(msg) {
    const { from, type } = msg;
    if (type === 'hello') { await this._handleHello(from, msg.profile); return; }
    if (type === 'request-profile') { p2pNetwork.sendToPeer(from, { type: 'hello', profile: identity.getProfile() }); return; }
    if (type === 'pq-ciphertext') { await this._handlePQCiphertext(from, msg.ciphertext); return; }
    if (type === 'group-key') { await this._handleGroupKey(from, msg.data); return; }
    if (type === 'group-key-rotation') { await this._handleGroupKeyRotation(from, msg.data); return; }
    if (type === 'p2p-signal') { if (this.onMessage) this.onMessage(msg); return; }
    if (type === 'group_message') { await this._handleGroupMessage(from, msg); return; }
    
    // Обработка входящего подарка
    if (type === 'gift') {
      const sharedKey = await this._getSharedKey(from);
      if (sharedKey && msg.data?.ciphertext) {
        const decrypted = cryptoModule.decrypt(sharedKey, msg.data);
        if (decrypted) {
          try {
            const giftData = JSON.parse(decrypted);
            const gifts = JSON.parse(localStorage.getItem('revers_gifts') || '[]');
            gifts.push({
              emoji: giftData.gift?.emoji || '🎁',
              name: giftData.gift?.name || 'Подарок',
              from: from,
              fromName: giftData.fromName || from,
              time: Date.now()
            });
            localStorage.setItem('revers_gifts', JSON.stringify(gifts));
            
            if (this.onMessage) {
              this.onMessage({
                from,
                text: `🎁 Получен подарок: ${giftData.gift?.emoji || '🎁'} ${giftData.gift?.name || 'Подарок'} от ${giftData.fromName || from}!`,
                time: Date.now(),
                type: 'gift',
                giftData: giftData.gift
              });
            }
          } catch(e) {}
        }
      }
      return;
    }

    const sharedKey = await this._getSharedKey(from);
    let decrypted = null;
    if (sharedKey && msg.data?.ciphertext) decrypted = cryptoModule.decrypt(sharedKey, msg.data);
    let text = '';
    if (decrypted) {
      try { const parsed = JSON.parse(decrypted); text = this._decompress(parsed.text || parsed.data || ''); } catch(e) { text = decrypted; }
    } else { text = msg.data?.text || msg.data || ''; }
    const messageObj = { from, text: typeof text === 'string' ? text : '', time: Date.now(), type: type || 'text', fileData: msg.data?.data, fileName: msg.data?.name, fileSize: msg.data?.size, fileType: msg.data?.mime, sent: false };
    this._saveMsg(from, messageObj);
    if (this.onMessage) this.onMessage(messageObj);
    if (this.onChatUpdate) this.onChatUpdate();
  }

  async _handleGroupKey(peerId, encryptedData) {
    const sharedKey = await this._getSharedKey(peerId);
    if (!sharedKey) return;
    const decrypted = cryptoModule.decrypt(sharedKey, encryptedData);
    if (!decrypted) return;
    try { const { groupKey, key } = JSON.parse(decrypted); this.groupKeys.set(groupKey, new Uint8Array(Buffer.from(key, 'base64'))); } catch(e) {}
  }

  async _handleGroupMessage(peerId, msg) {
    const groupKey = msg.group;
    let groupSharedKey = await this._getGroupKey(groupKey);
    if (!groupSharedKey) groupSharedKey = await this._getSharedKey(peerId);
    if (!groupSharedKey) return;
    const decrypted = cryptoModule.decrypt(groupSharedKey, msg.data);
    if (!decrypted) return;
    try {
      const parsed = JSON.parse(decrypted);
      groupManager.receiveGroupMessage({ group: groupKey, data: { from: parsed.from || peerId, text: parsed.text, time: parsed.time || Date.now() } });
      if (this.onMessage) this.onMessage({ from: parsed.from || peerId, text: parsed.text, time: parsed.time || Date.now(), room: groupKey });
      if (this.onChatUpdate) this.onChatUpdate();
    } catch(e) {}
  }

  async _handleHello(peerId, profile) {
    if (!profile) return;
    this.peerProfiles.set(peerId, { x25519PublicKey: profile.x25519PublicKey || profile.publicKey, mlkemPublicKey: profile.mlkemPublicKey || null, name: profile.name, avatar: profile.avatar });
    await this._getSharedKey(peerId);
    if (profile.mlkemPublicKey && identity.hasPostQuantum()) await this._getPostQuantumKey(peerId);
    this._flushPendingQueue();
    if (this.onChatUpdate) this.onChatUpdate();
  }

  async _getPostQuantumKey(peerId) {
    const profile = this.peerProfiles.get(peerId);
    if (!profile?.mlkemPublicKey || !identity.hasPostQuantum()) return null;
    const { sharedKey, ciphertext } = await cryptoModule.encapsulateHybrid(profile.x25519PublicKey, profile.mlkemPublicKey);
    if (ciphertext) p2pNetwork.sendToPeer(peerId, { type: 'pq-ciphertext', ciphertext });
    return sharedKey;
  }

  async _handlePQCiphertext(peerId, ciphertext) {
    const profile = this.peerProfiles.get(peerId);
    if (!profile?.mlkemPublicKey || !identity.getMlkemSecretKey()) return;
    const sharedKey = await cryptoModule.decapsulateHybrid(identity.getX25519SecretKey(), identity.getMlkemSecretKey(), profile.x25519PublicKey, ciphertext);
    if (sharedKey) this.sharedKeys.set(peerId, sharedKey);
  }

  _saveMsg(peerId, msg) { if (!this.chats.has(peerId)) this.chats.set(peerId, []); this.chats.get(peerId).push(msg); storage.saveMessage(peerId, msg); }
  async getChatHistory(id) { return await storage.getMessages(id); }
  async clearChatHistory(id) { if (this.chats.has(id)) this.chats.set(id, []); await storage.clearChat(id); }

  async getAllChats() {
    const all = [];
    const saved = await storage.getMessages('me'); const ls = saved[saved.length - 1];
    all.push({ id: 'me', type: 'saved', name: '📔 Сохранённые', lastMsg: ls?.text || '', lastTime: ls?.time || Date.now(), unread: 0 });
    this.chats.forEach((msgs, id) => { if (id === 'me') return; const l = msgs[msgs.length - 1]; if (l) all.push({ id, type: 'contact', name: this.peerProfiles.get(id)?.name || id, lastMsg: l.text, lastTime: l.time, unread: 0 }); });
    groupManager.groups.forEach((g, key) => { const l = g.history[g.history.length - 1]; all.push({ id: key, type: 'group', name: (g.type === 'forum' ? '📂 ' : '👥 ') + g.name, lastMsg: l?.text || '', lastTime: l?.time || 0, unread: 0 }); });
    this.channels.forEach((c, key) => { const l = c.history[c.history.length - 1]; all.push({ id: key, type: 'channel', name: '📢 ' + c.name, lastMsg: l?.text || '', lastTime: l?.time || 0, unread: 0 }); });
    return all.sort((a, b) => b.lastTime - a.lastTime);
  }

  createChannel(name) { const key = 'channel_' + Date.now().toString(36); this.channels.set(key, { name, admin: identity.id, history: [], created: Date.now() }); this._saveChannels(); return key; }
  sendChannelMessage(key, text) { const c = this.channels.get(key); if (!c || c.admin !== identity.id) return false; c.history.push({ from: identity.id, text, time: Date.now(), type: 'text' }); this._saveChannels(); if (this.onChatUpdate) this.onChatUpdate(); return true; }
  getChannelHistory(key) { return this.channels.get(key)?.history || []; }
  _saveChannels() { try { localStorage.setItem('revers_channels', JSON.stringify(Array.from(this.channels.entries()))); } catch(e) {} }
  setOnChatUpdate(cb) { this.onChatUpdate = cb; }
  setOnMessage(cb) { this.onMessage = cb; }
}

export default new MessageHandler();
