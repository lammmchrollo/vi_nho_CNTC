'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Wallet = require('./model');

const emptyState = () => ({version: 2, demo: false, transactions: [], budgets: [], goals: [], recurring: []});

test('danh mục và quy tắc ngày, tiền bao phủ biên an toàn', () => {
  assert.ok(Wallet.expenses.includes('Sức khỏe'));
  assert.ok(Wallet.income.includes('Kinh doanh'));
  assert.ok(Wallet.income.includes('Đầu tư'));
  assert.equal(Wallet.validAmount(1), true);
  assert.equal(Wallet.validAmount(Wallet.limit), true);
  for (const value of [0, -1, 1.5, Wallet.limit + 1, '1000']) assert.equal(Wallet.validAmount(value), false);
  assert.equal(Wallet.validDate('2000-02-29'), true);
  assert.equal(Wallet.validDate('2099-12-31'), true);
  assert.equal(Wallet.validDate('2026-02-29'), false);
  assert.equal(Wallet.validDate(null), false);
  assert.equal(Wallet.validMonth('2100-01'), false);
});

test('seed v2 có dữ liệu hiện tại, năm tháng lịch sử và đúng số tổng mẫu', () => {
  const state = Wallet.seed('2026-11-09');
  assert.equal(state.version, 2);
  assert.equal(state.goals.length, 2);
  assert.equal(state.recurring.length, 2);
  const current = Wallet.period(state.transactions, '2026-11');
  assert.deepEqual(Wallet.summary(current), {income: 8500000, expense: 4020000, net: 4480000, savingRate: 52.7});
  const history = Wallet.trend(state.transactions, '2026-11');
  assert.deepEqual(history.map(row => row.month), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  assert.ok(history.slice(0, 5).every(row => row.income > 0 && row.expense > 0));
  assert.equal(Wallet.byCategory(current)['Ăn uống'], 1560000);
});

test('validateState chuẩn hóa bản sao và chặn trường lạ, khóa trùng, dữ liệu sai', () => {
  const source = Wallet.seed('2026-11-09');
  source.transactions[0].note = '  Ghi chú  ';
  const normalized = Wallet.validateState(source);
  assert.notEqual(normalized, source);
  assert.equal(normalized.transactions[0].note, 'Ghi chú');

  const unknown = structuredClone(source);
  unknown.extra = true;
  assert.throws(() => Wallet.validateState(unknown), /không được hỗ trợ/);

  const duplicateId = structuredClone(source);
  duplicateId.transactions.push({...duplicateId.transactions[0]});
  assert.throws(() => Wallet.validateState(duplicateId), /Mã giao dịch bị trùng/);

  const duplicateBudget = structuredClone(source);
  duplicateBudget.budgets.push({...duplicateBudget.budgets[0]});
  assert.throws(() => Wallet.validateState(duplicateBudget), /Ngân sách theo tháng và danh mục bị trùng/);

  const overGoal = structuredClone(source);
  overGoal.goals[0].saved = overGoal.goals[0].target + 1;
  assert.equal(Wallet.validateState(overGoal).goals[0].saved, overGoal.goals[0].target + 1);
  overGoal.goals[0].saved = Wallet.limit + 1;
  assert.throws(() => Wallet.validateState(overGoal), /số tiền đã dành/);
});

test('summary và budgetStatus tính dòng tiền, tỷ lệ và ngưỡng chính xác', () => {
  const rows = [
    {type: 'in', amount: 1000},
    {type: 'out', amount: 250},
    {type: 'out', amount: 150}
  ];
  assert.deepEqual(Wallet.summary(rows), {income: 1000, expense: 400, net: 600, savingRate: 60});
  assert.deepEqual(Wallet.budgetStatus(800, 1000), {spent: 800, cap: 1000, remaining: 200, percent: 80, level: 'near'});
  assert.equal(Wallet.budgetStatus(1001, 1000).level, 'over');
});

test('forecast chỉ dùng ngày đã trôi qua, tháng cũ dùng thực tế và tháng tới không dự báo', () => {
  const rows = [
    {type: 'out', amount: 2000000, date: '2026-10-31'},
    {type: 'out', amount: 1000000, date: '2026-11-05'},
    {type: 'out', amount: 9000000, date: '2026-11-20'},
    {type: 'in', amount: 5000000, date: '2026-11-01'}
  ];
  assert.deepEqual(Wallet.forecast(rows, '2026-11', '2026-11-10'), {
    projectedExpense: 2500000, actualExpense: 1000000, daysElapsed: 10,
    daysInMonth: 30, remainingDays: 20, method: 'blended',
    fixedExpense: 0, variableExpense: 1000000, historyAverage: 2000000
  });
  assert.deepEqual(Wallet.forecast(rows.slice(1), '2026-11', '2026-11-10'), {
    projectedExpense: 3000000, actualExpense: 1000000, daysElapsed: 10,
    daysInMonth: 30, remainingDays: 20, method: 'run-rate',
    fixedExpense: 0, variableExpense: 1000000, historyAverage: null
  });
  assert.deepEqual(Wallet.forecast(rows, '2026-10', '2026-11-10'), {
    projectedExpense: 2000000, actualExpense: 2000000, daysElapsed: 31,
    daysInMonth: 31, remainingDays: 0, method: 'actual',
    fixedExpense: 0, variableExpense: 0, historyAverage: null
  });
  assert.deepEqual(Wallet.forecast(rows, '2026-12', '2026-11-10'), {
    projectedExpense: null, actualExpense: 0, daysElapsed: 0,
    daysInMonth: 31, remainingDays: 31, method: 'unavailable',
    fixedExpense: 0, variableExpense: 0, historyAverage: null
  });
});

test('forecast không ngoại suy khoản cố định như tiền phòng', () => {
  const rules = [{id: 'rent', type: 'out', category: 'Nhà ở', amount: 1700000, note: 'Tiền phòng', day: 2, startMonth: '2026-01', active: true},
    {id: 'net', type: 'out', category: 'Nhà ở', amount: 200000, note: 'Internet', day: 25, startMonth: '2026-01', active: true}];
  const rows = [
    {id: 'rec-rent-2026-11', type: 'out', category: 'Nhà ở', amount: 1700000, date: '2026-11-02'},
    {id: 'food', type: 'out', category: 'Ăn uống', amount: 600000, date: '2026-11-05'}
  ];
  const result = Wallet.forecast(rows, '2026-11', '2026-11-10', rules);
  // 1.7M rent + 0.2M internet still due + 0.6M food extrapolated over 30 days (1.8M).
  assert.equal(result.projectedExpense, 1700000 + 200000 + 1800000);
  assert.equal(result.fixedExpense, 1900000);
  const naive = Wallet.forecast(rows, '2026-11', '2026-11-10');
  assert.ok(naive.projectedExpense > result.projectedExpense);
});

test('seed và applyRecurring không ghi trùng lương, tiền phòng đã có', () => {
  const state = Wallet.seed('2026-11-12');
  for (const month of ['2026-06', '2026-08', '2026-11']) {
    const result = Wallet.applyRecurring(state, month);
    assert.equal(result.added.length, 0, month);
  }
  const manual = {version: 2, demo: false, budgets: [], goals: [], transactions: [
    {id: 'typed', type: 'out', category: 'Nhà ở', amount: 1700000, date: '2026-11-03', note: 'Trả phòng'}
  ], recurring: [{id: 'rent', type: 'out', category: 'Nhà ở', amount: 1700000, note: 'Tiền phòng', day: 2, startMonth: '2026-01', active: true}]};
  const result = Wallet.applyRecurring(manual, '2026-11');
  assert.equal(result.added.length, 0);
  assert.deepEqual(result.skipped, [{rule: 'rent', transaction: 'typed'}]);
  assert.equal(Wallet.applyRecurring(manual, '2026-12').added.length, 1);
});

test('safeToSpend trừ khoản cố định chưa ghi và phần dành cho mục tiêu', () => {
  const state = {version: 2, demo: false, budgets: [],
    transactions: [{id: 'in', type: 'in', category: 'Trợ cấp', amount: 5000000, date: '2026-11-01', note: ''},
      {id: 'out', type: 'out', category: 'Ăn uống', amount: 1000000, date: '2026-11-05', note: ''}],
    goals: [{id: 'g', name: 'Laptop', target: 3000000, saved: 0, deadline: '2027-02-10'}],
    recurring: [{id: 'rent', type: 'out', category: 'Nhà ở', amount: 1500000, note: '', day: 15, startMonth: '2026-01', active: true}]};
  const result = Wallet.safeToSpend(state, '2026-11', '2026-11-11');
  assert.equal(result.pendingFixed, 1500000);
  assert.equal(result.goalReserve, 1000000);
  assert.equal(result.available, 5000000 - 1000000 - 1500000 - 1000000);
  assert.equal(result.remainingDays, 20);
  assert.equal(result.perDay, 75000);
  assert.equal(Wallet.safeToSpend(state, '2026-10', '2026-11-11'), null);
});

test('anomalies phát hiện danh mục chi cao bất thường so với các tháng trước', () => {
  const state = Wallet.seed('2026-11-09');
  const result = Wallet.anomalies(state.transactions, '2026-11');
  assert.deepEqual(result.map(row => row.category), ['Học tập']);
  assert.equal(result[0].average, 150000);
  assert.ok(Wallet.insights(state, '2026-11', '2026-11-09').some(item => item.title === 'Chi tiêu khác thường'));
});

test('copyBudgets chỉ thêm danh mục còn thiếu ở tháng đích', () => {
  const state = Wallet.seed('2026-11-09');
  state.budgets.push({month: '2026-12', category: 'Ăn uống', cap: 2000000});
  const result = Wallet.copyBudgets(state, '2026-11', '2026-12');
  assert.deepEqual(result.added.map(row => row.category), ['Di chuyển', 'Học tập']);
  assert.equal(result.state.budgets.find(row => row.month === '2026-12' && row.category === 'Ăn uống').cap, 2000000);
});

test('parseQuick hiểu cách ghi tiền và ngày quen thuộc của người Việt', () => {
  const day = '2026-11-12';
  assert.deepEqual(Wallet.parseQuick('ăn trưa 35k', day), {type: 'out', category: 'Ăn uống', amount: 35000, date: day, note: 'Ăn trưa'});
  assert.deepEqual(Wallet.parseQuick('grab 50k hôm qua', day), {type: 'out', category: 'Di chuyển', amount: 50000, date: '2026-11-11', note: 'Grab'});
  assert.equal(Wallet.parseQuick('+3tr lương', day).type, 'in');
  assert.equal(Wallet.parseQuick('mẹ gửi 2tr5', day).amount, 2500000);
  assert.equal(Wallet.parseQuick('3/11 sách 120.000', day).date, '2026-11-03');
  assert.equal(Wallet.parseQuick('tiền nước 150k', day).category, 'Nhà ở');
  assert.equal(Wallet.parseQuick('không có số tiền', day), null);
  assert.equal(Wallet.parseQuick('quà 2000tr', day), null);
});

test('applyRecurring tạo ID ổn định, chặn tạo lặp và chốt ngày cuối tháng', () => {
  const state = emptyState();
  state.recurring = [
    {id: 'health', type: 'out', category: 'Sức khỏe', amount: 300000, note: 'Bảo hiểm', day: 31, startMonth: '2028-01', active: true},
    {id: 'paused', type: 'in', category: 'Đầu tư', amount: 500000, note: 'Cổ tức', day: 1, startMonth: '2028-01', active: false}
  ];
  const first = Wallet.applyRecurring(state, '2028-02');
  assert.equal(first.added.length, 1);
  assert.deepEqual(first.added[0], {
    id: 'rec-health-2028-02', type: 'out', category: 'Sức khỏe', amount: 300000,
    date: '2028-02-29', note: 'Bảo hiểm'
  });
  const second = Wallet.applyRecurring(first.state, '2028-02');
  assert.equal(second.added.length, 0);
  assert.equal(second.state.transactions.length, 1);
});

test('toCSV quote đúng và vô hiệu hóa công thức bảng tính độc hại', () => {
  const row = {id: 'csv-1', type: 'out', category: 'Khác', amount: 123,
    date: '2026-11-01', note: '=2+3'};
  const csv = Wallet.toCSV([row]);
  assert.ok(csv.startsWith('id,type,category,amount,date,note\r\n'));
  assert.ok(csv.includes('"\'=2+3"'));

  row.note = 'Mua "bút", vở';
  assert.ok(Wallet.toCSV([row]).includes('"Mua ""bút"", vở"'));
});

test('migrateLegacy giữ cả khoản thu và chi, thêm các tập dữ liệu v2 rỗng', () => {
  const seeded = Wallet.seed('2026-11-09');
  const legacy = {version: 1, demo: false, transactions: seeded.transactions, budgets: seeded.budgets};
  const migrated = Wallet.migrateLegacy(legacy);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.transactions.length, seeded.transactions.length);
  assert.equal(migrated.transactions.filter(row => row.type === 'in').length,
    seeded.transactions.filter(row => row.type === 'in').length);
  assert.deepEqual(migrated.goals, []);
  assert.deepEqual(migrated.recurring, []);
  assert.throws(() => Wallet.migrateLegacy({...legacy, version: 0}), /Không hỗ trợ/);
});

test('goalProgress cho phép vượt mục tiêu và tính nhu cầu theo số tháng còn lại', () => {
  const goal = {id: 'g1', name: 'Chứng chỉ', target: 12000000, saved: 2000000, deadline: '2027-02-15'};
  assert.deepEqual(Wallet.goalProgress(goal, '2026-11-15'), {
    percent: 16.7, remaining: 10000000, monthlyNeeded: 3333334, monthsRemaining: 3
  });
  goal.saved = 15000000;
  assert.deepEqual(Wallet.goalProgress(goal, '2026-11-15'), {
    percent: 125, remaining: 0, monthlyNeeded: 0, monthsRemaining: 3
  });
});

test('insights chỉ trả các mức hỗ trợ công khai', () => {
  const state = Wallet.seed('2026-11-09');
  const result = Wallet.insights(state, '2026-11', '2026-11-09');
  assert.ok(result.length >= 3);
  assert.ok(result.every(item => ['good', 'warning', 'info'].includes(item.level)));
  assert.ok(result.every(item => item.title && item.detail));
});

test('xu hướng ở đầu miền ngày được hỗ trợ không truy cập năm 1999', () => {
  assert.deepEqual(Wallet.trend([], '2000-01'), [{month:'2000-01',income:0,expense:0,net:0}]);
  assert.deepEqual(Wallet.trend([], '2000-03').map(r => r.month), ['2000-01','2000-02','2000-03']);
});

test('không đưa ra dự báo bằng không khi chưa ghi chi tiêu đã xảy ra', () => {
  const rows = [{type:'out',amount:9000000,date:'2026-11-20'}];
  assert.equal(Wallet.forecast(rows,'2026-11','2026-11-10').projectedExpense,null);
  assert.equal(Wallet.forecast([],'2026-11','2026-11-10').method,'unavailable');
});
