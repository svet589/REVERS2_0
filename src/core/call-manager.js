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
// call-manager.js — ФИНАЛЬНАЯ ВЕРСИЯ
// ============================================================
import sodium from 'libsodium-wrappers-sumo';
import p2pNetwork from './p2p-network.js';
import identity from './identity.js';
import cryptoModule from './crypto-module.js';
import messageHandler from './message-handler.js';
import storage from './storage-adapter.js';
import groupManager from './group-manager.js';

class CallManager {
  constructor() {
    this.calls = new Map();
    this.groupCalls = new Map();
    this._bitrateMonitors = new Map();
    this.onIncomingCall = null;
    this.onRemoteStream = null;
    this.onCallEnded = null;
    this._pendingOffer = null;

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 2
    };
  }

  async _getCallKey(peerId) {
    const sharedKey = await messageHandler.getSharedKey(peerId);
    if (!sharedKey) return null;
    const material = new Uint8Array([...sharedKey, ...sodium.from_string('REVERS_CALL_v1')]);
    return cryptoModule.base64ToUint8Array(cryptoModule.hash(material));
  }

  async _encryptSignaling(e2eeKey, data) {
    if (!e2eeKey) return data;
    const json = JSON.stringify(data, Object.keys(data).sort());
    return cryptoModule.encrypt(e2eeKey, json);
  }

  async _decryptSignaling(e2eeKey, encrypted) {
    if (!e2eeKey || !encrypted?.ciphertext) return null;
    const decrypted = cryptoModule.decrypt(e2eeKey, encrypted);
    if (!decrypted) return null;
    return JSON.parse(decrypted);
  }

  async startCall(peerId, video = true) {
    if (this.calls.has(peerId)) return false;
    const e2eeKey = await this._getCallKey(peerId);
    if (!e2eeKey) return false;

    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
    } catch (e) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      } catch (e2) {
        return false;
      }
    }

    const pc = new RTCPeerConnection(this.rtcConfig);
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        p2pNetwork.sendToPeer(peerId, {
          type: 'call-signal',
          data: this._encryptSignaling(e2eeKey, { callType: 'ice-candidate', candidate: e.candidate })
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.endCall(peerId);
      }
    };

    pc.ontrack = (e) => {
      if (this.onRemoteStream) {
        this.onRemoteStream({ peerId, stream: e.streams[0] });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // sign() синхронный — убран await
    const signature = cryptoModule.sign(
      identity.getX25519SecretKey(),
      JSON.stringify(offer, Object.keys(offer).sort())
    );

    p2pNetwork.sendToPeer(peerId, {
      type: 'call-signal',
      data: this._encryptSignaling(e2eeKey, {
        callType: 'offer',
        sdp: offer,
        video,
        signature,
        from: identity.getMyId()
      })
    });

    this.calls.set(peerId, {
      pc,
      stream: localStream,
      video,
      e2eeKey,
      startTime: Date.now()
    });

    return true;
  }

  async acceptCall(peerId, video, offer, e2eeKey) {
    if (this.calls.has(peerId)) return null;
    if (!offer || !e2eeKey) return null;

    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
    } catch (e) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      } catch (e2) {
        return null;
      }
    }

    const pc = new RTCPeerConnection(this.rtcConfig);
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        p2pNetwork.sendToPeer(peerId, {
          type: 'call-signal',
          data: this._encryptSignaling(e2eeKey, { callType: 'ice-candidate', candidate: e.candidate })
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.endCall(peerId);
      }
    };

    pc.ontrack = (e) => {
      if (this.onRemoteStream) {
        this.onRemoteStream({ peerId, stream: e.streams[0] });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const signature = cryptoModule.sign(
      identity.getX25519SecretKey(),
      JSON.stringify(answer, Object.keys(answer).sort())
    );

    p2pNetwork.sendToPeer(peerId, {
      type: 'call-signal',
      data: this._encryptSignaling(e2eeKey, { callType: 'answer', sdp: answer, signature })
    });

    this.calls.set(peerId, {
      pc,
      stream: localStream,
      video,
      e2eeKey,
      startTime: Date.now()
    });

    return pc;
  }

  async handleSignal(peerId, msg) {
    const call = this.calls.get(peerId);

    if (!call) {
      if (msg.data?.ciphertext) {
        const e2eeKey = await this._getCallKey(peerId);
        if (!e2eeKey) return;

        const decrypted = await this._decryptSignaling(e2eeKey, msg.data);
        if (!decrypted || decrypted.callType !== 'offer') return;

        if (decrypted.signature) {
          const sdpStr = JSON.stringify(decrypted.sdp, Object.keys(decrypted.sdp).sort());
          const publicKey = messageHandler.peerProfiles?.get(peerId)?.x25519PublicKey;
          if (!publicKey) return;
          const valid = cryptoModule.verify(publicKey, sdpStr, decrypted.signature);
          if (!valid) return;
        }

        this._pendingOffer = {
          peerId,
          video: decrypted.video,
          offer: decrypted.sdp,
          e2eeKey
        };

        if (this.onIncomingCall) {
          this.onIncomingCall({
            peerId,
            video: decrypted.video,
            offer: decrypted.sdp,
            e2eeKey
          });
        }
      }
      return;
    }

    let signalData = msg.data;
    if (signalData?.ciphertext) {
      signalData = await this._decryptSignaling(call.e2eeKey, signalData);
      if (!signalData) return;
    }

    switch (signalData.callType) {
      case 'answer':
        await call.pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        break;
      case 'ice-candidate':
        try {
          await call.pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        } catch (e) {}
        break;
      case 'end':
        this.endCall(peerId, true);
        break;
    }
  }

  endCall(peerId, fromRemote = false) {
    const call = this.calls.get(peerId);
    if (!call) return;

    this._stopBitrateMonitor(peerId);

    if (call.stream) {
      call.stream.getTracks().forEach(t => t.stop());
    }
    if (call.pc) {
      call.pc.close();
    }

    if (!fromRemote && call.e2eeKey) {
      this._encryptSignaling(call.e2eeKey, { callType: 'end' }).then(encrypted => {
        p2pNetwork.sendToPeer(peerId, { type: 'call-signal', data: encrypted });
      }).catch(() => {});
    }

    this.calls.delete(peerId);
    this._logCall(peerId, call);

    if (this.onCallEnded) {
      this.onCallEnded({ peerId });
    }
  }

  // Групповые звонки
  async startGroupCall(groupKey, video = true) {
    const group = groupManager.getGroup(groupKey);
    if (!group) return false;

    const members = group.members.filter(m => m !== identity.getMyId());
    if (members.length === 0) return false;

    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
    } catch (e) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      } catch (e2) {
        return false;
      }
    }

    const groupCallId = 'group_call_' + Date.now().toString(36);
    const connections = new Map();

    for (const memberId of members) {
      const e2eeKey = await this._getCallKey(memberId);
      if (!e2eeKey) continue;

      const pc = new RTCPeerConnection(this.rtcConfig);
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          p2pNetwork.sendToPeer(memberId, {
            type: 'group-call-signal',
            data: this._encryptSignaling(e2eeKey, { callType: 'ice-candidate', candidate: e.candidate, groupCallId })
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      p2pNetwork.sendToPeer(memberId, {
        type: 'group-call-signal',
        data: this._encryptSignaling(e2eeKey, { callType: 'group-offer', sdp: offer, video, groupCallId, groupKey })
      });

      connections.set(memberId, { pc, e2eeKey });
    }

    localStream.getTracks().forEach(t => t.stop());

    this.groupCalls.set(groupCallId, {
      groupKey,
      connections,
      initiator: identity.getMyId(),
      video,
      startTime: Date.now()
    });

    return groupCallId;
  }

  async handleGroupCallSignal(peerId, msg) {
    let groupCall = [...this.groupCalls.values()].find(gc => gc.connections.has(peerId));

    if (!groupCall && msg.data?.ciphertext) {
      const e2eeKey = await this._getCallKey(peerId);
      if (!e2eeKey) return;

      const decrypted = await this._decryptSignaling(e2eeKey, msg.data);
      if (!decrypted || decrypted.callType !== 'group-offer') return;

      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: decrypted.video, audio: true });
      } catch (e) { return; }

      const pc = new RTCPeerConnection(this.rtcConfig);
      localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

      await pc.setRemoteDescription(new RTCSessionDescription(decrypted.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      p2pNetwork.sendToPeer(peerId, {
        type: 'group-call-signal',
        data: this._encryptSignaling(e2eeKey, { callType: 'group-answer', sdp: answer, groupCallId: decrypted.groupCallId })
      });

      const connections = new Map();
      connections.set(peerId, { pc, e2eeKey });
      this.groupCalls.set(decrypted.groupCallId, {
        groupKey: decrypted.groupKey,
        connections,
        initiator: peerId,
        video: decrypted.video,
        startTime: Date.now()
      });
      return;
    }

    if (groupCall) {
      const conn = groupCall.connections.get(peerId);
      if (!conn) return;

      let signalData = msg.data;
      if (signalData?.ciphertext) {
        signalData = await this._decryptSignaling(conn.e2eeKey, signalData);
        if (!signalData) return;
      }

      switch (signalData.callType) {
        case 'group-answer':
          await conn.pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          break;
        case 'ice-candidate':
          try { await conn.pc.addIceCandidate(new RTCIceCandidate(signalData.candidate)); } catch (e) {}
          break;
      }
    }
  }

  endGroupCall(groupCallId) {
    const gc = this.groupCalls.get(groupCallId);
    if (!gc) return;

    gc.connections.forEach((conn, pid) => {
      this._stopBitrateMonitor(pid);
      if (conn.pc) conn.pc.close();
    });

    this.groupCalls.delete(groupCallId);
  }

  _startBitrateMonitor(peerId, pc) {
    const monitor = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        let packetLoss = 0;
        stats.forEach(report => {
          if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
            const lost = report.packetsLost || 0;
            const received = report.packetsReceived || 1;
            packetLoss = lost / (lost + received);
          }
        });

        const sender = pc.getSenders()?.find(s => s.track?.kind === 'video');
        if (sender) {
          const params = sender.getParameters();
          if (params.encodings?.length) {
            const bitrate = packetLoss > 0.1 ? 50000 : packetLoss > 0.05 ? 100000 : 300000;
            params.encodings[0].maxBitrate = bitrate;
            sender.setParameters(params).catch(() => {});
          }
        }
      } catch (e) {}
    }, 2000);
    this._bitrateMonitors.set(peerId, monitor);
  }

  _stopBitrateMonitor(peerId) {
    const monitor = this._bitrateMonitors.get(peerId);
    if (monitor) { clearInterval(monitor); this._bitrateMonitors.delete(peerId); }
  }

  toggleAudio(peerId) {
    const call = this.calls.get(peerId);
    if (call?.stream) call.stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
  }

  toggleVideo(peerId) {
    const call = this.calls.get(peerId);
    if (call?.stream) call.stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
  }

  async _logCall(peerId, call) {
    await storage.saveMessage('call_logs', {
      from: identity.getMyId(),
      text: `📞 Звонок с ${peerId} (${call.video ? 'видео' : 'аудио'}) ${Math.round((Date.now() - (call.startTime || Date.now())) / 1000)}с`,
      time: Date.now(),
      type: 'call_log'
    });
  }

  onIncoming(cb) { this.onIncomingCall = cb; }
  onStream(cb) { this.onRemoteStream = cb; }
  onEnd(cb) { this.onCallEnded = cb; }
}

export default new CallManager();
