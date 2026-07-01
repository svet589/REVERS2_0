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
// crypto-module.js — ФИНАЛЬНАЯ ВЕРСИЯ
// ============================================================
import sodium from 'libsodium-wrappers-sumo';
import { ml_kem768 } from '@noble/post-quantum/ml-kem-768';

let mlkem = null;

class CryptoModule {
  constructor() {
    this._readyPromise = this._init();
  }

  async _init() {
    await sodium.ready;
    if (!sodium) throw new Error('Sodium не загружен');
    try {
      mlkem = ml_kem768;
      console.log('🛡️ ML-KEM-768 загружен');
    } catch(e) {
      console.log('⚠️ ML-KEM-768 недоступен');
    }
  }

  async ready() { return this._readyPromise; }

  // Вспомогательные конвертеры
  base64ToUint8Array(base64) { return sodium.from_base64(base64); }
  uint8ArrayToBase64(arr) { return sodium.to_base64(arr); }

  // ========== КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ #1: computeSharedKey ==========
  async computeSharedKey(mySecretKey, peerPublicKey) {
    if (!sodium) await this.ready();
    const shared = sodium.crypto_scalarmult(
      sodium.from_base64(mySecretKey),
      sodium.from_base64(peerPublicKey)
    );
    return sodium.crypto_generichash(32, shared);
  }

  async generateX25519KeyPair() {
    const kp = sodium.crypto_kx_keypair();
    return {
      publicKey: this.uint8ArrayToBase64(kp.publicKey),
      secretKey: this.uint8ArrayToBase64(kp.privateKey)
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

  async encapsulateHybrid(ourX25519SkBase64, peerX25519PkBase64, peerMlkemPkBase64) {
    const x25519Shared = await this.computeSharedKey(ourX25519SkBase64, peerX25519PkBase64);
    let mlkemShared = null;
    let ciphertext = null;
    if (mlkem && peerMlkemPkBase64) {
      const result = mlkem.encapsulate(Buffer.from(peerMlkemPkBase64, 'base64'));
      mlkemShared = result.sharedSecret;
      ciphertext = Buffer.from(result.ciphertext).toString('base64');
    }
    const combined = new Uint8Array(32 + (mlkemShared ? 32 : 0));
    combined.set(x25519Shared.slice(0, 32));
    if (mlkemShared) combined.set(mlkemShared.slice(0, 32), 32);
    const sharedKey = sodium.crypto_generichash(32, combined);
    return { sharedKey, ciphertext };
  }

  async decapsulateHybrid(ourX25519SkBase64, ourMlkemSkBase64, peerX25519PkBase64, ciphertextBase64) {
    const x25519Shared = await this.computeSharedKey(ourX25519SkBase64, peerX25519PkBase64);
    let mlkemShared = null;
    if (mlkem && ourMlkemSkBase64 && ciphertextBase64) {
      mlkemShared = mlkem.decapsulate(
        Buffer.from(ciphertextBase64, 'base64'),
        Buffer.from(ourMlkemSkBase64, 'base64')
      );
    }
    const combined = new Uint8Array(32 + (mlkemShared ? 32 : 0));
    combined.set(x25519Shared.slice(0, 32));
    if (mlkemShared) combined.set(mlkemShared.slice(0, 32), 32);
    return sodium.crypto_generichash(32, combined);
  }

  encrypt(sharedKeyUint8Array, plaintextString) {
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_IETF_NPUBBYTES);
    const ciphertext = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
      sodium.from_string(plaintextString), null, null, nonce, sharedKeyUint8Array
    );
    return {
      nonce: this.uint8ArrayToBase64(nonce),
      ciphertext: this.uint8ArrayToBase64(ciphertext)
    };
  }

  decrypt(sharedKeyUint8Array, encryptedObject) {
    try {
      const nonce = this.base64ToUint8Array(encryptedObject.nonce);
      const ciphertext = this.base64ToUint8Array(encryptedObject.ciphertext);
      return sodium.to_string(
        sodium.crypto_aead_chacha20poly1305_ietf_decrypt(null, ciphertext, null, nonce, sharedKeyUint8Array)
      );
    } catch(e) { return null; }
  }

  // sign() — синхронный, не требует await
  sign(secretKeyBase64, message) {
    return this.uint8ArrayToBase64(
      sodium.crypto_sign_detached(sodium.from_string(message), this.base64ToUint8Array(secretKeyBase64))
    );
  }

  verify(publicKeyBase64, message, signatureBase64) {
    try {
      return sodium.crypto_sign_verify_detached(
        this.base64ToUint8Array(signatureBase64),
        sodium.from_string(message),
        this.base64ToUint8Array(publicKeyBase64)
      );
    } catch(e) { return false; }
  }

  hash(data) {
    const input = typeof data === 'string' ? sodium.from_string(data) : data;
    return this.uint8ArrayToBase64(sodium.crypto_generichash(32, input));
  }
}

export default new CryptoModule();
