// src/utils/validators.js — валидация данных

export function isValidId(id) {
  return typeof id === 'string' && id.length >= 6 && id.length <= 128;
}

export function isValidMessage(text) {
  return typeof text === 'string' && text.trim().length > 0 && text.length <= 4096;
}

export function isValidGroupName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 50;
}

export function isValidChannelName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 50;
}

export function isValidTopicName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 50;
}

export function isValidPollQuestion(question) {
  return typeof question === 'string' && question.trim().length >= 1 && question.trim().length <= 200;
}

export function isValidPollOptions(options) {
  return Array.isArray(options) && options.length >= 2 && options.length <= 10 &&
    options.every(o => typeof o === 'string' && o.trim().length >= 1);
}

export function isValidFile(file) {
  return file instanceof File && file.size > 0 && file.size <= 1073741824; // 1GB
}

export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch(e) {
    return false;
  }
}

export function isValidBase64(str) {
  if (!str || typeof str !== 'string') return false;
  try {
    return btoa(atob(str)) === str;
  } catch(e) {
    return false;
  }
}

export function isValidHex(str) {
  return typeof str === 'string' && /^[0-9a-fA-F]+$/.test(str);
}

export function isValidPublicKey(key) {
  return typeof key === 'string' && key.length === 44 && /^[A-Za-z0-9+/=]+$/.test(key);
}

export function sanitizeInput(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[<>]/g, '').trim();
                            }
