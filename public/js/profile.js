// PROFILE MODULE
const profileModule = {
  userPosts: [],

  init() {
    const burgerBtn = document.getElementById('btn-profile-burger');
    const dropdown = document.getElementById('profile-dropdown');
    const editBtn = document.getElementById('menu-edit-profile');
    const logoutBtn = document.getElementById('menu-logout');
    const closeEditModalBtn = document.getElementById('btn-close-edit-modal');
    const editForm = document.getElementById('form-edit-profile');

    // Uchta chiziqcha menyusi (☰)
    if (burgerBtn && dropdown) {
      burgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      });

      // Tashqarini bosganda yopilish
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== burgerBtn) {
          dropdown.classList.add('hidden');
        }
      });
    }

    // Chiqib ketish
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        authModule.logout();
      });
    }

    // Edit profil modalini ochish
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        this.openEditModal();
      });
    }

    if (closeEditModalBtn) {
      closeEditModalBtn.addEventListener('click', () => {
        document.getElementById('modal-edit-profile').classList.add('hidden');
      });
    }

    if (editForm) {
      editForm.addEventListener('submit', (e) => this.handleSaveProfile(e));
    }
  },

  async loadProfile() {
    const user = authModule.currentUser;
    if (!user) return;

    // Ko'rinishni yangilash
    document.getElementById('profile-display-username').innerText = `@${user.username || 'username'}`;
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Foydalanuvchi';
    document.getElementById('profile-display-fullname').innerText = fullName;
    document.getElementById('profile-display-bio').innerText = user.bio || 'Hali ma\'lumot kiritilmagan...';

    const avatarEl = document.getElementById('profile-display-avatar');
    if (avatarEl) {
      avatarEl.src = user.avatarUrl || '/images/default-avatar.svg';
    }

    // Foydalanuvchining o'z postlarini yuklash (3/6 grid uchun)
    await this.loadMyPosts(user.id);
  },

  openEditModal() {
    const user = authModule.currentUser;
    if (!user) return;

    document.getElementById('edit-username').value = user.username || '';
    document.getElementById('edit-firstname').value = user.firstName || '';
    document.getElementById('edit-lastname').value = user.lastName || '';
    document.getElementById('edit-bio').value = user.bio || '';
    document.getElementById('edit-profile-error').classList.add('hidden');

    document.getElementById('modal-edit-profile').classList.remove('hidden');
  },

  async handleSaveProfile(e) {
    e.preventDefault();
    const username = document.getElementById('edit-username').value.trim();
    const firstName = document.getElementById('edit-firstname').value.trim();
    const lastName = document.getElementById('edit-lastname').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const avatarFile = document.getElementById('edit-avatar-file').files[0];
    const errorEl = document.getElementById('edit-profile-error');

    if (!username) {
      errorEl.innerText = 'Username bo\'sh bo\'lishi mumkin emas!';
      errorEl.classList.remove('hidden');
      return;
    }

    const formData = new FormData();
    formData.append('username', username);
    formData.append('firstName', firstName);
    formData.append('lastName', lastName);
    formData.append('bio', bio);
    if (avatarFile) {
      formData.append('avatar', avatarFile);
    }

    try {
      const res = await fetch('/api/users/update-profile', {
        method: 'POST',
        headers: { 'x-auth-token': authModule.token },
        body: formData
      });
      const data = await res.json();

      if (!res.ok) {
        // Unikal username band bo'lsa xatolik chiqadi
        errorEl.innerText = data.error || 'Profilni yangilab bo\'lmadi';
        errorEl.classList.remove('hidden');
        return;
      }

      authModule.currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(data.user));

      document.getElementById('modal-edit-profile').classList.add('hidden');
      await this.loadProfile();

      // Headerdagi nomni ham yangilash
      const badge = document.getElementById('header-user-badge');
      if (badge && !data.user.isAdmin) {
        badge.innerText = `@${data.user.username}`;
      }
    } catch (err) {
      errorEl.innerText = 'Serverga ulanishda xatolik yuz berdi';
      errorEl.classList.remove('hidden');
    }
  },

  async loadMyPosts(userId) {
    try {
      const res = await fetch(`/api/posts/user/${userId}`, {
        headers: { 'x-auth-token': authModule.token }
      });
      if (res.ok) {
        const data = await res.json();
        this.userPosts = data.posts;
        this.renderPostsGrid();
      }
    } catch (err) {
      console.error('Foydalanuvchi postlarini yuklashda xatolik:', err);
    }
  },

  // Telefonda 3 ta, kompyuterda 6 ta to'rtburchak grid
  renderPostsGrid() {
    const grid = document.getElementById('profile-posts-grid');
    if (!grid) return;

    if (!this.userPosts || this.userPosts.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.9rem;">
          Siz hali hech qanday video post chiqarmagansiz.
        </div>
      `;
      return;
    }

    grid.innerHTML = this.userPosts.map(post => `
      <div class="grid-post-item" onclick="profileModule.openVideoModal('${post.videoUrl}', '${encodeURIComponent(post.caption || '')}')">
        <video class="grid-post-video" src="${post.videoUrl}#t=0.5" preload="metadata"></video>
        <div class="grid-post-overlay">
          <span>▶ Ko'rish</span>
        </div>
      </div>
    `).join('');
  },

  openVideoModal(videoUrl, encodedCaption) {
    const caption = decodeURIComponent(encodedCaption);
    alert(`Video tavsifi: ${caption || 'Tavsif yo\'q'}`);
  }
};
