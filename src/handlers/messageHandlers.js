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
// src/handlers/messageHandlers.js — обработка сообщений
import messageHandler from '../core/message-handler.js';
import p2pNetwork from '../core/p2p-network.js';
import identity from '../core/identity.js';
import { UI } from '../utils/constants.js';
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

  // Отправка сообщения — слушаем sendCurrentMessage
  eventBus.on('sendCurrentMessage', () => {
    const input = document.getElementById('messageInput');
    const text = input?.value?.trim();
    if (!text) return;

    // Получаем текущий чат из ChatScreen
    eventBus.emit('getCurrentChat');
    eventBus.once('currentChat', (chat) => {
      if (!chat) return;

      let peerId = 'me';
      if (chat.type === 'contact') peerId = chat.id;
      else if (chat.type === 'group') {
        eventBus.emit('sendGroupMessage', { groupKey: chat.id, text });
        return;
      } else if (chat.type === 'channel') {
        eventBus.emit('sendChannelMessage', { channelKey: chat.id, text });
        return;
      } else if (chat.type === 'saved') peerId = 'me';

      messageHandler.sendMessage(peerId, text);
      eventBus.emit('messageSent', { peerId, text });
    });

    if (input) input.value = '';
  });

  // Остальные обработчики
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

  eventBus.on('saveDraft', ({ chatId, text }) => {
    text?.trim() ? setRaw(UI.DRAFT_PREFIX + chatId, text) : remove(UI.DRAFT_PREFIX + chatId);
  });

  eventBus.on('loadDraft', ({ chatId }) => {
    eventBus.emit('draftLoaded', { chatId, draft: getRaw(UI.DRAFT_PREFIX + chatId) || '' });
  });

  eventBus.on('connectToPeer', ({ peerId }) => p2pNetwork.connectToPeer(peerId));
  eventBus.on('acceptPeer', ({ peerId, signal }) => p2pNetwork.acceptPeer(peerId, signal));
  eventBus.on('applySignal', ({ peerId, signal }) => p2pNetwork.applySignal(peerId, signal));

  p2pNetwork.onPeerEvent((event) => eventBus.emit('peerConnection', event));

  console.log('📨 Message handlers инициализированы');
  }
