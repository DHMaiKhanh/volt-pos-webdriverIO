# Card Charge Payment — Success / Fail Test Cases

Phạm vi: thanh toán bằng thẻ thật (card reader / terminal) khi checkout order — không liên quan công thức Card Charge Commission/Tip trong payroll.

---

## A. CASE TỐT (Payment Success)

| #   | Case                                                                  | Điều kiện                          | Kết quả mong đợi                                                                                       |
| --- | --------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A1  | Quẹt/chạm thẻ thành công, đủ tiền                                     | Thẻ hợp lệ, đủ hạn mức             | Giao dịch approved, order chuyển sang Paid, in hóa đơn/receipt đúng số tiền                            |
| A2  | Thanh toán full bằng 1 thẻ                                            | Toàn bộ order trả bằng 1 card      | Amount charge = tổng order, không dư/thiếu                                                             |
| A3  | Split payment: 1 phần Card + 1 phần Cash/khác, phần Card thành công   | VD 60% Card / 40% Cash             | Phần Card approved đúng số tiền được chỉ định, tổng order khớp                                         |
| A4  | Thanh toán có Tip qua card reader                                     | Nhập tip trên terminal             | Tip cộng đúng vào tổng charge, tách riêng được Tip vs Service trên receipt                             |
| A5  | Nhiều thẻ khác nhau cho nhiều order riêng trong ngày                  | N order, N thẻ                     | Mỗi giao dịch approved độc lập, không lẫn giữa các order                                               |
| A6  | Retry sau khi lần đầu bị fail nhẹ (VD kết nối chập), lần 2 thành công | Fail tạm thời rồi charge lại       | Chỉ 1 giao dịch approved được ghi nhận, không double charge                                            |
| A7  | Refund/void ngay sau khi charge thành công (trong cùng ca)            | Khách đổi ý ngay                   | Refund/void thành công, order trở về trạng thái chưa thanh toán hoặc đã hoàn tiền, không giữ tiền treo |
| A8  | Thanh toán bằng thẻ contactless/tap                                   | NFC/tap to pay                     | Approved như quẹt chip, tốc độ nhanh hơn, không lỗi thiết bị                                           |
| A9  | Offline signature thay vì PIN (tùy loại thẻ)                          | Thẻ yêu cầu ký tên                 | Giao dịch vẫn approved sau khi ký, không bị treo chờ PIN                                               |
| A10 | Thanh toán đúng số tiền sau khi áp discount/coupon                    | Order có giảm giá trước khi charge | Amount gửi lên terminal = số tiền sau discount, không charge nhầm giá gốc                              |

## B. CASE XẤU (Payment Fail / Error / Edge)

| #   | Case                                                                     | Nguyên nhân                         | Kỳ vọng hệ thống xử lý đúng                                                                                                                            |
| --- | ------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | Thẻ bị từ chối (Declined) — không đủ tiền                                | Insufficient funds                  | Hiện lỗi rõ ràng "Declined", order vẫn ở trạng thái chưa thanh toán, không tự động coi là Paid                                                         |
| B2  | Thẻ hết hạn (Expired card)                                               | Ngày hết hạn đã qua                 | Terminal/gateway trả lỗi expired, cho phép nhập thẻ khác, không crash                                                                                  |
| B3  | Mất kết nối mạng/terminal giữa lúc đang xử lý                            | Network timeout khi charge          | Không được vừa mất tiền khách vừa không ghi nhận order Paid (tránh mất đồng bộ); cần cơ chế xác nhận lại trạng thái giao dịch trước khi cho charge lại |
| B4  | Charge bị timeout nhưng thực tế bank đã approved (delayed response)      | Race condition                      | Không double-charge khi retry; phải kiểm tra trạng thái giao dịch trước (idempotency)                                                                  |
| B5  | Khách hủy giao dịch giữa chừng trên terminal (Cancel)                    | User cancel trên PIN pad            | Order về lại trạng thái pending, không có charge nào ghi nhận                                                                                          |
| B6  | Card bị báo cáo mất/đánh cắp (Stolen/Lost card)                          | Ngân hàng chặn                      | Hiện lỗi cụ thể (không phải lỗi chung), không tiết lộ chi tiết nhạy cảm ra receipt                                                                     |
| B7  | Sai số tiền gửi lên terminal (lệch do làm tròn/tính tip sai)             | Bug tính tổng trước khi charge      | Amount phải khớp chính xác với order total, có validate trước khi gửi request                                                                          |
| B8  | Charge thành công nhưng ghi nhận vào order sai (gán nhầm order khác)     | Bug đồng bộ giữa POS và terminal    | Mỗi giao dịch phải map đúng 1 order duy nhất, có transaction ID để trace                                                                               |
| B9  | Thẻ Amex/loại thẻ không được terminal hỗ trợ                             | Card type unsupported               | Từ chối sớm với thông báo rõ ("card type not supported"), không để giao dịch treo                                                                      |
| B10 | Charge 2 lần do nhân viên bấm submit nhiều lần (double click/double tap) | User error / thiếu debounce         | Hệ thống phải chặn double-submit, hoặc phát hiện và tự hoàn 1 giao dịch trùng                                                                          |
| B11 | Partial approval (ngân hàng chỉ approve 1 phần số tiền)                  | Một số thẻ hỗ trợ partial auth      | Hệ thống phải xử lý số dư còn lại (yêu cầu thanh toán bổ sung), không coi là Paid đủ                                                                   |
| B12 | Refund thất bại (Refund declined bởi gateway)                            | Lỗi gateway khi hoàn tiền           | Order phải giữ nguyên trạng thái đã thanh toán, không tự động đánh dấu refunded nếu chưa confirm                                                       |
| B13 | Mất điện/crash app ngay lúc terminal đang xử lý                          | Power/app failure                   | Sau khi khởi động lại, hệ thống phải kiểm tra được trạng thái giao dịch thực tế (qua gateway) trước khi cho thao tác tiếp, tránh charge lại từ đầu     |
| B14 | Charge với thẻ test/demo trong môi trường production                     | Nhầm môi trường                     | Phải bị chặn ở tầng gateway hoặc cảnh báo rõ, không cho qua như giao dịch thật                                                                         |
| B15 | Số tiền charge = 0 hoặc âm (do bug tính order)                           | Order total lỗi                     | Hệ thống phải validate amount > 0 trước khi gửi lên terminal, không gửi request charge với số tiền không hợp lệ                                        |
| B16 | Fail do vượt hạn mức giao dịch mỗi ngày của thẻ                          | Daily limit exceeded                | Hiện lỗi cụ thể từ ngân hàng, cho phép thử thẻ khác/phương thức khác                                                                                   |
| B17 | Kết nối terminal Bluetooth/USB bị rớt giữa giao dịch                     | Lỗi thiết bị                        | App phải phát hiện mất kết nối thiết bị và báo lỗi thay vì treo vô thời hạn                                                                            |
| B18 | Charge thành công nhưng receipt/print bị lỗi                             | Lỗi máy in, không liên quan gateway | Giao dịch vẫn phải được ghi nhận Paid đúng, chỉ lỗi ở khâu in — cho phép in lại receipt sau                                                            |

---

**Ghi chú:** Danh sách case suy luận theo nghiệp vụ thanh toán thẻ POS phổ biến (approval, decline, network, idempotency, refund, thiết bị). Cần đối chiếu thêm với gateway/terminal thực tế (Stripe Terminal, Square, v.v.) đang dùng trong Volt POS để bổ sung mã lỗi cụ thể.
