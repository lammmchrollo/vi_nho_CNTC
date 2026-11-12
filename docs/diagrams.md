# Sơ đồ hệ thống Ví Nhỏ

Các sơ đồ dùng cú pháp Mermaid để có thể render trên GitHub/Markdown editor. Mỗi sơ đồ có diễn giải chữ tương đương để báo cáo vẫn hiểu được khi trình đọc không hỗ trợ Mermaid.

## 1. Kiến trúc tổng thể

~~~mermaid
flowchart LR
  U[Người dùng] --> B[Web UI]
  B -->|JSON + revision + cookie| H[Node HTTP server]
  H --> A[Auth & session]
  H --> V[Validation & rules]
  A --> D[(SQLite)]
  V --> D
  H --> E[CSV / JSON export]
~~~

**Diễn giải:** người dùng tương tác với UI trong browser. Browser gọi cùng origin tới Node server. Server đọc cookie phiên, xác định user, kiểm tra payload và thực hiện prepared statement/transaction trên SQLite. Dữ liệu export chỉ được tạo sau khi lọc theo user hiện tại.

## 2. Use case

~~~mermaid
flowchart TB
  G((Khách)) --> R[Đăng ký]
  G --> L[Đăng nhập]
  G --> D[Vào demo]
  R --> U((Người dùng đã xác thực))
  L --> U
  D --> U
  U --> T[CRUD thu/chi]
  U --> B[Ngân sách]
  U --> S[Mục tiêu tiết kiệm]
  U --> C[Định kỳ]
  U --> P[Báo cáo & dự báo]
  U --> X[CSV/JSON]
  U --> I[Restore/nhập v1]
  U --> O[Đăng xuất]
~~~

**Diễn giải:** khách chỉ đăng ký, đăng nhập hoặc chọn demo. Sau khi có session, người dùng mới truy cập nghiệp vụ. Demo cũng có ownership riêng, không phải dữ liệu toàn cục dùng chung.

## 3. Data flow và optimistic concurrency

~~~mermaid
sequenceDiagram
  actor U as Người dùng
  participant B as Browser
  participant S as Node server
  participant D as SQLite
  U->>B: Mở ứng dụng
  B->>S: GET /api/state + cookie
  S->>D: SELECT ... WHERE user_id=session.user
  D-->>S: state, revision=12
  S-->>B: 200 state + revision=12
  U->>B: Sửa giao dịch
  B->>S: PUT /api/state revision=12
  S->>D: transaction + compare revision
  alt revision vẫn là 12
    D-->>S: commit, revision=13
    S-->>B: 200 state + revision=13
  else state đã đổi
    D-->>S: conflict
    S-->>B: 409 Conflict
  end
~~~

**Diễn giải:** client luôn gửi revision đã đọc. Server chỉ commit nếu revision còn khớp, sau đó tăng revision. Nếu một tab khác đã lưu trước, server trả 409 để tránh mất cập nhật.

## 4. Entity relationship

~~~mermaid
erDiagram
  USERS ||--|| WALLET_META : owns
  USERS ||--o{ SESSIONS : has
  USERS ||--o{ TRANSACTIONS : owns
  USERS ||--o{ BUDGETS : owns
  USERS ||--o{ GOALS : owns
  USERS ||--o{ RECURRING : owns
  USERS ||--o{ AUDIT : creates
  RECURRING ||..o{ TRANSACTIONS : deterministic_ID

  USERS {
    string id PK
    string name
    string email UK
    string password_hash
    string password_salt
    string created_at
  }
  WALLET_META {
    string user_id PK_FK
    integer revision
    integer demo
  }
  SESSIONS {
    string id_hash PK
    string user_id FK
    integer expires_at
    string created_at
  }
  TRANSACTIONS {
    string user_id PK_FK
    string id PK
    string date
    string type
    string category
    integer amount
    string note
  }
  BUDGETS {
    string user_id PK_FK
    string month PK
    string category PK
    integer cap
  }
  GOALS {
    string user_id PK_FK
    string id PK
    string name
    integer target
    integer saved
    string deadline
  }
  RECURRING {
    string user_id PK_FK
    string id PK
    string type
    string category
    integer amount
    string note
    integer day
    string start_month
    string end_month
    integer active
  }
  AUDIT {
    integer id PK
    string user_id FK
    string action
    string created_at
  }
~~~

**Diễn giải:** đây là schema thực tế trong server.js. users là gốc ownership; wallet_meta tách revision/demo. sessions chỉ lưu id_hash, không lưu token thô và không được export. Mọi user_id là UUID dạng TEXT. Quan hệ nét đứt recurring–transactions là logic, không phải khóa ngoại: model tạo ID rec-{ruleId}-{month}; cặp khóa chính (user_id, id) và validation ID trùng giữ tính idempotent.

## 5. Quy trình restore

~~~mermaid
flowchart TD
  F[Chọn file JSON] --> Z{Kích thước hợp lệ?}
  Z -- Không --> R[Từ chối, không đổi DB]
  Z -- Có --> J{JSON + version hợp lệ?}
  J -- Không --> R
  J -- Có --> V{Schema, ngày, tiền, ID, danh mục hợp lệ?}
  V -- Không --> R
  V -- Có --> T[Bắt đầu transaction]
  T --> W[Ghi dữ liệu của user hiện tại]
  W --> Q{Mọi constraint đều đạt?}
  Q -- Không --> X[Rollback]
  Q -- Có --> C[Commit + tăng revision + audit]
~~~

**Diễn giải:** restore fail-closed và all-or-nothing. File không bao giờ cấp user_id tùy ý, ghi credential hoặc tạo session.
