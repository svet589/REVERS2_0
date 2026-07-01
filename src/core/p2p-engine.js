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
// ============================================================
// p2p-engine.js — ФИНАЛЬНАЯ ВЕРСИЯ
// ============================================================
import identity from './identity.js';
import cryptoModule from './crypto-module.js';
import p2pNetwork from './p2p-network.js';
import messageHandler from './message-handler.js';
import callManager from './call-manager.js';
import groupManager from './group-manager.js';
import swarmManager from './swarm-manager.js';

class P2PEngine {
  constructor() {
    this.ready = false;
    this._onReady = null;
  }

  async init() {
    await identity.ready();
    await cryptoModule.ready();
    p2pNetwork.start();

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #7: интеграция swarm-manager
    await swarmManager.start();
    swarmManager.onMessage((msg) => {
      messageHandler.handleIncoming(msg);
    });

    p2pNetwork.onMessage((msg) => {
      if (msg.type === 'call-signal') callManager.handleSignal(msg.from, msg);
      else if (msg.type === 'group_message') messageHandler.handleIncoming(msg);
      else messageHandler.handleIncoming(msg);
    });

    this.ready = true;
    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #8: экспорт в window
    window.REVERS = this;
    if (this._onReady) this._onReady();
  }

  getMyId() { return identity.getMyId(); }
  getMyProfile() { return identity.getProfile(); }
  setName(n) { identity.setName(n); }
  setAvatar(b) { identity.setAvatar(b); }

  connectToPeer(id) { return p2pNetwork.connectToPeer(id); }
  acceptPeer(id, s) { return p2pNetwork.acceptPeer(id, s); }
  isConnected(id) { return p2pNetwork.isConnected(id); }

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #6: недостающие методы
  getConnectedPeers() { return p2pNetwork.getConnectedPeers(); }
  sendTyping(peerId, isTyping = true) { p2pNetwork.sendToPeer(peerId, { type: 'typing', isTyping }); }
  async startGroupCall(groupKey, video = true) { return callManager.startGroupCall(groupKey, video); }

  sendMessage(id, t) { return messageHandler.sendMessage(id, t); }
  sendFile(id, f) { return messageHandler.sendFile(id, f); }
  sendVoice(id, a, d) { return messageHandler.sendVoice(id, a, d); }
  sendGift(id, g) { return messageHandler.sendGift(id, g); }
  recordVoice() { return messageHandler.recordVoice(); }
  getChatHistory(id) { return messageHandler.getChatHistory(id); }
  getAllChats() { return messageHandler.getAllChats(); }
  clearChatHistory(id) { return messageHandler.clearChatHistory(id); }

  createGroup(n, t) { return groupManager.createGroup(n, t); }
  sendGroupMessage(k, t) { return messageHandler.sendGroupMessage(k, t); }
  getGroupHistory(k) { return groupManager.groups.get(k)?.history || []; }

  createChannel(n) { return messageHandler.createChannel(n); }
  sendChannelMessage(k, t) { return messageHandler.sendChannelMessage(k, t); }
  getChannelHistory(k) { return messageHandler.getChannelHistory(k); }

  startCall(id, v) { return callManager.startCall(id, v); }
  acceptCall(id, v, o, k) { return callManager.acceptCall(id, v, o, k); }
  endCall(id) { callManager.endCall(id); }
  toggleAudio(id) { callManager.toggleAudio(id); }
  toggleVideo(id) { callManager.toggleVideo(id); }

  onMessage(cb) { messageHandler.setOnMessage(cb); }
  onChatUpdate(cb) { messageHandler.setOnChatUpdate(cb); }
  onIncomingCall(cb) { callManager.onIncoming(cb); }
  onRemoteStream(cb) { callManager.onStream(cb); }
  onCallEnded(cb) { callManager.onEnd(cb); }
  onReady(cb) { this._onReady = cb; if (this.ready) cb(); }
}

const engine = new P2PEngine();
export default engine;
