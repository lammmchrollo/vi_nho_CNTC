# Bộ bảo vệ dự án — Ví Nhỏ

## 1. Demo trực tiếp 3 phút

### Chuẩn bị trước giờ trình bày

1. Dùng Node.js ≥ 22.15; chạy npm test và lưu output.
2. Chạy npm start; mở http://127.0.0.1:3000 bằng cửa sổ riêng.
3. Tắt extension có thể chặn cookie/script, tắt notification, zoom 100%.
4. Mở sẵn slide PDF và một ảnh/video fallback.
5. Không dùng dữ liệu cá nhân thật; reset/vào demo mới ngay trước lượt.

### Kịch bản và lời dẫn

**0:00–0:20 — Vào demo.** “Mỗi lần vào demo, hệ thống tạo không gian dữ liệu mẫu riêng. Đây không phải tài khoản mẫu dùng chung.” Chỉ vào tổng thu, tổng chi, ròng và tỷ lệ tiết kiệm.

**0:20–1:00 — Thay đổi dòng tiền.** Thêm một khoản thu; sau đó thêm khoản chi vào danh mục đã gần hạn mức. “Một bản ghi vừa làm thay đổi dashboard và trạng thái ngân sách. Giá trị tiền được lưu là số nguyên VND.” Chọn số làm trạng thái chuyển rõ near/over.

**1:00–1:30 — Mục tiêu.** Tạo hoặc mở mục tiêu quỹ dự phòng. “Mục tiêu biến ý định thành số đích, số đã tích lũy và mốc thời gian; ứng dụng không tự động chuyển tiền.”

**1:30–2:00 — Định kỳ/idempotency.** Chọn tháng và bấm sinh giao dịch định kỳ. Bấm lại lần hai. “Khóa rule + month khiến thao tác lặp không tạo bản sao. Đây là tính idempotent.” Xác nhận tổng không tăng lần hai.

**2:00–2:30 — Báo cáo/dự báo.** Mở báo cáo sáu tháng. “Dự báo là công thức theo quy tắc và dữ liệu hiện có, không phải AI. UI ghi rõ đây là ước lượng.”

**2:30–3:00 — Quyền dữ liệu.** Mở export CSV/JSON hoặc backup. “Backup chứa dữ liệu nghiệp vụ, không chứa password hash hay token phiên; restore kiểm tra schema trước khi commit.” Chốt: “Vòng lặp đã đi từ nhập liệu, persistence, tính toán tới quyết định.”

### Fallback khi demo lỗi

- Lỗi dưới 20 giây: refresh một lần, xác nhận server còn chạy.
- Vẫn lỗi: chuyển ngay PDF/ảnh/video; dùng test output chứng minh logic/API.
- Nói trung thực phần nào vừa lỗi và giới hạn bằng chứng; không tuyên bố đã chạy nếu không chạy.
- Không sửa code hoặc xóa database trên sân khấu.

## 2. Câu hỏi phản biện và câu trả lời ngắn

### 1. Tại sao đây là FinTech chứ không chỉ CRUD?

CRUD là phương tiện. Bài toán và quy tắc là tài chính: dòng tiền theo kỳ, số dư ròng, tỷ lệ tiết kiệm, ngân sách theo danh mục, mục tiêu, giao dịch định kỳ và dự báo. Công nghệ biến chúng thành vòng phản hồi có thể kiểm tra.

### 2. Điểm mới của Ví Nhỏ là gì?

Không tuyên bố thuật toán mới. Giá trị của prototype là tích hợp end-to-end, tiếng Việt/VND, dữ liệu thuộc người dùng, chạy cục bộ, dự báo giải thích được và ranh giới rõ với thanh toán/AI.

### 3. Vì sao không kết nối ngân hàng?

Kết nối làm tăng giá trị nhưng cũng tăng nghĩa vụ consent, security, đối tác và pháp lý. Prototype kiểm chứng vòng lặp quản lý trước; Open Banking chỉ vào roadmap sau khi có nhu cầu và legal/security gate.

### 4. Vì sao không dùng AI/ML?

Chưa có tập dữ liệu hợp pháp, đủ lớn, baseline và thước đo sai số. Rule-based dễ giải thích và phù hợp dữ liệu ít. Chỉ thử ML nếu thắng baseline theo MAE/MAPE đã đặt trước.

### 5. Dự báo được tính thế nào?

Với tháng hiện tại, hệ thống lấy chi đã ghi đến hôm nay, chia số ngày đã trôi qua rồi nhân số ngày trong tháng. Tháng cũ dùng thực tế; tháng tương lai không dự báo; chưa có chi thì trả “chưa đủ dữ liệu”. Kết quả không phải cam kết hay tư vấn đầu tư.

### 6. Tại sao dùng SQLite?

SQLite cho transaction, constraint và persistence trong một file, phù hợp demo/pilot một tiến trình. Nó không phải lựa chọn scale ngang; production nhiều instance cần migration sang managed database hoặc thiết kế khác.

### 7. node:sqlite có ổn định không?

Trong dòng Node 22, tài liệu vẫn đánh dấu experimental/active development. Prototype khóa Node ≥22.15 và test behavior. Trước production phải đánh giá phiên bản LTS/driver ổn định và migration.

### 8. Mật khẩu được bảo vệ thế nào?

Server dùng scrypt với salt ngẫu nhiên và không lưu mật khẩu rõ. Hiện có giới hạn 20 lần xác thực/10 phút/IP trong bộ nhớ. Production cần distributed/per-account throttling, breach response, recovery an toàn và có thể MFA.

### 9. Tại sao cookie HttpOnly/SameSite=Strict?

HttpOnly ngăn JavaScript đọc token; SameSite=Strict giảm gửi cookie từ ngữ cảnh chéo site. Chúng không thay TLS, XSS prevention hoặc threat model đầy đủ. Production thêm Secure cookie trên HTTPS.

### 10. Làm sao ngăn người A đọc dữ liệu người B?

Server suy ra user_id từ session và mọi truy vấn nghiệp vụ có điều kiện ownership. Client không được gửi user_id để tự chọn. Integration test dùng hai tài khoản để kiểm tra isolation.

### 11. Revision 409 giải quyết gì?

Hai tab có thể cùng đọc một phiên bản rồi cùng lưu. Nếu last-write-wins, thay đổi đầu bị mất. Server so revision; request cũ nhận 409 và tải lại.

### 12. Làm sao tránh giao dịch định kỳ bị nhân đôi?

Mỗi giao dịch sinh ra có idempotency key từ rule và tháng, được bảo vệ bởi kiểm tra/unique constraint. Gọi lại cùng thao tác không tạo thêm bản ghi.

### 13. Restore JSON có nguy hiểm không?

Có, nên file bị xem là input không tin cậy. Hệ thống giới hạn kích thước, kiểm tra version/schema/kiểu/miền/trùng ID, bỏ qua credential và chỉ commit trong transaction nếu toàn bộ hợp lệ.

### 14. Export CSV có thể gây spreadsheet injection không?

Text cần được quote/escape và vô hiệu hóa prefix công thức nguy hiểm khi mở bằng spreadsheet. Đây là ca kiểm thử/review bắt buộc; không nên coi CSV là “chỉ text” nên an toàn.

### 15. 21 test có đủ không?

Không. Con số hiện tại chứng minh một số rule và luồng API, không chứng minh production quality. Còn cần UI E2E, accessibility, load, security test, restore drill và usability study. Nếu suite đổi, phải báo số mới từ output thực tế.

### 16. Bảo vệ dữ liệu cá nhân theo luật nào?

Phân tích tham chiếu Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15, Luật Dữ liệu 60/2024/QH15 và các luật liên quan. Prototype không tự động “tuân thủ”; vận hành thật cần data inventory, notice, căn cứ xử lý, quyền chủ thể, security và legal review.

### 17. Ví Nhỏ có cần giấy phép trung gian thanh toán không?

Phạm vi hiện tại không giữ/chuyển tiền và không cung cấp dịch vụ trung gian thanh toán. Nếu thêm thanh toán hoặc stored value thì phải đánh giá lại theo Nghị định 52/2024/NĐ-CP và làm việc với đối tác/chuyên gia pháp lý trước khi triển khai.

### 18. Personas và nhu cầu lấy từ đâu?

Đó là proto-persona giả thuyết, không phải kết quả khảo sát. Bước tiếp theo là 5–8 usability interviews/sessions với consent phù hợp và báo cáo phương pháp.

### 19. Mức giá 29.000 và break-even 223 có thật không?

Không. Đó là kịch bản minh họa: fixed cost 6 triệu, contribution 27.000 nên 6 triệu/27.000 ≈ 223. Chưa gồm CAC, churn, thuế và lương dev; cần willingness-to-pay test.

### 20. Vì sao không dùng blockchain?

Không có nhiều bên không tin nhau cần đồng thuận trên sổ cái phân tán. Database thường đơn giản, riêng tư và hiệu quả hơn cho sổ cá nhân.

### 21. Nếu database hỏng thì sao?

Prototype có backup/export và transaction, nhưng production phải có backup tự động mã hóa, retention, kiểm tra integrity và restore drill với RPO/RTO rõ.

### 22. Nếu mất thiết bị?

Local prototype không giải quyết đầy đủ. Roadmap đa thiết bị cần cloud, recovery, MFA tùy rủi ro, revoke sessions và quy trình hỗ trợ có xác minh.

### 23. Tính khả thi thương mại thế nào?

Kỹ thuật khả thi ở pilot nhỏ; thị trường và kinh tế chưa kết luận. Cần chứng minh usability, retention, willingness-to-pay và chi phí tuân thủ trước khi gọi vốn hoặc mở rộng.

### 24. Hạn chế lớn nhất của bài là gì?

Chưa có nghiên cứu người dùng và vận hành production. Vì vậy báo cáo tách rõ những gì code chứng minh với những gì vẫn là giả thuyết.

## 3. Câu chốt theo loại câu hỏi

- **Kỹ thuật:** “Nguyên tắc là fail closed, ownership ở server và phép tính tập trung để test.”
- **Sản phẩm:** “Đây là giả thuyết; bước kiểm chứng rẻ nhất tiếp theo là …”
- **Kinh doanh:** “Con số là kịch bản, chưa phải traction.”
- **Pháp lý:** “Prototype không phải ý kiến tuân thủ; tính năng đó cần legal gate.”
- **Hạn chế:** “Nhóm chọn phạm vi này để có lát cắt end-to-end và nêu rõ roadmap.”
