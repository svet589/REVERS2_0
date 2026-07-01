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
// swarm-manager.js — ФИНАЛЬНАЯ ВЕРСИЯ
// ============================================================
// DHT-ядро для REVERS
// Ключевые исправления:
// - Исправлен sendToPeer (проверка peer)
// - Исправлен handlePeerConnected
// - Исправлен getBestRelays
// - Добавлен getConnectedPeers
// ============================================================

import identity from './identity.js';
import cryptoModule from './crypto-module.js';
import messageHandler from './message-handler.js';

const OFFLINE_TTL = 86400000; // 24 часа
const MAX_OFFLINE_MSGS = 50;
const RELAY_ANNOUNCE_INTERVAL = 30000;

class SwarmManager {
  constructor() {
    this.peers = new Map();
    this.offlineMessages = new Map();
    this.relayCache = new Map();
    this.onMessageCallback = null;
    this.onPeerCallback = null;
    this._relayInterval = null;
    this._started = false;
  }

  async start() {
    if (this._started) return;
    this._started = true;
    console.log('🕸️ DHT-ядро v2.0 запущено. ID:', identity.getMyId());

    this._loadOfflineMessages();
    this._announceAsRelay();
    this._relayInterval = setInterval(() => this._announceAsRelay(), RELAY_ANNOUNCE_INTERVAL);
    setInterval(() => this._cleanOfflineMessages(), 300000);
  }

  // ========== ПОДКЛЮЧЕНИЕ ПИРА ==========

  async handlePeerConnected(peerId, conn) {
    if (this.peers.has(peerId)) return;

    console.log('🔗 DHT-пир подключён:', peerId);

    const e2eeKey = await messageHandler.getSharedKey(peerId);

    const peer = {
      conn,
      e2eeKey,
      profile: null,
      connected: true,
      lastSeen: Date.now()
    };

    this.peers.set(peerId, peer);

    const profile = identity.getProfile();
    const helloMsg = { type: 'dht-hello', profile };

    if (e2eeKey) {
      const encrypted = cryptoModule.encrypt(e2eeKey, JSON.stringify(helloMsg));
      if (encrypted) {
        this._sendRaw(conn, { type: 'dht-hello', data: encrypted });
      }
    } else {
      this._sendRaw(conn, helloMsg);
    }

    await this._deliverOfflineMessages(peerId);

    if (this.onPeerCallback) {
      this.onPeerCallback({ type: 'dht-connected', peerId, profile });
    }
  }

  handlePeerDisconnected(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    peer.connected = false;
    peer.lastSeen = Date.now();

    console.log('🔌 DHT-пир отключён:', peerId);

    if (this.onPeerCallback) {
      this.onPeerCallback({ type: 'dht-disconnected', peerId });
    }
  }

  // ========== ОТПРАВКА ==========

  async sendToPeer(peerId, data) {
    const peer = this.peers.get(peerId);

    if (!peer) {
      return this._sendOffline(peerId, data);
    }

    if (peer.connected && peer.conn) {
      return this._sendEncrypted(peer, data);
    }

    return this._sendOffline(peerId, data);
  }

  async _sendEncrypted(peer, data) {
    if (peer.e2eeKey) {
      const encrypted = cryptoModule.encrypt(peer.e2eeKey, JSON.stringify(data));
      if (encrypted) {
        return this._sendRaw(peer.conn, { type: 'dht-message', data: encrypted });
      }
    }
    return this._sendRaw(peer.conn, data);
  }

  _sendRaw(conn, data) {
    try {
      if (conn?.write) {
        conn.write(JSON.stringify(data));
        return true;
      }
    } catch (e) {
      console.error('Ошибка отправки DHT:', e);
    }
    return false;
  }

  // ========== ОФЛАЙН-СООБЩЕНИЯ ==========

  async _sendOffline(peerId, data) {
    const messages = this.offlineMessages.get(peerId) || [];

    if (messages.length >= MAX_OFFLINE_MSGS) {
      messages.shift();
    }

    messages.push({
      data,
      timestamp: Date.now(),
      ttl: Date.now() + OFFLINE_TTL
    });

    this.offlineMessages.set(peerId, messages);
    this._saveOfflineMessages();

    console.log('💾 Сообщение сохранено для офлайн-пира', peerId);
    return true;
  }

  async _deliverOfflineMessages(peerId) {
    const messages = this.offlineMessages.get(peerId);
    if (!messages || messages.length === 0) return;

    const peer = this.peers.get(peerId);
    if (!peer?.connected) return;

    console.log('📬 Доставляем офлайн-сообщения для', peerId, ':', messages.length);

    const now = Date.now();
    const validMessages = messages.filter(m => m.ttl > now);

    for (const msg of validMessages) {
      await this._sendEncrypted(peer, msg.data);
    }

    this.offlineMessages.set(peerId, []);
    this._saveOfflineMessages();
  }

  _cleanOfflineMessages() {
    const now = Date.now();
    let cleaned = 0;

    for (const [peerId, messages] of this.offlineMessages) {
      const valid = messages.filter(m => m.ttl > now);
      if (valid.length !== messages.length) {
        cleaned += messages.length - valid.length;
        this.offlineMessages.set(peerId, valid);
      }
    }

    if (cleaned > 0) {
      console.log('🧹 Удалено просроченных офлайн-сообщений:', cleaned);
      this._saveOfflineMessages();
    }
  }

  _saveOfflineMessages() {
    try {
      const data = Array.from(this.offlineMessages.entries());
      localStorage.setItem('revers_offline_msgs', JSON.stringify(data));
    } catch (e) {}
  }

  _loadOfflineMessages() {
    try {
      const data = JSON.parse(localStorage.getItem('revers_offline_msgs'));
      if (data) this.offlineMessages = new Map(data);
    } catch (e) {}
  }

  // ========== РЕТРАНСЛЯЦИЯ ==========

  _announceAsRelay() {
    const relayInfo = {
      peerId: identity.getMyId(),
      publicKey: identity.getX25519PublicKey(),
      natType: 'dht',
      timestamp: Date.now()
    };

    this.peers.forEach((peer, peerId) => {
      if (peer.connected) {
        this._sendEncrypted(peer, { type: 'relay-announce', relayInfo });
      }
    });

    this.relayCache.set(identity.getMyId(), {
      ...relayInfo,
      latency: 0,
      lastSeen: Date.now()
    });
  }

  _handleRelayAnnounce(peerId, msg) {
    if (!msg.relayInfo?.peerId) return;

    this.relayCache.set(msg.relayInfo.peerId, {
      ...msg.relayInfo,
      lastSeen: Date.now()
    });

    this.peers.forEach((peer, pid) => {
      if (pid !== peerId && peer.connected) {
        this._sendEncrypted(peer, msg);
      }
    });
  }

  getBestRelays(count = 3) {
    const now = Date.now();
    const relays = [...this.relayCache.values()]
      .filter(r => {
        if (r.peerId === identity.getMyId()) return false;
        if (now - r.lastSeen > 300000) return false;
        return true;
      })
      .sort((a, b) => (a.latency || 999) - (b.latency || 999));

    return relays.slice(0, count);
  }

  // ========== ОБРАБОТКА ВХОДЯЩИХ ==========

  handleIncoming(peerId, msg) {
    const peer = this.peers.get(peerId);

    if (msg.data?.ciphertext && peer?.e2eeKey) {
      const decrypted = cryptoModule.decrypt(peer.e2eeKey, msg.data);
      if (decrypted) {
        try {
          msg = { ...msg, ...JSON.parse(decrypted) };
        } catch (e) {}
      }
    }

    switch (msg.type) {
      case 'dht-hello':
        if (msg.profile) {
          if (peer) peer.profile = msg.profile;
          messageHandler.handleIncoming({ type: 'hello', from: peerId, profile: msg.profile });
        }
        break;

      case 'relay-announce':
        this._handleRelayAnnounce(peerId, msg);
        break;

      default:
        if (this.onMessageCallback) {
          this.onMessageCallback({ ...msg, from: peerId });
        }
    }
  }

  // ========== СТАТУС ==========

  isConnected(peerId) {
    return this.peers.get(peerId)?.connected || false;
  }

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: getConnectedPeers
  getConnectedPeers() {
    return [...this.peers.entries()]
      .filter(([_, p]) => p.connected)
      .map(([id]) => id);
  }

  // ========== КОЛБЭКИ ==========

  onMessage(cb) { this.onMessageCallback = cb; }
  onPeerEvent(cb) { this.onPeerCallback = cb; }

  // ========== ОСТАНОВКА ==========

  stop() {
    this._started = false;
    if (this._relayInterval) clearInterval(this._relayInterval);
    this._saveOfflineMessages();
    console.log('🕸️ DHT-ядро остановлено');
  }
}

export default new SwarmManager();
