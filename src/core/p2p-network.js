// p2p-network.js — Паутина v4.0 (финал)
// Периодическая NAT-детекция + DHT-синхронизация кэша + подпись всех слоёв + nonce-счётчик

import identity from './identity.js';
import cryptoModule from './crypto-module.js';

const MAX_RELAY_HOPS = 3;
const RELAY_TIMEOUT = 10000;
const MAX_RELAY_CACHE = 100;
const NAT_RECHECK_INTERVAL = 300000; // 5 минут
const RELAY_SYNC_INTERVAL = 60000;   // 1 минута

class P2PNetwork {
  constructor() {
    this.peers = new Map();
    this.relayCache = new Map();
    this.onMessageCallback = null;
    this.onPeerCallback = null;
    this.pendingMessages = [];
    this.relayEnabled = true;
    this.myNATType = 'unknown';
    this._nonceCounter = 0;
    this._usedNonces = new Set();
    this._maxNonceCache = 10000;
    
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 2
    };
  }

  async start() {
    console.log('🕸️ Паутина v4.0 запущена. ID:', identity.id);
    
    this.myNATType = await this._detectOwnNAT();
    console.log('🔍 Мой NAT:', this.myNATType);
    
    if (this.relayEnabled) this._announceAsRelay();
    
    // Периодическая NAT-перепроверка
    this._natCheckInterval = setInterval(async () => {
      const oldNAT = this.myNATType;
      this.myNATType = await this._detectOwnNAT();
      if (oldNAT !== this.myNATType) {
        console.log('🔄 NAT изменился:', oldNAT, '→', this.myNATType);
        this._announceAsRelay();
      }
    }, NAT_RECHECK_INTERVAL);
    
    // Периодическая DHT-синхронизация
    this._relaySyncInterval = setInterval(() => this._discoverRelays(), RELAY_SYNC_INTERVAL);
    
    this._loadRelayCache();
  }

  // ========== NAT-ДЕТЕКЦИЯ ==========

  async _detectOwnNAT() {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });

      const candidates = [];
      
      return new Promise((resolve) => {
        pc.onicecandidate = (e) => {
          if (e.candidate) candidates.push(e.candidate);
          else { pc.close(); resolve(this._analyzeNAT(candidates)); }
        };

        pc.createDataChannel('nat-test');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        setTimeout(() => { pc.close(); resolve(this._analyzeNAT(candidates)); }, 4000);
      });
    } catch(e) {
      return 'unknown';
    }
  }

  _analyzeNAT(candidates) {
    const srflx = candidates.filter(c => c.type === 'srflx');
    const relay = candidates.filter(c => c.type === 'relay');
    const host = candidates.filter(c => c.type === 'host');
    
    if (srflx.length === 0 && host.length > 0) return 'open';
    if (srflx.length > 0) {
      const addresses = new Set(srflx.map(c => c.address + ':' + c.port));
      return addresses.size === 1 ? 'cone' : 'symmetric';
    }
    if (relay.length > 0 && srflx.length === 0) return 'symmetric';
    return 'unknown';
  }

  // ========== DHT-СИНХРОНИЗАЦИЯ ==========

  _announceAsRelay() {
    const relayInfo = {
      peerId: identity.id,
      publicKey: identity.getX25519PublicKey(),
      natType: this.myNATType,
      timestamp: Date.now(),
      version: 4
    };
    
    this.relayCache.set(identity.id, { ...relayInfo, lastSeen: Date.now() });
    this._saveRelayCache();
    
    this.peers.forEach((entry, peerId) => {
      if (entry.connected) {
        this.sendToPeer(peerId, { type: 'relay-announce', relayInfo });
      }
    });
  }

  _discoverRelays() {
    // Запрашиваем у подключённых пиров
    this.peers.forEach((entry, peerId) => {
      if (entry.connected) {
        this.sendToPeer(peerId, {
          type: 'relay-discover',
          requestId: this._nextNonce()
        });
      }
    });
    
    // Чистим устаревшие
    const now = Date.now();
    this.relayCache.forEach((info, nodeId) => {
      if (now - info.lastSeen > 600000) this.relayCache.delete(nodeId);
    });
    
    this._saveRelayCache();
  }

  _handleRelayAnnounce(msg) {
    if (!msg.relayInfo?.peerId || !msg.relayInfo?.publicKey) return;
    
    const info = msg.relayInfo;
    this.relayCache.set(info.peerId, {
      peerId: info.peerId,
      publicKey: info.publicKey,
      natType: info.natType || 'unknown',
      latency: info.latency || 999,
      lastSeen: Date.now()
    });
    
    if (this.relayCache.size > MAX_RELAY_CACHE) {
      const oldest = [...this.relayCache.entries()]
        .sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
      if (oldest) this.relayCache.delete(oldest[0]);
    }
    
    this._saveRelayCache();
    
    // Ретранслируем анонс другим пирам (DHT-подобно)
    this.peers.forEach((entry, peerId) => {
      if (entry.connected && peerId !== msg.from) {
        this.sendToPeer(peerId, msg);
      }
    });
  }

  _handleRelayDiscover(msg) {
    const relayList = [...this.relayCache.values()]
      .filter(r => Date.now() - r.lastSeen < 600000)
      .slice(0, 30);
    
    const requestor = msg.from || msg.requestId;
    if (requestor) {
      this.sendToPeer(requestor, { type: 'relay-list', relays: relayList, nonce: msg.requestId });
    }
  }

  _handleRelayList(msg) {
    if (!msg.relays) return;
    
    msg.relays.forEach(info => {
      if (info.peerId !== identity.id && this._isNonceValid(msg.nonce)) {
        const existing = this.relayCache.get(info.peerId);
        if (!existing || info.lastSeen > existing.lastSeen) {
          this.relayCache.set(info.peerId, { ...info, lastSeen: Date.now() });
        }
      }
    });
    
    this._saveRelayCache();
  }

  // ========== NONCE-МЕНЕДЖЕР ==========

  _nextNonce() {
    this._nonceCounter++;
    const nonce = `${Date.now().toString(36)}_${this._nonceCounter.toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    this._usedNonces.add(nonce);
    
    if (this._usedNonces.size > this._maxNonceCache) {
      const toDelete = [...this._usedNonces].slice(0, 1000);
      toDelete.forEach(n => this._usedNonces.delete(n));
    }
    
    return nonce;
  }

  _isNonceValid(nonce) {
    if (!nonce) return true;
    if (this._usedNonces.has(nonce)) return false;
    this._usedNonces.add(nonce);
    return true;
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
          type: 'p2p-signal', from: identity.id, to: peerId,
          signal: { candidate: e.candidate }, initiator: true
        });
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this._waitForIce(pc);

      if (pc.localDescription && this.onMessageCallback) {
        this.onMessageCallback({
          type: 'p2p-signal', from: identity.id, to: peerId,
          signal: { sdp: pc.localDescription }, initiator: true
        });
      }
    } catch(e) {
      console.log('🔄 Прямое не удалось, пробуем паутину');
      this._connectViaRelay(peerId);
      return;
    }

    this.peers.set(peerId, { pc, dc, connected: false, direct: true });

    setTimeout(() => {
      const entry = this.peers.get(peerId);
      if (entry && !entry.connected && entry.direct) this._connectViaRelay(peerId);
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
          type: 'p2p-signal', from: identity.id, to: peerId,
          signal: { candidate: e.candidate }, initiator: false
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
            type: 'p2p-signal', from: identity.id, to: peerId,
            signal: { sdp: pc.localDescription }, initiator: false
          });
        }
      }
      if (signalData.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      }
    } catch(e) {
      console.log('🔄 Прямой ответ не удался');
    }

    this.peers.set(peerId, { pc, dc: null, connected: false, direct: true });

    setTimeout(() => {
      const entry = this.peers.get(peerId);
      if (entry && !entry.connected && entry.direct && !entry.relayChain) this._connectViaRelay(peerId);
    }, RELAY_TIMEOUT);
  }

  applySignal(peerId, signalData) {
    const entry = this.peers.get(peerId);
    if (!entry) return;

    if (signalData.sdp) {
      entry.pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp))
        .then(() => { if (signalData.sdp.type === 'offer') entry.pc.createAnswer().then(a => entry.pc.setLocalDescription(a)); })
        .catch(() => {});
    }
    if (signalData.candidate) entry.pc.addIceCandidate(new RTCIceCandidate(signalData.candidate)).catch(() => {});
  }

  // ========== ONION-РЕТРАНСЛЯЦИЯ (ПОДПИСЬ ВСЕХ СЛОЁВ) ==========

  async _connectViaRelay(targetPeerId) {
    console.log('🕸️ Крипто-onion до', targetPeerId);

    const availableRelays = this._getBestRelays(targetPeerId);
    if (availableRelays.length === 0) { console.log('❌ Нет ретрансляторов'); return; }

    const chain = availableRelays.slice(0, MAX_RELAY_HOPS).map(r => r.peerId);
    const chainKeys = availableRelays.slice(0, MAX_RELAY_HOPS).map(r => r.publicKey);
    if (chain.length === 0) return;

    const payload = { type: 'connect-request', from: identity.id, profile: identity.getProfile() };
    const onionPacket = await this._buildOnionPacket(targetPeerId, chain, chainKeys, payload);
    this._sendViaRelayChain(onionPacket, chain);

    this.peers.set(targetPeerId, { pc: null, dc: null, connected: true, direct: false, relayChain: chain, relayKeys: chainKeys });
    if (this.onPeerCallback) this.onPeerCallback({ type: 'connected', peerId: targetPeerId, viaRelay: true });
  }

  _getBestRelays(targetId) {
    const relays = [];
    this.peers.forEach((entry, peerId) => {
      if (peerId === targetId || !entry.connected || entry.profile?.relayEnabled === false) return;
      relays.push({ peerId, publicKey: entry.profile?.x25519PublicKey || entry.profile?.publicKey, latency: entry.latency || 999, natType: entry.profile?.natType || 'unknown' });
    });
    this.relayCache.forEach((info, nodeId) => {
      if (nodeId === targetId || nodeId === identity.id || relays.find(r => r.peerId === nodeId)) return;
      relays.push({ peerId: info.peerId, publicKey: info.publicKey, latency: info.latency || 999, natType: info.natType || 'unknown' });
    });
    return relays.sort((a, b) => {
      const score = t => t === 'open' ? 0 : t === 'cone' ? 1 : 3;
      const d = score(a.natType) - score(b.natType);
      return d !== 0 ? d : a.latency - b.latency;
    });
  }

  async _buildOnionPacket(targetId, chain, chainKeys, payload) {
    let innerPacket = {
      type: 'relay', target: targetId, payload, ttl: chain.length + 1,
      nonce: this._nextNonce()
    };
    innerPacket.signature = await this._signPacket(innerPacket);

    for (let i = chain.length - 1; i >= 0; i--) {
      const relayPubKey = chainKeys[i];
      if (!relayPubKey) continue;

      const layerData = {
        nextHop: i < chain.length - 1 ? chain[i + 1] : targetId,
        payload: innerPacket,
        nonce: this._nextNonce()
      };

      const sharedKey = await cryptoModule.computeSharedKey(identity.getX25519SecretKey(), relayPubKey);
      if (!sharedKey) continue;

      const encrypted = cryptoModule.encrypt(sharedKey, JSON.stringify(layerData));
      if (!encrypted) continue;

      // Подписываем КАЖДЫЙ слой
      const layerSignature = await this._signPacket({ layer: i, nonce: layerData.nonce, encrypted: encrypted.ciphertext });

      innerPacket = {
        type: 'onion-layer', layer: i,
        nonce: layerData.nonce,
        encrypted,
        pubkey: identity.getX25519PublicKey(),
        signature: layerSignature
      };
    }

    return { type: 'onion-packet', layers: chain.length, payload: innerPacket, route: chain };
  }

  async _unwrapOnionLayer(packet) {
    try {
      const relayPubKey = packet.pubkey;
      if (!relayPubKey) return null;

      // Проверяем подпись слоя
      if (packet.signature) {
        const valid = await this._verifyPacket(
          { layer: packet.layer, nonce: packet.nonce, encrypted: packet.encrypted?.ciphertext },
          relayPubKey,
          packet.signature
        );
        if (!valid) { console.log('❌ Неверная подпись слоя'); return null; }
      }

      const sharedKey = await cryptoModule.computeSharedKey(identity.getX25519SecretKey(), relayPubKey);
      if (!sharedKey) return null;

      const decrypted = cryptoModule.decrypt(sharedKey, packet.encrypted);
      return decrypted ? JSON.parse(decrypted) : null;
    } catch(e) { return null; }
  }

  async _signPacket(packet) {
    const data = JSON.stringify({ type: packet.type, target: packet.target, nonce: packet.nonce });
    return cryptoModule.sign(identity.getX25519SecretKey(), data);
  }

  async _verifyPacket(packet, publicKey, signature) {
    const data = JSON.stringify({ type: packet.type, target: packet.target, nonce: packet.nonce });
    return cryptoModule.verify(publicKey, data, signature);
  }

  _sendViaRelayChain(packet, chain) {
    if (chain.length === 0) return;
    packet.route = chain.slice(1);
    this.sendToPeer(chain[0], packet);
  }

  async _handleOnionPacket(msg) {
    if (msg.type !== 'onion-packet') return;

    const unwrapped = await this._unwrapOnionLayer(msg.payload);
    if (!unwrapped) return;

    if (unwrapped.payload?.type === 'relay') {
      const relayMsg = unwrapped.payload;
      relayMsg.ttl--;

      if (relayMsg.target === identity.id) {
        // Проверяем подпись внутреннего пакета
        const valid = relayMsg.signature ? 
          await this._verifyPacket(relayMsg, identity.getX25519PublicKey(), relayMsg.signature) : true;
        
        if (valid) this.handleIncoming({ ...relayMsg.payload, from: relayMsg.payload.from });
      } else {
        this.sendToPeer(relayMsg.target, relayMsg.payload);
      }
    } else {
      if (unwrapped.nextHop) this.sendToPeer(unwrapped.nextHop, { ...msg, payload: unwrapped.payload });
    }
  }

  // ========== ОТПРАВКА ==========

  sendToPeer(peerId, data) {
    const entry = this.peers.get(peerId);
    if (entry?.dc?.readyState === 'open') { entry.dc.send(JSON.stringify(data)); return true; }
    if (entry?.relayChain && entry?.relayKeys) {
      this._buildOnionPacket(peerId, entry.relayChain, entry.relayKeys, data)
        .then(packet => this._sendViaRelayChain(packet, entry.relayChain));
      return true;
    }
    this.pendingMessages.push({ peerId, data });
    return false;
  }

  _setupPC(pc, peerId) {
    let pingStart = Date.now();
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') {
        const entry = this.peers.get(peerId);
        if (entry) entry.latency = Date.now() - pingStart;
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        const entry = this.peers.get(peerId);
        if (entry) { entry.connected = true; this._flushPending(peerId); if (this.onPeerCallback) this.onPeerCallback({ type: 'connected', peerId }); }
      }
    };
  }

  _setupDC(dc, peerId) {
    dc.onopen = () => {
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
        if (msg.type === 'relay') { this._handleRelayPacket(msg); return; }
        if (this.onMessageCallback) this.onMessageCallback({ ...msg, from: peerId });
      } catch(err) {}
    };
  }

  _handleRelayPacket(msg) {
    msg.ttl--;
    if (msg.ttl <= 0 || msg.target === identity.id) { this.handleIncoming(msg.payload); return; }
    const nextHop = msg.route?.[0];
    if (nextHop) { msg.route = msg.route.slice(1); this.sendToPeer(nextHop, msg); }
  }

  async _waitForIce(pc) {
    return new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') resolve();
      else { pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') resolve(); }; setTimeout(resolve, 5000); }
    });
  }

  _flushPending(peerId) {
    const msgs = this.pendingMessages.filter(m => m.peerId === peerId);
    this.pendingMessages = this.pendingMessages.filter(m => m.peerId !== peerId);
    msgs.forEach(({ data }) => this.sendToPeer(peerId, data));
  }

  handleIncoming(msg) { if (this.onMessageCallback) this.onMessageCallback(msg); }
  isConnected(peerId) { return this.peers.get(peerId)?.connected || false; }
  onMessage(cb) { this.onMessageCallback = cb; }
  onPeerEvent(cb) { this.onPeerCallback = cb; }

  stop() {
    clearInterval(this._natCheckInterval);
    clearInterval(this._relaySyncInterval);
    this.peers.forEach(e => { try { e.pc?.close(); } catch(_) {} try { e.dc?.close(); } catch(_) {} });
    this.peers.clear();
    this._saveRelayCache();
  }
}

export default new P2PNetwork();
