class StorageAdapter {
  constructor() {
    this.db = null;
    this.ready = this._init();
  }

  async _init() {
    return new Promise((resolve) => {
      const request = indexedDB.open('revers_db', 2);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('messages')) db.createObjectStore('messages', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
      };
      request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      request.onerror = () => { resolve(); };
    });
  }

  async saveMessage(chatId, msg) {
    await this.ready;
    if (!this.db) return this._fallbackSave(chatId, msg);
    const id = chatId + '_' + msg.time;
    if (msg.fileData && msg.fileData.length > 50000) {
      await this._saveFile(id, msg.fileData, msg.fileType);
      msg = { ...msg, fileData: 'idb://' + id };
    }
    const tx = this.db.transaction('messages', 'readwrite');
    tx.objectStore('messages').put({ id, chatId, ...msg });
  }

  async getMessages(chatId) {
    await this.ready;
    if (!this.db) return this._fallbackGet(chatId);
    return new Promise((resolve) => {
      const tx = this.db.transaction('messages', 'readonly');
      const all = [];
      tx.objectStore('messages').openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.chatId === chatId) all.push(cursor.value);
          cursor.continue();
        } else resolve(all.sort((a, b) => a.time - b.time));
      };
    });
  }

  async deleteMessage(id) {
    await this.ready;
    if (!this.db) return;
    const tx = this.db.transaction('messages', 'readwrite');
    tx.objectStore('messages').delete(id);
    const ftx = this.db.transaction('files', 'readwrite');
    ftx.objectStore('files').delete(id);
  }

  async _saveFile(id, data, type) {
    const tx = this.db.transaction('files', 'readwrite');
    tx.objectStore('files').put({ id, data, type, time: Date.now() });
  }

  async getFile(id) {
    await this.ready;
    if (!this.db) return null;
    return new Promise((resolve) => {
      const tx = this.db.transaction('files', 'readonly');
      const req = tx.objectStore('files').get(id);
      req.onsuccess = () => resolve(req.result?.data || null);
      req.onerror = () => resolve(null);
    });
  }

  async clearChat(chatId) {
    await this.ready;
    if (!this.db) return;
    const messages = await this.getMessages(chatId);
    const tx = this.db.transaction(['messages', 'files'], 'readwrite');
    for (const msg of messages) {
      tx.objectStore('messages').delete(msg.id);
      tx.objectStore('files').delete(msg.id);
    }
  }

  _fallbackSave(chatId, msg) {
    const key = 'revers_fb_' + chatId;
    const msgs = JSON.parse(localStorage.getItem(key) || '[]');
    const { fileData, ...rest } = msg;
    msgs.push(rest);
    if (msgs.length > 100) msgs.shift();
    try { localStorage.setItem(key, JSON.stringify(msgs)); } catch(e) {}
  }

  _fallbackGet(chatId) {
    return JSON.parse(localStorage.getItem('revers_fb_' + chatId) || '[]');
  }
}

export default new StorageAdapter();
