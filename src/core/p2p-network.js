// p2p-network.js — нативный WebRTC (работает в WebView без зависимостей)

import identity from './identity.js';

class P2PNetwork {
  constructor() {
    this.peers = new Map();
    this.onMessageCallback = null;
    this.onPeerCallback = null;
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  start() {
    console.log('🚀 P2P Network запущен. Мой ID:', identity.id);
  }

  async connectToPeer(peerId) {
    if (this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection(this.rtcConfig);
    const dc = pc.createDataChannel('chat');
    
    this._setupDataChannel(dc, peerId);
    this._setupPeerConnection(pc, peerId);

    pc.onicecandidate = (e) => {
      if (e.candidate && this.onMessageCallback) {
        this.onMessageCallback({
          type: 'p2p-signal',
          from: identity.id,
          to: peerId,
          signal: { candidate: e.candidate },
          initiator: true
        });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        if (this.onMessageCallback) {
          this.onMessageCallback({
            type: 'p2p-signal',
            from: identity.id,
            to: peerId,
            signal: { sdp: pc.localDescription },
            initiator: true
          });
        }
      }
    };

    this.peers.set(peerId, { pc, dc, connected: false });
  }

  async acceptPeer(peerId, signalData) {
    if (this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection(this.rtcConfig);
    this._setupPeerConnection(pc, peerId);

    pc.ondatachannel = (e) => {
      this._setupDataChannel(e.channel, peerId);
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && this.onMessageCallback) {
        this.onMessageCallback({
          type: 'p2p-signal',
          from: identity.id,
          to: peerId,
          signal: { candidate: e.candidate },
          initiator: false
        });
      }
    };

    if (signalData.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          if (this.onMessageCallback) {
            this.onMessageCallback({
              type: 'p2p-signal',
              from: identity.id,
              to: peerId,
              signal: { sdp: pc.localDescription },
              initiator: false
            });
          }
        }
      };
    }

    if (signalData.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      } catch (e) {
        console.error('ICE error:', e);
      }
    }

    this.peers.set(peerId, { pc, dc: null, connected: false });
  }

  applySignal(peerId, signalData) {
    const entry = this.peers.get(peerId);
    if (!entry) return;

    const { pc } = entry;

    if (signalData.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp))
        .then(() => {
          if (signalData.sdp.type === 'offer') {
            return pc.createAnswer().then(answer => pc.setLocalDescription(answer));
          }
        })
        .catch(e => console.error('SDP error:', e));
    }

    if (signalData.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(signalData.candidate))
        .catch(e => console.error('ICE error:', e));
    }
  }

  _setupPeerConnection(pc, peerId) {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        const entry = this.peers.get(peerId);
        if (entry) entry.connected = true;
        
        if (this.onPeerCallback) {
          this.onPeerCallback({ type: 'connected', peerId });
        }
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.peers.delete(peerId);
        if (this.onPeerCallback) {
          this.onPeerCallback({ type: 'disconnected', peerId });
        }
      }
    };
  }

  _setupDataChannel(dc, peerId) {
    dc.onopen = () => {
      console.log('📡 DataChannel открыт с', peerId);
      
      dc.send(JSON.stringify({
        type: 'hello',
        profile: identity.getProfile()
      }));
    };

    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (this.onMessageCallback) {
          this.onMessageCallback({ ...msg, from: peerId });
        }
      } catch (err) {
        console.error('Ошибка парсинга:', err);
      }
    };

    dc.onclose = () => {
      console.log('📡 DataChannel закрыт с', peerId);
    };
  }

  sendToPeer(peerId, data) {
    const entry = this.peers.get(peerId);
    if (entry && entry.dc && entry.dc.readyState === 'open') {
      entry.dc.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  isConnected(peerId) {
    const entry = this.peers.get(peerId);
    return entry ? entry.connected : false;
  }

  getConnectedPeers() {
    const connected = [];
    this.peers.forEach((entry, peerId) => {
      if (entry.connected) connected.push(peerId);
    });
    return connected;
  }

  onMessage(cb) { this.onMessageCallback = cb; }
  onPeerEvent(cb) { this.onPeerCallback = cb; }

  stop() {
    this.peers.forEach((entry) => {
      try { entry.pc.close(); } catch (e) {}
    });
    this.peers.clear();
  }
}

export default new P2PNetwork();
