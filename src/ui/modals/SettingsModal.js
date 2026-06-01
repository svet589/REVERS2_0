// src/ui/modals/SettingsModal.js — модалка настроек
import { $ } from '../../utils/dom.js';
import { THEMES } from '../../utils/constants.js';

export class SettingsModal {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  render() {
    this.eventBus.on('openModal', (modalId) => {
      if (modalId !== 'settingsModal') return;
      
      const modal = $('#settingsModal');
      if (!modal) return;
      modal.classList.add('active');

      // Тема
      $('#themeSelect')?.addEventListener('change', (e) => {
        const themeId = e.target.value;
        const theme = THEMES[themeId];
        if (theme) {
          document.body.style.backgroundColor = theme.bg;
          document.documentElement.style.setProperty('--accent', theme.accent);
          localStorage.setItem('revers_theme', themeId);
        }
      });

      // Звук
      $('#soundToggle')?.addEventListener('click', function() {
        this.classList.toggle('active');
      });

      // Звонки
      $('#callsToggle')?.addEventListener('click', function() {
        this.classList.toggle('active');
        this.eventBus?.emit('setAllowCalls', { allow: this.classList.contains('active') });
      }.bind(this));

      // Офлайн
      $('#offlineToggle')?.addEventListener('click', function() {
        this.classList.toggle('active');
      });
    });
  }
}
