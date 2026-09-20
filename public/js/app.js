// MAIN APPLICATION LOGIC & ROUTING
const appModule = {
  socket: null,
  currentView: 'feed-view',

  init() {
    // Socket.io ulanishi
    this.socket = io();

    // Socket hodisalari
    this.setupSocketEvents();

    // Pastki menyu tugmalari
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(btn => {
      btn.addEventListener('click', () => {
        const viewId = btn.getAttribute('data-view');
        this.switchView(viewId);
      });
    });

    // Modullarni ishga tushirish
    authModule.init();
    feedModule.init();
    chatModule.init();
    profileModule.init();
    adminModule.init();

    // Sessiyani tekshirish
    authModule.checkAuth();
  },

  setupSocketEvents() {
    this.socket.on('connect', () => {
      console.log('Serverga muvaffaqiyatli ulandi (Socket ID:', this.socket.id, ')');
      if (authModule.currentUser) {
        this.socket.emit('join_user', authModule.currentUser.id);
        if (authModule.currentUser.isAdmin) {
          this.socket.emit('join_admin');
        }
      }
    });

    // Yangi post chiqarilganda
    this.socket.on('new_post', (post) => {
      feedModule.addNewPostToTop(post);
    });

    // Postga like bosilganda
    this.socket.on('post_liked', ({ postId, likesCount }) => {
      const countSpan = document.getElementById(`like-count-${postId}`);
      if (countSpan) {
        countSpan.innerText = likesCount;
      }
    });

    // Admin uchun yangi OTP so'rovi kelganda
    this.socket.on('new_otp_request', (otpData) => {
      if (authModule.currentUser && authModule.currentUser.isAdmin) {
        adminModule.onNewOtpReceived(otpData);
      }
    });

    this.socket.on('otp_verified', ({ email }) => {
      if (authModule.currentUser && authModule.currentUser.isAdmin) {
        adminModule.onOtpVerified(email);
      }
    });

    // Chat taklifi kelganda
    this.socket.on('chat_invitation_received', (invitation) => {
      alert(`📩 @${invitation.fromUser.username} sizga suhbatlashish taklifini yubordi! "Chat" bo'limida qabul qilishingiz mumkin.`);
      chatModule.loadInvitations();
    });

    // Chat taklifi qabul qilinganda
    this.socket.on('chat_invitation_accepted', ({ byUser }) => {
      alert(`🎉 @${byUser.username} sizning suhbat taklifingizni qabul qildi! Endi xabarlashishingiz mumkin.`);
      chatModule.loadContacts();
    });

    // Yangi xabar kelganda
    this.socket.on('receive_chat_message', (msg) => {
      chatModule.onReceiveMessage(msg);
    });

    // Admin tomonidan chiqarib yuborilganda
    this.socket.on('kicked_by_admin', ({ message }) => {
      alert(message || 'Sizning hisobingiz admin tomonidan chiqarib yuborildi.');
      authModule.logout();
    });
  },

  onUserLoggedIn(user) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('join_user', user.id);
      if (user.isAdmin) {
        this.socket.emit('join_admin');
      }
    }

    // Dastlabki sahifani ochish
    if (user.isAdmin) {
      this.switchView('admin-view');
    } else {
      this.switchView('feed-view');
    }
  },

  switchView(viewId) {
    this.currentView = viewId;

    // Barcha bo'limlarni yashirish
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.add('hidden');
    });

    // Tanlangan bo'limni ko'rsatish
    const targetSection = document.getElementById(viewId);
    if (targetSection) {
      targetSection.classList.remove('hidden');
    }

    // Pastki menyu tugmasini faollashtirish
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
      if (btn.getAttribute('data-view') === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Har bir bo'limga xos ma'lumotlarni yangilash
    if (viewId === 'feed-view') {
      feedModule.loadFeed();
    } else if (viewId === 'chat-view') {
      chatModule.closeConversation();
      chatModule.loadChatSection();
    } else if (viewId === 'profile-view') {
      profileModule.loadProfile();
    } else if (viewId === 'admin-view') {
      adminModule.loadAdminPanel();
    }
  }
};

// Ilova yuklanganda ishga tushirish
window.addEventListener('DOMContentLoaded', () => {
  appModule.init();
});
