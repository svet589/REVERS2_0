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
// storage-adapter.js v2.0 — шифрование на диске, индексация, сжатие, авточистка

import identity from './identity.js';
import cryptoModule from './crypto-module.js';

const MAX_MESSAGES_PER_CHAT = 1000;
const MAX_FILE_SIZE_UNCOMPRESSED = 1048576; // 1MB — сжимать если больше

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

    // Загружаем pako
    try {
      this._pako = await import('pako');
      console.log('🗜️ pako загружен для сжатия файлов');
    } catch(e) {
      console.log('⚠️ pako недоступен');
    }

    // Получаем ключ шифрования
    this._storageKey = await this._getStorageKey();

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('revers_db', 3);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Хранилище сообщений с индексом по chatId
        if (!db.objectStoreNames.contains('messages')) {
          const store = db.createObjectStore('messages', { keyPath: 'id' });
          store.createIndex('chatId', 'chatId', { unique: false });
          store.createIndex('timestamp', 'time', { unique: false });
        }

        // Хранилище файлов
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }

        // Метаданные чатов
        if (!db.objectStoreNames.contains('chatMeta')) {
          db.createObjectStore('chatMeta', { keyPath: 'chatId' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        console.log('🗄️ IndexedDB v2.0 готова (шифрование + индексы)');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ IndexedDB недоступна');
        reject(new Error('IndexedDB не работает. REVERS не может сохранять данные.'));
      };
    });
  }

  // ========== КЛЮЧ ШИФРОВАНИЯ ==========

  async _getStorageKey() {
    // Деривируем ключ из identity ключей
    const x25519sk = identity.getX25519SecretKey();
    if (!x25519sk) return null;

    // Хешируем секретный ключ + соль для получения ключа шифрования диска
    const material = x25519sk + 'REVERS_STORAGE_KEY_v2';
    return cryptoModule.hash(material);
  }

  // ========== СОХРАНЕНИЕ СООБЩЕНИЙ ==========

  async saveMessage(chatId, msg) {
    await this.ready;

    // Шифруем перед сохранением
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
        // Авточистка после сохранения
        this.cleanOldMessages(chatId);
        resolve();
      };
      tx.onerror = () => resolve();
    });
  }

  // ========== ЗАГРУЗКА СООБЩЕНИЙ ==========

  async getMessages(chatId) {
    await this.ready;

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
            messages.push(decrypted);
          } catch(e) {
            // Пропускаем повреждённые записи
          }
        }

        resolve(messages);
      };

      request.onerror = () => resolve([]);
    });
  }

  // ========== УДАЛЕНИЕ ==========

  async deleteMessage(id) {
    await this.ready;
    return new Promise((resolve) => {
      const tx = this.db.transaction('messages', 'readwrite');
      tx.objectStore('messages').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async clearChat(chatId) {
    await this.ready;
    const messages = await this.getMessages(chatId);

    return new Promise((resolve) => {
      const tx = this.db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');

      for (const msg of messages) {
        store.delete(chatId + '_' + msg.time);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  // ========== ФАЙЛЫ ==========

  async saveFile(fileId, data, mimeType) {
    await this.ready;

    // Сжимаем большие файлы
    let fileData = data;
    if (this._pako && data.length > MAX_FILE_SIZE_UNCOMPRESSED) {
      try {
        fileData = this._compressData(data);
      } catch(e) {}
    }

    const encrypted = await this._encryptForStorage({
      data: fileData,
      mimeType,
      compressed: fileData !== data
    });

    const record = {
      id: fileId,
      time: Date.now(),
      encrypted
    };

    return new Promise((resolve) => {
      const tx = this.db.transaction('files', 'readwrite');
      tx.objectStore('files').put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async getFile(fileId) {
    await this.ready;

    return new Promise((resolve) => {
      const tx = this.db.transaction('files', 'readonly');
      const request = tx.objectStore('files').get(fileId);

      request.onsuccess = async () => {
        const record = request.result;
        if (!record) { resolve(null); return; }

        try {
          const decrypted = await this._decryptFromStorage(record.encrypted);

          // Распаковываем если сжато
          if (decrypted.compressed && this._pako) {
            decrypted.data = this._decompressData(decrypted.data);
          }

          resolve(decrypted.data);
        } catch(e) {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  // ========== АВТОЧИСТКА ==========

  async cleanOldMessages(chatId, maxMessages = MAX_MESSAGES_PER_CHAT) {
    await this.ready;
    const messages = await this.getMessages(chatId);

    if (messages.length <= maxMessages) return;

    const toDelete = messages.slice(0, messages.length - maxMessages);
    const tx = this.db.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');

    for (const msg of toDelete) {
      store.delete(chatId + '_' + msg.time);
    }

    console.log('🧹 Очищено сообщений:', toDelete.length, 'в чате', chatId);
  }

  // ========== СЖАТИЕ ==========

  _compressData(data) {
    if (!this._pako) return data;
    const compressed = this._pako.gzip(data);
    return btoa(String.fromCharCode(...new Uint8Array(compressed)));
  }

  _decompressData(data) {
    if (!this._pako) return data;
    try {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const decompressed = this._pako.ungzip(bytes, { to: 'string' });
      return decompressed;
    } catch(e) {
      return data;
    }
  }

  // ========== ШИФРОВАНИЕ ==========

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

  // ========== МЕТАДАННЫЕ ==========

  async saveChatMeta(chatId, meta) {
    await this.ready;
    const encrypted = await this._encryptForStorage(meta);

    return new Promise((resolve) => {
      const tx = this.db.transaction('chatMeta', 'readwrite');
      tx.objectStore('chatMeta').put({ chatId, encrypted });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async getChatMeta(chatId) {
    await this.ready;

    return new Promise((resolve) => {
      const tx = this.db.transaction('chatMeta', 'readonly');
      const request = tx.objectStore('chatMeta').get(chatId);

      request.onsuccess = async () => {
        const record = request.result;
        if (!record) { resolve(null); return; }
        try {
          const decrypted = await this._decryptFromStorage(record.encrypted);
          resolve(decrypted);
        } catch(e) {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  // ========== СТАТИСТИКА ==========

  async getStorageStats() {
    await this.ready;

    return new Promise((resolve) => {
      const tx = this.db.transaction(['messages', 'files'], 'readonly');
      const msgStore = tx.objectStore('messages');
      const fileStore = tx.objectStore('files');

      const stats = { messages: 0, files: 0, totalSize: 0 };

      msgStore.count().onsuccess = (e) => { stats.messages = e.target.result; };
      fileStore.count().onsuccess = (e) => { stats.files = e.target.result; };

      tx.oncomplete = () => resolve(stats);
    });
  }
}

export default new StorageAdapter();
