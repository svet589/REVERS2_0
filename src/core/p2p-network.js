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
// p2p-network.js — ФИНАЛЬНАЯ ВЕРСИЯ
// ============================================================
// WebRTC + onion-ретрансляция + DHT-обнаружение
// Ключевые исправления:
// - Добавлен getConnectedPeers()
// - Исправлена проверка успеха _connectViaRelay()
// - Убран await перед синхронным sign()
// - Исправлены подписи пакетов
// ============================================================

import identity from './identity.js';
import cryptoModule from './crypto-module.js';

const MAX_RELAY_HOPS = 3;
const RELAY_TIMEOUT = 10000;
const MAX_RELAY_CACHE = 100;

class P2PNetwork {
  constructor() {
    this.peers = new Map();
    this.relayCache = new Map();
    this.onMessageCallback = null;
    this.onPeerCallback = null;
    this.pendingMessages = [];
    this.relayEnabled = true;
    this._natCheckInterval = null;
    this._relaySyncInterval = null;

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 2
    };
  }

  start() {
    console.log('🕸️ P2P Network запущена. ID:', identity.getMyId());
    this._loadRelayCache();
    this._relaySyncInterval = setInterval(() => this._discoverRelays(), 30000);
  }

  // ========== ПРЯМОЕ СОЕДИНЕНИЕ ==========

  async connectToPeer(peerId) {
    if (this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection(this.rtcConfig);
    const dc = pc.createDataChannel('chat', { ordered: true });

    this._setupDC(dc, peerId);
    this._setupPC(pc, peerId);

    pc.onicecandidate = (e) => {
      if (e.candidate && this.onMessageCallback) {
        this.onMessageCallback({
          type: 'p2p-signal',
          from: identity.getMyId(),
          to: peerId,
          signal: { candidate: e.candidate },
          initiator: true
        });
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this._waitForIce(pc);

      if (pc.localDescription && this.onMessageCallback) {
        this.onMessageCallback({
          type: 'p2p-signal',
          from: identity.getMyId(),
          to: peerId,
          signal: { sdp: pc.localDescription },
          initiator: true
        });
      }
    } catch (e) {
      console.log('🔄 Прямое не удалось, пробуем паутину');
      this._connectViaRelay(peerId);
      return;
    }

    this.peers.set(peerId, { pc, dc, connected: false, direct: true });

    setTimeout(() => {
      const entry = this.peers.get(peerId);
      if (entry && !entry.connected && entry.direct) {
        this._connectViaRelay(peerId);
      }
    }, RELAY_TIMEOUT);
  }

  async acceptPeer(peerId, signalData) {
    if (this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection(this.rtcConfig);
    this._setupPC(pc, peerId);
    pc.ondatachannel = (e) => this._setupDC(e.channel, peerId);

    pc.onicecandidate = (e) => {
      if (e.candidate && this.onMessageCallback) {
        this.onMessageCallback({
          type: 'p2p-signal',
          from: identity.getMyId(),
          to: peerId,
          signal: { candidate: e.candidate },
          initiator: false
        });
      }
    };

    try {
      if (signalData.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await this._waitForIce(pc);

        if (this.onMessageCallback) {
          this.onMessageCallback({
            type: 'p2p-signal',
            from: identity.getMyId(),
            to: peerId,
            signal: { sdp: pc.localDescription },
            initiator: false
          });
        }
      }
      if (signalData.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      }
    } catch (e) {
      console.log('🔄 Прямой ответ не удался');
    }

    this.peers.set(peerId, { pc, dc: null, connected: false, direct: true });

    setTimeout(() => {
      const entry = this.peers.get(peerId);
      if (entry && !entry.connected && entry.direct && !entry.relayChain) {
        this._connectViaRelay(peerId);
      }
    }, RELAY_TIMEOUT);
  }

  applySignal(peerId, signalData) {
    const entry = this.peers.get(peerId);
    if (!entry) return;

    if (signalData.sdp) {
      entry.pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp))
        .then(() => {
          if (signalData.sdp.type === 'offer') {
            return entry.pc.createAnswer().then(a => entry.pc.setLocalDescription(a));
          }
        })
        .catch(() => {});
    }

    if (signalData.candidate) {
      entry.pc.addIceCandidate(new RTCIceCandidate(signalData.candidate)).catch(() => {});
    }
  }

  // ========== ONION-РЕТРАНСЛЯЦИЯ ==========

  async _connectViaRelay(targetPeerId) {
    console.log('🕸️ Строим onion-маршрут до', targetPeerId);

    const availableRelays = this._getBestRelays(targetPeerId);
    if (availableRelays.length === 0) {
      console.log('❌ Нет доступных ретрансляторов');
      return;
    }

    const chain = availableRelays.slice(0, MAX_RELAY_HOPS).map(r => r.peerId);
    const chainKeys = availableRelays.slice(0, MAX_RELAY_HOPS).map(r => r.publicKey);

    if (chain.length === 0) return;

    const payload = {
      type: 'connect-request',
      from: identity.getMyId(),
      profile: identity.getProfile()
    };

    const onionPacket = await this._buildOnionPacket(targetPeerId, chain, chainKeys, payload);
    const success = this._sendViaRelayChain(onionPacket, chain);

    if (success) {
      this.peers.set(targetPeerId, {
        pc: null, dc: null,
        connected: true,
        direct: false,
        relayChain: chain,
        relayKeys: chainKeys
      });

      if (this.onPeerCallback) {
        this.onPeerCallback({ type: 'connected', peerId: targetPeerId, viaRelay: true });
      }
    }
  }

  _getBestRelays(targetId) {
    const relays = [];

    this.peers.forEach((entry, peerId) => {
      if (peerId === targetId) return;
      if (entry.connected && entry.profile?.relayEnabled !== false) {
        relays.push({
          peerId,
          publicKey: entry.profile?.x25519PublicKey || entry.profile?.publicKey,
          latency: entry.latency || 999
        });
      }
    });

    this.relayCache.forEach((info, nodeId) => {
      if (nodeId === targetId || nodeId === identity.getMyId()) return;
      if (relays.find(r => r.peerId === nodeId)) return;
      if (Date.now() - info.lastSeen > 300000) return;
      relays.push({
        peerId: info.peerId,
        publicKey: info.publicKey,
        latency: info.latency || 999
      });
    });

    return relays.sort((a, b) => a.latency - b.latency);
  }

  async _buildOnionPacket(targetId, chain, chainKeys, payload) {
    let innerPacket = {
      type: 'relay',
      target: targetId,
      payload: payload,
      ttl: chain.length + 1,
      nonce: cryptoModule.hash(Date.now().toString()).substring(0, 16)
    };

    innerPacket.signature = await this._signPacket(innerPacket);

    for (let i = chain.length - 1; i >= 0; i--) {
      const relayPubKey = chainKeys[i];
      if (!relayPubKey) continue;

      const layerData = {
        nextHop: i < chain.length - 1 ? chain[i + 1] : targetId,
        payload: innerPacket,
        nonce: cryptoModule.hash(Date.now().toString() + i).substring(0, 16)
      };

      const sharedKey = await cryptoModule.computeSharedKey(
        identity.getX25519SecretKey(),
        relayPubKey
      );

      if (sharedKey) {
        const encrypted = cryptoModule.encrypt(sharedKey, JSON.stringify(layerData));
        if (encrypted) {
          const layerSignature = await this._signPacket({ layer: i, nonce: layerData.nonce, encrypted: encrypted.ciphertext });

          innerPacket = {
            type: 'onion-layer',
            layer: i,
            nonce: layerData.nonce,
            encrypted,
            pubkey: identity.getX25519PublicKey(),
            signature: layerSignature
          };
        }
      }
    }

    return {
      type: 'onion-packet',
      layers: chain.length,
      payload: innerPacket,
      route: chain
    };
  }

  async _unwrapOnionLayer(packet) {
    try {
      const relayPubKey = packet.pubkey;
      if (!relayPubKey) return null;

      if (packet.signature) {
        const valid = await this._verifyPacket(
          { layer: packet.layer, nonce: packet.nonce, encrypted: packet.encrypted?.ciphertext },
          relayPubKey,
          packet.signature
        );
        if (!valid) { console.log('❌ Неверная подпись слоя'); return null; }
      }

      const sharedKey = await cryptoModule.computeSharedKey(
        identity.getX25519SecretKey(),
        relayPubKey
      );
      if (!sharedKey) return null;

      const decrypted = cryptoModule.decrypt(sharedKey, packet.encrypted);
      return decrypted ? JSON.parse(decrypted) : null;
    } catch (e) { return null; }
  }

  async _signPacket(packet) {
    const data = JSON.stringify({
      type: packet.type,
      target: packet.target,
      nonce: packet.nonce,
      ttl: packet.ttl || packet.layer
    });
    // sign() синхронный — не нужен await
    return cryptoModule.sign(identity.getX25519SecretKey(), data);
  }

  async _verifyPacket(packet, publicKey, signature) {
    const data = JSON.stringify({
      type: packet.type,
      target: packet.target,
      nonce: packet.nonce,
      ttl: packet.ttl || packet.layer
    });
    return cryptoModule.verify(publicKey, data, signature);
  }

  _sendViaRelayChain(packet, chain) {
    if (chain.length === 0) return false;
    const firstHop = chain[0];
    packet.route = chain.slice(1);
    return this.sendToPeer(firstHop, packet);
  }

  async _handleOnionPacket(msg) {
    if (msg.type !== 'onion-packet') return;

    const unwrapped = await this._unwrapOnionLayer(msg.payload);
    if (!unwrapped) return;

    if (unwrapped.payload?.type === 'relay') {
      const relayMsg = unwrapped.payload;
      relayMsg.ttl--;

      if (relayMsg.target === identity.getMyId()) {
        if (this.onMessageCallback) {
          this.onMessageCallback({ ...relayMsg.payload, from: relayMsg.payload.from });
        }
      } else {
        this.sendToPeer(relayMsg.target, relayMsg.payload);
      }
    } else {
      if (unwrapped.nextHop) {
        this.sendToPeer(unwrapped.nextHop, { ...msg, payload: unwrapped.payload });
      }
    }
  }

  // ========== ОТПРАВКА ==========

  sendToPeer(peerId, data) {
    const entry = this.peers.get(peerId);

    if (entry?.dc?.readyState === 'open') {
      entry.dc.send(JSON.stringify(data));
      return true;
    }

    if (entry?.relayChain && entry?.relayKeys) {
      this._buildOnionPacket(peerId, entry.relayChain, entry.relayKeys, data)
        .then(packet => this._sendViaRelayChain(packet, entry.relayChain));
      return true;
    }

    this.pendingMessages.push({ peerId, data });
    return false;
  }

  // ========== ВНУТРЕННИЕ МЕТОДЫ ==========

  _setupPC(pc, peerId) {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        const entry = this.peers.get(peerId);
        if (entry) {
          entry.connected = true;
          this._flushPending(peerId);
          if (this.onPeerCallback) this.onPeerCallback({ type: 'connected', peerId });
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.peers.delete(peerId);
        if (this.onPeerCallback) this.onPeerCallback({ type: 'disconnected', peerId });
      }
    };
  }

  _setupDC(dc, peerId) {
    dc.onopen = () => {
      console.log('📡 DC открыт:', peerId);
      const entry = this.peers.get(peerId);
      if (entry) entry.dc = dc;
      dc.send(JSON.stringify({ type: 'hello', profile: identity.getProfile() }));
      this._flushPending(peerId);
    };

    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === 'relay-announce') { this._handleRelayAnnounce(msg); return; }
        if (msg.type === 'relay-discover') { this._handleRelayDiscover(msg); return; }
        if (msg.type === 'relay-list') { this._handleRelayList(msg); return; }
        if (msg.type === 'onion-packet') { this._handleOnionPacket(msg); return; }

        if (this.onMessageCallback) {
          this.onMessageCallback({ ...msg, from: peerId });
        }
      } catch (err) {}
    };

    dc.onclose = () => console.log('📡 DC закрыт:', peerId);
  }

  async _waitForIce(pc) {
    return new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') resolve();
      else {
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') resolve();
        };
        setTimeout(resolve, 5000);
      }
    });
  }

  _flushPending(peerId) {
    const msgs = this.pendingMessages.filter(m => m.peerId === peerId);
    const failed = [];
    for (const msg of msgs) {
      const sent = this.sendToPeer(peerId, msg.data);
      if (!sent) failed.push(msg);
    }
    this.pendingMessages = [
      ...this.pendingMessages.filter(m => m.peerId !== peerId),
      ...failed
    ];
  }

  // ========== DHT-ОБНАРУЖЕНИЕ ==========

  _handleRelayAnnounce(msg) {
    if (!msg.relayInfo?.peerId || !msg.relayInfo?.publicKey) return;
    this.relayCache.set(msg.relayInfo.peerId, {
      ...msg.relayInfo,
      lastSeen: Date.now()
    });
    this._saveRelayCache();
  }

  _handleRelayDiscover(msg) {
    const relayList = [...this.relayCache.values()].slice(0, 20);
    const requestor = msg.from || msg.requestId;
    if (requestor) {
      this.sendToPeer(requestor, { type: 'relay-list', relays: relayList });
    }
  }

  _handleRelayList(msg) {
    if (!msg.relays) return;
    msg.relays.forEach(info => {
      if (info.peerId !== identity.getMyId()) {
        this.relayCache.set(info.peerId, { ...info, lastSeen: Date.now() });
      }
    });
    this._saveRelayCache();
  }

  _discoverRelays() {
    this.peers.forEach((entry, peerId) => {
      if (entry.connected) {
        this.sendToPeer(peerId, { type: 'relay-discover', requestId: Date.now().toString(36) });
      }
    });

    const now = Date.now();
    this.relayCache.forEach((info, nodeId) => {
      if (now - info.lastSeen > 300000) this.relayCache.delete(nodeId);
    });
    this._saveRelayCache();
  }

  _saveRelayCache() {
    try {
      const cached = [...this.relayCache.values()].slice(0, MAX_RELAY_CACHE);
      localStorage.setItem('revers_relay_cache', JSON.stringify(cached));
    } catch (e) {}
  }

  _loadRelayCache() {
    try {
      const cached = JSON.parse(localStorage.getItem('revers_relay_cache') || '[]');
      cached.forEach(info => {
        this.relayCache.set(info.peerId, { ...info, lastSeen: Date.now() });
      });
    } catch (e) {}
  }

  // ========== ПУБЛИЧНЫЕ МЕТОДЫ ==========

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #16
  getConnectedPeers() {
    return [...this.peers.entries()]
      .filter(([_, entry]) => entry.connected)
      .map(([id]) => id);
  }

  isConnected(peerId) {
    return this.peers.get(peerId)?.connected || false;
  }

  onMessage(cb) { this.onMessageCallback = cb; }
  onPeerEvent(cb) { this.onPeerCallback = cb; }

  stop() {
    if (this._natCheckInterval) clearInterval(this._natCheckInterval);
    if (this._relaySyncInterval) clearInterval(this._relaySyncInterval);
    this._saveRelayCache();
    this.peers.forEach(e => {
      try { e.pc?.close(); } catch (_) {}
      try { e.dc?.close(); } catch (_) {}
    });
    this.peers.clear();
  }
}

export default new P2PNetwork();
