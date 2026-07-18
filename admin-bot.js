\// Admin Bot - giả lập hành vi của Admin
// Định kỳ đăng nhập/duyệt trang /dashboard để xem lịch sử giao dịch.
// Nếu người chơi chèn payload XSS vào "Nội dung chuyển khoản", payload
// sẽ được thực thi trong trình duyệt của bot này (có cookie session admin).

const puppeteer = require('puppeteer');

const TARGET_URL = process.env.TARGET_URL || `http://localhost:${process.env.PORT || 3000}`;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '68686868';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'l4m_sa0_m4_b3_du0c';
const VISIT_INTERVAL_MS = 60 * 1000; // mỗi 1 phút

async function login(page) {
  await page.goto(`${TARGET_URL}/login`, { waitUntil: 'networkidle2' });
  await page.type('input[name="username"]', ADMIN_USERNAME);
  await page.type('input[name="password"]', ADMIN_PASSWORD);
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle2' }),
  ]);
}

async function visitDashboard(page) {
  console.log(`[bot] ${new Date().toISOString()} - duyệt /dashboard`);
  await page.goto(`${TARGET_URL}/dashboard`, { waitUntil: 'networkidle2' });
  // chờ vài giây để bất kỳ script nào trong trang (kể cả payload XSS) kịp chạy
  await new Promise(r => setTimeout(r, 3000));
}

async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  try {
    await login(page);
    console.log('[bot] đăng nhập admin thành công, bắt đầu vòng lặp duyệt trang');
  } catch (e) {
    console.error('[bot] đăng nhập thất bại:', e.message);
    await browser.close();
    return;
  }

  setInterval(async () => {
    try {
      // kiểm tra lại session admin còn hợp lệ không, nếu bị đăng xuất thì login lại
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl === `${TARGET_URL}/`) {
        await login(page);
      }
      await visitDashboard(page);
    } catch (e) {
      console.error('[bot] lỗi trong vòng lặp:', e.message);
    }
  }, VISIT_INTERVAL_MS);
}

run();