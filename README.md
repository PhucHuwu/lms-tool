# LMS Video Status Checker

Extension Chrome Manifest V3 de kiem tra trang thai phat video Plyr tren `https://lms.ptit.edu.vn/*`.

## Cai dat

1. Mo Chrome va truy cap `chrome://extensions/`.
2. Bat `Developer mode`.
3. Chon `Load unpacked`.
4. Chon thu muc `D:\Project\Git\lms-tool`.
5. Mo bai hoc tren LMS, bam icon extension de xem trang thai video.

## Trang thai co the doc

- Dang phat, tam dung, da phat xong.
- Thoi gian hien tai va tong thoi luong.
- Phan tram tien do.
- Toc do phat.
- Am luong hoac tat tieng.

## Ho tro bat dau hoc

Nut `Bat dau hoc` trong popup se:

- Tim bai hoc dau tien chua duoc tick trong sidebar.
- Bo qua bai bi khoa voi `aria-disabled="true"`.
- Mo bai do neu bai chua active.
- Dat toc do video thanh `4x` neu trinh phat cho phep.
- Phat video sau thao tac bam nut cua nguoi dung.

Khi video ket thuc, extension chi thong bao co bai tiep theo. Extension khong tu dong lap vong chuyen bai va xem tiep.

## Cach lay trang thai bang code

Tu popup, extension gui message `GET_LMS_VIDEO_STATUS` den content script de lay trang thai hien tai. Content script cung gan co nhanh tren HTML root:

```html
<html data-lms-video-playing="true">
```

Moi lan trang thai thay doi, content script phat event:

```js
window.addEventListener("lms-video-status", (event) => {
  console.log(event.detail);
});
```
