# Kiểm tra ChisikiRoom LAN

## Bản 0.4.0 — giao diện, chức năng chính và hộp thoại có chuông

Ngày 26/10/2026:

- Bố trí mới: sidebar bạn bè/nhóm giữ cuộn độc lập và ẩn scrollbar; tổng quan có thống kê thật/nhóm/quiz; khung chat ở giữa; thành viên, tài liệu và Battle ở bảng phải có thể thu gọn. Có bộ lọc tên không dấu, sắp xếp quiz, bản nháp theo phòng, bộ đếm tin mới trong phiên và chọn bạn bè khi mời nhóm.
- Tìm tin nhắn mới qua REST/IPC, repository JPQL, kiểm tra quyền thành viên, escape ký tự LIKE, 2–100 ký tự, keyset pagination 50 kết quả/trang. Schema V8 và migration cũ không đổi.
- Người nhận thấy BrowserWindow riêng, không chỉ banner trong chat. Main process kiểm tra snapshot/quyền, lọc lời mời trùng, xác thực cửa sổ phản hồi và không tự bật thiết bị. Nhận dùng join call ID đang tồn tại, tránh vô tình tạo cuộc gọi mới khi lời mời hết hạn. Có chuông WebAudio hai âm cục bộ, nút bật/tắt; dừng khi xử lý/đóng/đăng xuất/hết thời gian/cuộc gọi kết thúc.
- Backend: 27 kiểm thử qua (21 API/nghiệp vụ, 3 HTTP error dispatch, 1 ranh giới module, 2 rollback upload). Ca tìm kiếm mới xác nhận quyền, phân trang, hoa/thường và wildcard literal.
- `npm run build`, `npm run format:check` và 3 kiểm thử phiên đăng nhập Node qua. Vite vẫn cảnh báo kích thước chunk chung; build thành công.
- PostgreSQL thử riêng: REST/STOMP, file permissions, Battle race/outbox, direct-chat race và cuộc gọi race/authorization đều qua.
- Ba bài Electron từ mã nguồn và từ payload Windows đóng gói `release/win-unpacked/ChisikiRoom.exe` đều qua. Kiểm tra mới: tìm lịch sử thật qua UI; mời bạn từ dropdown; lọc quiz; khôi phục draft giữa hai phòng; unread nhận/đánh dấu khi mở; lọc sidebar không dấu và tổng quan; viewport tối thiểu 900×650.
- Cuộc gọi: popup xuất hiện khi main window thu nhỏ; Electron `isCurrentlyAudible()` xác nhận chuông đang phát và trở về false khi tắt. Nhận, từ chối và bên gọi hủy đều được kiểm tra; video hai chiều, chỉ nhận media và nhóm ba người vẫn qua với thiết bị giả. Chưa thay thế nghiệm thu nhiều máy/camera/mic thật.
- Đã xem ảnh `.runtime/overview-preview.png`, `.runtime/overview-real-preview.png`, `.runtime/chat-preview.png`, `.runtime/incoming-call-preview.png` và sidebar ở kích thước tối thiểu.
- Đã dừng/xóa database thử. Backend thật cổng 8080 chạy 0.4.0, health `UP`; container PostgreSQL healthy. Không tạo tài khoản thử vào database người dùng.

Artifact: `release/ChisikiRoom-0.4.0-Windows-x64.exe` và SHA-256; `backend/target/backend-0.4.0.jar`. Cần dùng desktop 0.4.0 để có giao diện/popup/chuông mới. Unread và draft hiện chỉ giữ trong phiên, chưa đồng bộ nhiều thiết bị hoặc sau khi mở lại ứng dụng.

## Backend 0.3.3 — container PostgreSQL và repository theo module

Ngày 26/10/2026:

- Docker Linux engine đã hoạt động trở lại; `npm run db` chạy container `chisikiroom-postgres-1` healthy trên `127.0.0.1:5433`. Không reset Docker hay volume. Giới hạn kiểm tra PostgreSQL ghi ở bản 0.3.2 bên dưới đã được giải quyết.
- Backend 0.3.2 được kiểm tra lại trên PostgreSQL thật trước khi tiếp tục refactor. Sau đó tách `ChatRepository`, `BattleRepository`, `CallRepository`, `SessionRepository`; xóa phụ thuộc generic persistence không dùng ở quiz. Service không còn dùng `JpaStore` hoặc EntityManager trực tiếp. Chat member projection dùng record có tên thay cho `Object[]` trong service.
- Kiểm tra ranh giới module bổ sung chặn generic persistence/JPA và HTTP multipart/authentication context trong application. Controller `/me` đọc principal ở tầng HTTP; service auth tập trung vào tài khoản và phiên.
- `mvn -f backend/pom.xml package`: 26 kiểm thử qua; artifact `backend/target/backend-0.3.3.jar`. `npm run format:check` qua.
- PostgreSQL với database thử riêng: REST/STOMP, phân quyền phòng/file, reconnect, Battle last-seat contention, winner/score/outbox đều qua. Bổ sung các ca mở chat riêng đồng thời từ hai phía chỉ tạo một phòng; tranh chấp chỗ cuối cuộc gọi chỉ nhận một người; một tài khoản join hai cuộc gọi đồng thời chỉ thành công ở một cuộc; signaling chỉ cho thành viên cuộc gọi.
- Ba bài Electron từ mã nguồn kết nối backend 0.3.3 + PostgreSQL qua: gọi bạn bè/nhóm ba người; chat/reaction/quiz/Battle media; sidebar và phiên đăng nhập.
- Server/database thử đã dừng và xóa. Backend thật cổng 8080 được chuyển sang 0.3.3, health `UP`; schema V8 giữ nguyên, không tạo tài khoản thử trong database người dùng. Desktop 0.3.0 tiếp tục tương thích.

## Backend 0.3.2 — tách controller/service/repository

Ngày 26/10/2026:

- Tách hồ sơ/avatar, bạn bè, reaction và tài liệu thành application service và repository riêng. Controller giữ việc chuyển đổi HTTP và dựng response; service không nhận `Authentication`/`MultipartFile`. Tách filesystem vào `UploadStorage`, kiểm tra nội dung tài liệu vào `DocumentContentPolicy`, presence vào `UserPresence`.
- 26 kiểm thử backend qua: 20 API/nghiệp vụ, 3 HTTP error dispatch, 1 ranh giới module và 2 ca upload rollback mới. Hai ca mới dùng giao dịch JPA thật, mô phỏng lỗi trước commit và xác nhận metadata rollback cùng việc xóa file mới cho avatar/tài liệu.
- Bài ranh giới module chặn controller import infrastructure/JPA, thao tác filesystem hoặc giữ `TransactionTemplate`.
- `npm run format:check` qua; backend đóng gói thành `backend/target/backend-0.3.2.jar`. API, JSON response và migration V1–V8 giữ nguyên; desktop 0.3.0 tiếp tục tương thích.
- Ba bài Electron từ mã nguồn qua với backend 0.3.2 và H2 in-memory ở cổng 18080: gọi bạn bè/nhóm ba người; chat/reaction/quiz/Battle media; sidebar và phiên đăng nhập. Server H2 tạm đã dừng, không dùng database thật cho các bài này.

Giới hạn kiểm tra lần này: Docker Desktop chưa chạy được Linux engine. Khởi động báo lỗi `initializing Inference manager ... dockerInference ... The file cannot be accessed by the system`; `npm run db` không kết nối được `dockerDesktopLinuxEngine`. Vì vậy chưa chạy lại kiểm tra PostgreSQL và chưa khởi động backend 0.3.2 với database thật. Không reset Docker, không đổi schema/dữ liệu người dùng. Không suy rộng kết quả H2 thành nghiệm thu khóa PostgreSQL.

## Chuẩn hóa mã nguồn dễ đọc

Ngày 26/10/2026: định dạng Java/React/TypeScript/Electron/CSS/test/script, tách khai báo biến, thêm khối điều kiện/vòng lặp rõ ràng, đổi tên biến nội bộ ở các service chính và tách điều hướng màn hình chính thành các nhánh `if`. Thêm `.editorconfig`, Prettier và quy ước trong `AGENTS.md`; không sửa migration Flyway đã áp dụng.

Kiểm tra qua: `npm run format:check`, TypeScript/Vite build, 24 kiểm thử backend, 3 kiểm thử phiên đăng nhập Node và 3 bài Electron từ mã nguồn (gọi video, chat/quiz/Battle, sidebar). Electron dùng database PostgreSQL thử riêng, đã dọn sau khi hoàn tất. Đây là thay đổi cách trình bày và cấu trúc mã, không thêm tính năng hay yêu cầu cài lại desktop.

## Backend 0.3.1 — ORM

Ngày 26/10/2026:

- `mvn -f backend/pom.xml clean package`: 24 kiểm thử qua (20 nghiệp vụ/API, 3 HTTP error dispatch, 1 ranh giới module).
- Hai ca ORM mới xác nhận rollback cả entity đã sửa và dòng mới sau khi flush; entity đã cache được refresh sau khi lấy khóa ghi và nhìn thấy commit của giao dịch khác. Đăng ký trùng email vẫn trả 409.
- Đã ánh xạ 19 bảng thành entity; không còn `JdbcClient`, JDBC row mapper hoặc native SQL trong Java production. Bài kiểm tra ranh giới module chặn việc đưa JDBC/native query trở lại.
- PostgreSQL thử nghiệm: Hibernate validate mapping thành công trên schema do V1–V8 tạo. REST/STOMP, phân quyền file, tranh chấp chỗ cuối Battle, hai đáp án đúng đồng thời, score ledger và outbox đều qua.
- Ba bài Electron qua với executable đóng gói 0.3.0 kết nối backend ORM 0.3.1: gọi bạn bè/nhóm ba người; chat/quiz/Battle camera/mic; sidebar và phiên đăng nhập. API và client giữ tương thích.
- Server/database thử đã dừng và xóa. Backend thực tế được thay bằng 0.3.1 ở cổng 8080, Hibernate validate schema V8 hiện có và health trả `{"status":"UP"}`. Không cần migration mới, không tạo tài khoản thử vào database người dùng.

Artifact backend: `backend/target/backend-0.3.1.jar`. Desktop portable 0.3.0 tiếp tục sử dụng được, không cần đóng gói lại cho thay đổi persistence. Các giới hạn nghiệm thu camera/máy vật lý và Internet ở bản 0.3.0 vẫn áp dụng. Xem [persistence](PERSISTENCE.md).

## Bản 0.3.0

Ngày 25/10/2026:

- `mvn -f backend/pom.xml clean package`: 22 kiểm thử qua (18 API/nghiệp vụ, 3 HTTP error dispatch, 1 ranh giới module). Thêm kiểm tra cuộc gọi riêng/nhóm, consent, quyền signaling, giới hạn 4 người, từ chối/rời, cuộc gọi đồng thời của một tài khoản, timeout và camera tùy chọn.
- TypeScript và Vite production build qua. Cảnh báo chunk chung trên 500 kB vẫn còn, không làm build thất bại.
- Ba kiểm thử Node về phiên đăng nhập qua.
- REST/STOMP và tranh chấp Battle qua PostgreSQL thật trên database thử nghiệm riêng đều qua; database thử đã được xóa sau khi dừng server thử.
- Ba bài Electron chạy với payload Windows đóng gói `release/win-unpacked/ChisikiRoom.exe` của bản portable 0.3.0 đều qua: gọi bạn bè và nhóm ba người ngoài Battle; chat/quiz/Battle với video hai chiều và mic; sidebar độc lập, ẩn scrollbar và không logout nhầm.
- Bài gọi video kiểm tra lời mời/nhận cuộc gọi, không tự mở thiết bị, chế độ chỉ nhận media theo cả hai thứ tự UUID offer/answer, bật/tắt camera/mic, nhóm ba chiều và rời/kết thúc. Offer chưa được trả lời được gửi lại để xử lý cửa sổ người nhận mở sau thời điểm signaling đầu tiên.
- Đã xem ảnh giao diện nhóm ba người trong `.runtime/group-call-preview.png`. Thiết bị giả được dùng cho các phiên Electron; chưa nghiệm thu bằng camera/mic và nhiều máy vật lý.
- Backend thực tế khởi động ở cổng 8080, nâng schema V7 → V8 thành công; health trả `{"status":"UP"}`. Không tạo tài khoản thử vào database người dùng trong lần kiểm tra này.

Artifact: `release/ChisikiRoom-0.3.0-Windows-x64.exe` và SHA-256 đi kèm; backend jar `backend/target/backend-0.3.0.jar`. SFU, FastAPI và triển khai Internet chưa có trong bản này. Xem `ARCHITECTURE.md` để phân biệt phần đã tách tầng và các controller/persistence còn cần chuyển dần.

## Bản 0.2.2

Ngày 25/10/2026: 19 kiểm thử backend đều qua, gồm 3 ca HTTP với Tomcat thật để kiểm tra error dispatch: 404 và 500 không bị đổi thành 401; các API và `/error` vẫn từ chối request không xác thực. Ba kiểm thử Node riêng xác nhận chỉ phản hồi 401 của `/api/auth/me` mới xác nhận phiên hết hạn; lỗi mạng hoặc lỗi server không buộc đăng xuất.

Kiểm thử Electron sidebar tái hiện API mở chat trả 401 trong khi `/me` trả 200: ứng dụng giữ màn hình chat, báo lỗi và có thể thử lại thành công. Khi cả thao tác và `/me` trả 401, ứng dụng trở về login đúng như yêu cầu.

Ca hồi quy trên đã qua với cả mã nguồn và executable Windows đóng gói 0.2.2.

Đã kiểm tra thêm trên PostgreSQL thật tại backend đang dùng: hai tài khoản tạm kết bạn, mở cùng một chat riêng từ hai phía, gửi/đọc tin nhắn; API không tồn tại trả 404 và phiên vẫn hợp lệ. Các tài khoản và dữ liệu tạm đã được xóa sau kiểm tra.

## Bản 0.2.1

Ngày 25/10/2026: 16 kiểm thử backend đều qua, gồm quyền chat bạn bè, tên người đối diện, ngăn người thứ ba truy cập và mở đồng thời chỉ tạo một cuộc trò chuyện. Build TypeScript/Vite thành công.

Kiểm thử Electron riêng cho sidebar dùng 40 bạn bè và 40 nhóm: bạn bè nằm trên, nhóm nằm dưới; mỗi phần cuộn bằng con lăn độc lập, không chiếm chiều rộng cho scrollbar; chat riêng không xuất hiện trong nhóm; footer vẫn hiện khi cửa sổ thu nhỏ. Kiểm thử này dùng API giả để tập trung vào hành vi và bố cục; quyền chat riêng được kiểm thử bằng API/backend thật trong bộ kiểm thử H2.

Lệnh chạy riêng kiểm tra sidebar: `npm --prefix desktop run test:e2e -- sidebar.spec.cjs`. Không cần backend đang chạy cho bài kiểm tra bố cục này.

Kiểm tra sidebar đã qua với cả bản mã nguồn và executable Windows đã đóng gói. Portable cập nhật: `release/ChisikiRoom-0.2.1-Windows-x64.exe`.

## Bản 0.2.0

Ngày kiểm tra cuối: 25/10/2026. Môi trường Windows x64, Java 21, PostgreSQL 17 và Electron 42. Database thử nghiệm tách khỏi database người dùng; backend thử nghiệm dùng cổng 18080.

| Kiểm tra | Kết quả |
| --- | --- |
| Maven package và kiểm thử API/nghiệp vụ | 14 ca, 0 lỗi, 0 ca bỏ qua |
| REST và STOMP với PostgreSQL thật | Qua: hai client nhận tin, lịch sử reconnect, từ chối truy cập phòng riêng/subscription của người khác |
| File và bạn bè | Qua: lời mời/đồng ý, upload/download có xác thực, chặn người ngoài và nội dung file sai định dạng |
| Battle trên PostgreSQL thật | Qua: một suất cuối, một winner, điểm +10/−5, sự kiện outbox và điều kiện camera |
| Electron từ mã nguồn | Qua: chat/reaction, cửa sổ quiz riêng, lưu quiz, hai client video hai chiều, bật/tắt mic và nhận audio, trả lời và kết thúc trận |
| Electron đã đóng gói | Cùng luồng kiểm tra đầy đủ, chạy 2 lần liên tiếp, đều qua |
| Portable Windows x64 | Tạo thành công `release/ChisikiRoom-0.2.0-Windows-x64.exe` |

Kiểm thử Electron dùng camera/microphone giả, không ghi hình hoặc thu âm người dùng. Kiểm thử bản đóng gói chạy executable trong `release/win-unpacked` của cùng gói portable. Chưa xác minh bằng hai máy vật lý, thiết bị thật, router/tường lửa LAN hoặc TURN trên Internet.

Lỗi video một chiều được khắc phục bằng cách để một peer tạo offer và gắn track ở phía trả lời vào các transceiver của offer nhận được. Cả video và audio được kiểm tra từ phía client đối diện, không chỉ từ preview cục bộ. Đổi camera/mic dùng `replaceTrack`; khi realtime reconnect thì tạo lại peer.

Ảnh kiểm tra và log nằm trong `.runtime`. Hướng dẫn nghiệm thu hai máy thực nằm trong `LAN_GUIDE.md`.


## Desktop 0.4.1 — bố cục video

- TypeScript/Vite build và format:check đạt.
- Hai bài Electron calling.spec và desktop.spec đạt: gọi 1–1, nhóm ba người, Battle; xác nhận kích thước camera cá nhân, vị trí lưới nhóm và camera Battle trên/phải.
- Kiểm tra thu nhỏ cửa sổ gọi nhóm 620×600 và xem ảnh chụp thực tế của cuộc gọi, nhóm, Battle.
- Backend/schema không thay đổi, dùng backend 0.4.0 và V8.


## Desktop 0.4.2 — video tự phát

- Cửa sổ call/Battle cho phép autoplay; component Video tự thử lại khi loadedmetadata, canplay, thêm track, track unmute và định kỳ khi đang tạm dừng. Dọn listener/timer khi đổi stream hoặc đóng component.
- Build và format:check đạt. Hai bài Electron calling.spec và desktop.spec đạt (35,4 giây), gồm nhận video không bật camera, gọi nhóm và Battle. Kiểm thử bổ sung tạm dừng video từ xa rồi xác nhận tự phát lại mà không bấm nút.
- Backend 0.4.0/schema V8 giữ nguyên.


## 0.5.0 — thư viện tiếng Nhật dùng sẵn

- Backend: 29 kiểm thử đạt, gồm 10 bộ/100 câu có đủ 4 lựa chọn khác nhau, đúng 5 bộ mỗi mức; hai tài khoản cùng đọc bộ mẫu; PUT mẫu bị từ chối, bản sao cá nhân không bị lộ; nạp lại không trùng/ghi đè; tạo và bắt đầu Battle từ bộ dùng chung, không lộ đáp án trong round.
- PostgreSQL 17: áp dụng V9 trên database kiểm thử sạch và database thật V8; ORM nạp thành công 10 bộ. Database thật vẫn giữ đủ 2 bộ cá nhân đã có; có bản pg_dump trước cập nhật trong .runtime.
- Electron desktop.spec đạt (17,1 giây): lọc 5 bộ N5, mở 10 câu mẫu, chỉnh tên và lưu bản sao, kiểm tra mẫu vẫn đủ 10 và bản sao thuộc đúng người dùng. Luồng chat/quiz/Battle cũ vẫn đạt.
- TypeScript/Vite build và format:check đạt. Backend 0.5.0 chạy trên 8080.


## 0.6.0 — luyện tập cá nhân và tiến độ

- 31 kiểm thử backend đạt: bài lưu/tiếp tục được, đáp án chưa lộ trong snapshot đang làm, quyền sở hữu, số lựa chọn hợp lệ, chấm snapshot gốc khi quiz đã thay đổi, kết quả bất biến và nộp lặp không tính hai lần, chỉ ôn câu sai/bỏ qua, mục tiêu riêng tài khoản 1–200, chỉ bài đã nộp tính thống kê, đổi ngày đúng theo giờ Việt Nam.
- PostgreSQL: migration V10 tạo practice_attempts; V11 tạo learning_goals. Nâng database kiểm thử V10 lên V11 giữ lịch sử đã có. Dữ liệu qua JPA/repository, không dùng SQL thao tác nghiệp vụ.
- Electron: desktop.spec và practice.spec đạt (22,4 giây). Thử chọn đáp án, đóng cửa sổ rồi mở lại từ lịch sử, nộp bài một câu đúng được 10%, hiện giải thích và tạo bài ôn 9 câu còn lại. Đổi mục tiêu 5 câu và kiểm tra API thống kê 1 lượt/1 câu đã chọn.
- TypeScript/Vite build, format:check đạt. Đã xem ảnh cửa sổ luyện tập trong .runtime/practice-preview.png.
- Bản 0.6.0 chỉ hoàn thành hai phần đầu của lộ trình; ranking/chat nâng cao/quản lý nhóm và các phần tiếp theo chưa được triển khai trong bản này.


## 0.7.0 — ranking và chấp nhận lời mời nhóm

- 38 kiểm thử backend đạt. Glicko-2 khớp ví dụ gốc; inactivity tăng RD, giữ rating. Kiểm tra ghép đúng trình độ, chống người thứ ba, tự bắt đầu khi đủ camera/sẵn sàng, hủy lobby không tính hạng, bỏ cuộc tính thua, kết quả bất biến sau đóng cửa sổ, tick lặp không cộng hai lần, chống ghép lại tức thì, 5 trận vào bảng chính và mùa mới soft reset. Bốn người join đồng thời tạo đúng hai cặp; hai worker chốt đồng thời vẫn mỗi người một lượt rating.
- Lời mời nhóm: pending không thêm membership, gửi lặp không trùng; người khác không thể nhận thay; trước chấp nhận bị từ chối truy cập chat/thành viên/tài liệu/gọi. Từ chối vẫn ở ngoài nhóm; chấp nhận lặp không tạo membership trùng.
- Electron: gọi P2P, chat/quiz/Battle, luyện tập và sidebar đạt. Hai case mới ranking.spec đạt sau chỉnh selector camera theo accessible name: tự mở hai Battle, bật camera/sẵn sàng và tự bắt đầu, bỏ cuộc cập nhật rating/lịch sử; lời mời nhận realtime, từ chối, mời lại, chấp nhận rồi mới xuất hiện trong phòng. Ảnh đã xem tại ranking-preview.png và group-invitation-preview.png trong .runtime.
- PostgreSQL integration verify-lan đạt: quyền phòng, STOMP, reconnect, tài liệu, direct chat đồng thời, tranh chấp ghế gọi/Battle, một tài khoản không vào hai cuộc gọi và score ledger/outbox.
- Build, format:check và 3 kiểm thử session đạt. Migration V12/V13 thử trên PostgreSQL; database thật được sao lưu trước nâng cấp. Backend 0.7.0 dùng schema V13.
- Chưa nghiệm thu ranking/camera trên nhiều máy vật lý. Ngân hàng 40 câu là bản đầu, cần mở rộng để giảm học thuộc và đánh giá chất lượng ghép trận khi có đủ người chơi.

- Bản đóng gói Windows 0.7.0: ranking.spec gồm hai luồng ranking/lời mời nhóm đạt trực tiếp trên release/win-unpacked/ChisikiRoom.exe (14,2 giây). Database thật V13 có đúng 20 câu ranking N5 và 20 câu N4.


## 0.8.0 — chat nâng cao và trạng thái bền vững

- 41 kiểm thử backend đạt: quyền sửa/xóa, cấm trích dẫn khác phòng/tin đã xóa, replay request phải cùng replyToId, cập nhật trích dẫn khi sửa/xóa, xóa bỏ ghim và loại nội dung khỏi tìm kiếm, giới hạn năm tin ghim, bản nháp riêng tài khoản với optimistic version, mốc đọc chỉ tăng và chỉ chấp nhận ID cùng phòng.
- Năm kiểm thử desktop unit đạt: session cũ và hai bất biến mới (history đến trễ không khôi phục tin đã sửa/xóa; revision tin trả lời và tin được trích dẫn tiến độc lập).
- Ba bài Electron chat-actions.spec, desktop.spec, sidebar.spec đạt (31,0 giây). Chat-actions kiểm tra hai người trả lời/ghim/sửa/xóa realtime, quote cập nhật, reload không lùi nội dung, lưu bản nháp, khởi động lại phục hồi, tin chưa đọc được giữ khi đóng app rồi đánh dấu đọc khi mở lại, xung đột giữ bản cục bộ theo lựa chọn người dùng. Đã xem ảnh chat-advanced-preview.png.
- PostgreSQL integration đạt, gồm hai PUT bản nháp đồng thời với cùng version: đúng một thành công và một 409, không ghi đè giữa tài khoản.
- Migration V14/V15/V16; database kiểm thử nâng V15 → V16 giữ dữ liệu. Build và format:check đạt. V1–V13 giữ nguyên.

- Bản Windows đóng gói 0.8.0 chạy chat-actions.spec đạt (12,1 giây). Database thật đã nâng V16 và health UP.
