// SPDX-License-Identifier: GPL-3.0-or-later
// src/handlers/profileHandlers.js — обработка профиля
import identity from '../core/identity.js';

// Кэш профилей
const profileCache = new Map();

export function initProfileHandlers(eventBus) {
  // Получить свой профиль
  eventBus.on('getMyProfile', () => {
    const profile = identity.getProfile();
    eventBus.emit('myProfile', profile);
  });

  // Получить профиль пользователя
  eventBus.on('getUserProfile', async ({ userId }) => {
    if (profileCache.has(userId)) {
      eventBus.emit('userProfile', profileCache.get(userId));
      return;
    }

    // Запрашиваем профиль через P2P
    const { default: p2pNetwork } = await import('../core/p2p-network.js');
    p2pNetwork.sendToPeer(userId, { type: 'request-profile' });

    // Ждём ответ
    const unsubscribe = eventBus.on('profileReceived', ({ peerId, profile }) => {
      if (peerId === userId) {
        profileCache.set(userId, profile);
        eventBus.emit('userProfile', profile);
        unsubscribe();
      }
    });

    // Таймаут
    setTimeout(() => {
      if (profileCache.has(userId)) return;
      eventBus.emit('userProfile', {
        id: userId,
        name: userId,
        avatar: '',
        bio: '',
        diamonds: 0,
        gifts: []
      });
      unsubscribe();
    }, 5000);
  });

  // Обновить свой профиль
  eventBus.on('updateMyProfile', ({ name, avatar, bio }) => {
    if (name) identity.setName(name);
    if (avatar) identity.setAvatar(avatar);
    if (bio !== undefined) identity.setBio(bio);
    eventBus.emit('profileUpdated', identity.getProfile());
  });

  // Отправить подарок
  eventBus.on('sendGift', async ({ recipientId, gift }) => {
    const { default: p2pNetwork } = await import('../core/p2p-network.js');
    p2pNetwork.sendToPeer(recipientId, {
      type: 'gift',
      gift,
      from: identity.id,
      fromName: identity.name
    });
    eventBus.emit('giftSent', { recipientId, gift });
  });

  // Получить подарок
  eventBus.on('giftReceived', ({ from, fromName, gift }) => {
    const gifts = JSON.parse(localStorage.getItem('revers_gifts') || '[]');
    gifts.push({ from, fromName, gift, time: Date.now() });
    localStorage.setItem('revers_gifts', JSON.stringify(gifts));
    eventBus.emit('giftsUpdated', gifts);
  });

  // Получить список подарков
  eventBus.on('getMyGifts', () => {
    const gifts = JSON.parse(localStorage.getItem('revers_gifts') || '[]');
    eventBus.emit('myGifts', gifts);
  });

  // Алмазы (внутренняя валюта)
  eventBus.on('getDiamonds', () => {
    const diamonds = parseInt(localStorage.getItem('revers_diamonds') || '100');
    eventBus.emit('diamonds', diamonds);
  });

  eventBus.on('spendDiamonds', ({ amount }) => {
    const diamonds = parseInt(localStorage.getItem('revers_diamonds') || '100');
    if (diamonds >= amount) {
      localStorage.setItem('revers_diamonds', diamonds - amount);
      eventBus.emit('diamonds', diamonds - amount);
      eventBus.emit('diamondsSpent', { amount, remaining: diamonds - amount });
    } else {
      eventBus.emit('diamondsError', { message: 'Недостаточно алмазов' });
    }
  });

  eventBus.on('addDiamonds', ({ amount }) => {
    const diamonds = parseInt(localStorage.getItem('revers_diamonds') || '100');
    localStorage.setItem('revers_diamonds', diamonds + amount);
    eventBus.emit('diamonds', diamonds + amount);
  });

  // Экспорт/импорт identity
  eventBus.on('exportIdentity', async () => {
    const encrypted = await identity.exportEncrypted();
    eventBus.emit('identityExported', encrypted);
  });

  eventBus.on('importIdentity', async ({ encrypted }) => {
    await identity.importEncrypted(encrypted);
    eventBus.emit('identityImported', identity.getProfile());
  });

  console.log('👤 Profile handlers инициализированы');
}
