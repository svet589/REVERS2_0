// message-handler.js — сообщения, файлы, группы, каналы

import cryptoModule from './crypto-module.js';
import swarmManager from './swarm-manager.js';

class MessageHandler {
  constructor() {
    this.chats = new Map();       // peerId -> [{ from, text, time, type }]
    this.groups = new Map();      // groupKey -> { name, admin, members, history }
    this.channels = new Map();    // channelKey -> { name, admin, history }
    this.onChatUpdate = null;     // Колбэк для UI
    this.onMessage = null;        // Колбэк для входящих
    
    this.loadFromStorage();
  }

  // ============ ЛИЧНЫЕ СООБЩЕНИЯ ============

  async sendMessage(peerId, text) {
    // Инициализируем ratchet если нужно
    if (!cryptoModule.ratchetStates.has(peerId)) {
      const sharedSecret = cryptoModule.computeSharedSecret(
        swarmManager.identity.secretKey,
        swarmManager.peerConnections.get(peerId)?.profile?.publicKey
      );
      if (sharedSecret) {
        cryptoModule.initRatchet(peerId, sharedSecret);
      }
    }

    // Шифруем
    let encrypted;
    try {
      encrypted = cryptoModule.encryptMessage(peerId, text);
    } catch (e) {
      // Fallback: без ratchet
      encrypted = { encrypted: text, nonce: '', counter: 0 };
    }

    // Отправляем через swarm
    const sent = swarmManager.sendToPeer(peerId, encrypted);
    
    if (sent) {
      this.saveMessage(peerId, {
        from: swarmManager.identity.id,
        text,
        time: Date.now(),
        type: 'text',
        sent: true
      });
    }
    
    return sent;
  }

  async sendFile(peerId, file) {
    const reader = new FileReader();
    
    return new Promise((resolve) => {
      reader.onload = async (e) => {
        const base64 = e.target.result;
        
        // Для файлов > 5KB используем стеганографию (прячем в картинке-заглушке)
        let payload = base64;
        if (file.size > 5000) {
          // Создаём картинку-контейнер и прячем файл внутри
          const container = this.createContainerImage();
          payload = await cryptoModule.encodeStegano(container, base64);
        }
        
        const sent = swarmManager.sendToPeer(peerId, {
          type: 'file',
          name: file.name,
          size: file.size,
          mime: file.type,
          data: payload
        });
        
        if (sent) {
          this.saveMessage(peerId, {
            from: swarmManager.identity.id,
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

  // ============ ГРУППЫ ============

  createGroup(name) {
    const groupKey = 'group_' + Date.now().toString(36);
    
    this.groups.set(groupKey, {
      name,
      admin: swarmManager.identity.id,
      members: [swarmManager.identity.id],
      history: [],
      created: Date.now()
    });

    swarmManager.joinRoom(groupKey);
    this.saveToStorage();
    
    return groupKey;
  }

  joinGroup(groupKey) {
    if (this.groups.has(groupKey)) return;
    
    this.groups.set(groupKey, {
      name: groupKey,
      admin: null,
      members: [swarmManager.identity.id],
      history: [],
      created: Date.now()
    });

    swarmManager.joinRoom(groupKey);
    this.saveToStorage();
  }

  sendGroupMessage(groupKey, text) {
    const group = this.groups.get(groupKey);
    if (!group) return false;

    const msg = {
      from: swarmManager.identity.id,
      text,
      time: Date.now(),
      type: 'text'
    };

    group.history.push(msg);
    
    // Отправляем через swarm в комнату
    swarmManager.broadcastToRoom(groupKey, {
      type: 'group_message',
      group: groupKey,
      data: msg
    });

    this.saveToStorage();
    if (this.onChatUpdate) this.onChatUpdate();
    return true;
  }

  // ============ КАНАЛЫ ============

  createChannel(name) {
    const channelKey = 'channel_' + Date.now().toString(36);
    
    this.channels.set(channelKey, {
      name,
      admin: swarmManager.identity.id,
      history: [],
      created: Date.now()
    });

    swarmManager.joinRoom(channelKey);
    this.saveToStorage();
    
    return channelKey;
  }

  sendChannelMessage(channelKey, text) {
    const channel = this.channels.get(channelKey);
    if (!channel) return false;
    
    // Только админ может писать
    if (channel.admin !== swarmManager.identity.id) return false;

    const msg = {
      from: swarmManager.identity.id,
      text,
      time: Date.now(),
      type: 'text'
    };

    channel.history.push(msg);
    
    swarmManager.broadcastToRoom(channelKey, {
      type: 'channel_message',
      channel: channelKey,
      data: msg
    });

    this.saveToStorage();
    if (this.onChatUpdate) this.onChatUpdate();
    return true;
  }

  // ============ ОБРАБОТКА ВХОДЯЩИХ ============

  handleIncoming(msg) {
    const { from, data, room } = msg;

    // Пытаемся расшифровать
    let decrypted = data;
    try {
      if (typeof data === 'object' && data.encrypted) {
        decrypted = cryptoModule.decryptMessage(from, data);
      }
    } catch (e) {
      // Не расшифровалось — используем как есть
      decrypted = data?.text || data;
    }

    const messageObj = {
      from,
      text: typeof decrypted === 'string' ? decrypted : decrypted?.text || '',
      time: Date.now(),
      type: data?.type || 'text',
      fileData: data?.data || null,
      fileName: data?.name || null,
      fileSize: data?.size || null,
      fileType: data?.mime || null,
      room: room || null
    };

    // Сохраняем
    if (room) {
      // Групповое/канальное
      if (this.groups.has(room)) {
        this.groups.get(room).history.push(messageObj);
      } else if (this.channels.has(room)) {
        this.channels.get(room).history.push(messageObj);
      }
    } else {
      // Личное
      this.saveMessage(from, messageObj);
    }

    this.saveToStorage();
    
    if (this.onMessage) this.onMessage(messageObj);
    if (this.onChatUpdate) this.onChatUpdate();
  }

  // ============ ХРАНЕНИЕ ============

  saveMessage(peerId, msg) {
    if (!this.chats.has(peerId)) {
      this.chats.set(peerId, []);
    }
    this.chats.get(peerId).push(msg);
    this.saveToStorage();
  }

  getChatHistory(peerId) {
    return this.chats.get(peerId) || [];
  }

  getGroupHistory(groupKey) {
    return this.groups.get(groupKey)?.history || [];
  }

  getChannelHistory(channelKey) {
    return this.channels.get(channelKey)?.history || [];
  }

  getAllChats() {
    const all = [];
    
    this.chats.forEach((messages, peerId) => {
      const last = messages[messages.length - 1];
      all.push({
        id: peerId,
        type: 'contact',
        name: peerId,
        lastMsg: last?.text || '',
        lastTime: last?.time || 0,
        unread: 0
      });
    });

    this.groups.forEach((group, key) => {
      const last = group.history[group.history.length - 1];
      all.push({
        id: key,
        type: 'group',
        name: group.name,
        lastMsg: last?.text || '',
        lastTime: last?.time || 0,
        unread: 0
      });
    });

    this.channels.forEach((channel, key) => {
      const last = channel.history[channel.history.length - 1];
      all.push({
        id: key,
        type: 'channel',
        name: channel.name,
        lastMsg: last?.text || '',
        lastTime: last?.time || 0,
        unread: 0
      });
    });

    return all.sort((a, b) => b.lastTime - a.lastTime);
  }

  // ============ LOCALSTORAGE ============

  saveToStorage() {
    const data = {
      chats: Array.from(this.chats.entries()),
      groups: Array.from(this.groups.entries()),
      channels: Array.from(this.channels.entries())
    };
    localStorage.setItem('revers_messages', JSON.stringify(data));
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem('revers_messages');
      if (!raw) return;
      
      const data = JSON.parse(raw);
      
      if (data.chats) {
        this.chats = new Map(data.chats);
      }
      if (data.groups) {
        this.groups = new Map(data.groups);
      }
      if (data.channels) {
        this.channels = new Map(data.channels);
      }
    } catch (e) {
      console.log('Ошибка загрузки сообщений:', e);
    }
  }

  // ============ КАРТИНКА-КОНТЕЙНЕР (для стеганографии) ============

  createContainerImage() {
    // Минимальная PNG-заглушка 1×1 пиксель
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  // ============ КОЛБЭКИ ДЛЯ UI ============

  setOnChatUpdate(callback) {
    this.onChatUpdate = callback;
  }

  setOnMessage(callback) {
    this.onMessage = callback;
  }
}

const messageHandler = new MessageHandler();
export default messageHandler;
