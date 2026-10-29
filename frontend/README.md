# ChisikiRoom Web

Package web cùng cấp với `desktop`, dùng lại React UI, hooks và kiểu dữ liệu trong `desktop/src`. Không sao chép các màn hình và không tải Electron vào trình duyệt.

## Chạy phát triển

Từ thư mục gốc:

```powershell
npm install
npm run web
```

Mở `http://localhost:5174`. Backend/database chạy như trước bằng `npm run db` và `npm run backend`. Vite chuyển tiếp `/api`, `/ws` và `/actuator/health` đến `http://127.0.0.1:8080`. Có thể sao chép `.env.example` của package này thành `frontend/.env` và đổi `BACKEND_URL` khi backend ở máy khác. Thay `.env` xong cần khởi động lại Vite.

Nếu dùng backend AWS thay cho backend local, đặt `BACKEND_URL=https://api.nguyenxuanan.id.vn` và để `VITE_API_URL=` trống trong `frontend/.env`. Trên giao diện chọn **Máy chủ website** rồi **Lưu địa chỉ** để bỏ địa chỉ khác origin đã lưu trước đó. Web local sẽ gọi cùng origin của Vite, còn Vite gửi request đến AWS. Proxy đổi Host theo upstream, và kết nối WS upstream xác thực STOMP Bearer như Electron, không chuyển Origin của trang local sang AWS. Chỉ chạy dev server trên loopback như cấu hình mặc định.

Kiểm tra `http://localhost:5174/actuator/health`: phải trả về JSON `{"status":"UP"}`. HTTP 500 kèm `ECONNREFUSED` trong terminal Vite thường là backend đích chưa chạy/sai cổng. Trang HTML thay cho JSON thường là cấu hình proxy thiếu. Nếu gọi trực tiếp backend khác origin, trình duyệt có thể chặn CORS dù mở URL health ở tab mới vẫn được. Nút kiểm tra ghi endpoint, HTTP status hoặc loại lỗi vào F12 → Console, không ghi token/mật khẩu.

## Build

```powershell
npm run build:web
```

Kết quả là `frontend/dist`, có thể phục vụ bằng Nginx. `npm run preview` bên trong frontend chỉ xem thử static build; preview không có proxy backend như dev server.

## Cấu trúc

- `src/browserAdapter.ts`: HTTP Bearer, STOMP/WebSocket, chọn/tải file và vòng đời phiên trong trình duyệt.
- `src/WebWorkspace.tsx`: khung web, mở chức năng trong trang và modal cuộc gọi đến. Dashboard vẫn được giữ để nhận realtime và lưu bản nháp.
- `src/main.tsx`: cài browser adapter trước khi mount giao diện chung.
- `../desktop/src/app/App.tsx`: giao diện đăng nhập và theme chung; desktop giữ entry riêng trong main.tsx.
- `../desktop/electron/api-routes.mjs`: bảng ánh xạ API dùng chung cho Electron và web.

## Đăng nhập và media

Token chỉ giữ trong bộ nhớ, không lưu localStorage/sessionStorage. Reload/đóng trang phải đăng nhập lại. Chỉ địa chỉ backend được lưu trong localStorage. Mỗi tab có phiên riêng. Khi đăng xuất hoặc hết phiên, frontend ngừng STOMP và đóng phần chức năng đang mở.

Chọn **Máy chủ website** trong cài đặt kết nối để dùng API cùng origin. `VITE_API_URL` chỉ là cấu hình công khai lúc build, tuyệt đối không đặt mật khẩu/key tại đây. Nếu chọn backend khác origin, phía backend cần cấu hình CORS và WebSocket cho origin web cụ thể; bản mặc định ưu tiên proxy cùng origin để không mở rộng chính sách backend.

Camera/microphone cần HTTPS hoặc localhost. Người dùng phải cấp quyền trong trình duyệt. Gọi giữa các mạng vẫn cần cấu hình TURN phía backend. Trình duyệt có thể hạn chế tự phát âm thanh/chuông trước khi người dùng tương tác. Bản web dùng hộp thoại trong trang, không có cửa sổ hệ điều hành riêng như Electron.

Nút **Quay về trò chuyện** lưu ý bộ quiz chưa lưu và gửi leave cho call/Battle trước khi đóng. Đóng tab gửi leave best-effort, server vẫn dùng heartbeat/timeout nếu trình duyệt không gửi được. Không bảo đảm giữ cuộc gọi khi tab bị hệ điều hành đình chỉ.

## Đưa lên EC2 hiện tại

1. Build frontend trên máy phát triển hoặc CI.
2. Chuyển nội dung `frontend/dist` đến `/var/www/chisikiroom` trên EC2.
3. Dùng mẫu `infrastructure/nginx/chisikiroom-web.conf` cho tên miền web; `/api` và `/ws` cùng đi đến backend đang chạy ở 127.0.0.1:8080.
4. Trỏ DNS của tên miền web đến EC2, mở 80/443 và cấp HTTPS bằng Certbot.
5. Mở website, giữ backend cùng origin của website; kiểm tra đăng nhập, realtime và gọi từ hai thiết bị.

Trong `.env` của backend trên EC2, giữ nguyên mật khẩu và thêm `SERVER_ADDRESS=127.0.0.1`, `SERVER_FORWARD_HEADERS_STRATEGY=framework`, sau đó `sudo systemctl restart chisikiroom`. Spring Boot cần nhận scheme HTTPS từ Nginx để kiểm tra Origin của WebSocket đúng. Chỉ bật xử lý forwarded headers khi backend được giữ sau proxy tin cậy; không mở public cổng 8080. Mẫu Nginx gửi lại Host và X-Forwarded-Proto cho API/WebSocket. Sau khi Certbot thêm HTTPS, giữ các proxy header này trong server block HTTPS.

Không ghi đè cấu hình Nginx đang dùng cho `api.nguyenxuanan.id.vn`. Mẫu là server block riêng cho tên miền chính. Static frontend không cần Node.js chạy liên tục trên EC2. Không cần tạo database mới hay chuyển dữ liệu lại.

## Kiểm tra

`npm run test:web` tại thư mục gốc chạy Chrome headless với backend HTTP/STOMP giả lập riêng cổng 18190, dev server 5184 (đổi bằng WEB_TEST_PORT). Kiểm tra REST có Bearer, STOMP qua proxy, mở/đóng quiz, upload/download, modal nhận cuộc gọi, leave và mất phiên khi reload. Không ghi dữ liệu vào backend thật. Cần Chrome đã cài trên máy; không cần dừng dev server 5174 đang sử dụng.
