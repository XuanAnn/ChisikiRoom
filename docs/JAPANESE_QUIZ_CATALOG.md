# Bộ câu hỏi tiếng Nhật dùng sẵn

Desktop/backend 0.5.0 cung cấp 10 bộ, mỗi bộ 10 câu với 4 lựa chọn và 1 đáp án đúng (100 câu):

| Mức | Bộ |
| --- | --- |
| N5 | 01 · Hiragana và Katakana |
| N5 | 02 · Từ vựng sinh hoạt |
| N5 | 03 · Kanji cơ bản |
| N5 | 04 · Trợ từ và chia động từ |
| N5 | 05 · Hội thoại và đọc hiểu ngắn |
| N4 | 06 · Từ vựng đời sống |
| N4 | 07 · Kanji và cách đọc |
| N4 | 08 · Các thể động từ |
| N4 | 09 · Ngữ pháp ứng dụng |
| N4 | 10 · Đọc hiểu tình huống |

Câu hỏi tự biên soạn để ôn luyện theo phạm vi sơ cấp N5–N4, không phải đề thi JLPT chính thức. Không có phần nghe. Tham khảo mô tả năng lực chính thức: https://www.jlpt.jp/e/about/levelsummary.html

## Cách dùng

Mở Bộ câu hỏi, tìm N5 hoặc N4. Bộ mẫu có nhãn Có sẵn · Dùng chung. Chọn trực tiếp trong Tạo Battle, không cần sao chép. Mở bộ mẫu để xem/chỉnh rồi chọn Lưu bản sao cá nhân; bản gốc không bị thay đổi, bản sao chỉ tài khoản tạo được đọc/sửa.

## Lưu trữ và khởi tạo

V9 chỉ bỏ ràng buộc NOT NULL của question_sets.owner_id. Giá trị NULL biểu thị bộ mẫu do ứng dụng quản lý. Bộ cá nhân vẫn có khóa ngoại đến người dùng. Tất cả migration V1–V8 giữ nguyên.

QuizCatalogInitializer đọc resource quiz/japanese-n5-n4.json, kiểm tra Bean Validation và UUID trùng, rồi gọi QuizService.installCatalog trong transaction. Dữ liệu được thêm qua Spring Data JPA, không dùng SQL insert. UUID cố định đảm bảo khởi động lại không tạo trùng hoặc ghi đè bản hiện có. Bất kỳ lỗi nạp dữ liệu nào cũng rollback toàn bộ transaction.

GET danh sách/chi tiết trả bộ dùng chung và bộ thuộc người dùng hiện tại. PUT chỉ tìm bộ có owner_id của người dùng, nên không sửa được bộ mẫu hay bộ cá nhân của người khác. UI nhận diện bộ mẫu bằng ownerId = null.
