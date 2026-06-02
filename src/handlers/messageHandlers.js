// src/handlers/messageHandlers.js — обработка сообщений
import messageHandler from '../core/message-handler.js';
import p2pNetwork from '../core/p2p-network.js';
import identity from '../core/identity.js';
import { MESSAGE_STATUS, UI } from '../utils/constants.js';
import { getRaw, setRaw, remove } from '../utils/storage.js';

export function initMessageHandlers(eventBus) {
  // Входящие сообщения
  messageHandler.onMessage((msg) => {
    if (msg.type === 'typing') {
      eventBus.emit('typing', { peerId: msg.from, isTyping: msg.typing !== false });
      return;
    }
    if (msg.type === 'p2p-signal') {
      eventBus.emit('signal', msg);
      return;
    }
    eventBus.emit('newMessage', msg);
  });

  messageHandler.onChatUpdate(() => {
    eventBus.emit('chatsUpdated');
  });

  eventBus.on('sendMessage', async ({ peerId, text }) => {
    const sent = await messageHandler.sendMessage(peerId, text);
    eventBus.emit('messageSent', { peerId, text, sent });
    if (!sent) eventBus.emit('messageQueued', { peerId, text });
  });

  eventBus.on('sendFile', async ({ peerId, file }) => {
    await messageHandler.sendFile(peerId, file);
  });

  eventBus.on('sendVoice', async ({ peerId, audioBase64, duration }) => {
    await messageHandler.sendVoice(peerId, audioBase64, duration);
  });

  eventBus.on('sendTyping', ({ peerId }) => {
    messageHandler.sendTyping(peerId);
  });

  eventBus.on('getChatHistory', async ({ peerId }) => {
    const history = await messageHandler.getChatHistory(peerId);
    eventBus.emit('chatHistory', { peerId, history });
  });

  eventBus.on('getAllChats', async () => {
    const chats = await messageHandler.getAllChats();
    eventBus.emit('allChats', chats);
  });

  eventBus.on('clearHistory', async ({ peerId }) => {
    await messageHandler.clearChatHistory(peerId);
    eventBus.emit('historyCleared', { peerId });
  });

  eventBus.on('deleteMessage', async ({ peerId, msgIdx }) => {
    const history = await messageHandler.getChatHistory(peerId);
    if (history && history[msgIdx]) {
      history.splice(msgIdx, 1);
      await messageHandler.clearChatHistory(peerId);
      for (const msg of history) {
        await messageHandler.sendMessage(peerId, msg.text);
      }
      eventBus.emit('messageDeleted', { peerId, msgIdx });
    }
  });

  // Черновики
  eventBus.on('saveDraft', ({ chatId, text }) => {
    if (text && text.trim()) {
      setRaw(UI.DRAFT_PREFIX + chatId, text);
    } else {
      remove(UI.DRAFT_PREFIX + chatId);
    }
  });

  eventBus.on('loadDraft', ({ chatId }) => {
    const draft = getRaw(UI.DRAFT_PREFIX + chatId);
    eventBus.emit('draftLoaded', { chatId, draft: draft || '' });
  });

  // Подключение пиров
  eventBus.on('connectToPeer', ({ peerId }) => {
    p2pNetwork.connectToPeer(peerId);
  });

  eventBus.on('acceptPeer', ({ peerId, signal }) => {
    p2pNetwork.acceptPeer(peerId, signal);
  });

  eventBus.on('applySignal', ({ peerId, signal }) => {
    p2pNetwork.applySignal(peerId, signal);
  });

  // Статус соединения
  p2pNetwork.onPeerEvent((event) => {
    eventBus.emit('peerConnection', event);
  });

  console.log('📨 Message handlers инициализированы');
              }
