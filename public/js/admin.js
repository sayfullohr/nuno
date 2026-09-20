// ADMIN MODULE (Sayfulloh uchun boshqaruv paneli)
const adminModule = {
  pendingOtps: [],
  users: [],

  init() {
    const annForm = document.getElementById('admin-announcement-form');
    if (annForm) {
      annForm.addEventListener('submit', (e) => this.handleAddAnnouncement(e));
    }
  },

  async loadAdminPanel() {
    if (!authModule.currentUser || !authModule.currentUser.isAdmin) return;
    await this.loadOtps();
    await this.loadUsers();
  },

  async loadOtps() {
    try {
      const res = await fetch('/api/admin/otps', {
        headers: { 'x-auth-token': authModule.token }
      });
      if (res.ok) {
        const data = await res.json();
        this.pendingOtps = data.otps;
        this.renderOtps();
      }
    } catch (err) {
      console.error('OTP-larni yuklashda xatolik:', err);
    }
  },

  renderOtps() {
    const list = document.getElementById('admin-otp-list');
    if (!list) return;

    if (!this.pendingOtps || this.pendingOtps.length === 0) {
      list.innerHTML = `<p class="text-muted" style="font-size: 0.85rem;">Hozircha faol kirish so'rovlari yo'q.</p>`;
      return;
    }

    list.innerHTML = this.pendingOtps.map(item => `
      <div class="otp-box">
        <div>
          <div style="font-weight: 700; font-size: 0.95rem; color: #166534;">
            ✉️ ${this.escapeHtml(item.email)}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            Vaqt: ${new Date(item.createdAt).toLocaleTimeString()}
          </div>
        </div>
        <div class="otp-number">
          ${item.code}
        </div>
      </div>
    `).join('');
  },

  onNewOtpReceived(otpData) {
    // Agar bu email oldin bo'lsa yangilaymiz, bo'lmasa boshiga qo'shamiz
    this.pendingOtps = this.pendingOtps.filter(o => o.email !== otpData.email);
    this.pendingOtps.unshift(otpData);
    this.renderOtps();
  },

  onOtpVerified(email) {
    this.pendingOtps = this.pendingOtps.filter(o => o.email !== email);
    this.renderOtps();
    this.loadUsers(); // yangi foydalanuvchi qo'shilgan bo'lishi mumkin
  },

  async loadUsers() {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'x-auth-token': authModule.token }
      });
      if (res.ok) {
        const data = await res.json();
        this.users = data.users;
        this.renderUsers();
      }
    } catch (err) {
      console.error('Foydalanuvchilarni yuklashda xatolik:', err);
    }
  },

  renderUsers() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;

    if (!this.users || this.users.length === 0) {
      container.innerHTML = `<p class="text-muted">A'zolar mavjud emas.</p>`;
      return;
    }

    container.innerHTML = this.users.map(u => {
      const isMe = u.id === authModule.currentUser.id;
      const avatar = u.avatarUrl || '/uploads/avatars/default.png';
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Kiritilmagan';

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${avatar}" class="avatar" style="width: 40px; height: 40px;" onerror="this.src='/uploads/avatars/default.png'">
            <div>
              <div style="font-weight: 700; font-size: 0.9rem;">
                ${this.escapeHtml(name)} ${u.isAdmin ? '<span class="admin-badge">Admin</span>' : ''}
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">
                @${this.escapeHtml(u.username || 'nom')} • ${this.escapeHtml(u.email)}
              </div>
            </div>
          </div>
          ${!isMe ? `
            <button class="btn-danger" onclick="adminModule.kickUser('${u.id}', '${this.escapeHtml(u.username)}')">
              Chiqarib yuborish
            </button>
          ` : '<span style="font-size: 0.8rem; color: var(--text-muted);">Siz</span>'}
        </div>
      `;
    }).join('');
  },

  async kickUser(userId, username) {
    if (!confirm(`Haqiqatan ham @${username} foydalanuvchisini platformadan chiqarib yubormoqchimisiz?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': authModule.token }
      });
      const data = await res.json();
      if (res.ok) {
        alert('Foydalanuvchi tizimdan chiqarib yuborildi.');
        await this.loadUsers();
      } else {
        alert(data.error || 'Xatolik yuz berdi');
      }
    } catch (err) {
      alert('Serverga ulanib bo\'lmadi');
    }
  },

  async handleAddAnnouncement(e) {
    e.preventDefault();
    const title = document.getElementById('ann-title').value.trim();
    const content = document.getElementById('ann-content').value.trim();

    if (!title || !content) return;

    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': authModule.token
        },
        body: JSON.stringify({ title, content })
      });
      if (res.ok) {
        alert('E\'lon muvaffaqiyatli joylashtirildi!');
        document.getElementById('ann-title').value = '';
        document.getElementById('ann-content').value = '';
      }
    } catch (err) {
      alert('E\'lon joylashda xatolik yuz berdi');
    }
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
