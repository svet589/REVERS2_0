class Identity {
  constructor() {
    this.id = localStorage.getItem('revers_id') || this._generateId();
    this.name = localStorage.getItem('revers_name') || 'User';
    this.avatar = localStorage.getItem('revers_avatar') || '';
    this.publicKey = localStorage.getItem('revers_pubkey') || '';
    this.secretKey = localStorage.getItem('revers_seckey') || '';
    if (!this.publicKey) this._generateKeys();
    localStorage.setItem('revers_id', this.id);
  }

  _generateId() {
    const id = 'rev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('revers_id', id);
    return id;
  }

  _generateKeys() {
    this.publicKey = 'pub_' + Math.random().toString(36).substring(2, 34);
    this.secretKey = 'sec_' + Math.random().toString(36).substring(2, 34);
    localStorage.setItem('revers_pubkey', this.publicKey);
    localStorage.setItem('revers_seckey', this.secretKey);
  }

  setName(name) { this.name = name; localStorage.setItem('revers_name', name); }
  setAvatar(b64) { this.avatar = b64; localStorage.setItem('revers_avatar', b64); }

  getProfile() {
    return { id: this.id, name: this.name, avatar: this.avatar, publicKey: this.publicKey };
  }
}

export default new Identity();
