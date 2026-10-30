# Quản trị server ChisikiRoom

Trang quản trị chạy trực tiếp trên Spring Boot, độc lập với desktop/frontend. Không cần build React.

## Khởi chạy

1. Tạo khóa ngẫu nhiên từ 32 đến 256 ký tự và đặt `CHISIKI_ADMIN_KEY` trong môi trường backend hoặc `.env` khi chạy bằng script gốc. Không commit khóa thật.
2. Khởi động lại backend bằng `npm run backend` (hoặc dịch vụ systemd trên EC2).
3. Mở `http://IP-SERVER:8080/admin.html` trong LAN hoặc `https://TEN-MIEN-API/admin.html` khi triển khai HTTPS.
4. Nhập khóa quản trị. Khóa chỉ nằm trong bộ nhớ trang, không lưu localStorage/cookie và không gửi qua URL. Dùng HTTPS khi truy cập qua Internet.

PowerShell tại máy phát triển, tạo khóa và chạy backend trong cùng terminal:

```powershell
$env:CHISIKI_ADMIN_KEY = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:CHISIKI_ADMIN_KEY
npm run backend
```

Nếu PowerShell/.NET cũ không hỗ trợ các hàm trên, có thể tạo khóa bằng `openssl rand -hex 32` hoặc công cụ quản lý mật khẩu.

## Chức năng

- Xem tối đa 1.000 người dùng mới nhất, tên, email, IP và thời điểm request xác thực gần nhất; tìm theo tên/email/IP.
- Thu hồi toàn bộ phiên đăng nhập của một người dùng. Request xác thực tiếp theo bị từ chối; không xóa tài khoản, tin nhắn hoặc dữ liệu học tập. Không tuyên bố đã đóng ngay transport WebSocket hiện hữu.
- Xem tối đa 200 cuộc gọi ACTIVE và 200 trận WAITING/IN_PROGRESS, người tham gia, IP, trạng thái và điểm Battle.
- Nhật ký tối đa 500 sự kiện phát qua STOMP sau commit: thời điểm, người thao tác, IP gửi, người nhận/IP, loại sự kiện; nội dung chat tối đa 1.000 ký tự và loại signaling. Không lưu token, mật khẩu hoặc payload SDP/ICE.
- Tự cập nhật mỗi 3 giây; ngắt kết nối sẽ xóa dữ liệu đang hiển thị.

## Ý nghĩa dữ liệu

IP là địa chỉ server quan sát từ request đã xác thực, không có port. Có thể là IP NAT dùng chung, IP VPN hoặc proxy, không nhất thiết là IP LAN của thiết bị. Giá trị gần nhất được giữ tối đa 5.000 người dùng trong bộ nhớ. Chưa phát request xác thực sau khi server khởi động sẽ hiện “Chưa ghi nhận”. Hoạt động gần đây không đồng nghĩa đang online.

Nhật ký chỉ bắt đầu từ lúc chạy phiên bản này, giữ trong RAM và mất khi restart. Người nhận là đối tượng được server phát sự kiện (có thể gồm chính người gửi), không phải xác nhận đã đọc/nhận. Sự kiện từ worker hiển thị Server. Media WebRTC P2P/TURN không đi qua backend nên trang không xem được video hay từng gói UDP.

## Nginx / EC2

Nginx cần chuyển `/admin.html`, `/admin.js`, `/admin.css` và `/api/admin/` tới backend. Cấu hình reverse proxy API chuyển toàn bộ đường dẫn thì không cần thêm route. Kiểm tra cấu hình thực tế trước khi dùng.

Mặc định bỏ qua `X-Forwarded-For`. Nếu Nginx cùng máy kết nối backend qua loopback, đặt `CHISIKI_ADMIN_TRUSTED_PROXIES=127.0.0.1,0:0:0:0:0:0:0:1,::1`. Nginx phải dùng `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`. Chỉ tin địa chỉ proxy mình quản lý; firewall backend giới hạn truy cập phù hợp. Bộ giải địa chỉ lấy hop cuối do Nginx thêm, không lấy IP đầu client có thể tự khai. Không bật tin proxy cho toàn bộ subnet người dùng.

Không đặt khóa trong cấu hình desktop hoặc mã JavaScript. Chưa cấu hình khóa đủ dài thì mọi API quản trị trả 403. Trang và API không tự tạo user quản trị trong database.
