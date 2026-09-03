import path from 'node:path';
import { Paths } from '../constants/paths.js';
import { shared } from './wdio.shared.conf.js';

/**
 * TEMP recovery/demo lane — giống dev nhưng KHÔNG nạp rootHooks.
 *
 * rootHooks chạy ensureLoggedIn() vốn từ chối khởi động khi app đậu ở
 * /order-pending. Lane này bỏ hook đó để spec tự lo điều hướng
 * (returnToHome xử lý /order-pending). Chỉ dùng thủ công, không thuộc CI.
 */
export const config: WebdriverIO.Config = {
  ...shared,
  specs: [path.join(Paths.TESTS, '_recovery', '*.spec.ts')],
  suites: {},
  mochaOpts: {
    ...shared.mochaOpts,
    require: [],
  },
  specFileRetries: 0,
};
