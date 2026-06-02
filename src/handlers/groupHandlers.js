// SPDX-License-Identifier: GPL-3.0-or-later
// src/handlers/groupHandlers.js — обработка групп
import groupManager from '../core/group-manager.js';
import messageHandler from '../core/message-handler.js';

export function initGroupHandlers(eventBus) {
  // Создание группы
  eventBus.on('createGroup', ({ name, type = 'chat' }) => {
    const group = groupManager.createGroup(name, type);
    eventBus.emit('groupCreated', group);
  });

  // Отправка в группу
  eventBus.on('sendGroupMessage', async ({ groupKey, text }) => {
    const sent = await groupManager.sendGroupMessage(groupKey, text);
    eventBus.emit('groupMessageSent', { groupKey, text, sent });
  });

  // Приглашение в группу
  eventBus.on('inviteToGroup', async ({ groupKey, peerId }) => {
    const sent = await groupManager.inviteToGroup(groupKey, peerId);
    eventBus.emit('groupInviteSent', { groupKey, peerId, sent });
  });

  // Принятие приглашения
  eventBus.on('acceptInvite', async ({ inviteToken }) => {
    const accepted = await groupManager.acceptInvite(inviteToken);
    eventBus.emit('inviteAccepted', { inviteToken, accepted });
  });

  // Исключение участника
  eventBus.on('removeMember', async ({ groupKey, memberId }) => {
    const removed = await groupManager.removeMember(groupKey, memberId);
    eventBus.emit('memberRemoved', { groupKey, memberId, removed });
  });

  // Роли
  eventBus.on('setRole', ({ groupKey, memberId, role }) => {
    groupManager.setRole(groupKey, memberId, role);
    eventBus.emit('roleChanged', { groupKey, memberId, role });
  });

  eventBus.on('createCustomRole', ({ groupKey, roleName, permissions }) => {
    groupManager.createCustomRole(groupKey, roleName, permissions);
    eventBus.emit('customRoleCreated', { groupKey, roleName });
  });

  // Темы (форум)
  eventBus.on('addTopic', ({ groupKey, name }) => {
    const topic = groupManager.addTopic(groupKey, name);
    if (topic) eventBus.emit('topicAdded', { groupKey, topic });
  });

  eventBus.on('removeTopic', ({ groupKey, topicId }) => {
    groupManager.removeTopic(groupKey, topicId);
    eventBus.emit('topicRemoved', { groupKey, topicId });
  });

  eventBus.on('togglePinTopic', ({ groupKey, topicId }) => {
    groupManager.togglePinTopic(groupKey, topicId);
    eventBus.emit('topicUpdated', { groupKey, topicId });
  });

  eventBus.on('toggleCloseTopic', ({ groupKey, topicId }) => {
    groupManager.toggleCloseTopic(groupKey, topicId);
    eventBus.emit('topicUpdated', { groupKey, topicId });
  });

  eventBus.on('sendToTopic', ({ groupKey, topicId, text }) => {
    groupManager.sendToTopic(groupKey, topicId, text);
    eventBus.emit('topicMessageSent', { groupKey, topicId, text });
  });

  // Объявления
  eventBus.on('addAnnouncement', async ({ groupKey, text }) => {
    await groupManager.addAnnouncement(groupKey, text);
    eventBus.emit('announcementAdded', { groupKey, text });
  });

  eventBus.on('removeAnnouncement', async ({ groupKey, announcementId }) => {
    await groupManager.removeAnnouncement(groupKey, announcementId);
    eventBus.emit('announcementRemoved', { groupKey, announcementId });
  });

  // Голосования
  eventBus.on('createPoll', async ({ groupKey, question, options, anonymous }) => {
    const poll = await groupManager.createPoll(groupKey, question, options, anonymous);
    eventBus.emit('pollCreated', { groupKey, poll });
  });

  eventBus.on('votePoll', async ({ groupKey, pollId, optionIndex }) => {
    await groupManager.votePoll(groupKey, pollId, optionIndex);
    eventBus.emit('pollVoted', { groupKey, pollId, optionIndex });
  });

  eventBus.on('closePoll', async ({ groupKey, pollId }) => {
    await groupManager.closePoll(groupKey, pollId);
    eventBus.emit('pollClosed', { groupKey, pollId });
  });

  // Настройки группы
  eventBus.on('setGroupType', ({ groupKey, type }) => {
    groupManager.setGroupType(groupKey, type);
    eventBus.emit('groupUpdated', { groupKey });
  });

  eventBus.on('setGroupAvatar', ({ groupKey, avatar }) => {
    groupManager.setGroupAvatar(groupKey, avatar);
    eventBus.emit('groupUpdated', { groupKey });
  });

  eventBus.on('updateGroupName', ({ groupKey, name }) => {
    groupManager.updateGroupName(groupKey, name);
    eventBus.emit('groupUpdated', { groupKey });
  });

  eventBus.on('deleteGroup', ({ groupKey }) => {
    groupManager.deleteGroup(groupKey);
    eventBus.emit('groupDeleted', { groupKey });
  });

  // Синхронизация структуры
  groupManager._handleGroupStructure = (msg) => {
    groupManager.handleGroupStructure(msg);
    eventBus.emit('groupStructureUpdated', msg);
  };

  console.log('👥 Group handlers инициализированы');
}
