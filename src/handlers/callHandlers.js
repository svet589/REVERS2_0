// src/handlers/callHandlers.js — обработка звонков
import callManager from './core/call-manager.js';

export function initCallHandlers(eventBus) {
  // Входящий звонок
  callManager.onIncoming((data) => {
    eventBus.emit('incomingCall', data);
  });

  // Удалённый видеопоток
  callManager.onStream(({ peerId, stream }) => {
    eventBus.emit('remoteStream', { peerId, stream });
  });

  // Сообщение в звонке
  callManager.onMessage(({ peerId, text, from, groupCallId }) => {
    eventBus.emit('callMessage', { peerId, text, from, groupCallId });
  });

  // Звонок завершён
  callManager.onEnd(({ peerId }) => {
    eventBus.emit('callEnded', { peerId });
  });

  // Запуск звонка
  eventBus.on('startCall', async ({ peerId, video = true }) => {
    const result = await callManager.startCall(peerId, video);
    eventBus.emit('callStarted', { peerId, video, success: result });
  });

  // Принятие звонка
  eventBus.on('acceptCall', async ({ peerId, video = true }) => {
    const pc = await callManager.acceptCall(peerId, video);
    if (pc) {
      eventBus.emit('callAccepted', { peerId, pc });
    }
  });

  // Групповой звонок
  eventBus.on('startGroupCall', async ({ groupKey, video = true }) => {
    const groupCallId = await callManager.startGroupCall(groupKey, video);
    if (groupCallId) {
      eventBus.emit('groupCallStarted', { groupCallId, groupKey, video });
    }
  });

  // Отправка сообщения в звонке
  eventBus.on('sendCallMessage', async ({ text, peerId, groupCallId }) => {
    if (groupCallId) {
      await callManager.sendGroupCallMessage(groupCallId, text);
    } else if (peerId) {
      await callManager.sendCallMessage(peerId, text);
    }
  });

  // Завершение звонка
  eventBus.on('endCall', ({ peerId }) => {
    callManager.endCall(peerId);
  });

  eventBus.on('endGroupCall', ({ groupCallId }) => {
    callManager.endGroupCall(groupCallId);
  });

  // Переключение микрофона/камеры
  eventBus.on('toggleMic', ({ peerId }) => {
    callManager.toggleAudio(peerId);
  });

  eventBus.on('toggleCam', ({ peerId }) => {
    callManager.toggleVideo(peerId);
  });

  // Настройки звонков
  eventBus.on('setAllowCalls', ({ allow }) => {
    callManager.setAllowIncomingCalls(allow);
  });

  // Блокировка звонящего
  eventBus.on('blockCaller', ({ peerId }) => {
    callManager.blockCaller(peerId);
  });

  eventBus.on('unblockCaller', ({ peerId }) => {
    callManager.unblockCaller(peerId);
  });

  console.log('📞 Call handlers инициализированы');
}
