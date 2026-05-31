// p2p-network.js — WebRTC с TURN + реконнект

import identity from './identity.js';

class P2PNetwork {
  constructor() {
    this.peers = new Map();
    this.onMessageCallback = null;
    this.onPeerCallback = null;
    this.pendingMessages = [];
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ],
      iceCandidatePoolSize: 2
    };
  }

  start() {
    console.log('🚀 P2P Network. ID:', identity.id);
  }

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
          from: identity.id,
          to: peerId,
          signal: { candidate: e.candidate },
          initiator: true
        });
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      await new Promise(resolve => {
        if (pc.iceGatheringState === 'complete') resolve();
        else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
          setTimeout(resolve, 5000);
        }
      });

      if (this.onMessageCallback) {
        this.onMessageCallback({
          type: 'p2p-signal',
          from: identity.id,
          to: peerId,
          signal: { sdp: pc.localDescription },
          initiator: true
        });
      }
    } catch(e) {
      console.error('Ошибка offer:', e);
    }

    this.peers.set(peerId, { pc, dc, connected: false });
  }

  async acceptPeer(peerId, signalData) {
    if (this.peers.has(peerId)) return;

    const pc = new RTCPeerConnection(this.rtcConfig);
    this._setupPC(pc, peerId);

    pc.ondatachannel = (e) => {
      this._setupDC(e.channel, peerId);
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

    try {
      if (signalData.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        await new Promise(resolve => {
          if (pc.iceGatheringState === 'complete') resolve();
          else pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
          setTimeout(resolve, 5000);
        });

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
      if (signalData.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      }
    } catch(e) {
      console.error('Ошибка acceptPeer:', e);
    }

    this.peers.set(peerId, { pc, dc: null, connected: false });
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
        .catch(e => console.error('SDP error:', e));
    }

    if (signalData.candidate) {
      entry.pc.addIceCandidate(new RTCIceCandidate(signalData.candidate))
        .catch(e => console.error('ICE error:', e));
    }
  }

  _setupPC(pc, peerId) {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        const entry = this.peers.get(peerId);
        if (entry) entry.connected = true;
        if (this.onPeerCallback) this.onPeerCallback({ type: 'connected', peerId });
        this._flushPending(peerId);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.peers.delete(peerId);
        if (this.onPeerCallback) this.onPeerCallback({ type: 'disconnected', peerId });
        // Авто-переподключение через 5 сек
        setTimeout(() => {
          if (!this.peers.has(peerId)) {
            console.log('🔄 Переподключение к', peerId);
            this.connectToPeer(peerId);
          }
        }, 5000);
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
        if (this.onMessageCallback) this.onMessageCallback({ ...msg, from: peerId });
      } catch(err) {}
    };

    dc.onclose = () => console.log('📡 DC закрыт:', peerId);
  }

  sendToPeer(peerId, data) {
    const entry = this.peers.get(peerId);
    if (entry?.dc?.readyState === 'open') {
      entry.dc.send(JSON.stringify(data));
      return true;
    }
    this.pendingMessages.push({ peerId, data });
    return false;
  }

  _flushPending(peerId) {
    const msgs = this.pendingMessages.filter(m => m.peerId === peerId);
    this.pendingMessages = this.pendingMessages.filter(m => m.peerId !== peerId);
    const entry = this.peers.get(peerId);
    if (entry?.dc?.readyState === 'open') {
      msgs.forEach(({ data }) => entry.dc.send(JSON.stringify(data)));
    }
  }

  isConnected(peerId) {
    return this.peers.get(peerId)?.connected || false;
  }

  onMessage(cb) { this.onMessageCallback = cb; }
  onPeerEvent(cb) { this.onPeerCallback = cb; }

  stop() {
    this.peers.forEach(e => {
      try { e.pc.close(); } catch(_) {}
      try { e.dc?.close(); } catch(_) {}
    });
    this.peers.clear();
  }
}

export default new P2PNetwork();
