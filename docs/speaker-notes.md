# Kịch bản thuyết trình Ví Nhỏ — 11 đến 13 phút

Mốc thời gian là gợi ý. Không đọc nguyên văn slide; dùng slide làm bằng chứng trực quan. Trước khi trình bày, thay toàn bộ placeholder danh tính và cập nhật kết quả npm test.

## Slide 1 — Mở đầu (0:00–0:35)

“Nhóm em chọn đề tài Hệ thống quản lý tài chính cá nhân. Sản phẩm tên Ví Nhỏ. Trong khoảng 12 phút, em sẽ đi từ một vấn đề rất cụ thể đến prototype, giá trị kinh doanh, rủi ro và bước phát triển. Đây là sổ tài chính cá nhân, không phải ví điện tử hay sản phẩm đầu tư.”

## Slide 2 — Vấn đề (0:35–1:25)

Nhấn mạnh khoảng cách giữa dữ liệu và quyết định. Sao kê là lịch sử; ngân sách là ý định; người dùng cần so hai thứ. Không nói “đa số sinh viên” vì chưa có khảo sát. Câu chuyển: “Vì chưa có nghiên cứu thực địa, nhóm biểu diễn đối tượng bằng proto-persona và coi đây là giả thuyết.”

## Slide 3 — Persona/JTBD (1:25–2:05)

Mô tả Minh và Lan trong một câu mỗi người. Tập trung công việc cần hoàn thành, không kể tiểu sử giả. Nêu rõ kế hoạch usability 5–8 người là bước tiếp theo.

## Slide 4 — Giải pháp (2:05–2:50)

Đi theo mũi tên vòng lặp. Một khoản chi không chỉ nằm trong bảng; nó làm dashboard, ngân sách và dự báo thay đổi. Nêu ba ranh giới: không chuyển tiền, không tư vấn đầu tư, không AI giả.

## Slide 5 — Prototype (2:50–3:35)

Chỉ lướt các nhóm tính năng. Điểm đáng bảo vệ là lát cắt end-to-end, tài khoản tách biệt, backup/restore và migration từ v1 — không phải số lượng màn hình.

## Slide 6 — Technology (3:35–4:25)

Giải thích browser → Node → SQLite. Node HTTP và node:sqlite giúp không cần dependency runtime. Nêu trade-off thẳng: hợp demo/pilot nhỏ, chưa phải scale ngang; node:sqlite trên Node 22 còn cảnh báo experimental.

## Slide 7 — Thiết kế tin cậy (4:25–5:15)

Giải thích user_id lấy từ session, không từ payload. Đưa ví dụ hai tab cùng sửa revision 12: tab sau nhận 409. Nêu localhost HTTP khác production HTTPS.

## Slide 8 — Demo 3 phút (5:15–8:15)

Thực hiện đúng checklist trong defense-kit. Luôn nói trước kết quả dự kiến rồi mới bấm. Nếu lỗi quá 20 giây, chuyển ảnh/video fallback, không debug trực tiếp trên sân khấu.

Kết demo bằng cách tóm lại những gì vừa quan sát: tính toán, trạng thái ngân sách, idempotency, persistence và backup. Đây là cầu nối sang business value.

## Slide 9 — Business value (8:15–9:00)

Tách “giá trị giả thuyết” với “bằng chứng”. Không nói sản phẩm giúp tiết kiệm X%. Mức 29.000 VND chỉ để kiểm tra kịch bản; chưa có doanh thu.

## Slide 10 — Unit economics (9:00–9:40)

Trình bày phép tính contribution 27.000 và 6 triệu / 27.000 ≈ 223. Nêu ngay các khoản chưa tính. Mục tiêu là chứng minh biết cách đặt giả định, không phải chứng minh công ty có lãi.

## Slide 11 — Risk (9:40–10:20)

Chọn ba rủi ro để nói: cross-account, data loss và forecast misinterpretation. Mỗi rủi ro đi cùng một kiểm soát hiện tại và một bước production.

## Slide 12 — Regulation (10:20–11:00)

Chỉ nêu ranh giới: dữ liệu cá nhân vẫn có nghĩa vụ; prototype không phải trung gian thanh toán. Nếu tích hợp ngân hàng/thanh toán phải có cổng pháp lý trước code. Tránh đưa kết luận “đã tuân thủ”.

## Slide 13 — Evaluation (11:00–11:35)

Nói điều đã chứng minh và chưa chứng minh. Đọc kết quả test từ bản đóng gói nhưng không đánh đồng test pass với product–market fit hoặc production readiness.

## Slide 14 — Future & kết luận (11:35–12:10)

Kết bằng roadmap theo bằng chứng: usability → pilot an toàn → sync → integration → ML. Câu chốt: “Ví Nhỏ giúp mỗi quyết định nhỏ có dữ liệu, giới hạn và lời giải thích.” Mời Q&A.

## Kiểm soát thời gian

- Nếu chỉ có 10 phút: rút slide persona còn 20 giây, demo 2 phút, gộp business + unit economics, mỗi risk/regulation 25 giây.
- Nếu có 15 phút: giữ demo 3 phút và thêm một ví dụ revision conflict hoặc restore sai.
- Q&A 5 phút: người trả lời lặp lại câu hỏi ngắn, đưa kết luận trước rồi mới giải thích.
