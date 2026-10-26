# ChisikiRoom

Ứng dụng desktop học tập theo đặc tả v1.1. Bản desktop **0.8.0 cho Windows/LAN** bố trí lại giao diện với trang tổng quan, sidebar bạn bè/nhóm, chat ở giữa và công cụ phòng bên phải. Cân bằng trò chuyện/gọi video với quiz, Battle và tài liệu. Cuộc gọi 1–1 ưu tiên video đối phương, camera cá nhân thu nhỏ; nhóm dùng lưới tự co giãn và ô camera cá nhân nhỏ. Battle bố trí camera phía trên và bên phải, tự thu gọn trên cửa sổ nhỏ. Video tự phát khi nhận được luồng, kể cả luồng đến chậm hoặc kết nối lại; không cần bấm Phát video. Có sẵn 10 bộ tiếng Nhật N5–N4 (100 câu) dùng chung, chọn ngay cho Battle hoặc lưu bản sao cá nhân. Backend hiện tại 0.8.0, schema V16.

Chức năng mới: tìm tin nhắn trong lịch sử phòng, lọc bạn bè/nhóm/quiz/tài liệu, sắp xếp quiz, bộ đếm tin chưa đọc và bản nháp riêng theo phòng được lưu vào database, mời thành viên từ danh sách bạn bè. `Ctrl+K` tìm bạn bè/nhóm; `Ctrl+F` tìm tin nhắn trong phòng đang mở.

Người nhận có **hộp thoại cuộc gọi đến riêng**, xuất hiện cả khi cửa sổ chat thu nhỏ. Chuông hai âm phát cục bộ, có nút **Tắt chuông**; chuông và hộp thoại dừng khi nhận, từ chối hoặc bên gọi hủy. Nhận cuộc gọi không tự bật camera/mic.

Backend 0.3.1 chuyển toàn bộ truy cập dữ liệu sang **Spring Data JPA/Hibernate**, giữ Flyway quản lý schema và API tương thích với desktop 0.3.0. Không cần cài lại desktop cho thay đổi ORM này. Xem [docs/PERSISTENCE.md](docs/PERSISTENCE.md).

Backend 0.3.2 tách tiếp hồ sơ/avatar, bạn bè, reaction và tài liệu thành controller → service → repository. Controller chỉ xử lý HTTP; service giữ nghiệp vụ/giao dịch; repository giữ truy vấn; `UploadStorage` quản lý file. URL, dữ liệu API và schema V8 giữ nguyên.

Backend 0.3.3 đã tách thêm `ChatRepository`, `BattleRepository`, `CallRepository` và `SessionRepository`. Bản 0.5.0 giữ kiến trúc này, API tìm lịch sử có kiểm tra quyền thành viên và phân trang, đồng thời bổ sung thư viện câu hỏi dùng chung qua ORM và schema V9. Cập nhật backend cùng desktop 0.5.0 để dùng đầy đủ chức năng mới.

Trong chat bạn bè hoặc nhóm, bấm **Gọi video**; người được mời bấm **Nhận cuộc gọi**. Camera/mic chỉ mở khi bấm bật. Gọi nhóm P2P tối đa 4 người; tắt camera vẫn nói chuyện bằng mic. Chi tiết ranh giới module, các phần đang chuyển dần sang layered architecture và lộ trình SFU: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Bản 0.2.2 sửa lỗi bấm bạn bè bị quay về login: backend giữ đúng mã lỗi 404/500 khi xử lý lỗi nội bộ; client kiểm tra phiên qua `/api/auth/me` trước khi đăng xuất do một API khác trả 401. Khi backend cũ chưa hỗ trợ chat riêng, ứng dụng báo cần cập nhật backend và giữ phiên hợp lệ.

Danh sách chat gồm **Chat bạn bè** ở trên và **Chat nhóm** ở dưới. Mỗi phần cuộn độc lập, ẩn thanh cuộn. Bấm tên bạn bè để mở chat riêng 1–1; cuộc trò chuyện không được trộn vào danh sách nhóm. Cần khởi động lại backend sau khi cập nhật để Flyway áp dụng migration chat riêng.

Hướng dẫn chạy hai máy, thử camera và các giới hạn nghiệm thu: [docs/LAN_GUIDE.md](docs/LAN_GUIDE.md).

Kết quả kiểm thử các phiên bản: [docs/VALIDATION.md](docs/VALIDATION.md).

## Chạy từ thư mục gốc trên Windows

Yêu cầu Java 21, Maven, Docker Desktop đang chạy.

Các lệnh sau dùng được trong cả CMD và PowerShell, tại `E:\Workspace\Project\ChisikiRoom`.

1. Nếu chưa có `.env`, sao chép `.env.example` thành `.env`, đặt `DB_PASSWORD` riêng. Giữ nguyên file `.env` đã cấu hình.
2. Chạy `npm install` để cài thư viện desktop.
3. Chạy `npm run db` để khởi động PostgreSQL và chờ database sẵn sàng.
4. Chạy `npm run backend`, giữ terminal này mở.
5. Mở terminal thứ hai tại thư mục gốc, chạy `npm run build` rồi `npm run desktop`.

Script tự đọc `.env` cho cả Docker và backend, không cần nhập lại mật khẩu trong terminal. PostgreSQL dùng cổng host **5433**, ánh xạ tới 5432 trong container, chỉ mở trên loopback. Cổng 5432 của các dự án khác không bị thay đổi. Nếu 5433 đã bị chiếm, đặt `DB_PORT` trong `.env` thành cổng trống khác rồi chạy lại `npm run db` và `npm run backend`. `DB_URL` nếu được đặt sẽ ghi đè URL database mặc định.

Kiểm tra backend bằng `http://localhost:8080/actuator/health` (kết quả `UP`).

Trên Windows, script đặt thư mục socket nội bộ của Java tại `.runtime` để tránh lỗi `Unable to establish loopback connection` đã gặp với đường dẫn tạm dạng tên ngắn 8.3. Thư mục được tạo tự động và không lưu vào Git. Tham số `jdk.net.unixdomain.tmpdir` đã đặt sẵn trong `JAVA_TOOL_OPTIONS` sẽ được giữ nguyên.

Lệnh chạy backend trực tiếp là `mvn -f backend/pom.xml spring-boot:run`, cần truyền `DB_PASSWORD` qua biến môi trường. Chỉ chạy `mvn -f backend/pom.xml` sẽ báo thiếu goal. CMD đặt biến bằng `set "DB_PASSWORD=..."`; PowerShell dùng `$env:DB_PASSWORD='...'`. Các script npm bên trên xử lý việc này qua `.env`.

## Chạy desktop

Có thể tiếp tục chạy `npm install`, `npm run build`, rồi `npm run desktop` bên trong `desktop`. Khi dùng cách này, `.env` ở thư mục gốc không được tự nạp; ưu tiên các lệnh ở thư mục gốc.

Backend cùng máy mặc định là `http://localhost:8080`. Trên máy client LAN, thêm `CHISIKI_API_URL=http://IP-MAY-CHU:8080` trong `.env` rồi chạy `npm run desktop` từ thư mục gốc. Chỉ mở cổng 8080 trong phạm vi LAN cần thiết. Bản public phải cấu hình URL HTTPS.

Phát triển giao diện: chạy `npm run dev`; terminal khác đặt `$env:CHISIKI_DEV='1'` và chạy `npm run desktop`. Dùng Electron để đăng nhập; trình duyệt chỉ xem được giao diện.

Trước khi đăng nhập, nút **Máy chủ** cho phép lưu địa chỉ backend ngay trong ứng dụng. `CHISIKI_API_URL` nếu đặt sẽ được ưu tiên khi mở lại ứng dụng.

Đóng gói Windows x64: `npm run package:win`. Bản portable được tạo trong `release`. Máy client chạy bản portable không cần Node.js, Java hay Docker; chỉ máy chủ cần chạy backend/database. Bản phát triển chưa ký số.

## Kiểm tra

Quy ước mã nguồn: mỗi câu lệnh và khai báo biến được viết riêng, nhánh điều kiện/vòng lặp có khối rõ ràng, đặt tên dễ hiểu. Java dùng thụt lề 4 dấu cách; TypeScript/React/Electron dùng 2 dấu cách. Cấu hình chung nằm trong `.editorconfig` và `.prettierrc.json`.

- `npm run format`: định dạng mã Java, TypeScript/React, Electron, CSS và các script.
- `npm run format:check`: kiểm tra định dạng mà không sửa file.

- `npm run test:backend`: kiểm thử API, phân quyền, battle đồng thời, timeout, snapshot và camera grace bằng H2.
- `npm run build`: TypeScript và build giao diện.
- `npm run test:integration`: kiểm thử REST, STOMP và tranh chấp thật trên PostgreSQL, mặc định backend ở cổng **18080**.
- `npm run test:desktop`: kiểm thử hai phiên Electron, chat, cửa sổ quiz độc lập, camera giả WebRTC, trả lời câu hỏi và kết quả trận. Cũng mặc định cổng **18080**.

Hai bài kiểm thử tích hợp tạo tài khoản, phòng và trận thử nghiệm. Chỉ chạy với backend/database thử nghiệm riêng. Có thể đổi URL bằng biến `VERIFY_API_URL`. Các bài này không thay thế nghiệm thu bằng hai máy và camera thật. Ảnh kiểm tra được lưu trong `.runtime`, không đóng gói vào ứng dụng.

## Thiết kế hiện tại

- Mật khẩu BCrypt; token ngẫu nhiên 256 bit, DB chỉ giữ SHA-256 của token, hết hạn sau 7 ngày.
- Token giữ trong bộ nhớ main process của Electron. Đóng ứng dụng cần đăng nhập lại.
- Renderer sandbox, context isolation, không có Node integration; IPC chỉ cho các thao tác API định sẵn.
- Flyway quản lý schema PostgreSQL.
- Luật đã xác nhận nằm trong `docs/product-decisions.md`.
- Battle dùng transaction và khóa row của trận để phân xử join, đáp án, timeout; snapshot câu hỏi được giữ tại lúc bắt đầu. Điểm và outbox cùng commit; client bỏ bản snapshot có sequence cũ.
- STOMP gửi sự kiện qua queue riêng của người dùng. Server kiểm tra token khi kết nối và trước khi phát dữ liệu, chỉ thành viên hợp lệ nhận sự kiện phòng.
- File tải qua API có xác thực, tên lưu trên đĩa là UUID. Server kiểm tra kích thước/định dạng; DOCX/PPTX kiểm tra cấu trúc ZIP và giới hạn giải nén. Cần sao lưu cả PostgreSQL và thư mục upload.

Chi tiết bộ câu hỏi có sẵn: [Danh mục tiếng Nhật](docs/JAPANESE_QUIZ_CATALOG.md).


## Luyện tập và tiến độ (0.6.0)

Mở Bộ câu hỏi → Luyện tập. Không cần camera hoặc người chơi khác. Mỗi lựa chọn được lưu trên server; đóng cửa sổ rồi vào Lịch sử luyện tập → Làm tiếp. Khi nộp bài, server chấm từ bản chụp câu hỏi lúc bắt đầu và khóa kết quả, nộp lại không cộng thêm lượt. Bài đã nộp hiển thị đáp án/giải thích, có nút Ôn câu sai / bỏ qua. 100 câu có sẵn đã bổ sung giải thích; bộ cá nhân có thể nhập giải thích trong trình soạn.

Thư viện có thống kê số bài hoàn thành, câu đúng/tổng câu đã nộp, tỷ lệ đúng và mục tiêu ngày (mặc định 20 câu, chỉnh 1–200). Câu bỏ qua tính sai trong tỷ lệ đúng, không tính vào mục tiêu ngày. Mục tiêu chỉ tính câu đã chọn ở bài đã nộp, theo ngày giờ Việt Nam. Bài ôn cũng là lượt học; các số liệu này không làm tăng ranking. Lịch sử hiển thị 50 lượt gần nhất, thống kê tổng hợp tính toàn bộ bài đã nộp của tài khoản.

Các phần chưa triển khai được theo dõi tại [lộ trình](docs/IMPLEMENTATION_ROADMAP.md).


## Ranking và lời mời nhóm (0.7.0)

Xếp hạng có hai bảng toàn hệ thống N5/N4 và chế độ đấu 1–1 tự ghép, Glicko-2, năm trận phân hạng, mùa tám tuần. Hai người bật camera/sẵn sàng thì trận tự bắt đầu. Hủy lobby không tính hạng; rời trận đang chạy tính thua. Lịch sử lưu rating trước/sau. Chi tiết giới hạn ngân hàng 40 câu và mô hình tính điểm: [Ranking](docs/RANKING.md).

Mời vào nhóm chỉ tạo lời mời chờ. Người nhận mở Lời mời nhóm trên thanh công cụ, chọn Chấp nhận hoặc Từ chối. Chưa chấp nhận thì chưa có quyền chat, tài liệu hay gọi trong nhóm. Lời mời lưu trong DB, khởi động lại vẫn thấy. Việc chủ phòng mời không tự thêm thành viên nữa; hai bên cần desktop 0.7.0 để có đủ giao diện này. Thành viên đã tồn tại vẫn giữ quyền.


## Chat nâng cao (0.8.0)

- Bấm Trả lời dưới tin nhắn để trích dẫn. Khi tin gốc sửa/xóa, trích dẫn cập nhật theo; không lấy nội dung từ phòng khác.
- Menu ba chấm trên tin của mình có Sửa/Xóa. Xóa giữ vị trí trong lịch sử dưới dạng Tin nhắn đã xóa, nội dung không còn được trả qua API/tìm kiếm và tự bỏ ghim.
- Chủ nhóm được ghim/bỏ ghim, chat riêng cho phép cả hai; tối đa năm tin ghim/phòng. Bấm Tin ghim để xem đầy đủ.
- Tin nhắn có revision để lịch sử hoặc sự kiện đến muộn không khôi phục nội dung cũ. Trích dẫn theo revision của tin gốc độc lập với revision của tin trả lời.
- Bản nháp văn bản lưu theo tài khoản/phòng sau khoảng 600 ms ngừng gõ. Chờ dòng Đã lưu bản nháp trước khi thoát cưỡng bức. Mở lại sẽ tải từ server; phiên bản bản nháp chống ghi đè giữa các máy, có lựa chọn Giữ bản này/Dùng bản máy chủ khi xung đột. Đóng cửa sổ khi chưa lưu có cảnh báo; đăng xuất thử lưu trước.
- Trạng thái đọc lưu trên server, mốc đọc chỉ tăng. Tin chưa đọc không tính tin tự gửi/tin đã xóa; mở phòng có focus đánh dấu đến tin đã tải. Thống kê được đồng bộ định kỳ và khi có sự kiện/kết nối lại.

Cần desktop/backend 0.8.0 để có đầy đủ các thao tác và thông tin này. Bản nháp chỉ giữ nội dung văn bản; lựa chọn tin đang trích dẫn không được phục hồi sau khi khởi động lại.
