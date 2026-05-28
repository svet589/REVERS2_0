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

  sendMessage(peerId, text) {
    if (!cryptoModule.ratchetStates.has(peerId) && peerId !== 'me') {
      cryptoModule.initRatchet(peerId, cryptoModule.computeSharedSecret(identity.secretKey, identity.publicKey));
    }
    const encrypted = peerId === 'me' ? { encrypted: text } : cryptoModule.encryptMessage(peerId, text);
    const sent = peerId === 'me' ? true : p2pNetwork.sendToPeer(peerId, { type: 'message', data: encrypted });
    this._saveMsg(peerId, { from: identity.id, text, time: Date.now(), type: 'text', sent: !!sent });
    return sent;
  }

  sendFile(peerId, file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        let payload = base64;
        if (file.size > 5000 && file.type.startsWith('image/')) {
          try { payload = await cryptoModule.encodeStegano(base64, 'REVERS_FILE'); } catch(_) {}
        }
        const msg = { from: identity.id, text: `📎 ${file.name}`, time: Date.now(), type: 'file', fileData: payload, fileName: file.name, fileSize: file.size, fileType: file.type, sent: true };
        if (peerId === 'me') {
          this._saveMsg(peerId, msg);
          resolve(true);
          return;
        }
        const sent = p2pNetwork.sendToPeer(peerId, { type: 'file', name: file.name, size: file.size, mime: file.type, data: payload });
        this._saveMsg(peerId, msg);
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
        mr.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        };
        mr.start();
        resolve({ stop: () => mr.stop(), recorder: mr });
      });
    } catch(e) { return null; }
  }

  sendVoice(peerId, audioBase64, duration) {
    const msg = { from: identity.id, text: `🎤 Голосовое (${duration}с)`, time: Date.now(), type: 'voice', fileData: audioBase64, fileType: 'audio/webm', duration, sent: true };
    if (peerId === 'me') { this._saveMsg(peerId, msg); return true; }
    const sent = p2pNetwork.sendToPeer(peerId, { type: 'voice', data: audioBase64, duration });
    this._saveMsg(peerId, msg);
    return sent;
  }

  createGroup(name) {
    const key = 'group_' + Date.now().toString(36);
    this.groups.set(key, { name, admin: identity.id, members: [identity.id], history: [], created: Date.now() });
    this._save(); return key;
  }

  sendGroupMessage(key, text) {
    const g = this.groups.get(key);
    if (!g) return false;
    g.history.push({ from: identity.id, text, time: Date.now(), type: 'text' });
    this._save(); if (this.onChatUpdate) this.onChatUpdate(); return true;
  }

  createChannel(name) {
    const key = 'channel_' + Date.now().toString(36);
    this.channels.set(key, { name, admin: identity.id, history: [], created: Date.now() });
    this._save(); return key;
  }

  sendChannelMessage(key, text) {
    const c = this.channels.get(key);
    if (!c || c.admin !== identity.id) return false;
    c.history.push({ from: identity.id, text, time: Date.now(), type: 'text' });
    this._save(); if (this.onChatUpdate) this.onChatUpdate(); return true;
  }

  handleIncoming(msg) {
    const { from, data, type } = msg;
    if (type === 'hello') { if (this.onChatUpdate) this.onChatUpdate(); return; }
    if (type === 'p2p-signal') { if (this.onMessage) this.onMessage(msg); return; }
    let text = data?.text || data?.encrypted || '';
    try { if (data?.encrypted) text = cryptoModule.decryptMessage(from, data); } catch(_) {}
    const m = { from, text: typeof text === 'string' ? text : String(text), time: Date.now(), type: type || 'text', fileData: data?.data, fileName: data?.name, fileSize: data?.size, fileType: data?.mime, duration: data?.duration };
    this._saveMsg(from, m);
    if (this.onMessage) this.onMessage(m);
    if (this.onChatUpdate) this.onChatUpdate();
  }

  _saveMsg(peerId, msg) { if (!this.chats.has(peerId)) this.chats.set(peerId, []); this.chats.get(peerId).push(msg); this._save(); }

  getChatHistory(peerId) { return this.chats.get(peerId) || []; }
  getGroupHistory(key) { return this.groups.get(key)?.history || []; }
  getChannelHistory(key) { return this.channels.get(key)?.history || []; }

  getAllChats() {
    const all = [];
    const saved = this.chats.get('me') || [];
    const ls = saved[saved.length - 1];
    all.push({ id: 'me', type: 'saved', name: '📔 Сохранённые', lastMsg: ls?.text || 'Нет сообщений', lastTime: ls?.time || Date.now(), unread: 0 });
    this.chats.forEach((msgs, id) => {
      if (id === 'me') return;
      const l = msgs[msgs.length - 1];
      if (l) all.push({ id, type: 'contact', name: id, lastMsg: l.text, lastTime: l.time, unread: 0 });
    });
    this.groups.forEach((g, key) => {
      const l = g.history[g.history.length - 1];
      all.push({ id: key, type: 'group', name: '👥 ' + g.name, lastMsg: l?.text || '', lastTime: l?.time || 0, unread: 0 });
    });
    this.channels.forEach((c, key) => {
      const l = c.history[c.history.length - 1];
      all.push({ id: key, type: 'channel', name: '📢 ' + c.name, lastMsg: l?.text || '', lastTime: l?.time || 0, unread: 0 });
    });
    return all.sort((a, b) => b.lastTime - a.lastTime);
  }

  _save() {
    try {
      localStorage.setItem('revers_chats', JSON.stringify(Array.from(this.chats.entries())));
      localStorage.setItem('revers_groups', JSON.stringify(Array.from(this.groups.entries())));
      localStorage.setItem('revers_channels', JSON.stringify(Array.from(this.channels.entries())));
    } catch(_) {}
  }

  _loadFromStorage() {
    try {
      const c = JSON.parse(localStorage.getItem('revers_chats'));
      const g = JSON.parse(localStorage.getItem('revers_groups'));
      const ch = JSON.parse(localStorage.getItem('revers_channels'));
      if (c) this.chats = new Map(c);
      if (g) this.groups = new Map(g);
      if (ch) this.channels = new Map(ch);
      if (!this.chats.has('me')) this.chats.set('me', []);
    } catch(_) { this.chats.set('me', []); }
  }

  setOnChatUpdate(cb) { this.onChatUpdate = cb; }
  setOnMessage(cb) { this.onMessage = cb; }
}

export default new MessageHandler();
