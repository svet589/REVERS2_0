import identity from './identity.js';
import p2pNetwork from './p2p-network.js';
import messageHandler from './message-handler.js';
import callManager from './call-manager.js';
import groupManager from './group-manager.js';

class P2PEngine {
  constructor() {
    this.ready = false;
    this._onReady = null;
    this.p2pNetwork = p2pNetwork;
  }

  async init() {
    console.log('╔══════════════════════════╗');
    console.log('║   REVERS ENGINE v1.3          ║');
    console.log('╚══════════════════════════╝');
    p2pNetwork.start();
    p2pNetwork.onMessage((msg) => {
      if (msg.type === 'call-signal') callManager.handleSignal(msg.from, msg);
      else if (msg.type === 'p2p-signal') messageHandler.handleIncoming(msg);
      else messageHandler.handleIncoming(msg);
    });
    this.ready = true;
    console.log('✅ Engine готов. Мой ID:', identity.id);
    if (this._onReady) this._onReady();
  }

  getMyId() { return identity.id; }
  getMyProfile() { return identity.getProfile(); }
  setName(n) { identity.setName(n); }
  setAvatar(b) { identity.setAvatar(b); }

  connectToPeer(id) { return p2pNetwork.connectToPeer(id); }
  acceptPeer(id, s) { return p2pNetwork.acceptPeer(id, s); }
  applySignal(id, s) { return p2pNetwork.applySignal(id, s); }
  isConnected(id) { return p2pNetwork.isConnected(id); }

  sendMessage(id, t) { return messageHandler.sendMessage(id, t); }
  sendFile(id, f) { return messageHandler.sendFile(id, f); }
  sendVoice(id, a, d) { return messageHandler.sendVoice(id, a, d); }
  async recordVoice() { return await messageHandler.recordVoice(); }
  async getChatHistory(id) { return await messageHandler.getChatHistory(id); }
  async getAllChats() { return await messageHandler.getAllChats(); }
  async clearChatHistory(id) { return await messageHandler.clearChatHistory(id); }

  createGroup(n, t = 'chat') { return groupManager.createGroup(n, t); }
  sendGroupMessage(k, t) { return groupManager.sendGroupMessage(k, t); }
  getGroupHistory(k) { return groupManager.groups.get(k)?.history || []; }

  createChannel(n) { return messageHandler.createChannel(n); }
  sendChannelMessage(k, t) { return messageHandler.sendChannelMessage(k, t); }
  getChannelHistory(k) { return messageHandler.getChannelHistory(k); }

  async startCall(id, v = true) { return await callManager.startCall(id, v); }
  async acceptCall(id, v = true) { return await callManager.acceptCall(id, v); }
  endCall(id) { callManager.endCall(id); }
  toggleAudio(id) { callManager.toggleAudio(id); }
  toggleVideo(id) { callManager.toggleVideo(id); }

  onMessage(cb) { messageHandler.setOnMessage(cb); }
  onChatUpdate(cb) { messageHandler.setOnChatUpdate(cb); }
  onIncomingCall(cb) { callManager.onIncoming(cb); }
  onRemoteStream(cb) { callManager.onStream(cb); }
  onCallEnded(cb) { callManager.onEnd(cb); }
  onReady(cb) { this._onReady = cb; if (this.ready) cb(); }

  shutdown() { callManager.endAllCalls(); p2pNetwork.stop(); }
}

export default new P2PEngine();
