// p2p-engine.js — главный API без заглушек

import identity from './identity.js';
import swarmManager from './swarm-manager.js';
import messageHandler from './message-handler.js';
import callManager from './call-manager.js';

class P2PEngine {
  constructor() {
    this.ready = false;
    this._onReady = null;
  }

  async init() {
    console.log('🚀 REVERS Engine запуск...');
    
    await swarmManager.start(identity);
    
    // Проброс signalling для звонков
    swarmManager.onMessage((msg) => {
      if (msg.type === 'call-offer' || msg.type === 'call-answer' || msg.type === 'ice' || msg.type === 'call-end') {
        callManager.handleSignaling(msg.from || msg.peerId, msg);
      } else {
        messageHandler.handleIncoming(msg);
      }
    });

    this.ready = true;
    if (this._onReady) this._onReady();
    console.log('✅ REVERS Engine готов');
  }

  // Профиль
  getMyId() { return identity.id; }
  getMyProfile() { return identity.getProfile(); }
  setName(name) { identity.setName(name); }
  setAvatar(b64) { identity.setAvatar(b64); }

  // Сообщения
  sendMessage(peerId, text) { return messageHandler.sendMessage(peerId, text); }
  sendFile(peerId, file) { return messageHandler.sendFile(peerId, file); }
  getChatHistory(peerId) { return messageHandler.getChatHistory(peerId); }
  getAllChats() { return messageHandler.getAllChats(); }

  // Группы
  createGroup(name) { return messageHandler.createGroup(name); }
  sendGroupMessage(key, text) { return messageHandler.sendGroupMessage(key, text); }
  getGroupHistory(key) { return messageHandler.getGroupHistory(key); }

  // Каналы
  createChannel(name) { return messageHandler.createChannel(name); }
  sendChannelMessage(key, text) { return messageHandler.sendChannelMessage(key, text); }
  getChannelHistory(key) { return messageHandler.getChannelHistory(key); }

  // Звонки
  async startCall(peerId, video = true) { return await callManager.startCall(peerId, video); }
  async acceptCall(peerId, video = true) { return await callManager.acceptCall(peerId, video); }
  endCall(peerId) { callManager.endCall(peerId); }
  toggleAudio(peerId) { callManager.toggleAudio(peerId); }
  toggleVideo(peerId) { callManager.toggleVideo(peerId); }

  // Колбэки
  onMessage(cb) { messageHandler.setOnMessage(cb); }
  onChatUpdate(cb) { messageHandler.setOnChatUpdate(cb); }
  onIncomingCall(cb) { callManager.onIncoming(cb); }
  onRemoteStream(cb) { callManager.onStream(cb); }
  onCallEnded(cb) { callManager.onEnd(cb); }
  onReady(cb) { this._onReady = cb; if (this.ready) cb(); }

  shutdown() {
    callManager.endAllCalls();
    swarmManager.stop();
  }
}

const engine = new P2PEngine();
export default engine;
