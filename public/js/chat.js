// CHAT MODULE (Real-time Socket.io + Taklifnomalar)
const chatModule = {
  activeChatUser: null,
  contacts: [],
  invitations: [],

  init() {
    const searchInput = document.getElementById('chat-search-input');
    const sendForm = document.getElementById('chat-send-form');
    const backBtn = document.getElementById('btn-back-to-contacts');

    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchUsers(e.target.value);
        }, 300);
      });
    }

    if (sendForm) {
      sendForm.addEventListener('submit', (e) => this.handleSendMessage(e));
    }

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.closeConversation();
      });
    }
  },

  async loadChatSection() {
    await this.loadInvitations();
    await this.loadContacts();
  },

  async searchUsers(query) {
    const resultsContainer = document.getElementById('chat-search-results');
    if (!query || !query.trim()) {
      resultsContainer.classList.add('hidden');
      resultsContainer.innerHTML = '';
      return;
    }

    try {
      const res = await fetch(`/api/users/search?query=${encodeURIComponent(query.trim())}`, {
        headers: { 'x-auth-token': authModule.token }
      });
      if (res.ok) {
        const data = await res.json();
        resultsContainer.classList.remove('hidden');

        if (data.users.length === 0) {
          resultsContainer.innerHTML = `
            <div style="background: white; padding: 12px; border-radius: 10px; border: 1px solid var(--border-color); font-size: 0.9rem; color: var(--text-muted);">
              Bunday username topilmadi.
            </div>
          `;
          return;
        }

        resultsContainer.innerHTML = data.users.map(u => {
          const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
          const avatar = u.avatarUrl || '/images/default-avatar.svg';
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; background: white; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${avatar}" class="avatar" style="width: 38px; height: 38px;" onerror="this.src='/uploads/avatars/default.png'">
                <div>
                  <div style="font-weight: 700; font-size: 0.9rem;">${this.escapeHtml(name)}</div>
                  <div style="font-size: 0.78rem; color: var(--text-muted);">@${this.escapeHtml(u.username)}</div>
                </div>
              </div>
              <!-- Aynan foydalanuvchi talabidagi tugma nomi -->
              <button class="btn-primary" style="width: auto; padding: 6px 12px; font-size: 0.8rem;" onclick="chatModule.sendInvite('${u.id}')">
                Suhbatlashish / Taklifni yuborish
              </button>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.error('Qidiruvda xatolik:', err);
    }
  },

  async sendInvite(toUserId) {
    try {
      const res = await fetch('/api/chat/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authModule.token
        },
        body: JSON.stringify({ toUserId })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Suhbat taklifi yuborildi! U qabul qilgach suhbatlashishingiz mumkin.');
        document.getElementById('chat-search-input').value = '';
        document.getElementById('chat-search-results').classList.add('hidden');
      } else {
        alert(data.error || 'Taklif yuborib bo\'lmadi');
      }
    } catch (err) {
      alert('Serverga ulanib bo\'lmadi');
    }
  },

  async loadInvitations() {
    try {
      const res = await fetch('/api/chat/invitations', {
        headers: { 'x-auth-token': authModule.token }
      });
      if (res.ok) {
        const data = await res.json();
        this.invitations = data.invitations;
        this.renderInvitations();
      }
    } catch (err) {
      console.error('Takliflarni yuklashda xatolik:', err);
    }
  },

  renderInvitations() {
    const banner = document.getElementById('invitations-banner');
    if (!banner) return;

    if (!this.invitations || this.invitations.length === 0) {
      banner.classList.add('hidden');
      banner.innerHTML = '';
      return;
    }

    banner.classList.remove('hidden');
    banner.innerHTML = this.invitations.map(inv => {
      const sender = inv.fromUser || { username: 'Foydalanuvchi', fullName: 'Foydalanuvchi' };
      const senderName = sender.fullName || sender.username;
      return `
        <div class="chat-invitation-banner">
          <div style="font-weight: 700; font-size: 0.95rem; color: #92400e;">
            📩 Sizga ${this.escapeHtml(senderName)} (@${this.escapeHtml(sender.username)}) taklif yubordi, qabul qilasizmi?
          </div>
          <div class="invite-actions">
            <button class="btn-primary" style="width: auto; padding: 6px 14px; font-size: 0.85rem;" onclick="chatModule.respondInvite('${inv.id}', 'accept')">
              Qabul qilish
            </button>
            <button class="btn-secondary" style="width: auto; padding: 6px 14px; font-size: 0.85rem;" onclick="chatModule.respondInvite('${inv.id}', 'reject')">
              Rad etish
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async respondInvite(invitationId, action) {
    try {
      const res = await fetch('/api/chat/respond-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authModule.token
        },
        body: JSON.stringify({ invitationId, action })
      });
      if (res.ok) {
        await this.loadInvitations();
        await this.loadContacts();
      }
    } catch (err) {
      console.error('Taklifga javob berishda xatolik:', err);
    }
  },

  async loadContacts() {
    try {
      const res = await fetch('/api/chat/contacts', {
        headers: { 'x-auth-token': authModule.token }
      });
      if (res.ok) {
        const data = await res.json();
        this.contacts = data.contacts;
        this.renderContacts();
      }
    } catch (err) {
      console.error('Kontaktlarni yuklashda xatolik:', err);
    }
  },

  renderContacts() {
    const list = document.getElementById('chat-contacts');
    if (!list) return;

    if (!this.contacts || this.contacts.length === 0) {
      list.innerHTML = `
        <p class="text-muted" style="font-size: 0.9rem; padding: 12px; background: white; border-radius: 12px; border: 1px solid var(--border-color);">
          Hozircha faol suhbatlar yo'q. Yuqoridan usernameni qidirib suhbat taklifini yuboring.
        </p>
      `;
      return;
    }

    list.innerHTML = this.contacts.map(c => {
      const u = c.user;
      const name = u.fullName || u.username;
      const avatar = u.avatarUrl || '/uploads/avatars/default.png';
      return `
        <!-- Yumaloq avatarli chat kontakt -->
        <div class="chat-contact-item" onclick="chatModule.openConversation('${u.id}', '${this.escapeHtml(name)}', '${this.escapeHtml(u.username)}', '${avatar}')">
          <img src="${avatar}" class="avatar" onerror="this.src='/uploads/avatars/default.png'">
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 0.95rem;">${this.escapeHtml(name)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">@${this.escapeHtml(u.username)} • Suhbatlashish</div>
          </div>
          <div style="color: var(--primary); font-size: 1.1rem;">💬</div>
        </div>
      `;
    }).join('');
  },

  async openConversation(userId, name, username, avatar) {
    this.activeChatUser = { id: userId, name, username, avatar };

    document.getElementById('chat-main-panel').classList.add('hidden');
    document.getElementById('chat-conversation-panel').classList.remove('hidden');

    document.getElementById('active-chat-name').innerText = name;
    document.getElementById('active-chat-sub').innerText = `@${username}`;
    document.getElementById('active-chat-avatar').src = avatar;

    await this.loadMessages(userId);
  },

  closeConversation() {
    this.activeChatUser = null;
    document.getElementById('chat-conversation-panel').classList.add('hidden');
    document.getElementById('chat-main-panel').classList.remove('hidden');
  },

  async loadMessages(userId) {
    try {
      const res = await fetch(`/api/chat/messages/${userId}`, {
        headers: { 'x-auth-token': authModule.token }
      });
      if (res.ok) {
        const data = await res.json();
        this.renderMessages(data.messages);
      }
    } catch (err) {
      console.error('Xabarlarni yuklashda xatolik:', err);
    }
  },

  renderMessages(messages) {
    const box = document.getElementById('chat-messages-box');
    if (!box) return;

    const myId = authModule.currentUser.id;

    if (!messages || messages.length === 0) {
      box.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; margin: auto;">
          Suhbatni boshlang...
        </div>
      `;
      return;
    }

    box.innerHTML = messages.map(m => {
      const isSent = m.senderId === myId;
      return `
        <div class="chat-bubble ${isSent ? 'sent' : 'received'}">
          ${this.escapeHtml(m.text)}
        </div>
      `;
    }).join('');

    box.scrollTop = box.scrollHeight;
  },

  async handleSendMessage(e) {
    e.preventDefault();
    if (!this.activeChatUser) return;

    const input = document.getElementById('chat-msg-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    try {
      // 1. REST API orqali yuborish (bazada 100% saqlanishi kafolatlangan)
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authModule.token
        },
        body: JSON.stringify({
          receiverId: this.activeChatUser.id,
          text
        })
      });

      if (res.ok) {
        const data = await res.json();
        this.appendMessage(data.message);
      }
    } catch (err) {
      console.error('Xabar yuborishda xatolik:', err);
    }
  },

  appendMessage(msg) {
    if (!this.activeChatUser || !msg) return;

    // Agar ochiq suhbatga tegishli bo'lsa
    if (
      (msg.senderId === this.activeChatUser.id && msg.receiverId === authModule.currentUser.id) ||
      (msg.senderId === authModule.currentUser.id && msg.receiverId === this.activeChatUser.id)
    ) {
      const box = document.getElementById('chat-messages-box');
      if (!box) return;

      // Agar bu xabar allaqachon ekranda bo'lsa, qayta qo'shmaymiz
      if (document.getElementById(`msg-${msg.id}`)) return;

      // "Suhbatni boshlang..." yozuvini olib tashlash
      const emptyText = box.querySelector('div[style*="text-align: center"]');
      if (emptyText) emptyText.remove();

      const isSent = msg.senderId === authModule.currentUser.id;
      const bubble = document.createElement('div');
      bubble.id = `msg-${msg.id}`;
      bubble.className = `chat-bubble ${isSent ? 'sent' : 'received'}`;
      bubble.innerText = msg.text;
      box.appendChild(bubble);
      box.scrollTop = box.scrollHeight;
    }
  },

  onReceiveMessage(msg) {
    this.appendMessage(msg);
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  }
};
