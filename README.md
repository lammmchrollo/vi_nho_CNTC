# Ví Nhỏ

Ứng dụng web quản lý tài chính cá nhân cho sinh viên. Giao diện tiếng Việt, tiền VND, dữ liệu lưu trong SQLite trên máy chủ chạy ứng dụng, tách riêng theo từng tài khoản.

## Tính năng chính

- Ghi thu/chi, có **nhập nhanh** kiểu ghi chú: `ăn trưa 35k`, `grab 50k hôm qua`, `+3tr lương`, `3/11 sách 120.000`.
- **Hôm nay bạn có thể chi**: thu − chi − khoản cố định sắp tới − phần dành cho mục tiêu, chia cho số ngày còn lại.
- Ngân sách theo danh mục (cảnh báo từ 80%), sao chép ngân sách từ tháng trước.
- Mục tiêu tiết kiệm với số tiền cần dành mỗi tháng.
- Giao dịch định kỳ, không bao giờ ghi trùng (kể cả khi bạn đã tự nhập khoản đó).
- Báo cáo 6 tháng, cơ cấu chi, **dự báo cuối tháng tách khoản cố định và chi linh hoạt**, cảnh báo danh mục chi cao bất thường.
- Xuất CSV, sao lưu/khôi phục JSON, đổi mật khẩu, xóa tài khoản. Sổ demo tự xóa sau 24 giờ.

## Chạy ứng dụng

Yêu cầu **Node.js 22.15 trở lên** (dùng `node:sqlite` có sẵn, không cần cài thư viện khi chạy).

```bash
npm start
```

Mở http://127.0.0.1:3000. Trên Windows có thể bấm đúp `start.cmd`.

Không mở trực tiếp `index.html` và không dùng `python -m http.server`: ứng dụng cần API của `server.js` để đăng nhập và lưu dữ liệu.

## Kiểm thử

```bash
npm test
```

Chạy 29 test: logic tài chính trong `model.test.js` và API/bảo mật trong `server.test.js`.

Kiểm thử giao diện bằng Playwright (tùy chọn, cần tải trình duyệt):

```bash
npm i
npx playwright install chromium
npm run test:e2e
```

## Demo trên lớp

1. Ở màn hình đăng nhập chọn **Khám phá với dữ liệu mẫu**. Tháng hiện tại có thu 8.500.000 ₫ (trợ cấp, làm thêm, học bổng) và 7 khoản chi, tổng 4.020.000 ₫.
2. Xem ô **Hôm nay bạn có thể chi** và mục **Góc nhìn tài chính**: ước tính cuối tháng, cảnh báo Ăn uống gần chạm hạn mức, Học tập chi cao bất thường.
3. Bấm **Thêm giao dịch**, gõ `ăn trưa 300k` vào ô Nhập nhanh rồi lưu. Ăn uống chuyển sang vượt hạn mức 60.000 ₫, tổng chi lên 4.320.000 ₫.
4. Vào **Giao dịch định kỳ** → **Ghi nhận tháng này**: không tạo thêm giao dịch vì trợ cấp và tiền phòng đã có.
5. Tải lại trang để thấy dữ liệu vẫn còn. Mở **Báo cáo & phân tích** để xem xu hướng 6 tháng và cách tính dự báo.
6. Muốn làm lại từ đầu: **Dữ liệu & tài khoản** → **Nạp dữ liệu mẫu**.

## Triển khai lên máy chủ

Mặc định máy chủ chỉ nghe ở `127.0.0.1` và chỉ chấp nhận tên miền localhost (chống DNS rebinding). Khi triển khai sau reverse proxy có HTTPS:

| Biến môi trường | Ý nghĩa | Ví dụ |
|---|---|---|
| `PORT` | Cổng lắng nghe | `3000` |
| `HOST` | Địa chỉ bind | `0.0.0.0` |
| `ALLOWED_HOSTS` | Tên miền được phép, cách nhau bằng dấu phẩy | `vinho.example.com` |
| `TRUST_PROXY` | `1` để tin `X-Forwarded-Proto/For` từ proxy (cookie Secure, rate limit theo IP thật) | `1` |
| `VN_DB_PATH` | Đường dẫn file SQLite | `/data/vinho.sqlite` |

## Cấu trúc

- `index.html`, `style.css`: khung giao diện, responsive laptop và điện thoại.
- `app.js`: điều hướng, form, biểu đồ, gọi API.
- `api.js`: lớp gọi `/api/*`.
- `model.js`: quy tắc tài chính thuần (kiểm tra dữ liệu, tổng hợp, ngân sách, dự báo, hạn mức chi mỗi ngày, cảnh báo bất thường, nhập nhanh).
- `server.js`: HTTP server, xác thực (scrypt, cookie HttpOnly), SQLite, kiểm soát xung đột bằng revision.
- `docs/`: báo cáo, slide, kịch bản bảo vệ. Chạy `python scripts/export-documents.py` để tạo bản HTML/PDF/DOCX.

## Giới hạn

Đây là prototype học tập: không kết nối ngân hàng, không thanh toán, không dùng AI. Dự báo và gợi ý là quy tắc minh bạch, không phải tư vấn tài chính.
