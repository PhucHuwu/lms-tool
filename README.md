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

## Kich ban kiem thu UI

Nut `Bat dau hoc` trong popup se chay kich ban kiem thu tren UI hien tai:

- Tim bai hoc dau tien chua duoc tick trong sidebar.
- Bo qua bai bi khoa voi `aria-disabled="true"`.
- Mo bai do neu bai chua active.
- Dat toc do video thanh `4x` neu trinh phat cho phep.
- Phat video sau thao tac bam nut cua nguoi dung.
- Khi video ket thuc, cho LMS cap nhat tien do roi chuyen sang bai chua xem tiep theo.
- Dung khi het bai co the mo, khi Chrome chan phat video, hoac khi bam `Dung`.

Extension chi thao tac qua DOM/UI tren tab hien tai, khong goi API rieng va khong sua trang thai tien do truc tiep.

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
