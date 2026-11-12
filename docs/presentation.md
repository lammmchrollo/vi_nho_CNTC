# HỆ THỐNG QUẢN LÝ TÀI CHÍNH CÁ NHÂN

## Ví Nhỏ

**Problem → Solution → Technology → Demo → Business Value → Risk → Future**

[ĐIỀN HỌ TÊN / MSSV / LỚP]  
Học phần Financial Technology (FinTech)  
[ĐIỀN TRƯỜNG] · [ĐIỀN NGÀY]

<!-- SLIDE -->

# 1. Vấn đề: có giao dịch, chưa chắc có quyết định

- Sao kê cho biết **đã xảy ra gì**, nhưng không biết hạn mức cá nhân.
- Ghi chú nhanh nhưng không tổng hợp dòng tiền và mục tiêu.
- Bảng tính linh hoạt nhưng đòi hỏi tự dựng công thức và duy trì.
- Sinh viên/người mới đi làm có thể có thu nhập không đều và nhiều khoản nhỏ.

> Câu hỏi cần trả lời trong vài giây: tháng này thu–chi–ròng thế nào, danh mục nào sắp vượt, mục tiêu còn thiếu bao nhiêu?

**Bằng chứng hiện có:** giả thuyết thiết kế; chưa có khảo sát người dùng.

<!-- SLIDE -->

# 2. Người dùng giả thuyết & công việc cần làm

## Minh — sinh viên

- Trợ cấp + làm thêm, thời điểm nhận tiền không đều.
- Muốn nhập nhanh và biết còn bao nhiêu trước cuối tháng.

## Lan — người mới đi làm

- Lương cố định, thuê nhà/thuê bao lặp lại.
- Muốn theo dõi quỹ dự phòng và tránh ghi định kỳ trùng.

**Jobs-to-be-done:** ghi nhận → so với kế hoạch → điều chỉnh → mang dữ liệu đi.

<!-- SLIDE -->

# 3. Giải pháp: vòng lặp tài chính ngắn

## Ghi nhận → Tổng hợp → So sánh → Cảnh báo → Điều chỉnh

- Thu/chi theo VND và tháng.
- Ngân sách theo danh mục, cảnh báo từ 80%.
- Mục tiêu tiết kiệm có tiến độ.
- Giao dịch định kỳ chỉ tạo khi người dùng yêu cầu.
- Báo cáo sáu tháng và dự báo theo quy tắc giải thích được.
- CSV + JSON backup/restore + nhập dữ liệu v1.

**Không phải:** ví điện tử, thanh toán, tư vấn đầu tư hay AI/ML.

<!-- SLIDE -->

# 4. Prototype đã triển khai

| Nhóm | Chức năng |
|---|---|
| Danh tính | Register, login, logout, demo tách biệt |
| Dòng tiền | CRUD income/expense, dashboard thu–chi–ròng |
| Kế hoạch | Budgets, savings goals, recurring rules |
| Phân tích | 6-month reports, rule-based forecast |
| Quyền dữ liệu | CSV, JSON backup/restore, legacy v1 import |
| Toàn vẹn | Per-user ownership, revision conflict 409 |

**Nguyên tắc:** dữ liệu thật không trộn với demo; tiền là số nguyên VND.

<!-- SLIDE -->

# 5. Technology: nhỏ nhưng end-to-end

## Browser UI

HTML + CSS + JavaScript thuần

↓ JSON + revision

## Node.js ≥ 22.15

node:http · validation · auth · business rules

↓ prepared statements + transaction

## SQLite / node:sqlite

users · sessions · transactions · budgets · goals · recurring · audit

**Trade-off:** dễ chạy tại lớp; node:sqlite trên Node 22 còn experimental và SQLite không phải lựa chọn scale ngang.

<!-- SLIDE -->

# 6. Thiết kế tin cậy

- Mật khẩu: **scrypt + salt ngẫu nhiên**; không lưu plain text.
- Phiên: token opaque; cookie **HttpOnly + SameSite=Strict**.
- user_id lấy từ session; mọi query bị giới hạn theo chủ sở hữu.
- Input/client/restore đều không đáng tin: validate lại ở server.
- State revision: cập nhật cũ nhận **HTTP 409**, không last-write-wins.
- Transaction + constraint: restore và định kỳ không để trạng thái dở dang.

> Hiện có CSP, same-origin, loopback-host guard và IP limit 20 lần/10 phút. Production vẫn cần TLS, Secure cookie, distributed/account throttling, monitoring, backup drill và security review.

<!-- SLIDE -->

# 7. Demo 3 phút — kịch bản

1. **0:00–0:20** Vào demo: dữ liệu seed riêng, dashboard có thu–chi–ròng.
2. **0:20–1:00** Thêm thu và một khoản chi làm ngân sách chuyển near/over.
3. **1:00–1:30** Tạo mục tiêu tiết kiệm, xem tiến độ.
4. **1:30–2:00** Sinh định kỳ hai lần: lần hai không tạo bản sao.
5. **2:00–2:30** Xem báo cáo sáu tháng + dự báo có giải thích.
6. **2:30–3:00** Export JSON/CSV; nhắc restore có validation.

**Quan sát:** tổng/ròng đổi đúng; budget chuyển trạng thái; lần sinh định kỳ thứ hai không tăng tổng; reload vẫn còn dữ liệu; forecast ghi rõ là ước lượng.

**Thông điệp:** một thay đổi đi xuyên suốt form → DB → dashboard → quyết định. Fallback: PDF/ảnh + output test.

<!-- SLIDE -->

# 8. Business Value — giả thuyết cần kiểm chứng

## Người dùng

- Phản hồi sớm trước khi vượt chi.
- Kế hoạch và thực tế ở cùng một nơi.
- Có thể xuất và mang dữ liệu đi.

## Đối tác giáo dục

- Công cụ minh họa ngân sách trong workshop.
- Demo cục bộ, không cần liên kết ngân hàng.

## Mô hình giả thuyết

Freemium + premium 29.000 VND/tháng + chương trình giáo dục. **Chưa có doanh thu, conversion hay willingness-to-pay thực tế.**

<!-- SLIDE -->

# 9. Unit economics — chỉ là kịch bản

| Biến | Giả định minh họa |
|---|---:|
| Fixed cost/tháng | 6.000.000 VND |
| Giá premium | 29.000 VND |
| Variable cost/user | 2.000 VND |
| Contribution/user | 27.000 VND |
| Break-even | ≈ 223 paid users |

**Chưa gồm:** thuế, phí thanh toán, lương dev đầy đủ, CAC và churn.

Thử nghiệm tiếp theo: usability → landing-page intent → pilot workshop → mới quyết định cloud sync/tích hợp.

<!-- SLIDE -->

# 10. Rủi ro & kiểm soát

| Rủi ro ưu tiên | Kiểm soát / bước tiếp theo |
|---|---|
| Credential attack | scrypt + IP limit; production distributed/account limit, MFA |
| Cross-account access | ownership query + integration test |
| Mất/corrupt dữ liệu | transaction, backup; restore drill |
| Restore/CSV độc hại | schema, size limit, escaping |
| Recurring bị trùng | idempotency key + unique constraint |
| Forecast bị hiểu sai | nhãn ước lượng, công thức, giới hạn |
| SQLite quá tải | chỉ pilot nhỏ; managed DB khi scale |

**Rủi ro lớn nhất về sản phẩm:** xây nhiều trước khi chứng minh người dùng quay lại.

<!-- SLIDE -->

# 11. Regulation: biết rõ ranh giới

- Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 — hiệu lực 01/01/2026.
- Luật Dữ liệu 60/2024/QH15 — hiệu lực 01/07/2025.
- Luật Giao dịch điện tử 20/2023/QH15 và Luật BVQLNTD 19/2023/QH15.
- Nghị định 52/2024/NĐ-CP về thanh toán không dùng tiền mặt.

**Hiện tại:** sổ tài chính, không giữ/chuyển tiền, không tự gọi mình là ví điện tử được cấp phép.

**Nếu thêm Open Banking/thanh toán:** legal gate, consent, hợp đồng đối tác được phép, security/compliance review trước khi code.

<!-- SLIDE -->

# 12. Evaluation: chứng minh gì, chưa chứng minh gì?

## Đã có thể chứng minh

- Luồng end-to-end chạy cục bộ.
- Các quy tắc và API trọng yếu có thể kiểm thử.
- Persistence, isolation, idempotency, conflict handling có tiêu chí rõ.

## Chưa được chứng minh

- Product–market fit, willingness-to-pay, tác động tới tiết kiệm.
- Production security, accessibility audit, tải lớn.
- Độ chính xác forecast trên dữ liệu thật.

**Kết quả test đóng gói:** {{TEST_SUMMARY}}

<!-- SLIDE -->

# 13. Future: phát triển theo bằng chứng

1. Usability test 5–8 người → sửa luồng cốt lõi.
2. Pilot có TLS, backup, monitoring, privacy process.
3. Cloud sync + MFA nếu retention chứng minh nhu cầu.
4. Open Banking chỉ qua đối tác và legal/security gate.
5. ML chỉ khi có dữ liệu hợp pháp và thắng rule baseline theo MAE.

## Kết luận

**Ví Nhỏ không hứa quản lý tiền thay người dùng; sản phẩm giúp mỗi quyết định nhỏ có dữ liệu, giới hạn và lời giải thích.**

### Q&A

Source · Report · Demo · Test evidence
