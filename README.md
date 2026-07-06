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
- Tìm video trực tiếp trong trang hoặc trong iframe H5P có thể truy cập được.
- Đặt tốc độ video thành `4x` nếu trình phát cho phép; nếu không được thì tự chuyển sang `2x`.
- Tắt tiếng video và đặt âm lượng về `0%` để tránh ồn trong lúc kiểm thử.
- Phát video sau thao tác bấm nút của người dùng.
- Khi video kết thúc, chờ LMS cập nhật tiến độ rồi chuyển sang bài chưa xem tiếp theo.
- Dừng khi hết bài có thể mở, khi Chrome chặn phát video, hoặc khi bấm `Dừng`.
- Tạm dừng khi gặp bài có tiêu đề `Câu hỏi ôn tập chương` để người kiểm thử làm thủ công.
- Giữ máy/màn hình thức trong lúc chạy bằng `chrome.power.requestKeepAwake("display")` để giảm khả năng video bị dừng do hệ thống sleep.
- Chạy `visibility-override.js` ở `document_start` trong main world và iframe để giảm trường hợp player tự pause khi tab/cửa sổ bị ẩn.

Extension chỉ thao tác qua DOM/UI trên tab hiện tại, không gọi API riêng và không sửa trạng thái tiến độ trực tiếp.

## Giới Hạn Khi Tab Chạy Nền

Chrome có thể throttle timer, renderer, iframe hoặc media khi tab không active hoặc khi cửa sổ bị minimize. Extension đã override Page Visibility API ở mức trang, nhưng không thể đảm bảo ép video tiếp tục chạy trong mọi trường hợp nếu chính Chrome suspend renderer khi minimize.

Khi cần kiểm thử background có kiểm soát, hãy chạy bằng Chrome test profile riêng với các flag phù hợp, ví dụ:

```powershell
chrome.exe --user-data-dir="C:\Temp\lms-test-profile" --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required
```

Trong kiểm thử ổn định nhất, nên để tab LMS là tab active trong một cửa sổ Chrome riêng.

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
