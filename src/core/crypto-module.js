// crypto-module.js — Double Ratchet + стеганография + шифрование

import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

class CryptoModule {
  constructor() {
    this.ratchetStates = new Map(); // peerId -> ratchet state
  }

  // ============ DOUBLE RATCHET (Signal-подобный) ============
  
  initRatchet(peerId, sharedSecret) {
    const rootKey = nacl.hash(sharedSecret).slice(0, 32);
    const state = {
      rootKey,
      sendingKey: null,
      receivingKey: null,
      sendingChain: null,
      receivingChain: null,
      sendCount: 0,
      recvCount: 0,
      prevSendCount: 0
    };
    
    // Первый ratchet шаг
    const [rootKey1, chainKey] = this.kdfChain(state.rootKey, null);
    state.rootKey = rootKey1;
    state.sendingChain = chainKey;
    
    this.ratchetStates.set(peerId, state);
    return state;
  }

  kdfChain(key, salt) {
    const input = salt ? new Uint8Array([...key, ...salt]) : key;
    const hashed = nacl.hash(input).slice(0, 64);
    return [hashed.slice(0, 32), hashed.slice(32, 64)];
  }

  encryptMessage(peerId, plaintext) {
    const state = this.ratchetStates.get(peerId);
    if (!state) throw new Error('Ratchet not initialized');
    
    // Message Key = HMAC(sendingChain, counter)
    const counter = new Uint8Array(4);
    new DataView(counter.buffer).setUint32(0, state.sendCount);
    const messageKey = nacl.hash(new Uint8Array([...state.sendingChain, ...counter])).slice(0, 32);
    
    // Шифруем
    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.secretbox(
      naclUtil.decodeUTF8(plaintext),
      nonce,
      messageKey
    );
    
    state.sendCount++;
    
    return {
      encrypted: naclUtil.encodeBase64(encrypted),
      nonce: naclUtil.encodeBase64(nonce),
      counter: state.prevSendCount
    };
  }

  decryptMessage(peerId, encryptedData) {
    const state = this.ratchetStates.get(peerId);
    if (!state) throw new Error('Ratchet not initialized');
    
    const messageKey = nacl.hash(
      new Uint8Array([...state.receivingChain || state.sendingChain])
    ).slice(0, 32);
    
    const decrypted = nacl.secretbox.open(
      naclUtil.decodeBase64(encryptedData.encrypted),
      naclUtil.decodeBase64(encryptedData.nonce),
      messageKey
    );
    
    if (!decrypted) throw new Error('Decryption failed');
    
    state.recvCount++;
    
    // Ratchet step
    const [newRoot, newChain] = this.kdfChain(state.rootKey, messageKey);
    state.rootKey = newRoot;
    state.receivingChain = newChain;
    
    return naclUtil.encodeUTF8(decrypted);
  }

  // ============ СТЕГОГРАФИЯ (прячем текст в картинки) ============

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
        
        // Конвертируем текст в биты
        const textBytes = new TextEncoder().encode(text);
        const textBits = [];
        textBytes.forEach(byte => {
          for (let i = 7; i >= 0; i--) {
            textBits.push((byte >> i) & 1);
          }
        });
        
        // Добавляем терминатор (8 нулей)
        for (let i = 0; i < 8; i++) textBits.push(0);
        
        // Проверяем что текст помещается
        if (textBits.length > pixels.length / 4) {
          resolve(imageBase64); // Не влезло — возвращаем оригинал
          return;
        }
        
        // LSB: меняем младший бит синего канала
        for (let i = 0; i < textBits.length; i++) {
          const pixelIndex = i * 4 + 2; // Синий канал
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
          const pixelIndex = i * 4 + 2; // Синий канал
          bits.push(pixels[pixelIndex] & 1);
        }
        
        // Группируем в байты
        const bytes = [];
        for (let i = 0; i < bits.length; i += 8) {
          let byte = 0;
          for (let j = 0; j < 8; j++) {
            byte = (byte << 1) | (bits[i + j] || 0);
          }
          if (byte === 0) break; // Терминатор
          bytes.push(byte);
        }
        
        const text = new TextDecoder().decode(new Uint8Array(bytes));
        resolve(text);
      };
      img.src = imageBase64;
    });
  }

  // ============ ХЕШИРОВАНИЕ ============

  hash(data) {
    if (typeof data === 'string') {
      data = naclUtil.decodeUTF8(data);
    }
    return naclUtil.encodeBase64(nacl.hash(data));
  }

  // ============ ГЕНЕРАЦИЯ КЛЮЧЕЙ ============

  generateKeyPair() {
    const keyPair = nacl.box.keyPair();
    return {
      publicKey: naclUtil.encodeBase64(keyPair.publicKey),
      secretKey: naclUtil.encodeBase64(keyPair.secretKey)
    };
  }

  // ============ SHARED SECRET (для инициализации ratchet) ============

  computeSharedSecret(mySecretKey, peerPublicKey) {
    const shared = nacl.box.before(
      naclUtil.decodeBase64(peerPublicKey),
      naclUtil.decodeBase64(mySecretKey)
    );
    return shared;
  }
}

const cryptoModule = new CryptoModule();
export default cryptoModule;
