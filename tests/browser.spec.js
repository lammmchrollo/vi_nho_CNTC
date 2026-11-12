'use strict';

const {test, expect} = require('@playwright/test');
const path = require('node:path');
const {mkdirSync} = require('node:fs');

const screenshotDir = path.join(__dirname, '..', 'docs', 'screenshots');
const pageErrors = new WeakMap();

test.beforeEach(async ({page}) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('favicon.ico')) errors.push('console: ' + message.text());
  });
  page.on('requestfailed', request => {
    if (!request.url().endsWith('/favicon.ico')) errors.push('requestfailed: ' + request.url());
  });
  page.on('response', response => {
    if (response.status() >= 500) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
});

test.afterEach(async ({page}) => {
  expect(pageErrors.get(page), 'Không được có JavaScript pageerror').toEqual([]);
});

async function openDemo(page) {
  await page.goto('/');
  await expect(page.locator('#try-demo')).toBeVisible();
  await page.locator('#try-demo').click();
  await expect(page.locator('#application')).toBeVisible();
  await expect(page.locator('#auth-screen')).toBeHidden();
  await expect(page.locator('#sync-status')).toContainText('Đã đồng bộ');
}

async function navigate(page, destination) {
  await page.locator(`[data-page="${destination}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`#${destination}$`));
}

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(dimensions.content, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function register(page, label = 'e2e') {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const account = {name: `Người dùng ${label}`, email: `${label}-${nonce}@example.test`, password: 'Mat-khau-E2E-2026!'};
  await page.goto('/');
  await page.locator('#auth-switch').click();
  const form = page.locator('#auth-form');
  await form.locator('[name="name"]').fill(account.name);
  await form.locator('[name="email"]').fill(account.email);
  await form.locator('[name="password"]').fill(account.password);
  await form.getByRole('button', {name: /Tạo tài khoản/}).click();
  await expect(page.locator('#application')).toBeVisible();
  return account;
}

async function addTransaction(page, {type = 'out', amount, category, note, date}, {expectSuccess = true} = {}) {
  await page.locator('#add').click();
  const form = page.locator('#tx-form');
  await expect(form).toBeVisible();
  await form.locator('[name="type"]').selectOption(type);
  await form.locator('[name="amount"]').fill(String(amount));
  await form.locator('[name="category"]').selectOption(category);
  if (date) await form.locator('[name="date"]').fill(date);
  await form.locator('[name="note"]').fill(note);
  await form.getByRole('button', {name: 'Lưu giao dịch'}).click();
  await expect(page.locator('#dialog')).toBeHidden();
  if (expectSuccess) await expect(page.locator('#toast')).toContainText('Đã ghi nhận giao dịch mới.');
}

async function confirmDialog(page, buttonName) {
  const dialog = page.locator('#dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', {name: buttonName, exact: true}).click();
  await expect(dialog).toBeHidden();
}

async function streamText(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

test('demo hiển thị dashboard, báo cáo và responsive không tràn ngang', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 1000});
  await openDemo(page);
  await expect(page.locator('#mode-badge')).toHaveText('Dữ liệu mô phỏng');
  await expect(page.locator('.metrics .metric')).toHaveCount(4);
  await expect(page.getByText('8.500.000', {exact: false}).first()).toBeVisible();
  await assertNoHorizontalOverflow(page);

  mkdirSync(screenshotDir, {recursive: true});
  await page.screenshot({path: path.join(screenshotDir, 'dashboard.png'), fullPage: true, animations: 'disabled'});

  await navigate(page, 'reports');
  await expect(page.locator('#page-title')).toHaveText('Hiểu những con số của bạn');
  await expect(page.getByRole('img', {name: /Biểu đồ thu chi sáu tháng/})).toBeVisible();
  await expect(page.getByText('ƯỚC TÍNH CHI TIÊU CUỐI THÁNG')).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({path: path.join(screenshotDir, 'reports.png'), fullPage: true, animations: 'disabled'});

  await page.setViewportSize({width: 390, height: 844});
  await navigate(page, 'home');
  await assertNoHorizontalOverflow(page);
  await page.screenshot({path: path.join(screenshotDir, 'mobile.png'), fullPage: true, animations: 'disabled'});
  for (const destination of ['transactions', 'budgets', 'goals', 'recurring', 'reports', 'settings']) {
    await navigate(page, destination);
    await assertNoHorizontalOverflow(page);
  }
});

test('đăng ký bắt đầu bằng sổ trống, đăng xuất rồi đăng nhập vẫn giữ dữ liệu', async ({page}) => {
  const account = await register(page, 'persistence');
  await expect(page.locator('#mode-badge')).toHaveText('Sổ cá nhân');
  await expect(page.getByText('0 khoản thu trong tháng')).toBeVisible();
  await expect(page.getByText('0 khoản chi trong tháng')).toBeVisible();

  await navigate(page, 'transactions');
  await addTransaction(page, {type: 'out', amount: 456789, category: 'Học tập', note: 'Giáo trình E2E bền vững'});
  await page.locator('#logout').click();
  await expect(page.locator('#auth-screen')).toBeVisible();

  const form = page.locator('#auth-form');
  await form.locator('[name="email"]').fill(account.email);
  await form.locator('[name="password"]').fill('sai-mat-khau');
  await form.getByRole('button', {name: /Đăng nhập/}).click();
  await expect(page.locator('#auth-error')).toContainText('Email hoặc mật khẩu không đúng.');
  await form.locator('[name="password"]').fill(account.password);
  await form.getByRole('button', {name: /Đăng nhập/}).click();
  await expect(page.locator('#application')).toBeVisible();

  await navigate(page, 'transactions');
  await page.locator('#search').fill('Giáo trình E2E bền vững');
  await expect(page.locator('#table-results')).toContainText('Giáo trình E2E bền vững');
});

test('CRUD thu chi, tìm kiếm, bộ lọc, CSV và chống XSS', async ({page}) => {
  await openDemo(page);
  await navigate(page, 'transactions');
  await page.evaluate(() => { window.__xssExecuted = 0; });
  const attack = 'XSS E2E <img src=x onerror="window.__xssExecuted=1">';
  await addTransaction(page, {type: 'out', amount: 123456, category: 'Sức khỏe', note: attack});
  await addTransaction(page, {type: 'in', amount: 2500000, category: 'Kinh doanh', note: 'Thu nhập E2E freelance'});

  await page.locator('#search').fill('XSS E2E');
  await page.locator('#type-filter').selectOption('out');
  await page.locator('#category-filter').selectOption('Sức khỏe');
  const attackRow = page.locator('#table-results tbody tr').filter({hasText: 'XSS E2E'});
  await expect(attackRow).toHaveCount(1);
  expect(await page.evaluate(() => window.__xssExecuted)).toBe(0);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  await attackRow.locator('[data-action="edit-tx"]').click();
  const edit = page.locator('#tx-form');
  await edit.locator('[name="amount"]').fill('234567');
  await edit.locator('[name="note"]').fill('Chi phí y tế E2E đã sửa');
  await edit.getByRole('button', {name: 'Lưu giao dịch'}).click();
  await expect(page.locator('#dialog')).toBeHidden();
  await page.locator('#search').fill('đã sửa');
  await expect(page.locator('#table-results tbody tr').filter({hasText: 'Chi phí y tế E2E đã sửa'})).toHaveCount(1);

  await page.locator('#search').fill('Thu nhập E2E');
  await page.locator('#type-filter').selectOption('in');
  await page.locator('#category-filter').selectOption('Kinh doanh');
  await expect(page.locator('#table-results tbody tr').filter({hasText: 'Thu nhập E2E freelance'})).toHaveCount(1);
  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-action="csv"]').click()
  ]);
  expect(csvDownload.suggestedFilename()).toMatch(/^vi-nho-giao-dich-\d{4}-\d{2}\.csv$/);
  const csv = await streamText(csvDownload);
  expect(csv).toContain('Thu nhập E2E freelance');
  expect(csv).not.toContain('Chi phí y tế E2E đã sửa');

  await page.locator('#type-filter').selectOption('all');
  await page.locator('#category-filter').selectOption('all');
  await page.locator('#search').fill('Chi phí y tế E2E đã sửa');
  const editedRow = page.locator('#table-results tbody tr').filter({hasText: 'Chi phí y tế E2E đã sửa'});
  await editedRow.locator('[data-action="delete-tx"]').click();
  await confirmDialog(page, 'Xóa giao dịch');
  await expect(page.locator('#table-results')).toContainText('Chưa có giao dịch phù hợp');
});

test('chi mới làm vượt ngân sách hiện tại và cảnh báo đúng số tiền', async ({page}) => {
  await openDemo(page);
  await navigate(page, 'transactions');
  await addTransaction(page, {type: 'out', amount: 300000, category: 'Ăn uống', note: 'Bữa ăn vượt hạn mức E2E'});
  await navigate(page, 'budgets');
  const food = page.locator('.budget-row').filter({hasText: 'Ăn uống'});
  await expect(food).toContainText('103%');
  await expect(food).toContainText(/Vượt\s+60\.000/);
  await expect(page.locator('.alert').filter({hasText: '1 danh mục đã vượt hạn mức'})).toBeVisible();
});

test('tạo mục tiêu, cập nhật tích lũy rồi xóa', async ({page}) => {
  await openDemo(page);
  await navigate(page, 'goals');
  await page.locator('#add').click();
  const form = page.locator('#goal-form');
  await form.locator('[name="name"]').fill('Quỹ du lịch E2E');
  await form.locator('[name="target"]').fill('3000000');
  await form.locator('[name="saved"]').fill('500000');
  await form.locator('[name="deadline"]').fill('2027-12-31');
  await form.getByRole('button', {name: 'Lưu mục tiêu'}).click();
  await expect(page.locator('#dialog')).toBeHidden();

  const card = page.locator('.goal-card').filter({hasText: 'Quỹ du lịch E2E'});
  await expect(card).toBeVisible();
  await card.getByRole('button', {name: /Cập nhật tích lũy/}).click();
  const contribution = page.locator('#contribute-form');
  await contribution.locator('[name="amount"]').fill('750000');
  await contribution.getByRole('button', {name: 'Cập nhật tích lũy'}).click();
  await expect(page.locator('#dialog')).toBeHidden();
  await expect(page.locator('.goal-card').filter({hasText: 'Quỹ du lịch E2E'})).toContainText('1.250.000');

  await page.locator('.goal-card').filter({hasText: 'Quỹ du lịch E2E'}).locator('[data-action="delete-goal"]').click();
  await confirmDialog(page, 'Xóa mục tiêu');
  await expect(page.locator('.goal-card').filter({hasText: 'Quỹ du lịch E2E'})).toHaveCount(0);
});

test('giao dịch định kỳ chỉ được ghi một lần cho cùng tháng', async ({page}) => {
  await openDemo(page);
  await navigate(page, 'recurring');
  await page.locator('[data-action="generate-recurring"]').click();
  await expect(page.locator('#dialog')).toContainText('Sẽ tạo 2 giao dịch');
  await confirmDialog(page, 'Ghi nhận giao dịch');

  await page.locator('[data-action="generate-recurring"]').click();
  await expect(page.locator('#toast')).toContainText('Không có giao dịch mới');
  await navigate(page, 'transactions');
  await page.locator('#search').fill('Lương hàng tháng');
  await expect(page.locator('#table-results tbody tr')).toHaveCount(1);
  await expect(page.locator('#table-results')).toContainText('1 giao dịch');
});

test('sao lưu, từ chối JSON sai, khôi phục JSON đúng và trạng thái rỗng trên báo cáo', async ({page}) => {
  await openDemo(page);
  await navigate(page, 'settings');
  const [backupDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-action="backup"]').click()
  ]);
  const backupText = await streamText(backupDownload);
  const backup = JSON.parse(backupText);
  expect(backup.application).toBe('Ví Nhỏ');
  expect(backup).not.toHaveProperty('password');
  expect(backup.state.transactions.length).toBeGreaterThan(0);

  const input = page.locator('#import-file');
  await input.setInputFiles({name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{sai json')});
  await expect(page.locator('#toast')).toContainText('Tệp JSON không đúng định dạng');

  const invalid = structuredClone(backup.state);
  invalid.fieldNotAllowed = true;
  await input.setInputFiles({name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid))});
  await expect(page.locator('#toast')).toContainText('không được hỗ trợ');

  const currentMonth = await page.locator('#month').inputValue();
  backup.state.demo = false;
  backup.state.transactions.push({id: 'e2e-imported', type: 'in', category: 'Đầu tư', amount: 765432,
    date: currentMonth + '-01', note: 'Khoản nhập JSON E2E'});
  await input.setInputFiles({name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))});
  await expect(page.locator('#dialog')).toContainText('Tệp hợp lệ');
  await confirmDialog(page, 'Khôi phục dữ liệu');
  await navigate(page, 'transactions');
  await page.locator('#search').fill('Khoản nhập JSON E2E');
  await expect(page.locator('#table-results')).toContainText('Khoản nhập JSON E2E');

  await navigate(page, 'settings');
  await page.locator('[data-action="clear"]').click();
  await confirmDialog(page, 'Xóa dữ liệu sổ');
  await navigate(page, 'reports');
  await expect(page.getByText('Bức tranh chi tiêu đang chờ bạn')).toBeVisible();
  await expect(page.getByText('Chưa có khoản thu')).toBeVisible();
  await expect(page.locator('.metric-value').first()).toContainText('0');
});

test('tháng biên 2000-01 vẫn render báo cáo mà không truy cập năm 1999', async ({page}) => {
  await openDemo(page);
  const period = page.locator('#month');
  await period.fill('2000-01');
  await period.dispatchEvent('change');
  await navigate(page, 'reports');
  await expect(page.locator('#view')).toContainText('01/2000');
  await expect(page.locator('#view')).not.toContainText('1999');
  await expect(page.getByText('Bức tranh chi tiêu đang chờ bạn')).toBeVisible();
});

test('hai tab phát hiện revision conflict, tải bản mới rồi cho phép thử lại', async ({page, context}) => {
  await register(page, 'conflict');
  const second = await context.newPage();
  const secondErrors = [];
  second.on('pageerror', error => secondErrors.push(error.message));
  await second.goto('/#transactions');
  await expect(second.locator('#application')).toBeVisible();

  await navigate(page, 'transactions');
  await addTransaction(page, {type: 'out', amount: 111111, category: 'Khác', note: 'Thay đổi từ tab một'});
  await addTransaction(second, {type: 'out', amount: 222222, category: 'Khác', note: 'Thay đổi xung đột tab hai'}, {expectSuccess: false});
  await expect(second.locator('#toast')).toContainText(/thay đổi ở nơi khác|thay đổi ở nơi khác/i);
  await second.locator('#search').fill('Thay đổi từ tab một');
  await expect(second.locator('#table-results')).toContainText('Thay đổi từ tab một');
  await second.locator('#search').fill('Thay đổi xung đột tab hai');
  await expect(second.locator('#table-results')).toContainText('Chưa có giao dịch phù hợp');

  await addTransaction(second, {type: 'out', amount: 222222, category: 'Khác', note: 'Thay đổi sau khi tải mới'});
  await second.locator('#search').fill('Thay đổi sau khi tải mới');
  await expect(second.locator('#table-results')).toContainText('Thay đổi sau khi tải mới');
  expect(secondErrors).toEqual([]);
  await second.close();
});
