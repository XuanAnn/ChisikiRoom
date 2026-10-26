# Lộ trình triển khai theo chức năng

Được người dùng yêu cầu triển khai lần lượt ngày 26/10/2026. Mỗi phần cần có API/UI, phân quyền, migration mới nếu cần, kiểm thử phù hợp và commit ngắn gọn rồi push.

| Thứ tự | Chức năng | Trạng thái |
| --- | --- | --- |
| 1 | Luyện tập cá nhân, chấm điểm, giải thích, lưu bài và ôn câu sai | Đã triển khai trong 0.6.0 |
| 2 | Tiến độ, lịch sử và mục tiêu mỗi ngày | Đã triển khai trong 0.6.0 |
| 3 | Ranking toàn hệ thống, Glicko-2, ghép 1–1, hai bảng N5/N4 | Bản đầu đã triển khai 0.7.0; cần mở rộng ngân hàng và nghiệm thu thực tế |
| 4 | Chat: sửa/xóa, trả lời, ghim, lưu trạng thái đọc và bản nháp | Đã triển khai bản đầu 0.8.0 |
| 5 | Nhóm: thông tin, vai trò, loại thành viên, kiểm duyệt | Lời mời cần chấp nhận đã có 0.7.0; các công cụ quản trị còn lại chưa triển khai |
| 6 | Cuộc gọi: chọn thiết bị, chia sẻ màn hình, lịch sử | Chưa triển khai |
| 7 | Tài liệu: preview, quota, xóa và dọn file an toàn | Chưa triển khai |
| 8 | Tài khoản: đổi/khôi phục mật khẩu, nhớ đăng nhập, quản lý phiên | Chưa triển khai |
| 9 | AI: tạo quiz và hỗ trợ học với dữ liệu/quyền truy cập phù hợp | Cần chọn nhà cung cấp/cấu hình khi triển khai |
| 10 | Phát hành: cập nhật ứng dụng, Internet/TURN/SFU | Cần máy chủ/tên miền khi triển khai Internet |

## Quyết định ranking đã chốt

Ranking bao gồm mọi người dùng trên cùng backend. Đấu xếp hạng 1–1 tự ghép, hai bảng N5/N4, Glicko-2, 5 trận phân hạng và mùa 8 tuần là phương án đã đề xuất và được chấp thuận để triển khai. Battle nhóm thông thường và luyện tập cá nhân không cộng rating. Hệ thống chọn câu, không sử dụng quiz cá nhân trong trận xếp hạng. Cần mở rộng ngân hàng và kiểm tra lặp đối thủ trước khi coi ranking có tính cạnh tranh đáng tin cậy.

## Phạm vi hạ tầng

Ưu tiên LAN theo quyết định trước đó. Tự động commit/push không có nghĩa tự mua dịch vụ hoặc đưa dữ liệu cá nhân lên dịch vụ AI. Đến phần cần cấu hình bên ngoài sẽ hỏi thông tin thiếu; các phần độc lập tiếp tục phát triển.
