import identity from './identity.js';
import p2pNetwork from './p2p-network.js';
import cryptoModule from './crypto-module.js';
import messageHandler from './message-handler.js';
import callManager from './call-manager.js';

class P2PEngine {
  constructor() {
    this.ready = false;
    this._onReady = null;
    this.p2pNetwork = p2pNetwork; // Для доступа из app.js
  }

  async init() {
    console.log('╔══════════════════════════╗');
    console.log('║   REVERS ENGINE v1.0    ║');
    console.log('╚══════════════════════════╝');
    p2pNetwork.start();
    p2pNetwork.onMessage((msg) => {
      switch(msg.type) {
        case 'call-signal': callManager.handleSignal(msg.from, msg); break;
        case 'p2p-signal': messageHandler.handleIncoming(msg); break;
        default: messageHandler.handleIncoming(msg); break;
      }
    });
    p2pNetwork.onPeerEvent((event) => { console.log(`🔵 Пир ${event.peerId}: ${event.type}`); });
    this.ready = true;
    console.log('✅ Engine готов. Мой ID:', identity.id);
    if (this._onReady) this._onReady();
  }

  getMyId() { return identity.id; }
  getMyProfile() { return identity.getProfile(); }
  setName(name) { identity.setName(name); }
  setAvatar(b64) { identity.setAvatar(b64); }

  connectToPeer(peerId) { return p2pNetwork.connectToPeer(peerId); }
  acceptPeer(peerId, signal) { return p2pNetwork.acceptPeer(peerId, signal); }
  applySignal(peerId, signal) { return p2pNetwork.applySignal(peerId, signal); }
  isConnected(peerId) { return p2pNetwork.isConnected(peerId); }
  getConnectedPeers() { return p2pNetwork.getConnectedPeers(); }

  sendMessage(peerId, text) { return messageHandler.sendMessage(peerId, text); }
  sendFile(peerId, file) { return messageHandler.sendFile(peerId, file); }
  sendVoice(peerId, audio, duration) { return messageHandler.sendVoice(peerId, audio, duration); }
  async recordVoice() { return await messageHandler.recordVoice(); }
  getChatHistory(peerId) { return messageHandler.getChatHistory(peerId); }
  getAllChats() { return messageHandler.getAllChats(); }

  createGroup(name) { return messageHandler.createGroup(name); }
  sendGroupMessage(key, text) { return messageHandler.sendGroupMessage(key, text); }
  getGroupHistory(key) { return messageHandler.getGroupHistory(key); }

  createChannel(name) { return messageHandler.createChannel(name); }
  sendChannelMessage(key, text) { return messageHandler.sendChannelMessage(key, text); }
  getChannelHistory(key) { return messageHandler.getChannelHistory(key); }

  async startCall(peerId, video = true) { return await callManager.startCall(peerId, video); }
  async acceptCall(peerId, video = true) { return await callManager.acceptCall(peerId, video); }
  endCall(peerId) { callManager.endCall(peerId); }
  toggleAudio(peerId) { callManager.toggleAudio(peerId); }
  toggleVideo(peerId) { callManager.toggleVideo(peerId); }

  encodeStegano(img, text) { return cryptoModule.encodeStegano(img, text); }
  decodeStegano(img) { return cryptoModule.decodeStegano(img); }

  onMessage(cb) { messageHandler.setOnMessage(cb); }
  onChatUpdate(cb) { messageHandler.setOnChatUpdate(cb); }
  onIncomingCall(cb) { callManager.onIncoming(cb); }
  onRemoteStream(cb) { callManager.onStream(cb); }
  onCallEnded(cb) { callManager.onEnd(cb); }
  onReady(cb) { this._onReady = cb; if (this.ready) cb(); }

  shutdown() { callManager.endAllCalls(); p2pNetwork.stop(); }
}

export default new P2PEngine();
