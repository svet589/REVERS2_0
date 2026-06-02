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
  // Получить все паки
  eventBus.on('getStickerPacks', () => {
    const packs = stickerManager.getPacks();
    eventBus.emit('stickerPacks', packs);
  });

  // Получить стикеры пака
  eventBus.on('getStickers', ({ packId }) => {
    const stickers = stickerManager.getStickers(packId);
    eventBus.emit('stickersLoaded', { packId, stickers });
  });

  // Создать стикерпак
  eventBus.on('createStickerPack', ({ name }) => {
    const packId = stickerManager.createPack(name);
    eventBus.emit('stickerPackCreated', { packId, name });
  });

  // Добавить стикер в пак
  eventBus.on('addSticker', ({ packId, data, emoji }) => {
    const success = stickerManager.addSticker(packId, data, emoji);
    if (success) {
      eventBus.emit('stickerAdded', { packId, data, emoji });
    }
  });

  // Добавить в недавние
  eventBus.on('addToRecent', ({ stickerData }) => {
    stickerManager.addToRecent(stickerData);
    eventBus.emit('recentUpdated');
  });

  // Отправить стикер
  eventBus.on('sendSticker', ({ sticker }) => {
    eventBus.emit('stickerSent', { sticker });
  });

  // Удалить стикерпак
  eventBus.on('deleteStickerPack', ({ packId }) => {
    stickerManager.deletePack(packId);
    eventBus.emit('stickerPackDeleted', { packId });
  });

  // Чтение файла стикера
  eventBus.on('readStickerFile', ({ file }) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      eventBus.emit('stickerFileRead', { data: e.target.result, file });
    };
    reader.readAsDataURL(file);
  });

  console.log('😊 Sticker handlers инициализированы');
}
