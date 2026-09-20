const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Papka va faylni tekshirish / yaratish
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const defaultData = {
  users: [],
  posts: [],
  invitations: [],
  messages: [],
  activeOtps: {}, // email -> { code, createdAt }
  sessions: {}, // token -> sessionData (doimiy kirib turish uchun)
  schoolAnnouncements: []
};

function loadData() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Baza o\'qishda xatolik:', err);
    return defaultData;
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Baza yozishda xatolik:', err);
  }
}

// 6 xonali, bir-birini takrorlamaydigan raqamlardan iborat OTP yaratish
function generateUniqueDigitsOtp() {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  // Fisher-Yates shuffle
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  // 6 ta takrorlanmas raqamni olamiz
  return digits.slice(0, 6).join('');
}

const DB = {
  // Sessiyalarni doimiy saqlash (sahifa yangilansa ham chiqib ketmasligi uchun)
  saveSession(token, sessionData) {
    const data = loadData();
    if (!data.sessions) data.sessions = {};
    data.sessions[token] = sessionData;
    saveData(data);
    return sessionData;
  },

  getSession(token) {
    const data = loadData();
    if (!data.sessions) return null;
    return data.sessions[token] || null;
  },

  deleteSession(token) {
    const data = loadData();
    if (data.sessions && data.sessions[token]) {
      delete data.sessions[token];
      saveData(data);
    }
  },

  // OTP boshqaruvi
  createOtp(email) {
    const data = loadData();
    const code = generateUniqueDigitsOtp();
    data.activeOtps[email] = {
      code,
      createdAt: new Date().toISOString()
    };
    saveData(data);
    return code;
  },

  getOtp(email) {
    const data = loadData();
    return data.activeOtps[email] || null;
  },

  clearOtp(email) {
    const data = loadData();
    delete data.activeOtps[email];
    saveData(data);
  },

  getAllPendingOtps() {
    const data = loadData();
    return Object.entries(data.activeOtps).map(([email, info]) => ({
      email,
      code: info.code,
      createdAt: info.createdAt
    }));
  },

  // Foydalanuvchilar
  getUserByEmail(email) {
    const data = loadData();
    return data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  getUserById(id) {
    const data = loadData();
    return data.users.find(u => u.id === id);
  },

  getUserByUsername(username) {
    if (!username) return null;
    const data = loadData();
    return data.users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase().trim());
  },

  createUser(userData) {
    const data = loadData();
    data.users.push(userData);
    saveData(data);
    return userData;
  },

  updateUser(id, updateFields) {
    const data = loadData();
    const idx = data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      data.users[idx] = { ...data.users[idx], ...updateFields, updatedAt: new Date().toISOString() };
      saveData(data);
      return data.users[idx];
    }
    return null;
  },

  deleteUser(id) {
    const data = loadData();
    data.users = data.users.filter(u => u.id !== id);
    // foydalanuvchi postlarini ham tozalash
    data.posts = data.posts.filter(p => p.userId !== id);
    // takliflar va xabarlar
    data.invitations = data.invitations.filter(inv => inv.fromUserId !== id && inv.toUserId !== id);
    data.messages = data.messages.filter(m => m.senderId !== id && m.receiverId !== id);
    saveData(data);
    return true;
  },

  getAllUsers() {
    const data = loadData();
    return data.users;
  },

  // Postlar
  createPost(post) {
    const data = loadData();
    data.posts.unshift(post); // yangi postlar tepada turadi
    saveData(data);
    return post;
  },

  getAllPosts() {
    const data = loadData();
    return data.posts;
  },

  getPostsByUserId(userId) {
    const data = loadData();
    return data.posts.filter(p => p.userId === userId);
  },

  toggleLike(postId, userId) {
    const data = loadData();
    const post = data.posts.find(p => p.id === postId);
    if (!post) return null;

    if (!Array.isArray(post.likes)) {
      post.likes = [];
    }

    const index = post.likes.indexOf(userId);
    let isLiked = false;
    if (index === -1) {
      post.likes.push(userId);
      isLiked = true;
    } else {
      post.likes.splice(index, 1);
      isLiked = false;
    }
    saveData(data);
    return { post, isLiked, likesCount: post.likes.length };
  },

  // Takliflar (Chat taklifnomalari)
  createInvitation(fromUserId, toUserId) {
    const data = loadData();
    // Mavjud taklifni tekshirish
    const existing = data.invitations.find(
      inv => (inv.fromUserId === fromUserId && inv.toUserId === toUserId) ||
             (inv.fromUserId === toUserId && inv.toUserId === fromUserId)
    );
    if (existing) {
      return existing;
    }

    const newInv = {
      id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      fromUserId,
      toUserId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    data.invitations.push(newInv);
    saveData(data);
    return newInv;
  },

  getInvitationById(invId) {
    const data = loadData();
    return data.invitations.find(inv => inv.id === invId);
  },

  updateInvitationStatus(invId, status) {
    const data = loadData();
    const inv = data.invitations.find(i => i.id === invId);
    if (inv) {
      inv.status = status;
      inv.updatedAt = new Date().toISOString();
      saveData(data);
      return inv;
    }
    return null;
  },

  getUserInvitations(userId) {
    const data = loadData();
    return data.invitations.filter(inv => inv.toUserId === userId && inv.status === 'pending');
  },

  getAcceptedChats(userId) {
    const data = loadData();
    return data.invitations.filter(
      inv => (inv.fromUserId === userId || inv.toUserId === userId) && inv.status === 'accepted'
    );
  },

  // Xabarlar
  createMessage(senderId, receiverId, text) {
    const data = loadData();
    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      senderId,
      receiverId,
      text,
      createdAt: new Date().toISOString()
    };
    data.messages.push(msg);
    saveData(data);
    return msg;
  },

  getMessagesBetween(user1Id, user2Id) {
    const data = loadData();
    return data.messages.filter(
      m => (m.senderId === user1Id && m.receiverId === user2Id) ||
           (m.senderId === user2Id && m.receiverId === user1Id)
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  // Maktab e'lonlari
  addAnnouncement(announcement) {
    const data = loadData();
    data.schoolAnnouncements.unshift(announcement);
    saveData(data);
    return announcement;
  },

  getAnnouncements() {
    const data = loadData();
    return data.schoolAnnouncements;
  }
};

module.exports = DB;
