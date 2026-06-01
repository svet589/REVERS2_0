// src/ui/modals/ScannerModal.js — модалка сканера QR
import { $ } from '../../utils/dom.js';
import { Html5Qrcode } from 'html5-qrcode';

export class ScannerModal {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.scanner = null;
  }

  render() {
    this.eventBus.on('openModal', async (modalId) => {
      if (modalId !== 'scannerModal') return;

      const modal = $('#scannerModal');
      if (!modal) return;
      modal.classList.add('active');

      const container = $('#scannerContainer');
      if (!container) return;
      container.innerHTML = '';

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        stream.getTracks().forEach(t => t.stop());
      } catch(e) {
        container.innerHTML = '<p style="color:#E63946;text-align:center;">❌ Нет доступа к камере</p>';
        return;
      }

      try {
        this.scanner = new Html5Qrcode('scannerContainer');
        await this.scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            this._handleScan(decodedText);
          },
          () => {}
        );
      } catch(e) {
        container.innerHTML = '<p style="color:#E63946;text-align:center;">❌ Ошибка сканера</p>';
      }

      $('#stopScannerBtn')?.addEventListener('click', () => this._stop(), { once: true });
    });
  }

  _handleScan(text) {
    try {
      const data = JSON.parse(text);
      if (data.type === 'revers-connect' && data.id) {
        this._stop();
        this.eventBus.emit('connectToPeer', { peerId: data.id });
        this.eventBus.emit('navigate:chat', {
          id: data.id,
          type: 'contact',
          name: data.name || data.id
        });
        return;
      }
    } catch(e) {}

    if (text.length > 5) {
      this._stop();
      this.eventBus.emit('navigate:chat', { id: text, type: 'contact', name: text });
    }
  }

  _stop() {
    if (this.scanner) {
      this.scanner.stop().then(() => {
        this.scanner = null;
        $('#scannerModal')?.classList.remove('active');
      }).catch(() => {
        $('#scannerModal')?.classList.remove('active');
      });
    } else {
      $('#scannerModal')?.classList.remove('active');
    }
  }
}
