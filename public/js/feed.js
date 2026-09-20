// FEED MODULE (LinkedIn uslubidagi Asosiy Menyu)
const feedModule = {
  posts: [],

  init() {
    // "+" tugmasi orqali post chiqarish oynasini ochish
    const btnOpen = document.getElementById('btn-open-create-post');
    const btnClose = document.getElementById('btn-close-post-modal');
    const modal = document.getElementById('modal-create-post');
    const form = document.getElementById('form-create-post');

    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        modal.classList.remove('hidden');
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        modal.classList.add('hidden');
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => this.handleCreatePost(e));
    }
  },

  async loadFeed() {
    try {
      // E'lonlarni yuklash
      this.loadAnnouncements();

      const res = await fetch('/api/posts', {
        headers: { 'x-auth-token': authModule.token }
      });
      if (res.ok) {
        const data = await res.json();
        this.posts = data.posts;
        this.renderPosts();
      }
    } catch (err) {
      console.error('Postlarni yuklashda xatolik:', err);
    }
  },

  async loadAnnouncements() {
    const container = document.getElementById('announcements-container');
    if (!container) return;

    try {
      const res = await fetch('/api/announcements', {
        headers: { 'x-auth-token': authModule.token }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.announcements && data.announcements.length > 0) {
          container.innerHTML = data.announcements.map(ann => `
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px;">
              <div style="font-weight: 700; color: #1e40af; font-size: 0.95rem; margin-bottom: 4px;">📢 ${this.escapeHtml(ann.title)}</div>
              <div style="font-size: 0.88rem; color: #1e3a8a;">${this.escapeHtml(ann.content)}</div>
            </div>
          `).join('');
          return;
        }
      }
      container.innerHTML = '';
    } catch (e) {
      container.innerHTML = '';
    }
  },

  renderPosts() {
    const container = document.getElementById('posts-container');
    if (!container) return;

    if (this.posts.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; background: white; border-radius: 16px; border: 1px solid var(--border-color);">
          <h3 style="margin-bottom: 8px;">Hozircha hech qanday video post yo'q</h3>
          <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 16px;">Birinchi bo'lib maktab uchun foydali video chiqaring!</p>
          <button class="btn-primary" style="width: auto; padding: 8px 20px;" onclick="document.getElementById('btn-open-create-post').click()">
            + Video chiqarish
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.posts.map(post => this.createPostCardHtml(post)).join('');
  },

  createPostCardHtml(post) {
    const authorName = post.author ? (post.author.fullName || post.author.username) : 'Foydalanuvchi';
    const authorUsername = post.author ? post.author.username : 'user';
    const avatar = (post.author && post.author.avatarUrl) ? post.author.avatarUrl : '/images/default-avatar.svg';
    const timeStr = new Date(post.createdAt).toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const isLiked = post.isLiked;

    return `
      <article class="post-card" id="post-card-${post.id}">
        <!-- Muallif bosh qismi (LinkedIn formatida) -->
        <div class="post-header">
          <img src="${avatar}" alt="${authorUsername}" class="avatar" onerror="this.src='/uploads/avatars/default.png'">
          <div class="post-user-info">
            <span class="post-user-name">${this.escapeHtml(authorName)}</span>
            <span class="post-user-sub">@${this.escapeHtml(authorUsername)} • ${timeStr}</span>
          </div>
        </div>

        <!-- Tavsif matni -->
        ${post.caption ? `<div class="post-caption">${this.escapeHtml(post.caption)}</div>` : ''}

        <!-- Video pleer -->
        <div class="post-video-wrapper">
          <video class="post-video" src="${post.videoUrl}" controls playsinline preload="metadata"></video>
        </div>

        <!-- Faqat Like tugmasi (Komment va boshqalar yo'q) -->
        <div class="post-actions">
          <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="feedModule.handleLike('${post.id}')" id="like-btn-${post.id}">
            <svg viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <span id="like-count-${post.id}">${post.likesCount || 0}</span>
          </button>
        </div>
      </article>
    `;
  },

  async handleLike(postId) {
    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'x-auth-token': authModule.token }
      });
      if (res.ok) {
        const data = await res.json();
        const btn = document.getElementById(`like-btn-${postId}`);
        const countSpan = document.getElementById(`like-count-${postId}`);

        if (btn && countSpan) {
          countSpan.innerText = data.likesCount;
          if (data.isLiked) {
            btn.classList.add('liked');
          } else {
            btn.classList.remove('liked');
          }
        }
      }
    } catch (err) {
      console.error('Like bosishda xatolik:', err);
    }
  },

  handleCreatePost(e) {
    e.preventDefault();
    const fileInput = document.getElementById('post-video-file');
    const captionInput = document.getElementById('post-caption-input');
    const container = document.getElementById('post-upload-container');
    const barEl = document.getElementById('post-upload-bar');
    const percentEl = document.getElementById('post-upload-percent');
    const textEl = document.getElementById('post-upload-text');
    const submitBtn = document.getElementById('btn-submit-post');

    if (!fileInput.files || fileInput.files.length === 0) {
      alert('Iltimos, video faylni tanlang!');
      return;
    }

    const file = fileInput.files[0];

    const formData = new FormData();
    formData.append('video', file);
    formData.append('caption', captionInput.value);

    // Progress barni yoqish
    container.classList.remove('hidden');
    barEl.style.width = '0%';
    percentEl.innerText = '0%';
    textEl.innerText = 'Serverga yuklanmoqda...';
    submitBtn.disabled = true;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/posts/create', true);
    xhr.setRequestHeader('x-auth-token', authModule.token);

    // Yuklanish jarayoni (jonli foiz)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        percentEl.innerText = `${percent}%`;
        barEl.style.width = `${percent}%`;
        if (percent >= 100) {
          textEl.innerText = 'Video saqlanmoqda, ozgina kuting...';
        }
      }
    };

    xhr.onload = () => {
      submitBtn.disabled = false;
      container.classList.add('hidden');

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          fileInput.value = '';
          captionInput.value = '';
          document.getElementById('modal-create-post').classList.add('hidden');
          this.addNewPostToTop(data.post);
        } catch (err) {
          alert('Xatolik yuz berdi');
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          alert(data.error || 'Video yuklashda xatolik yuz berdi');
        } catch (e) {
          alert('Serverdan noto\'g\'ri javob keldi');
        }
      }
    };

    xhr.onerror = () => {
      submitBtn.disabled = false;
      container.classList.add('hidden');
      alert('Tarmoq xatosi: video yuklab bo\'lmadi');
    };

    xhr.send(formData);
  },

  addNewPostToTop(post) {
    if (!post || !post.id) return;
    // Agar bu post allaqachon lentada bo'lsa, qayta qo'shilmaydi
    if (this.posts.some(p => p.id === post.id)) {
      return;
    }
    this.posts.unshift(post);
    this.renderPosts();
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
