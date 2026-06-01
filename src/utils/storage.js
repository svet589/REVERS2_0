// src/utils/storage.js — обёртка над localStorage

export function get(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch(e) {
    return defaultValue;
  }
}

export function set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch(e) {
    console.error('Storage full:', e);
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch(e) {}
}

export function getRaw(key, defaultValue = '') {
  return localStorage.getItem(key) || defaultValue;
}

export function setRaw(key, value) {
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch(e) {
    return false;
  }
}

export function getAll(prefix = '') {
  const result = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(prefix)) {
      try {
        result[key] = JSON.parse(localStorage.getItem(key));
      } catch(e) {
        result[key] = localStorage.getItem(key);
      }
    }
  }
  return result;
}

export function removeAll(prefix = '') {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(prefix)) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
  return keys.length;
}

export function getSize() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    total += key.length + (localStorage.getItem(key)?.length || 0);
  }
  return total;
}

export function isAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch(e) {
    return false;
  }
    }
