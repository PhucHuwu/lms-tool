# LMS Assistant - Tự động phát video LMS PTIT

LMS Assistant là tiện ích mở rộng cho Google Chrome hỗ trợ tự động phát video bài học trên trang [lms.ptit.edu.vn](https://lms.ptit.edu.vn/). Công cụ giúp theo dõi trạng thái video, tự mở bài chưa hoàn thành, phát video với tốc độ cao và chuyển sang bài tiếp theo khi LMS cập nhật tiến độ.

## Chức năng chính

- Tự động tìm video bài học trên LMS PTIT.
- Hiển thị trạng thái video hiện tại: đang phát, tạm dừng, đã phát xong hoặc không tìm thấy video.
- Tự động mở bài học chưa hoàn thành trong danh sách bài học.
- Cho phép chọn tốc độ phát `Normal`, `2x`, `4x`; mặc định là `Normal`.
- Cho phép chọn âm lượng phát `0%`, `10%`, `25%`, `50%`, `100%`; mặc định là `25%`. Ở `0%`, video có thể không được tính là đã xem tùy LMS/player.
- Tự thử phát lại nếu video bị tạm dừng giữa chừng, ví dụ khi xuất hiện tương tác trong video.
- Tự động chuyển sang bài tiếp theo sau khi video kết thúc và LMS đã cập nhật tiến độ.
- Tự mở các mục/chương chưa hoàn thành nếu danh sách bài học đang bị thu gọn.
- Giữ màn hình không ngủ trong lúc chạy hỗ trợ phát bài học.
- Tạm dừng khi phát hiện nội dung quiz để người dùng xử lý thủ công.
- Giả lập trạng thái trang luôn hiển thị để hạn chế việc video bị dừng khi chuyển tab hoặc mất focus.

## Yêu cầu

- Trình duyệt Google Chrome hoặc trình duyệt nhân Chromium có hỗ trợ Chrome Extension Manifest V3.
- Tài khoản LMS PTIT có quyền truy cập khóa học/video cần học.
- Mã nguồn tiện ích này đã được tải về máy.

## Cài đặt

Hiện tại dự án là Chrome Extension thuần, không cần cài `npm`, không cần build.

1. Mở Chrome và truy cập `chrome://extensions/`.
2. Bật `Developer mode` hoặc `Chế độ nhà phát triển` ở góc phải phía trên.
3. Chọn `Load unpacked` hoặc `Tải tiện ích đã giải nén`.
4. Chọn thư mục chứa dự án này, tức thư mục có file `manifest.json`.
5. Sau khi cài xong, ghim tiện ích `LMS Video Status Checker` lên thanh công cụ nếu muốn sử dụng nhanh.

## Cách sử dụng

1. Mở trang [lms.ptit.edu.vn](https://lms.ptit.edu.vn/) và đăng nhập tài khoản của bạn.
2. Vào khóa học có video cần học.
3. Mở popup tiện ích trên thanh công cụ Chrome.
4. Bấm `Bắt đầu` để chạy hỗ trợ phát bài học.
5. Tiện ích sẽ tự tìm bài chưa xem, mở bài, phát video, tắt tiếng và đặt tốc độ phát cao nhất có thể.
6. Khi video kết thúc, tiện ích chờ LMS cập nhật tiến độ rồi chuyển sang bài tiếp theo.
7. Đóng hoặc reload tab LMS nếu muốn dừng quá trình đang chạy.

## Trạng thái trong popup

- `Đang phát`: video trên tab hiện tại đang chạy.
- `Đang tạm dừng`: video đã được tìm thấy nhưng đang dừng.
- `Đã phát xong`: video hiện tại đã kết thúc.
- `Không tìm thấy video trên tab hiện tại`: trang hiện tại chưa có video hoặc video chưa tải xong.
- `Hãy mở trang lms.ptit.edu.vn`: tiện ích chỉ hoạt động trên LMS PTIT.
- `Tải lại trang LMS rồi thử lại`: content script chưa được nạp, hãy reload trang LMS.

## Lưu ý khi sử dụng

- Tiện ích chỉ chạy trên domain `https://lms.ptit.edu.vn/*`.
- Nếu Chrome chặn tự động phát, hãy bấm Play trực tiếp trên video một lần rồi chạy lại tiện ích.
- Với bài có nội dung quiz như nút `Bắt đầu làm bài`, nút `Nộp bài`, `radiogroup` hoặc radio quiz, tiện ích sẽ dừng lại để bạn làm thủ công.
- Tốc độ phát phụ thuộc vào trình phát video/LMS. Nếu không đặt được tốc độ đã chọn, tiện ích sẽ dùng tốc độ hiện tại.
- Nên dùng âm lượng lớn hơn `0%` nếu LMS/player yêu cầu âm thanh để ghi nhận lượt xem.
- Không nên đóng tab LMS trong lúc tiện ích đang chạy.
- Khi cập nhật mã nguồn tiện ích, hãy vào `chrome://extensions/` và bấm reload tiện ích để áp dụng thay đổi.

## Cấu trúc dự án

```text
.
├── manifest.json            # Cấu hình Chrome Extension
├── popup.html               # Giao diện popup
├── popup.css                # Giao diện và màu sắc popup
├── popup.js                 # Xử lý nút Bắt đầu, cấu hình phát và hiển thị trạng thái
├── content.js               # Logic tìm video, tự phát bài học và chuyển bài
├── background.js            # Giữ màn hình không ngủ khi đang chạy
└── visibility-override.js   # Giả lập trang luôn hiển thị/focus
```

## Quyền của tiện ích

- `activeTab`: đọc tab LMS hiện tại để gửi lệnh kiểm tra/phát video.
- `scripting`: hỗ trợ thao tác với nội dung trang LMS.
- `power`: giữ màn hình không ngủ trong lúc chạy tự động.
- `host_permissions` cho `https://lms.ptit.edu.vn/*`: chỉ cho phép tiện ích hoạt động trên LMS PTIT.

## Gỡ cài đặt

1. Mở `chrome://extensions/`.
2. Tìm tiện ích `LMS Video Status Checker`.
3. Chọn `Remove` hoặc `Xóa`.

## Miễn trừ trách nhiệm

Tiện ích được tạo nhằm hỗ trợ thao tác học video trên LMS PTIT. Người dùng tự chịu trách nhiệm khi sử dụng và cần tuân thủ quy định học tập, kiểm tra, đánh giá của nhà trường và từng môn học.
