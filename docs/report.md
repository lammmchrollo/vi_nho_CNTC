# HỆ THỐNG QUẢN LÝ TÀI CHÍNH CÁ NHÂN

## Ví Nhỏ — Báo cáo dự án cuối kỳ FinTech

**Trường:** [ĐIỀN TÊN TRƯỜNG]  
**Khoa/Bộ môn:** [ĐIỀN KHOA/BỘ MÔN]  
**Học phần:** Financial Technology (FinTech)  
**Giảng viên:** [ĐIỀN HỌ TÊN GIẢNG VIÊN]  
**Sinh viên/Nhóm:** [ĐIỀN HỌ TÊN]  
**Mã số sinh viên:** [ĐIỀN MSSV]  
**Lớp:** [ĐIỀN LỚP]  
**Ngày nộp:** [ĐIỀN NGÀY NỘP]

> Bản báo cáo này mô tả đúng phạm vi prototype trong mã nguồn. Các chân dung người dùng, quy mô thị trường và số liệu kinh doanh đều được ghi rõ là giả thuyết cần kiểm chứng; không được trình bày như kết quả khảo sát hay doanh thu thực tế.

**Phiên bản tài liệu:** 1.0 — 12/11/2026  
**Tên sản phẩm:** Ví Nhỏ  
**Chủ đề:** Hệ thống quản lý tài chính cá nhân

<!-- PAGE -->

# Tóm tắt điều hành

Ví Nhỏ là ứng dụng web quản lý tài chính cá nhân bằng tiếng Việt, hướng tới sinh viên và người mới đi làm. Bài toán trung tâm không phải là “thiếu một ứng dụng ghi chép”, mà là khoảng cách giữa dữ liệu giao dịch rời rạc và một quyết định tài chính có thể thực hiện ngay: tháng này đã chi bao nhiêu, khoản nào đang vượt hạn mức, mục tiêu tiết kiệm còn thiếu bao nhiêu, và nếu giữ nhịp chi hiện tại thì cuối tháng có thể ra sao.

Prototype hiện thực hóa một vòng lặp ngắn: **ghi nhận → tổng hợp → so sánh với kế hoạch → cảnh báo → điều chỉnh**. Người dùng có thể đăng ký hoặc đăng nhập, quản lý thu/chi, ngân sách theo danh mục, mục tiêu tiết kiệm và giao dịch định kỳ; xem báo cáo sáu tháng; tạo dự báo dựa trên quy tắc; xuất CSV, sao lưu/khôi phục JSON; và nhập dữ liệu từ phiên bản localStorage cũ. Chế độ demo tạo bộ dữ liệu riêng, giúp giảng viên xem ngay chức năng mà không làm lẫn dữ liệu giữa các tài khoản.

Giải pháp dùng Node.js 22.15+, HTTP server tích hợp và SQLite thông qua node:sqlite, không phụ thuộc package runtime bên ngoài. Mật khẩu được dẫn xuất bằng scrypt; phiên đăng nhập dùng token ngẫu nhiên trong cookie HttpOnly, SameSite=Strict; mọi bản ghi nghiệp vụ gắn với user_id. API trạng thái dùng revision để phát hiện cập nhật chồng lấn và trả 409 thay vì âm thầm ghi đè. Tiền được lưu dưới dạng số nguyên VND, tránh sai số dấu phẩy động.

Giá trị FinTech của dự án nằm ở việc biến các nguyên tắc ngân sách và dòng tiền thành quy tắc tính toán có thể kiểm tra, không ở việc chuyển tiền hoặc cung cấp tư vấn đầu tư. Prototype **không** kết nối ngân hàng, không giữ tiền, không thực hiện thanh toán và không dùng AI/ML. Open Banking, mô hình dự báo học máy, cloud đa vùng và ứng dụng di động chỉ là roadmap, không phải tính năng hiện tại.

## Cấu trúc báo cáo

1. Introduction  
2. Problem Statement  
3. Proposed FinTech Solution  
4. Related Technologies  
5. System Design  
6. Implementation / Prototype  
7. Business Model  
8. Security, Risk and Regulation  
9. Evaluation / Discussion  
10. Conclusion and Future Work  
11. References

## Tuyên bố phạm vi bằng chứng

- “Đã triển khai” chỉ dùng cho chức năng có trong repository và có thể trình diễn cục bộ.
- “Giả thuyết” dùng cho persona, mức giá, chi phí, tỷ lệ chuyển đổi và nhu cầu thị trường.
- “Roadmap” dùng cho kết nối ngân hàng, AI/ML, cloud production, MFA và ứng dụng di động.
- Số kiểm thử cuối cùng được lấy từ lần chạy npm test: **{{TEST_SUMMARY}}**.

<!-- PAGE -->

# 1. Introduction

## 1.1 Bối cảnh

Quản lý tài chính cá nhân là quá trình quan sát dòng tiền, thiết lập giới hạn, ưu tiên mục tiêu và điều chỉnh hành vi. Với sinh viên hoặc người mới đi làm, thu nhập có thể đến từ nhiều nguồn không đều nhau — trợ cấp, lương bán thời gian, học bổng — trong khi các khoản chi nhỏ xuất hiện thường xuyên. Sao kê ngân hàng cho biết giao dịch đã xảy ra nhưng thường không phản ánh mục tiêu cá nhân, hạn mức theo danh mục hoặc khoản tiền cần dành cho một mốc tương lai.

Dự án chọn một phạm vi có thể kiểm chứng: xây dựng sổ tài chính cá nhân giúp người dùng tự nhập hoặc nhập lại dữ liệu, xem dòng tiền theo tháng và nhận tín hiệu đơn giản để ra quyết định. Đây là công cụ hỗ trợ quản lý, không phải sản phẩm thanh toán, nhận tiền gửi, tín dụng hay tư vấn đầu tư.

## 1.2 Mục tiêu

- Cung cấp bức tranh tháng gồm tổng thu, tổng chi, số dư ròng và tỷ lệ tiết kiệm.
- Hỗ trợ CRUD giao dịch thu/chi với dữ liệu VND và ngày hợp lệ.
- Theo dõi ngân sách theo danh mục và cảnh báo khi gần hoặc vượt hạn mức.
- Theo dõi mục tiêu tiết kiệm và tiến độ định lượng.
- Quản lý giao dịch định kỳ nhưng chỉ sinh giao dịch khi người dùng chủ động yêu cầu; thao tác phải idempotent.
- Hiển thị xu hướng sáu tháng và dự báo theo quy tắc có thể giải thích.
- Bảo vệ dữ liệu giữa các tài khoản bằng xác thực, phiên và ràng buộc sở hữu.
- Cho phép người dùng mang dữ liệu đi qua CSV/JSON và khôi phục có kiểm tra.

## 1.3 Câu hỏi thiết kế

1. Làm sao giảm số bước từ ghi chép đến hành động tài chính?
2. Làm sao để kết quả tính toán minh bạch, kiểm thử được và không giả vờ là “AI”?
3. Làm sao giữ prototype đủ đơn giản để chạy tại lớp nhưng vẫn thể hiện nguyên tắc bảo mật và toàn vẹn dữ liệu?
4. Khi nào giải pháp chỉ là sổ cá nhân, và khi nào roadmap có thể làm phát sinh nghĩa vụ pháp lý mới?

## 1.4 Phạm vi và ngoài phạm vi

| Trong prototype | Ngoài phạm vi hiện tại |
|---|---|
| Web app chạy cục bộ, tài khoản và phiên | Chuyển tiền, ví điện tử, QR payment |
| SQLite theo từng người dùng | Đồng bộ ngân hàng/Open Banking |
| Thu/chi, ngân sách, mục tiêu, định kỳ | Chấm điểm tín dụng, đầu tư, cho vay |
| Báo cáo 6 tháng, dự báo theo quy tắc | AI/ML và khuyến nghị cá nhân tự động |
| CSV, JSON backup/restore, nhập v1 | Hạ tầng cloud production, SLA |

## 1.5 Phương pháp

Dự án theo hướng prototype kỹ thuật: xác định giả thuyết vấn đề; mô hình hóa use case và dữ liệu; triển khai lát cắt end-to-end; dùng dữ liệu mô phỏng; kiểm thử logic/API; đánh giá theo tiêu chí chấp nhận và phân tích rủi ro. Dự án chưa thực hiện nghiên cứu người dùng có tuyển mẫu; do đó không suy diễn persona thành bằng chứng thị trường.

<!-- PAGE -->

# 2. Problem Statement

## 2.1 Vấn đề cần giải quyết

Một người có thể nhớ từng khoản mua lẻ nhưng vẫn không trả lời nhanh bốn câu hỏi: “Tổng chi tháng này?”, “Danh mục nào lệch kế hoạch?”, “Số dư ròng đang dương hay âm?”, “Mục tiêu tiết kiệm có đúng tiến độ?”. Bảng tính có thể trả lời nhưng yêu cầu tự thiết kế công thức; sao kê có dữ liệu nhưng không chứa ngân sách cá nhân; ghi chú điện thoại nhanh nhưng không tổng hợp. Khoảng trống là một quy trình nhẹ, riêng tư, giải thích được và phù hợp VND.

## 2.2 Đối tượng mục tiêu — proto-persona, chưa xác thực

**Minh — sinh viên, 20 tuổi.** Thu nhập từ trợ cấp và việc làm bán thời gian, thời điểm nhận tiền không đều. Minh cần nhập nhanh, xem hạn mức ăn uống/di chuyển, và biết còn bao nhiêu trước cuối tháng. Rào cản giả định: ngại cấu hình phức tạp và không muốn cấp quyền tài khoản ngân hàng.

**Lan — nhân viên mới đi làm, 23 tuổi.** Có lương cố định, tiền thuê nhà và thuê bao lặp lại, muốn tạo quỹ dự phòng. Lan cần giao dịch định kỳ, mục tiêu tiết kiệm và xu hướng nhiều tháng. Rào cản giả định: sợ ghi trùng và lo dữ liệu tài chính cá nhân bị lộ.

**Lưu ý nghiên cứu:** hai persona trên là công cụ thiết kế. Chúng cần được kiểm chứng bằng phỏng vấn và usability test trước khi dùng để quyết định sản phẩm thương mại.

## 2.3 Jobs-to-be-done giả thuyết

- Khi vừa phát sinh giao dịch, tôi muốn ghi trong dưới một phút để dữ liệu không bị quên.
- Khi sắp mua một món không thiết yếu, tôi muốn biết danh mục đã dùng bao nhiêu để cân nhắc.
- Khi nhận lương hoặc trợ cấp, tôi muốn thấy số dư ròng và phân bổ cho mục tiêu.
- Khi sang tháng mới, tôi muốn tạo các khoản định kỳ đúng một lần.
- Khi đổi máy hoặc ngừng dùng, tôi muốn tải dữ liệu của mình xuống.

## 2.4 Nguyên nhân gốc và hệ quả

| Nguyên nhân giả thuyết | Hệ quả có thể xảy ra | Cách prototype tác động |
|---|---|---|
| Dữ liệu phân tán | Không có bức tranh dòng tiền | Một trạng thái tài chính thống nhất |
| Không đặt ngưỡng | Phát hiện vượt chi quá muộn | Cảnh báo 80% và vượt hạn mức |
| Khoản định kỳ bị quên | Ước lượng số dư sai | Mẫu định kỳ, sinh có chủ đích |
| Công cụ quá “thông minh” nhưng khó hiểu | Mất niềm tin vào gợi ý | Dự báo theo quy tắc, ghi rõ giả định |
| Khó mang dữ liệu đi | Phụ thuộc nền tảng | CSV và JSON backup/restore |

## 2.5 Tiêu chí thành công của prototype

Prototype thành công khi người dùng có thể hoàn tất vòng lặp: tạo tài khoản → thêm thu/chi → đặt ngân sách/mục tiêu → xem dashboard/báo cáo → sao lưu; dữ liệu của hai tài khoản không nhìn thấy nhau; reload không mất dữ liệu; tạo định kỳ lặp lại không sinh bản sao; dữ liệu restore sai bị từ chối có thông báo; cập nhật revision cũ nhận 409.

<!-- PAGE -->

# 3. Proposed FinTech Solution

## 3.1 Tuyên bố giải pháp

**Ví Nhỏ biến dữ liệu thu/chi do người dùng kiểm soát thành dashboard, giới hạn và tín hiệu hành động có thể giải thích.** Giá trị cốt lõi là phản hồi nhanh và tính minh bạch, không phải tự động hóa mọi quyết định.

## 3.2 Chức năng đã triển khai

| Nhóm | Khả năng | Giá trị tài chính |
|---|---|---|
| Danh tính | Đăng ký, đăng nhập, đăng xuất, demo tách biệt | Cá nhân hóa và cô lập dữ liệu |
| Giao dịch | Thêm/sửa/xóa thu và chi | Sổ dòng tiền hai chiều |
| Dashboard | Thu, chi, ròng, tỷ lệ tiết kiệm | Kiểm tra “sức khỏe” tháng |
| Ngân sách | Hạn mức theo tháng/danh mục | Kiểm soát chi trước khi quá muộn |
| Mục tiêu | Số đích, số đã tích lũy, hạn | Biến ý định tiết kiệm thành tiến độ |
| Định kỳ | Mẫu và tạo giao dịch theo tháng, idempotent | Giảm quên và tránh trùng |
| Phân tích | Báo cáo 6 tháng, cơ cấu, dự báo quy tắc | Nhận biết xu hướng, không dùng hộp đen |
| Quyền dữ liệu | CSV, backup/restore JSON, nhập v1 | Khả chuyển và khả phục hồi |

## 3.3 Luồng sử dụng chính

1. Người dùng đăng ký hoặc vào demo. Mỗi phiên nhận một cookie không cho JavaScript đọc.
2. Ứng dụng tải trạng thái của đúng tài khoản và revision hiện tại.
3. Người dùng ghi khoản thu/chi; dashboard tính lại tổng, ròng và tiết kiệm.
4. Người dùng đặt ngân sách và mục tiêu; hệ thống so sánh thực tế với kế hoạch.
5. Khi cần, người dùng yêu cầu sinh giao dịch định kỳ cho tháng được chọn. Cùng một mẫu và tháng không tạo lần hai.
6. Người dùng xem báo cáo sáu tháng và dự báo; mọi kết quả kèm giải thích quy tắc.
7. Khi cập nhật, client gửi revision đã đọc. Nếu trạng thái trên server đã đổi, API trả 409 để tải lại thay vì ghi đè.
8. Người dùng có thể xuất dữ liệu hoặc khôi phục một backup đã qua xác thực cấu trúc.

## 3.4 Nguyên tắc sản phẩm

- **Local-first cho demo, ownership-first cho dữ liệu:** chạy trên máy cá nhân nhưng vẫn tách bản ghi theo tài khoản.
- **Explicit over magical:** thao tác định kỳ và restore cần hành động rõ ràng; dự báo ghi giả định.
- **Integer money:** VND là số nguyên, không dùng float cho giá trị tiền.
- **Fail closed:** dữ liệu không hợp lệ, phiên hết hạn hoặc revision cũ không được âm thầm chấp nhận.
- **No fake AI:** công thức dự báo được mô tả là quy tắc, không gắn nhãn AI/ML.

## 3.5 Điểm khác biệt trong phạm vi bài tập

Ví Nhỏ không cạnh tranh bằng số lượng tích hợp. Điểm khác biệt của prototype là một lát cắt đầy đủ từ mô hình tài chính đến persistence, xác thực và phục hồi dữ liệu; có thể chạy không cần cloud; UI tiếng Việt/VND; và có ranh giới pháp lý rõ giữa sổ tài chính với dịch vụ thanh toán.

<!-- PAGE -->

# 4. Related Technologies

## 4.1 Lựa chọn công nghệ

| Thành phần | Lựa chọn | Lý do gắn với bài toán |
|---|---|---|
| Client | HTML, CSS, JavaScript thuần | Khởi động nhanh, dễ kiểm tra, không cần build tool |
| Server | Node.js ≥ 22.15, node:http | Một tiến trình nhỏ phục vụ static và API |
| Database | SQLite qua node:sqlite | Giao dịch ACID, file cục bộ, phù hợp demo đơn máy |
| Mật khẩu | crypto.scrypt + salt ngẫu nhiên | Dẫn xuất khóa tốn tài nguyên, không lưu mật khẩu rõ |
| Phiên | Token ngẫu nhiên, cookie HttpOnly/SameSite=Strict | Giảm lộ token cho script và gửi chéo site |
| Kiểm thử | node:test | Có sẵn trong Node, chạy bằng npm test |

node:sqlite được đưa vào Node từ 22.5.0 và ở nhánh Node 22 vẫn được tài liệu đánh dấu đang phát triển/experimental [R6]. Vì vậy Node 22.15 là yêu cầu chạy tối thiểu của prototype và cảnh báo experimental là điều dự kiến, không phải lỗi nghiệp vụ. Nếu đưa lên production, cần khóa phiên bản runtime, kiểm thử migration và cân nhắc driver/database có mức ổn định phù hợp hơn.

## 4.2 Kiến trúc tổng quát

~~~mermaid
flowchart LR
  U[Người dùng] -->|HTTPS trong production / HTTP localhost| B[Web UI]
  B -->|JSON + revision| H[Node HTTP server]
  H --> A[Auth & session]
  H --> V[Validation & business rules]
  A --> D[(SQLite)]
  V --> D
  H --> X[CSV / JSON export]
~~~

**Diễn giải chữ:** trình duyệt không truy cập SQLite trực tiếp. Node server phục vụ giao diện, xác thực cookie, kiểm tra input, áp quy tắc sở hữu và dùng prepared statements để đọc/ghi SQLite. Export là kết quả từ dữ liệu đã lọc theo người dùng. Localhost dùng HTTP; triển khai thật bắt buộc có TLS ở reverse proxy hoặc nền tảng hosting.

## 4.3 Công nghệ tài chính, không chỉ công nghệ web

- **Dòng tiền:** tổng thu, tổng chi và ròng được tính theo kỳ tháng.
- **Tỷ lệ tiết kiệm:** dùng phần ròng so với thu; trường hợp thu bằng 0 phải hiển thị trạng thái có nghĩa, không chia cho 0.
- **Ngân sách:** mức sử dụng bằng chi danh mục / hạn mức; cảnh báo từ 80%, vượt khi lớn hơn 100%.
- **Mục tiêu:** tiến độ bằng số tích lũy / số mục tiêu, chặn giá trị âm hoặc vượt miền cho phép.
- **Dự báo quy tắc:** với tháng hiện tại, ngoại suy chi đã ghi đến hôm nay theo số ngày đã trôi qua; nếu chưa có chi thì trả “chưa đủ dữ liệu”, không tạo số 0 gây hiểu nhầm.

## 4.4 Các lựa chọn không dùng

Không dùng blockchain vì không có bài toán nhiều bên cần sổ cái phân tán. Không dùng ML vì không có tập dữ liệu huấn luyện, baseline và phép đo sai số. Không dùng cloud để giữ demo tái lập cục bộ. Việc không dùng công nghệ “thời thượng” là quyết định thiết kế có chủ đích; roadmap chỉ bổ sung khi có vấn đề và bằng chứng tương ứng.

<!-- PAGE -->

# 5. System Design

## 5.1 Use case

~~~mermaid
flowchart TB
  Guest((Khách)) --> Register[Đăng ký]
  Guest --> Login[Đăng nhập]
  Guest --> Demo[Vào demo]
  User((Người dùng)) --> Tx[Quản lý thu/chi]
  User --> Budget[Quản lý ngân sách]
  User --> Goal[Quản lý mục tiêu]
  User --> Recurring[Quản lý & sinh định kỳ]
  User --> Report[Xem báo cáo/dự báo]
  User --> Export[Xuất CSV/JSON]
  User --> Restore[Khôi phục/nhập v1]
  Login --> User
  Register --> User
  Demo --> User
~~~

**Điều kiện chung:** use case nghiệp vụ yêu cầu phiên hợp lệ. Server lấy user_id từ phiên, không tin user_id do client gửi. Demo cũng là một không gian dữ liệu riêng được seed mới, không dùng chung tài khoản mẫu toàn cục.

## 5.2 Luồng dữ liệu mức 1

~~~mermaid
flowchart LR
  P[Người dùng] -->|form/action| UI[Web UI]
  UI -->|GET /api/state| API[API]
  API -->|kiểm tra session| S[(sessions/users)]
  API -->|đọc theo user_id| F[(financial tables)]
  F --> API -->|state + revision| UI
  UI -->|PUT /api/state + revision| API
  API -->|validate + transaction| F
  API -->|200 revision mới / 409 conflict| UI
~~~

**Biên tin cậy:** mọi dữ liệu từ browser và file restore là không tin cậy. Validation lặp ở server dù client đã có constraint. Database là nguồn sự thật. File JSON chỉ là bản sao trao đổi, không được phép ghi trực tiếp vào bảng nếu chưa kiểm tra version, kiểu, miền giá trị và tham chiếu.

## 5.3 Quy tắc nghiệp vụ chính

1. Số tiền/hạn mức/mục tiêu là số nguyên dương trong giới hạn hệ thống.
2. Ngày theo định dạng ISO YYYY-MM-DD và phải là ngày lịch hợp lệ.
3. Danh mục nằm trong danh sách cho phép; loại giao dịch chỉ là income hoặc expense.
4. Mỗi ngân sách là duy nhất theo user + month + category.
5. Giao dịch định kỳ là duy nhất theo user + recurring rule + target month.
6. Mọi truy vấn update/delete phải kèm điều kiện user_id.
7. Restore là all-or-nothing trong transaction; lỗi bất kỳ sẽ rollback.
8. Revision tăng sau thay đổi trạng thái; revision cũ trả HTTP 409.

## 5.4 Trạng thái và xung đột

Client không được giả định mình là cửa sổ duy nhất. Ví dụ hai tab cùng đọc revision 12. Tab A lưu và nhận revision 13; tab B gửi bản sửa dựa trên 12. Server trả 409, tab B phải tải lại và cho người dùng thực hiện lại quyết định trên dữ liệu mới. Cách này ưu tiên không mất cập nhật hơn sự tiện lợi “last write wins”.

<!-- PAGE -->

# 5. System Design — dữ liệu và API

## 5.5 Mô hình quan hệ

~~~mermaid
erDiagram
  USERS ||--|| WALLET_META : owns
  USERS ||--o{ SESSIONS : has
  USERS ||--o{ TRANSACTIONS : owns
  USERS ||--o{ BUDGETS : owns
  USERS ||--o{ GOALS : owns
  USERS ||--o{ RECURRING : owns
  USERS ||--o{ AUDIT : creates
  RECURRING ||--o{ TRANSACTIONS : generates
  USERS {
    string id PK
    string email UK
    string password_hash
    string password_salt
  }
  WALLET_META {
    string user_id PK_FK
    integer revision
    integer demo
  }
  TRANSACTIONS {
    string id PK
    string user_id PK_FK
    string date
    string type
    integer amount_vnd
    string category
  }
  BUDGETS {
    string user_id PK_FK
    string month
    string category
    integer cap_vnd
  }
~~~

**Bảng cốt lõi:** users lưu danh tính; wallet_meta lưu revision và cờ demo theo user; sessions lưu hash token và hạn; transactions lưu thu/chi; budgets lưu hạn mức; goals lưu đích/tiến độ; recurring lưu mẫu lặp; audit lưu action/thời điểm. ID người dùng là UUID dạng TEXT. Giao dịch định kỳ liên kết logic bằng ID xác định rec-{ruleId}-{month}, không có khóa ngoại recurring trong transactions. Khóa ngoại và khóa chính ghép bảo vệ toàn vẹn bên cạnh validation JavaScript.

## 5.6 Hợp đồng API mức cao

| Hành vi | Dữ liệu vào | Thành công | Lỗi có chủ đích |
|---|---|---|---|
| Đăng ký/đăng nhập | email, password | cookie phiên, hồ sơ tối thiểu | 400/401/409 |
| GET /api/state | cookie | state của đúng user + revision | 401 |
| PUT /api/state | cookie, revision, state đã chỉnh | state/revision mới | 400, 401, 409 |
| Đăng xuất | cookie | hủy phiên, xóa cookie | luôn an toàn để lặp |
| Export/restore | cookie, format/payload | file hoặc state mới | 400/413/409 |

API trạng thái nguyên khối là thỏa hiệp phù hợp prototype: client đơn giản và việc backup tự nhiên. Hạn chế là payload lớn và xung đột ở mức toàn trạng thái. Roadmap production nên tách endpoint theo tài nguyên, dùng ETag/If-Match hoặc revision theo thực thể, pagination và audit chi tiết.

## 5.7 Kiểm soát dữ liệu

- Prepared statements và binding thay vì nối chuỗi SQL.
- Foreign keys, unique constraints và transaction cho thao tác nhiều bảng.
- HTTP body bị giới hạn 2 MiB; model giới hạn tối đa 10.000 giao dịch và 1.000 bản ghi cho từng tập ngân sách, mục tiêu, định kỳ; JSON sai bị từ chối.
- Export chỉ lấy bản ghi có user_id từ session hiện tại.
- Không trả password hash, salt hay session token trong API state/backup.
- Audit không lưu mật khẩu hoặc toàn bộ payload tài chính nếu không cần thiết.

<!-- PAGE -->

# 6. Implementation / Prototype

## 6.1 Cấu trúc thực thi

- server.js: HTTP server, static files, API, cookie và security headers.
- database.js: schema/migration, prepared statements, transaction và ownership.
- model.js: quy tắc thuần cho validation, tổng hợp, ngân sách, mục tiêu, dự báo.
- app.js: trạng thái UI, gọi API, form/dialog, render dashboard và import/export.
- index.html và style.css: cấu trúc semantic, responsive, trạng thái focus.
- Các tệp test: unit cho model và integration cho auth/API/isolation/persistence.

Tên tệp có thể được tổ chức khác trong repository; danh sách trên diễn giải trách nhiệm kiến trúc, không phải cam kết framework.

## 6.2 Luồng xác thực

Khi đăng ký, server chuẩn hóa email, kiểm tra password theo chính sách tối thiểu, tạo salt ngẫu nhiên và dẫn xuất bằng scrypt. Khi đăng nhập đúng, server tạo token ngẫu nhiên đủ entropy, lưu đại diện an toàn ở bảng sessions và đặt cookie HttpOnly, SameSite=Strict, Path=/, Max-Age phù hợp. Secure chỉ bật khi chạy HTTPS; localhost HTTP không thể cung cấp bảo đảm truyền dẫn của production. Đăng xuất vô hiệu hóa session phía server và xóa cookie.

## 6.3 Tính toán và trình bày

Dashboard lọc giao dịch theo tháng rồi tính income, expense, net = income − expense. Tỷ lệ tiết kiệm được trình bày cùng điều kiện biên. Ngân sách tổng hợp chi theo danh mục; trạng thái normal/near/over dựa trên ngưỡng. Báo cáo sáu tháng dùng cùng hàm tổng hợp để tránh mỗi màn hình có một định nghĩa khác nhau.

Dự báo là rule-based. Với tháng đang diễn ra, hệ thống lấy chi đã ghi đến ngày hiện tại, chia số ngày đã trôi qua và nhân số ngày của tháng. Tháng quá khứ hiển thị thực tế; tháng tương lai không tạo dự báo. Nếu tháng hiện tại chưa có khoản chi, UI trả “chưa đủ dữ liệu” thay vì 0. Kết quả là ước lượng, không phải lời khuyên tài chính; dữ liệu ít hoặc đầu tháng có độ tin cậy thấp.

## 6.4 Định kỳ idempotent

Người dùng chọn tháng và bấm tạo. Model tạo ID xác định rec-{ruleId}-{month}; validation chặn ID giao dịch trùng và khóa chính (user_id, id) bảo vệ thêm ở SQLite. Bấm lại không tạo bản sao. Không có cron âm thầm chạy trong prototype, nhờ đó demo tái lập và người dùng kiểm soát thời điểm ghi sổ.

## 6.5 Khả chuyển và phục hồi

- CSV phục vụ phân tích bảng tính; cột được định nghĩa ổn định và dữ liệu text được escape.
- JSON backup có version và toàn bộ trạng thái nghiệp vụ, không chứa bí mật xác thực.
- Restore kiểm tra version, schema, ngày, số tiền, danh mục, trùng ID và giới hạn kích thước trước khi transaction.
- Import legacy v1 đọc localStorage cũ, xác thực, sau đó đưa về mô hình mới; dữ liệu gốc không bị xóa tự động.

## 6.6 Kịch bản demo 3 phút

Đăng nhập demo → xem dashboard → thêm một khoản thu và một khoản chi làm ngân sách vượt ngưỡng → tạo mục tiêu → sinh định kỳ hai lần để chứng minh không trùng → xem báo cáo sáu tháng/dự báo → export JSON. Kịch bản chi tiết nằm ở docs/defense-kit.md.

<!-- PAGE -->

# 9. Evaluation / Discussion

## 9.1 Ma trận tiêu chí chấp nhận

| ID | Tiêu chí quan sát được | Trạng thái tài liệu |
|---|---|---|
| A01 | Đăng ký tạo ví v2 rỗng, login sai bị từ chối, logout hủy phiên | Đã có API test |
| A02 | Hai tài khoản và hai phiên demo có ví riêng | Đã có API isolation test |
| A03 | CRUD income và expense, reload vẫn còn | Có thể demo |
| A04 | Tổng thu/chi/ròng đúng với dữ liệu gốc | Đã có unit test + demo |
| A05 | Ngân sách cảnh báo từ 80%, vượt trên 100% | Đã có unit test + demo |
| A06 | Mục tiêu hiển thị tiến độ và điều kiện biên | Đã có unit test + demo |
| A07 | Sinh định kỳ hai lần không tạo trùng | Đã có unit test + demo |
| A08 | Báo cáo chứa đúng sáu tháng, kể cả biên năm 2000 | Đã có unit test + demo |
| A09 | Dự báo ghi rõ quy tắc, không gắn nhãn ML | Review UI |
| A10 | Revision cũ nhận 409, không ghi đè | Đã có API test |
| A11 | State sai bị từ chối; body trên 2 MiB bị chặn | Đã có API test; restore cần manual smoke |
| A12 | CSV vô hiệu hóa công thức; backup không có hash/token | Unit test + review |
| A13 | Legacy v1 nhập được và không tự xóa nguồn | Đã có unit test + demo |
| A14 | SQLite giữ dữ liệu sau restart | Đã có API persistence test |
| A15 | Luồng bàn phím, focus, mobile dùng được | Manual/browser QA |

## 9.2 Bằng chứng kiểm thử

Lệnh chuẩn là npm test. Kết quả đóng gói: **{{TEST_SUMMARY}}**. Không điền số test dự kiến vào báo cáo; chỉ cập nhật từ output cuối cùng và giữ log/chụp màn hình trong hồ sơ nộp. Ngoài automated test, cần manual smoke test trên Chrome/Edge ở desktop và viewport mobile.

## 9.3 Đánh giá theo chất lượng

**Correctness:** các phép tính tài chính tập trung trong model thuần, thuận lợi kiểm thử. **Integrity:** transaction, constraint và revision giảm dữ liệu dở dang/mất cập nhật. **Privacy:** sở hữu theo user và export có chủ đích. **Portability:** runtime tối thiểu, không package runtime ngoài; đổi lại phụ thuộc node:sqlite experimental. **Usability:** ngôn ngữ Việt, VND, demo seed; chưa có usability test với người thật. **Scalability:** phù hợp một máy hoặc pilot nhỏ; HTTP server đồng bộ và SQLite một file chưa phải kiến trúc scale ngang.

## 9.4 Hạn chế đánh giá

- Chưa có khảo sát/phỏng vấn nên chưa chứng minh pain point hoặc willingness-to-pay.
- Dữ liệu mẫu không đại diện hành vi tài chính thật.
- Chưa có benchmark tải, pen test, accessibility audit độc lập hoặc disaster-recovery drill.
- Không có kết nối ngân hàng nên phụ thuộc tính đều đặn khi nhập dữ liệu.
- Dự báo quy tắc chưa có backtest và thước đo MAE/MAPE.

## 9.5 Thiết kế vòng kiểm chứng tiếp theo

Thực hiện 5–8 usability sessions theo nhiệm vụ cố định; đo completion, time-on-task, error và câu hỏi hiểu biết. Chạy pilot opt-in 4 tuần với retention theo tuần và tỷ lệ hoàn thành ghi chép, không thu dữ liệu thừa. Với dự báo, lưu prediction và actual đã ẩn danh/được đồng ý để tính MAE; chỉ cân nhắc ML khi rule baseline không đạt mục tiêu xác định trước.

<!-- PAGE -->

# 7. Business Model

## 7.1 Business Model Canvas — giả thuyết

| Khối | Nội dung cần kiểm chứng |
|---|---|
| Customer Segments | Sinh viên có thu nhập không đều; người mới đi làm muốn tạo thói quen; trường/CLB tài chính cá nhân cho chương trình giáo dục |
| Value Propositions | Tiếng Việt/VND; nhanh và giải thích được; quyền mang dữ liệu đi; không cần liên kết ngân hàng cho bản lõi |
| Channels | Cộng đồng sinh viên, workshop, app/web store tương lai, đối tác trường học |
| Customer Relationships | Self-service, onboarding bằng demo, tài liệu kiến thức, hỗ trợ in-app/email tương lai |
| Revenue Streams | Freemium; premium giả định; gói workshop/white-label giáo dục là phương án, chưa có doanh thu |
| Key Resources | Mã nguồn, mô hình dữ liệu, nội dung giáo dục, năng lực security/compliance |
| Key Activities | Phát triển, kiểm thử, bảo mật, hỗ trợ, nghiên cứu người dùng, cập nhật pháp lý |
| Key Partners | Trường/CLB, cố vấn tài chính giáo dục, nhà cung cấp cloud/email; ngân hàng chỉ ở roadmap có hợp đồng |
| Cost Structure | Hạ tầng, backup/monitoring, hỗ trợ, phát triển, bảo mật/pháp lý, marketing có kiểm soát |

## 7.2 Lợi ích theo stakeholder

**Người dùng:** nhìn dòng tiền và rủi ro vượt chi trước khi hết tháng; dữ liệu xuất được. **Nhà trường/CLB:** công cụ minh họa vòng lặp ngân sách trong workshop. **Nhóm phát triển:** kiến trúc nhỏ để thử nghiệm giả thuyết trước khi đầu tư tích hợp đắt. Không khẳng định ứng dụng làm tăng tiết kiệm nếu chưa có thử nghiệm đối chứng.

## 7.3 Đề xuất gói sản phẩm — giả thuyết

- Free: thu/chi, ngân sách cơ bản, backup cục bộ.
- Premium giả định 29.000 VND/tháng: nhiều mục tiêu, báo cáo nâng cao, đồng bộ đa thiết bị trong roadmap.
- Education: workshop hoặc dashboard quản trị ẩn danh; chỉ phát triển sau đánh giá quyền riêng tư và hợp đồng rõ.

Mức giá chỉ là đầu vào để tính kịch bản, chưa phải quyết định go-to-market. Cần phỏng vấn willingness-to-pay và thử price page trước khi xây đồng bộ cloud.

## 7.4 North-star và guardrail metrics đề xuất

North-star không nên là “số giao dịch nhập” đơn thuần. Chỉ số phù hợp hơn là số tuần người dùng hoàn tất review ngân sách và đưa ra ít nhất một điều chỉnh. Guardrails gồm tỷ lệ restore lỗi, sự cố dữ liệu, khiếu nại quyền riêng tư, thời gian xóa/xuất dữ liệu và chênh lệch tính toán. Revenue không được tối ưu bằng dark pattern hoặc bán dữ liệu tài chính.

<!-- PAGE -->

# 7. Business Model — khả thi và kinh tế đơn vị

## 7.5 Kịch bản chi phí minh họa

Các số dưới đây là **giả định minh họa mỗi tháng**, không phải báo giá hay chi phí đã phát sinh:

| Khoản | Giả định VND/tháng | Ghi chú |
|---|---:|---|
| Compute/database/backup pilot | 1.500.000 | Quy mô nhỏ, cần báo giá thật |
| Monitoring, email, domain phân bổ | 700.000 | Tùy lưu lượng |
| Hỗ trợ vận hành bán thời gian | 1.500.000 | Chưa gồm founder salary đầy đủ |
| Security/legal phân bổ | 2.000.000 | Audit thực tế có thể cao hơn |
| Nội dung/marketing thử nghiệm | 300.000 | Chỉ organic/pilot |
| **Tổng fixed giả định** | **6.000.000** | Làm tròn cho kịch bản |

Giả định giá premium 29.000 VND, chi phí biến đổi 2.000 VND/người trả phí/tháng, contribution 27.000 VND. Điểm hòa vốn minh họa = 6.000.000 / 27.000 ≈ **223 người trả phí**. Con số chưa gồm thuế, phí thanh toán, lương phát triển toàn thời gian, churn và CAC nên không được dùng làm dự báo tài chính.

## 7.6 Phân tích nhạy cảm

| Kịch bản | Contribution/user | Fixed cost | Break-even xấp xỉ |
|---|---:|---:|---:|
| Thận trọng | 20.000 | 10.000.000 | 500 |
| Cơ sở minh họa | 27.000 | 6.000.000 | 223 |
| Tối ưu | 35.000 | 5.000.000 | 143 |

Mục đích của bảng là cho thấy kết quả nhạy với giá và chi phí, không phải chứng minh mô hình có lãi.

## 7.7 Khả thi

**Kỹ thuật:** cao cho demo/pilot cục bộ; cần thay đổi hạ tầng cho đa thiết bị và tải lớn. **Vận hành:** trung bình; quy trình backup, monitoring, support và incident response chưa triển khai production. **Kinh tế:** chưa kết luận do không có CAC, conversion, churn và willingness-to-pay. **Pháp lý:** phạm vi sổ cá nhân đơn giản hơn thanh toán, nhưng dữ liệu cá nhân vẫn chịu nghĩa vụ; roadmap ngân hàng/thanh toán cần đánh giá lại trước khi làm. **Thị trường:** chưa xác thực; persona và BMC là giả thuyết.

## 7.8 Thử nghiệm rẻ trước khi mở rộng

1. Usability test prototype hiện tại.
2. Landing page mô tả free/premium, không thu tiền, đo intent có đồng ý.
3. Pilot workshop với dữ liệu giả lập; phỏng vấn sau buổi.
4. Concierge test báo cáo hàng tuần trước khi xây cloud sync.
5. Chỉ đầu tư tích hợp ngân hàng sau khi chứng minh retention và hoàn thành legal/security assessment.

<!-- PAGE -->

# 8. Security, Risk and Regulation

## 8.1 Threat model rút gọn

Tài sản gồm thông tin đăng nhập, dữ liệu thu/chi, mục tiêu, backup và tính toàn vẹn số liệu. Tác nhân gồm người dùng vô tình, kẻ đoán mật khẩu, website độc hại tìm cách gửi request, người có quyền truy cập máy/DB, và lỗi phần mềm. Biên tin cậy nằm giữa browser–server, server–database và file import–hệ thống.

## 8.2 Kiểm soát đã thiết kế/triển khai trong prototype

- scrypt với salt ngẫu nhiên; so sánh kết quả an toàn; không log password.
- Token phiên opaque, ngẫu nhiên; cookie HttpOnly, SameSite=Strict; vô hiệu hóa logout/hết hạn.
- user_id suy ra từ session và có trong truy vấn, không nhận quyền sở hữu từ client.
- Prepared statements, validation allow-list, giới hạn body 2 MiB và security headers gồm CSP chặt.
- Kiểm tra same-origin cho request thay đổi trạng thái và chỉ chấp nhận Host loopback trong bản local.
- Giới hạn xác thực trong bộ nhớ theo IP: 20 lần/10 phút; test dùng ngưỡng cấu hình nhỏ để kiểm chứng 429.
- Revision/409 chống lost update; transaction/constraint chống trạng thái một nửa.
- Backup không chứa credential/session; restore kiểm tra trước khi commit.
- Dữ liệu demo và tài khoản thật không dùng chung không gian sở hữu.

## 8.3 Khoảng trống trước production

TLS bắt buộc; Secure cookie; rate limit phân tán và theo tài khoản thay cho map trong một tiến trình; email verification/recovery an toàn; MFA tùy rủi ro; quản lý secret; backup mã hóa và diễn tập restore; centralized logging/monitoring; dependency/runtime patching; SAST/DAST và pen test; quy trình incident response; retention/deletion; privacy notice và thực thi quyền dữ liệu. SameSite, same-origin và CSP giảm rủi ro nhưng không thay thế threat analysis đầy đủ.

## 8.4 Ma trận rủi ro

Thang likelihood (L) và impact (I) từ 1–5; score = L×I. Điểm là đánh giá thiết kế, cần cập nhật bằng dữ liệu vận hành.

| Rủi ro | L | I | Điểm | Ứng phó |
|---|---:|---:|---:|---|
| Đoán/nhồi credential | 3 | 4 | 12 | scrypt + IP limit hiện tại; production distributed/account limit, MFA |
| Truy cập chéo tài khoản | 2 | 5 | 10 | ownership ở mọi query; integration test |
| Mất/corrupt DB | 2 | 5 | 10 | backup, transaction; roadmap restore drill |
| Restore/CSV độc hại | 3 | 3 | 9 | schema/size/escaping; test payload biên |
| Tạo định kỳ trùng | 2 | 3 | 6 | unique idempotency key |
| SQLite lock/tải vượt thiết kế | 3 | 3 | 9 | pilot nhỏ; roadmap managed DB |
| Người dùng hiểu dự báo là cam kết | 3 | 4 | 12 | nhãn ước lượng, giải thích, không tư vấn |
| Roadmap thanh toán bị phân loại sai | 2 | 5 | 10 | legal gate trước tích hợp |

<!-- PAGE -->

# 8. Security, Risk and Regulation — bối cảnh Việt Nam

## 8.5 Quyền riêng tư và dữ liệu

Tại ngày truy cập 12/11/2026, Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 có hiệu lực từ 01/01/2026 [R1], và Luật Dữ liệu số 60/2024/QH15 có hiệu lực từ 01/07/2025 [R2]. Nếu Ví Nhỏ vận hành thương mại, đội ngũ phải lập bản đồ dữ liệu, xác định vai trò và mục đích xử lý, thu thập tối thiểu, thiết lập căn cứ xử lý/đồng ý khi áp dụng, cung cấp thông báo minh bạch, hỗ trợ quyền của chủ thể, bảo vệ và xóa/lưu dữ liệu theo chính sách, đồng thời đánh giá nghĩa vụ hồ sơ tác động và chuyển dữ liệu xuyên biên giới theo trường hợp cụ thể. Prototype kỹ thuật không tự chứng minh tuân thủ; cần tư vấn pháp lý trước pilot có dữ liệu thật.

## 8.6 Giao dịch điện tử và người tiêu dùng

Luật Giao dịch điện tử 20/2023/QH15 và Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15 cùng có hiệu lực từ 01/07/2024 [R3][R4]. Nếu có điều khoản sử dụng, mua premium hoặc thông báo điện tử, cần lưu được phiên bản điều khoản/sự chấp thuận, cung cấp thông tin chính xác, cơ chế khiếu nại và tải chứng từ phù hợp. UX không nên dùng dark pattern, tự gia hạn mơ hồ hoặc khẳng định sai về lợi ích tài chính.

## 8.7 Ranh giới thanh toán

Nghị định 52/2024/NĐ-CP về thanh toán không dùng tiền mặt có hiệu lực từ 01/07/2024 [R5]. Prototype hiện tại chỉ là sổ quản lý tài chính: không giữ tiền, không mở tài khoản thanh toán, không chuyển tiền và không cung cấp dịch vụ trung gian thanh toán. Vì vậy báo cáo không gọi Ví Nhỏ là “ví điện tử” theo nghĩa dịch vụ được cấp phép. Nếu roadmap thêm khởi tạo thanh toán, liên kết tài khoản hoặc lưu trữ giá trị, phải dừng ở legal/compliance gate, làm việc với ngân hàng/đối tác được phép và đánh giá yêu cầu cấp phép, eKYC, AML, an ninh và hợp đồng.

## 8.8 Phân loại thông tin hiển thị

Dự báo và cảnh báo của Ví Nhỏ là thông tin hỗ trợ lập ngân sách dựa trên dữ liệu do người dùng cung cấp. UI cần nêu công thức, kỳ dữ liệu, giả định và giới hạn; không dùng ngôn ngữ bảo đảm lợi nhuận hoặc khuyến nghị đầu tư. Khi dữ liệu thiếu, sản phẩm nên nói “chưa đủ dữ liệu” thay vì tạo độ chính xác giả.

## 8.9 Checklist compliance trước pilot thật

- Privacy notice, terms, retention/deletion và kênh yêu cầu dữ liệu.
- Data inventory, access matrix, incident process và người chịu trách nhiệm.
- Đánh giá căn cứ xử lý, hồ sơ/tác động và cross-border theo trường hợp.
- Hợp đồng với processor/cloud, vị trí dữ liệu và cơ chế audit.
- Legal sign-off cho tên gọi, marketing và mọi tính năng liên quan thanh toán.

Phần này là phân tích học thuật, không thay thế ý kiến pháp lý chuyên nghiệp.

<!-- PAGE -->

# 10. Conclusion and Future Work

## 10.1 Kết quả đạt được

Ví Nhỏ minh họa một giải pháp FinTech cụ thể thay vì chỉ tổng hợp lý thuyết. Prototype nối được tài chính và công nghệ: thu/chi, ngân sách, mục tiêu, dòng tiền và dự báo được hiện thực thành quy tắc; Node/SQLite đảm nhiệm persistence; xác thực và ownership tách dữ liệu; revision xử lý xung đột; export/restore thể hiện quyền kiểm soát dữ liệu. Kịch bản demo có thể chạy cục bộ và tái lập.

## 10.2 Hạn chế

Giải pháp chưa được kiểm chứng với người dùng thật, chưa có production security/compliance, chưa scale đa nút và phụ thuộc nhập liệu thủ công. node:sqlite ở dòng Node sử dụng còn mang trạng thái experimental. Dự báo chưa được backtest. Business model và unit economics là giả thuyết. Không có kết nối ngân hàng, thanh toán, AI/ML hoặc mobile app.

## 10.3 Roadmap có cổng quyết định

| Giai đoạn | Mục tiêu | Điều kiện đi tiếp |
|---|---|---|
| 0 — hiện tại | Prototype local end-to-end | Automated test + demo pass |
| 1 — nghiên cứu | 5–8 usability sessions, sửa lỗi | Nhiệm vụ cốt lõi hoàn thành đạt ngưỡng đặt trước |
| 2 — pilot riêng tư | Hosting TLS, backup, monitoring, privacy process | Security/legal review và restore drill |
| 3 — đa thiết bị | Cloud sync, granular API, MFA tùy chọn | Retention và nhu cầu đồng bộ đã chứng minh |
| 4 — tích hợp | Open Banking qua đối tác được phép | Legal/compliance gate, hợp đồng, consent |
| 5 — phân tích nâng cao | So sánh rule baseline với ML | Dữ liệu hợp pháp, đủ chất lượng, MAE cải thiện đáng kể |

## 10.4 Truy vết rubric/đề bài

| Yêu cầu đề bài | Bằng chứng trong sản phẩm/tài liệu |
|---|---|
| Vấn đề thực tế | Mục 2, proto-persona và jobs-to-be-done |
| Giải pháp FinTech | Mục 3, vòng lặp tài chính và tính năng |
| Technology có giải thích | Mục 4, lựa chọn và lý do |
| System Design | Kiến trúc, use case, DFD, ER, API ở mục 5 |
| Prototype/demo | Mục 6, source code, kịch bản 3 phút |
| Business Model | BMC, unit economics giả thuyết ở mục 7 |
| Security/Risk/Regulation | Threat model, matrix, luật tại mục 8 |
| Evaluation/Discussion | Acceptance matrix, test và hạn chế mục 9 |
| Future Development | Roadmap có cổng tại mục 10 |
| Presentation | 14 slide + speaker notes + defense kit |

## 10.5 Kết luận

Giá trị của Ví Nhỏ không nằm ở lời hứa “tự động quản lý tiền”, mà ở việc làm cho một quyết định nhỏ trở nên có dữ liệu và có thể giải thích. Prototype đủ để chứng minh ý tưởng và kiến trúc cơ bản; chưa đủ để tuyên bố product–market fit hoặc sẵn sàng production. Bước đúng tiếp theo là kiểm chứng người dùng và độ tin cậy, không phải lập tức thêm AI hay thanh toán.

<!-- PAGE -->

# 11. References

Tất cả nguồn web được truy cập ngày **12/11/2026**. Nguồn pháp lý ưu tiên Cổng Thông tin điện tử Chính phủ; cần kiểm tra văn bản sửa đổi/hướng dẫn tại thời điểm triển khai thật.

1. **[R1]** Quốc hội, *Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15*, ban hành 26/06/2025, hiệu lực 01/01/2026. https://vanban.chinhphu.vn/?docid=214590&pageid=27160
2. **[R2]** Quốc hội, *Luật Dữ liệu số 60/2024/QH15*, ban hành 30/11/2024, hiệu lực 01/07/2025. https://vanban.chinhphu.vn/?classid=1&docid=212488&pageid=27160
3. **[R3]** Quốc hội, *Luật Giao dịch điện tử số 20/2023/QH15*, hiệu lực 01/07/2024. https://vanban.chinhphu.vn/?classid=1&docid=208421&pageid=27160&typegroupid=3
4. **[R4]** Quốc hội, *Luật Bảo vệ quyền lợi người tiêu dùng số 19/2023/QH15*, hiệu lực 01/07/2024. https://vanban.chinhphu.vn/?classid=1&docid=208363&pageid=27160
5. **[R5]** Chính phủ, *Nghị định 52/2024/NĐ-CP về thanh toán không dùng tiền mặt*, hiệu lực 01/07/2024. https://vanban.chinhphu.vn/?classid=1&docid=210262&orggroupid=2&pageid=27160
6. **[R6]** Node.js, *SQLite — Node.js v22 documentation*. https://nodejs.org/download/release/v22.21.0/docs/api/sqlite.html
7. **[R7]** Node.js, *Crypto — scrypt API*. https://nodejs.org/docs/latest-v22.x/api/crypto.html
8. **[R8]** SQLite, *Foreign Key Support*. https://www.sqlite.org/foreignkeys.html
9. **[R9]** SQLite, *Transaction*. https://www.sqlite.org/lang_transaction.html
10. **[R10]** OWASP Foundation, *Password Storage Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
11. **[R11]** OWASP Foundation, *Session Management Cheat Sheet*. https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
12. **[R12]** OWASP Foundation, *Application Security Verification Standard*. https://owasp.org/www-project-application-security-verification-standard/
13. **[R13]** W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*. https://www.w3.org/TR/WCAG22/
14. **[R14]** FinTech – Final Project Assignment, tài liệu đề bài do giảng viên cung cấp, 4 trang.

## Phụ lục được nộp riêng

- docs/diagrams.md: sơ đồ Mermaid và diễn giải chữ.
- docs/presentation.md, docs/presentation.html, docs/presentation.pptx/pdf: slide.
- docs/speaker-notes.md: kịch bản 10–15 phút.
- docs/defense-kit.md: demo 3 phút và Q&A.
- docs/submission-checklist.md: kiểm tra trước khi nộp.
- Source code và output npm test.

## Tuyên bố sử dụng nguồn và dữ liệu

Báo cáo không sử dụng số liệu khảo sát tự tạo. Dữ liệu trong demo là mô phỏng. Giá, chi phí và break-even là phép tính minh họa có ghi giả định. Các nguồn pháp lý được dẫn để định hướng thiết kế; kết luận tuân thủ cần chuyên gia pháp lý và bối cảnh vận hành thực tế.
