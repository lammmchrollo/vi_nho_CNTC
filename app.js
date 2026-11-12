'use strict';

// Views consume pure financial functions; only commit() writes application data.
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const money = value => new Intl.NumberFormat('vi-VN', {style:'currency',currency:'VND'}).format(value || 0);
const number = value => new Intl.NumberFormat('vi-VN', {maximumFractionDigits:1}).format(value);
const dateText = value => value.split('-').reverse().join('/');
const monthText = value => value.slice(5) + '/' + value.slice(0, 4);
const today = () => Wallet.localDate();
const uid = () => crypto.randomUUID();
const clone = value => structuredClone(value);
const options = (items, selected) => items.map(v => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
const categoryIcon = name => ({'Ăn uống':'food','Nhà ở':'home','Học tập':'book','Di chuyển':'swap','Lương':'wallet','Trợ cấp':'in'})[name] || 'wallet';
let state, user, revision = 0, saving = false, month = today().slice(0, 7), page = 'home', toastTimer;
let search = '', category = 'all', typeFilter = 'all', sort = 'date-desc', tablePage = 1;
const pageInfo = {
  home: ['Tổng quan','Tổng quan tài chính','Một góc nhìn rõ ràng hơn về tiền và những kế hoạch của bạn.'],
  transactions: ['Thu & chi','Mỗi giao dịch, một câu chuyện','Ghi lại hôm nay để hiểu hơn về thói quen tài chính của mình.'],
  budgets: ['Ngân sách','Chi tiêu có kế hoạch','Đặt giới hạn phù hợp và dành chỗ cho những điều quan trọng.'],
  goals: ['Mục tiêu tiết kiệm','Biến dự định thành hiện thực','Từng khoản nhỏ hôm nay, từng bước gần hơn đến mục tiêu.'],
  recurring: ['Giao dịch định kỳ','Những khoản quen thuộc','Ghi nhận nhanh thu nhập và chi phí lặp lại mỗi tháng.'],
  reports: ['Báo cáo & phân tích','Hiểu những con số của bạn','Nhìn lại dòng tiền, nhận ra xu hướng và chủ động điều chỉnh.'],
  settings: ['Dữ liệu & tài khoản','Sổ tài chính của riêng bạn','Chủ động quản lý dữ liệu, bản sao lưu và quyền riêng tư.']
};

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000);
}

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = Icons(el.dataset.icon); });
}

async function commit(next, message = 'Đã lưu thay đổi.') {
  if (saving) throw new Error('Một thao tác đang được lưu. Vui lòng đợi.');
  saving = true;
  $('sync-status').textContent = 'Đang lưu…';
  try {
    const result = await Api.request('state', 'PUT', {state: Wallet.validateState(next), revision});
    state = result.state;
    revision = result.revision;
    render();
    toast(message);
  } catch (error) {
    if (error.status === 409) {
      const fresh = await Api.request('state');
      state = fresh.state;
      revision = fresh.revision;
      $('dialog').close();
      render();
      toast('Sổ vừa thay đổi ở nơi khác. Đã tải bản mới nhất; hãy thực hiện lại thao tác.');
    }
    if (error.status === 401) showAuth(false, 'Phiên đã hết hạn. Vui lòng đăng nhập lại.');
    throw error;
  } finally {
    saving = false;
    $('sync-status').innerHTML = '<span class="status-dot"></span>Đã đồng bộ';
  }
}

function showAuth(register = false, message = '') {
  $('dialog').close();
  $('application').hidden = true;
  $('auth-screen').hidden = false;
  $('auth-content').innerHTML = `<span class="eyebrow">CHÀO MỪNG ĐẾN VỚI VÍ NHỎ</span><h2>${register ? 'Bắt đầu hành trình của bạn' : 'Rất vui được gặp bạn.'}</h2><p>${register ? 'Tạo một không gian riêng cho tài chính cá nhân.' : 'Đăng nhập để tiếp tục chăm sóc tài chính của mình.'}</p>
    <form class="auth-form" id="auth-form">${register ? '<label class="field">Tên của bạn<input name="name" autocomplete="name" maxlength="80" required placeholder="Nguyễn Minh An"></label>' : ''}
      <label class="field">Email<input name="email" type="email" autocomplete="email" maxlength="254" required placeholder="ban@example.com"></label>
      <label class="field">Mật khẩu<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="10" maxlength="128" required placeholder="Tối thiểu 10 ký tự"></label>
      <div class="error" id="auth-error" role="alert">${esc(message)}</div><button class="primary" type="submit">${register ? 'Tạo tài khoản' : 'Đăng nhập'} ${Icons('arrow')}</button>
    </form><div class="auth-switch">${register ? 'Đã có tài khoản?' : 'Lần đầu đến đây?'}<button id="auth-switch" class="text-button">${register ? 'Đăng nhập' : 'Tạo tài khoản'}</button></div>
    <div class="auth-separator">hoặc trải nghiệm trước</div><button id="try-demo" class="secondary auth-demo">${Icons('sprout')} Khám phá với dữ liệu mẫu</button><p class="auth-privacy">${Icons('shield')} Sổ của mỗi tài khoản được lưu riêng trên máy chủ đang chạy ứng dụng. Demo tạo không gian mô phỏng riêng; không kết nối ngân hàng.</p>`;
  $('auth-switch').onclick = () => showAuth(!register);
  $('auth-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button');
    button.disabled = true;
    $('auth-error').textContent = '';
    try { activate(await Api.request(register ? 'register' : 'login', 'POST', Object.fromEntries(new FormData(form)))); }
    catch (error) { $('auth-error').textContent = error.message; }
    finally { button.disabled = false; }
  };
  $('try-demo').onclick = async event => {
    event.currentTarget.disabled = true;
    try { activate(await Api.request('demo', 'POST', {})); }
    catch (error) { $('auth-error').textContent = error.message; }
    finally { if ($('try-demo')) $('try-demo').disabled = false; }
  };
}

function activate(result) {
  user = result.user;
  state = result.state;
  revision = result.revision;
  month = today().slice(0, 7);
  $('auth-screen').hidden = true;
  $('application').hidden = false;
  $('user-name').textContent = user.name;
  $('user-avatar').textContent = user.name.split(/\s+/).slice(-2).map(v => v[0]).join('').toUpperCase();
  search = ''; category = 'all'; typeFilter = 'all'; tablePage = 1;
  go(pageInfo[location.hash.slice(1)] ? location.hash.slice(1) : 'home');
}

function panel(title, description, content, action = '', extraClass = '') {
  return `<section class="panel ${extraClass}"><div class="panel-head"><div><h2>${title}</h2><p>${description}</p></div>${action}</div>${content}</section>`;
}
function jump(target, label) { return `<button class="text-button" data-action="go" data-id="${target}">${label} ${Icons('arrow')}</button>`; }
function empty(title, copy, icon = 'sprout') { return `<div class="empty">${Icons(icon)}<strong>${title}</strong>${copy}</div>`; }
function metric(label, value, note, icon, dark = false) {
  return `<div class="metric${dark ? ' dark' : ''}"><span class="metric-top"><span class="metric-icon ${icon}">${Icons(icon)}</span>${label}</span><strong class="metric-value">${value}</strong><span class="metric-note">${note}</span></div>`;
}
function metrics(rows) {
  const totals = Wallet.summary(rows);
  return `<div class="metrics">${metric('Dòng tiền ròng', money(totals.net), 'Thu nhập − chi tiêu trong tháng', 'wallet', true)}${metric('Tổng thu nhập', money(totals.income), rows.filter(r => r.type === 'in').length + ' khoản thu trong tháng', 'in')}${metric('Tổng chi tiêu', money(totals.expense), rows.filter(r => r.type === 'out').length + ' khoản chi trong tháng', 'out')}${metric('Tỷ lệ tích lũy', totals.income ? number(totals.savingRate) + '%' : '—', totals.income ? '(Thu − chi) / thu nhập × 100%' : 'Chưa có thu nhập để tính tỷ lệ', 'sprout')}</div>`;
}

function cashflowChart() {
  const values = Wallet.trend(state.transactions, month, 6);
  const peak = Math.max(1000000, ...values.flatMap(v => [v.income, v.expense]));
  const scale = 10 ** Math.floor(Math.log10(peak));
  const top = Math.ceil(peak / scale) * scale;
  const compact = value => new Intl.NumberFormat('vi-VN', {notation:'compact',maximumFractionDigits:1}).format(value);
  const grid = [0, 1, 2, 3].map(i => {
    const y = 20 + i * 57;
    return `<line class="grid" x1="48" x2="590" y1="${y}" y2="${y}"/><text x="38" y="${y + 4}" text-anchor="end">${compact(top * (3-i)/3)}</text>`;
  }).join('');
  const bars = values.map((v, i) => {
    const x = 86 + i * 94;
    return ['income','expense'].map((key,j) => { const h = 171 * v[key] / top; return `<rect class="bar-${j ? 'out' : 'in'}" x="${x + j * 20 - 16}" y="${191 - h}" width="15" height="${h}" rx="3"><title>${monthText(v.month)} · ${j ? 'Chi' : 'Thu'} ${money(v[key])}</title></rect>`; }).join('') + `<text x="${x + 2}" y="215" text-anchor="middle">${v.month.slice(5)}/${v.month.slice(2,4)}</text>`;
  }).join('');
  return `<svg class="chart-svg" viewBox="0 0 610 230" role="img" aria-label="Biểu đồ thu chi sáu tháng. Số liệu chi tiết có trong trang báo cáo.">${grid}${bars}</svg>`;
}
const legend = '<div class="chart-legend"><span><i class="legend-dot"></i>Thu nhập</span><span><i class="legend-dot expense"></i>Chi tiêu</span></div>';

function budgetRows(rows, full = false) {
  const spending = Wallet.byCategory(rows);
  const entries = state.budgets.filter(r => r.month === month).map(r => ({...r, ...Wallet.budgetStatus(spending[r.category] || 0, r.cap)})).sort((a,b) => b.percent - a.percent);
  if (!entries.length) return empty('Một kế hoạch nhỏ, một thay đổi lớn', 'Đặt hạn mức đầu tiên để theo dõi chi tiêu theo danh mục.', 'chart');
  return `<div class="${full ? 'budget-full' : 'budget-list'}">${(full ? entries : entries.slice(0,3)).map(r => `<div class="budget-row"><div class="budget-top"><strong>${esc(r.category)}</strong><span class="budget-percent ${r.level}">${r.percent}%</span></div><progress class="${r.level}" max="100" value="${Math.min(r.percent,100)}" aria-label="${esc(r.category)} đã dùng ${r.percent}%"></progress><div class="budget-meta"><span>${money(r.spent)} / ${money(r.cap)}</span><span>${r.remaining < 0 ? 'Vượt ' : 'Còn '}${money(Math.abs(r.remaining))}</span></div>${full ? `<div class="budget-controls"><button class="text-button" data-action="edit-budget" data-id="${esc(r.category)}">Sửa hạn mức</button><button class="icon-button delete" data-action="delete-budget" data-id="${esc(r.category)}" aria-label="Xóa hạn mức ${esc(r.category)}">${Icons('trash')}</button></div>` : ''}</div>`).join('')}</div>${entries.some(r => r.level === 'over' || r.level === 'near') ? `<div class="alert">${Icons('warning')}<span>${entries.filter(r => r.level === 'over').length ? entries.filter(r => r.level === 'over').length + ' danh mục đã vượt hạn mức.' : 'Có danh mục đã sử dụng từ 80% ngân sách.'} Cùng xem lại kế hoạch nhé.</span></div>` : ''}`;
}

function transactionTable(rows, editable = false) {
  if (!rows.length) return empty('Chưa có giao dịch phù hợp', 'Thêm giao dịch hoặc thử thay đổi tháng và bộ lọc.', 'swap');
  return `<div class="table-wrap"><table class="transactions"><thead><tr><th>Giao dịch</th><th class="category-col">Danh mục</th><th>Ngày</th><th class="amount">Số tiền</th>${editable ? '<th>Thao tác</th>' : ''}</tr></thead><tbody>${rows.map(r => `<tr><td><div class="row-name"><span class="item-icon ${r.type}">${Icons(r.type === 'in' ? 'in' : categoryIcon(r.category))}</span><span><strong>${esc(r.note || r.category)}</strong><small>${r.type === 'in' ? 'Khoản thu' : 'Khoản chi'}</small></span></div></td><td class="category-col"><span class="tag">${esc(r.category)}</span></td><td>${dateText(r.date)}</td><td class="amount ${r.type}">${r.type === 'in' ? '+' : '−'}${money(r.amount)}</td>${editable ? `<td><button class="icon-button" data-action="edit-tx" data-id="${esc(r.id)}" aria-label="Sửa ${esc(r.note || r.category)}">${Icons('edit')}</button><button class="icon-button delete" data-action="delete-tx" data-id="${esc(r.id)}" aria-label="Xóa ${esc(r.note || r.category)}">${Icons('trash')}</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

function insightCards() {
  return `<div class="insights">${Wallet.insights(state, month, today()).map(r => `<div class="insight ${esc(r.level)}">${Icons(r.level === 'warning' ? 'warning' : r.level === 'good' ? 'sprout' : 'info')}<div><strong>${esc(r.title)}</strong><p>${esc(r.detail)}</p></div></div>`).join('')}</div>`;
}

function expenseComposition(rows) {
  const amounts = Object.entries(Wallet.byCategory(rows)).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]);
  const total = Wallet.totalSpent(rows);
  if (!total) return empty('Bức tranh chi tiêu đang chờ bạn', 'Ghi lại khoản chi đầu tiên để xem tỷ trọng từng danh mục.', 'chart');
  let start = -Math.PI / 2;
  const segments = amounts.map(([name,value],i) => {
    const end = start + value / total * Math.PI * 2;
    const x1 = 90 + 65 * Math.cos(start), y1 = 90 + 65 * Math.sin(start);
    const x2 = 90 + 65 * Math.cos(end), y2 = 90 + 65 * Math.sin(end);
    const path = value === total ? `<circle cx="90" cy="90" r="65" fill="none" stroke="#315f49" stroke-width="21"/>` : `<path class="palette-${i}" d="M90 90 L${x1} ${y1} A65 65 0 ${end-start > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z"><title>${esc(name)}: ${number(value/total*100)}%</title></path>`;
    start = end;
    return path;
  }).join('');
  return `<div class="donut-layout"><svg class="donut" viewBox="0 0 180 180" role="img" aria-label="Tỷ trọng chi tiêu theo danh mục">${segments}<circle cx="90" cy="90" r="49" fill="white"/><text x="90" y="85" text-anchor="middle" font-size="10">Tổng chi tiêu</text><text x="90" y="106" text-anchor="middle" font-size="17" font-weight="600">${number(total/1000000)} triệu</text></svg><div class="donut-key">${amounts.map(([name,value],i) => `<div><i class="swatch palette-${i}"></i><span>${esc(name)}</span><strong>${number(value/total*100)}%</strong></div>`).join('')}</div></div>`;
}

function forecastBox(rows) {
  const result = Wallet.forecast(rows, month, today());
  const projected = result.projectedExpense;
  return `<div class="forecast-box"><div><small>ƯỚC TÍNH CHI TIÊU CUỐI THÁNG</small><strong>${projected == null ? 'Chưa đủ dữ liệu' : money(projected)}</strong></div><p>${month < today().slice(0,7) ? 'Tháng đã kết thúc: hiển thị tổng chi thực tế.' : month > today().slice(0,7) ? 'Chưa dự báo cho tháng tương lai.' : projected == null ? 'Chưa có khoản chi đã xảy ra trong tháng để ước tính. Hãy ghi nhận chi tiêu thực tế trước.' : 'Chi đã ghi đến hôm nay / số ngày đã qua × số ngày trong tháng. Ước tính tuyến tính, không phải AI; có thể lệch khi có khoản chi bất thường.'}</p></div>`;
}

function render() {
  if (!state || !user) return;
  const info = pageInfo[page];
  $('breadcrumb').textContent = info[0];
  $('page-title').textContent = info[1];
  $('page-copy').textContent = info[2];
  $('month').value = month;
  $('month').parentElement.hidden = ['goals','settings'].includes(page);
  $('add').hidden = page === 'settings';
  $('add').innerHTML = Icons('plus') + ({budgets:'Đặt ngân sách',goals:'Tạo mục tiêu',recurring:'Thêm lịch định kỳ'}[page] || 'Thêm giao dịch');
  $('mode-badge').textContent = state.demo ? 'Dữ liệu mô phỏng' : 'Sổ cá nhân';
  document.querySelectorAll('[data-page]').forEach(button => {
    if (button.dataset.page === page) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
  });
  const rows = Wallet.period(state.transactions,month).slice().reverse().sort((a,b) => b.date.localeCompare(a.date));
  const view = $('view');
  if (page === 'home') view.innerHTML = metrics(rows) + `<div class="dashboard-grid">${panel('Dòng tiền của bạn','Thu nhập và chi tiêu trong 6 tháng gần nhất',cashflowChart(),legend)}${panel('Ngân sách tháng này','Giữ kế hoạch của bạn trong tầm kiểm soát',budgetRows(rows),jump('budgets','Chi tiết'))}${panel('Giao dịch gần đây','Những khoản thu, chi mới nhất trong tháng',transactionTable(rows.slice(0,5)),jump('transactions','Xem tất cả'))}${panel('Góc nhìn tài chính','Một vài gợi ý từ dữ liệu bạn đã ghi',insightCards())}</div>`;
  if (page === 'transactions') {
    view.innerHTML = panel('Sổ giao dịch','Thu và chi trong tháng ' + monthText(month),`<div class="filters"><label class="search-field">${Icons('search')}<input id="search" type="search" aria-label="Tìm giao dịch" placeholder="Tìm ghi chú, danh mục…"></label><select id="type-filter" aria-label="Loại giao dịch"><option value="all">Tất cả thu & chi</option><option value="in">Chỉ khoản thu</option><option value="out">Chỉ khoản chi</option></select><select id="category-filter" aria-label="Danh mục"><option value="all">Mọi danh mục</option>${options([...new Set([...Wallet.expenses,...Wallet.income])])}</select><select id="sort" aria-label="Sắp xếp"><option value="date-desc">Mới nhất</option><option value="date-asc">Cũ nhất</option><option value="amount-desc">Tiền nhiều nhất</option><option value="amount-asc">Tiền ít nhất</option></select></div><div id="table-results"></div>`,`<button class="secondary" data-action="csv">${Icons('download')} Xuất CSV</button>`);
    $('search').value = search; $('type-filter').value = typeFilter; $('category-filter').value = category; $('sort').value = sort;
    for (const id of ['search','type-filter','category-filter','sort']) $(id).addEventListener(id === 'search' ? 'input' : 'change', event => {
      if (id === 'search') search = event.target.value;
      if (id === 'type-filter') typeFilter = event.target.value;
      if (id === 'category-filter') category = event.target.value;
      if (id === 'sort') sort = event.target.value;
      tablePage = 1; renderTable();
    });
    renderTable();
  }
  if (page === 'budgets') view.innerHTML = panel('Hạn mức theo danh mục','Cảnh báo từ 80% · Vượt hạn mức khi chi nhiều hơn ngân sách',budgetRows(rows,true)) + `<div class="alert info">${Icons('info')}<span>Ngân sách là giới hạn chi của từng danh mục trong tháng, không phải số dư tài khoản. Khoản thu không làm giảm phần ngân sách đã dùng.</span></div>`;
  if (page === 'goals') view.innerHTML = goalCards() + `<div class="alert info">${Icons('info')}<span>Số đã tích lũy là khoản bạn tự phân bổ cho mục tiêu. Cập nhật mục tiêu không tạo giao dịch thu/chi và không tự chuyển tiền. Hãy tránh phân bổ cùng một khoản tiền cho nhiều mục tiêu.</span></div>`;
  if (page === 'recurring') view.innerHTML = panel('Lịch thu chi hàng tháng','Chọn tháng rồi xác nhận để ghi nhận. Mỗi lịch chỉ tạo một giao dịch trong một tháng.',recurringTable(),`<button class="primary" data-action="generate-recurring">${Icons('repeat')} Ghi nhận tháng ${monthText(month)}</button>`) + `<div class="alert info">${Icons('clock')}<span>Ứng dụng không chạy ngầm và không tự thanh toán. Khoản tiền chỉ được ghi vào sổ sau khi bạn xác nhận. Nếu ngày 31 không tồn tại, hệ thống chọn ngày cuối tháng.</span></div>`;
  if (page === 'reports') view.innerHTML = metrics(rows) + `<div class="dashboard-grid">${panel('Xu hướng thu chi','6 tháng tính đến ' + monthText(month),cashflowChart() + forecastBox(rows),legend)}${panel('Tiền của bạn đi đâu?','Tỷ trọng các khoản chi trong tháng',expenseComposition(rows))}${panel('Chi tiết dòng tiền','Số liệu từ các giao dịch đã ghi',trendTable(),'<button class="text-button" data-action="print">' + Icons('print') + ' In báo cáo</button>')}${panel('Gợi ý điều chỉnh','Các quy tắc minh bạch, không sử dụng mô hình AI',insightCards())}</div>`;
  if (page === 'settings') { view.innerHTML = settingsView(); loadAudit(); }
}

function filteredRows() {
  const rows = Wallet.period(state.transactions,month).filter(r => (category === 'all' || r.category === category) && (typeFilter === 'all' || r.type === typeFilter) && (r.note + ' ' + r.category).toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
  return rows.sort((a,b) => sort.startsWith('amount') ? (sort.endsWith('desc') ? b.amount-a.amount : a.amount-b.amount) : (sort.endsWith('desc') ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
}
function renderTable() {
  const rows = filteredRows();
  const pages = Math.max(1,Math.ceil(rows.length/10));
  tablePage = Math.min(tablePage,pages);
  $('table-results').innerHTML = transactionTable(rows.slice((tablePage-1)*10,tablePage*10),true) + `<div class="pagination"><span>${rows.length} giao dịch · Trang ${tablePage}/${pages}</span><div><button class="secondary" data-action="previous"${tablePage === 1 ? ' disabled' : ''}>Trước</button><button class="secondary" data-action="next"${tablePage === pages ? ' disabled' : ''}>Sau</button></div></div>`;
}

function goalCards() {
  if (!state.goals.length) return panel('Gieo một mục tiêu mới','Điều bạn muốn thực hiện tiếp theo là gì?',empty('Một chuyến đi, một chiếc laptop, hay quỹ dự phòng?', 'Tạo mục tiêu đầu tiên và chia nhỏ hành trình tiết kiệm.', 'target'));
  return `<div class="cards-grid">${state.goals.map(g => {
    const status = Wallet.goalProgress(g,today());
    return `<article class="goal-card"><div class="budget-top"><span class="item-icon">${Icons('target')}</span><div><button class="icon-button" data-action="edit-goal" data-id="${esc(g.id)}" aria-label="Sửa mục tiêu ${esc(g.name)}">${Icons('edit')}</button><button class="icon-button delete" data-action="delete-goal" data-id="${esc(g.id)}" aria-label="Xóa mục tiêu ${esc(g.name)}">${Icons('trash')}</button></div></div><h3>${esc(g.name)}</h3><p>Thời hạn ${dateText(g.deadline)}</p><strong class="goal-value">${money(g.saved)} <span class="goal-sub">/ ${money(g.target)}</span></strong><progress max="100" value="${Math.min(100,status.percent)}" aria-label="Đã đạt ${status.percent}% mục tiêu"></progress><div class="budget-meta"><span>${number(status.percent)}% hoàn thành</span><span>Còn ${money(status.remaining)}</span></div><div class="alert info">${Icons('sprout')}<span>${status.remaining <= 0 ? 'Bạn đã hoàn thành mục tiêu. Chúc mừng!' : g.deadline < today() ? 'Đã qua thời hạn. Bạn có thể điều chỉnh kế hoạch.' : 'Cần khoảng ' + money(status.monthlyNeeded) + '/tháng để theo kịp kế hoạch.'}</span></div><button class="primary" data-action="contribute" data-id="${esc(g.id)}">${Icons('plus')} Cập nhật tích lũy</button></article>`;
  }).join('')}</div>`;
}

function recurringTable() {
  if (!state.recurring.length) return empty('Để những khoản quen thuộc dễ nhớ hơn','Thêm tiền phòng, lương hoặc các khoản thu chi lặp lại.','repeat');
  return `<div class="table-wrap"><table class="transactions"><thead><tr><th>Khoản định kỳ</th><th>Hàng tháng</th><th>Trạng thái</th><th class="amount">Số tiền</th><th>Thao tác</th></tr></thead><tbody>${state.recurring.map(r => `<tr><td><div class="row-name"><span class="item-icon ${r.type}">${Icons('repeat')}</span><span><strong>${esc(r.note || r.category)}</strong><small>${esc(r.category)} · từ ${monthText(r.startMonth)}${r.endMonth ? ' đến ' + monthText(r.endMonth) : ''}</small></span></div></td><td>Ngày ${r.day}</td><td><span class="tag">${r.active ? 'Đang dùng' : 'Tạm dừng'}</span></td><td class="amount ${r.type}">${r.type === 'in' ? '+' : '−'}${money(r.amount)}</td><td><button class="icon-button" data-action="edit-recurring" data-id="${esc(r.id)}" aria-label="Sửa lịch ${esc(r.note || r.category)}">${Icons('edit')}</button><button class="icon-button delete" data-action="delete-recurring" data-id="${esc(r.id)}" aria-label="Xóa lịch ${esc(r.note || r.category)}">${Icons('trash')}</button></td></tr>`).join('')}</tbody></table></div>`;
}
function trendTable() {
  return `<div class="table-wrap"><table class="transactions"><thead><tr><th>Tháng</th><th class="amount">Thu nhập</th><th class="amount">Chi tiêu</th><th class="amount">Dòng tiền ròng</th></tr></thead><tbody>${Wallet.trend(state.transactions,month,6).map(r => `<tr><td>${monthText(r.month)}</td><td class="amount in">${money(r.income)}</td><td class="amount out">${money(r.expense)}</td><td class="amount">${money(r.net)}</td></tr>`).join('')}</tbody></table></div>`;
}

function settingsView() {
  return `<div class="settings-grid">${panel('Tài khoản của bạn','Dữ liệu được phân tách theo tài khoản',`<div class="account-detail"><div><span>Họ tên</span><strong>${esc(user.name)}</strong></div><div><span>Email</span><strong>${esc(user.email)}</strong></div><div><span>Giao dịch</span><strong>${state.transactions.length}</strong></div><div><span>Phiên bản dữ liệu</span><strong>${revision}</strong></div></div><div class="settings-actions"><button class="secondary" data-action="logout">${Icons('logout')} Đăng xuất</button><button class="secondary" data-action="refresh">${Icons('repeat')} Tải dữ liệu mới nhất</button></div>`)}
    ${panel('Sao lưu & khôi phục','Bản JSON chứa toàn bộ sổ; CSV chỉ chứa giao dịch theo bộ lọc',`<p>Tải bản sao lưu trước khi chuyển máy hoặc thay dữ liệu. Tệp JSON không chứa mật khẩu, nhưng có thông tin thu chi cá nhân; hãy cất giữ cẩn thận.</p><div class="settings-actions"><button class="primary" data-action="backup">${Icons('download')} Sao lưu JSON</button><button class="secondary" data-action="import">${Icons('upload')} Khôi phục JSON</button><input type="file" id="import-file" accept=".json,application/json" hidden></div>`)}
    ${panel('Dữ liệu mẫu & dữ liệu cũ','Bạn luôn được xem lại trước khi thay thế dữ liệu',`<p>Bộ mô phỏng bao gồm 6 tháng thu chi, ngân sách và mục tiêu. Sổ phiên bản cũ được nhập từ trình duyệt này và giữ nguyên khoản thu, chi.</p><div class="settings-actions"><button class="secondary" data-action="seed">${Icons('sprout')} Nạp dữ liệu mẫu</button><button class="secondary" data-action="legacy">Nhập sổ phiên bản cũ</button><button class="danger" data-action="clear">Xóa dữ liệu sổ</button></div>`)}
    ${panel('Quyền riêng tư & giới hạn','Một prototype minh bạch về khả năng của mình',`<p>Mật khẩu được băm bằng scrypt. Phiên đăng nhập dùng cookie HttpOnly. Dữ liệu thu chi nằm trong SQLite trên máy chủ chạy ứng dụng; chưa mã hóa nội dung cơ sở dữ liệu.</p><p>Không truy cập ngân hàng, không thực hiện thanh toán, không có AI hoặc tư vấn đầu tư. Chỉ ghi nhận các giao dịch bạn nhập.</p><details><summary>Dòng tiền ròng khác số dư ngân hàng thế nào?</summary><p>Dòng tiền ròng = khoản thu − khoản chi đã ghi trong tháng. Chưa có số dư đầu kỳ, nên không thể xem đây là số tiền thực có trong ngân hàng.</p></details><details><summary>Tại sao số liệu mục tiêu không thay đổi thu chi?</summary><p>Mục tiêu là cách theo dõi số tiền đã dành riêng. Tự động ghi khoản chi khi phân bổ tiền sẽ làm sai dòng tiền, vì tiền chưa thực sự được chi.</p></details><details><summary>Khi hai tab cùng sửa dữ liệu?</summary><p>Máy chủ kiểm tra số phiên bản. Nếu có thay đổi mới, thao tác cũ bị từ chối và ứng dụng tải lại sổ để tránh ghi đè.</p></details>`)}
    ${panel('Lịch sử hoạt động','Các lần thay đổi dữ liệu gần đây','<ul class="audit-list" id="audit-list"><li>Đang tải lịch sử…</li></ul>')}
    ${panel('Hồ sơ dự án FinTech','Đề tài: Hệ thống quản lý tài chính cá nhân',`<p>Báo cáo, slide thuyết trình, thiết kế và kịch bản demo được lưu trong thư mục docs của mã nguồn.</p><div class="settings-actions"><a class="secondary" href="/docs/report.html" target="_blank" rel="noopener">${Icons('report')} Đọc báo cáo</a><a class="secondary" href="/docs/presentation.html" target="_blank" rel="noopener">${Icons('chart')} Mở slide</a></div>`)}</div>`;
}
async function loadAudit() {
  try {
    const result = await Api.request('audit');
    if (page === 'settings' && $('audit-list')) $('audit-list').innerHTML = result.events.length ? result.events.map(r => `<li><span>${esc(({register:'Tạo tài khoản',login:'Đăng nhập',demo:'Tạo sổ mô phỏng',update:'Cập nhật sổ',state_update:'Cập nhật sổ',logout:'Đăng xuất'})[r.action] || r.action)}</span><time>${esc(new Date(r.createdAt).toLocaleString('vi-VN'))}</time></li>`).join('') : '<li>Chưa có hoạt động nào.</li>';
  } catch { if ($('audit-list')) $('audit-list').innerHTML = '<li>Chưa tải được lịch sử. Hãy thử tải lại dữ liệu.</li>'; }
}

function openDialog(title, content) {
  $('dialog-content').innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${title}</h2><button id="close-dialog" class="icon-button" aria-label="Đóng">${Icons('x')}</button></div>${content}`;
  $('close-dialog').onclick = () => $('dialog').close();
  $('cancel-dialog')?.addEventListener('click', () => $('dialog').close());
  if (!$('dialog').open) $('dialog').showModal();
}
const errorMarkup = '<div class="error" id="form-error" role="alert"></div>';
const actions = (label, danger = false) => `<div class="dialog-actions"><button class="secondary" type="button" id="cancel-dialog">Hủy</button><button type="submit" class="${danger ? 'danger' : 'primary'}">${label}</button></div>`;
const amountField = (label = 'Số tiền (VND)', value = '', name = 'amount', min = 1) => `<label class="field">${label}<input name="${name}" type="number" inputmode="numeric" min="${min}" max="${Wallet.limit}" step="1" value="${esc(value)}" placeholder="300000" required></label>`;
const dateField = (label, name, value) => `<label class="field">${label}<input type="date" name="${name}" min="2000-01-01" max="2099-12-31" value="${esc(value)}" required></label>`;

function bindForm(id, handler) {
  const form = $(id);
  form.onsubmit = async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    const errorElement = form.querySelector('.error');
    errorElement.textContent = '';
    try { await handler(new FormData(form)); }
    catch (error) { if (errorElement.isConnected) errorElement.textContent = error.message; else toast(error.message); }
    finally { submit.disabled = false; }
  };
}

function transactionDialog(existing) {
  const type = existing?.type || 'out';
  const date = existing?.date || (today().startsWith(month) ? today() : month + '-01');
  openDialog(existing ? 'Điều chỉnh giao dịch' : 'Thêm giao dịch mới', `<form id="tx-form"><div class="form-grid"><label class="field">Loại giao dịch<select name="type">${options(['out','in'],type).replace('>out<','>Khoản chi<').replace('>in<','>Khoản thu<')}</select></label>${amountField('Số tiền (VND)',existing?.amount)}<label class="field">Danh mục<select name="category">${options(type === 'out' ? Wallet.expenses : Wallet.income,existing?.category)}</select></label>${dateField('Ngày giao dịch','date',date)}<label class="field wide">Ghi chú<input name="note" maxlength="100" placeholder="Ví dụ: Ăn trưa, lương tháng…" value="${esc(existing?.note)}"></label></div>${errorMarkup}${actions('Lưu giao dịch')}</form>`);
  const form = $('tx-form');
  form.elements.type.onchange = event => { form.elements.category.innerHTML = options(event.target.value === 'in' ? Wallet.income : Wallet.expenses); };
  bindForm('tx-form', async fields => {
    const row = {id:existing?.id || uid(),type:fields.get('type'),category:fields.get('category'),amount:Number(fields.get('amount')),date:fields.get('date'),note:fields.get('note').trim()};
    const next = clone(state);
    next.transactions = existing ? next.transactions.map(r => r.id === row.id ? row : r) : [...next.transactions,row];
    await commit(next,existing ? 'Đã cập nhật giao dịch.' : 'Đã ghi nhận giao dịch mới.');
    month = row.date.slice(0,7); tablePage = 1;
    $('dialog').close(); render();
  });
  form.elements.amount.focus();
}

function budgetDialog(categoryName) {
  const editingMonth = month;
  const existing = state.budgets.find(r => r.month === editingMonth && r.category === categoryName);
  const available = Wallet.expenses.filter(c => !state.budgets.some(r => r.month === editingMonth && r.category === c));
  if (!existing && !available.length) return toast('Tất cả danh mục đã có ngân sách. Hãy chỉnh sửa hạn mức hiện có.');
  openDialog(existing ? 'Điều chỉnh ngân sách' : 'Ngân sách mới',`<p class="dialog-body">Kế hoạch chi tiêu cho tháng ${monthText(editingMonth)}.</p><form id="budget-form"><div class="form-grid"><label class="field">Danh mục<select name="category">${options(existing ? [categoryName] : available,categoryName)}</select></label>${amountField('Hạn mức (VND)',existing?.cap)}</div>${errorMarkup}${actions('Lưu ngân sách')}</form>`);
  bindForm('budget-form', async fields => {
    const name = fields.get('category');
    const next = clone(state);
    next.budgets = next.budgets.filter(r => r.month !== editingMonth || r.category !== name);
    next.budgets.push({month:editingMonth,category:name,cap:Number(fields.get('amount'))});
    await commit(next,'Đã lưu kế hoạch ngân sách.');
    $('dialog').close();
  });
}

function goalDialog(existing) {
  const currentDate = today();
  const nextYear = Math.min(2099,Number(currentDate.slice(0,4))+1);
  const targetMonth = Number(currentDate.slice(5,7));
  const targetDay = Math.min(Number(currentDate.slice(8)),new Date(nextYear,targetMonth,0).getDate());
  const defaultDeadline = nextYear + '-' + String(targetMonth).padStart(2,'0') + '-' + String(targetDay).padStart(2,'0');
  openDialog(existing ? 'Điều chỉnh mục tiêu' : 'Gieo một mục tiêu mới',`<form id="goal-form"><div class="form-grid"><label class="field wide">Tên mục tiêu<input name="name" maxlength="80" required value="${esc(existing?.name)}" placeholder="Ví dụ: Quỹ dự phòng, laptop mới…"></label>${amountField('Số tiền mục tiêu (VND)',existing?.target,'target')}${amountField('Đã tích lũy (VND)',existing?.saved ?? 0,'saved',0)}${dateField('Thời hạn dự kiến','deadline',existing?.deadline || defaultDeadline)}</div>${errorMarkup}${actions('Lưu mục tiêu')}</form>`);
  bindForm('goal-form',async fields => {
    const row = {id:existing?.id || uid(),name:fields.get('name').trim(),target:Number(fields.get('target')),saved:Number(fields.get('saved')),deadline:fields.get('deadline')};
    const next = clone(state);
    next.goals = existing ? next.goals.map(r => r.id === row.id ? row : r) : [...next.goals,row];
    await commit(next,'Đã lưu mục tiêu tiết kiệm.');
    $('dialog').close();
  });
}

function contributeDialog(id) {
  const goal = state.goals.find(r => r.id === id);
  if (!goal) return;
  openDialog('Thêm một bước đến mục tiêu',`<p class="dialog-body">${esc(goal.name)} · Đã tích lũy ${money(goal.saved)}. Khoản phân bổ này không tạo giao dịch thu chi.</p><form id="contribute-form">${amountField('Số tiền bổ sung (VND)')}${errorMarkup}${actions('Cập nhật tích lũy')}</form>`);
  bindForm('contribute-form',async fields => {
    const next = clone(state);
    const row = next.goals.find(r => r.id === id);
    row.saved += Number(fields.get('amount'));
    await commit(next,'Đã cập nhật tích lũy cho mục tiêu.');
    $('dialog').close();
  });
}

function recurringDialog(existing) {
  const type = existing?.type || 'out';
  openDialog(existing ? 'Điều chỉnh lịch định kỳ' : 'Một khoản định kỳ mới',`<form id="recurring-form"><div class="form-grid"><label class="field">Loại giao dịch<select name="type">${options(['out','in'],type).replace('>out<','>Khoản chi<').replace('>in<','>Khoản thu<')}</select></label>${amountField('Số tiền (VND)',existing?.amount)}<label class="field">Danh mục<select name="category">${options(type === 'in' ? Wallet.income : Wallet.expenses,existing?.category)}</select></label><label class="field">Ngày trong tháng<input type="number" name="day" min="1" max="31" step="1" required value="${existing?.day || 1}"></label><label class="field">Bắt đầu từ tháng<input type="month" name="startMonth" min="2000-01" max="2099-12" value="${existing?.startMonth || month}" required></label><label class="field">Kết thúc (không bắt buộc)<input type="month" name="endMonth" min="2000-01" max="2099-12" value="${existing?.endMonth || ''}"></label><label class="field wide">Ghi chú<input name="note" maxlength="100" value="${esc(existing?.note)}" placeholder="Ví dụ: Tiền phòng hàng tháng"></label><label class="checkbox"><input type="checkbox" name="active"${existing?.active !== false ? ' checked' : ''}>Sử dụng lịch này</label></div>${errorMarkup}${actions('Lưu lịch định kỳ')}</form>`);
  const form = $('recurring-form');
  form.elements.type.onchange = event => { form.elements.category.innerHTML = options(event.target.value === 'in' ? Wallet.income : Wallet.expenses); };
  bindForm('recurring-form',async fields => {
    const row = {id:existing?.id || uid(),type:fields.get('type'),category:fields.get('category'),amount:Number(fields.get('amount')),note:fields.get('note').trim(),day:Number(fields.get('day')),startMonth:fields.get('startMonth'),active:fields.has('active')};
    if (fields.get('endMonth')) row.endMonth = fields.get('endMonth');
    const next = clone(state);
    next.recurring = existing ? next.recurring.map(r => r.id === row.id ? row : r) : [...next.recurring,row];
    await commit(next,'Đã lưu lịch định kỳ.');
    $('dialog').close();
  });
}

function confirmChange(title, description, build, label = 'Xác nhận', danger = false, after) {
  openDialog(title,`<p class="dialog-body">${description}</p><form id="confirm-form">${errorMarkup}${actions(label,danger)}</form>`);
  bindForm('confirm-form',async () => {
    await commit(build());
    $('dialog').close();
    after?.();
  });
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text],{type}));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

async function importFile(file) {
  if (!file) return;
  if (file.size > 2000000) return toast('Tệp quá lớn. Giới hạn nhập là 2 MB.');
  try {
    const parsed = JSON.parse(await file.text());
    const candidate = parsed.state || parsed;
    const normalized = candidate.version === 1 ? Wallet.migrateLegacy(candidate) : Wallet.validateState(candidate);
    confirmChange('Khôi phục bản sao lưu?',`Tệp hợp lệ: ${normalized.transactions.length} giao dịch, ${normalized.budgets.length} ngân sách, ${normalized.goals.length} mục tiêu và ${normalized.recurring.length} lịch. Toàn bộ sổ hiện tại sẽ được thay thế. Hãy tải bản sao lưu hiện tại trước nếu cần.`,() => normalized,'Khôi phục dữ liệu',true);
  } catch (error) { toast('Không nhập dữ liệu: ' + (error instanceof SyntaxError ? 'Tệp JSON không đúng định dạng.' : error.message)); }
}

async function logout() {
  try {
    await Api.request('logout','POST',{});
    state = null; user = null; revision = 0;
    showAuth();
  } catch (error) { toast(error.message); }
}

function go(next) {
  if (!pageInfo[next]) return;
  page = next; tablePage = 1;
  if (location.hash !== '#' + page) history.replaceState(null,'','#' + page);
  render(); window.scrollTo(0,0);
}

async function handleAction(button) {
  const {action,id} = button.dataset;
  if (action === 'go') go(id);
  if (action === 'edit-tx') transactionDialog(state.transactions.find(r => r.id === id));
  if (action === 'delete-tx') {
    const row = state.transactions.find(r => r.id === id);
    if (row) confirmChange('Xóa giao dịch?',`${esc(row.note || row.category)} · ${money(row.amount)}. Báo cáo và ngân sách sẽ được tính lại.`,() => ({...state,transactions:state.transactions.filter(r => r.id !== id)}),'Xóa giao dịch',true);
  }
  if (action === 'edit-budget') budgetDialog(id);
  if (action === 'delete-budget') {
    const selectedMonth = month;
    confirmChange('Xóa hạn mức?',`Hạn mức ${esc(id)} trong tháng ${monthText(month)} sẽ được xóa. Các giao dịch vẫn còn trong sổ.`,() => ({...state,budgets:state.budgets.filter(r => r.month !== selectedMonth || r.category !== id)}),'Xóa hạn mức',true);
  }
  if (action === 'edit-goal') goalDialog(state.goals.find(r => r.id === id));
  if (action === 'contribute') contributeDialog(id);
  if (action === 'delete-goal') confirmChange('Xóa mục tiêu?', 'Chỉ xóa kế hoạch theo dõi. Các giao dịch không thay đổi.',() => ({...state,goals:state.goals.filter(r => r.id !== id)}),'Xóa mục tiêu',true);
  if (action === 'edit-recurring') recurringDialog(state.recurring.find(r => r.id === id));
  if (action === 'delete-recurring') confirmChange('Xóa lịch định kỳ?', 'Các giao dịch đã tạo vẫn được giữ lại. Lịch này sẽ không tạo thêm giao dịch mới.',() => ({...state,recurring:state.recurring.filter(r => r.id !== id)}),'Xóa lịch',true);
  if (action === 'generate-recurring') {
    const selectedMonth = month;
    const result = Wallet.applyRecurring(state,selectedMonth);
    if (!result.added.length) return toast('Không có giao dịch mới: các lịch đã được ghi nhận, chưa đến kỳ hoặc đang tạm dừng.');
    confirmChange('Ghi nhận giao dịch định kỳ?',`Sẽ tạo ${result.added.length} giao dịch cho tháng ${monthText(selectedMonth)}. Đây là ghi sổ, không phải thanh toán. Xác nhận sau khi kiểm tra giao dịch thực tế.`,() => Wallet.applyRecurring(state,selectedMonth).state,'Ghi nhận giao dịch');
  }
  if (action === 'next' || action === 'previous') { tablePage += action === 'next' ? 1 : -1; renderTable(); }
  if (action === 'csv') download('vi-nho-giao-dich-' + month + '.csv','\ufeff' + Wallet.toCSV(filteredRows()),'text/csv;charset=utf-8');
  if (action === 'print') window.print();
  if (action === 'backup') download('vi-nho-sao-luu-' + today() + '.json',JSON.stringify({application:'Ví Nhỏ',exportedAt:new Date().toISOString(),state},null,2),'application/json');
  if (action === 'import') $('import-file').click();
  if (action === 'seed') confirmChange('Nạp bộ dữ liệu mô phỏng?', 'Sổ hiện tại sẽ được thay bằng bộ dữ liệu mẫu. Hãy sao lưu trước nếu có dữ liệu cần giữ.',() => Wallet.seed(today()),'Nạp dữ liệu mẫu',true,() => {month=today().slice(0,7);render();});
  if (action === 'clear') confirmChange('Bắt đầu với sổ trống?', 'Tất cả giao dịch, ngân sách, mục tiêu và lịch định kỳ của tài khoản này sẽ bị xóa. Tài khoản đăng nhập vẫn được giữ. Chỉ có thể khôi phục bằng bản sao lưu của bạn.',() => ({version:2,demo:false,transactions:[],budgets:[],goals:[],recurring:[]}),'Xóa dữ liệu sổ',true);
  if (action === 'legacy') {
    try {
      const raw = localStorage.getItem('vi-nho-wallet-v1');
      if (!raw) return toast('Không tìm thấy sổ phiên bản cũ ở địa chỉ web và trình duyệt này. Bạn có thể khôi phục bằng tệp JSON cũ.');
      const legacy = Wallet.migrateLegacy(JSON.parse(raw));
      confirmChange('Nhập sổ phiên bản cũ?',`Tìm thấy ${legacy.transactions.length} giao dịch và ${legacy.budgets.length} ngân sách. Sổ hiện tại sẽ được thay thế; bản lưu cũ trong trình duyệt vẫn giữ nguyên.`,() => legacy,'Nhập sổ cũ',true);
    } catch (error) { toast('Không đọc được sổ cũ: ' + error.message); }
  }
  if (action === 'logout') await logout();
  if (action === 'refresh') {
    const result = await Api.request('state');
    state = result.state; revision = result.revision; render(); toast('Đã tải dữ liệu mới nhất.');
  }
}

hydrateIcons();
document.querySelectorAll('[data-page]').forEach(button => { button.onclick = () => go(button.dataset.page); });
$('add').onclick = () => {
  if (page === 'budgets') budgetDialog();
  else if (page === 'goals') goalDialog();
  else if (page === 'recurring') recurringDialog();
  else transactionDialog();
};
$('logout').onclick = logout;
$('month').onchange = event => { if (Wallet.validMonth(event.target.value)) { month = event.target.value; tablePage = 1; } render(); };
$('view').addEventListener('click',event => {
  const button = event.target.closest('[data-action]');
  if (button && !button.disabled) handleAction(button).catch(error => toast(error.message));
});
$('view').addEventListener('change',event => { if (event.target.id === 'import-file') importFile(event.target.files[0]); });
window.addEventListener('hashchange',() => { if (state) go(location.hash.slice(1)); });

(async () => {
  if (location.protocol === 'file:') return showAuth(false,'Hãy chạy npm start trong thư mục dự án rồi mở http://127.0.0.1:3000.');
  try {
    const session = await Api.request('session');
    if (session.user) activate(session); else showAuth();
  } catch (error) { showAuth(false,error.message); }
})();
