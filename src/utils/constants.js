// src/utils/constants.js — константы приложения

export const FOLDERS = {
  personal: { name: '💬 Личное', types: ['contact', 'saved'] },
  groups: { name: '👥 Группы', types: ['group'] },
  channels: { name: '📢 Каналы', types: ['channel'] }
};

export const THEMES = {
  default: { bg: '#0F0F12', accent: '#E63946', name: 'Тёмная' },
  night: { bg: '#000000', accent: '#4CAF50', name: 'Ночная' },
  light: { bg: '#FFFFFF', accent: '#2196F3', name: 'Светлая' }
};

export const CONNECTION_ICONS = {
  direct: '🔓',
  relay2: '🕸️2',
  relay3: '🕸️3',
  dht: '🌐',
  offline: '💾'
};

export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  ERROR: 'error',
  OFFLINE: 'offline'
};

export const ROLES = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member'
};

export const ROLE_ICONS = {
  admin: '👑',
  moderator: '🛡️',
  member: '👤'
};

export const GIFT_CATALOG = [
  { emoji: '🧸', name: 'Медвежонок', price: 10, category: 'Дружеские' },
  { emoji: '🍻', name: 'Бокалы', price: 15, category: 'Дружеские' },
  { emoji: '🚬', name: 'Сигарета', price: 5, category: 'Протестные' },
  { emoji: '💐', name: 'Букет', price: 20, category: 'Романтические' },
  { emoji: '🌹', name: 'Роза', price: 25, category: 'Романтические' },
  { emoji: '🎖️', name: 'Медаль', price: 30, category: 'Достижения' },
  { emoji: '🏆', name: 'Кубок', price: 50, category: 'Достижения' },
  { emoji: '🎭', name: 'Маски', price: 20, category: 'Творческие' },
  { emoji: '⌚', name: 'Часы', price: 40, category: 'Статусные' }
];

export const SPAM_LIMITS = {
  MAX_MESSAGES: 5,
  WINDOW_MS: 3000,
  MAX_CALLS_PER_MINUTE: 5
};

export const BITRATE_LEVELS = {
  HIGH: { video: 720000, audio: 64000 },
  MEDIUM: { video: 360000, audio: 48000 },
  LOW: { video: 150000, audio: 32000 },
  MINIMAL: { video: 80000, audio: 24000 }
};

export const UI = {
  MAX_MESSAGE_LENGTH: 4096,
  MAX_FILE_SIZE: 1073741824, // 1GB
  DRAFT_PREFIX: 'draft_',
  PIN_PREFIX: 'revers_pinned_',
  WELCOME_KEY: 'revers_welcome',
  OFFLINE_MSG_TTL: 86400000 // 24 часа
};
