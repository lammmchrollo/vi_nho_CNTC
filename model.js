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

  const ruleActive = (rule, month) => rule && rule.active && month >= rule.startMonth && !(rule.endMonth && month > rule.endMonth);

  // Pairs each active recurring rule with the transaction that already records it in the month:
  // either the generated row (rec-<rule>-<month>) or a manual row with the same type, category and amount.
  function matchRecurring(rows, rules, month) {
    const monthRows = period(rows, month);
    const claimed = new Set();
    const matches = [];
    const list = Array.isArray(rules) ? rules.filter(rule => ruleActive(rule, month)) : [];
    for (const rule of list) {
      const generated = monthRows.find(row => row.id === 'rec-' + rule.id + '-' + month);
      if (generated) { claimed.add(generated.id); matches.push({rule, row: generated}); continue; }
    }
    for (const rule of list) {
      if (matches.some(match => match.rule === rule)) continue;
      const manual = monthRows.find(row => !claimed.has(row.id) && row.type === rule.type &&
        row.category === rule.category && row.amount === rule.amount);
      if (manual) claimed.add(manual.id);
      matches.push({rule, row: manual || null});
    }
    return {matches, fixedIds: claimed};
  }

  function variableSpent(rows, rules, month) {
    const {fixedIds} = matchRecurring(rows, rules, month);
    return totalSpent(period(rows, month).filter(row => !fixedIds.has(row.id)));
  }

  // Average variable (non-recurring) spending of up to `count` earlier months that contain transactions.
  function historyAverage(rows, rules, month, count = 3) {
    const values = [];
    for (let offset = 1; offset <= 12 && values.length < count; offset++) {
      let target;
      try { target = shiftMonth(month, -offset); } catch { break; }
      if (!period(rows, target).length) continue;
      values.push(variableSpent(rows, rules, target));
    }
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  }

  function forecast(rows, month, today = localDate(), rules = []) {
    if (!Array.isArray(rows)) fail('Danh sách giao dịch không hợp lệ.');
    if (!validMonth(month) || !validDate(today)) fail('Ngày dự báo không hợp lệ.');
    const totalDays = daysInMonth(month);
    const todayMonth = today.slice(0, 7);
    const base = {fixedExpense: 0, variableExpense: 0, historyAverage: null};
    if (month < todayMonth) {
      const actualExpense = totalSpent(period(rows, month));
      return {...base, projectedExpense: actualExpense, actualExpense, daysElapsed: totalDays,
        daysInMonth: totalDays, remainingDays: 0, method: 'actual'};
    }
    if (month > todayMonth) {
      return {...base, projectedExpense: null, actualExpense: 0, daysElapsed: 0,
        daysInMonth: totalDays, remainingDays: totalDays, method: 'unavailable'};
    }
    const daysElapsed = Number(today.slice(8));
    const elapsedRows = period(rows, month).filter(row => row.date <= today);
    const actualExpense = totalSpent(elapsedRows);
    if (!elapsedRows.some(row => row.type === 'out')) {
      return {...base, projectedExpense: null, actualExpense: 0, daysElapsed,
        daysInMonth: totalDays, remainingDays: totalDays - daysElapsed, method: 'unavailable'};
    }
    // Fixed costs (rent, subscriptions…) happen once: they are added as-is, never extrapolated.
    const {matches, fixedIds} = matchRecurring(rows, rules, month);
    const fixedActual = totalSpent(elapsedRows.filter(row => fixedIds.has(row.id)));
    const fixedPending = matches.filter(match => match.rule.type === 'out' && (!match.row || match.row.date > today))
      .reduce((sum, match) => sum + match.rule.amount, 0);
    const variableActual = actualExpense - fixedActual;
    const runRate = variableActual / daysElapsed * totalDays;
    const average = historyAverage(rows, rules, month);
    const variableProjected = average === null ? Math.round(runRate)
      : Math.max(variableActual, Math.round((runRate + average) / 2));
    return {projectedExpense: fixedActual + fixedPending + variableProjected, actualExpense, daysElapsed,
      daysInMonth: totalDays, remainingDays: totalDays - daysElapsed,
      method: average === null ? 'run-rate' : 'blended',
      fixedExpense: fixedActual + fixedPending, variableExpense: variableActual, historyAverage: average};
  }

  // Money that can still be spent per day this month after planned obligations.
  function safeToSpend(value, month, today = localDate()) {
    const state = validateState(value);
    if (!validMonth(month) || !validDate(today)) fail('Thời điểm tính hạn mức chi không hợp lệ.');
    if (month !== today.slice(0, 7)) return null;
    const rows = period(state.transactions, month);
    const totals = summary(rows);
    const {matches} = matchRecurring(state.transactions, state.recurring, month);
    const pending = matches.filter(match => !match.row);
    const pendingIncome = pending.filter(match => match.rule.type === 'in').reduce((sum, match) => sum + match.rule.amount, 0);
    const pendingFixed = pending.filter(match => match.rule.type === 'out').reduce((sum, match) => sum + match.rule.amount, 0);
    const goalReserve = state.goals.filter(goal => goal.saved < goal.target && goal.deadline >= today)
      .reduce((sum, goal) => sum + goalProgress(goal, today).monthlyNeeded, 0);
    const available = totals.income + pendingIncome - totals.expense - pendingFixed - goalReserve;
    const remainingDays = daysInMonth(month) - Number(today.slice(8)) + 1;
    return {available, perDay: available > 0 ? Math.floor(available / remainingDays / 1000) * 1000 : 0,
      remainingDays, income: totals.income, expense: totals.expense, pendingIncome, pendingFixed, goalReserve};
  }

  // Categories whose spending this month is clearly above the average of earlier months.
  function anomalies(rows, month, count = 3) {
    if (!Array.isArray(rows) || !validMonth(month)) return [];
    const previous = [];
    for (let offset = 1; offset <= 12 && previous.length < count; offset++) {
      let target;
      try { target = shiftMonth(month, -offset); } catch { break; }
      const monthRows = period(rows, target);
      if (monthRows.length) previous.push(byCategory(monthRows));
    }
    if (!previous.length) return [];
    const current = byCategory(period(rows, month));
    return expenses.map(category => {
      const average = Math.round(previous.reduce((sum, totals) => sum + totals[category], 0) / previous.length);
      return {category, spent: current[category], average,
        increase: average ? Math.round((current[category] - average) / average * 100) : null};
    }).filter(row => row.average > 0 && row.spent > row.average * 1.3 && row.spent - row.average >= 100000)
      .sort((a, b) => (b.spent - b.average) - (a.spent - a.average));
  }

  function copyBudgets(value, fromMonth, toMonth) {
    const state = validateState(value);
    if (!validMonth(fromMonth) || !validMonth(toMonth)) fail('Tháng sao chép ngân sách không hợp lệ.');
    const existing = new Set(state.budgets.filter(row => row.month === toMonth).map(row => row.category));
    const added = state.budgets.filter(row => row.month === fromMonth && !existing.has(row.category))
      .map(row => ({month: toMonth, category: row.category, cap: row.cap}));
    return {state: validateState({...state, budgets: [...state.budgets, ...added]}), added};
  }

  const quickKeywords = {
    in: [
      ['Học bổng', ['học bổng']],
      ['Lương', ['lương', 'làm thêm', 'part-time', 'parttime', 'thưởng', 'gia sư']],
      ['Trợ cấp', ['trợ cấp', 'bố mẹ', 'ba mẹ', 'mẹ gửi', 'bố gửi', 'gia đình gửi', 'nhà gửi']],
      ['Kinh doanh', ['bán', 'bán hàng', 'doanh thu']],
      ['Đầu tư', ['lãi', 'cổ tức', 'tiết kiệm lãi']]
    ],
    out: [
      ['Nhà ở', ['tiền phòng', 'tiền nhà', 'thuê nhà', 'điện', 'tiền nước', 'wifi', 'internet', 'gas']],
      ['Ăn uống', ['ăn', 'uống', 'cơm', 'phở', 'bún', 'bánh', 'cafe', 'cà phê', 'cafê', 'trà sữa', 'chợ', 'đi chợ', 'bữa', 'nước', 'đồ ăn', 'siêu thị']],
      ['Di chuyển', ['xăng', 'grab', 'be', 'xanh sm', 'taxi', 'bus', 'xe buýt', 'gửi xe', 'vé xe', 'vé tàu', 'sửa xe']],
      ['Học tập', ['sách', 'giáo trình', 'học phí', 'khóa học', 'photo', 'in tài liệu', 'vở', 'bút']],
      ['Giải trí', ['phim', 'game', 'karaoke', 'du lịch', 'netflix', 'spotify', 'youtube', 'concert', 'đi chơi']],
      ['Sức khỏe', ['thuốc', 'khám', 'bệnh viện', 'gym', 'nha khoa', 'bảo hiểm']],
      ['Mua sắm', ['áo', 'quần', 'giày', 'shopee', 'lazada', 'tiki', 'tiktok shop', 'mỹ phẩm', 'mua']]
    ]
  };

  // Parses short Vietnamese notes such as "ăn trưa 35k", "+3tr lương", "grab 50k hôm qua", "sách 120.000 3/11".
  function parseQuick(text, today = localDate()) {
    if (typeof text !== 'string' || !validDate(today)) return null;
    let source = text.trim().slice(0, 200);
    if (!source) return null;
    let date = today;
    const shiftDay = days => {
      const [year, month, day] = today.split('-').map(Number);
      return localDate(new Date(year, month - 1, day - days, 12));
    };
    const relative = [[/\bhôm kia\b/iu, 2], [/\bhôm qua\b/iu, 1], [/\bhôm nay\b/iu, 0]];
    for (const [pattern, days] of relative) {
      if (pattern.test(source)) { const candidate = shiftDay(days); if (validDate(candidate)) date = candidate; source = source.replace(pattern, ' '); break; }
    }
    const explicit = source.match(/(?:ngày\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/u);
    if (explicit) {
      const candidate = (explicit[3] || today.slice(0, 4)) + '-' + pad(explicit[2]) + '-' + pad(explicit[1]);
      if (validDate(candidate)) date = candidate;
      source = source.replace(explicit[0], ' ');
    }

    let amount = null;
    const amountPattern = /(\d+(?:[.,]\d+)*)\s*(triệu|trieu|tr|m|nghìn|nghin|ngàn|ngan|k|đ|d|vnd)?(\d{1,3})?(?![\p{L}\d])/iu;
    const match = source.match(amountPattern);
    if (match) {
      const unit = (match[2] || '').toLowerCase();
      const raw = match[1];
      let number;
      if (['triệu', 'trieu', 'tr', 'm', 'nghìn', 'nghin', 'ngàn', 'ngan', 'k'].includes(unit)) {
        number = Number(raw.replace(',', '.'));
        const scale = ['k', 'nghìn', 'nghin', 'ngàn', 'ngan'].includes(unit) ? 1000 : 1000000;
        if (match[3] && scale === 1000000) number += Number(match[3]) / 10 ** match[3].length;
        amount = Math.round(number * scale);
      } else {
        amount = Number(raw.replace(/[.,]/g, ''));
      }
      source = (source.slice(0, match.index) + ' ' + source.slice(match.index + match[0].length)).trim();
    }
    if (!validAmount(amount)) return null;

    let type = 'out';
    if (/^\s*\+/.test(source)) { type = 'in'; source = source.replace(/^\s*\+/, ''); }
    const words = ' ' + source.toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ') + ' ';
    const find = list => list.find(([, keys]) => keys.some(key => words.includes(' ' + key + ' ')));
    const incomeHit = find(quickKeywords.in);
    if (incomeHit && type === 'out' && !find(quickKeywords.out.slice(0, 6))) type = 'in';
    const hit = type === 'in' ? incomeHit : find(quickKeywords.out);
    const category = hit ? hit[0] : 'Khác';
    const cleaned = source.replace(/\s+/g, ' ').trim().slice(0, 100);
    const note = cleaned ? cleaned[0].toLocaleUpperCase('vi') + cleaned.slice(1) : '';
    return {type, category, amount, date, note};
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
    const skipped = [];
    // A rule counts as recorded when its generated row exists or the user already typed the same
    // type/category/amount manually this month; this prevents double-counting rent or salary.
    for (const {rule, row: existing} of matchRecurring(state.transactions, state.recurring, month).matches) {
      if (existing) {
        if (existing.id !== 'rec-' + rule.id + '-' + month) skipped.push({rule: rule.id, transaction: existing.id});
        continue;
      }
      const id = 'rec-' + rule.id + '-' + month;
      if (known.has(id)) continue;
      const date = month + '-' + pad(Math.min(rule.day, daysInMonth(month)));
      const row = {id, type: rule.type, category: rule.category, amount: rule.amount, date, note: rule.note};
      added.push(row);
      known.add(id);
    }
    const next = validateState({...state, transactions: [...state.transactions, ...added]});
    return {state: next, added, skipped};
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

    const prediction = forecast(state.transactions, month, today, state.recurring);
    if (prediction.method === 'run-rate' || prediction.method === 'blended') {
      const how = prediction.method === 'blended'
        ? 'Khoản cố định cộng nguyên; chi linh hoạt lấy trung bình giữa tốc độ tháng này và mức trung bình các tháng trước.'
        : 'Khoản cố định cộng nguyên; chi linh hoạt ngoại suy theo số ngày đã qua.';
      result.push({level: totals.income && prediction.projectedExpense > totals.income ? 'warning' : 'info',
        title: 'Ước tính cuối tháng', detail: 'Chi tiêu cả tháng ước tính khoảng ' + formatMoney(prediction.projectedExpense) + '. ' + how});
    }
    const unusual = anomalies(state.transactions, month).slice(0, 2);
    if (unusual.length) {
      result.push({level: 'warning', title: 'Chi tiêu khác thường', detail: unusual.map(row => row.category + ' đã chi ' +
        formatMoney(row.spent) + ', cao hơn ' + row.increase + '% so với trung bình ' + formatMoney(row.average) + ' của các tháng trước').join('; ') + '.'});
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

    // History is varied on purpose so trends, averages and anomaly checks have something to show.
    const history = {
      5: {job: 2800000, food: 2350000, travel: 380000, study: 250000, fun: 350000, shopping: 0, health: 0},
      4: {job: 3200000, food: 2500000, travel: 420000, study: 200000, fun: 500000, shopping: 850000, health: 0},
      3: {job: 2500000, food: 2650000, travel: 450000, study: 150000, fun: 280000, shopping: 0, health: 250000},
      2: {job: 3500000, food: 2400000, travel: 400000, study: 180000, fun: 650000, shopping: 320000, health: 0},
      1: {job: 3000000, food: 2550000, travel: 430000, study: 120000, fun: 420000, shopping: 600000, health: 0}
    };
    for (let offset = 5; offset >= 1; offset--) {
      let sampleMonth;
      try { sampleMonth = shiftMonth(month, -offset); } catch { continue; }
      const suffix = sampleMonth.replace('-', '');
      const values = history[offset];
      transactions.push(
        {id: 'rec-allowance-' + sampleMonth, date: dated(sampleMonth, 1), type: 'in', category: 'Trợ cấp', amount: 4000000, note: 'Trợ cấp gia đình hàng tháng'},
        {id: 'rec-rent-' + sampleMonth, date: dated(sampleMonth, 2), type: 'out', category: 'Nhà ở', amount: 1700000, note: 'Tiền phòng hàng tháng'},
        {id: 'history-job-' + suffix, date: dated(sampleMonth, 10), type: 'in', category: 'Lương', amount: values.job, note: 'Lương làm thêm'},
        {id: 'history-food-' + suffix, date: dated(sampleMonth, 18), type: 'out', category: 'Ăn uống', amount: values.food, note: 'Ăn uống trong tháng'},
        {id: 'history-travel-' + suffix, date: dated(sampleMonth, 22), type: 'out', category: 'Di chuyển', amount: values.travel, note: 'Xăng và gửi xe'},
        {id: 'history-study-' + suffix, date: dated(sampleMonth, 12), type: 'out', category: 'Học tập', amount: values.study, note: 'Tài liệu học tập'},
        {id: 'history-fun-' + suffix, date: dated(sampleMonth, 20), type: 'out', category: 'Giải trí', amount: values.fun, note: 'Đi chơi cuối tuần'}
      );
      if (values.shopping) transactions.push({id: 'history-shop-' + suffix, date: dated(sampleMonth, 15), type: 'out', category: 'Mua sắm', amount: values.shopping, note: 'Mua sắm cá nhân'});
      if (values.health) transactions.push({id: 'history-health-' + suffix, date: dated(sampleMonth, 8), type: 'out', category: 'Sức khỏe', amount: values.health, note: 'Khám và mua thuốc'});
    }

    const sample = [
      [3, 'Ăn uống', 650000, 'Đi chợ đầu tháng'],
      [4, 'Học tập', 320000, 'Giáo trình'],
      [6, 'Di chuyển', 260000, 'Xăng và gửi xe'],
      [7, 'Ăn uống', 530000, 'Bữa ăn trong tuần'],
      [8, 'Giải trí', 180000, 'Xem phim'],
      [9, 'Ăn uống', 380000, 'Ăn trưa và đi chợ']
    ];
    // Current-month rent and allowance use the recurring IDs, so "Ghi nhận định kỳ" never duplicates them.
    transactions.push(
      {id: 'rec-allowance-' + month, date: currentDate(1), type: 'in', category: 'Trợ cấp', amount: 4000000, note: 'Trợ cấp gia đình hàng tháng'},
      {id: 'rec-rent-' + month, date: currentDate(2), type: 'out', category: 'Nhà ở', amount: 1700000, note: 'Tiền phòng hàng tháng'},
      {id: 'demo-income-1', date: currentDate(5), type: 'in', category: 'Lương', amount: 3000000, note: 'Lương làm thêm quán cà phê'},
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
      {id: 'goal-laptop', name: 'Mua laptop mới', target: 15000000, saved: 6000000, deadline: deadline(6, 28)},
      {id: 'goal-emergency', name: 'Quỹ khẩn cấp', target: 10000000, saved: 3500000, deadline: deadline(12, 28)}
    ];
    const recurring = [
      {id: 'allowance', type: 'in', category: 'Trợ cấp', amount: 4000000, note: 'Trợ cấp gia đình hàng tháng', day: 1, startMonth: recurringStart, active: true},
      {id: 'rent', type: 'out', category: 'Nhà ở', amount: 1700000, note: 'Tiền phòng hàng tháng', day: 2, startMonth: recurringStart, active: true}
    ];
    return validateState({version: 2, demo: true, transactions, budgets, goals, recurring});
  }

  return {expenses, income, limit, localDate, validMonth, validDate, validAmount, period, totalSpent,
    byCategory, budgetStatus, seed, validateState, summary, trend, forecast, insights, applyRecurring,
    toCSV, migrateLegacy, goalProgress, matchRecurring, safeToSpend, anomalies, copyBudgets, parseQuick};
})();

if (typeof window === 'object') window.Wallet = Wallet;
if (typeof module === 'object' && module.exports) module.exports = Wallet;
