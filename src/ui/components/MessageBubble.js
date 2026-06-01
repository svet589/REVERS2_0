// src/ui/components/MessageBubble.js — компонент сообщения
import { formatTime, formatFileSize, escapeHtml, linkifyText } from '../../utils/formatters.js';
import { createElement } from '../../utils/dom.js';

export class MessageBubble {
  constructor(msg, isOutgoing, replyTo = null) {
    this.msg = msg;
    this.isOutgoing = isOutgoing;
    this.replyTo = replyTo;
  }

  render() {
    const bubble = createElement('div', { className: 'bubble' });

    // Ответ
    if (this.replyTo) {
      bubble.appendChild(
        createElement('div', {
          className: 'reply-context',
          html: `↩️ ${escapeHtml((this.replyTo.text || '').substring(0, 50))}`
        })
      );
    }

    // Текст сообщения
    const textEl = createElement('div', {
      className: 'message-text',
      html: linkifyText(escapeHtml(this.msg.text || ''))
    });
    bubble.appendChild(textEl);

    // Метка редактирования
    if (this.msg.edited) {
      bubble.appendChild(
        createElement('span', {
          style: 'font-size:0.6rem;color:#8E8E9A;',
          html: ' (изм.)'
        })
      );
    }

    // Медиа
    this._renderMedia(bubble);

    // Реакции
    if (this.msg.reactions) {
      bubble.appendChild(
        createElement('div', {
          className: 'reactions',
          html: this.msg.reactions
        })
      );
    }

    // Время
    bubble.appendChild(
      createElement('div', {
        className: 'message-time',
        html: formatTime(this.msg.time)
      })
    );

    // Статус
    if (this.isOutgoing) {
      bubble.appendChild(this._renderStatus());
    }

    return bubble;
  }

  _renderMedia(bubble) {
    const { type, fileData, fileName, fileSize, fileType } = this.msg;

    if (type === 'voice' && fileData) {
      bubble.appendChild(
        createElement('audio', {
          controls: true,
          src: fileData,
          style: 'max-width:200px;height:30px;margin-top:4px;'
        })
      );
      return;
    }

    if (type === 'file' && fileName) {
      const isImage = fileType?.startsWith('image/');
      const isVideo = fileType?.startsWith('video/');
      const isAudio = fileType?.startsWith('audio/');

      bubble.appendChild(
        createElement('div', {
          className: 'file-attachment',
          html: `📄 ${escapeHtml(fileName)} (${formatFileSize(fileSize)})`,
          onClick: () => this._openMedia(fileData, fileType)
        })
      );

      if (isImage && fileData) {
        bubble.appendChild(
          createElement('img', {
            src: fileData,
            className: 'file-preview-img',
            onClick: (e) => { e.stopPropagation(); this._openMedia(fileData, 'image'); }
          })
        );
      }

      if (isVideo && fileData) {
        bubble.appendChild(
          createElement('div', {
            className: 'file-attachment',
            html: '🎬 Воспроизвести',
            onClick: () => this._openMedia(fileData, 'video')
          })
        );
      }

      if (isAudio && fileData) {
        bubble.appendChild(
          createElement('audio', {
            controls: true,
            src: fileData,
            style: 'max-width:200px;height:30px;margin-top:4px;'
          })
        );
      }
    }
  }

  _renderStatus() {
    const statusMap = {
      error: '❌',
      offline: '⏳',
      delivered: '<span style="color:#2196F3;">✓✓</span>',
      sent: '<span style="color:#8E8E9A;">✓</span>',
      read: '<span style="color:#2196F3;">✓✓</span>'
    };

    const status = this.msg.status || (this.msg.sent ? 'sent' : 'sending');
    const html = statusMap[status] || '';

    return createElement('span', {
      className: 'message-status',
      html
    });
  }

  _openMedia(data, type) {
    if (!data) return;
    if (type?.startsWith('image/') || type === 'image') {
      const viewer = document.getElementById('fullscreenImage');
      const container = document.getElementById('imageViewer');
      if (viewer && container) {
        viewer.src = data;
        container.classList.add('active');
      }
    } else if (type?.startsWith('video/') || type === 'video') {
      const videoEl = document.getElementById('videoPlayerEl');
      const player = document.getElementById('videoPlayer');
      if (videoEl && player) {
        videoEl.src = data;
        player.classList.remove('hidden');
        videoEl.play();
      }
    } else if (type?.startsWith('audio/')) {
      new Audio(data).play();
    }
  }
}
