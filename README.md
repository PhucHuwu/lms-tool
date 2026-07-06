# LMS Video Status Checker

Extension Chrome Manifest V3 để kiểm tra trạng thái phát video Plyr trên `https://lms.ptit.edu.vn/*`.

## Cài đặt

1. Mở Chrome và truy cập `chrome://extensions/`.
2. Bật `Developer mode`.
3. Chọn `Load unpacked`.
4. Chọn thư mục `D:\Project\Git\lms-tool`.
5. Mở bài học trên LMS, bấm icon extension để xem trạng thái video.

## Trạng thái có thể đọc

- Đang phát, tạm dừng, đã phát xong.
- Thời gian hiện tại và tổng thời lượng.
- Phần trăm tiến độ.
- Tốc độ phát.
- Âm lượng hoặc tắt tiếng.

## Kịch Bản Kiểm Thử UI

Nút `Bắt đầu học` trong popup sẽ chạy kịch bản kiểm thử trên UI hiện tại:

- Tìm bài học đầu tiên chưa được tick trong sidebar.
- Bỏ qua bài bị khóa với `aria-disabled="true"`.
- Mở bài đó nếu bài chưa active.
- Đặt tốc độ video thành `4x` nếu trình phát cho phép.
- Phát video sau thao tác bấm nút của người dùng.
- Khi video kết thúc, chờ LMS cập nhật tiến độ rồi chuyển sang bài chưa xem tiếp theo.
- Dừng khi hết bài có thể mở, khi Chrome chặn phát video, hoặc khi bấm `Dừng`.
- Tạm dừng khi gặp bài có tiêu đề `Câu hỏi ôn tập chương` để người kiểm thử làm thủ công.

Extension chỉ thao tác qua DOM/UI trên tab hiện tại, không gọi API riêng và không sửa trạng thái tiến độ trực tiếp.

## Cách Lấy Trạng Thái Bằng Code

Từ popup, extension gửi message `GET_LMS_VIDEO_STATUS` đến content script để lấy trạng thái hiện tại. Content script cũng gắn cờ nhanh trên HTML root:

```html
<html data-lms-video-playing="true">
```

Mỗi lần trạng thái thay đổi, content script phát event:

```js
window.addEventListener("lms-video-status", (event) => {
  console.log(event.detail);
});
```
