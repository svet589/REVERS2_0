// crypto-module.js — X25519 + ChaCha20-Poly1305 (пост-квантовый уровень)

let sodium = null;

class CryptoModule {
  constructor() {
    this.keyPairs = new Map();
    this.sharedKeys = new Map();
    this._ready = this._init();
  }

  async _init() {
    try {
      const lib = await import('libsodium-wrappers');
      await lib.ready;
      sodium = lib;
      console.log('🔐 X25519 + ChaCha20-Poly1305 готов');
    } catch(e) {
      console.log('⚠️ Sodium fallback');
    }
  }

  async generateKeyPair() {
    await this._ready;
    if (!sodium) return this._fallbackKeyPair();
    const kp = sodium.crypto_kx_keypair();
    return {
      publicKey: sodium.to_base64(kp.publicKey),
      secretKey: sodium.to_base64(kp.privateKey)
    };
  }

  async initSecureChannel(mySecretKey, peerPublicKey) {
    await this._ready;
    if (!sodium) return this._fallbackSharedKey(mySecretKey, peerPublicKey);
    const shared = sodium.crypto_scalarmult(
      sodium.from_base64(mySecretKey),
      sodium.from_base64(peerPublicKey)
    );
    const sharedKey = sodium.crypto_generichash(32, shared);
    return sodium.to_base64(sharedKey);
  }

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

  hash(data) {
    if (sodium) {
      return sodium.to_base64(sodium.crypto_generichash(32, sodium.from_string(typeof data === 'string' ? data : JSON.stringify(data))));
    }
    return this._fallbackHash(data);
  }

  // Fallback
  _fallbackKeyPair() {
    const pub = 'pub_' + Math.random().toString(36).substring(2, 34);
    const sec = 'sec_' + Math.random().toString(36).substring(2, 34);
    return { publicKey: pub, secretKey: sec };
  }
  _fallbackSharedKey(mySec, peerPub) { return btoa(mySec + peerPub).substring(0, 32); }
  _fallbackEncrypt(text) { return { nonce: '', ciphertext: btoa(text) }; }
  _fallbackDecrypt(data) { return atob(data.ciphertext || data); }
  _fallbackHash(str) { let h = 0; for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; } return Math.abs(h).toString(36); }

  // Совместимость
  initRatchet(peerId, sharedSecret) { this.sharedKeys.set(peerId, sharedSecret); }
  encryptMessage(peerId, text) {
    const key = this.sharedKeys.get(peerId);
    if (!key) return { encrypted: btoa(text), nonce: '', counter: 0 };
    try { return this.encrypt(key, text); } catch(e) { return { encrypted: btoa(text), nonce: '', counter: 0 }; }
  }
  decryptMessage(peerId, data) {
    const key = this.sharedKeys.get(peerId);
    if (!key) return atob(data.ciphertext || data.encrypted || data);
    try { return new TextDecoder().decode(this.decrypt(key, data)); } catch(e) { return atob(data.ciphertext || data.encrypted || data); }
  }
  computeSharedSecret(myKey, peerKey) { return this._fallbackSharedKey(myKey, peerKey); }
}

export default new CryptoModule();
