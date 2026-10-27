/**
 * Services & Products (`/settings/services`, `/settings/services/$categoryId`).
 *
 * Source: `docs/screens/settings-services/settings-services-test-cases.md`, the
 * live DOM dump of build 1.1.56
 * (`reports/scans/2026-10-25-feature-inventory/dom/settings-services.json`) and
 * the app source under `src/routes/_app/settings/services/`.
 *
 * ## No testids on this screen
 *
 * Build 1.1.56 ships none here, and the code-detail doc names none, so every
 * primary below is the id the app SHOULD expose (`settings-services-<thing>`),
 * paired with a structural fallback:
 *
 * - category rows are TanStack `<Link>`s, so `a[href^="/settings/services/"]`
 *   (the trailing slash keeps the settings rail's own `/settings/services` link out);
 * - the reorder trigger carries an `aria-label` (translated — both bundles listed);
 * - the two `+` buttons have NO accessible name: the category one is the reorder
 *   trigger's next sibling, the item one sits in the detail header next to the
 *   `<h2>` with the status filter (`role=combobox`);
 * - dialog fields are react-hook-form inputs, so they carry `name`
 *   (`name`, `price`, `supplyFee`, `description`), and the Flexible Pricing
 *   checkbox is `#flexible-pricing`.
 *
 * ## Two tables are always mounted
 *
 * `$categoryId.tsx` renders BOTH `<ProductTable>` and `<ServiceTable>` inside
 * React `<Activity>` and hides the inactive one (`display:none`). Every table /
 * header / filter locator below therefore matches TWO elements; the page object
 * always narrows to the displayed one (TC-SVC-37 exists to pin this down).
 */

import {
  buttonWithAnyText,
  byRole,
  inputWithAnyPlaceholder,
  locator,
  textIsAnyOf,
  type Locator,
} from '../helpers/selectors.js';

/** `[en, vi]` pairs read from `src/locales/{en,vi}/common.json` (app source, 2026-10-23). */
export const ServicesText = {
  category: ['Category', 'Danh mục'],
  active: ['Active', 'Đang hoạt động'],
  inactive: ['Inactive', 'Ngưng hoạt động'],
  all: ['All', 'Tất cả'],
  selectCategory: ['Select a category to view details.', 'Chọn một danh mục để xem chi tiết.'],
  reorder: ['Reorder Categories or Services', 'Sắp xếp danh mục hoặc dịch vụ'],
  createCategory: ['Create Category', 'Tạo danh mục'],
  updateCategory: ['Update Category', 'Cập nhật danh mục'],
  create: ['Create', 'Tạo'],
  update: ['Update', 'Cập nhật'],
  add: ['Add', 'Thêm'],
  addNewItem: ['Add New Item', 'Thêm mục mới'],
  updateService: ['Update Service', 'Cập nhật dịch vụ'],
  categoryNamePlaceholder: ['e.g. Manicure', 'VD: Móng tay'],
  enterServiceName: ['Enter service name', 'Nhập tên dịch vụ'],
  enterProductName: ['Enter product name', 'Nhập tên sản phẩm'],
  allServices: ['All services', 'Tất cả dịch vụ'],
  products: ['Products', 'Sản phẩm'],
  quickPay: ['Quick Pay', 'Thanh toán nhanh'],
  giftCard: ['Gift Card', 'Thẻ quà tặng'],
  edit: ['Edit', 'Sửa'],
  close: ['Close', 'Đóng'],
  noResults: ['No found results.', 'Không tìm thấy kết quả.'],
  /** Header of a SERVICE table, in column order (column 1 is the drag handle — icon only). */
  serviceColumnsEn: [
    '',
    'Service name & Description',
    'Price',
    'Duration',
    'Supply Fee',
    'Active Status',
    'Action',
  ],
  serviceColumnsVi: ['', 'Tên dịch vụ & Mô tả', 'Giá', 'Thời lượng', 'Phí vật tư', 'Trạng thái', 'Hành động'],
  /** Header of the PRODUCT table — no Duration, no Supply Fee. */
  productColumnsEn: ['', 'Product name & Description', 'Price', 'Active Status', 'Action'],
  productColumnsVi: ['', 'Tên sản phẩm & Mô tả', 'Giá', 'Trạng thái', 'Hành động'],
  durationColumn: ['Duration', 'Thời lượng'],
} as const;

/** XPath predicate: own text is exactly one of the pair. */
const isText = (pair: readonly string[]): string => pair.map((t) => `normalize-space()="${t}"`).join(' or ');

/** XPath predicate: an `@attr` equal to one of the pair. */
const attrIs = (attr: string, pair: readonly string[]): string =>
  pair.map((t) => `@${attr}="${t}"`).join(' or ');

/**
 * Raw CSS handed to `browser.execute` reads (which cannot take a `Locator`).
 * Declared here so the selector still lives in the catalogue, not in the page object.
 */
export const ServicesCss = {
  /** The open Radix dialog. Closed dialogs unmount, so the last match is the topmost one. */
  openDialog: '[role="dialog"][data-state="open"]',
  /** The active panel of a Radix `<Tabs>`. */
  activeTabpanel: '[role="tabpanel"][data-state="active"]',
  categoryLinks: 'a[href^="/settings/services/"]',
} as const;

export const ServicesIds = {
  /** The Category panel heading (`<h3>`). Static chrome — not the ready anchor. */
  categoryHeading: locator(
    'category panel heading',
    'settings-services-category-heading',
    `//h3[${isText(ServicesText.category)}]`,
  ),

  /** Category rows. Data-dependent: only exists once the category query returned. */
  categoryLinks: locator('category links', 'settings-services-category-link-', ServicesCss.categoryLinks),

  reorderButton: locator(
    'reorder categories or services button',
    'settings-services-reorder-btn',
    `//button[${attrIs('aria-label', ServicesText.reorder)}]`,
  ),

  /** The nameless `+` next to the reorder trigger — opens Create Category. */
  createCategoryButton: locator(
    'create category button',
    'settings-services-create-category-btn',
    `//button[${attrIs('aria-label', ServicesText.reorder)}]/following-sibling::button[1]`,
  ),

  activeTab: locator(
    'category Active tab',
    'settings-services-tab-active',
    `//*[@role="tab"][${isText(ServicesText.active)}]`,
  ),
  inactiveTab: locator(
    'category Inactive tab',
    'settings-services-tab-inactive',
    `//*[@role="tab"][${isText(ServicesText.inactive)}]`,
  ),

  /** Every tab whose label is EXACTLY "Active" (TC-SVC-05). */
  tabsExactActive: locator(
    'tabs labelled exactly Active',
    'settings-services-tab-active',
    `//*[@role="tab"][${isText(ServicesText.active)}]`,
  ),
  /**
   * Every tab whose label merely CONTAINS "Active" — what a non-exact text
   * match resolves to. "Inactive" contains "Active", and the vi pair shares
   * "hoạt động", so this matches both tabs in either language.
   */
  tabsContainingActive: locator(
    'tabs containing Active',
    'settings-services-tab-',
    // Case-insensitive, like a Playwright/Testing-Library text query: "Inactive" only
    // contains "Active" once case is folded.
    `//*[@role="tab"][contains(translate(normalize-space(),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"active") or contains(normalize-space(),"hoạt động")]`,
  ),

  selectCategoryPlaceholder: locator(
    'select-a-category placeholder',
    'settings-services-empty-detail',
    `//p[${isText(ServicesText.selectCategory)}]`,
  ),

  /** Detail panel title (`<h2>`) — BOTH tables' copies; narrow to the displayed one. */
  detailHeadings: locator('category detail heading', 'settings-services-detail-heading', '//h2'),

  /** The nameless `+` in the detail header — opens Add New Item. Two mounted; narrow. */
  addItemButtons: locator(
    'add item button',
    'settings-services-add-item-btn',
    '//h2/following-sibling::div//button[not(@role)]',
  ),

  /** The status filter (`All`/`Active`/`Inactive`) — one per mounted table; narrow. */
  statusFilters: locator(
    'service status filter',
    'settings-services-status-filter',
    '//h2/following-sibling::div//button[@role="combobox"]',
  ),

  /** Options of the open Radix Select (portalled listbox). */
  selectOptions: locator(
    'select options',
    'settings-services-filter-option-',
    `${byRole('listbox')} ${byRole('option')}`,
  ),

  /** "No found results." — what the app renders in place of rows, where it renders anything. */
  emptyState: locator(
    'service table empty state',
    'settings-services-empty-state',
    textIsAnyOf(...ServicesText.noResults),
  ),

  /** Both mounted tables — narrow to the displayed one. */
  tables: locator('service/product tables', 'settings-services-table', 'table'),

  // --- inside a dialog (scope with `within`) ---
  dialog: locator('open dialog', 'settings-services-dialog', ServicesCss.openDialog, byRole('dialog')),
  dialogTitle: locator('dialog title', 'settings-services-dialog-title', '[data-slot="dialog-title"]', 'h2'),
  dialogNameInput: locator('dialog name input', 'settings-services-dialog-name', 'input[name="name"]'),
  dialogPriceInput: locator('dialog price input', 'settings-services-dialog-price', 'input[name="price"]'),
  dialogSupplyFeeInput: locator(
    'dialog supply fee input',
    'settings-services-dialog-supply-fee',
    'input[name="supplyFee"]',
  ),
  dialogDescription: locator(
    'dialog description',
    'settings-services-dialog-description',
    'textarea[name="description"]',
    'input[name="description"]',
  ),
  dialogFlexiblePricing: locator(
    'flexible pricing checkbox',
    'settings-services-dialog-flexible',
    '#flexible-pricing',
  ),
  dialogSwitches: locator('dialog switches', 'settings-services-dialog-switch-', '[role="switch"]'),
  dialogComboboxes: locator('dialog comboboxes', 'settings-services-dialog-select-', '[role="combobox"]'),
  dialogCreateBtn: locator(
    'dialog Create button',
    'settings-services-dialog-create',
    `.//button[${isText(ServicesText.create)}]`,
  ),
  dialogUpdateBtn: locator(
    'dialog Update button',
    'settings-services-dialog-update',
    `.//button[${isText(ServicesText.update)}]`,
  ),
  dialogAddBtn: locator(
    'dialog Add button',
    'settings-services-dialog-add',
    `.//button[${isText(ServicesText.add)}]`,
  ),
  dialogTabs: locator('dialog tabs', 'settings-services-reorder-tab-', '[role="tab"]'),

  categoryNameInputByPlaceholder: locator(
    'category name input',
    'settings-services-category-name',
    inputWithAnyPlaceholder(...ServicesText.categoryNamePlaceholder),
  ),
} satisfies Record<string, Locator>;

/** A category row by its (data) name — the link whose own name div holds it. */
export const servicesCategoryLink = (name: string): Locator =>
  locator(
    `category link ${name}`,
    `settings-services-category-link-${name}`,
    `//a[starts-with(@href,"/settings/services/")][.//div[normalize-space()="${name}"]]`,
  );

/** The Update (pencil) button inside one category row. Its label is sr-only. */
export const servicesCategoryUpdateButton = (name: string): Locator =>
  locator(
    `update category ${name}`,
    `settings-services-category-update-${name}`,
    `//a[starts-with(@href,"/settings/services/")][.//div[normalize-space()="${name}"]]//button`,
  );

/** A select option by its label in either bundle. */
export const servicesSelectOption = (pair: readonly string[]): Locator =>
  locator(
    `select option ${pair[0] ?? ''}`,
    `settings-services-filter-option-${(pair[0] ?? '').toLowerCase()}`,
    `//*[@role="option"][${isText(pair)}]`,
  );

/** A dialog tab by its label in either bundle (scope with `within`). */
export const servicesDialogTab = (pair: readonly string[]): Locator =>
  locator(
    `dialog tab ${pair[0] ?? ''}`,
    `settings-services-reorder-tab-${(pair[0] ?? '').toLowerCase()}`,
    `.//*[@role="tab"][${isText(pair)}]`,
  );

/** Text anywhere — for the dialog title check. */
export const servicesTextIs = (pair: readonly string[]): Locator =>
  locator(
    `text ${pair[0] ?? ''}`,
    `settings-services-text-${(pair[0] ?? '').toLowerCase()}`,
    textIsAnyOf(...pair),
  );

/** A button by label, document-wide. */
export const servicesButton = (pair: readonly string[]): Locator =>
  locator(
    `button ${pair[0] ?? ''}`,
    `settings-services-btn-${(pair[0] ?? '').toLowerCase()}`,
    buttonWithAnyText(...pair),
  );
