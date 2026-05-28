class CryptoModule {
  constructor() {
    this.ratchetStates = new Map();
    this.key = localStorage.getItem('revers_cryptokey') || this._generateKey();
  }

  _generateKey() {
    const key = Array.from({length: 32}, () => Math.random().toString(36).charAt(2)).join('');
    localStorage.setItem('revers_cryptokey', key);
    return key;
  }

  initRatchet(peerId, sharedSecret) {
    const state = {
      rootKey: this._hash(sharedSecret + 'root'),
      sendChainKey: this._hash(sharedSecret + 'send'),
      recvChainKey: this._hash(sharedSecret + 'recv'),
      sendCount: 0, recvCount: 0
    };
    this.ratchetStates.set(peerId, state);
  }

  encryptMessage(peerId, text) {
    const state = this.ratchetStates.get(peerId);
    const key = state ? this._hash(state.sendChainKey + state.sendCount++) : this.key;
    return { encrypted: this._xor(text, key), nonce: '', counter: 0 };
  }

  decryptMessage(peerId, data) {
    const state = this.ratchetStates.get(peerId);
    const key = state ? this._hash(state.recvChainKey + state.recvCount++) : this.key;
    try { return this._xorDecrypt(data.encrypted, key); } catch(e) { return data.encrypted; }
  }

  encodeStegano(img, text) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const c = document.createElement('canvas');
        c.width = image.width; c.height = image.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
        const bits = [...new TextEncoder().encode(text)].flatMap(b => Array.from({length:8}, (_,i) => (b>>(7-i))&1));
        bits.push(...Array(8).fill(0));
        for (let i = 0; i < Math.min(bits.length, pixels.length/4); i++) pixels[i*4+2] = (pixels[i*4+2] & 0xFE) | bits[i];
        ctx.putImageData(new ImageData(pixels, c.width, c.height), 0, 0);
        resolve(c.toDataURL('image/png'));
      };
      image.src = img;
    });
  }

  decodeStegano(img) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const c = document.createElement('canvas');
        c.width = image.width; c.height = image.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
        const bits = [], bytes = [];
        for (let i = 0; i < pixels.length/4; i++) bits.push(pixels[i*4+2] & 1);
        for (let i = 0; i < bits.length; i += 8) {
          let b = 0;
          for (let j = 0; j < 8; j++) b = (b<<1) | (bits[i+j] || 0);
          if (b === 0) break;
          bytes.push(b);
        }
        resolve(new TextDecoder().decode(new Uint8Array(bytes)));
      };
      image.src = img;
    });
  }

  _xor(t, k) { let r=''; for(let i=0;i<t.length;i++) r+=String.fromCharCode(t.charCodeAt(i)^k.charCodeAt(i%k.length)); return btoa(unescape(encodeURIComponent(r))); }
  _xorDecrypt(e, k) { const t=decodeURIComponent(escape(atob(e))); let r=''; for(let i=0;i<t.length;i++) r+=String.fromCharCode(t.charCodeAt(i)^k.charCodeAt(i%k.length)); return r; }
  _hash(s) { let h=0; for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;} return Math.abs(h).toString(36).repeat(4).substring(0,32); }

  computeSharedSecret(a, b) { return this._hash(a + b); }
  hash(d) { return this._hash(typeof d==='string'?d:JSON.stringify(d)); }
}

export default new CryptoModule();
