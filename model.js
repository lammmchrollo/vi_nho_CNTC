'use strict';

const Wallet = (() => {
  const expenses = ['Ăn uống', 'Di chuyển', 'Nhà ở', 'Học tập', 'Giải trí', 'Mua sắm', 'Sức khỏe', 'Khác'];
  const income = ['Lương', 'Trợ cấp', 'Học bổng', 'Kinh doanh', 'Đầu tư', 'Khác'];
  const limit = 1000000000;
  const maxRows = {transactions: 10000, budgets: 1000, goals: 1000, recurring: 1000};
  const pad = value => String(value).padStart(2, '0');
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const fail = message => { throw new Error(message); };
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  const localDate = (date = new Date()) => [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  const validMonth = value => typeof value === 'string' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(value);
  const validAmount = value => Number.isSafeInteger(value) && value > 0 && value <= limit;
  const validDate = value => {
    if (typeof value !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day, 12);
    return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  };

  function exactKeys(value, required, optional, label) {
    if (!isRecord(value)) fail(label + ' phải là một đối tượng.');
    const allowed = new Set([...required, ...optional]);
    for (const key of Object.keys(value)) if (!allowed.has(key)) fail(label + ' có trường không được hỗ trợ: ' + key + '.');
    for (const key of required) if (!hasOwn(value, key)) fail(label + ' thiếu trường ' + key + '.');
  }

  function boundedText(value, label, minimum, maximum, trim = true) {
    if (typeof value !== 'string') fail(label + ' phải là chuỗi.');
    const normalized = trim ? value.trim() : value;
    if (normalized.length < minimum || normalized.length > maximum) {
      fail(label + ' phải dài từ ' + minimum + ' đến ' + maximum + ' ký tự.');
    }
    return normalized;
  }

  function normalizeTransaction(row, index) {
    const label = 'Giao dịch ' + (index + 1);
    exactKeys(row, ['id', 'type', 'category', 'amount', 'date', 'note'], [], label);
    const id = boundedText(row.id, label + ': mã', 1, 100);
    if (row.type !== 'in' && row.type !== 'out') fail(label + ': loại giao dịch không hợp lệ.');
    const categories = row.type === 'in' ? income : expenses;
    if (typeof row.category !== 'string' || !categories.includes(row.category)) fail(label + ': danh mục không hợp lệ.');
    if (!validAmount(row.amount)) fail(label + ': số tiền phải là số nguyên dương không quá ' + limit + '.');
    if (!validDate(row.date)) fail(label + ': ngày phải hợp lệ trong giai đoạn 2000–2099.');
    const note = boundedText(row.note, label + ': ghi chú', 0, 100);
    return {id, type: row.type, category: row.category, amount: row.amount, date: row.date, note};
  }

  function normalizeBudget(row, index) {
    const label = 'Ngân sách ' + (index + 1);
    exactKeys(row, ['month', 'category', 'cap'], [], label);
    if (!validMonth(row.month)) fail(label + ': tháng không hợp lệ.');
    if (typeof row.category !== 'string' || !expenses.includes(row.category)) fail(label + ': danh mục không hợp lệ.');
    if (!validAmount(row.cap)) fail(label + ': hạn mức không hợp lệ.');
    return {month: row.month, category: row.category, cap: row.cap};
  }

  function normalizeGoal(row, index = 0) {
    const label = 'Mục tiêu ' + (index + 1);
    exactKeys(row, ['id', 'name', 'target', 'saved', 'deadline'], [], label);
    const id = boundedText(row.id, label + ': mã', 1, 100);
    const name = boundedText(row.name, label + ': tên', 1, 100);
    if (!validAmount(row.target)) fail(label + ': số tiền mục tiêu không hợp lệ.');
    if (!Number.isSafeInteger(row.saved) || row.saved < 0 || row.saved > limit) {
      fail(label + ': số tiền đã dành phải là số nguyên từ 0 đến ' + limit + '.');
    }
    if (!validDate(row.deadline)) fail(label + ': hạn hoàn thành không hợp lệ.');
    return {id, name, target: row.target, saved: row.saved, deadline: row.deadline};
  }

  function normalizeRecurring(row, index) {
    const label = 'Giao dịch định kỳ ' + (index + 1);
    exactKeys(row, ['id', 'type', 'category', 'amount', 'note', 'day', 'startMonth', 'active'], ['endMonth'], label);
    const id = boundedText(row.id, label + ': mã', 1, 80);
    if (row.type !== 'in' && row.type !== 'out') fail(label + ': loại giao dịch không hợp lệ.');
    const categories = row.type === 'in' ? income : expenses;
    if (typeof row.category !== 'string' || !categories.includes(row.category)) fail(label + ': danh mục không hợp lệ.');
    if (!validAmount(row.amount)) fail(label + ': số tiền không hợp lệ.');
    const note = boundedText(row.note, label + ': ghi chú', 0, 100);
    if (!Number.isSafeInteger(row.day) || row.day < 1 || row.day > 31) fail(label + ': ngày trong tháng phải từ 1 đến 31.');
    if (!validMonth(row.startMonth)) fail(label + ': tháng bắt đầu không hợp lệ.');
    if (hasOwn(row, 'endMonth') && (!validMonth(row.endMonth) || row.endMonth < row.startMonth)) {
      fail(label + ': tháng kết thúc không hợp lệ.');
    }
    if (typeof row.active !== 'boolean') fail(label + ': trạng thái hoạt động phải là boolean.');
    const normalized = {id, type: row.type, category: row.category, amount: row.amount, note,
      day: row.day, startMonth: row.startMonth};
    if (hasOwn(row, 'endMonth')) normalized.endMonth = row.endMonth;
    normalized.active = row.active;
    return normalized;
  }

  function validateState(value) {
    exactKeys(value, ['version', 'demo', 'transactions', 'budgets', 'goals', 'recurring'], [], 'Dữ liệu ví');
    if (value.version !== 2) fail('Phiên bản dữ liệu phải là 2.');
    if (typeof value.demo !== 'boolean') fail('Trạng thái demo phải là boolean.');
    for (const name of Object.keys(maxRows)) {
      if (!Array.isArray(value[name])) fail(name + ' phải là một mảng.');
      if (value[name].length > maxRows[name]) fail(name + ' vượt quá giới hạn ' + maxRows[name] + ' bản ghi.');
    }

    const transactions = value.transactions.map(normalizeTransaction);
    const budgets = value.budgets.map(normalizeBudget);
    const goals = value.goals.map(normalizeGoal);
    const recurring = value.recurring.map(normalizeRecurring);
    const unique = (rows, keyOf, label) => {
      const seen = new Set();
      for (const row of rows) {
        const key = keyOf(row);
        if (seen.has(key)) fail(label + ' bị trùng: ' + key + '.');
        seen.add(key);
      }
    };
    unique(transactions, row => row.id, 'Mã giao dịch');
    unique(budgets, row => row.month + '|' + row.category, 'Ngân sách theo tháng và danh mục');
    unique(goals, row => row.id, 'Mã mục tiêu');
    unique(recurring, row => row.id, 'Mã giao dịch định kỳ');
    return {version: 2, demo: value.demo, transactions, budgets, goals, recurring};
  }

  const period = (rows, month) => Array.isArray(rows) && validMonth(month)
    ? rows.filter(row => row && typeof row.date === 'string' && row.date.slice(0, 7) === month) : [];
  const totalSpent = rows => Array.isArray(rows) ? rows.reduce((sum, row) =>
    sum + (row && row.type === 'out' && Number.isFinite(row.amount) ? row.amount : 0), 0) : 0;
  function byCategory(rows) {
    const totals = Object.fromEntries(expenses.map(name => [name, 0]));
    if (!Array.isArray(rows)) return totals;
    for (const row of rows) {
      if (row && row.type === 'out' && hasOwn(totals, row.category) && Number.isFinite(row.amount)) totals[row.category] += row.amount;
    }
    return totals;
  }
  function budgetStatus(spent, cap) {
    if (!Number.isFinite(spent) || spent < 0 || !validAmount(cap)) fail('Dữ liệu ngân sách không hợp lệ.');
    const percent = Math.floor(spent / cap * 100);
    return {spent, cap, remaining: cap - spent, percent,
      level: spent > cap ? 'over' : spent >= cap * 0.8 ? 'near' : 'normal'};
  }

  function summary(rows) {
    let incoming = 0;
    let outgoing = 0;
    if (Array.isArray(rows)) for (const row of rows) {
      if (!row || !Number.isFinite(row.amount)) continue;
      if (row.type === 'in') incoming += row.amount;
      if (row.type === 'out') outgoing += row.amount;
    }
    const net = incoming - outgoing;
    const savingRate = incoming ? Math.round(net / incoming * 1000) / 10 : 0;
    return {income: incoming, expense: outgoing, net, savingRate};
  }

  function daysInMonth(month) {
    const [year, value] = month.split('-').map(Number);
    return new Date(year, value, 0).getDate();
  }
  function shiftMonth(month, amount) {
    if (!validMonth(month) || !Number.isSafeInteger(amount)) fail('Không thể tính tháng yêu cầu.');
    const [year, value] = month.split('-').map(Number);
    const absolute = year * 12 + value - 1 + amount;
    const nextYear = Math.floor(absolute / 12);
    const nextMonth = absolute % 12 + 1;
    const result = nextYear + '-' + pad(nextMonth);
    if (!validMonth(result)) fail('Tháng kết quả nằm ngoài giai đoạn 2000–2099.');
    return result;
  }

  function trend(transactions, month, count = 6) {
    if (!Array.isArray(transactions)) fail('Danh sách giao dịch không hợp lệ.');
    if (!validMonth(month)) fail('Tháng báo cáo không hợp lệ.');
    if (!Number.isSafeInteger(count) || count < 1 || count > 1200) fail('Số tháng xu hướng phải từ 1 đến 1200.');
    const result = [];
    for (let offset = count - 1; offset >= 0; offset--) {
      // Early supported dates have fewer historical months; do not render 1999.
      const [year, value] = month.split('-').map(Number);
      if (year * 12 + value - 1 - offset < 2000 * 12) continue;
      const target = shiftMonth(month, -offset);
      const totals = summary(period(transactions, target));
      result.push({month: target, income: totals.income, expense: totals.expense, net: totals.net});
    }
    return result;
  }

  function forecast(rows, month, today = localDate()) {
    if (!Array.isArray(rows)) fail('Danh sách giao dịch không hợp lệ.');
    if (!validMonth(month) || !validDate(today)) fail('Ngày dự báo không hợp lệ.');
    const totalDays = daysInMonth(month);
    const todayMonth = today.slice(0, 7);
    if (month < todayMonth) {
      const actualExpense = totalSpent(period(rows, month));
      return {projectedExpense: actualExpense, actualExpense, daysElapsed: totalDays,
        daysInMonth: totalDays, remainingDays: 0, method: 'actual'};
    }
    if (month > todayMonth) {
      return {projectedExpense: null, actualExpense: 0, daysElapsed: 0,
        daysInMonth: totalDays, remainingDays: totalDays, method: 'unavailable'};
    }
    const daysElapsed = Number(today.slice(8));
    const elapsedRows = period(rows, month).filter(row => row.date <= today);
    const actualExpense = totalSpent(elapsedRows);
    if (!elapsedRows.some(row => row.type === 'out')) {
      return {projectedExpense: null, actualExpense: 0, daysElapsed,
        daysInMonth: totalDays, remainingDays: totalDays - daysElapsed, method: 'unavailable'};
    }
    const projectedExpense = Math.round(actualExpense / daysElapsed * totalDays);
    return {projectedExpense, actualExpense, daysElapsed, daysInMonth: totalDays,
      remainingDays: totalDays - daysElapsed, method: 'run-rate'};
  }

  function goalProgress(goal, today = localDate()) {
    const normalized = normalizeGoal(goal);
    if (!validDate(today)) fail('Ngày tính tiến độ không hợp lệ.');
    const remaining = Math.max(0, normalized.target - normalized.saved);
    const percent = Math.round(normalized.saved / normalized.target * 1000) / 10;
    let monthsRemaining = 0;
    if (normalized.deadline >= today) {
      const [targetYear, targetMonth, targetDay] = normalized.deadline.split('-').map(Number);
      const [year, month, day] = today.split('-').map(Number);
      const wholeMonths = (targetYear - year) * 12 + targetMonth - month;
      monthsRemaining = Math.max(1, wholeMonths + (targetDay > day ? 1 : 0));
    }
    const monthlyNeeded = remaining === 0 ? 0 : monthsRemaining ? Math.ceil(remaining / monthsRemaining) : remaining;
    return {percent, remaining, monthlyNeeded, monthsRemaining};
  }

  function applyRecurring(value, month) {
    const state = validateState(value);
    if (!validMonth(month)) fail('Tháng tạo giao dịch định kỳ không hợp lệ.');
    const known = new Set(state.transactions.map(row => row.id));
    const added = [];
    for (const rule of state.recurring) {
      if (!rule.active || month < rule.startMonth || (rule.endMonth && month > rule.endMonth)) continue;
      const id = 'rec-' + rule.id + '-' + month;
      if (known.has(id)) continue;
      const date = month + '-' + pad(Math.min(rule.day, daysInMonth(month)));
      const row = {id, type: rule.type, category: rule.category, amount: rule.amount, date, note: rule.note};
      added.push(row);
      known.add(id);
    }
    const next = validateState({...state, transactions: [...state.transactions, ...added]});
    return {state: next, added};
  }

  function csvCell(value) {
    let text = String(value);
    if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function toCSV(rows) {
    if (!Array.isArray(rows) || rows.length > maxRows.transactions) fail('Danh sách xuất CSV không hợp lệ.');
    const normalized = rows.map(normalizeTransaction);
    const lines = ['id,type,category,amount,date,note'];
    for (const row of normalized) {
      lines.push([row.id, row.type, row.category, row.amount, row.date, row.note].map(csvCell).join(','));
    }
    return lines.join('\r\n');
  }

  function migrateLegacy(value) {
    if (!isRecord(value)) fail('Dữ liệu cũ không hợp lệ.');
    if (value.version === 2) return validateState(value);
    if (value.version !== 1) fail('Không hỗ trợ phiên bản dữ liệu này.');
    exactKeys(value, ['version', 'demo', 'transactions', 'budgets'], [], 'Dữ liệu phiên bản 1');
    return validateState({version: 2, demo: value.demo, transactions: value.transactions,
      budgets: value.budgets, goals: [], recurring: []});
  }

  function insights(value, month, today = localDate()) {
    const state = validateState(value);
    if (!validMonth(month) || !validDate(today)) fail('Thời điểm phân tích không hợp lệ.');
    const rows = period(state.transactions, month);
    const totals = summary(rows);
    const formatMoney = amount => new Intl.NumberFormat('vi-VN', {style: 'currency', currency: 'VND'}).format(amount);
    const result = [];
    if (!totals.income) {
      result.push({level: 'info', title: 'Chưa có khoản thu', detail: 'Hãy ghi khoản thu để theo dõi dòng tiền và tỷ lệ tiết kiệm.'});
    } else if (totals.net >= 0) {
      result.push({level: 'good', title: 'Dòng tiền dương', detail: 'Dòng tiền ròng là ' + formatMoney(totals.net) + ' sau các khoản chi đã ghi trong tháng.'});
    } else {
      result.push({level: 'warning', title: 'Chi nhiều hơn thu', detail: 'Chi tiêu đang cao hơn thu nhập ' + formatMoney(Math.abs(totals.net)) + '.'});
    }

    const spending = byCategory(rows);
    const statuses = state.budgets.filter(row => row.month === month)
      .map(row => ({category: row.category, ...budgetStatus(spending[row.category], row.cap)}));
    const over = statuses.filter(row => row.level === 'over');
    const near = statuses.filter(row => row.level === 'near');
    if (over.length) {
      result.push({level: 'warning', title: 'Vượt ngân sách', detail: over.map(row => row.category).join(', ') + ' đã vượt hạn mức.'});
    } else if (near.length) {
      result.push({level: 'warning', title: 'Sắp chạm ngân sách', detail: near.map(row => row.category).join(', ') + ' đã dùng ít nhất 80% hạn mức.'});
    } else if (statuses.length) {
      result.push({level: 'good', title: 'Ngân sách trong tầm kiểm soát', detail: 'Chưa có danh mục nào dùng đến 80% hạn mức.'});
    } else {
      result.push({level: 'info', title: 'Chưa đặt ngân sách', detail: 'Đặt hạn mức theo danh mục để nhận cảnh báo sớm.'});
    }

    const prediction = forecast(state.transactions, month, today);
    if (prediction.method === 'run-rate') {
      result.push({level: totals.income && prediction.projectedExpense > totals.income ? 'warning' : 'info',
        title: 'Ước tính cuối tháng', detail: 'Theo tốc độ hiện tại, chi tiêu ước tính là ' + formatMoney(prediction.projectedExpense) + '. Ngoại suy tuyến tính từ số ngày đã qua.'});
    }
    const overdue = state.goals.filter(goal => goal.saved < goal.target && goal.deadline < today);
    if (overdue.length) result.push({level: 'warning', title: 'Mục tiêu đã quá hạn', detail: overdue.map(goal => goal.name).join(', ') + ' chưa hoàn thành.'});
    return result;
  }

  function seed(today = localDate()) {
    if (!validDate(today)) fail('Ngày tạo dữ liệu mẫu không hợp lệ.');
    const month = today.slice(0, 7);
    const day = Number(today.slice(8));
    const dated = (targetMonth, targetDay) => targetMonth + '-' + pad(Math.min(targetDay, daysInMonth(targetMonth)));
    const currentDate = targetDay => dated(month, Math.min(targetDay, day));
    const transactions = [];

    for (let offset = 5; offset >= 1; offset--) {
      let sampleMonth;
      try { sampleMonth = shiftMonth(month, -offset); } catch { continue; }
      const suffix = sampleMonth.replace('-', '');
      transactions.push(
        {id: 'history-salary-' + suffix, date: dated(sampleMonth, 5), type: 'in', category: 'Lương', amount: 7000000, note: 'Lương tháng ' + sampleMonth},
        {id: 'history-extra-' + suffix, date: dated(sampleMonth, 10), type: 'in', category: 'Trợ cấp', amount: 1000000, note: 'Hỗ trợ sinh hoạt'},
        {id: 'history-rent-' + suffix, date: dated(sampleMonth, 2), type: 'out', category: 'Nhà ở', amount: 1700000, note: 'Tiền phòng'},
        {id: 'history-food-' + suffix, date: dated(sampleMonth, 18), type: 'out', category: 'Ăn uống', amount: 1450000 + offset * 20000, note: 'Ăn uống trong tháng'},
        {id: 'history-travel-' + suffix, date: dated(sampleMonth, 22), type: 'out', category: 'Di chuyển', amount: 320000 - offset * 10000, note: 'Xăng và gửi xe'}
      );
    }

    const sample = [
      [2, 'Nhà ở', 1700000, 'Tiền phòng'],
      [3, 'Ăn uống', 650000, 'Đi chợ đầu tháng'],
      [4, 'Học tập', 320000, 'Giáo trình'],
      [6, 'Di chuyển', 260000, 'Xăng và gửi xe'],
      [7, 'Ăn uống', 530000, 'Bữa ăn trong tuần'],
      [8, 'Giải trí', 180000, 'Xem phim'],
      [9, 'Ăn uống', 380000, 'Ăn trưa và đi chợ']
    ];
    transactions.push(
      {id: 'demo-income-1', date: currentDate(1), type: 'in', category: 'Lương', amount: 7000000, note: 'Lương làm thêm'},
      {id: 'demo-income-2', date: currentDate(5), type: 'in', category: 'Học bổng', amount: 1500000, note: 'Học bổng học kỳ'}
    );
    sample.forEach(([value, category, amount, note], index) => transactions.push({
      id: 'demo-out-' + (index + 1), date: currentDate(value), type: 'out', category, amount, note
    }));

    const budgets = [['Ăn uống', 1800000], ['Di chuyển', 500000], ['Học tập', 600000]]
      .map(([category, cap]) => ({month, category, cap}));
    const deadline = (offset, targetDay) => {
      let targetMonth;
      try { targetMonth = shiftMonth(month, offset); } catch { targetMonth = '2099-12'; }
      return dated(targetMonth, targetDay);
    };
    let recurringStart = month;
    try { recurringStart = shiftMonth(month, -5); } catch { /* The earliest valid month is retained. */ }
    const goals = [
      {id: 'goal-laptop', name: 'Mua laptop mới', target: 20000000, saved: 7500000, deadline: deadline(6, 28)},
      {id: 'goal-emergency', name: 'Quỹ khẩn cấp', target: 30000000, saved: 12000000, deadline: deadline(12, 28)}
    ];
    const recurring = [
      {id: 'salary', type: 'in', category: 'Lương', amount: 7000000, note: 'Lương hàng tháng', day: 5, startMonth: recurringStart, active: true},
      {id: 'rent', type: 'out', category: 'Nhà ở', amount: 1700000, note: 'Tiền phòng hàng tháng', day: 2, startMonth: recurringStart, active: true}
    ];
    return validateState({version: 2, demo: true, transactions, budgets, goals, recurring});
  }

  return {expenses, income, limit, localDate, validMonth, validDate, validAmount, period, totalSpent,
    byCategory, budgetStatus, seed, validateState, summary, trend, forecast, insights, applyRecurring,
    toCSV, migrateLegacy, goalProgress};
})();

if (typeof window === 'object') window.Wallet = Wallet;
if (typeof module === 'object' && module.exports) module.exports = Wallet;
