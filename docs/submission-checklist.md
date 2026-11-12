# Checklist nộp bài — Ví Nhỏ

## A. Thông tin bắt buộc

- [ ] Thay [ĐIỀN TÊN TRƯỜNG], khoa/bộ môn, giảng viên, lớp, ngày nộp.
- [ ] Điền đầy đủ họ tên và MSSV của từng thành viên.
- [ ] Nếu là bài nhóm, thêm bảng phân công có bằng chứng commit/công việc; không bịa tỷ lệ.
- [ ] Kiểm tra tiêu đề đúng: **Hệ thống quản lý tài chính cá nhân**; thương hiệu **Ví Nhỏ**.

## B. Source và môi trường

- [ ] Dùng Node.js ≥ 22.15; ghi nhận cảnh báo experimental của node:sqlite là dự kiến.
- [ ] Từ thư mục gốc chạy npm test; mọi test pass.
- [ ] Chạy npm start và mở http://127.0.0.1:3000.
- [ ] Thử register, login, logout và demo trên máy sẽ trình chiếu.
- [ ] Không nộp database chứa dữ liệu cá nhân thật, cookie, secret hoặc file tạm.
- [ ] Kiểm tra file .gitignore/zip không chứa dữ liệu runtime không cần thiết.

## C. Bằng chứng test

- [ ] Cập nhật docs/test-evidence.json từ lần chạy cuối, không ghi số dự kiến.
- [ ] Lưu output npm test hoặc ảnh chụp rõ command + pass/fail.
- [ ] Manual smoke test desktop và viewport mobile.
- [ ] Thử hai tài khoản để kiểm tra isolation.
- [ ] Thử recurring hai lần và revision conflict/restore sai.

## D. Tài liệu

- [ ] Đọc lại docs/report.md; kiểm tra mọi tuyên bố “đã triển khai”.
- [ ] Kiểm tra persona, chi phí, giá và break-even đều có nhãn giả thuyết/minh họa.
- [ ] Chạy: python scripts/export-documents.py
- [ ] Xác nhận report.pdf có đúng 15 trang A4 và không tràn/cắt chữ.
- [ ] Xác nhận presentation.pdf/pptx có 14 slide 16:9 (1 bìa + 13 nội dung).
- [ ] Kiểm tra liên kết pháp lý và ngày truy cập.
- [ ] Không tuyên bố “đã tuân thủ pháp luật”; dùng “phân tích/định hướng, cần legal review”.

## E. Demo và slide

- [ ] Tập kịch bản docs/defense-kit.md trong đúng 3 phút.
- [ ] Tập toàn bộ bài 10–15 phút; dành 5 phút Q&A.
- [ ] Dữ liệu demo không chứa thông tin người thật.
- [ ] Có phương án fallback: PDF slide + ảnh/video demo + test output.
- [ ] Không debug quá 20 giây trên sân khấu; chuyển fallback.
- [ ] Chuẩn bị sạc, trình duyệt, zoom 100%, tắt notification.

## F. Gói nộp đề xuất

- [ ] README.md
- [ ] Source code + package.json/package-lock nếu có
- [ ] docs/report.pdf và report.docx
- [ ] docs/presentation.pptx và presentation.pdf
- [ ] docs/defense-kit.md, speaker-notes.md, diagrams.md
- [ ] Test evidence
- [ ] Link GitHub/web demo chỉ khi thực sự tồn tại và quyền truy cập đúng
- [ ] Video demo chỉ khi môn yêu cầu hoặc không thể demo trực tiếp

## G. Truy vết yêu cầu đề bài

| Yêu cầu | Artifact |
|---|---|
| Introduction / Problem | report trang 3–4, slide 2–3 |
| Proposed Solution | report trang 5, slide 4–5 |
| Technology | report trang 6, slide 6–7 |
| System Design | report trang 7–8, diagrams.md |
| Prototype / Demo | report trang 9, slide 8–9, defense-kit.md |
| Business Model | report trang 11–12, slide 10–11 |
| Security/Risk/Regulation | report trang 13–14, slide 12–13 |
| Evaluation / Discussion | report trang 10, slide 14 |
| Conclusion / Future | report trang 15, slide 14 |
| References | report trang 16 trong nguồn / trang cuối PDF theo bản xuất |

> Nếu số trang sau export khác bảng trên, dùng mục lục PDF thực tế. Nội dung và thứ tự quan trọng hơn số trang tham chiếu thủ công.
