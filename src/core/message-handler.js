// message-handler.js — сообщения, файлы, группы, каналы

import p2pNetwork from './p2p-network.js';
import cryptoModule from './crypto-module.js';
import identity from './identity.js';

class MessageHandler {
  constructor() {
    this.chats = new Map();
    this.groups = new Map();
    this.channels = new Map();
    this.onChatUpdate = null;
    this.onMessage = null;
    this._loadFromStorage();
  }

  // ========== ЛИЧНЫЕ СООБЩЕНИЯ ==========

  sendMessage(peerId, text) {
    // Double Ratchet
    if (!cryptoModule.ratchetStates.has(peerId)) {
      const sharedSecret = cryptoModule.computeSharedSecret(
        identity.secretKey,
        identity.publicKey
      );
      cryptoModule.initRatchet(peerId, sharedSecret);
    }

    const encrypted = cryptoModule.encryptMessage(peerId, text);
    
    const sent = p2pNetwork.sendToPeer(peerId, {
      type: 'message',
      data: encrypted
    });

    if (sent) {
      this._saveMessage(peerId, {
        from: identity.id,
        text,
        time: Date.now(),
        type: 'text',
        sent: true
      });
    } else {
      // Сохраняем локально даже если не отправилось
      this._saveMessage(peerId, {
        from: identity.id,
        text,
        time: Date.now(),
        type: 'text',
        sent: false
      });
    }

    return sent;
  }

  sendFile(peerId, file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result;
        
        // Стеганография для больших файлов
        let payload = base64;
        if (file.size > 5000 && file.type.startsWith('image/')) {
          try {
            payload = await cryptoModule.encodeStegano(base64, 'REVERS_FILE');
          } catch (err) {}
        }

        const sent = p2pNetwork.sendToPeer(peerId, {
          type: 'file',
          name: file.name,
          size: file.size,
          mime: file.type,
          data: payload
        });

        if (sent) {
          this._saveMessage(peerId, {
            from: identity.id,
            text: `📎 ${file.name}`,
            time: Date.now(),
            type: 'file',
            fileData: payload,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            sent: true
          });
        }

        resolve(sent);
      };
      reader.readAsDataURL(file);
    });
  }

  // ========== ГРУППЫ ==========

  createGroup(name) {
    const key = 'group_' + Date.now().toString(36);
    this.groups.set(key, {
      name,
      admin: identity.id,
      members: [identity.id],
      history: [],
      created: Date.now()
    });
    this._saveToStorage();
    return key;
  }

  sendGroupMessage(groupKey, text) {
    const group = this.groups.get(groupKey);
    if (!group) return false;

    const msg = {
      from: identity.id,
      text,
      time: Date.now(),
      type: 'text'
    };

    group.history.push(msg);
    this._saveToStorage();
    
    if (this.onChatUpdate) this.onChatUpdate();
    return true;
  }

  // ========== КАНАЛЫ ==========

  createChannel(name) {
    const key = 'channel_' + Date.now().toString(36);
    this.channels.set(key, {
      name,
      admin: identity.id,
      history: [],
      created: Date.now()
    });
    this._saveToStorage();
    return key;
  }

  sendChannelMessage(channelKey, text) {
    const channel = this.channels.get(channelKey);
    if (!channel || channel.admin !== identity.id) return false;

    channel.history.push({
      from: identity.id,
      text,
      time: Date.now(),
      type: 'text'
    });
    
    this._saveToStorage();
    if (this.onChatUpdate) this.onChatUpdate();
    return true;
  }

  // ========== ОБРАБОТКА ВХОДЯЩИХ ==========

  handleIncoming(msg) {
    const { from, data, type } = msg;

    if (type === 'hello') {
      if (this.onChatUpdate) this.onChatUpdate();
      return;
    }

    if (type === 'p2p-signal') {
      if (this.onMessage) this.onMessage(msg);
      return;
    }

    // Расшифровка
    let text = data;
    try {
      if (typeof data === 'object' && data.encrypted) {
        text = cryptoModule.decryptMessage(from, data);
      } else if (typeof data === 'string') {
        text = data;
      }
    } catch (e) {
      text = data?.text || data?.encrypted || String(data);
    }

    const messageObj = {
      from,
      text: typeof text === 'string' ? text : text?.text || '',
      time: Date.now(),
      type: type || 'text',
      fileData: data?.data || null,
      fileName: data?.name || null,
      fileSize: data?.size || null,
      fileType: data?.mime || null
    };

    this._saveMessage(from, messageObj);
    if (this.onMessage) this.onMessage(messageObj);
    if (this.onChatUpdate) this.onChatUpdate();
  }

  // ========== ХРАНЕНИЕ ==========

  _saveMessage(peerId, msg) {
    if (!this.chats.has(peerId)) this.chats.set(peerId, []);
    this.chats.get(peerId).push(msg);
    this._saveToStorage();
  }

  getChatHistory(peerId) {
    return this.chats.get(peerId) || [];
  }

  getGroupHistory(key) {
    return this.groups.get(key)?.history || [];
  }

  getChannelHistory(key) {
    return this.channels.get(key)?.history || [];
  }

  getAllChats() {
    const all = [];

    // Сохранённые
    const saved = this.chats.get('me') || [];
    const lastSaved = saved[saved.length - 1];
    all.push({
      id: 'me', type: 'saved', name: '📔 Сохранённые',
      lastMsg: lastSaved?.text || 'Нет сообщений',
      lastTime: lastSaved?.time || Date.now(), unread: 0
    });

    // Контакты
    this.chats.forEach((msgs, peerId) => {
      if (peerId === 'me') return;
      const last = msgs[msgs.length - 1];
      if (last) all.push({
        id: peerId, type: 'contact', name: peerId,
        lastMsg: last.text, lastTime: last.time, unread: 0
      });
    });

    // Группы
    this.groups.forEach((g, key) => {
      const last = g.history[g.history.length - 1];
      all.push({
        id: key, type: 'group', name: '👥 ' + g.name,
        lastMsg: last?.text || '', lastTime: last?.time || 0, unread: 0
      });
    });

    // Каналы
    this.channels.forEach((c, key) => {
      const last = c.history[c.history.length - 1];
      all.push({
        id: key, type: 'channel', name: '📢 ' + c.name,
        lastMsg: last?.text || '', lastTime: last?.time || 0, unread: 0
      });
    });

    return all.sort((a, b) => b.lastTime - a.lastTime);
  }

  _saveToStorage() {
    try {
      localStorage.setItem('revers_chats', JSON.stringify(Array.from(this.chats.entries())));
      localStorage.setItem('revers_groups', JSON.stringify(Array.from(this.groups.entries())));
      localStorage.setItem('revers_channels', JSON.stringify(Array.from(this.channels.entries())));
    } catch (e) {
      console.error('Ошибка сохранения:', e);
    }
  }

  _loadFromStorage() {
    try {
      const chats = JSON.parse(localStorage.getItem('revers_chats'));
      const groups = JSON.parse(localStorage.getItem('revers_groups'));
      const channels = JSON.parse(localStorage.getItem('revers_channels'));
      
      if (chats) this.chats = new Map(chats);
      if (groups) this.groups = new Map(groups);
      if (channels) this.channels = new Map(channels);
      
      if (!this.chats.has('me')) this.chats.set('me', []);
    } catch (e) {
      this.chats.set('me', []);
    }
  }

  setOnChatUpdate(cb) { this.onChatUpdate = cb; }
  setOnMessage(cb) { this.onMessage = cb; }
}

export default new MessageHandler();
