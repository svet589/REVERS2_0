// src/ui/modals/GiftShopModal.js — модалка магазина подарков (устарела, заменена GiftShop компонентом)
// Оставлена для обратной совместимости

export class GiftShopModal {
  constructor(eventBus) {
    this.eventBus = eventBus;
  }

  render() {
    this.eventBus.on('openModal', (modalId) => {
      if (modalId === 'giftShopModal') {
        this.eventBus.emit('navigate:giftShop');
      }
    });
  }
}
