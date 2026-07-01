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
// ============================================================
// identity.js — ФИНАЛЬНАЯ ВЕРСИЯ
// ============================================================
import cryptoModule from './crypto-module.js';

let sodium = null;
let mlkem = null;

class Identity {
  constructor() {
    this.id = '';
    this.name = localStorage.getItem('revers_name') || 'User';
    this.avatar = localStorage.getItem('revers_avatar') || '';
    this.x25519PublicKey = null;
    this.x25519SecretKey = null;
    this.mlkemPublicKey = null;
    this.mlkemSecretKey = null;
    this._storageKey = null;
    this._readyPromise = this._init();
  }

  async _init() {
    const lib = await import('libsodium-wrappers-sumo');
    await lib.ready;
    sodium = lib;
    try {
      const pq = await import('@noble/post-quantum/ml-kem-768');
      mlkem = pq.ml_kem768;
    } catch(e) {}
    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #2: дожидаемся загрузки ключей
    await this._loadOrGenerateKeys();
  }

  async ready() { return this._readyPromise; }

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

  async _generateAllKeys() {
    const x25519 = sodium.crypto_kx_keypair();
    this.x25519PublicKey = x25519.publicKey;
    this.x25519SecretKey = x25519.privateKey;
    if (mlkem) {
      const pq = mlkem.keygen();
      this.mlkemPublicKey = pq.publicKey;
      this.mlkemSecretKey = pq.secretKey;
    }
  }

  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #9: убрана зависимость от navigator.userAgent
  _deriveStorageKey() {
    const salt = 'REVERS_IDENTITY_SALT_v2';
    const material = salt + this.getX25519PublicKey();
    return sodium.crypto_generichash(32, sodium.from_string(material));
  }

  async _encryptAndSave() {
    const storageKey = this._deriveStorageKey();
    this._storageKey = storageKey;
    const identityData = {
      id: this.id,
      name: this.name,
      x25519pk: cryptoModule.uint8ArrayToBase64(this.x25519PublicKey),
      x25519sk: cryptoModule.uint8ArrayToBase64(this.x25519SecretKey),
      mlkempk: this.mlkemPublicKey ? Buffer.from(this.mlkemPublicKey).toString('base64') : null,
      mlkemsk: this.mlkemSecretKey ? Buffer.from(this.mlkemSecretKey).toString('base64') : null,
    };
    const plaintext = JSON.stringify(identityData);
    const encrypted = cryptoModule.encrypt(storageKey, plaintext);
    localStorage.setItem('revers_identity', JSON.stringify(encrypted));
  }

  async _decryptAndLoad(stored) {
    const storageKey = this._deriveStorageKey();
    this._storageKey = storageKey;
    try {
      const encrypted = JSON.parse(stored);
      const plaintext = cryptoModule.decrypt(storageKey, encrypted);
      if (!plaintext) throw new Error('Decrypt failed');
      const data = JSON.parse(plaintext);
      this.id = data.id || '';
      this.name = data.name || 'User';
      this.x25519PublicKey = cryptoModule.base64ToUint8Array(data.x25519pk);
      this.x25519SecretKey = cryptoModule.base64ToUint8Array(data.x25519sk);
      if (data.mlkempk) this.mlkemPublicKey = Buffer.from(data.mlkempk, 'base64');
      if (data.mlkemsk) this.mlkemSecretKey = Buffer.from(data.mlkemsk, 'base64');
    } catch(e) {
      await this._generateAllKeys();
      await this._encryptAndSave();
    }
  }

  getMyId() { return this.id || localStorage.getItem('revers_id') || ''; }
  getX25519PublicKey() { return this.x25519PublicKey ? cryptoModule.uint8ArrayToBase64(this.x25519PublicKey) : ''; }
  getX25519SecretKey() { return this.x25519SecretKey ? cryptoModule.uint8ArrayToBase64(this.x25519SecretKey) : ''; }
  getMlkemPublicKey() { return this.mlkemPublicKey ? Buffer.from(this.mlkemPublicKey).toString('base64') : null; }
  getMlkemSecretKey() { return this.mlkemSecretKey ? Buffer.from(this.mlkemSecretKey).toString('base64') : null; }
  hasPostQuantum() { return !!(mlkem && this.mlkemPublicKey && this.mlkemSecretKey); }

  setName(name) { this.name = name; localStorage.setItem('revers_name', name); }
  setAvatar(b64) { this.avatar = b64; localStorage.setItem('revers_avatar', b64); }

  getProfile() {
    return {
      id: this.getMyId(),
      name: this.name,
      avatar: this.avatar,
      x25519PublicKey: this.getX25519PublicKey(),
      mlkemPublicKey: this.getMlkemPublicKey(),
      hasPostQuantum: this.hasPostQuantum()
    };
  }
}

const identity = new Identity();
export default identity;
