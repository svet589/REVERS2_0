// call-manager.js — WebRTC видео/аудио звонки

import swarmManager from './swarm-manager.js';

const callManager = {
  _calls: new Map(),
  _localStream: null,
  _onIncoming: null,
  _onStream: null,
  _onEnd: null,

  rtcConfig: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  },

  async startCall(peerId, video = true) {
    try {
      this._localStream = await navigator.mediaDevices.getUserMedia({
        video: video,
        audio: true
      });
    } catch (e) {
      console.error('Нет доступа к камере/микрофону:', e);
      return false;
    }

    const pc = new RTCPeerConnection(this.rtcConfig);

    this._localStream.getTracks().forEach(track => {
      pc.addTrack(track, this._localStream);
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        swarmManager.send(peerId, { type: 'ice', candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        console.log('🔗 Звонок установлен с', peerId);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.endCall(peerId);
      }
    };

    pc.ontrack = (e) => {
      if (this._onStream) {
        this._onStream({ peerId, stream: e.streams[0] });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    swarmManager.send(peerId, { type: 'call-offer', sdp: offer, video });

    this._calls.set(peerId, { pc, stream: this._localStream, video });
    return true;
  },

  async acceptCall(peerId, video = true) {
    try {
      this._localStream = await navigator.mediaDevices.getUserMedia({
        video: video,
        audio: true
      });
    } catch (e) {
      return false;
    }

    const pc = new RTCPeerConnection(this.rtcConfig);

    this._localStream.getTracks().forEach(track => {
      pc.addTrack(track, this._localStream);
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        swarmManager.send(peerId, { type: 'ice', candidate: e.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.endCall(peerId);
      }
    };

    pc.ontrack = (e) => {
      if (this._onStream) {
        this._onStream({ peerId, stream: e.streams[0] });
      }
    };

    this._calls.set(peerId, { pc, stream: this._localStream, video });
    return pc;
  },

  async handleOffer(peerId, sdp, video) {
    const pc = await this.acceptCall(peerId, video);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    swarmManager.send(peerId, { type: 'call-answer', sdp: answer });
  },

  async handleAnswer(peerId, sdp) {
    const call = this._calls.get(peerId);
    if (!call) return;
    await call.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  },

  async handleIce(peerId, candidate) {
    const call = this._calls.get(peerId);
    if (!call) return;
    try {
      await call.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Ошибка ICE:', e);
    }
  },

  handleSignaling(peerId, msg) {
    switch (msg.type) {
      case 'call-offer':
        if (this._onIncoming) {
          this._onIncoming({ peerId, video: msg.video, sdp: msg.sdp });
        }
        break;
      case 'call-answer':
        this.handleAnswer(peerId, msg.sdp);
        break;
      case 'ice':
        this.handleIce(peerId, msg.candidate);
        break;
      case 'call-end':
        this.endCall(peerId, true);
        break;
    }
  },

  endCall(peerId, fromRemote = false) {
    const call = this._calls.get(peerId);
    if (!call) return;

    if (call.stream) {
      call.stream.getTracks().forEach(t => t.stop());
    }
    call.pc.close();
    this._calls.delete(peerId);

    if (!fromRemote) {
      swarmManager.send(peerId, { type: 'call-end' });
    }

    if (this._onEnd) this._onEnd({ peerId });
  },

  endAllCalls() {
    this._calls.forEach((call, peerId) => this.endCall(peerId));
  },

  toggleAudio(peerId) {
    const call = this._calls.get(peerId);
    if (call?.stream) {
      call.stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
    }
  },

  toggleVideo(peerId) {
    const call = this._calls.get(peerId);
    if (call?.stream) {
      call.stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
    }
  },

  onIncoming(cb) { this._onIncoming = cb; },
  onStream(cb) { this._onStream = cb; },
  onEnd(cb) { this._onEnd = cb; }
};

export default callManager;
