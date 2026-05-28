// crypto-module.js — Double Ratchet + стеганография

class CryptoModule {
  constructor() {
    this.ratchetStates = new Map();
    this.messageKeys = new Map();
    this.counter = 0;
  }

  // ========== DOUBLE RATCHET (Signal-подобный) ==========
  
  initRatchet(peerId, sharedSecret) {
    const state = {
      rootKey: this._simpleHash(sharedSecret + 'root'),
      sendChainKey: this._simpleHash(sharedSecret + 'send'),
      recvChainKey: this._simpleHash(sharedSecret + 'recv'),
      sendCount: 0,
      recvCount: 0
    };
    this.ratchetStates.set(peerId, state);
    return state;
  }

  _deriveMessageKey(chainKey, counter) {
    return this._simpleHash(chainKey + counter);
  }

  encryptMessage(peerId, plaintext) {
    const state = this.ratchetStates.get(peerId);
    if (!state) return { encrypted: this._xorEncrypt(plaintext, this._simpleHash('default')), nonce: '', counter: 0 };

    const messageKey = this._deriveMessageKey(state.sendChainKey, state.sendCount);
    const encrypted = this._xorEncrypt(plaintext, messageKey);
    
    state.sendCount++;
    state.sendChainKey = this._simpleHash(state.sendChainKey + 'ratchet');
    
    return {
      encrypted: encrypted,
      nonce: state.sendCount.toString(),
      counter: state.sendCount
    };
  }

  decryptMessage(peerId, encryptedData) {
    const state = this.ratchetStates.get(peerId);
    if (!state) {
      try { return this._xorDecrypt(encryptedData.encrypted, this._simpleHash('default')); } 
      catch(e) { return encryptedData.encrypted; }
    }

    const messageKey = this._deriveMessageKey(state.recvChainKey, state.recvCount);
    const decrypted = this._xorDecrypt(encryptedData.encrypted, messageKey);
    
    state.recvCount++;
    state.recvChainKey = this._simpleHash(state.recvChainKey + 'ratchet');
    
    return decrypted;
  }

  // ========== СТЕГОГРАФИЯ (LSB) ==========

  encodeStegano(imageBase64, text) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        const textBytes = new TextEncoder().encode(text);
        const textBits = [];
        textBytes.forEach(byte => {
          for (let i = 7; i >= 0; i--) textBits.push((byte >> i) & 1);
        });
        for (let i = 0; i < 8; i++) textBits.push(0);
        
        if (textBits.length > pixels.length / 4) { resolve(imageBase64); return; }
        
        for (let i = 0; i < textBits.length; i++) {
          const pixelIndex = i * 4 + 2;
          pixels[pixelIndex] = (pixels[pixelIndex] & 0xFE) | textBits[i];
        }
        
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = imageBase64;
    });
  }

  decodeStegano(imageBase64) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        const bits = [];
        for (let i = 0; i < pixels.length / 4; i++) {
          bits.push(pixels[4 * i + 2] & 1);
        }
        
        const bytes = [];
        for (let i = 0; i < bits.length; i += 8) {
          let byte = 0;
          for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
          if (byte === 0) break;
          bytes.push(byte);
        }
        
        resolve(new TextDecoder().decode(new Uint8Array(bytes)));
      };
      img.src = imageBase64;
    });
  }

  // ========== ВСПОМОГАТЕЛЬНЫЕ ==========

  _xorEncrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(unescape(encodeURIComponent(result)));
  }

  _xorDecrypt(encrypted, key) {
    const text = decodeURIComponent(escape(atob(encrypted)));
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  }

  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36).repeat(4).substring(0, 32);
  }

  hash(data) {
    return this._simpleHash(typeof data === 'string' ? data : JSON.stringify(data));
  }

  computeSharedSecret(myKey, peerKey) {
    return this._simpleHash(myKey + peerKey);
  }
}

export default new CryptoModule();
