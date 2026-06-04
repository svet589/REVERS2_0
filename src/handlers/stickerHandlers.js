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
    // src/handlers/stickerHandlers.js — обработка стикеров
import stickerManager from '../core/sticker-manager.js';

export function initStickerHandlers(eventBus) {
  eventBus.on('toggleStickers', () => {
    const panel = document.getElementById('stickerPanel');
    if (panel) {
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        eventBus.emit('getStickerPacks');
      }
    }
  });

  eventBus.on('getStickerPacks', () => {
    const packs = stickerManager.getPacks();
    eventBus.emit('stickerPacks', packs);
  });

  eventBus.on('getStickers', ({ packId }) => {
    const stickers = stickerManager.getStickers(packId);
    eventBus.emit('stickersLoaded', { packId, stickers });
  });

  eventBus.on('createStickerPack', ({ name }) => {
    const packId = stickerManager.createPack(name);
    eventBus.emit('stickerPackCreated', { packId, name });
  });

  eventBus.on('addSticker', ({ packId, data, emoji }) => {
    stickerManager.addSticker(packId, data, emoji);
    eventBus.emit('stickerAdded', { packId });
  });

  eventBus.on('sendSticker', ({ sticker }) => {
    const text = typeof sticker === 'string' ? sticker : '🖼️';
    eventBus.emit('sendCurrentMessage', { forcedText: text });
  });

  eventBus.on('deleteStickerPack', ({ packId }) => {
    stickerManager.deletePack(packId);
    eventBus.emit('getStickerPacks');
  });

  console.log('😊 Sticker handlers инициализированы');
}
