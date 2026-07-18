const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ================== CONFIG ==================
const STARTING_BALANCE = 10000;
const TRANSFER_FEE_RATE = 0.10;
const FLAG_PRICE = 100000000;
const MAX_ACCOUNTS = 300; // tăng lên vì server dùng chung cho nhiều người chơi cùng lúc
const ADMIN_PIN = '6363'; // 4 số - cố tình không có rate limit
const FLAG = process.env.FLAG || 'V1T{s70r3d_xss_pl0s_pin_bru73f0rc3_g6_wp}';

const ADMIN_USERNAME = '68686868';
const ADMIN_PASSWORD = 'l4m_sa0_m4_b3_du0c';

// ================== IN-MEMORY STORAGE ==================
let users = []; // { username, password, balance, isAdmin }
let sessions = {}; // token -> username
let transactions = []; // { from, to, amount, fee, content, time }

function seedAdmin() {
  users.push({
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
    balance: 0,
    isAdmin: true,
  });
}
seedAdmin();

// ================== APP SETUP ==================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ================== HELPERS ==================
function findUser(username) {
  return users.find(u => u.username === username);
}

function getNonAdminUsers() {
  return users.filter(u => !u.isAdmin);
}

// cố tình: cookie session KHÔNG httpOnly để phục vụ kịch bản XSS cướp cookie
function createSession(username) {
  const token = uuidv4();
  sessions[token] = username;
  return token;
}

function requireAuth(req, res, next) {
  const token = req.cookies.session;
  const username = token && sessions[token];
  const user = username && findUser(username);
  if (!user) return res.redirect('/');
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).send('Forbidden');
  next();
}

// ================== AUTH ROUTES ==================
app.get('/', (req, res) => {
  res.render('index');
});

// endpoint nhẹ để dùng cho keep-alive ping (chống Render free sleep)
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

app.get('/register', (req, res) => res.render('register', { error: null }));

app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password || username.trim() === '' || password.trim() === '') {
    return res.render('register', { error: 'Thiếu username hoặc password' });
  }

  if (findUser(username)) {
    return res.render('register', { error: 'Username đã tồn tại' });
  }

  // ===== CƠ CHẾ TỰ HỦY CHỐNG CÀY TIỀN =====
  // Khi số tài khoản người dùng (không tính admin) đạt giới hạn,
  // request tạo tài khoản kế tiếp sẽ xóa sạch toàn bộ tài khoản + session cũ.
  if (getNonAdminUsers().length >= MAX_ACCOUNTS) {
    users = users.filter(u => u.isAdmin); // giữ lại admin, xóa hết user thường
    sessions = {};
  }

  users.push({
    username,
    password,
    balance: STARTING_BALANCE,
    isAdmin: false,
  });

  res.redirect('/login');
});

app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = findUser(username);

  if (!user || user.password !== password) {
    return res.render('login', { error: 'Sai username hoặc password' });
  }

  const token = createSession(user.username);
  res.cookie('session', token, { httpOnly: false }); // cố tình: cho phép JS đọc cookie
  res.redirect(user.isAdmin ? '/admin' : '/dashboard');
});

app.get('/logout', (req, res) => {
  const token = req.cookies.session;
  if (token) delete sessions[token];
  res.clearCookie('session');
  res.redirect('/');
});

// ================== BANKING ROUTES ==================
app.get('/dashboard', requireAuth, (req, res) => {
  // Feed giao dịch toàn hệ thống - đây là nơi Stored XSS được render lại
  // cho bất kỳ ai xem trang này, kể cả Admin Bot.
  res.render('dashboard', {
    user: req.user,
    transactions: transactions.slice(-50).reverse(),
    error: null,
  });
});

app.post('/transfer', requireAuth, (req, res) => {
  const { to, amount, content } = req.body;
  const sender = req.user;
  const numAmount = Number(amount);

  const renderError = (msg) =>
    res.render('dashboard', {
      user: sender,
      transactions: transactions.slice(-50).reverse(),
      error: msg,
    });

  if (!to || !numAmount || isNaN(numAmount) || numAmount <= 0) {
    return renderError('Số tiền không hợp lệ');
  }

  const recipient = findUser(to);
  if (!recipient) return renderError('Người nhận không tồn tại');
  if (recipient.username === sender.username) return renderError('Không thể tự chuyển cho chính mình');

  const fee = Math.ceil(numAmount * TRANSFER_FEE_RATE);
  const total = numAmount + fee;

  if (sender.balance < total) return renderError('Số dư không đủ');

  sender.balance -= total;
  recipient.balance += numAmount;

  transactions.push({
    from: sender.username,
    to: recipient.username,
    amount: numAmount,
    fee,
    content: content || '',
    time: new Date().toISOString(),
  });

  res.redirect('/dashboard');
});

app.get('/buy-flag', requireAuth, (req, res) => {
  res.render('buy-flag', { user: req.user, flag: null, error: null, price: FLAG_PRICE });
});

app.post('/buy-flag', requireAuth, (req, res) => {
  const user = req.user;
  if (user.balance < FLAG_PRICE) {
    return res.render('buy-flag', { user, flag: null, error: 'Số dư không đủ để mua Flag', price: FLAG_PRICE });
  }
  user.balance -= FLAG_PRICE;
  res.render('buy-flag', { user, flag: FLAG, error: null, price: FLAG_PRICE });
});

// ================== ADMIN ROUTES ==================
app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  res.render('admin', { user: req.user, message: null });
});

// Cố tình: KHÔNG có rate limit / lockout cho việc kiểm tra PIN
app.post('/api/admin/mint-money', requireAuth, requireAdmin, (req, res) => {
  const { pin, targetUsername, amount } = req.body;

  if (pin !== ADMIN_PIN) {
    return res.json({ status: 'error', message: 'Invalid PIN' });
  }

  const target = findUser(targetUsername);
  const numAmount = Number(amount);

  if (!target || !numAmount || numAmount <= 0) {
    return res.json({ status: 'error', message: 'Invalid target or amount' });
  }

  target.balance += numAmount;
  return res.json({ status: 'success', newBalance: target.balance });
});

app.listen(PORT, () => {
  console.log(`Vulnerable Bank chạy tại http://localhost:${PORT}`);
  console.log(`Admin account: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
});
