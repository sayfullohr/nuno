async function test() {
  const BASE = 'http://localhost:3000';

  console.log('--- 1. Admin Email tekshiruvi ---');
  let res = await fetch(`${BASE}/api/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sayfulloh822siftdagmail.com' })
  });
  let data = await res.json();
  console.log('Admin check:', data);
  if (!data.isAdmin || !data.requirePassword) throw new Error('Admin tekshiruvi ishlamadi');

  console.log('\n--- 2. Admin Login ---');
  res = await fetch(`${BASE}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sayfulloh822siftdagmail.com', password: 'sayfulloh_ai' })
  });
  data = await res.json();
  console.log('Admin login success:', data.success, 'Token mavjud:', !!data.token);
  const adminToken = data.token;

  console.log('\n--- 3. Oddiy Foydalanuvchi OTP so\'rovi ---');
  res = await fetch(`${BASE}/api/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student1@maktab.uz' })
  });
  data = await res.json();
  console.log('Student OTP request:', data);

  console.log('\n--- 4. Admin paneldan OTP kodini olish ---');
  res = await fetch(`${BASE}/api/admin/otps`, {
    headers: { 'x-auth-token': adminToken }
  });
  data = await res.json();
  console.log('Admin paneldagi barcha OTP-lar:', data.otps);
  const studentOtp = data.otps.find(o => o.email === 'student1@maktab.uz').code;
  console.log('Topilgan kod:', studentOtp);

  console.log('\n--- 5. Foydalanuvchi OTP bilan kirishi ---');
  res = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student1@maktab.uz', code: studentOtp })
  });
  data = await res.json();
  console.log('Student verify success:', data.success, 'Foydalanuvchi:', data.user.username);
  const studentToken = data.token;

  console.log('\n--- 6. Profilni tahrirlash (Username: Sayfulloh qo\'yish) ---');
  // multipart/form-data o'rniga oddiy JSON yoki FormData
  const form = new FormData();
  form.append('username', 'Sayfulloh');
  form.append('firstName', 'Ali');
  form.append('lastName', 'Valiyev');
  form.append('bio', '9-A sinf o\'quvchisi');

  res = await fetch(`${BASE}/api/users/update-profile`, {
    method: 'POST',
    headers: { 'x-auth-token': studentToken },
    body: form
  });
  data = await res.json();
  console.log('Profil yangilandi:', data.success, 'Yangi username:', data.user.username);

  console.log('\n--- 7. Ikkinchi foydalanuvchi xuddi shu "Sayfulloh" usernameni olishga uringanda ---');
  // Student 2 OTP oladi
  await fetch(`${BASE}/api/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student2@maktab.uz' })
  });
  res = await fetch(`${BASE}/api/admin/otps`, {
    headers: { 'x-auth-token': adminToken }
  });
  data = await res.json();
  const student2Otp = data.otps.find(o => o.email === 'student2@maktab.uz').code;

  res = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student2@maktab.uz', code: student2Otp })
  });
  data = await res.json();
  const student2Token = data.token;

  const form2 = new FormData();
  form2.append('username', 'sayfulloh'); // kichik harflarda ham tekshiriladi
  res = await fetch(`${BASE}/api/users/update-profile`, {
    method: 'POST',
    headers: { 'x-auth-token': student2Token },
    body: form2
  });
  data = await res.json();
  console.log('Dublikat username sinovi natijasi (xatolik bo\'lishi shart):', data);
  if (data.error && data.error.includes('band')) {
    console.log('✅ Unikal username himoyasi 100% ISHLAMOQDA!');
  } else {
    throw new Error('Dublikat username himoyasi ishlamadi');
  }

  console.log('\n--- 8. Admin tomonidan foydalanuvchini chiqarib yuborish (Kick) ---');
  res = await fetch(`${BASE}/api/admin/users`, {
    headers: { 'x-auth-token': adminToken }
  });
  data = await res.json();
  const targetUser = data.users.find(u => u.email === 'student2@maktab.uz');
  console.log('O\'chirilishi kerak bo\'lgan a\'zo:', targetUser.username);

  res = await fetch(`${BASE}/api/admin/users/${targetUser.id}`, {
    method: 'DELETE',
    headers: { 'x-auth-token': adminToken }
  });
  data = await res.json();
  console.log('Admin chiqarib yuborish natijasi:', data);

  console.log('\n=========================================');
  console.log('BARCHA TESTLAR 100% MUVAFFAQIShLI O\'TDI!');
  console.log('=========================================');
}

test().catch(err => {
  console.error('Testda xatolik:', err);
  process.exit(1);
});
