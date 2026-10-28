# ChisikiRoom Web

Package web cùng cấp với `desktop`, dùng lại React UI, hooks và kiểu dữ liệu trong `desktop/src`. Không sao chép các màn hình và không tải Electron vào trình duyệt.

## Chạy phát triển

Từ thư mục gốc:

```powershell
npm install
npm run web
```

Mở `http://localhost:5174`. Backend/database chạy như trước bằng `npm run db` và `npm run backend`. Vite chuyển tiếp `/api`, `/ws` và `/actuator/health` đến `http://127.0.0.1:8080`. Có thể sao chép `.env.example` của package này thành `frontend/.env` và đổi `BACKEND_URL` khi backend ở máy khác. Thay `.env` xong cần khởi động lại Vite.

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

Không ghi đè cấu hình Nginx đang dùng cho `api.nguyenxuanan.id.vn`. Mẫu là server block riêng cho tên miền chính. Static frontend không cần Node.js chạy liên tục trên EC2. Không cần tạo database mới hay chuyển dữ liệu lại.

## Kiểm tra

`npm run test:web` tại thư mục gốc chạy Chrome headless với backend HTTP/STOMP giả lập riêng cổng 18190, dev server 5174. Kiểm tra REST có Bearer, STOMP qua proxy, mở/đóng quiz, upload/download, modal nhận cuộc gọi, leave và mất phiên khi reload. Không ghi dữ liệu vào backend thật. Cần Chrome đã cài trên máy; đóng dev server 5174 trước khi chạy test.
