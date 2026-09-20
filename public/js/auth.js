// AUTH MODULE
const authModule = {
  currentUser: null,
  token: null,
  pendingEmail: null,

  init() {
    this.token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
      } catch (e) {}
    }

    const emailForm = document.getElementById('email-form');
    const adminPassForm = document.getElementById('admin-pass-form');
    const otpForm = document.getElementById('otp-form');

    if (emailForm) {
      emailForm.addEventListener('submit', (e) => this.handleEmailSubmit(e));
    }
    if (adminPassForm) {
      adminPassForm.addEventListener('submit', (e) => this.handleAdminPassSubmit(e));
    }
    if (otpForm) {
      otpForm.addEventListener('submit', (e) => this.handleOtpSubmit(e));
    }
  },

  async checkAuth() {
    if (!this.token) {
      this.showAuthScreen();
      return false;
    }

    try {
      const res = await fetch('/api/users/me', {
        headers: { 'x-auth-token': this.token }
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        localStorage.setItem('user', JSON.stringify(this.currentUser));
        this.showMainApp();
        return true;
      } else if (res.status === 401 || res.status === 403) {
        this.logout();
        return false;
      }
    } catch (err) {
      console.error('Auth tekshirishda tarmoq xatosi:', err);
      // Agar keshda foydalanuvchi ma'lumoti bo'lsa, chiqib ketmaymiz
      if (this.currentUser) {
        this.showMainApp();
        return true;
      }
      this.showAuthScreen();
      return false;
    }
  },

  showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    this.resetAuthForm();
  },

  showMainApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    // Admin bo'lsa, navbarda Admin bo'limini ko'rsatish
    const adminNav = document.getElementById('nav-item-admin');
    const badge = document.getElementById('header-user-badge');
    if (this.currentUser && this.currentUser.isAdmin) {
      if (adminNav) adminNav.classList.remove('hidden');
      if (badge) {
        badge.innerText = 'Bosh Admin';
        badge.style.background = '#fef08a';
        badge.style.color = '#854d0e';
      }
    } else {
      if (adminNav) adminNav.classList.add('hidden');
      if (badge) {
        badge.innerText = this.currentUser.username ? `@${this.currentUser.username}` : 'O\'quvchi';
      }
    }

    // Tizim komponentlarini ishga tushirish
    window.appModule.onUserLoggedIn(this.currentUser);
  },

  resetAuthForm() {
    document.getElementById('email-form').classList.remove('hidden');
    document.getElementById('admin-pass-form').classList.add('hidden');
    document.getElementById('otp-form').classList.add('hidden');
    document.getElementById('auth-error').classList.add('hidden');
    document.getElementById('auth-email').value = '';
    document.getElementById('admin-password').value = '';
    document.getElementById('otp-code').value = '';
    this.pendingEmail = null;
  },

  showError(msg) {
    const el = document.getElementById('auth-error');
    el.innerText = msg;
    el.classList.remove('hidden');
  },

  async handleEmailSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById('auth-email');
    const email = emailInput.value.trim().toLowerCase();
    if (!email) return;

    this.pendingEmail = email;
    this.showError('');
    document.getElementById('auth-error').classList.add('hidden');

    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!res.ok) {
        this.showError(data.error || 'Xatolik yuz berdi');
        return;
      }

      document.getElementById('email-form').classList.add('hidden');

      if (data.isAdmin && data.requirePassword) {
        // Admin parol formasi
        document.getElementById('admin-pass-form').classList.remove('hidden');
        document.getElementById('admin-password').focus();
      } else {
        // Oddiy foydalanuvchi OTP formasi
        document.getElementById('otp-form').classList.remove('hidden');
        document.getElementById('otp-code').focus();
      }
    } catch (err) {
      this.showError('Serverga ulanib bo\'lmadi');
    }
  },

  async handleAdminPassSubmit(e) {
    e.preventDefault();
    const password = document.getElementById('admin-password').value;
    this.showError('');

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.pendingEmail, password })
      });
      const data = await res.json();

      if (!res.ok) {
        this.showError(data.error || 'Parol noto\'g\'ri');
        return;
      }

      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('token', this.token);
      localStorage.setItem('user', JSON.stringify(this.currentUser));

      this.showMainApp();
    } catch (err) {
      this.showError('Kirishda xatolik yuz berdi');
    }
  },

  async handleOtpSubmit(e) {
    e.preventDefault();
    const code = document.getElementById('otp-code').value.trim();
    if (!code) return;

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.pendingEmail, code })
      });
      const data = await res.json();

      if (!res.ok) {
        this.showError(data.error || 'Kod noto\'g\'ri');
        return;
      }

      this.token = data.token;
      this.currentUser = data.user;
      localStorage.setItem('token', this.token);
      localStorage.setItem('user', JSON.stringify(this.currentUser));

      this.showMainApp();
    } catch (err) {
      this.showError('Tasdiqlashda xatolik yuz berdi');
    }
  },

  async logout() {
    if (this.token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'x-auth-token': this.token }
        });
      } catch (e) {}
    }
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.showAuthScreen();
  }
};
