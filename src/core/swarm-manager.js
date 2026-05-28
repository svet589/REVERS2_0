// swarm-manager.js — P2P-сеть, Hyperswarm, chain tunnel

import Hyperswarm from 'hyperswarm';
import b4a from 'b4a';
import cryptoModule from './crypto-module.js';

class SwarmManager {
  constructor() {
    this.swarm = null;
    this.activeRooms = new Map();  // topic -> { connections, key, name }
    this.peerConnections = new Map(); // peerId -> connection
    this.onMessageCallback = null;
    this.onPeerCallback = null;
    this.tunnelChain = []; // Цепочка пиров для tunnel mode
  }

  // ============ ЗАПУСК ============

  async start(identity) {
    this.identity = identity;
    this.swarm = new Hyperswarm();
    
    // Главный topic для REVERS (общий DHT-канал)
    const mainTopic = b4a.from(cryptoModule.hash('revers-mainnet-v1'), 'hex').slice(0, 32);
    
    this.swarm.on('connection', (conn, info) => {
      this.handleConnection(conn, info);
    });

    this.swarm.join(mainTopic, { server: true, client: true });
    console.log('🚀 Swarm запущен. Мой ID:', identity.id);
  }

  // ============ КОМНАТЫ ============

  joinRoom(roomKey) {
    const topic = b4a.from(cryptoModule.hash(roomKey), 'hex').slice(0, 32);
    
    if (this.activeRooms.has(roomKey)) return;
    
    this.activeRooms.set(roomKey, {
      topic,
      connections: new Map(),
      key: roomKey,
      name: roomKey
    });

    this.swarm.join(topic, { server: true, client: true });
    console.log('📁 Зашёл в комнату:', roomKey);
  }

  leaveRoom(roomKey) {
    const room = this.activeRooms.get(roomKey);
    if (!room) return;
    
    this.swarm.leave(room.topic);
    this.activeRooms.delete(roomKey);
    console.log('👋 Покинул комнату:', roomKey);
  }

  // ============ ПОДКЛЮЧЕНИЯ ============

  handleConnection(conn, info) {
    const peerId = info.publicKey?.toString('hex')?.slice(0, 16) || 'unknown';
    console.log('🔗 Новое соединение:', peerId);

    conn.on('data', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.processMessage(peerId, msg, conn);
      } catch (e) {
        console.log('Ошибка парсинга:', e);
      }
    });

    conn.on('close', () => {
      console.log('🔌 Соединение закрыто:', peerId);
      this.peerConnections.delete(peerId);
      if (this.onPeerCallback) {
        this.onPeerCallback({ type: 'disconnected', peerId });
      }
    });

    conn.on('error', (err) => {
      console.log('Ошибка соединения:', err);
    });

    this.peerConnections.set(peerId, conn);
    
    // Отправляем свой профиль
    conn.write(JSON.stringify({
      type: 'hello',
      profile: this.identity.getProfile()
    }));
  }

  // ============ ОТПРАВКА СООБЩЕНИЙ ============

  sendToPeer(peerId, encryptedMessage) {
    const conn = this.peerConnections.get(peerId);
    if (conn && conn.writable) {
      conn.write(JSON.stringify({
        type: 'message',
        data: encryptedMessage
      }));
      return true;
    }
    return false;
  }

  broadcastToRoom(roomKey, encryptedMessage) {
    const room = this.activeRooms.get(roomKey);
    if (!room) return false;
    
    room.connections.forEach((conn, peerId) => {
      if (conn.writable) {
        conn.write(JSON.stringify({
          type: 'message',
          room: roomKey,
          data: encryptedMessage
        }));
      }
    });
    return true;
  }

  // ============ CHAIN TUNNEL ============

  async createTunnel(peerChain) {
    // peerChain = [peerId1, peerId2, peerId3]
    this.tunnelChain = peerChain;
    
    const tunnelMsg = {
      type: 'tunnel_create',
      chain: peerChain,
      nextHop: peerChain[0]
    };
    
    this.sendToPeer(peerChain[0], tunnelMsg);
    return true;
  }

  routeTunnelMessage(msg) {
    const myIndex = this.tunnelChain.indexOf(this.identity.id);
    if (myIndex === -1 || myIndex >= this.tunnelChain.length - 1) {
      // Конец цепочки — доставляем
      if (this.onMessageCallback) {
        this.onMessageCallback(msg);
      }
      return;
    }
    
    // Передаём дальше по цепочке
    const nextPeer = this.tunnelChain[myIndex + 1];
    this.sendToPeer(nextPeer, msg);
  }

  // ============ ОБРАБОТКА СООБЩЕНИЙ ============

  processMessage(peerId, msg, conn) {
    switch (msg.type) {
      case 'hello':
        if (this.onPeerCallback) {
          this.onPeerCallback({ type: 'connected', peerId, profile: msg.profile });
        }
        break;
        
      case 'message':
        if (this.onMessageCallback) {
          this.onMessageCallback({
            from: peerId,
            data: msg.data,
            room: msg.room || null
          });
        }
        break;
        
      case 'tunnel_create':
        this.routeTunnelMessage(msg);
        break;
    }
  }

  // ============ КОЛБЭКИ ============

  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  onPeerEvent(callback) {
    this.onPeerCallback = callback;
  }

  // ============ ОСТАНОВКА ============

  async stop() {
    if (this.swarm) {
      await this.swarm.destroy();
      console.log('Swarm остановлен');
    }
  }
}

const swarmManager = new SwarmManager();
export default swarmManager;
