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

  start() { console.log('🚀 P2P Network. ID:', identity.id); }

  async connectToPeer(peerId) {
    if (this.peers.has(peerId)) return;
    const pc = new RTCPeerConnection(this.rtcConfig);
    const dc = pc.createDataChannel('chat');
    this._setupDC(dc, peerId);
    this._setupPC(pc, peerId);
    pc.onicecandidate = e => {
      if (e.candidate && this.onMessageCallback) {
        this.onMessageCallback({ type: 'p2p-signal', from: identity.id, to: peerId, signal: { candidate: e.candidate }, initiator: true });
      }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete' && this.onMessageCallback) {
        this.onMessageCallback({ type: 'p2p-signal', from: identity.id, to: peerId, signal: { sdp: pc.localDescription }, initiator: true });
      }
    };
    this.peers.set(peerId, { pc, dc, connected: false });
  }

  async acceptPeer(peerId, signalData) {
    if (this.peers.has(peerId)) return;
    const pc = new RTCPeerConnection(this.rtcConfig);
    this._setupPC(pc, peerId);
    pc.ondatachannel = e => this._setupDC(e.channel, peerId);
    pc.onicecandidate = e => {
      if (e.candidate && this.onMessageCallback) {
        this.onMessageCallback({ type: 'p2p-signal', from: identity.id, to: peerId, signal: { candidate: e.candidate }, initiator: false });
      }
    };
    if (signalData.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete' && this.onMessageCallback) {
          this.onMessageCallback({ type: 'p2p-signal', from: identity.id, to: peerId, signal: { sdp: pc.localDescription }, initiator: false });
        }
      };
    }
    if (signalData.candidate) {
      try { await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate)); } catch(e) {}
    }
    this.peers.set(peerId, { pc, dc: null, connected: false });
  }

  applySignal(peerId, signalData) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    if (signalData.sdp) {
      entry.pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp))
        .then(() => { if (signalData.sdp.type === 'offer') entry.pc.createAnswer().then(a => entry.pc.setLocalDescription(a)); })
        .catch(e => console.error('SDP error:', e));
    }
    if (signalData.candidate) {
      entry.pc.addIceCandidate(new RTCIceCandidate(signalData.candidate)).catch(e => {});
    }
  }

  _setupPC(pc, peerId) {
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        const e = this.peers.get(peerId); if (e) e.connected = true;
        if (this.onPeerCallback) this.onPeerCallback({ type: 'connected', peerId });
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.peers.delete(peerId);
        if (this.onPeerCallback) this.onPeerCallback({ type: 'disconnected', peerId });
      }
    };
  }

  _setupDC(dc, peerId) {
    dc.onopen = () => {
      console.log('📡 DC open:', peerId);
      dc.send(JSON.stringify({ type: 'hello', profile: identity.getProfile() }));
    };
    dc.onmessage = e => {
      try { const m = JSON.parse(e.data); if (this.onMessageCallback) this.onMessageCallback({...m, from: peerId}); } catch(err) {}
    };
  }

  sendToPeer(peerId, data) {
    const e = this.peers.get(peerId);
    if (e?.dc?.readyState === 'open') { e.dc.send(JSON.stringify(data)); return true; }
    return false;
  }

  isConnected(peerId) { const e = this.peers.get(peerId); return e?.connected || false; }
  getConnectedPeers() { return [...this.peers.entries()].filter(([_,e]) => e.connected).map(([id]) => id); }
  onMessage(cb) { this.onMessageCallback = cb; }
  onPeerEvent(cb) { this.onPeerCallback = cb; }
  stop() { this.peers.forEach(e => { try { e.pc.close(); } catch(_) {} }); this.peers.clear(); }
}

export default new P2PNetwork();
