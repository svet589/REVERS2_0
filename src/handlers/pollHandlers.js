// SPDX-License-Identifier: GPL-3.0-or-later
// src/handlers/pollHandlers.js — обработка голосований
import groupManager from '../core/group-manager.js';

export function initPollHandlers(eventBus) {
  // Создать голосование
  eventBus.on('createPoll', async ({ groupKey, question, options, anonymous = false }) => {
    const poll = await groupManager.createPoll(groupKey, question, options, anonymous);
    eventBus.emit('pollCreated', { groupKey, poll });
  });

  // Проголосовать
  eventBus.on('votePoll', async ({ groupKey, pollId, optionIndex }) => {
    const success = await groupManager.votePoll(groupKey, pollId, optionIndex);
    if (success) {
      const polls = groupManager.getPolls(groupKey);
      const updated = polls.find(p => p.id === pollId);
      eventBus.emit('pollUpdated', { groupKey, poll: updated });
    }
  });

  // Закрыть голосование
  eventBus.on('closePoll', async ({ groupKey, pollId }) => {
    const success = await groupManager.closePoll(groupKey, pollId);
    if (success) {
      const polls = groupManager.getPolls(groupKey);
      const updated = polls.find(p => p.id === pollId);
      eventBus.emit('pollClosed', { groupKey, poll: updated });
    }
  });

  // Получить голосования группы
  eventBus.on('getPolls', ({ groupKey }) => {
    const polls = groupManager.getPolls(groupKey);
    eventBus.emit('pollsLoaded', { groupKey, polls });
  });

  console.log('📊 Poll handlers инициализированы');
}
