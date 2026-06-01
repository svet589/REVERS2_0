// src/ui/components/Poll.js — компонент голосования
import { escapeHtml } from '../../utils/formatters.js';
import { createElement } from '../../utils/dom.js';

export class Poll {
  constructor(poll, eventBus, groupKey) {
    this.poll = poll;
    this.eventBus = eventBus;
    this.groupKey = groupKey;
  }

  render() {
    const container = createElement('div', { className: 'poll-container' });
    const bubble = createElement('div', { className: 'bubble' });

    // Вопрос
    bubble.appendChild(
      createElement('b', { html: `📊 ${escapeHtml(this.poll.question)}` })
    );
    bubble.appendChild(createElement('br'));

    // Варианты
    this.poll.options.forEach((opt, i) => {
      const total = this.poll.totalVotes || 1;
      const percent = Math.round((opt.count / total) * 100);
      const isVoted = opt.votes?.includes?.(this._myId?.()) || false;

      const btn = createElement('button', {
        className: 'poll-option',
        html: `${escapeHtml(opt.text)} — ${opt.count} (${percent}%)${isVoted ? ' ✓' : ''}`,
        disabled: this.poll.closed,
        onClick: () => {
          if (!this.poll.closed) {
            this.eventBus.emit('votePoll', {
              groupKey: this.groupKey,
              pollId: this.poll.id,
              optionIndex: i
            });
          }
        }
      });

      // Прогресс-бар
      btn.style.background = `linear-gradient(to right, var(--accent, #E63946) ${percent}%, #2A2A3A ${percent}%)`;
      
      bubble.appendChild(btn);
      bubble.appendChild(createElement('br'));
    });

    // Мета-информация
    const meta = createElement('small', {
      html: `${this.poll.anonymous ? '🔒 Анонимно' : '👁️ Открыто'} · ${this.poll.totalVotes || 0} голосов${this.poll.closed ? ' · Завершено' : ''}`
    });
    bubble.appendChild(meta);

    container.appendChild(bubble);
    return container;
  }

  _myId() {
    try {
      return JSON.parse(localStorage.getItem('revers_id') || '""');
    } catch(e) {
      return '';
    }
  }
}
