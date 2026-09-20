const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const DB = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const ADMIN_EMAIL = 'sayfulloh822siftdagmail.com';
const ADMIN_PASS = 'sayfulloh_ai';

// Papkalarni tayyorlash
const uploadDir = path.join(__dirname, 'uploads');
const videosDir = path.join(uploadDir, 'videos');
const avatarsDir = path.join(uploadDir, 'avatars');

[uploadDir, videosDir, avatarsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer sozlamalari
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'video') {
      cb(null, videosDir);
    } else if (file.fieldname === 'avatar') {
      cb(null, avatarsDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = Date.now() + '_' + Math.random().toString(36).substring(2, 8) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100 MB gacha video
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Statik fayllar
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'public')));

function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'] || req.cookies['auth_token'];
  if (!token) {
    return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
  }
  const session = DB.getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Avtorizatsiyadan o\'tilmagan' });
  }
  req.session = session;
  next();
}

function adminMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'] || req.cookies['auth_token'];
  if (!token) {
    return res.status(403).json({ error: 'Faqat admin uchun ruxsat berilgan' });
  }
  const session = DB.getSession(token);
  if (!session || !session.isAdmin) {
    return res.status(403).json({ error: 'Faqat admin uchun ruxsat berilgan' });
  }
  req.session = session;
  next();
}

// ---------------- API RO'YXATI ---------------- //

// 1. Email tekshirish & OTP generatsiyasi
app.post('/api/auth/check-email', (req, res) => {
  const { email } = req.body;
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email manzilini kiriting' });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Agar admin bo'lsa
  const isAdminEmail = cleanEmail === ADMIN_EMAIL.toLowerCase() || 
                       cleanEmail === 'sayfulloh822siftda@gmail.com' ||
                       cleanEmail === 'sayfulloh822siftdagmail.com';

  if (isAdminEmail) {
    return res.json({
      isAdmin: true,
      requirePassword: true,
      message: 'Admin parolini kiriting'
    });
  }

  // Oddiy foydalanuvchi bo'lsa:
  // Eski OTP bo'lsa bekor qilinadi, yangi takrorlanmas OTP yaratiladi
  const newOtp = DB.createOtp(cleanEmail);

  // Admin panelga jonli bildirishnoma (Socket.io)
  io.to('admin_room').emit('new_otp_request', {
    email: cleanEmail,
    code: newOtp,
    createdAt: new Date().toISOString()
  });

  return res.json({
    isAdmin: false,
    requireOtp: true,
    message: 'Tasdiqlash kodi admin orqali yuboriladi. Iltimos kodni kiriting.'
  });
});

// 2. Admin Login
app.post('/api/auth/admin-login', (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const isAdminEmail = cleanEmail === ADMIN_EMAIL.toLowerCase() || 
                       cleanEmail === 'sayfulloh822siftda@gmail.com' ||
                       cleanEmail === 'sayfulloh822siftdagmail.com';

  if (isAdminEmail && password === ADMIN_PASS) {
    let adminUser = DB.getUserByEmail(cleanEmail) || DB.getUserByEmail(ADMIN_EMAIL);
    if (!adminUser) {
      adminUser = DB.createUser({
        id: 'admin_' + Date.now(),
        email: ADMIN_EMAIL,
        username: 'sayfulloh_admin',
        firstName: 'Sayfulloh',
        lastName: 'Admin',
        bio: 'Maktab ijtimoiy platformasi Bosh Administratori',
        avatarUrl: '/uploads/avatars/default.png',
        isAdmin: true,
        createdAt: new Date().toISOString()
      });
    }

    const token = 'tok_admin_' + uuidv4();
    DB.saveSession(token, {
      userId: adminUser.id,
      email: adminUser.email,
      isAdmin: true
    });

    return res.json({
      success: true,
      token,
      user: adminUser,
      isAdmin: true
    });
  }

  return res.status(401).json({ error: 'Parol noto\'g\'ri' });
});

// 3. Foydalanuvchi OTP tasdiqlash
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email va kod kiritilishi shart' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  const otpData = DB.getOtp(cleanEmail);
  if (!otpData || otpData.code !== cleanCode) {
    return res.status(400).json({ error: 'Kod noto\'g\'ri yoki muddati o\'tgan' });
  }

  // Kod to'g'ri bo'lsa, uni bazadan o'chiramiz (bir martalik)
  DB.clearOtp(cleanEmail);

  // Foydalanuvchini qidiramiz yoki yangi ochamiz
  let user = DB.getUserByEmail(cleanEmail);
  if (!user) {
    const baseUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    let uniqueUsername = baseUsername;
    let count = 1;
    while (DB.getUserByUsername(uniqueUsername)) {
      uniqueUsername = `${baseUsername}${count++}`;
    }

    user = DB.createUser({
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      email: cleanEmail,
      username: uniqueUsername,
      firstName: '',
      lastName: '',
      bio: '',
      avatarUrl: '',
      isAdmin: false,
      createdAt: new Date().toISOString()
    });
  }

  const token = 'tok_user_' + uuidv4();
  DB.saveSession(token, {
    userId: user.id,
    email: user.email,
    isAdmin: false
  });

  // Admin panelga kirdi degan xabar yuborish
  io.to('admin_room').emit('otp_verified', { email: cleanEmail });

  return res.json({
    success: true,
    token,
    user,
    isAdmin: false
  });
});

// Logout endpointi (Faqatgina o'zi chiqib ketgandagina sessiyani o'chiradi)
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'] || req.cookies['auth_token'];
  if (token) {
    DB.deleteSession(token);
  }
  return res.json({ success: true });
});

// 4. Joriy profilni olish
app.get('/api/users/me', authMiddleware, (req, res) => {
  const user = DB.getUserById(req.session.userId);
  if (!user) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  }
  return res.json({ user });
});

// 5. Profilni tahrirlash (Unikal Username tekshiruvi bilan)
app.post('/api/users/update-profile', authMiddleware, upload.single('avatar'), (req, res) => {
  const userId = req.session.userId;
  const { firstName, lastName, bio, username } = req.body;
  const user = DB.getUserById(userId);

  if (!user) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  }

  const updates = {};
  if (firstName !== undefined) updates.firstName = firstName.trim();
  if (lastName !== undefined) updates.lastName = lastName.trim();
  if (bio !== undefined) updates.bio = bio.trim();

  // Username unikal bo'lishi shart!
  if (username !== undefined) {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      return res.status(400).json({ error: 'Username bo\'sh bo\'lishi mumkin emas' });
    }

    const existingUser = DB.getUserByUsername(cleanUsername);
    if (existingUser && existingUser.id !== userId) {
      return res.status(400).json({
        error: `"${username}" username band! Iltimos, boshqa username tanlang.`
      });
    }
    updates.username = cleanUsername;
  }

  if (req.file) {
    updates.avatarUrl = '/uploads/avatars/' + req.file.filename;
  }

  const updatedUser = DB.updateUser(userId, updates);

  // Postlardagi avatarni yangilash uchun event
  io.emit('user_updated', {
    userId,
    username: updatedUser.username,
    avatarUrl: updatedUser.avatarUrl,
    fullName: `${updatedUser.firstName || ''} ${updatedUser.lastName || ''}`.trim() || updatedUser.username
  });

  return res.json({ success: true, user: updatedUser });
});

// 6. Username qidiruv (Chat bo'limi uchun)
app.get('/api/users/search', authMiddleware, (req, res) => {
  const { query } = req.query;
  const myId = req.session.userId;

  if (!query || !query.trim()) {
    return res.json({ users: [] });
  }

  const q = query.trim().toLowerCase();
  const all = DB.getAllUsers();
  const filtered = all
    .filter(u => u.id !== myId && (
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.firstName && u.firstName.toLowerCase().includes(q)) ||
      (u.lastName && u.lastName.toLowerCase().includes(q))
    ))
    .slice(0, 10);

  return res.json({ users: filtered });
});

// 7. Postlar (LinkedIn uslubidagi lenta)
app.get('/api/posts', authMiddleware, (req, res) => {
  const posts = DB.getAllPosts();
  const myId = req.session.userId;

  // Har bir postga muallif ma'lumotlari va isLiked holatini qo'shamiz
  const enriched = posts.map(p => {
    const author = DB.getUserById(p.userId) || {
      username: 'Noma\'lum',
      avatarUrl: '',
      firstName: '',
      lastName: ''
    };
    const isLiked = Array.isArray(p.likes) && p.likes.includes(myId);
    return {
      ...p,
      author: {
        id: author.id,
        username: author.username,
        fullName: `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username,
        avatarUrl: author.avatarUrl
      },
      likesCount: Array.isArray(p.likes) ? p.likes.length : 0,
      isLiked
    };
  });

  return res.json({ posts: enriched });
});

// Post chiqarish ("Chiqarish" tugmasi)
app.post('/api/posts/create', authMiddleware, upload.single('video'), (req, res) => {
  const userId = req.session.userId;
  const { caption } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Video fayli tanlanishi shart!' });
  }

  const post = {
    id: 'post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    userId,
    videoUrl: '/uploads/videos/' + req.file.filename,
    caption: caption ? caption.trim() : '',
    likes: [],
    createdAt: new Date().toISOString()
  };

  const created = DB.createPost(post);
  const author = DB.getUserById(userId);

  const postPayload = {
    ...created,
    author: {
      id: author.id,
      username: author.username,
      fullName: `${author.firstName || ''} ${author.lastName || ''}`.trim() || author.username,
      avatarUrl: author.avatarUrl
    },
    likesCount: 0,
    isLiked: false
  };

  // Yangi post haqida hammaga bildirish
  io.emit('new_post', postPayload);

  return res.json({ success: true, post: postPayload });
});

// Like bosish / bekor qilish
app.post('/api/posts/:id/like', authMiddleware, (req, res) => {
  const postId = req.params.id;
  const userId = req.session.userId;

  const result = DB.toggleLike(postId, userId);
  if (!result) {
    return res.status(404).json({ error: 'Post topilmadi' });
  }

  io.emit('post_liked', {
    postId,
    likesCount: result.likesCount
  });

  return res.json({ success: true, ...result });
});

// Foydalanuvchining o'z postlari (Profil gridi uchun: mobil 3, pc 6)
app.get('/api/posts/user/:userId', authMiddleware, (req, res) => {
  const targetUserId = req.params.userId;
  const posts = DB.getPostsByUserId(targetUserId);
  return res.json({ posts });
});

// 8. Chat va Taklifnomalar (Node.js + Socket.io)
app.post('/api/chat/invite', authMiddleware, (req, res) => {
  const fromUserId = req.session.userId;
  const { toUserId } = req.body;

  if (!toUserId || toUserId === fromUserId) {
    return res.status(400).json({ error: 'Noto\'g\'ri foydalanuvchi tanlandi' });
  }

  const sender = DB.getUserById(fromUserId);
  const recipient = DB.getUserById(toUserId);

  if (!recipient) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  }

  const invitation = DB.createInvitation(fromUserId, toUserId);

  // Narigi foydalanuvchiga bildirishnoma yuborish
  io.to(`user_${toUserId}`).emit('chat_invitation_received', {
    invitationId: invitation.id,
    fromUser: {
      id: sender.id,
      username: sender.username,
      fullName: `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.username,
      avatarUrl: sender.avatarUrl
    },
    createdAt: invitation.createdAt
  });

  return res.json({ success: true, invitation });
});

// Kutilayotgan takliflarni olish
app.get('/api/chat/invitations', authMiddleware, (req, res) => {
  const myId = req.session.userId;
  const pending = DB.getUserInvitations(myId);

  const enriched = pending.map(inv => {
    const sender = DB.getUserById(inv.fromUserId);
    return {
      ...inv,
      fromUser: sender ? {
        id: sender.id,
        username: sender.username,
        fullName: `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.username,
        avatarUrl: sender.avatarUrl
      } : null
    };
  });

  return res.json({ invitations: enriched });
});

// Taklifga javob berish (qabul qilish yoki rad etish)
app.post('/api/chat/respond-invite', authMiddleware, (req, res) => {
  const myId = req.session.userId;
  const { invitationId, action } = req.body; // action: 'accept' yoki 'reject'

  const inv = DB.getInvitationById(invitationId);
  if (!inv || inv.toUserId !== myId) {
    return res.status(404).json({ error: 'Taklif topilmadi' });
  }

  const newStatus = action === 'accept' ? 'accepted' : 'rejected';
  DB.updateInvitationStatus(invitationId, newStatus);

  if (newStatus === 'accepted') {
    const accepter = DB.getUserById(myId);
    // Taklif yuborgan odamga ham jonli xabar berish
    io.to(`user_${inv.fromUserId}`).emit('chat_invitation_accepted', {
      invitationId,
      byUser: {
        id: accepter.id,
        username: accepter.username,
        fullName: `${accepter.firstName || ''} ${accepter.lastName || ''}`.trim() || accepter.username,
        avatarUrl: accepter.avatarUrl
      }
    });
  }

  return res.json({ success: true, status: newStatus });
});

// Qabul qilingan suhbatdoshlar ro'yxati (kontaktlar)
app.get('/api/chat/contacts', authMiddleware, (req, res) => {
  const myId = req.session.userId;
  const accepted = DB.getAcceptedChats(myId);

  const contacts = accepted.map(chat => {
    const otherId = chat.fromUserId === myId ? chat.toUserId : chat.fromUserId;
    const otherUser = DB.getUserById(otherId);
    return {
      chatId: chat.id,
      user: otherUser ? {
        id: otherUser.id,
        username: otherUser.username,
        fullName: `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() || otherUser.username,
        avatarUrl: otherUser.avatarUrl
      } : null
    };
  }).filter(c => c.user !== null);

  return res.json({ contacts });
});

// Ikki kishi orasidagi xabarlarni olish
app.get('/api/chat/messages/:otherUserId', authMiddleware, (req, res) => {
  const myId = req.session.userId;
  const otherUserId = req.params.otherUserId;

  const messages = DB.getMessagesBetween(myId, otherUserId);
  return res.json({ messages });
});

// Xabar yuborish (Kafolatlangan REST API + Socket.io)
app.post('/api/chat/messages', authMiddleware, (req, res) => {
  const senderId = req.session.userId;
  const { receiverId, text } = req.body;

  if (!receiverId || !text || !text.trim()) {
    return res.status(400).json({ error: 'Xabar va qabul qiluvchi kiritilishi shart' });
  }

  const msg = DB.createMessage(senderId, receiverId, text.trim());

  // Socket orqali ikkala tomonga ham jonli uzatish
  io.to(`user_${receiverId}`).emit('receive_chat_message', msg);
  io.to(`user_${senderId}`).emit('receive_chat_message', msg);

  return res.json({ success: true, message: msg });
});

// 9. ADMIN PANEL API-lari
app.get('/api/admin/otps', adminMiddleware, (req, res) => {
  const otps = DB.getAllPendingOtps();
  return res.json({ otps });
});

app.get('/api/admin/users', adminMiddleware, (req, res) => {
  const users = DB.getAllUsers();
  return res.json({ users });
});

// Foydalanuvchini chiqarib yuborish (Kick / Delete)
app.delete('/api/admin/users/:id', adminMiddleware, (req, res) => {
  const targetId = req.params.id;
  const user = DB.getUserById(targetId);

  if (!user) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  }

  if (user.isAdmin) {
    return res.status(400).json({ error: 'Bosh adminni o\'chirib bo\'lmaydi' });
  }

  DB.deleteUser(targetId);

  // Agar u tizimda bo'lsa uni chiqarib yuborish signali
  io.to(`user_${targetId}`).emit('kicked_by_admin', {
    message: 'Sizning hisobingiz admin tomonidan chiqarib yuborildi.'
  });

  return res.json({ success: true, message: 'Foydalanuvchi muvaffaqiyatli o\'chirildi' });
});

// Maktab e'lonlari
app.get('/api/announcements', authMiddleware, (req, res) => {
  const announcements = DB.getAnnouncements();
  return res.json({ announcements });
});

app.post('/api/admin/announcements', adminMiddleware, (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Sarlavha va matn kiritilishi shart' });
  }

  const ann = {
    id: 'ann_' + Date.now(),
    title: title.trim(),
    content: content.trim(),
    createdAt: new Date().toISOString()
  };

  DB.addAnnouncement(ann);
  io.emit('new_announcement', ann);

  return res.json({ success: true, announcement: ann });
});

// ---------------- SOCKET.IO REAL-TIME BOG'LANISHI ---------------- //
io.on('connection', (socket) => {
  // Foydalanuvchi o'z xonasiga qo'shiladi
  socket.on('join_user', (userId) => {
    socket.join(`user_${userId}`);
  });

  // Admin o'z xonasiga qo'shiladi
  socket.on('join_admin', () => {
    socket.join('admin_room');
  });

  // Real-time xabar yuborish
  socket.on('send_chat_message', ({ senderId, receiverId, text }) => {
    if (!text || !text.trim()) return;

    const msg = DB.createMessage(senderId, receiverId, text.trim());

    // Qabul qiluvchiga va jo'natuvchiga yuborish
    io.to(`user_${receiverId}`).emit('receive_chat_message', msg);
    io.to(`user_${senderId}`).emit('receive_chat_message', msg);
  });
});

// Barcha boshqa yo'nalishlar uchun SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`Maktab Ijtimoiy Platformasi ishga tushdi:`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Admin email: ${ADMIN_EMAIL}`);
  console.log(`=========================================`);
});
