// p2p-engine.js — главный API, собирает всё ядро воедино

import identity from './identity.js';
import cryptoModule from './crypto-module.js';
import swarmManager from './swarm-manager.js';
import messageHandler from './message-handler.js';
import callManager from './call-manager.js';

class P2PEngine {
  constructor() {
    this.ready = false;
    this.onReadyCallback = null;
  }

  // ============ ИНИЦИАЛИЗАЦИЯ ============

  async init() {
    console.log('🚀 REVERS Engine запускается...');
    
    // 1. Загружаем профиль
    const profile = identity.getProfile();
    console.log('👤 Профиль:', profile.id);

    // 2. Запускаем P2P-сеть
    await swarmManager.start(identity);
    
    // 3. Подписываемся на входящие сообщения
    swarmManager.onMessage((msg) => {
      messageHandler.handleIncoming(msg);
    });

    // 4. Подписываемся на peer-события
    swarmManager.onPeerEvent((event) => {
      if (event.type === 'connected') {
        console.log('🟢 Пир подключился:', event.peerId);
      } else if (event.type === 'disconnected') {
        console.log('🔴 Пир отключился:', event.peerId);
      }
    });

    // 5. Обработка signalling для звонков
    swarmManager.onMessage((msg) => {
      if (msg.data?.type === 'signaling') {
        callManager.handleSignaling(msg.from, msg.data.callData);
      }
    });

    // 6. Обработка incoming call
    callManager.setOnIncomingCall((data) => {
      if (this.onIncomingCall) {
        this.onIncomingCall(data);
      }
    });

    callManager.setOnCallEnded((data) => {
      if (this.onCallEnded) {
        this.onCallEnded(data);
      }
    });

    callManager.setOnStreamReady((data) => {
      if (this.onRemoteStream) {
        this.onRemoteStream(data);
      }
    });

    this.ready = true;
    console.log('✅ REVERS Engine готов!');
    
    if (this.onReadyCallback) this.onReadyCallback();
  }

  // ============ API ДЛЯ UI ============

  // Профиль
  getMyId() {
    return identity.id;
  }

  getMyProfile() {
    return identity.getProfile();
  }

  setMyName(name) {
    identity.setName(name);
  }

  setMyAvatar(base64) {
    identity.setAvatar(base64);
  }

  // Сообщения
  sendMessage(peerId, text) {
    return messageHandler.sendMessage(peerId, text);
  }

  sendFile(peerId, file) {
    return messageHandler.sendFile(peerId, file);
  }

  getChatHistory(peerId) {
    return messageHandler.getChatHistory(peerId);
  }

  getAllChats() {
    return messageHandler.getAllChats();
  }

  onMessage(callback) {
    messageHandler.setOnMessage(callback);
  }

  onChatUpdate(callback) {
    messageHandler.setOnChatUpdate(callback);
  }

  // Группы
  createGroup(name) {
    return messageHandler.createGroup(name);
  }

  joinGroup(groupKey) {
    messageHandler.joinGroup(groupKey);
  }

  sendGroupMessage(groupKey, text) {
    return messageHandler.sendGroupMessage(groupKey, text);
  }

  getGroupHistory(groupKey) {
    return messageHandler.getGroupHistory(groupKey);
  }

  // Каналы
  createChannel(name) {
    return messageHandler.createChannel(name);
  }

  sendChannelMessage(channelKey, text) {
    return messageHandler.sendChannelMessage(channelKey, text);
  }

  getChannelHistory(channelKey) {
    return messageHandler.getChannelHistory(channelKey);
  }

  // Звонки
  async startCall(peerId, video = true) {
    return await callManager.startCall(peerId, video);
  }

  async answerCall(peerId, video = true) {
    return await callManager.answerCall(peerId, video);
  }

  endCall(peerId) {
    callManager.endCall(peerId);
  }

  toggleAudio(peerId) {
    callManager.toggleAudio(peerId);
  }

  toggleVideo(peerId) {
    callManager.toggleVideo(peerId);
  }

  onIncomingCall(callback) {
    this.onIncomingCall = callback;
  }

  onCallEnded(callback) {
    this.onCallEnded = callback;
  }

  onRemoteStream(callback) {
    this.onRemoteStream = callback;
  }

  // Туннель (для будущих фич)
  createTunnel(peerChain) {
    return swarmManager.createTunnel(peerChain);
  }

  // Когда движок готов
  onReady(callback) {
    this.onReadyCallback = callback;
    if (this.ready) callback();
  }

  // Стеганография (публичные методы)
  async encodeStegano(imageBase64, text) {
    return await cryptoModule.encodeStegano(imageBase64, text);
  }

  async decodeStegano(imageBase64) {
    return await cryptoModule.decodeStegano(imageBase64);
  }

  // Выключение
  async shutdown() {
    callManager.endAllCalls();
    await swarmManager.stop();
    console.log('REVERS Engine остановлен');
  }
}

// Экспортируем синглтон
const p2pEngine = new P2PEngine();

// Делаем доступным глобально для UI
if (typeof window !== 'undefined') {
  window.REVERS = p2pEngine;
}

export default p2pEngine;
