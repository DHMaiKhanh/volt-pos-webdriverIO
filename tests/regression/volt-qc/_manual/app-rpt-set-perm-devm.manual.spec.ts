/**
 * volt-qc APP / RPT / SET / PERM / DEVM - cases that cannot be automated on this
 * POS lane.
 *
 * TC catalogue: docs/qc/volt-qc/windows-regression/01-khoi-dong-dang-nhap-dieu-huong.md,
 * 10-bao-cao-payroll.md, 11-settings.md, 12-phan-quyen-passcode.md,
 * 16-portal-device-management.md. Every `it.skip` is a MANUAL test case kept so
 * the coverage report (`npx tsx scripts/volt-qc-coverage.ts`) counts it as
 * manual rather than missing; the comment above each one says why. Titles carry
 * the catalogue summary as written (Vietnamese).
 *
 * Automated cases: tests/regression/volt-qc/app-rpt-set-perm/*.spec.ts (writes)
 * and app-perm/, reports-time/, settings-devm/ (read-only).
 */

import { Tag, title } from '../../../../src/types/testTags.js';

describe('volt-qc APP / RPT / SET / PERM / DEVM - manual cases', () => {
  /* ---- App boot / splash / restart ----------------------------------- */

  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Thiết bị đã đăng nhập khởi động qua đủ các bước và vào Pending Orders (APP-011)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Footer About trên splash hiển thị version, device id và hotline (APP-012)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title('[MANUAL] Tín hiệu "app ready" sau splash dùng được cho automation (APP-013)', Tag.REGRESSION),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Lỗi bước khởi động (mất mạng khi sync DB) không làm crash app, app tự thử lại 3 lần rồi báo liên hệ hỗ trợ (APP-014)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Có mạng lại trong lúc đang retry thì splash tiếp tục bình thường (APP-015)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Mở lại app nhiều lần sau lỗi khởi động không gây crash (lỗi cũ "Cannot clone SplashState::Error") (APP-016)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Token hết hạn (ví dụ app không mở khoảng 3 ngày) thì khởi động vào màn Login chứ không phải "contact support" (APP-017)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Thiết bị Pending/Inactive trên Portal làm splash chờ duyệt, Portal Activate thì app vào được (APP-018)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title('[MANUAL] Chờ duyệt quá 2 phút thì dừng poll và báo liên hệ hỗ trợ (APP-019)', Tag.REGRESSION),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Thiết bị bị Deactivate thì lần khởi động sau bị chặn ở màn chờ duyệt (APP-020)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Đổi tỉ lệ hiển thị Windows không làm splash kẹt ở "Initializing..." 0% (APP-021)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Nút "New Update" trên splash chỉ xuất hiện khi có bản cập nhật (APP-022)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Thông điệp splash khi ngôn ngữ là Tiếng Việt không còn sót tiếng Anh (VP-2243) (APP-023)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title('[MANUAL] Phiên đăng nhập được giữ sau khi khởi động lại app (APP-047)', Tag.REGRESSION),
    () => {},
  );
  // Needs the app cold-started, restarted or its boot broken (network cut during sync, Windows scaling, splash footer); the lane attaches to an app already past splash and never restarts it.
  it.skip(
    title(
      '[MANUAL] Đã đăng nhập online thì khởi động offline vẫn dùng được (Order Flow 1.4) (APP-048)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Install / OS level -------------------------------------------- */

  // Needs the Windows shell: installer shortcut / Programs entry after an auto-update, the taskbar icon, a volt-pos:// deep link from the OS, or closing the app (Alt+F4) and relaunching it.
  it.skip(
    title('[MANUAL] Tên app hiển thị "Volt POS" ở mọi nơi và icon là logo Volt (APP-004)', Tag.REGRESSION),
    () => {},
  );
  // Needs the Windows shell: installer shortcut / Programs entry after an auto-update, the taskbar icon, a volt-pos:// deep link from the OS, or closing the app (Alt+F4) and relaunching it.
  it.skip(
    title(
      '[MANUAL] Sau auto-update có shortcut "Volt POS.lnk" và không bị nhân đôi shortcut (APP-005)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the Windows shell: installer shortcut / Programs entry after an auto-update, the taskbar icon, a volt-pos:// deep link from the OS, or closing the app (Alt+F4) and relaunching it.
  it.skip(
    title(
      '[MANUAL] Chỉ có 1 entry "Volt POS" và dữ liệu local được giữ sau khi nâng cấp (APP-006)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the Windows shell: installer shortcut / Programs entry after an auto-update, the taskbar icon, a volt-pos:// deep link from the OS, or closing the app (Alt+F4) and relaunching it.
  it.skip(title('[MANUAL] Deep link volt-pos:// mở hoặc focus app (APP-007)', Tag.REGRESSION), () => {});
  // Needs the Windows shell: installer shortcut / Programs entry after an auto-update, the taskbar icon, a volt-pos:// deep link from the OS, or closing the app (Alt+F4) and relaunching it.
  it.skip(title('[MANUAL] Hai cửa sổ mở cùng nhau và đóng cùng nhau (APP-008)', Tag.REGRESSION), () => {});

  /* ---- Sign-in (QR / Staff Token / OTP / sign-out) ------------------- */

  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] Bố cục màn Login QR (APP-024)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] QR hết hạn sau 50 giây và tạo được mã mới (APP-025)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title('[MANUAL] Owner quét QR bằng GCI Business app thì đăng nhập thành công (APP-026)', Tag.REGRESSION),
    () => {},
  );
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title('[MANUAL] Quét bằng tài khoản không phải Owner thì bị từ chối (APP-027)', Tag.REGRESSION),
    () => {},
  );
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title('[MANUAL] Business chưa kích hoạt gói Volt POS thì bị từ chối (APP-028)', Tag.REGRESSION),
    () => {},
  );
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title(
      '[MANUAL] Không tạo được QR khi mất mạng, có mạng lại thì Try Again thành công (APP-029)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title(
      '[MANUAL] Thiết bị đã gắn merchant A thì quét QR merchant B bị chặn (Order Flow 1.4) (APP-030)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title(
      '[MANUAL] Tap ẩn 5 lần vào "Version" mở trang Staff Token. Tap ít hơn hoặc chậm hơn thì không mở (APP-031)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title('[MANUAL] Kiểm tra i18n màn Login khi ngôn ngữ Tiếng Việt (APP-032)', Tag.REGRESSION),
    () => {},
  );
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] Bố cục màn đăng nhập bằng Staff Token (APP-033)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] Validate trường bắt buộc (APP-034)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] Token sai hoặc hết hạn bị từ chối (APP-035)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] Token không gắn merchant nào bị từ chối (APP-036)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title('[MANUAL] Lỗi không xác định (mất mạng, lỗi 5xx) hiện thông báo chung (APP-037)', Tag.REGRESSION),
    () => {},
  );
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] Token hợp lệ đăng nhập thành công (APP-038)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] Nút quay lại màn QR hoạt động (APP-039)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] Paste token có khoảng trắng đầu/cuối (APP-040)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title('[MANUAL] Thiết bị Active đăng nhập bằng OTP còn hạn (5 phút) (APP-041)', Tag.REGRESSION),
    () => {},
  );
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] OTP chỉ dùng được một lần (APP-042)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] OTP quá 5 phút thì hết hạn (APP-043)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title('[MANUAL] OTP tạo cho thiết bị A không dùng được trên thiết bị B (APP-044)', Tag.REGRESSION),
    () => {},
  );
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(title('[MANUAL] Tạo OTP mới thì OTP cũ mất hiệu lực (APP-045)', Tag.REGRESSION), () => {});
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title('[MANUAL] Thiết bị chưa Active không đăng nhập được bằng OTP (APP-046)', Tag.REGRESSION),
    () => {},
  );
  // Signs the device out or in: real QR login needs the GCI Business app on a phone, Staff Token / OTP need tokens issued from Portal, and each case leaves the till on /login (the lane would die on STAFF_TOKEN).
  it.skip(
    title(
      '[MANUAL] Phiên bị vô hiệu (sự kiện tokenCleared) thì màn chính về Login và màn khách reset (APP-050)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Auto-update channel ------------------------------------------- */

  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(
    title('[MANUAL] Có bản Published mới hơn thì hiện toast mời cập nhật (APP-098)', Tag.REGRESSION),
    () => {},
  );
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(
    title(
      '[MANUAL] Chọn Update Later thì có icon update trên header để mở lại toast (APP-099)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(
    title(
      '[MANUAL] Update Now tải và cài bản mới, khởi động lại thì báo cập nhật thành công (APP-100)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(
    title(
      '[MANUAL] Bản cập nhật bị gỡ trước/trong lúc tải thì báo không còn bản để cài (APP-101)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(title('[MANUAL] Lỗi tải giữa chừng không làm kẹt dialog (APP-102)', Tag.REGRESSION), () => {});
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(
    title('[MANUAL] Bản đang Pause Published không bao giờ được đề xuất cho POS (APP-103)', Tag.REGRESSION),
    () => {},
  );
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(
    title('[MANUAL] Bản đang chạy bị Deprecated thì app bắt buộc cập nhật (APP-105)', Tag.REGRESSION),
    () => {},
  );
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(title('[MANUAL] Force update lỗi thì cho thử lại (APP-106)', Tag.REGRESSION), () => {});
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(title('[MANUAL] Force update khi không còn bản nào để tải (APP-107)', Tag.REGRESSION), () => {});
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(
    title(
      '[MANUAL] Version khác bản bị deprecate thì chỉ gợi ý cập nhật, không bắt buộc (APP-108)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(
    title(
      '[MANUAL] Deprecate xảy ra khi app đang mở thì lần đổi route kế tiếp chuyển sang force-update (APP-109)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(
    title(
      '[MANUAL] Link tải bản cập nhật có tham số cache-bust nên luôn tải đúng binary mới (APP-110)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(title('[MANUAL] Không cho hạ phiên bản (Version Management) (APP-111)', Tag.REGRESSION), () => {});
  // Needs a build published / paused / deprecated on the update channel and an install + relaunch; never done on the shared till.
  it.skip(
    title('[MANUAL] Trang thông tin "POS update" thay cho popup (VP-2691/VP-2787) (APP-112)', Tag.REGRESSION),
    () => {},
  );

  /* ---- Portal / Business App ----------------------------------------- */

  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Portal hiển thị thiết bị Online với version đúng (healthz mỗi 5 phút, coi là online nếu thấy trong 10 phút) (APP-051)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(title('[MANUAL] Đóng app hơn 10 phút thì Portal báo Offline (APP-052)', Tag.REGRESSION), () => {});
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Đổi giá dịch vụ trên Portal thì POS nhận sau lần pull, không cần restart (APP-086)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Tạo/sửa staff trên Portal xuất hiện ở các danh sách staff của POS (APP-087)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Bật/tắt Status hoặc Appointment Staff trên Portal không làm mất role của staff trên POS (APP-088)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Staff bị xoá biến mất khỏi POS và passcode của họ không còn dùng được (APP-089)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title('[MANUAL] Đổi Passcode Settings trên Portal thì POS áp dụng theo (APP-090)', Tag.REGRESSION),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Để app idle khi Portal liên tục thay đổi dữ liệu thì sync vẫn chạy, không có lỗi "database is locked" (APP-092)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Danh sách staff active trên POS bằng đúng danh sách trên Portal (APP-094)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title('[MANUAL] Tạo staff với Email rỗng không sinh ra staff trùng trên POS (APP-095)', Tag.REGRESSION),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title('[MANUAL] Show Point/Reward đồng bộ 2 chiều POS ⇄ Portal (SET-042)', Tag.REGRESSION),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title('[MANUAL] Discount Setting đồng bộ 2 chiều POS ⇄ Portal (SET-059)', Tag.REGRESSION),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title('[MANUAL] Email có khoảng trắng đầu không làm kẹt hàng đợi sync (SET-177)', Tag.REGRESSION),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Portal bật/tắt Status hoặc Appointment Staff không xoá Role của staff trên POS (SET-178)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Passcode Setting đồng bộ 2 chiều POS ⇄ Portal và sang máy POS khác (PERM-035)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Đổi quyền role trên Portal đồng bộ xuống POS và áp vào passcode (PERM-085)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Quyền bổ sung thêm/gỡ trên Portal đồng bộ xuống POS (Doc Portal Access Control) (PERM-086)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Toggle Status trên Portal không làm staff mất role/permission trên POS (PERM-088)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title(
      '[MANUAL] Mỗi staff có 1 mã duy nhất dùng chung cho passcode POS, check-in/out và đăng nhập Business App (PERM-090)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title('[MANUAL] Recalculate Payroll trên Portal phản ánh trên POS (RPT-157)', Tag.REGRESSION),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(
    title('[MANUAL] Dữ liệu batch từ FastboyPay hiển thị trên POS (RPT-171)', Tag.REGRESSION),
    () => {},
  );
  // Asserts on, or is driven from, fastboy-portal / GoCheckin Business App: another surface this POS lane cannot drive or observe.
  it.skip(title('[MANUAL] Total Income POS = Business App/Portal (RPT-178)', Tag.REGRESSION), () => {});

  /* ---- Second POS ---------------------------------------------------- */

  // Needs a second till signed in to the same merchant.
  it.skip(title('[MANUAL] Thay đổi trên POS A tới được POS B (VP-1037) (APP-096)', Tag.REGRESSION), () => {});
  // Needs a second till signed in to the same merchant.
  it.skip(
    title(
      '[MANUAL] Đổi ngôn ngữ ở cấp merchant trên POS A thì POS B tự đổi, không cần restart (Language Setting doc) (APP-097)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a second till signed in to the same merchant.
  it.skip(
    title(
      '[MANUAL] Ngôn ngữ lưu theo thiết bị, không đổi các máy khác cùng merchant (SET-113)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a second till signed in to the same merchant.
  it.skip(
    title('[MANUAL] Đổi quyền trên máy A có hiệu lực trên máy B sau sync (PERM-089)', Tag.REGRESSION),
    () => {},
  );

  /* ---- Sync in flight ------------------------------------------------ */

  // The Syncing indicator / UI-during-sync only shows while a Portal-side change is being pulled; it cannot be triggered from the POS lane.
  it.skip(
    title('[MANUAL] Chỉ báo "Syncing" hiện trong lúc đồng bộ và tắt khi xong (APP-080)', Tag.REGRESSION),
    () => {},
  );
  // The Syncing indicator / UI-during-sync only shows while a Portal-side change is being pulled; it cannot be triggered from the POS lane.
  it.skip(
    title(
      '[MANUAL] UI Home vẫn thao tác được trong lúc sync, không bị flood lỗi hook (APP-093)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Shortcuts not shipped ----------------------------------------- */

  // Shortcuts from the Shortcuts doc are not implemented yet (backlog); the deny-by-role half also needs role passcodes.
  it.skip(
    title(
      '[MANUAL] Phím trùng trong doc phải xử lý theo ngữ cảnh khi được ship: Ctrl+O, Ctrl+T, Ctrl+R (APP-117)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Shortcuts from the Shortcuts doc are not implemented yet (backlog); the deny-by-role half also needs role passcodes.
  it.skip(
    title(
      '[MANUAL] Phím tắt Void/Refund/Reopen bị từ chối với staff không đủ quyền (APP-118)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Fresh appointment notification -------------------------------- */

  // Needs a NEW appointment notification (new customer, later cancelled) created from the booking channel (GoPOS web) while the till watches; the shared feed cannot be seeded from here.
  it.skip(
    title('[MANUAL] Click thông báo lịch hẹn mở đúng lịch hẹn đó trên board (APP-125)', Tag.REGRESSION),
    () => {},
  );
  // Needs a NEW appointment notification (new customer, later cancelled) created from the booking channel (GoPOS web) while the till watches; the shared feed cannot be seeded from here.
  it.skip(
    title('[MANUAL] Thông báo lịch hẹn mới của khách mới hiển thị đúng tên khách (APP-128)', Tag.REGRESSION),
    () => {},
  );
  // Needs a NEW appointment notification (new customer, later cancelled) created from the booking channel (GoPOS web) while the till watches; the shared feed cannot be seeded from here.
  it.skip(
    title(
      '[MANUAL] Mở thông báo cũ của lịch đã bị huỷ thì thấy trạng thái hiện tại (APP-129)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Role passcodes not in env ------------------------------------- */

  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] Role Staff (mặc định không có quyền báo cáo cửa hàng) bị chặn (RPT-010)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] Role Staff có quyền staff_payroll vào được Staff Payroll (RPT-011)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Role Partner (không có staff_income) bị chặn ở Staff Income nhưng vào được Daily Sale Report (RPT-012)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Skip 30 phút của staff không có quyền trang khác vẫn hỏi code, skip được giữ (RPT-016)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Page gate: staff không có quyền thấy thông báo không có quyền truy cập trang (PERM-012)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Action gate: staff không có quyền thấy "You don\'t have permission for this action", hành động không chạy (PERM-013)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Staff mất role (roleId null) bị chặn "Invalid staff code" kể cả khi có quyền bổ sung (PERM-014)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Skip của staff không có quyền cho màn khác thì màn đó vẫn hỏi passcode, skip vẫn giữ (PERM-022)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] Staff có skip bị chuyển Inactive thì skip bị huỷ (PERM-024)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Skip kiểm lại quyền HIỆN TẠI: rút quyền sau khi skip thì phải nhập lại passcode (PERM-026)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] Staff không có view_phone_number bị từ chối xem số (PERM-059)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Re-Open kiểm quyền edit_order; tắt edit_order thì bị từ chối dù gate Re-Open ON (PERM-060)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Passcode khi Confirm/Cancel lịch hẹn và kéo đổi lịch (edit_order) (PERM-061)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] edit_order: cả 4 role được phép Re-Open (gate reopen_order) (PERM-063)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] cancel_order_void: cả 4 role được void (theo seed) (PERM-064)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] refund: Owner/Manager/Partner được, Staff bị từ chối (PERM-065)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] completed_payment: cả 4 role được hoàn tất thanh toán (PERM-066)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] delete_order: Owner/Manager/Staff được xoá đơn chờ, Partner bị từ chối (PERM-067)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] view_order_history: Owner/Manager/Staff vào được, Partner bị từ chối (seed) (PERM-068)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] summary_income: Owner/Manager/Partner được, Staff bị từ chối (PERM-069)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] daily_income: Owner/Manager/Partner được, Staff bị từ chối (PERM-070)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(title('[MANUAL] staff_income: chỉ Owner/Manager được (PERM-071)', Tag.REGRESSION), () => {});
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(title('[MANUAL] staff_payroll: cả 4 role được (theo seed) (PERM-072)', Tag.REGRESSION), () => {});
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] batch_history: Owner/Manager/Partner được, Staff bị từ chối (PERM-073)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(title('[MANUAL] open_cash_drawer: chỉ Owner/Manager được (PERM-075)', Tag.REGRESSION), () => {});
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(title('[MANUAL] settings: cả 4 role vào được Business Info (PERM-076)', Tag.REGRESSION), () => {});
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] view_phone_number: cả 4 role được xem số đầy đủ (PERM-077)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(title('[MANUAL] view_time_tracking: chỉ Owner được (PERM-078)', Tag.REGRESSION), () => {});
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] Quyền bổ sung cấp thêm cho staff dù role không có (PERM-080)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Đổi role xoá toàn bộ quyền bổ sung và áp quyền mặc định role mới (PERM-082)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Quyền bổ sung = true thắng role = false; không có cách "trừ" quyền role ở mức staff (PERM-083)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Đổi switch ma trận có hiệu lực ngay ở lần nhập passcode kế tiếp (không cần restart) (PERM-084)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title('[MANUAL] Gate Order History giới hạn staff chỉ thấy đơn của mình (PERM-091)', Tag.REGRESSION),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Gán staff test sang role khác thành công, quyền bổ sung của staff bị xoá (SET-125)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the passcode of a Manager / Partner / Staff-role (or inactive / role-less) staff; this suite only carries the owner code (OWNER_PASSCODE / STAFF_PASSCODE).
  it.skip(
    title(
      '[MANUAL] Bỏ tick 1 thành viên hiện tại trong Assign làm staff mất role → passcode báo Invalid staff code (SET-126)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Specific staff records ---------------------------------------- */

  // Needs staff data the lane cannot discover: a deleted staff code (re-used or not), a code with a leading 0, a dts_owner staff, a deleted nickname, or another staff code to duplicate.
  it.skip(
    title('[MANUAL] Mã của staff đã xoá (chưa ai dùng lại) bị từ chối (PERM-010)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff data the lane cannot discover: a deleted staff code (re-used or not), a code with a leading 0, a dts_owner staff, a deleted nickname, or another staff code to duplicate.
  it.skip(
    title(
      '[MANUAL] Mã của staff đã xoá được gán lại cho staff mới thì đăng nhập bằng quyền của staff mới (PERM-011)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff data the lane cannot discover: a deleted staff code (re-used or not), a code with a leading 0, a dts_owner staff, a deleted nickname, or another staff code to duplicate.
  it.skip(title('[MANUAL] Mã có số 0 đầu được so khớp theo giá trị số (PERM-015)', Tag.REGRESSION), () => {});
  // Needs staff data the lane cannot discover: a deleted staff code (re-used or not), a code with a leading 0, a dts_owner staff, a deleted nickname, or another staff code to duplicate.
  it.skip(
    title(
      '[MANUAL] Staff DTS owner tự tạo khi onboarding bị ẩn; số đếm Owner = số dòng hiển thị (SET-127)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff data the lane cannot discover: a deleted staff code (re-used or not), a code with a leading 0, a dts_owner staff, a deleted nickname, or another staff code to duplicate.
  it.skip(
    title(
      '[MANUAL] Staff đã xoá (status deleted) không xuất hiện ở bất kỳ danh sách nào (SET-155)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff data the lane cannot discover: a deleted staff code (re-used or not), a code with a leading 0, a dts_owner staff, a deleted nickname, or another staff code to duplicate.
  it.skip(title('[MANUAL] Staff code trùng bị chặn (SET-162)', Tag.REGRESSION), () => {});

  /* ---- Creates permanent staff --------------------------------------- */

  // The POS has no staff delete: creating / inactivating staff would leave permanent staff and live passcodes on the shared merchant.
  it.skip(
    title(
      '[MANUAL] Tạo staff chỉ với 3 trường bắt buộc: Nick Name, Staff Code, Staff Role; mặc định Active + màu (SET-157)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // The POS has no staff delete: creating / inactivating staff would leave permanent staff and live passcodes on the shared merchant.
  it.skip(
    title(
      '[MANUAL] Tạo staff nickname mới chưa tồn tại không báo "already exists" sai (SET-166)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // The POS has no staff delete: creating / inactivating staff would leave permanent staff and live passcodes on the shared merchant.
  it.skip(
    title(
      '[MANUAL] Tạo staff trùng Nickname/Staff code với staff đã xoá vẫn lưu được (SET-167)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // The POS has no staff delete: creating / inactivating staff would leave permanent staff and live passcodes on the shared merchant.
  it.skip(
    title(
      '[MANUAL] Chuyển staff Inactive → biến khỏi Home; mã passcode báo inactive (SET-170)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Card terminal / settled batch / refund ------------------------ */

  // Needs a card charge on the payment terminal, an open terminal batch, or a refund; refund is only offered on a batch-SETTLED order (overnight close), which one run cannot produce.
  it.skip(
    title(
      '[MANUAL] Refund toàn phần hiển thị âm, giảm Sale, loại khỏi Total Order (RPT-045)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a card charge on the payment terminal, an open terminal batch, or a refund; refund is only offered on a batch-SETTLED order (overnight close), which one run cannot produce.
  it.skip(
    title('[MANUAL] Partial refund: Sale giảm đúng phần hoàn, đơn vẫn được đếm (RPT-046)', Tag.REGRESSION),
    () => {},
  );
  // Needs a card charge on the payment terminal, an open terminal batch, or a refund; refund is only offered on a batch-SETTLED order (overnight close), which one run cannot produce.
  it.skip(
    title('[MANUAL] Refund đơn của ngày trước được ghi vào ngày refund (RPT-047)', Tag.REGRESSION),
    () => {},
  );
  // Needs a card charge on the payment terminal, an open terminal batch, or a refund; refund is only offered on a batch-SETTLED order (overnight close), which one run cannot produce.
  it.skip(
    title('[MANUAL] Đơn có lần thẻ lỗi rồi thành công được tính đúng 1 lần (RPT-051)', Tag.REGRESSION),
    () => {},
  );
  // Needs a card charge on the payment terminal, an open terminal batch, or a refund; refund is only offered on a batch-SETTLED order (overnight close), which one run cannot produce.
  it.skip(
    title('[MANUAL] Đơn tạo ngày 1, capture ngày 2 vẫn xuất hiện trên báo cáo (RPT-052)', Tag.REGRESSION),
    () => {},
  );
  // Needs a card charge on the payment terminal, an open terminal batch, or a refund; refund is only offered on a batch-SETTLED order (overnight close), which one run cannot produce.
  it.skip(
    title('[MANUAL] Refund đơn cash ngày trước ghi âm vào ngày refund (RPT-129)', Tag.REGRESSION),
    () => {},
  );
  // Needs a card charge on the payment terminal, an open terminal batch, or a refund; refund is only offered on a batch-SETTLED order (overnight close), which one run cannot produce.
  it.skip(title('[MANUAL] Đơn Cash có vào batch không (RPT-174)', Tag.REGRESSION), () => {});
  // Needs a card charge on the payment terminal, an open terminal batch, or a refund; refund is only offered on a batch-SETTLED order (overnight close), which one run cannot produce.
  it.skip(title('[MANUAL] Refund âm nhất quán (RPT-180)', Tag.REGRESSION), () => {});
  // Needs a card charge on the payment terminal, an open terminal batch, or a refund; refund is only offered on a batch-SETTLED order (overnight close), which one run cannot produce.
  it.skip(
    title(
      '[MANUAL] Total Order chỉ đếm đơn hợp lệ: loại đơn Canceled, Refunded và manual refund (nguồn VP-1048 TC-2) (RPT-186)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a card charge on the payment terminal, an open terminal batch, or a refund; refund is only offered on a batch-SETTLED order (overnight close), which one run cannot produce.
  it.skip(
    title(
      '[MANUAL] Đơn trả bằng nhiều phương thức (Split) phân bổ đúng vào Payment Details và chỉ đếm 1 đơn (nguồn VP-1048 TC-43) (RPT-188)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a card charge on the payment terminal, an open terminal batch, or a refund; refund is only offered on a batch-SETTLED order (overnight close), which one run cannot produce.
  it.skip(title('[MANUAL] Tắt gate Refund → refund không hỏi passcode (PERM-049)', Tag.REGRESSION), () => {});

  /* ---- Gift card balance --------------------------------------------- */

  // Needs a funded gift card on this merchant and the CHARGE_SETTLE gate (redeem spends real balance).
  it.skip(
    title(
      '[MANUAL] Thanh toán bằng gift card vào Gift Card Redemption, không vào Amount Collected (RPT-042)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Printer / check printing -------------------------------------- */

  // Needs a receipt / check printer attached (or its absence asserted) and the printed paper read back.
  it.skip(title('[MANUAL] In báo cáo ngày (RPT-054)', Tag.REGRESSION), () => {});
  // Needs a receipt / check printer attached (or its absence asserted) and the printed paper read back.
  it.skip(
    title('[MANUAL] Không có máy in → toast lỗi; bấm 2 lần trong 2 s chỉ xử lý 1 (RPT-055)', Tag.REGRESSION),
    () => {},
  );
  // Needs a receipt / check printer attached (or its absence asserted) and the printed paper read back.
  it.skip(
    title('[MANUAL] Print chỉ có khi đã chọn dòng; không có máy in → toast (RPT-087)', Tag.REGRESSION),
    () => {},
  );
  // Needs a receipt / check printer attached (or its absence asserted) and the printed paper read back.
  it.skip(
    title('[MANUAL] Print chỉ khi đã chọn staff; dùng template theo loại lương (RPT-133)', Tag.REGRESSION),
    () => {},
  );
  // Needs a receipt / check printer attached (or its absence asserted) and the printed paper read back.
  it.skip(title('[MANUAL] In payroll; kỳ mở in dòng ước tính (RPT-151)', Tag.REGRESSION), () => {});
  // Needs a receipt / check printer attached (or its absence asserted) and the printed paper read back.
  it.skip(title('[MANUAL] Tóm tắt check khớp Staff Payroll POS (RPT-161)', Tag.REGRESSION), () => {});
  // Needs a receipt / check printer attached (or its absence asserted) and the printed paper read back.
  it.skip(
    title('[MANUAL] Số tiền bằng chữ in hoa, dạng "... AND CC/100" (RPT-162)', Tag.REGRESSION),
    () => {},
  );
  // Needs a receipt / check printer attached (or its absence asserted) and the printed paper read back.
  it.skip(
    title('[MANUAL] Số check 6 chữ số tăng dần, MICR, Memo, Pay to (RPT-163)', Tag.REGRESSION),
    () => {},
  );
  // Needs a receipt / check printer attached (or its absence asserted) and the printed paper read back.
  it.skip(
    title(
      '[MANUAL] Phiếu in payroll và Check của staff Salary có Salary Amount, Total Income, Pay 1, Pay 2 khớp màn hình (nguồn VP-1148 TC-10) (RPT-199)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a receipt / check printer attached (or its absence asserted) and the printed paper read back.
  it.skip(
    title(
      '[MANUAL] Auto-print customer receipt bật → in tự động sau khi hoàn tất đơn, màn hình khách ẩn nút Print (SET-101)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs a receipt / check printer attached (or its absence asserted) and the printed paper read back.
  it.skip(
    title(
      '[MANUAL] Auto-print cancel/refund receipts bật → void đơn in receipt huỷ (SET-102)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Merchant timezone / midnight ---------------------------------- */

  // Needs the merchant timezone to differ from the machine clock, or an order placed across midnight.
  it.skip(title('[MANUAL] Biểu đồ theo giờ dùng timezone merchant (RPT-053)', Tag.REGRESSION), () => {});
  // Needs the merchant timezone to differ from the machine clock, or an order placed across midnight.
  it.skip(
    title(
      '[MANUAL] Đơn sát nửa đêm thuộc đúng ngày theo timezone merchant, không lệch do đổi UTC (nguồn VP-1048 TC-44) (RPT-189)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Compensation / payroll configuration -------------------------- */

  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Discount Charge hiển thị và được cộng vào Total Earnings (RPT-081)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Discount Charge chỉ tính trên dòng dịch vụ có staff (RPT-082)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Đổi Discount Setting → Discount Charge theo tỉ lệ mới, không $0.00 (RPT-083)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Refund đơn có giảm giá ghi Discount Reversed (RPT-084)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Card Charge Tip hiển thị giá trị thật, các dòng cộng ra Total Income (RPT-103)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Phí thẻ chỉ trừ cho staff compensation = commission (RPT-104)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Commission tính trên giá trước thuế (RPT-105)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Service fee không vào doanh thu/commission của staff (RPT-106)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Supply Share Method: Before = $51.00, After = $47.00 (RPT-107)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Deduct After Commission khi supply lớn hơn commission (RPT-108)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Discount Charge phân bổ theo tỉ lệ dịch vụ (RPT-109)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Custom promotion dùng tỉ lệ của đơn (RPT-110)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Staff chỉ nhận lương (salary) không bị trừ Discount Charge (RPT-111)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Làm tròn phân bổ promotion 3 staff (RPT-112)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Hiển thị commission sản phẩm khi có cấu hình (RPT-113)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Khoảng ngày qua nhiều kỳ hiện tỉ lệ theo từng kỳ (RPT-114)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Salary view: Wage Per Day (RPT-115)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Salary view: Wage Per Hour, giờ làm 2 chữ số thập phân (RPT-116)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Clock In/Out chỉ hiện khi xem 1 ngày (RPT-117)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Rate của salary là số tiền, không phải % (RPT-118)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Salary by Period: lương cố định của kỳ (RPT-119)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Staff commission_salary hiển thị Salary view (RPT-120)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Nhiều mức lương trong khoảng → Rate "-" và dòng theo kỳ (RPT-121)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Credit Card Tips Added to Check = ON (RPT-124)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Staff đặt 100% Pay 2 không có thu nhập ở Pay 1 (RPT-125)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Khấu trừ chỉ trừ vào Pay 1 (merchant cấu hình Pay 1 = cash − deduction) (RPT-126)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Đơn được nhóm theo ngày hoàn tất, refund theo ngày refund (RPT-132)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Kỳ lương khớp loại pay period (weekly/bi-weekly/half-month) (RPT-137)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Current Period liệt kê cả staff Total Income $0 (RPT-140)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Kỳ khoá liệt kê mọi staff active kể cả $0 (RPT-141)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Salary view của payroll (RPT-146)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Staff không có số liệu → "No Data", Print tắt (RPT-147)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Staff commission 0% có đơn: Subtotal không bị về $0.00 (RPT-148)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Dấu Refund khác nhau giữa kỳ khoá và kỳ mở (RPT-149)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Commission + Salary kỳ mở hiển thị phần lớn hơn, hoà → Salary (RPT-152)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Count Days Off OFF → trả MAX(Salary, Commission) (RPT-153)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Vi phạm ngày nghỉ → chỉ trả Salary (RPT-154)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Salary by Period không áp dụng giới hạn ngày nghỉ (RPT-155)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Đổi compensation giữa kỳ → tính lại toàn bộ kỳ hiện tại (RPT-156)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title('[MANUAL] Kỳ đã in check không recalculate được, POS giữ nguyên (RPT-158)', Tag.REGRESSION),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Kỳ khoá giữ snapshot khi setting đổi (RPT-159)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(title('[MANUAL] Dữ liệu payroll đồng bộ trễ (RPT-160)', Tag.REGRESSION), () => {});
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Wage Per Day: ngày có ≥ 1 check-in tính đúng 1 ngày công; ngày không check-in = 0; nhiều ca vẫn 1 ngày; thiếu check-out (auto check-out) vẫn (RPT-194)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Salary view Wage Per Day: Salary Amount = Rate × Working Days; Clean Up Fee/Deduction = Deduction Per Day × Working Days (nguồn VP-1148 TC-7 (RPT-195)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Salary by Period: Salary Amount = mức cố định của kỳ, không nhân số ngày; Clean Up = Deduction × Working Days (nguồn VP-1341 TC-6) (RPT-196)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Wage Per Hour: Salary Amount = Rate × Working Hours; Clean Up tính theo Working Days (nguồn VP-1341 TC-8) (RPT-197)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Staff Salary: Pay 1 = round(Total Income × Pay 1%), Pay 2 = Total Income − Pay 1; Clean Up và Tip đã nằm trong Total Income (nguồn VP-1148 T (RPT-198)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Bật Exclude Tips From Cash/Check Income: tip vẫn hiển thị nhưng không cộng vào phần chi trả Pay 1 (cash) / Pay 2 (check) (nguồn VP-1341 TC-3 (RPT-200)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Đơn nhiều thợ chia tip: mỗi staff áp setting Exclude Tips của riêng mình, không lẫn nhau (nguồn VP-1341 TC-5) (RPT-201)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Count Days Off chỉ tác động staff Commission + Salary; staff Commission và staff Salary nghỉ nhiều vẫn tính như thường (nguồn VP-1343 TC-1) (RPT-202)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Khi vi phạm ngày nghỉ luôn trả Salary only (1 quyết định duy nhất), Salary = Wage Per Day × Working Days, không fallback sang Commission (ng (RPT-203)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Vi phạm ngày nghỉ được xét độc lập theo từng kỳ lương (nguồn VP-1343 TC-17) (RPT-204)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Đổi Max days off rồi Recalculate kỳ chưa in check → kết quả theo setting mới (nguồn VP-1343 TC-18) (RPT-205)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Ngày nghỉ có phép (Approved Leave) có bị tính là Day Off không (nguồn VP-1343 TC-19) (RPT-206)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Hiển thị khi vi phạm: kỳ khoá chỉ hiện Salary view, không có nhãn lý do; kỳ đang mở vẫn ước tính theo phần lớn hơn (nguồn VP-1343 TC-15, TC- (RPT-207)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs staff with a specific compensation (Salary by Period / Wage per Day / per Hour, Commission + Salary, Pay 1-Pay 2, days-off limits, supply / product commission), locked payroll periods, Portal recalculation or printed checks; changing a real staff compensation rewrites that staff payroll.
  it.skip(
    title(
      '[MANUAL] Lưu cấu hình Salary – Wage Per Day, Pay 1, Deduction, Exclude Tips; giữ nguyên khi mở lại; staff khác không đổi (nguồn VP-1148 TC-2, VP-1341 (SET-183)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Report cross-check needs DB / Edit Order ---------------------- */

  // RPT-128 asserts completeness against the order list in the local DB (the @db lane); RPT-131 needs Re-Open then change staff, and Edit Order is locked on build 1.1.56.
  it.skip(
    title('[MANUAL] Liệt kê đủ mọi đơn/dịch vụ của staff trong ngày (RPT-128)', Tag.REGRESSION),
    () => {},
  );
  // RPT-128 asserts completeness against the order list in the local DB (the @db lane); RPT-131 needs Re-Open then change staff, and Edit Order is locked on build 1.1.56.
  it.skip(
    title('[MANUAL] Đổi staff thực hiện → thu nhập chuyển sang staff mới (RPT-131)', Tag.REGRESSION),
    () => {},
  );

  /* ---- Tax (owner decision) ------------------------------------------ */

  // The owner decided not to change Product Tax / Service Fee of merchant 14 (another team set Tax 10% + card fee); the product-tax rows need that change.
  it.skip(title('[MANUAL] Tax = thuế dịch vụ + thuế sản phẩm (RPT-038)', Tag.REGRESSION), () => {});
  // The owner decided not to change Product Tax / Service Fee of merchant 14 (another team set Tax 10% + card fee); the product-tax rows need that change.
  it.skip(title('[MANUAL] Sửa Product Tax và Save thành công (SET-047)', Tag.REGRESSION), () => {});
  // The owner decided not to change Product Tax / Service Fee of merchant 14 (another team set Tax 10% + card fee); the product-tax rows need that change.
  it.skip(
    title(
      '[MANUAL] Product Tax mới áp cho dòng Product trong tổng đơn; Service Tax chỉ áp cho dòng Service, hiển thị 1 dòng Tax (SET-049)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Promotions / Discount Setting --------------------------------- */

  // Needs configured promotions and a Discount Setting change checked against finished orders and Portal.
  it.skip(
    title(
      '[MANUAL] Promotion có sẵn lấy tỷ lệ từ Discount Setting; Custom Discount luôn reset 100/0 (SET-056)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs configured promotions and a Discount Setting change checked against finished orders and Portal.
  it.skip(
    title(
      '[MANUAL] Discount Charge của staff theo tỷ lệ mới, chỉ tính phần dòng service (VP-3436) (SET-057)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs configured promotions and a Discount Setting change checked against finished orders and Portal.
  it.skip(
    title(
      '[MANUAL] Đổi Discount Setting không thay đổi phân bổ của đơn đã hoàn tất (snapshot) (SET-058)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Store-wide tip flow / Turn off -------------------------------- */

  // Changes the tip flow (Tip Amount $, Tip Method, Tip Timing) or turns Turn off (value 0) for every till of the merchant mid-day; the volt-qc plan keeps these out of the automated lane.
  it.skip(
    title(
      '[MANUAL] Turn value = 0 ẩn tab TURN và lượt trên card staff (mục Turn ở app sidebar vẫn còn) (SET-062)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Changes the tip flow (Tip Amount $, Tip Method, Tip Timing) or turns Turn off (value 0) for every till of the merchant mid-day; the volt-qc plan keeps these out of the automated lane.
  it.skip(
    title('[MANUAL] Lưu Tip Amount $ → màn hình khách hiện preset theo tiền (SET-080)', Tag.REGRESSION),
    () => {},
  );
  // Changes the tip flow (Tip Amount $, Tip Method, Tip Timing) or turns Turn off (value 0) for every till of the merchant mid-day; the volt-qc plan keeps these out of the automated lane.
  it.skip(
    title('[MANUAL] Bỏ Cash khỏi Tip Method → thanh toán Cash không hiện màn tip (SET-081)', Tag.REGRESSION),
    () => {},
  );
  // Changes the tip flow (Tip Amount $, Tip Method, Tip Timing) or turns Turn off (value 0) for every till of the merchant mid-day; the volt-qc plan keeps these out of the automated lane.
  it.skip(
    title(
      '[MANUAL] Tip Timing = After Payment bật nút Adjust Tip cho đơn chưa settle (SET-082)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Restart / per-device persistence ------------------------------ */

  // Needs the app restarted (or a second device) to prove the value persisted per device.
  it.skip(
    title(
      '[MANUAL] Cài đặt bàn phím ảo lưu theo máy: giữ sau restart, không đồng bộ sang máy khác (SET-036)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs the app restarted (or a second device) to prove the value persisted per device.
  it.skip(title('[MANUAL] Ngôn ngữ được giữ sau khi restart app (SET-107)', Tag.REGRESSION), () => {});

  /* ---- Payroll-affecting confirm ------------------------------------- */

  // Confirms a pay-period change into the current / next period, which rewrites payroll; never confirmed on the shared merchant.
  it.skip(
    title(
      '[MANUAL] Xác nhận đổi pay period áp vào kỳ hiện tại/kỳ sau và tác động Staff Payroll (SET-029)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Loyalty reward ------------------------------------------------ */

  // Needs a loyalty reward program configured on the merchant so Show Reward has something to show.
  it.skip(title('[MANUAL] Show Reward độc lập với Show Point (SET-041)', Tag.REGRESSION), () => {});

  /* ---- V2 / V4 report rollout ---------------------------------------- */

  // V2-vs-V1 parity, the /report-pages/$slug rollout and the 6-month range are checked by the VP-4848 V4 report QC pack against Portal data.
  it.skip(title('[MANUAL] V2 phải khớp V1 100% (RPT-182)', Tag.REGRESSION), () => {});
  // V2-vs-V1 parity, the /report-pages/$slug rollout and the 6-month range are checked by the VP-4848 V4 report QC pack against Portal data.
  it.skip(
    title('[MANUAL] Report pages /report-pages/$slug thay báo cáo cũ (RPT-183)', Tag.REGRESSION),
    () => {},
  );
  // V2-vs-V1 parity, the /report-pages/$slug rollout and the 6-month range are checked by the VP-4848 V4 report QC pack against Portal data.
  it.skip(title('[MANUAL] Khoảng ngày tối đa 6 tháng (RPT-184)', Tag.REGRESSION), () => {});

  /* ---- Fault injection ----------------------------------------------- */

  // Needs an API failure injected after the passcode / during the report load.
  it.skip(
    title(
      '[MANUAL] Lỗi tải dữ liệu hiển thị thông báo lỗi, app không crash (nguồn VP-1048 TC-41) (RPT-192)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // Needs an API failure injected after the passcode / during the report load.
  it.skip(
    title('[MANUAL] Hành động lỗi sau khi qua passcode hiển thị toast lỗi (PERM-095)', Tag.REGRESSION),
    () => {},
  );

  /* ---- Crafted store state ------------------------------------------- */

  // Needs a store that never saved Passcode Setting, or a role whose permission JSON lacks a key; only reachable by editing the DB.
  it.skip(
    title('[MANUAL] Store chưa từng lưu Passcode Setting → mọi gate coi như ON (PERM-056)', Tag.REGRESSION),
    () => {},
  );
  // Needs a store that never saved Passcode Setting, or a role whose permission JSON lacks a key; only reachable by editing the DB.
  it.skip(
    title(
      '[MANUAL] Role không có key quyền (thiếu hẳn trong JSON) bị coi là từ chối (PERM-087)',
      Tag.REGRESSION,
    ),
    () => {},
  );

  /* ---- Bamboo GO device ---------------------------------------------- */

  // Needs the Bamboo GO terminal device.
  it.skip(title('[MANUAL] Passcode Bamboo trên thiết bị Bamboo GO (PERM-093)', Tag.REGRESSION), () => {});

  /* ---- Portal > Device Management ------------------------------------ */

  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Danh sách chỉ gồm POS của đúng merchant đang chọn, mỗi POS đủ thông tin cơ bản (nguồn VP-1198 TC-01) (DEVM-001)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Mỗi POS có các action theo spec: Remote View, Disconnect, View Detail (nguồn VP-1198 TC-01) (DEVM-002)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Đổi merchant thì list thay toàn bộ, không còn POS của merchant trước (DEVM-003)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Merchant chưa có POS nào → empty state, không lỗi, không banner offline (DEVM-004)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Có POS offline → banner "X devices currently offline" và dòng POS offline được highlight (VP-1198 AC) (DEVM-005)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Tất cả POS Online → không có banner, không dòng nào highlight (DEVM-006)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Thanh toán 1 đơn trên POS test → Last payment của đúng POS đó cập nhật (DEVM-007)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] POS chưa có giao dịch nào → Last payment để trống / "—", không hiện ngày sai (01/01/1970) (DEVM-008)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Sau khi POS cập nhật phiên bản mới, App version trên Portal đổi theo (DEVM-009)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Thiết bị Pending/Inactive (Device Pending) hiển thị thế nào ở trang Device của merchant (DEVM-010)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] POS đang kết nối hiện Online; POS mất kết nối hiện Offline kèm Offline since (nguồn VP-1198 TC-02) (DEVM-011)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] POS mở app nhưng không thao tác vẫn Online (heartbeat 5 phút thay cho đo lưu lượng sync) (DEVM-012)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Mất mạng ngắn (dưới ngưỡng 10 phút) không làm POS chuyển Offline (DEVM-013)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Mất mạng quá 10 phút → Offline; có mạng lại → Online trong ≤ 5 phút (DEVM-014)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Trạng thái POS/Terminal/Printer trên Portal khớp trạng thái thực sau chu kỳ cập nhật; không yêu cầu realtime (nguồn VP-1198 TC-04) (DEVM-015)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Máy POS ngủ (Sleep) 15 phút → Offline; đánh thức → Online lại không cần mở lại app (DEVM-016)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Trigger "Device login thành công" cập nhật Last connected và Online (nguồn VP-1198 TC-05.1) (DEVM-017)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Trigger "Reconnect sau khi mất mạng" cập nhật Last connected (nguồn VP-1198 TC-05.2) (DEVM-018)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Trigger "App reopen" cập nhật Last connected (nguồn VP-1198 TC-05.3) (DEVM-019)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Trigger "Heartbeat reconnect" (heartbeat bị gián đoạn rồi gửi lại được) cập nhật Last connected (nguồn VP-1198 TC-05.4) (DEVM-020)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Trigger "App closed" cập nhật Last disconnected và Offline (nguồn VP-1198 TC-06.2) (DEVM-022)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Trigger "Heartbeat timeout" (app chết không đóng sạch) cập nhật Last disconnected sau ngưỡng 10 phút (nguồn VP-1198 TC-06.3) (DEVM-023)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Trigger "Internet disconnected" cập nhật Last disconnected và Offline (nguồn VP-1198 TC-06.4) (DEVM-024)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Trigger "Token/session invalidated": POS về /login, ngừng heartbeat, Portal ghi Last disconnected (nguồn VP-1198 TC-06.5) (DEVM-025)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Timestamp hiển thị theo timezone merchant, định dạng thống nhất giữa List và Detail (DEVM-026)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Hiển thị SN + Active / Inactive của Terminal và Ready / Not connected của Printer, khớp header POS (nguồn VP-1198 TC-03) (DEVM-027)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Một POS gắn nhiều terminal theo thời gian: rút A cắm B → A Inactive (có Last disconnected), B Active; list hiển thị cả 2 (nguồn VP-1198 TC-0 (DEVM-028)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Rút máy in → POS header Not Connected trong ~5 s, Portal Printer Not connected; cắm lại → Ready (DEVM-029)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Rút terminal → Portal Inactive + Last disconnected; cắm lại → Active + Last connected (DEVM-030)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Thay đổi thiết bị lúc POS mất mạng vẫn được đồng bộ lên Portal khi có mạng lại, đúng thời điểm xảy ra (DEVM-031)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] POS chưa từng gắn terminal/printer → Portal không hiện dòng terminal/printer rỗng hay lỗi (DEVM-032)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Máy in cắm nhưng thiếu driver (Not Installed Driver trên POS) → ghi nhận trạng thái trên Portal (DEVM-033)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] View Detail mở đúng device và hiển thị Device ID, Last connected/disconnected, Uptime (7 days), Current status (nguồn VP-1198 TC-07) (DEVM-034)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Connection History 7 ngày: mỗi ngày có Date, Uptime %, Status (nguồn VP-1198 TC-08) (DEVM-035)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Uptime % theo ngày và Uptime 7 ngày tính đúng theo thời gian Online (DEVM-036)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] POS mới đăng ký chưa đủ 7 ngày/chưa có lịch sử → chỉ hiện ngày có dữ liệu hoặc empty state, không tính ngày trước khi đăng ký là Offline (DEVM-037)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Ranh giới ngày tính theo timezone merchant: offline 23:30 → 00:30 chia đúng cho 2 ngày (DEVM-038)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Terminal List: mỗi terminal có SN, Status, Last connected, Last disconnected; không có action remote ở cấp Terminal (nguồn VP-1198 TC-09) (DEVM-039)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Quay lại từ Detail về List giữ merchant đang chọn và vị trí/bộ lọc (DEVM-040)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Mở URL Detail với Device ID không tồn tại hoặc thuộc merchant user không có quyền → báo không tìm thấy / không có quyền, không lộ dữ liệu (DEVM-041)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Remote View POS Online vào ngay, không hỏi credential (dùng credential lưu trên device), audit log ghi Remote View – success (nguồn VP-1198 (DEVM-042)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Phía POS trong phiên Remote View: app không bị gián đoạn, order đang mở giữ nguyên, Customer Display không đổi (DEVM-043)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] POS Offline: nút Remote View vẫn click được, sau khi thử báo POS offline, audit log Remote fail (nguồn VP-1198 TC-11) (DEVM-044)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Credential lưu trên device sai → báo lỗi credential, audit log fail với reason tương ứng (nguồn VP-1198 TC-12.1) (DEVM-045)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Kết nối remote quá thời gian → báo timeout, audit log fail reason timeout (nguồn VP-1198 TC-12.2) (DEVM-046)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Dịch vụ remote không sẵn sàng → báo remote service unavailable, audit log fail reason tương ứng (nguồn VP-1198 TC-12.3) (DEVM-047)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Đang có phiên remote vào POS, user thứ 2 Remote View cùng POS → báo session conflict, phiên đầu không bị cắt (nguồn VP-1198 TC-12.4) (DEVM-048)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Trong phiên remote, action nhạy cảm (thanh toán, refund) không bị chặn ở tầng remote nhưng vẫn hỏi passcode riêng của app (nguồn VP-1198 TC- (DEVM-049)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Đang Remote View mà POS bị Disconnect/mất mạng → phiên remote kết thúc có thông báo, Portal không treo (DEVM-050)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Disconnect POS Online → POS chuyển Offline, Last disconnected cập nhật, audit log ghi Disconnect (user, result, timestamp) (nguồn VP-1198 TC (DEVM-051)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Sau Disconnect: POS về /login, màn khách reset, heartbeat dừng; đăng nhập lại bằng QR thì Online lại, thiết bị vẫn Active (không phải Pendin (DEVM-052)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Disconnect lúc POS đang mất mạng → khi có mạng lại POS mới bị đưa về /login; trong lúc offline vẫn bán Cash được (DEVM-053)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Disconnect khi POS còn order Pending và dữ liệu chưa đẩy lên → sau khi đăng nhập lại không mất order/giao dịch (DEVM-054)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Huỷ ở bước xác nhận Disconnect → không có gì thay đổi, không ghi audit log (DEVM-055)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Disconnect POS đang Offline (máy tắt) → kết quả rõ ràng; lần mở app sau POS về /login (DEVM-056)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Disconnect chỉ kết thúc phiên, không đổi trạng thái thiết bị: khác Deactivate (APP-020) vốn chặn lần đăng nhập sau (DEVM-057)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Gửi APP_UPLOAD_LOG cho máy test → POS tự nén và tải log lên trong ≤ 1 phút, kết quả uploaded; POS không hiện gì, không gián đoạn (DEVM-058)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Lệnh upload log tới POS sau khi grant hết hạn → kết quả failed "Upload grant expired at …", không upload (DEVM-059)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Validate tham số: expires_in 60–3600, older_than_days 1–365 (VP-3312) (DEVM-060)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] APP_TRASH_LOG chuyển log cũ hơn mốc vào thư mục trash/ (không xoá), log đang ghi không bị chuyển; lần upload sau không kèm trash/ (DEVM-061)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Lệnh chỉ chạy trong 20 phút kể từ khi tạo: POS online lại trong 20 phút thì chạy; quá 20 phút thì từ chối với lý do rõ ràng (DEVM-062)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Lệnh gửi cho POS A không chạy trên POS B cùng merchant và B không ghi đè kết quả của A (DEVM-063)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] PING trả về pong; lệnh mà bản app không hỗ trợ bị từ chối có nêu phiên bản (DEVM-064)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Lệnh support chạy ngầm khi thu ngân đang ở màn thanh toán không làm treo/chậm rõ rệt hay đổi màn hình (DEVM-065)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] User KHÔNG có quyền remote/credential không xem được credential và không Remote được (nguồn VP-1198 TC-15) (DEVM-066)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] User có quyền dùng được credential và Remote; credential lấy đúng từ POS tương ứng (nguồn VP-1198 TC-16) (DEVM-067)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] User chỉ có quyền view device data (VP-1198) xem được List/Detail/History nhưng không có action Remote View/Disconnect (DEVM-068)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] User không có quyền xem thiết bị → không thấy menu Device; mở URL trực tiếp bị chặn (DEVM-069)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] User chỉ được gán merchant A không xem/thao tác được thiết bị của merchant B (kể cả qua URL/API) (DEVM-070)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Cập nhật credential remote → được lưu, ghi audit log Credential update; Remote View sau đó dùng credential mới (DEVM-071)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Cập nhật credential bỏ trống/sai định dạng/user không có quyền → bị chặn, credential cũ giữ nguyên (DEVM-072)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Mỗi action từ trang tạo 1 bản ghi đủ trường: Device ID, Terminal SN (nếu có), Action type, User, Result success/fail, Timestamp, Failure rea (DEVM-073)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Device History ghi sự kiện hệ thống (VP-1198): device connected/disconnected, đổi trạng thái POS/terminal, có Device ID, Terminal SN, Event (DEVM-074)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Filter theo Device ID, Terminal SN, Action type, User, Result/status, Time range và tổ hợp trả về đúng bản ghi (nguồn VP-1198 TC-18) (DEVM-075)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Filter không có kết quả → empty state; Time range ngược (từ > đến) bị chặn hoặc báo lỗi (DEVM-076)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Audit log chỉ đọc: không sửa/xoá được; bản ghi cũ vẫn còn (chưa giới hạn retention) (DEVM-077)',
      Tag.REGRESSION,
    ),
    () => {},
  );
  // DEVM is a fastboy-portal page (device list / detail / history / remote view / disconnect / support commands / audit log); the POS lane cannot drive or read Portal, and many cases also need a network cut, sleep, a second POS or terminal / printer hardware.
  it.skip(
    title(
      '[MANUAL] Thứ tự sắp xếp, phân trang và timezone của Audit Log nhất quán (DEVM-078)',
      Tag.REGRESSION,
    ),
    () => {},
  );
});
