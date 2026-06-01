// src/ui/modals/QrModal.js — модалка QR-кода
import { $ } from '../../utils/dom.js';
import QRCode from 'qrcode';
import identity from '../../core/identity.js';

export class QrModal {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  render() {
    this.eventBus.on('openModal', async (modalId) => {
      if (modalId !== 'qrModal') return;

      const modal = $('#qrModal');
      if (!modal) return;
      modal.classList.add('active');

      const canvas = $('#qrCanvas');
      if (canvas) {
        const data = JSON.stringify({
          id: identity.id,
          name: identity.name,
          type: 'revers-connect',
          version: 1
        });

        try {
          await QRCode.toCanvas(canvas, data, {
            width: 200,
            margin: 2,
            color: { dark: '#0F0F12', light: '#FFFFFF' }
          });
        } catch(e) {
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 200, 200);
          ctx.fillStyle = '#E63946';
          ctx.font = '14px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('REVERS', 100, 90);
        }
      }

      // Ссылка
      const linkEl = $('#inviteLink');
      if (linkEl) {
        linkEl.textContent = `revers://chat?id=${identity.id}&name=${encodeURIComponent(identity.name)}`;
      }

      // Копировать ссылку
      $('#copyInviteLinkBtn')?.addEventListener('click', () => {
        const link = $('#inviteLink')?.textContent;
        if (link) {
          navigator.clipboard.writeText(link);
          alert('Ссылка скопирована!');
        }
      }, { once: true });

      // Поделиться
      $('#shareInviteBtn')?.addEventListener('click', () => {
        const link = $('#inviteLink')?.textContent;
        if (link && navigator.share) {
          navigator.share({ title: 'REVERS', text: 'Присоединяйся!', url: link }).catch(() => {});
        }
      }, { once: true });
    });
  }
}
