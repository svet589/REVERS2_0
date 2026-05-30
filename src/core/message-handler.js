import p2pNetwork from './p2p-network.js';
import identity from './identity.js';
import storage from './storage-adapter.js';
import groupManager from './group-manager.js';

const CHUNK_SIZE = 65536;

class MessageHandler {
  constructor() {
    this.chats = new Map();
    this.channels = new Map();
    this.onChatUpdate = null;
    this.onMessage = null;
    this._fileBuffers = new Map();
    this._init();
  }

  async _init() {
    await storage.ready;
    this.chats.set('me', []);
    if (this.onChatUpdate) this.onChatUpdate();
  }

  sendMessage(peerId, text) {
    const msg = { from: identity.id, text, time: Date.now(), type: 'text', sent: true };
    if (peerId === 'me') { this._saveMsg(peerId, msg); return true; }
    p2pNetwork.sendToPeer(peerId, { type: 'message', data: text });
    this._saveMsg(peerId, msg);
    return true;
  }

  sendFile(peerId, file) {
    return new Promise((resolve) => {
      if (file.size < 1048576) {
        const reader = new FileReader();
        reader.onload = () => {
          const msg = { from: identity.id, text: `📎 ${file.name}`, time: Date.now(), type: 'file', fileData: reader.result, fileName: file.name, fileSize: file.size, fileType: file.type, sent: true };
          if (peerId !== 'me') p2pNetwork.sendToPeer(peerId, { type: 'file', name: file.name, size: file.size, mime: file.type, data: reader.result });
          this._saveMsg(peerId, msg);
          resolve(true);
        };
        reader.readAsDataURL(file);
        return;
      }

      const fileId = 'file_' + Date.now().toString(36);
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      if (peerId !== 'me') p2pNetwork.sendToPeer(peerId, { type: 'file-start', fileId, name: file.name, size: file.size, mime: file.type, totalChunks });
      const reader = file.stream().getReader();
      const read = () => reader.read().then(({ done, value }) => {
        if (done) {
          if (peerId !== 'me') p2pNetwork.sendToPeer(peerId, { type: 'file-end', fileId });
          this._saveMsg(peerId, { from: identity.id, text: `📎 ${file.name}`, time: Date.now(), type: 'file', fileName: file.name, fileSize: file.size, fileType: file.type, fileId, sent: true, chunks: totalChunks });
          resolve(true);
          return;
        }
        if (peerId !== 'me') p2pNetwork.sendToPeer(peerId, { type: 'file-chunk', fileId, chunk: btoa(String.fromCharCode(...value)), index: 0, total: totalChunks });
        setTimeout(read, 10);
      });
      read();
    });
  }

  async recordVoice() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = e => chunks.push(e.data);
      return new Promise(resolve => {
        mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(new Blob(chunks, { type: 'audio/webm' })); };
        mr.start();
        resolve({ stop: () => mr.stop(), recorder: mr, chunks });
      });
    } catch(e) { return null; }
  }

  sendVoice(peerId, audioBase64, duration) {
    const msg = { from: identity.id, text: `🎤 Голосовое (${duration}с)`, time: Date.now(), type: 'voice', fileData: audioBase64, fileType: 'audio/webm', duration, sent: true };
    if (peerId !== 'me') p2pNetwork.sendToPeer(peerId, { type: 'voice', data: audioBase64, duration });
    this._saveMsg(peerId, msg);
    return true;
  }

  createChannel(name) {
    const key = 'channel_' + Date.now().toString(36);
    this.channels.set(key, { name, admin: identity.id, history: [], created: Date.now() });
    this._saveChannels();
    return key;
  }

  sendChannelMessage(key, text) {
    const c = this.channels.get(key);
    if (!c || c.admin !== identity.id) return false;
    c.history.push({ from: identity.id, text, time: Date.now(), type: 'text' });
    this._saveChannels();
    if (this.onChatUpdate) this.onChatUpdate();
    return true;
  }

  handleIncoming(msg) {
    const { from, type } = msg;
    if (type === 'hello') { if (this.onChatUpdate) this.onChatUpdate(); return; }
    if (type === 'p2p-signal') { if (this.onMessage) this.onMessage(msg); return; }
    if (type === 'file-start') { this._fileBuffers.set(msg.fileId, { ...msg, chunks: [], received: 0 }); return; }
    if (type === 'file-chunk') { const b = this._fileBuffers.get(msg.fileId); if (b) { b.chunks[msg.index || b.received] = msg.chunk; b.received++; } return; }
    if (type === 'file-end') {
      const b = this._fileBuffers.get(msg.fileId);
      if (b) {
        const m = { from, text: `📎 ${b.name}`, time: Date.now(), type: 'file', fileData: b.chunks.join(''), fileName: b.name, fileSize: b.size, fileType: b.mime, sent: false };
        this._saveMsg(from, m);
        this._fileBuffers.delete(msg.fileId);
        if (this.onMessage) this.onMessage(m);
        if (this.onChatUpdate) this.onChatUpdate();
      }
      return;
    }

    const m = { from, text: msg.data?.text || msg.data || '', time: Date.now(), type: type || 'text', fileData: msg.data?.data, fileName: msg.data?.name, fileSize: msg.data?.size, fileType: msg.data?.mime, duration: msg.data?.duration };
    this._saveMsg(from, m);
    if (this.onMessage) this.onMessage(m);
    if (this.onChatUpdate) this.onChatUpdate();
  }

  async _saveMsg(peerId, msg) {
    if (!this.chats.has(peerId)) this.chats.set(peerId, []);
    this.chats.get(peerId).push(msg);
    await storage.saveMessage(peerId, msg);
  }

  async getChatHistory(peerId) {
    const msgs = await storage.getMessages(peerId);
    return msgs.length > 0 ? msgs : this.chats.get(peerId) || [];
  }

  getGroupHistory(key) { return groupManager.groups.get(key)?.history || []; }
  getChannelHistory(key) { return this.channels.get(key)?.history || []; }

  async getAllChats() {
    const all = [];
    const savedMsgs = await storage.getMessages('me');
    const ls = savedMsgs[savedMsgs.length - 1];
    all.push({ id: 'me', type: 'saved', name: '📔 Сохранённые', lastMsg: ls?.text || 'Нет сообщений', lastTime: ls?.time || Date.now(), unread: 0 });
    this.chats.forEach((msgs, id) => { if (id === 'me') return; const l = msgs[msgs.length - 1]; if (l) all.push({ id, type: 'contact', name: id, lastMsg: l.text, lastTime: l.time, unread: 0 }); });
    groupManager.groups.forEach((g, key) => { const l = g.history[g.history.length - 1]; all.push({ id: key, type: 'group', name: (g.type === 'forum' ? '📂 ' : '👥 ') + g.name, lastMsg: l?.text || '', lastTime: l?.time || 0, unread: 0 }); });
    this.channels.forEach((c, key) => { const l = c.history[c.history.length - 1]; all.push({ id: key, type: 'channel', name: '📢 ' + c.name, lastMsg: l?.text || '', lastTime: l?.time || 0, unread: 0 }); });
    return all.sort((a, b) => b.lastTime - a.lastTime);
  }

  async clearChatHistory(peerId) {
    if (this.chats.has(peerId)) this.chats.set(peerId, []);
    await storage.clearChat(peerId);
  }

  _saveChannels() { try { localStorage.setItem('revers_channels', JSON.stringify(Array.from(this.channels.entries()))); } catch(e) {} }

  setOnChatUpdate(cb) { this.onChatUpdate = cb; }
  setOnMessage(cb) { this.onMessage = cb; }
}

export default new MessageHandler();
