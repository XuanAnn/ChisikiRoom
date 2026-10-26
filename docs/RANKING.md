# Ranking toàn hệ thống — 0.7.0

## Sử dụng

Mở Xếp hạng, chọn N5 hoặc N4 rồi Tìm trận xếp hạng. Giữ trang mở để gửi heartbeat. Hệ thống ghép hai người gần rating, mở hai cửa sổ Battle. Cả hai bật camera và chọn sẵn sàng; worker tự bắt đầu, không cần chủ trận bấm bắt đầu.

- 10 câu/trận, 15 giây/câu; điểm câu hỏi giữ luật +10/−5.
- Bảng riêng N5 và N4, gồm mọi tài khoản cùng backend. Không so sánh các backend độc lập.
- Ban đầu 1500, RD 350, volatility 0.06. Năm trận đầu là phân hạng; bảng chính hiển thị tối đa 100 người đủ năm trận trong mùa.
- Mùa 56 ngày, neo UTC từ 05/01/2026. Mùa mới bắt đầu với rating (rating mùa trước + 1500)/2, RD tối thiểu 200, số trận mùa đặt lại 0; lịch sử cũ vẫn lưu.
- Một cặp không ghép lại trong 5 phút và không quá 3 trận/cặp/24 giờ. Phạm vi ghép ban đầu ±200, tăng 5 điểm mỗi giây chờ, tối đa ±600.
- Mất heartbeat hàng chờ 20 giây: hủy tìm. Lobby 60 giây chưa bắt đầu: hủy, không tính hạng. Rời trận đang chạy tính thua nếu đối thủ vẫn hoạt động. Cả hai bị loại: không tính hạng.
- Khi kết thúc, Battle lưu kết quả bất biến trước khi người chơi đóng cửa sổ. Ranking dùng thắng/hòa/thua đã đóng băng, không đọc lại trạng thái LEFT sau đó để đổi người thắng.
- Trận thường và luyện tập không cộng rating.

## Thuật toán và tính nhất quán

Glicko-2 theo tài liệu của Mark Glickman: https://www.glicko.net/glicko/glicko2.pdf. Tau = 0.5; một trận hoàn tất được coi là một rating period để phản hồi ngay trong ứng dụng LAN. Đây là lựa chọn triển khai, khác với khuyến nghị gom nhiều trận trong một period của tài liệu gốc. Đã kiểm thử bằng ví dụ tham chiếu 1464.06 / RD 151.52 / volatility xấp xỉ 0.059996. Mỗi ngày không hoạt động tăng độ bất định, giữ nguyên rating, RD tối đa 350.

Các lệnh queue, worker và chốt kết quả khóa row ranking_guard trước khi thay đổi dữ liệu. Hai profile, lịch sử trước/sau và trạng thái RATED cùng commit; xử lý lại bỏ qua trận đã chốt. Thứ tự khóa ranking_guard → Battle, không có lời gọi ngược từ Battle sang ranking. Khóa toàn module phù hợp quy mô LAN hiện tại; chưa phải thiết kế đã kiểm thử tải cho lượng người dùng lớn.

## Ngân hàng câu hỏi

40 câu tự soạn, 20 câu mỗi mức, lưu qua ORM vào ranked_questions khi khởi động; UUID cố định không tạo trùng. Không xuất qua API thư viện quiz. Server bốc 10 câu và đảo phương án, đóng băng snapshot trong Battle trước khi bắt đầu. Client chỉ nhận đáp án đúng sau khi câu đã chốt.

Ngân hàng hiện nhỏ và câu có thể lặp giữa các trận. Đây là bản ranking ban đầu, cần mở rộng nội dung và đánh giá thực tế trước khi coi là thước đo kỹ năng đáng tin cậy. Camera là điều kiện tham gia, không phải cơ chế chống gian lận hoàn chỉnh.

## Migration

V12 thêm ranking profiles, queue, matches, questions, guard và metadata ranked vào Battle. JPA/repository thao tác dữ liệu; SQL chỉ quản lý schema và row guard cố định. V1–V11 không chỉnh sửa.
