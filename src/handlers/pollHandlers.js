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
