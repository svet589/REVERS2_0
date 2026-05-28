// p2p-network.js — P2P сеть через simple-peer (WebRTC)

import identity from './identity.js';

class P2PNetwork {
  constructor() {
    this.peers = new Map();
    this.onMessageCallback = null;
    this.onPeerCallback = null;
    this.pendingSignals = [];
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
  }

  start() {
    console.log('🚀 P2P Network запущен. Мой ID:', identity.id);
  }

  async connectToPeer(peerId) {
    if (this.peers.has(peerId)) {
      console.log('Уже подключены к', peerId);
      return;
    }

    try {
      const SimplePeer = (await import('simple-peer')).default;
      
      const peer = new SimplePeer({
        initiator: true,
        trickle: true,
        config: this.rtcConfig
      });

      this._setupPeer(peer, peerId);

      peer.on('signal', (signalData) => {
        console.log('📤 Сигнал для', peerId);
        this.pendingSignals.push({ peerId, signal: signalData, type: 'offer' });
        if (this.onMessageCallback) {
          this.onMessageCallback({
            type: 'p2p-signal',
            from: identity.id,
            to: peerId,
            signal: signalData,
            initiator: true
          });
        }
      });

    } catch (e) {
      console.error('Ошибка создания пира:', e);
    }
  }

  async acceptPeer(peerId, signalData) {
    if (this.peers.has(peerId)) return;

    try {
      const SimplePeer = (await import('simple-peer')).default;
      
      const peer = new SimplePeer({
        initiator: false,
        trickle: true,
        config: this.rtcConfig
      });

      this._setupPeer(peer, peerId);
      
      peer.on('signal', (answerSignal) => {
        if (this.onMessageCallback) {
          this.onMessageCallback({
            type: 'p2p-signal',
            from: identity.id,
            to: peerId,
            signal: answerSignal,
            initiator: false
          });
        }
      });

      peer.signal(signalData);
    } catch (e) {
      console.error('Ошибка принятия пира:', e);
    }
  }

  applySignal(peerId, signalData) {
    const peer = this.peers.get(peerId);
    if (peer) {
      try {
        peer.signal(signalData);
      } catch (e) {
        console.error('Ошибка применения сигнала:', e);
      }
    }
  }

  _setupPeer(peer, peerId) {
    let connected = false;

    peer.on('connect', () => {
      connected = true;
      console.log('🔗 P2P соединение установлено с', peerId);
      
      this.peers.set(peerId, peer);
      
      if (this.onPeerCallback) {
        this.onPeerCallback({ type: 'connected', peerId });
      }

      peer.send(JSON.stringify({
        type: 'hello',
        profile: identity.getProfile()
      }));
    });

    peer.on('data', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (this.onMessageCallback) {
          this.onMessageCallback({ ...msg, from: peerId });
        }
      } catch (e) {
        console.error('Ошибка парсинга:', e);
      }
    });

    peer.on('close', () => {
      console.log('🔌 Соединение закрыто с', peerId);
      this.peers.delete(peerId);
      if (this.onPeerCallback && connected) {
        this.onPeerCallback({ type: 'disconnected', peerId });
      }
    });

    peer.on('error', (err) => {
      console.error('Ошибка пира:', err.message);
      this.peers.delete(peerId);
      if (this.onPeerCallback && connected) {
        this.onPeerCallback({ type: 'disconnected', peerId });
      }
    });
  }

  sendToPeer(peerId, data) {
    const peer = this.peers.get(peerId);
    if (peer && peer.connected) {
      try {
        peer.send(JSON.stringify(data));
        return true;
      } catch (e) {
        console.error('Ошибка отправки:', e);
        return false;
      }
    }
    return false;
  }

  isConnected(peerId) {
    const peer = this.peers.get(peerId);
    return peer ? peer.connected : false;
  }

  getConnectedPeers() {
    const connected = [];
    this.peers.forEach((peer, peerId) => {
      if (peer.connected) connected.push(peerId);
    });
    return connected;
  }

  onMessage(cb) { this.onMessageCallback = cb; }
  onPeerEvent(cb) { this.onPeerCallback = cb; }

  stop() {
    this.peers.forEach((peer) => {
      try { peer.destroy(); } catch (e) {}
    });
    this.peers.clear();
  }
}

export default new P2PNetwork();
