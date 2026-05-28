// call-manager.js — видео/аудио звонки + SDP сжатие

import swarmManager from './swarm-manager.js';

class CallManager {
  constructor() {
    this.activeCalls = new Map();    // peerId -> { pc, stream, type }
    this.localStream = null;
    this.onIncomingCall = null;
    this.onCallEnded = null;
    this.onStreamReady = null;
    
    // STUN-сервер для WebRTC
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  // ============ ЗАПУСК ЗВОНКА ============

  async startCall(peerId, videoEnabled = true) {
    // Получаем локальный поток
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled,
        audio: true
      });
    } catch (e) {
      console.log('Нет доступа к камере/микрофону:', e);
      if (videoEnabled) {
        // Пробуем только аудио
        this.localStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
      } else {
        return false;
      }
    }

    const pc = new RTCPeerConnection(this.rtcConfig);
    
    // Добавляем треки
    this.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream);
    });

    // ICE-кандидаты
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling(peerId, {
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    // Создаём offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Сжимаем SDP
    const compressed = this.compressSDP(offer);
    
    this.sendSignaling(peerId, {
      type: 'call-offer',
      sdp: compressed,
      video: videoEnabled
    });

    this.activeCalls.set(peerId, {
      pc,
      stream: this.localStream,
      type: videoEnabled ? 'video' : 'audio'
    });

    return true;
  }

  // ============ ОТВЕТ НА ЗВОНОК ============

  async answerCall(peerId, videoEnabled = true) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled,
        audio: true
      });
    } catch (e) {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      });
    }

    const pc = new RTCPeerConnection(this.rtcConfig);
    
    this.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream);
    });

    pc.ontrack = (event) => {
      if (this.onStreamReady) {
        this.onStreamReady({ peerId, stream: event.streams[0] });
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling(peerId, {
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    this.activeCalls.set(peerId, {
      pc,
      stream: this.localStream,
      type: videoEnabled ? 'video' : 'audio'
    });

    return pc;
  }

  // ============ ОБРАБОТКА СИГНАЛОВ ============

  async handleSignaling(peerId, data) {
    switch (data.type) {
      case 'call-offer':
        if (this.onIncomingCall) {
          this.onIncomingCall({
            peerId,
            video: data.video,
            sdp: data.sdp
          });
        }
        break;

      case 'call-answer':
        await this.handleAnswer(peerId, data);
        break;

      case 'ice-candidate':
        await this.handleIceCandidate(peerId, data);
        break;

      case 'call-end':
        this.endCall(peerId);
        break;
    }
  }

  async handleAnswer(peerId, data) {
    const call = this.activeCalls.get(peerId);
    if (!call) return;

    const decompressed = this.decompressSDP(data.sdp);
    await call.pc.setRemoteDescription(new RTCSessionDescription(decompressed));

    call.pc.ontrack = (event) => {
      if (this.onStreamReady) {
        this.onStreamReady({ peerId, stream: event.streams[0] });
      }
    };
  }

  async handleIceCandidate(peerId, data) {
    const call = this.activeCalls.get(peerId);
    if (!call) return;

    try {
      await call.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {
      console.log('Ошибка ICE:', e);
    }
  }

  // ============ ОТПРАВКА СИГНАЛОВ ============

  sendSignaling(peerId, data) {
    swarmManager.sendToPeer(peerId, {
      type: 'signaling',
      callData: data
    });
  }

  // ============ SDP СЖАТИЕ ============

  compressSDP(sessionDesc) {
    const sdp = sessionDesc.sdp;
    const lines = sdp.split('\n');
    
    // Извлекаем только нужное
    let ufrag = '';
    let pwd = '';
    let fingerprint = '';
    
    lines.forEach(line => {
      if (line.startsWith('a=ice-ufrag:')) {
        ufrag = line.substring(12);
      } else if (line.startsWith('a=ice-pwd:')) {
        pwd = line.substring(10);
      } else if (line.startsWith('a=fingerprint:sha-256 ')) {
        fingerprint = line.substring(22).replace(/:/g, '');
      }
    });

    // Сжимаем в короткую строку
    return `${ufrag}|${pwd}|${fingerprint}`;
  }

  decompressSDP(compressed) {
    const parts = compressed.split('|');
    if (parts.length < 3) return { type: 'answer', sdp: '' };

    const [ufrag, pwd, fp] = parts;
    
    // Добавляем двоеточия обратно в fingerprint
    const fingerprint = fp.match(/.{2}/g).join(':').toUpperCase();

    return {
      type: 'answer',
      sdp: `v=0
o=- 0 0 IN IP4 0.0.0.0
s=-
t=0 0
a=group:BUNDLE 0
m=application 9 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 0.0.0.0
a=ice-ufrag:${ufrag}
a=ice-pwd:${pwd}
a=fingerprint:sha-256 ${fingerprint}
a=setup:active
a=mid:0
a=sctp-port:5000`
    };
  }

  // ============ ЗАВЕРШЕНИЕ ЗВОНКА ============

  endCall(peerId) {
    const call = this.activeCalls.get(peerId);
    if (!call) return;

    // Останавливаем треки
    if (call.stream) {
      call.stream.getTracks().forEach(track => track.stop());
    }

    // Закрываем соединение
    call.pc.close();
    this.activeCalls.delete(peerId);

    // Уведомляем пира
    this.sendSignaling(peerId, { type: 'call-end' });

    if (this.onCallEnded) {
      this.onCallEnded({ peerId });
    }
  }

  endAllCalls() {
    this.activeCalls.forEach((call, peerId) => {
      this.endCall(peerId);
    });
  }

  // ============ MUTE/UNMUTE ============

  toggleAudio(peerId) {
    const call = this.activeCalls.get(peerId);
    if (!call || !call.stream) return;

    call.stream.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
  }

  toggleVideo(peerId) {
    const call = this.activeCalls.get(peerId);
    if (!call || !call.stream) return;

    call.stream.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
  }

  // ============ КОЛБЭКИ ============

  setOnIncomingCall(callback) {
    this.onIncomingCall = callback;
  }

  setOnCallEnded(callback) {
    this.onCallEnded = callback;
  }

  setOnStreamReady(callback) {
    this.onStreamReady = callback;
  }
}

const callManager = new CallManager();
export default callManager;
