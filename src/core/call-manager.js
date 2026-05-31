// call-manager.js v13.0 — групповые звонки + адаптивный битрейт + текстовый чат в звонке

import p2pNetwork from './p2p-network.js';
import identity from './identity.js';
import cryptoModule from './crypto-module.js';
import messageHandler from './message-handler.js';
import groupManager from './group-manager.js';
import storage from './storage-adapter.js';

const MAX_CALLS_PER_MINUTE = 5;
const CALL_TIMEOUT = 30000;
const BITRATE_CHECK_INTERVAL = 3000;
const BITRATE_LEVELS = {
  HIGH: { video: 720000, audio: 64000 },
  MEDIUM: { video: 360000, audio: 48000 },
  LOW: { video: 150000, audio: 32000 },
  MINIMAL: { video: 80000, audio: 24000 }
};

class CallManager {
  constructor() {
    this.calls = new Map();
    this.groupCalls = new Map();
    this.recentCalls = new Map();
    this.blockedCallers = new Set();
    this.onIncomingCall = null;
    this.onRemoteStream = null;
    this.onCallEnded = null;
    this.onCallMessage = null;
    this.allowIncomingCalls = true;
    this._bitrateMonitors = new Map();
    
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
    
    this._loadSettings();
  }

  _loadSettings() {
    this.allowIncomingCalls = localStorage.getItem('revers_allow_calls') !== 'false';
  }

  setAllowIncomingCalls(allow) {
    this.allowIncomingCalls = allow;
    localStorage.setItem('revers_allow_calls', allow);
  }

  blockCaller(peerId) { this.blockedCallers.add(peerId); }
  unblockCaller(peerId) { this.blockedCallers.delete(peerId); }

  // ========== АНТИСПАМ ==========

  _checkSpam(peerId) {
    if (this.blockedCallers.has(peerId)) return false;
    const now = Date.now();
    const timestamps = this.recentCalls.get(peerId) || [];
    const recent = timestamps.filter(t => now - t < 60000);
    if (recent.length >= MAX_CALLS_PER_MINUTE) return false;
    this.recentCalls.set(peerId, [...recent, now]);
    return true;
  }

  _authenticatePeer(peerId) {
    return !!messageHandler.peerProfiles.get(peerId)?.x25519PublicKey;
  }

  // ========== E2EE ==========

  async _getCallKey(peerId) {
    const sharedKey = await messageHandler._getSharedKey(peerId);
    if (!sharedKey) return null;
    const material = new Uint8Array([...sharedKey, ...new TextEncoder().encode('REVERS_CALL_v1')]);
    return cryptoModule.hash(Buffer.from(material).toString('base64'));
  }

  _encryptSignaling(e2eeKey, data) {
    if (!e2eeKey) return data;
    return cryptoModule.encrypt(e2eeKey, JSON.stringify(data));
  }

  _decryptSignaling(e2eeKey, encrypted) {
    if (!e2eeKey || !encrypted?.ciphertext) return encrypted;
    const decrypted = cryptoModule.decrypt(e2eeKey, encrypted);
    return decrypted ? JSON.parse(decrypted) : null;
  }

  // ========== АДАПТИВНЫЙ БИТРЕЙТ ==========

  _startBitrateMonitor(peerId, pc) {
    this._bitrateMonitors.set(peerId, setInterval(async () => {
      try {
        const stats = await pc.getStats();
        let packetLoss = 0, rtt = 0;
        stats.forEach(report => {
          if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
            packetLoss = report.packetsLost / (report.packetsReceived + report.packetsLost) || 0;
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rtt = report.currentRoundTripTime * 1000 || 0;
          }
        });
        this._adjustBitrate(peerId, packetLoss, rtt);
      } catch(e) {}
    }, BITRATE_CHECK_INTERVAL));
  }

  _adjustBitrate(peerId, packetLoss, rtt) {
    const call = this.calls.get(peerId);
    if (!call?.pc) return;
    const sender = call.pc.getSenders().find(s => s.track?.kind === 'video');
    if (!sender) return;

    let level;
    if (packetLoss < 0.02 && rtt < 100) level = BITRATE_LEVELS.HIGH;
    else if (packetLoss < 0.05 && rtt < 200) level = BITRATE_LEVELS.MEDIUM;
    else if (packetLoss < 0.10 && rtt < 400) level = BITRATE_LEVELS.LOW;
    else level = BITRATE_LEVELS.MINIMAL;

    const params = sender.getParameters();
    if (params.encodings?.[0]) {
      params.encodings[0].maxBitrate = level.video;
      sender.setParameters(params).catch(() => {});
    }
  }

  _stopBitrateMonitor(peerId) {
    const monitor = this._bitrateMonitors.get(peerId);
    if (monitor) { clearInterval(monitor); this._bitrateMonitors.delete(peerId); }
  }

  // ========== ТЕКСТОВЫЙ ЧАТ В ЗВОНКЕ ==========

  async sendCallMessage(peerId, text) {
    const call = this.calls.get(peerId);
    if (!call?.e2eeKey) return false;

    const encrypted = this._encryptSignaling(call.e2eeKey, {
      callType: 'call-message',
      text,
      from: identity.id,
      time: Date.now()
    });

    p2pNetwork.sendToPeer(peerId, { type: 'call-message', data: encrypted });

    if (this.onCallMessage) {
      this.onCallMessage({ peerId, text, from: identity.id, time: Date.now() });
    }
    return true;
  }

  async sendGroupCallMessage(groupCallId, text) {
    const groupCall = this.groupCalls.get(groupCallId);
    if (!groupCall) return false;

    for (const [memberId, conn] of groupCall.connections) {
      if (!conn.e2eeKey) continue;
      const encrypted = this._encryptSignaling(conn.e2eeKey, {
        callType: 'call-message',
        text,
        from: identity.id,
        groupCallId,
        time: Date.now()
      });
      p2pNetwork.sendToPeer(memberId, { type: 'call-message', data: encrypted });
    }

    if (this.onCallMessage) {
      this.onCallMessage({ groupCallId, text, from: identity.id, time: Date.now() });
    }
    return true;
  }

  async _handleCallMessage(peerId, msg) {
    const call = this.calls.get(peerId);
    let e2eeKey = call?.e2eeKey;

    if (!e2eeKey) {
      // Может быть от группового звонка
      for (const [groupId, groupCall] of this.groupCalls) {
        const conn = groupCall.connections.get(peerId);
        if (conn?.e2eeKey) {
          e2eeKey = conn.e2eeKey;
          break;
        }
      }
    }

    if (!e2eeKey) return;

    let data = msg.data;
    if (data?.ciphertext) {
      data = this._decryptSignaling(e2eeKey, data);
      if (!data) return;
    }

    if (this.onCallMessage) {
      this.onCallMessage({
        peerId,
        text: data.text,
        from: data.from || peerId,
        groupCallId: data.groupCallId,
        time: data.time || Date.now()
      });
    }
  }

  // ========== ОДИНОЧНЫЕ ЗВОНКИ ==========

  async startCall(peerId, video = true) {
    if (this.calls.has(peerId)) return false;
    if (!this._checkSpam(peerId) || !this._authenticatePeer(peerId)) return false;

    const e2eeKey = await this._getCallKey(peerId);
    if (!e2eeKey) { p2pNetwork.sendToPeer(peerId, { type: 'request-profile' }); return false; }

    let localStream;
    try { localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true }); }
    catch(e) { try { localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); } catch(e2) { return false; } }

    const pc = new RTCPeerConnection(this.rtcConfig);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        p2pNetwork.sendToPeer(peerId, {
          type: 'call-signal',
          data: this._encryptSignaling(e2eeKey, { callType: 'ice-candidate', candidate: e.candidate })
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this._startBitrateMonitor(peerId, pc);
        const c = this.calls.get(peerId); if (c) c.connected = true;
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.endCall(peerId);
      }
    };

    pc.ontrack = (e) => { if (this.onRemoteStream) this.onRemoteStream({ peerId, stream: e.streams[0] }); };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    p2pNetwork.sendToPeer(peerId, {
      type: 'call-signal',
      data: this._encryptSignaling(e2eeKey, {
        callType: 'offer', sdp: offer, video,
        signature: cryptoModule.sign(identity.getX25519SecretKey(), JSON.stringify(offer)),
        from: identity.id
      })
    });

    this.calls.set(peerId, { pc, stream: localStream, video, e2eeKey, startTime: Date.now() });
    setTimeout(() => { const c = this.calls.get(peerId); if (c && !c.connected) this.endCall(peerId); }, CALL_TIMEOUT);
    return true;
  }

  async acceptCall(peerId, video = true) {
    if (this.calls.has(peerId) || !this._authenticatePeer(peerId)) return null;
    const e2eeKey = await this._getCallKey(peerId);
    if (!e2eeKey) return null;

    let localStream;
    try { localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true }); }
    catch(e) { try { localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); } catch(e2) { return null; } }

    const pc = new RTCPeerConnection(this.rtcConfig);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = (e) => {
      if (e.candidate) p2pNetwork.sendToPeer(peerId, {
        type: 'call-signal',
        data: this._encryptSignaling(e2eeKey, { callType: 'ice-candidate', candidate: e.candidate })
      });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { this._startBitrateMonitor(peerId, pc); const c = this.calls.get(peerId); if (c) c.connected = true; }
      else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') this.endCall(peerId);
    };
    pc.ontrack = (e) => { if (this.onRemoteStream) this.onRemoteStream({ peerId, stream: e.streams[0] }); };

    this.calls.set(peerId, { pc, stream: localStream, video, e2eeKey, startTime: Date.now() });
    return pc;
  }

  async handleSignal(peerId, msg) {
    if (msg.type === 'call-message') { await this._handleCallMessage(peerId, msg); return; }

    const call = this.calls.get(peerId);
    if (!call) {
      if (msg.data?.ciphertext) {
        const e2eeKey = await this._getCallKey(peerId);
        if (!e2eeKey) return;
        const decrypted = this._decryptSignaling(e2eeKey, msg.data);
        if (!decrypted || decrypted.callType !== 'offer') return;
        if (decrypted.signature && !cryptoModule.verify(
          messageHandler.peerProfiles.get(peerId)?.x25519PublicKey || '',
          JSON.stringify(decrypted.sdp), decrypted.signature
        )) return;
        if (!this.allowIncomingCalls) return;
        if (this.onIncomingCall) this.onIncomingCall({ peerId, video: decrypted.video, sdp: decrypted.sdp, e2eeKey });
      }
      return;
    }

    let sd = msg.data;
    if (sd?.ciphertext) { sd = this._decryptSignaling(call.e2eeKey, sd); if (!sd) return; }

    switch (sd.callType) {
      case 'answer': await call.pc.setRemoteDescription(new RTCSessionDescription(sd.sdp)); break;
      case 'ice-candidate': try { await call.pc.addIceCandidate(new RTCIceCandidate(sd.candidate)); } catch(e) {} break;
      case 'end': this.endCall(peerId, true); break;
    }
  }

  // ========== ГРУППОВЫЕ ЗВОНКИ ==========

  async startGroupCall(groupKey, video = true) {
    const group = groupManager.groups.get(groupKey);
    if (!group) return false;
    const members = group.members.filter(m => m !== identity.id);
    if (members.length === 0 || members.length > 10) return false;

    let localStream;
    try { localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true }); }
    catch(e) { try { localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); } catch(e2) { return false; } }

    const groupCallId = 'group_call_' + Date.now().toString(36);
    const connections = new Map();

    for (const memberId of members) {
      if (!this._checkSpam(memberId)) continue;
      const e2eeKey = await this._getCallKey(memberId);
      if (!e2eeKey) continue;

      const pc = new RTCPeerConnection(this.rtcConfig);
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream.clone()));

      pc.onicecandidate = (e) => {
        if (e.candidate) p2pNetwork.sendToPeer(memberId, {
          type: 'group-call-signal',
          data: this._encryptSignaling(e2eeKey, { callType: 'ice-candidate', candidate: e.candidate, groupCallId })
        });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') this._startBitrateMonitor(memberId, pc);
        else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          connections.delete(memberId); try { pc.close(); } catch(e) {}
        }
      };
      pc.ontrack = (e) => { if (this.onRemoteStream) this.onRemoteStream({ peerId: memberId, stream: e.streams[0], groupCallId }); };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      p2pNetwork.sendToPeer(memberId, {
        type: 'group-call-signal',
        data: this._encryptSignaling(e2eeKey, {
          callType: 'group-offer', sdp: offer, video, groupCallId, groupKey,
          signature: cryptoModule.sign(identity.getX25519SecretKey(), JSON.stringify({ offer, groupCallId }))
        })
      });
      connections.set(memberId, { pc, e2eeKey, connected: false });
    }

    localStream.getTracks().forEach(t => t.stop());
    this.groupCalls.set(groupCallId, { groupKey, connections, initiator: identity.id, video, startTime: Date.now() });
    return groupCallId;
  }

  async handleGroupCallSignal(peerId, msg) {
    if (msg.type === 'call-message') { await this._handleCallMessage(peerId, msg); return; }

    let groupCall = [...this.groupCalls.values()].find(gc => gc.connections.has(peerId));
    if (!groupCall && msg.data?.ciphertext) {
      const e2eeKey = await this._getCallKey(peerId);
      if (!e2eeKey) return;
      const decrypted = this._decryptSignaling(e2eeKey, msg.data);
      if (!decrypted || decrypted.callType !== 'group-offer') return;

      let ls;
      try { ls = await navigator.mediaDevices.getUserMedia({ video: decrypted.video, audio: true }); }
      catch(e) { try { ls = await navigator.mediaDevices.getUserMedia({ video: false, audio: true }); } catch(e2) { return; } }

      const pc = new RTCPeerConnection(this.rtcConfig);
      ls.getTracks().forEach(t => pc.addTrack(t, ls));

      pc.onicecandidate = (e) => {
        if (e.candidate) p2pNetwork.sendToPeer(peerId, {
          type: 'group-call-signal',
          data: this._encryptSignaling(e2eeKey, { callType: 'ice-candidate', candidate: e.candidate, groupCallId: decrypted.groupCallId })
        });
      };
      pc.onconnectionstatechange = () => { if (pc.connectionState === 'connected') this._startBitrateMonitor(peerId, pc); };
      pc.ontrack = (e) => { if (this.onRemoteStream) this.onRemoteStream({ peerId, stream: e.streams[0], groupCallId: decrypted.groupCallId }); };

      await pc.setRemoteDescription(new RTCSessionDescription(decrypted.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      p2pNetwork.sendToPeer(peerId, {
        type: 'group-call-signal',
        data: this._encryptSignaling(e2eeKey, { callType: 'group-answer', sdp: answer, groupCallId: decrypted.groupCallId })
      });

      const connections = new Map();
      connections.set(peerId, { pc, e2eeKey, connected: true });
      this.groupCalls.set(decrypted.groupCallId, {
        groupKey: decrypted.groupKey, connections, initiator: peerId,
        video: decrypted.video, startTime: Date.now()
      });
      return;
    }

    if (groupCall) {
      const conn = groupCall.connections.get(peerId);
      if (!conn) return;
      let sd = msg.data;
      if (sd?.ciphertext) { sd = this._decryptSignaling(conn.e2eeKey, sd); if (!sd) return; }
      switch (sd.callType) {
        case 'group-answer': await conn.pc.setRemoteDescription(new RTCSessionDescription(sd.sdp)); break;
        case 'ice-candidate': try { await conn.pc.addIceCandidate(new RTCIceCandidate(sd.candidate)); } catch(e) {} break;
      }
    }
  }

  endGroupCall(groupCallId) {
    const gc = this.groupCalls.get(groupCallId);
    if (!gc) return;
    gc.connections.forEach((conn, pid) => { this._stopBitrateMonitor(pid); try { conn.pc.close(); } catch(e) {} });
    this.groupCalls.delete(groupCallId);
  }

  // ========== ЗАВЕРШЕНИЕ ==========

  endCall(peerId, fromRemote = false) {
    const call = this.calls.get(peerId);
    if (!call) return;
    this._stopBitrateMonitor(peerId);
    if (call.stream) call.stream.getTracks().forEach(t => t.stop());
    try { call.pc.close(); } catch(e) {}
    this.calls.delete(peerId);
    if (!fromRemote && call.e2eeKey) {
      p2pNetwork.sendToPeer(peerId, {
        type: 'call-signal',
        data: this._encryptSignaling(call.e2eeKey, { callType: 'end' })
      });
    }
    this._logCall(peerId, call);
    if (this.onCallEnded) this.onCallEnded({ peerId });
  }

  endAllCalls() {
    this.calls.forEach((c, pid) => this.endCall(pid));
    this.groupCalls.forEach((_, gid) => this.endGroupCall(gid));
  }

  toggleAudio(peerId) {
    const c = this.calls.get(peerId);
    if (c?.stream) c.stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
  }

  toggleVideo(peerId) {
    const c = this.calls.get(peerId);
    if (c?.stream) c.stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
  }

  async _logCall(peerId, call) {
    await storage.saveMessage('call_logs', {
      from: identity.id,
      text: JSON.stringify({ peerId, startTime: call.startTime, endTime: Date.now(), duration: Date.now() - call.startTime, video: call.video }),
      time: Date.now(), type: 'call_log'
    });
  }

  onIncoming(cb) { this.onIncomingCall = cb; }
  onStream(cb) { this.onRemoteStream = cb; }
  onEnd(cb) { this.onCallEnded = cb; }
  onMessage(cb) { this.onCallMessage = cb; }
}

export default new CallManager();
