/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This file is part of REVERS Messenger.
 *
 * REVERS Messenger is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * REVERS Messenger is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with REVERS Messenger. If not, see <https://www.gnu.org/licenses/>.
 *
 * Copyright (C) 2025 svet589 <https://github.com/svet589>
 */
// identity.js — криптостойкие ключи + пост-квант + шифрование на диске

let sodium = null;
let mlkem = null;

class Identity {
  constructor() {
    this.id = '';
    this.name = localStorage.getItem('revers_name') || 'User';
    this.avatar = localStorage.getItem('revers_avatar') || '';
    
    // X25519 ключи
    this.x25519PublicKey = null;
    this.x25519SecretKey = null;
    
    // ML-KEM-768 пост-квантовые ключи
    this.mlkemPublicKey = null;
    this.mlkemSecretKey = null;
    
    // Пароль для шифрования ключей на диске
    this._storageKey = null;
    
    this._ready = this._init();
  }

  async _init() {
    try {
      const lib = await import('libsodium-wrappers');
      await lib.ready;
      sodium = lib;
    } catch(e) {
      console.error('❌ Sodium не загружен');
      return;
    }

    try {
      const pq = await import('@noble/post-quantum/ml-kem-768');
      mlkem = pq.ml_kem768;
      console.log('🛡️ ML-KEM-768 доступен');
    } catch(e) {
      console.log('⚠️ ML-KEM-768 недоступен');
    }

    await this._loadOrGenerateKeys();
  }

  async _loadOrGenerateKeys() {
    const stored = localStorage.getItem('revers_identity');
    
    if (stored) {
      await this._decryptAndLoad(stored);
    } else {
      await this._generateAllKeys();
      await this._encryptAndSave();
    }

    if (!this.id) {
      this.id = 'rev_' + sodium.to_hex(this.x25519PublicKey).substring(0, 16);
      localStorage.setItem('revers_id', this.id);
    }
  }

  // ========== ГЕНЕРАЦИЯ КЛЮЧЕЙ ==========

  async _generateAllKeys() {
    // X25519
    const x25519 = sodium.crypto_kx_keypair();
    this.x25519PublicKey = x25519.publicKey;
    this.x25519SecretKey = x25519.privateKey;

    // ML-KEM-768 (пост-квантовый)
    if (mlkem) {
      const pq = mlkem.keygen();
      this.mlkemPublicKey = pq.publicKey;
      this.mlkemSecretKey = pq.secretKey;
    }
  }

  // ========== ШИФРОВАНИЕ НА ДИСКЕ ==========

  _deriveStorageKey() {
    // Используем статическую соль + ID устройства
    // В production — запрашивать пароль при первом запуске
    const salt = 'REVERS_IDENTITY_SALT_v2';
    const deviceInfo = navigator.userAgent + navigator.language;
    const seed = sodium.from_string(salt + deviceInfo);
    return sodium.crypto_generichash(32, seed);
  }

  async _encryptAndSave() {
    const storageKey = this._deriveStorageKey();
    this._storageKey = storageKey;

    const identityData = {
      id: this.id,
      name: this.name,
      x25519pk: sodium.to_base64(this.x25519PublicKey),
      x25519sk: sodium.to_base64(this.x25519SecretKey),
      mlkempk: this.mlkemPublicKey ? Buffer.from(this.mlkemPublicKey).toString('base64') : null,
      mlkemsk: this.mlkemSecretKey ? Buffer.from(this.mlkemSecretKey).toString('base64') : null,
    };

    const plaintext = JSON.stringify(identityData);
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = sodium.crypto_secretbox_easy(
      sodium.from_string(plaintext),
      nonce,
      storageKey
    );

    const encrypted = {
      nonce: sodium.to_base64(nonce),
      ciphertext: sodium.to_base64(ciphertext)
    };

    localStorage.setItem('revers_identity', JSON.stringify(encrypted));
  }

  async _decryptAndLoad(stored) {
    const storageKey = this._deriveStorageKey();
    this._storageKey = storageKey;

    try {
      const encrypted = JSON.parse(stored);
      const nonce = sodium.from_base64(encrypted.nonce);
      const ciphertext = sodium.from_base64(encrypted.ciphertext);

      const plaintext = sodium.crypto_secretbox_open_easy(
        ciphertext,
        nonce,
        storageKey
      );

      const data = JSON.parse(sodium.to_string(plaintext));

      this.id = data.id || '';
      this.name = data.name || 'User';
      this.x25519PublicKey = sodium.from_base64(data.x25519pk);
      this.x25519SecretKey = sodium.from_base64(data.x25519sk);

      if (data.mlkempk) {
        this.mlkemPublicKey = Buffer.from(data.mlkempk, 'base64');
      }
      if (data.mlkemsk) {
        this.mlkemSecretKey = Buffer.from(data.mlkemsk, 'base64');
      }
    } catch(e) {
      console.error('❌ Ошибка расшифровки identity. Генерируем новые ключи.');
      await this._generateAllKeys();
      await this._encryptAndSave();
    }
  }

  // ========== ПУБЛИЧНЫЕ МЕТОДЫ ==========

  async ready() {
    await this._ready;
    return !!sodium;
  }

  getX25519PublicKey() {
    return this.x25519PublicKey ? sodium.to_base64(this.x25519PublicKey) : '';
  }

  getX25519SecretKey() {
    return this.x25519SecretKey ? sodium.to_base64(this.x25519SecretKey) : '';
  }

  getMlkemPublicKey() {
    return this.mlkemPublicKey ? Buffer.from(this.mlkemPublicKey).toString('base64') : null;
  }

  getMlkemSecretKey() {
    return this.mlkemSecretKey ? Buffer.from(this.mlkemSecretKey).toString('base64') : null;
  }

  hasPostQuantum() {
    return !!(mlkem && this.mlkemPublicKey && this.mlkemSecretKey);
  }

  setName(name) {
    this.name = name;
    localStorage.setItem('revers_name', name);
  }

  setAvatar(b64) {
    this.avatar = b64;
    localStorage.setItem('revers_avatar', b64);
  }

  getProfile() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      x25519PublicKey: this.getX25519PublicKey(),
      mlkemPublicKey: this.getMlkemPublicKey(),
      hasPostQuantum: this.hasPostQuantum()
    };
  }

  // Экспорт ключей в зашифрованном виде (для переноса на другое устройство)
  async exportEncrypted() {
    await this._ready;
    return localStorage.getItem('revers_identity');
  }

  // Импорт ключей
  async importEncrypted(encryptedData) {
    localStorage.setItem('revers_identity', encryptedData);
    await this._decryptAndLoad(encryptedData);
    this.id = 'rev_' + sodium.to_hex(this.x25519PublicKey).substring(0, 16);
    localStorage.setItem('revers_id', this.id);
  }
}

const identity = new Identity();
export default identity;
