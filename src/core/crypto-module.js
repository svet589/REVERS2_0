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
// crypto-module.js — пост-квантовое E2E шифрование
// X25519 + ML-KEM-768 → гибридный обмен ключами
// ChaCha20-Poly1305 → шифрование сообщений

let sodium = null;
let mlkem = null;

class CryptoModule {
  constructor() {
    this.sharedKeys = new Map();
    this._ready = this._init();
  }

  async _init() {
    const lib = await import('libsodium-wrappers');
    await lib.ready;
    sodium = lib;

    // Пробуем загрузить пост-квантовый модуль
    try {
      const pq = await import('@noble/post-quantum/ml-kem-768');
      mlkem = pq.ml_kem768;
      console.log('🛡️ ML-KEM-768 загружен — пост-квантовая защита активна');
    } catch(e) {
      console.log('⚠️ ML-KEM-768 недоступен, только X25519');
    }
  }

  async ready() {
    await this._ready;
    return !!sodium;
  }

  // ========== ГЕНЕРАЦИЯ КЛЮЧЕЙ ==========

  async generateX25519KeyPair() {
    const kp = sodium.crypto_kx_keypair();
    return {
      publicKey: sodium.to_base64(kp.publicKey),
      secretKey: sodium.to_base64(kp.privateKey)
    };
  }

  async generateMLKEMKeyPair() {
    if (!mlkem) return null;
    const { publicKey, secretKey } = mlkem.keygen();
    return {
      publicKey: Buffer.from(publicKey).toString('base64'),
      secretKey: Buffer.from(secretKey).toString('base64')
    };
  }

  // ========== ГИБРИДНЫЙ ОБМЕН КЛЮЧАМИ ==========

  async encapsulateHybrid(peerX25519Pk, peerMlkemPk) {
    // 1. X25519
    const x25519Shared = sodium.crypto_scalarmult(
      sodium.from_base64(this.myX25519Sk || ''),
      sodium.from_base64(peerX25519Pk)
    );

    // 2. ML-KEM-768
    let mlkemShared = null;
    let ciphertext = null;
    if (mlkem && peerMlkemPk) {
      const result = mlkem.encapsulate(Buffer.from(peerMlkemPk, 'base64'));
      mlkemShared = result.sharedSecret;
      ciphertext = Buffer.from(result.ciphertext).toString('base64');
    }

    // 3. Комбинируем
    const combined = new Uint8Array(32 + (mlkemShared?.length || 0));
    combined.set(x25519Shared.slice(0, 32));
    if (mlkemShared) combined.set(mlkemShared.slice(0, 32), 32);

    // 4. Финальный ключ через HKDF
    const sharedKey = sodium.crypto_generichash(32, combined);

    return { sharedKey, ciphertext };
  }

  async decapsulateHybrid(myX25519Sk, myMlkemSk, peerX25519Pk, ciphertext) {
    // 1. X25519
    const x25519Shared = sodium.crypto_scalarmult(
      sodium.from_base64(myX25519Sk),
      sodium.from_base64(peerX25519Pk)
    );

    // 2. ML-KEM-768
    let mlkemShared = null;
    if (mlkem && myMlkemSk && ciphertext) {
      mlkemShared = mlkem.decapsulate(
        Buffer.from(ciphertext, 'base64'),
        Buffer.from(myMlkemSk, 'base64')
      );
    }

    // 3. Комбинируем
    const combined = new Uint8Array(32 + (mlkemShared?.length || 0));
    combined.set(x25519Shared.slice(0, 32));
    if (mlkemShared) combined.set(mlkemShared.slice(0, 32), 32);

    // 4. Финальный ключ
    return sodium.crypto_generichash(32, combined);
  }

  // ========== ШИФРОВАНИЕ СООБЩЕНИЙ ==========

  encrypt(sharedKey, plaintext) {
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_IETF_NPUBBYTES);
    const ciphertext = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
      sodium.from_string(plaintext),
      null,
      null,
      nonce,
      sharedKey
    );
    return {
      nonce: sodium.to_base64(nonce),
      ciphertext: sodium.to_base64(ciphertext)
    };
  }

  decrypt(sharedKey, encryptedData) {
    try {
      const nonce = sodium.from_base64(encryptedData.nonce);
      const ciphertext = sodium.from_base64(encryptedData.ciphertext);
      const decrypted = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
        null, ciphertext, null, nonce, sharedKey
      );
      return sodium.to_string(decrypted);
    } catch(e) {
      return null;
    }
  }

  // ========== ПОДПИСИ ==========

  sign(secretKey, message) {
    const sig = sodium.crypto_sign_detached(
      sodium.from_string(message),
      sodium.from_base64(secretKey)
    );
    return sodium.to_base64(sig);
  }

  verify(publicKey, message, signature) {
    try {
      return sodium.crypto_sign_verify_detached(
        sodium.from_base64(signature),
        sodium.from_string(message),
        sodium.from_base64(publicKey)
      );
    } catch(e) {
      return false;
    }
  }

  hash(data) {
    return sodium.to_base64(sodium.crypto_generichash(32, sodium.from_string(data)));
  }
}

export default new CryptoModule();
