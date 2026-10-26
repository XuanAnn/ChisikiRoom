# Quyết định sản phẩm đã xác nhận

Người dùng xác nhận ngày 24/10/2026, bổ sung cho đặc tả v1.1. Đây là yêu cầu để triển khai, không phải các chức năng đã hoàn tất.

- Battle tối đa 4 người, mỗi câu 15 giây, mỗi người chỉ trả lời một lần. Trả lời sai không bị trừ thêm điểm.
- Người đúng đầu tiên nhận 10 điểm; mỗi đối thủ bị trừ 5 điểm; cho phép điểm âm. Hết giờ không ai đúng thì không thay đổi điểm.
- Chủ trận bấm bắt đầu khi tất cả sẵn sàng.
- Mất camera hoặc kết nối: ngừng nhận đáp án của người đó, cho 30 giây khôi phục rồi tính bỏ cuộc.
- Chủ trận rời lobby: chuyển quyền. Trận đang chạy tiếp tục nếu còn ít nhất 2 người.
- Đồng điểm thì đồng hạng.
- Bản đầu hỗ trợ Windows.
- Phòng riêng: chủ phòng mời thành viên. Chỉ thành viên được tải file.
- Tối đa 20 MB/file; định dạng PDF, DOCX, PPTX, TXT, PNG, JPEG.

Ngày 25/10/2026, người dùng xác nhận chưa có VPS/tên miền và ưu tiên hoàn thiện Windows/LAN trước. Public hosting và nghiệm thu TURN qua Internet được để lại giai đoạn sau.

Ngày 25/10/2026, người dùng đề xuất Modular Monolith + Layered Architecture + Event-Driven Realtime, WebRTC P2P/SFU theo giai đoạn; yêu cầu gọi video bạn bè và nhóm độc lập với Battle. Bản 0.3.0 tách module/feature và thêm calling, dùng chung P2P với Battle. SFU và FastAPI là giai đoạn sau. Giới hạn gọi nhóm 4 người, heartbeat 30 giây, lời mời 45 giây và camera/mic tùy chọn là mặc định triển khai tạm thời của tác nhân, chưa phải các luật cuộc gọi được người dùng xác nhận riêng.

Ngày 26/10/2026, người dùng yêu cầu sử dụng ORM cho truy cập database. Backend 0.3.1 chuyển từ JDBC sang Spring Data JPA/Hibernate, giữ Flyway quản lý schema, giữ transaction/khóa ghi và API tương thích với desktop 0.3.0.

Ngày 26/10/2026, người dùng yêu cầu bổ sung chức năng chính và bố trí giao diện trực quan, chọn cân bằng chat/gọi video với học tập. Người nhận cuộc gọi cần hộp thoại riêng và có âm thanh. Bản 0.4.0 triển khai tổng quan/bố trí ba vùng, bộ lọc, tìm lịch sử, draft/unread trong phiên, mời bạn qua danh sách và popup native có chuông/tắt chuông. Phạm vi vẫn là Windows/LAN; các giới hạn Internet/SFU và nghiệm thu thiết bị vật lý không đổi.


Ngày 26/10/2026, người dùng đồng ý tiếp tục ranking toàn hệ thống theo phương án N5/N4, tự ghép 1–1. Bản 0.7.0 triển khai bản đầu Glicko-2/mùa/phân hạng; giới hạn chống lặp và thời gian lobby/hàng chờ là mặc định triển khai, mô tả trong RANKING.md.

Cùng đợt, người dùng yêu cầu người được mời vào nhóm phải chấp nhận mới vào. Yêu cầu này thay thế hành vi mời là thêm trực tiếp trước đây. Bản 0.7.0 lưu lời mời chờ, cho chấp nhận/từ chối và chỉ thêm membership sau khi chấp nhận.
