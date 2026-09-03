---
title: 'Force Update'
source: https://linear.app/fastboy/document/force-update-9a6c15819716
linear_id: 76ad6452-be6d-4e7e-8da9-f1f98da84e0b
team: VOLT
updated: 2026-06-19T03:29:15.983Z
---

# Force Update

**Mô tả chung** Tính năng Force Update cho phép quản trị viên chủ động kiểm soát việc nâng cấp phiên bản trên các thiết bị POS thông qua Portal. Khi một phiên bản bị đánh dấu Deprecated, hệ thống sẽ tự động ép buộc toàn bộ thiết bị POS đang chạy đúng phiên bản đó cập nhật lên phiên bản mới nhất đã được Published. Các thiết bị POS đang chạy phiên bản khác sẽ không bị ảnh hưởng, chỉ nhận được thông báo có phiên bản mới.

**Luồng hoạt động**

1. Trên Portal:

Hệ thống đang có phiên bản mới 0.1.554 đã được build và Published trên Portal. Quản trị viên thực hiện thao tác Deprecate phiên bản 0.1.552. Sau khi thao tác thành công, trạng thái của phiên bản 0.1.552 chuyển từ Published sang Deprecated.

2. Đối với các POS đang ở phiên bản bị Deprecated (0.1.552):

Toàn bộ thiết bị POS đang chạy phiên bản 0.1.552 sẽ tự động cập nhật (auto update) lên phiên bản 0.1.554. Đây là cập nhật bắt buộc — người dùng không thể bỏ qua và buộc phải nâng cấp lên phiên bản 0.1.554 để tiếp tục sử dụng.

3. Đối với các POS không ở phiên bản bị Deprecated:

Các thiết bị POS đang chạy phiên bản khác (ví dụ phiên bản hiện tại 0.1.551) vẫn hoạt động bình thường. Hệ thống hiển thị toast thông báo rằng đã có phiên bản mới, nhưng không bắt buộc người dùng phải cập nhật lên 0.1.554. Người dùng có thể tiếp tục sử dụng và chủ động cập nhật sau.

![Hình ảnh](https://uploads.linear.app/48af1d4d-bdb8-403a-a96b-66898fda1a34/6ba3025b-d1ee-4bd7-9148-efacd9b7e00b/c62490ed-4b31-4e3a-88fe-dac5078f7e45?signature=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXRoIjoiLzQ4YWYxZDRkLWJkYjgtNDAzYS1hOTZiLTY2ODk4ZmRhMWEzNC82YmEzMDI1Yi1kMWVlLTRiZDctOTE0OC1lZmFjZDliN2UwMGIvYzYyNDkwZWQtNGIzMS00ZTNhLTg4ZmUtZGFjNTA3OGY3ZTQ1IiwiaWF0IjoxNzg4MzYwNzYzLCJleHAiOjE3ODgzNjEwNjN9.kHb6xPf1KSmRe82wrmFDtOK7bNyBOrE6oTTYymbMEk4)
