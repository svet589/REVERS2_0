// src/ui/screens/Sidebar.js — боковое меню
import { $, createElement } from '../../utils/dom.js';

export class Sidebar {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.container = $('#sidebar');
    this.overlay = $('#overlay');
    this.unsubscribers = [];
  }

  render() {
    this._bindEvents();
  }

  _bindEvents() {
    // Кнопка меню
    $('#menuBtn')?.addEventListener('click', () => this.open());

    // Оверлей
    this.overlay?.addEventListener('click', () => this.close());

    // Пункты меню
    $('#qrMenuBtn')?.addEventListener('click', () => {
      this.close();
      this.eventBus.emit('openModal', 'qrModal');
    });

    $('#scanMenuBtn')?.addEventListener('click', () => {
      this.close();
      this.eventBus.emit('openModal', 'scannerModal');
    });

    $('#savedMenuBtn')?.addEventListener('click', () => {
      this.close();
      this.eventBus.emit('navigate:chat', {
        id: 'me',
        type: 'saved',
        name: '📔 Сохранённые'
      });
    });

    $('#browserMenuBtn')?.addEventListener('click', () => {
      this.close();
      this.eventBus.emit('openBrowser');
    });

    $('#accountMenuBtn')?.addEventListener('click', () => {
      this.close();
      this.eventBus.emit('navigate:profile');
    });

    $('#groupsMenuBtn')?.addEventListener('click', () => {
      this.close();
      this.eventBus.emit('openModal', 'groupsModal');
    });

    $('#channelsMenuBtn')?.addEventListener('click', () => {
      this.close();
      this.eventBus.emit('openModal', 'channelsModal');
    });

    $('#settingsMenuBtn')?.addEventListener('click', () => {
      this.close();
      this.eventBus.emit('openModal', 'settingsModal');
    });

    $('#aboutMenuBtn')?.addEventListener('click', () => {
      this.close();
      this.eventBus.emit('openModal', 'aboutModal');
    });

    // Свайп для открытия
    let touchStartX = 0;
    document.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    });

    document.addEventListener('touchend', (e) => {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (diff > 80 && touchStartX < 30) {
        this.open();
      }
      if (diff < -80 && this.isOpen()) {
        this.close();
      }
    });

    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  open() {
    this.container?.classList.add('open');
    this.overlay?.classList.add('active');
  }

  close() {
    this.container?.classList.remove('open');
    this.overlay?.classList.remove('active');
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  isOpen() {
    return this.container?.classList.contains('open');
  }

  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
      }
