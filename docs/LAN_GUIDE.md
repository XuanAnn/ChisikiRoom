# ChisikiRoom Windows LAN 0.8.0

## Chạy máy chủ

Máy A cần Java 21, Maven, Node.js 22.12 trở lên và Docker Desktop. Giữ `.env` hiện có; nếu bắt đầu mới, sao chép `.env.example`, đặt mật khẩu PostgreSQL. Từ thư mục gốc:

```bat
npm install
npm run db
npm run backend
```

Sau khi cài thư viện lần đầu, có thể nhấp đúp `Start-Server.cmd` để chạy database/backend. Giữ cửa sổ máy chủ mở.

Database mặc định ở `127.0.0.1:5433`; backend ở `0.0.0.0:8080`. Chỉ chạy **một** phiên backend. Nếu đang có phiên cũ, dừng bằng Ctrl+C rồi chạy lại sau khi cập nhật mã. Flyway tự nâng schema, không xóa dữ liệu hiện có.

Kiểm tra `http://localhost:8080/actuator/health` trả về `{"status":"UP"}`. Nếu cần đổi cổng backend, đặt cả `SERVER_PORT` và `CHISIKI_API_URL` phù hợp trong `.env`; ví dụ `SERVER_PORT=8081` và `CHISIKI_API_URL=http://localhost:8081`.

Tìm IPv4 LAN của máy A trong thông tin mạng Windows hoặc bằng `ipconfig`. Cho phép cổng backend trong Windows Firewall ở hồ sơ mạng Private, giới hạn phạm vi subnet LAN. Không mở cổng PostgreSQL cho máy client. Tài liệu này không tự thay đổi tường lửa hoặc quyền camera của Windows.

## Mở ứng dụng desktop

Máy A có thể chạy client cùng backend. Với bản mã nguồn, mở terminal khác ở thư mục gốc:

```bat
npm run build
npm run desktop
```

Với bản mã nguồn, có thể nhấp đúp `Start-Desktop.cmd` để build và mở giao diện.

Đóng gói bằng `npm run package:win`, lấy file portable trong `release` và chép sang máy B/C. Máy client không cần cài môi trường phát triển. Trên màn hình đăng nhập, bấm **Máy chủ**, nhập `http://IP-MAY-A:8080` rồi lưu. `localhost` trên máy B là máy B, không phải máy A. Địa chỉ máy chủ được lưu trong thư mục cấu hình ứng dụng trên từng máy; biến `CHISIKI_API_URL` nếu đặt sẽ ưu tiên khi mở ứng dụng.

Đăng ký tài khoản riêng cho từng người. Đăng nhập lại khi đóng ứng dụng vì token chỉ được giữ trong bộ nhớ.

## Thử đầy đủ chức năng

1. Máy A tạo phòng công khai; máy B thấy trong danh sách và bấm tham gia. Nút làm mới lấy danh sách ngay; ứng dụng cũng tự cập nhật định kỳ. Gửi tin nhắn từ cả hai máy, thử emoji và reaction.
2. Tạo phòng riêng. Chủ phòng mời người dùng bằng ID tài khoản, lấy trong Hồ sơ hoặc danh sách bạn bè. Người chưa được mời không được vào hoặc xem lịch sử/tài liệu.
3. Mở Bạn bè, tìm tên, gửi lời mời; tài khoản kia chấp nhận. Trạng thái hoạt động cập nhật theo kết nối realtime, danh sách đang mở được làm mới định kỳ.

   Trong sidebar, **Chat bạn bè** nằm phía trên, **Chat nhóm** nằm phía dưới. Hai danh sách tự cuộn riêng và không hiện thanh cuộn. Bấm tên một người bạn để mở chat riêng; hai người mở cùng lúc vẫn dùng một cuộc trò chuyện. Chat riêng chỉ có hai thành viên, không có thao tác mời thêm người hoặc rời nhóm.
4. Trong Hồ sơ, đổi tên hiển thị và avatar PNG/JPEG tối đa 2 MB, tối đa 2048×2048 pixel.
5. Tải tài liệu lên phòng và tải xuống từ máy B. Giới hạn 20 MB/file; PDF, DOCX, PPTX, TXT UTF-8, PNG, JPEG. Ảnh/tài liệu hiện được chia sẻ trong mục Tài liệu, chưa có trình xem inline trong tin nhắn.
6. Mở Bộ câu hỏi → Tạo bộ câu hỏi. Quiz Editor là cửa sổ riêng. Thêm câu, nhập phương án và đánh dấu đáp án đúng, lưu. Đóng khi chưa lưu phải có cảnh báo. Mỗi bộ tối đa 100 câu; mỗi câu 2–6 phương án qua API, giao diện hiện tạo 4 phương án.
7. Trong phòng, tạo Battle từ bộ câu hỏi của bạn. Máy B bấm thẻ Battle để mở cửa sổ riêng; bấm lần nữa phải focus cửa sổ cũ.
8. Bật camera ở cả hai máy. Khi Windows hỏi quyền thiết bị, người dùng tự cấp quyền. Nếu quyền bị từ chối, không được đánh dấu sẵn sàng. Mic mặc định tắt, có thể bật riêng.
9. Đánh dấu sẵn sàng. Chủ trận bấm bắt đầu khi có ít nhất 2 người và tất cả camera/sẵn sàng hợp lệ. Tối đa 4 người.
10. Người đúng đầu tiên được +10; các đối thủ đang tham gia bị −5; cho phép điểm âm. Mỗi người một đáp án/câu. Hết 15 giây không ai đúng thì điểm giữ nguyên. Kết quả hiển thị 2 giây, server chuyển câu. Đồng điểm cùng hạng.
11. Thử rút camera hoặc ngắt mạng: người đó không được trả lời; sau 30 giây tính từ lúc camera mất hoặc lần heartbeat cuối mà chưa khôi phục thì bỏ cuộc. Trận tiếp tục nếu còn ít nhất 2 người; khi ít hơn thì kết thúc và giữ điểm hiện tại.
12. Thử rời lobby: chuyển quyền chủ trận. Đóng Battle Window phải hỏi xác nhận; rời trận không đóng cửa sổ chat/quiz.

## Gọi bạn bè và nhóm ngoài Battle

1. Cập nhật backend và client cùng bản 0.8.0. Dừng backend cũ trước khi khởi động lại; schema hiện tại là V16. Khởi động backend sẽ nạp 10 bộ câu hỏi N5–N4 dùng chung qua ORM, không tạo trùng khi khởi động lại.
2. Mở chat bạn bè hoặc nhóm đã tham gia, bấm **Gọi video**. Cửa sổ cuộc gọi mở riêng, không cần tạo Battle hay quiz.
3. Người được mời thấy **hộp thoại cuộc gọi đến riêng**, có tên người gọi/nhóm, chuông hai âm và các nút **Nhận cuộc gọi**, **Từ chối**, **Tắt chuông**. Hoạt động khi cửa sổ chat thu nhỏ; đóng bằng X cũng bỏ qua/từ chối lời mời. Hộp thoại kết thúc khi bên gọi hủy hoặc hết thời gian. Có thể tham gia nhóm đang gọi bằng nút **Tham gia cuộc gọi**.
4. Camera/mic mặc định tắt. Bấm bật thiết bị cần dùng; tắt camera không buộc rời cuộc gọi. Dùng tai nghe khi thử nhiều máy gần nhau để tránh vọng âm.
5. Nhóm P2P hiện tối đa 4 người. Cuộc gọi bạn bè kết thúc khi một người rời/từ chối; nhóm tiếp tục khi còn người. Đóng cửa sổ cũng yêu cầu rời. Mất heartbeat 30 giây sẽ bị loại; cuộc gọi chưa có ai nhận tự hết hạn sau 45 giây.
6. Rời cuộc gọi trước khi mở Battle. Chưa nghiệm thu bằng nhiều máy vật lý; đã kiểm tra nhóm ba phiên Electron với thiết bị giả trên một máy.

## Bố trí và chức năng mới

- **Tổng quan**: số liệu thật về bạn bè, nhóm, quiz và tin mới trong phiên; mở nhanh nhóm, soạn quiz, xem nhóm công khai.
- **Sidebar**: chat bạn bè ở trên, nhóm ở dưới, mỗi phần cuộn độc lập và ẩn scrollbar. Ô tìm kiếm hỗ trợ tên không dấu; `Ctrl+K` đưa con trỏ vào ô này.
- **Chat**: tin nhắn dạng bong bóng, phân ngày; ô soạn giữ bản nháp theo từng phòng trong phiên. Không cuộn xuống cưỡng bức khi đang đọc phía trên; nút Tin nhắn mới đưa về cuối.
- **Công cụ phòng**: thành viên, mời bạn bè, tài liệu có lọc tên và tạo/tham gia Battle ở bên phải. Nút thông tin trên header mở/đóng vùng này; cửa sổ nhỏ tự thu gọn. Nút kẹp giấy ở ô chat tải file lên.
- **Tìm lịch sử**: bấm kính lúp hoặc `Ctrl+F`, nhập từ 2–100 ký tự. Server tìm trong phòng được phép truy cập, không chỉ các tin đang tải; mỗi trang tối đa 50 kết quả mới nhất. Tìm không phân biệt hoa/thường, có giữ dấu tiếng Việt.
- **Quiz**: lọc theo tên, sắp xếp theo lần cập nhật hoặc tên; trình soạn vẫn mở riêng.
- Tin chưa đọc và bản nháp văn bản được lưu trong PostgreSQL từ 0.8.0. Bản nháp có phiên bản để phát hiện xung đột giữa các máy; trạng thái đọc tăng đơn điệu. Chờ báo Đã lưu bản nháp trước khi thoát cưỡng bức.

## WebRTC trong LAN

LAN mặc định dùng ICE host candidates, không gửi media qua Spring Boot. Backend chỉ xác thực, chuyển signaling và trạng thái. Camera/mic không được ghi lại. Kiểm tra camera ở client là điều kiện tham gia, không phải bằng chứng chống gian lận.

Đã kiểm thử video hai chiều, bật/tắt mic và nhận audio bằng hai phiên Electron với thiết bị giả trên một máy. Chưa xác minh bằng hai máy vật lý, camera/mic thật, Windows Firewall và router thực tế. Nếu hai máy không thấy video, kiểm tra có cùng mạng, mạng khách có chặn kết nối giữa client không, và quyền thiết bị/tường lửa. Các mạng chặn kết nối trực tiếp có thể cần TURN.

Khi có TURN, cấu hình `CHISIKI_STUN_URLS`, `CHISIKI_TURN_URLS` và `CHISIKI_TURN_SECRET` chỉ trên backend. Dùng coturn với secret tương ứng; backend phát credential có hạn 1 giờ. Không chép shared secret sang máy client. Phần TURN chưa được nghiệm thu trên Internet; phiên bản này tập trung LAN theo quyết định của người dùng.

## Dữ liệu và giới hạn bản LAN

PostgreSQL lưu tài khoản, chat, quiz, trạng thái/điểm Battle và outbox. Upload lưu mặc định trong `backend/data/uploads` khi chạy bằng Maven; có thể đặt đường dẫn tuyệt đối qua `CHISIKI_UPLOAD_DIR`. Sao lưu cả DB và thư mục đó. Avatar cũ và file không còn metadata hiện chưa được dọn tự động.

Khi backend khởi động lại, worker đọc trạng thái trận/deadline đã lưu và xử lý tiếp; các lần chốt điểm được khóa và có ràng buộc chống trùng. Client reconnect lấy snapshot và lịch sử mới. Thời gian gián đoạn vẫn được tính vào deadline và grace, không tự dừng đồng hồ trận.

Chưa triển khai: public hosting/HTTPS, TURN thực tế, SFU, quản trị kiểm duyệt, trình xem nội dung tài liệu inline, quét malware, quota tổng dung lượng và tự cập nhật ứng dụng. Trước khi đưa public cần rate limiting, quản lý secrets/backup/monitoring và kiểm thử tải. Không coi bản LAN này là bản production trên Internet.

Lời mời nhóm: người nhận mở nút Lời mời nhóm và Chấp nhận/Từ chối. Trước khi chấp nhận, lời mời không cấp quyền truy cập phòng.

Chat 0.8.0: Trả lời để trích dẫn; menu ba chấm sửa/xóa tin của mình. Chủ nhóm (hoặc cả hai trong chat riêng) ghim tối đa năm tin; bấm Tin ghim để xem. Tin xóa giữ dấu trong lịch sử, trích dẫn không tiếp tục lộ nội dung gốc.
