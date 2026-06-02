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
// src/handlers/fileHandlers.js — обработка файлов
import messageHandler from '../core/message-handler.js';

export function initFileHandlers(eventBus) {
  // Отправка файла
  eventBus.on('sendFile', async ({ peerId, file }) => {
    if (!file) return;
    
    eventBus.emit('fileUploadStart', { fileName: file.name, fileSize: file.size });
    
    try {
      await messageHandler.sendFile(peerId, file);
      eventBus.emit('fileUploadComplete', { fileName: file.name, fileSize: file.size });
    } catch(e) {
      eventBus.emit('fileUploadError', { fileName: file.name, error: e.message });
    }
  });

  // Отправка голосового
  eventBus.on('sendVoice', async ({ peerId, audioBase64, duration }) => {
    await messageHandler.sendVoice(peerId, audioBase64, duration);
    eventBus.emit('voiceSent', { peerId, duration });
  });

  // Запись голосового
  eventBus.on('startRecording', async () => {
    const recorder = await messageHandler.recordVoice();
    eventBus.emit('recordingStarted', recorder);
  });

  // Открытие медиа
  eventBus.on('openMedia', ({ data, type }) => {
    if (!data) return;
    
    if (type?.startsWith('image/')) {
      eventBus.emit('showImageViewer', { src: data });
    } else if (type?.startsWith('video/')) {
      eventBus.emit('showVideoPlayer', { src: data });
    } else if (type?.startsWith('audio/')) {
      const audio = new Audio(data);
      audio.play().catch(() => {});
    }
  });

  // Экспорт чата
  eventBus.on('exportChat', async ({ chatId, chatName, type = 'json' }) => {
    const history = await messageHandler.getChatHistory(chatId);
    if (!history || !history.length) {
      eventBus.emit('exportError', { error: 'Нет сообщений для экспорта' });
      return;
    }

    let blob, ext;
    if (type === 'html') {
      const name = chatName || 'Чат';
      let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${name}</title>
        <style>body{background:#0F0F12;color:#EFEFEF;font-family:system-ui;padding:20px;max-width:600px;margin:0 auto;}
        .msg{margin:8px 0;padding:10px 14px;border-radius:16px;}.out{text-align:right;background:#1A1A23;}.in{background:#2A2A3A;}
        .time{font-size:0.7rem;color:#7A7A8A;}</style></head><body><h1>${name}</h1>`;
      history.forEach(msg => {
        html += `<div class="msg ${msg.from === 'me' ? 'out' : 'in'}"><div>${msg.text || ''}</div><div class="time">${new Date(msg.time).toLocaleString()}</div></div>`;
      });
      html += '</body></html>';
      blob = new Blob([html], { type: 'text/html' });
      ext = 'html';
    } else {
      blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
      ext = 'json';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chatName || 'chat'}_export.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    
    eventBus.emit('exportComplete', { fileName: a.download });
  });

  console.log('📎 File handlers инициализированы');
}
