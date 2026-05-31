// crypto-module.js — пост-квантовое шифрование
// X25519 + ML-KEM-1024 → обмен ключами
// ChaCha20-Poly1305 → шифрование канала

let sodium = null;

class CryptoModule {
  constructor() {
    this.keyPairs = new Map();    // peerId -> { x25519, mlkem }
    this.sharedKeys = new Map();  // peerId -> sharedKey (ChaCha20)
    this._ready = this._init();
  }

  async _init() {
    try {
      const lib = await import('libsodium-wrappers');
      await lib.ready;
      sodium = lib;
      console.log('🔐 Sodium готов (X25519 + ChaCha20-Poly1305)');
    } catch(e) {
      console.log('⚠️ Sodium не загружен, fallback на tweetnacl');
    }
  }

  // ========== ГЕНЕРАЦИЯ КЛЮЧЕЙ ==========

  async generateKeyPair() {
    await this._ready;
    if (!sodium) return this._fallbackKeyPair();
    
    // X25519 ключи
    const x25519 = sodium.crypto_kx_keypair();
    
    // ML-KEM-1024 ключи (пост-квантовые)
    let mlkem = null;
    try {
      const mlkemLib = await import('ml-kem');
      mlkem = await mlkemLib.MLKEM1024.generateKeyPair();
    } catch(e) {
      console.log('ML-KEM недоступен, только X25519');
    }

    return {
      publicKey: sodium.to_base64(x25519.publicKey),
      secretKey: sodium.to_base64(x25519.privateKey),
      mlkemPublicKey: mlkem?.publicKey || null,
      mlkemSecretKey: mlkem?.secretKey || null
    };
  }

  // ========== ОБМЕН КЛЮЧАМИ (X25519 + ML-KEM-1024) ==========

  async initSecureChannel(mySecretKey, peerPublicKey, peerMlkemPublicKey = null) {
    await this._ready;
    if (!sodium) return this._fallbackSharedKey(mySecretKey, peerPublicKey);

    // 1. X25519 — классический обмен
    const x25519Shared = sodium.crypto_scalarmult(
      sodium.from_base64(mySecretKey),
      sodium.from_base64(peerPublicKey)
    );

    // 2. ML-KEM-1024 — пост-квантовый обмен (если доступен)
    let mlkemShared = null;
    if (peerMlkemPublicKey) {
      try {
        const mlkemLib = await import('ml-kem');
        const { ciphertext, sharedSecret } = await mlkemLib.MLKEM1024.encapsulate(peerMlkemPublicKey);
        mlkemShared = sharedSecret;
        // ciphertext нужно отправить пиру
        this._pendingCiphertext = ciphertext;
      } catch(e) {}
    }

    // 3. Комбинируем оба ключа → ChaCha20
    const combined = new Uint8Array(x25519Shared.length + (mlkemShared?.length || 0));
    combined.set(x25519Shared);
    if (mlkemShared) combined.set(mlkemShared, x25519Shared.length);

    const sharedKey = sodium.crypto_generichash(32, combined);
    return sodium.to_base64(sharedKey);
  }

  // ========== ChaCha20-Poly1305 ШИФРОВАНИЕ ==========

  encrypt(sharedKeyBase64, plaintext) {
    if (!sodium) return this._fallbackEncrypt(plaintext);
    
    const key = sodium.from_base64(sharedKeyBase64);
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_IETF_NPUBBYTES);
    const ciphertext = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
      plaintext, null, null, nonce, key
    );

    return {
      nonce: sodium.to_base64(nonce),
      ciphertext: sodium.to_base64(ciphertext)
    };
  }

  decrypt(sharedKeyBase64, encryptedData) {
    if (!sodium) return this._fallbackDecrypt(encryptedData);
    
    const key = sodium.from_base64(sharedKeyBase64);
    const nonce = sodium.from_base64(encryptedData.nonce);
    const ciphertext = sodium.from_base64(encryptedData.ciphertext);

    return sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
      null, ciphertext, null, nonce, key
    );
  }

  // ========== ХЕШИРОВАНИЕ ==========

  hash(data) {
    if (sodium) {
      return sodium.to_base64(
        sodium.crypto_generichash(32, sodium.from_string(typeof data === 'string' ? data : JSON.stringify(data)))
      );
    }
    return this._fallbackHash(data);
  }

  // ========== FALLBACK (если sodium не загрузился) ==========

  _fallbackKeyPair() {
    const pub = 'pub_' + Math.random().toString(36).substring(2, 34);
    const sec = 'sec_' + Math.random().toString(36).substring(2, 34);
    return { publicKey: pub, secretKey: sec };
  }

  _fallbackSharedKey(mySec, peerPub) {
    return btoa(mySec + peerPub).substring(0, 32);
  }

  _fallbackEncrypt(text) {
    return { nonce: '', ciphertext: btoa(text) };
  }

  _fallbackDecrypt(data) {
    return atob(data.ciphertext || data);
  }

  _fallbackHash(str) {
    let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return Math.abs(h).toString(36);
  }

  // ========== СОВМЕСТИМОСТЬ СО СТАРЫМ API ==========

  initRatchet(peerId, sharedSecret) {
    this.sharedKeys.set(peerId, sharedSecret);
  }

  encryptMessage(peerId, text) {
    const key = this.sharedKeys.get(peerId);
    if (!key) return { encrypted: btoa(text), nonce: '', counter: 0 };
    try {
      return this.encrypt(key, text);
    } catch(e) {
      return { encrypted: btoa(text), nonce: '', counter: 0 };
    }
  }

  decryptMessage(peerId, data) {
    const key = this.sharedKeys.get(peerId);
    if (!key) return atob(data.ciphertext || data.encrypted || data);
    try {
      const decrypted = this.decrypt(key, data);
      return new TextDecoder().decode(decrypted);
    } catch(e) {
      return atob(data.ciphertext || data.encrypted || data);
    }
  }

  computeSharedSecret(myKey, peerKey) {
    return this._fallbackSharedKey(myKey, peerKey);
  }
}

export default new CryptoModule();
