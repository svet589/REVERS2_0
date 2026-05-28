// call-manager.js — видео/аудио звонки WebRTC

import p2pNetwork from './p2p-network.js';
import identity from './identity.js';

class CallManager {
  constructor() {
    this.calls = new Map();
    this.localStream = null;
    this.onIncomingCall = null;
    this.onRemoteStream = null;
    this.onCallEnded = null;
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
  }

  async startCall(peerId, video = true) {
    if (this.calls.has(peerId)) return false;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video,
        audio: true
      });
    } catch (e) {
      console.error('Нет доступа к камере/микрофону:', e);
      // Пробуем только аудио
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
      } catch (e2) {
        return false;
      }
    }

    const pc = new RTCPeerConnection(this.rtcConfig);

    this.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream);
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        p2pNetwork.sendToPeer(peerId, {
          type: 'call-signal',
          callType: 'ice-candidate',
          candidate: e.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        console.log('📹 Звонок установлен с', peerId);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
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

    p2pNetwork.sendToPeer(peerId, {
      type: 'call-signal',
      callType: 'offer',
      sdp: offer,
      video: video
    });

    this.calls.set(peerId, { pc, stream: this.localStream, video });
    return true;
  }

  async acceptCall(peerId, video = true) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video,
        audio: true
      });
    } catch (e) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
      } catch (e2) {
        return null;
      }
    }

    const pc = new RTCPeerConnection(this.rtcConfig);

    this.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream);
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        p2pNetwork.sendToPeer(peerId, {
          type: 'call-signal',
          callType: 'ice-candidate',
          candidate: e.candidate
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

    this.calls.set(peerId, { pc, stream: this.localStream, video });
    return pc;
  }

  handleSignal(peerId, data) {
    switch (data.callType) {
      case 'offer':
        if (this.onIncomingCall) {
          this.onIncomingCall({
            peerId,
            video: data.video,
            sdp: data.sdp
          });
        }
        break;

      case 'answer':
        this._handleAnswer(peerId, data.sdp);
        break;

      case 'ice-candidate':
        this._handleIce(peerId, data.candidate);
        break;

      case 'end':
        this.endCall(peerId, true);
        break;
    }
  }

  async _handleAnswer(peerId, sdp) {
    const call = this.calls.get(peerId);
    if (!call) return;
    try {
      await call.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (e) {
      console.error('Ошибка установки remote description:', e);
    }
  }

  async _handleIce(peerId, candidate) {
    const call = this.calls.get(peerId);
    if (!call) return;
    try {
      await call.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Ошибка ICE:', e);
    }
  }

  endCall(peerId, fromRemote = false) {
    const call = this.calls.get(peerId);
    if (!call) return;

    if (call.stream) {
      call.stream.getTracks().forEach(t => t.stop());
    }
    call.pc.close();
    this.calls.delete(peerId);

    if (!fromRemote) {
      p2pNetwork.sendToPeer(peerId, {
        type: 'call-signal',
        callType: 'end'
      });
    }

    if (this.onCallEnded) this.onCallEnded({ peerId });
  }

  endAllCalls() {
    this.calls.forEach((call, peerId) => this.endCall(peerId));
  }

  toggleAudio(peerId) {
    const call = this.calls.get(peerId);
    if (call?.stream) {
      call.stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    }
  }

  toggleVideo(peerId) {
    const call = this.calls.get(peerId);
    if (call?.stream) {
      call.stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
    }
  }

  onIncoming(cb) { this.onIncomingCall = cb; }
  onStream(cb) { this.onRemoteStream = cb; }
  onEnd(cb) { this.onCallEnded = cb; }
}

export default new CallManager();
