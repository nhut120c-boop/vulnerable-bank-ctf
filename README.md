# Vulnerable Bank - CTF Web Challenge

## Cài đặt

```bash
npm install
npm install puppeteer   # nếu muốn chạy admin bot
```

## Chạy server

```bash
npm start
# hoặc: FLAG='CTF{your_flag_here}' npm start
```

Server chạy tại `http://localhost:3000`.

## Chạy admin bot (giả lập admin duyệt trang mỗi 1 phút)

```bash
npm run bot
# hoặc: TARGET_URL=http://localhost:3000 node admin-bot.js
```

Bot sẽ tự đăng nhập bằng tài khoản admin và duyệt `/dashboard` mỗi 60 giây,
kích hoạt bất kỳ payload XSS nào bị lưu trong "Nội dung chuyển khoản".

## Thông tin tài khoản admin (đã seed sẵn)

- username: `68686868`
- password: `l4m_sa0_m4_b3_du0c`
- PIN mint tiền: `6363` (4 số, API không rate-limit)

## Attack path dự kiến

1. Người chơi tạo tài khoản thường, chuyển tiền cho ai đó với "Nội dung
   chuyển khoản" chứa payload XSS (ví dụ gửi cookie về webhook của họ).
2. Admin bot duyệt `/dashboard`, payload chạy trong session admin, đánh
   cắp cookie `session` (cookie không set `httpOnly`).
3. Người chơi thay cookie đó vào trình duyệt của họ, truy cập `/admin`.
4. Brute-force PIN 4 số qua `/api/admin/mint-money` (không rate limit)
   để tự bơm tiền vào tài khoản của mình.
5. Đủ 1,000,000 VND, vào `/buy-flag` để lấy flag.

## Lưu ý cơ chế chống cày tiền

Giới hạn 50 tài khoản thường (không tính admin). Khi tạo tài khoản thứ 51,
server sẽ xóa sạch toàn bộ tài khoản + session đã tạo trước đó rồi mới tạo
tài khoản mới - tránh việc spam tài khoản để gom 10,000 VND khởi tạo.
