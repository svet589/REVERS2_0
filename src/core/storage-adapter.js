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
// storage-adapter.js — ФИНАЛЬНАЯ ВЕРСИЯ
// ============================================================
import identity from './identity.js';
import cryptoModule from './crypto-module.js';

const MAX_MESSAGES_PER_CHAT = 1000;
const MAX_FILE_SIZE_UNCOMPRESSED = 1048576;

class StorageAdapter {
  constructor() {
    this.db = null;
    this._storageKey = null;
    this._pako = null;
    this.ready = this._init();
  }

  async _init() {
    await identity.ready();
    await cryptoModule.ready();

    try {
      this._pako = await import('pako');
    } catch (e) {}

    this._storageKey = await this._getStorageKey();

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('revers_db', 3);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('chatId', 'chatId', { unique: false });
          store.createIndex('timestamp', 'time', { unique: false });
        }
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        console.log('🗄️ IndexedDB готова');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB недоступна');
        reject(new Error('IndexedDB не работает'));
      };
    });
  }

  async _getStorageKey() {
    const x25519sk = identity.getX25519SecretKey();
    if (!x25519sk) return null;
    const material = x25519sk + 'REVERS_STORAGE_KEY_v2';
    const hash = cryptoModule.hash(material);
    return typeof hash === 'string' ? cryptoModule.base64ToUint8Array(hash) : hash;
  }

  _compressData(data) {
    if (!this._pako || !data) return data;
    try {
      const compressed = this._pako.gzip(data);
      return btoa(String.fromCharCode(...new Uint8Array(compressed)));
    } catch (e) { return data; }
  }

  _decompressData(data) {
    if (!this._pako || !data) return data;
    try {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return this._pako.ungzip(bytes, { to: 'string' });
    } catch (e) { return data; }
  }

  async _encryptForStorage(data) {
    if (!this._storageKey) return JSON.stringify(data);
    const json = JSON.stringify(data);
    const encrypted = cryptoModule.encrypt(this._storageKey, json);
    return encrypted || json;
  }

  async _decryptFromStorage(encrypted) {
    if (!this._storageKey || !encrypted?.ciphertext) {
      return typeof encrypted === 'string' ? JSON.parse(encrypted) : encrypted;
    }
    const decrypted = cryptoModule.decrypt(this._storageKey, encrypted);
    return decrypted ? JSON.parse(decrypted) : null;
  }

  async saveMessage(chatId, msg) {
    await this.ready;
    if (!this.db) return;

    const encrypted = await this._encryptForStorage(msg);
    const record = {
      id: chatId + '_' + msg.time + '_' + Math.random().toString(36).substring(2, 6),
      chatId,
      time: msg.time || Date.now(),
      type: msg.type || 'text',
      encrypted
    };

    return new Promise((resolve) => {
      const tx = this.db.transaction('messages', 'readwrite');
      tx.objectStore('messages').put(record);
      tx.oncomplete = () => {
        this.cleanOldMessages(chatId);
        resolve();
      };
      tx.onerror = () => resolve();
    });
  }

  async getMessages(chatId) {
    await this.ready;
    if (!this.db) return [];

    return new Promise((resolve) => {
      const tx = this.db.transaction('messages', 'readonly');
      const index = tx.objectStore('messages').index('chatId');
      const request = index.getAll(chatId);

      request.onsuccess = async () => {
        const records = request.result || [];
        const messages = [];

        for (const record of records.sort((a, b) => a.time - b.time)) {
          try {
            const decrypted = await this._decryptFromStorage(record.encrypted);
            if (decrypted) messages.push(decrypted);
          } catch (e) {}
        }

        resolve(messages);
      };

      request.onerror = () => resolve([]);
    });
  }

  async clearChat(chatId) {
    await this.ready;
    if (!this.db) return;

    const messages = await this.getMessages(chatId);

    return new Promise((resolve) => {
      const tx = this.db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');

      for (const msg of messages) {
        const id = chatId + '_' + msg.time;
        store.delete(id);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async saveFile(fileId, data, mimeType) {
    await this.ready;
    if (!this.db) return;

    let fileData = data;
    if (this._pako && data && data.length > MAX_FILE_SIZE_UNCOMPRESSED) {
      try {
        fileData = this._compressData(data);
        if (!fileData) fileData = data;
      } catch (e) { fileData = data; }
    }

    const encrypted = await this._encryptForStorage({ data: fileData, mimeType, compressed: fileData !== data });
    const record = { id: fileId, time: Date.now(), encrypted };

    return new Promise((resolve) => {
      const tx = this.db.transaction('files', 'readwrite');
      tx.objectStore('files').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async getFile(fileId) {
    await this.ready;
    if (!this.db) return null;

    return new Promise((resolve) => {
      const tx = this.db.transaction('files', 'readonly');
      const request = tx.objectStore('files').get(fileId);

      request.onsuccess = async () => {
        const record = request.result;
        if (!record) { resolve(null); return; }
        try {
          const decrypted = await this._decryptFromStorage(record.encrypted);
          if (decrypted?.compressed && this._pako) {
            decrypted.data = this._decompressData(decrypted.data);
          }
          resolve(decrypted?.data || null);
        } catch (e) { resolve(null); }
      };

      request.onerror = () => resolve(null);
    });
  }

  async cleanOldMessages(chatId, maxMessages = MAX_MESSAGES_PER_CHAT) {
    await this.ready;
    if (!this.db) return;

    const messages = await this.getMessages(chatId);
    if (messages.length <= maxMessages) return;

    const toDelete = messages.slice(0, messages.length - maxMessages);
    const tx = this.db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');

    for (const msg of toDelete) {
      const id = chatId + '_' + msg.time;
      store.delete(id);
    }

    console.log('🧹 Очищено сообщений:', toDelete.length, 'в чате', chatId);
  }

  async deleteMessage(id) {
    await this.ready;
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db.transaction('messages', 'readwrite');
      tx.objectStore('messages').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
}

export default new StorageAdapter();
