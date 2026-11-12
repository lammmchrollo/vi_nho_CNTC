'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {mkdtempSync, rmSync} = require('node:fs');
const {tmpdir} = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const {createApp} = require('./server');
const Wallet = require('./model');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

function cookieFrom(response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
}

async function request(base, pathname, options = {}) {
  const headers = {...options.headers};
  if (options.cookie) headers.Cookie = options.cookie;
  let body;
  if ('json' in options) {
    headers['Content-Type'] ??= 'application/json';
    body = JSON.stringify(options.json);
  } else if ('raw' in options) {
    body = options.raw;
  }
  const response = await fetch(base + pathname, {method: options.method ?? 'GET', headers, body, redirect: 'manual'});
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return {response, data, cookie: cookieFrom(response)};
}

function rawRequest(base, pathname, headers) {
  const target = new URL(pathname, base);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: target.hostname,
      port: target.port,
      path: target.pathname,
      method: 'GET',
      headers
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        data: JSON.parse(Buffer.concat(chunks).toString('utf8'))
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('HTTP API bảo vệ tài khoản, tách dữ liệu và lưu bền vững', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'vi-nho-server-'));
  const dbPath = path.join(directory, 'test.sqlite');
  let server = createApp({dbPath, authRateLimit: 100});
  let base = await listen(server);
  t.after(async () => {
    if (server.listening) await close(server);
    rmSync(directory, {recursive: true, force: true});
  });

  await t.test('health, static allowlist và security headers', async () => {
    const health = await request(base, '/api/health');
    assert.equal(health.response.status, 200);
    assert.deepEqual(health.data, {ok: true});
    assert.equal(health.response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.response.headers.get('x-frame-options'), 'DENY');
    assert.doesNotMatch(health.response.headers.get('content-security-policy'), /unsafe-inline/);

    const page = await request(base, '/');
    assert.equal(page.response.status, 200);
    assert.match(page.response.headers.get('content-type'), /^text\/html/);
    assert.match(page.data, /<html lang="vi">/);

    const docsCss = await request(base, '/docs/docs.css');
    assert.equal(docsCss.response.status, 200);
    assert.match(docsCss.response.headers.get('content-type'), /^text\/css/);
    assert.match(docsCss.response.headers.get('content-security-policy'), /default-src 'none'/);
    assert.doesNotMatch(docsCss.response.headers.get('content-security-policy'), /unsafe-inline/);
    const presentationJs = await request(base, '/docs/presentation.js');
    assert.equal(presentationJs.response.status, 200);
    assert.match(presentationJs.response.headers.get('content-type'), /^text\/javascript/);
    for (const screenshot of ['dashboard.png', 'mobile.png', 'reports.png']) {
      const image = await request(base, '/docs/screenshots/' + screenshot);
      assert.equal(image.response.status, 200, screenshot);
      assert.equal(image.response.headers.get('content-type'), 'image/png');
    }

    const source = await request(base, '/server.js');
    assert.equal(source.response.status, 404);
    assert.doesNotMatch(JSON.stringify(source.data), /DatabaseSync|password_hash/);
    for (const privateDocument of [
      '/docs/report.md', '/docs/presentation.md', '/docs/speaker-notes.md',
      '/docs/defense-kit.md', '/docs/test-evidence.json', '/docs/speaker-notes.html'
    ]) {
      assert.equal((await request(base, privateDocument)).response.status, 404, privateDocument);
    }
    const traversal = await request(base, '/%2e%2e%2fserver.js');
    assert.equal(traversal.response.status, 404);
    const rebinding = await rawRequest(base, '/api/health', {Host: 'attacker.example'});
    assert.equal(rebinding.status, 403);
    assert.equal(rebinding.data.error.code, 'invalid_host');
  });

  await t.test('yêu cầu chưa đăng nhập và CSRF/payload sai bị từ chối', async () => {
    const session = await request(base, '/api/session');
    assert.equal(session.response.status, 200);
    assert.deepEqual(session.data, {user: null});
    assert.equal((await request(base, '/api/state')).response.status, 401);

    const noJson = await request(base, '/api/register', {method: 'POST', raw: '{}'});
    assert.equal(noJson.response.status, 415);
    const badOrigin = await request(base, '/api/register', {
      method: 'POST',
      headers: {Origin: 'https://evil.example'},
      json: {name: 'Evil', email: 'evil@example.com', password: 'long-enough-password'}
    });
    assert.equal(badOrigin.response.status, 403);
    const malformed = await request(base, '/api/register', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, raw: '{'
    });
    assert.equal(malformed.response.status, 400);
    const weak = await request(base, '/api/register', {
      method: 'POST', json: {name: 'An', email: 'an@example.com', password: 'short'}
    });
    assert.equal(weak.response.status, 400);
    assert.equal(weak.data.error.code, 'weak_password');
  });

  const accountA = {name: 'Nguyễn An', email: "o'hara@example.com", password: 'correct horse battery'};
  let cookieA;
  let initialA;

  await t.test('đăng ký dùng prepared statements và phiên an toàn', async () => {
    const registered = await request(base, '/api/register', {method: 'POST', json: accountA});
    assert.equal(registered.response.status, 201);
    assert.equal(registered.data.user.email, accountA.email);
    assert.equal(registered.data.state.version, 2);
    assert.equal(registered.data.state.demo, false);
    assert.deepEqual(registered.data.state.transactions, []);
    assert.equal(registered.data.revision, 1);
    assert.ok(Array.isArray(registered.data.state.goals));
    assert.ok(Array.isArray(registered.data.state.recurring));
    assert.match(registered.response.headers.get('set-cookie'), /HttpOnly/i);
    assert.match(registered.response.headers.get('set-cookie'), /SameSite=Strict/i);
    assert.match(registered.response.headers.get('set-cookie'), /Path=\//i);
    cookieA = registered.cookie;
    initialA = registered.data;

    const duplicate = await request(base, '/api/register', {method: 'POST', json: accountA});
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.data.error.code, 'email_exists');
    const session = await request(base, '/api/session', {cookie: cookieA});
    assert.equal(session.data.user.id, registered.data.user.id);
  });

  let savedState;
  let savedRevision;
  await t.test('validate toàn bộ state, cập nhật optimistic và phát hiện conflict', async () => {
    const invalid = structuredClone(initialA.state);
    invalid.transactions.push({
      id: crypto.randomUUID(), type: 'out', category: Wallet.expenses[0], amount: -1,
      date: Wallet.localDate(), note: 'Không hợp lệ'
    });
    const rejected = await request(base, '/api/state', {
      method: 'PUT', cookie: cookieA, json: {state: invalid, revision: initialA.revision}
    });
    assert.equal(rejected.response.status, 400);
    assert.equal(rejected.data.error.code, 'invalid_state');

    savedState = structuredClone(initialA.state);
    savedState.demo = false;
    savedState.transactions.push({
      id: 'owned-by-a', type: 'out', category: Wallet.expenses[0], amount: 123456,
      date: Wallet.localDate(), note: "Bữa trưa O'Hara"
    });
    const updated = await request(base, '/api/state', {
      method: 'PUT', cookie: cookieA, json: {state: savedState, revision: initialA.revision}
    });
    assert.equal(updated.response.status, 200);
    savedRevision = updated.data.revision;
    assert.equal(savedRevision, initialA.revision + 1);
    assert.ok(updated.data.state.transactions.some(row => row.id === 'owned-by-a'));

    const conflict = await request(base, '/api/state', {
      method: 'PUT', cookie: cookieA, json: {state: savedState, revision: initialA.revision}
    });
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.data.error.code, 'revision_conflict');
    assert.equal(conflict.data.revision, savedRevision);
    assert.ok(conflict.data.state.transactions.some(row => row.id === 'owned-by-a'));

    const audit = await request(base, '/api/audit', {cookie: cookieA});
    assert.equal(audit.response.status, 200);
    assert.ok(audit.data.events.some(event => event.action === 'state_update'));
    assert.ok(audit.data.events.length <= 30);
  });

  await t.test('mỗi tài khoản và mỗi phiên demo có ví riêng', async () => {
    const accountB = {name: 'Bình', email: 'binh@example.com', password: 'another safe password'};
    const registeredB = await request(base, '/api/register', {
      method: 'POST', headers: {Origin: base}, json: accountB
    });
    assert.equal(registeredB.response.status, 201);
    assert.notEqual(registeredB.data.user.id, initialA.user.id);
    const stateB = await request(base, '/api/state', {cookie: registeredB.cookie});
    assert.equal(stateB.response.status, 200);
    assert.ok(!stateB.data.state.transactions.some(row => row.id === 'owned-by-a'));
    const auditB = await request(base, '/api/audit', {cookie: registeredB.cookie});
    assert.ok(!auditB.data.events.some(event => event.action === 'state_update'));

    const demo1 = await request(base, '/api/demo', {method: 'POST', json: {}});
    const demo2 = await request(base, '/api/demo', {method: 'POST', json: {}});
    assert.equal(demo1.response.status, 201);
    assert.equal(demo2.response.status, 201);
    assert.notEqual(demo1.data.user.id, demo2.data.user.id);
    assert.notEqual(demo1.cookie, demo2.cookie);
    assert.equal(demo1.data.state.demo, true);
    assert.ok(demo1.data.state.transactions.length > 0);
    assert.equal(demo2.data.revision, 1);
  });

  await t.test('giới hạn dung lượng body và số lần thử xác thực', async () => {
    const limitedBodyServer = createApp({
      dbPath: path.join(directory, 'body-limit.sqlite'), maxBodyBytes: 64, authRateLimit: 100
    });
    const limitedBodyBase = await listen(limitedBodyServer);
    try {
      const tooLarge = await request(limitedBodyBase, '/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        raw: JSON.stringify({name: 'A'.repeat(100), email: 'large@example.com', password: 'long-enough-password'})
      });
      assert.equal(tooLarge.response.status, 413);
      assert.equal(tooLarge.data.error.code, 'body_too_large');
      const oversizedLogout = await request(limitedBodyBase, '/api/logout', {
        method: 'POST', raw: 'x'.repeat(65)
      });
      assert.equal(oversizedLogout.response.status, 413);
    } finally {
      await close(limitedBodyServer);
    }

    const rateServer = createApp({
      dbPath: path.join(directory, 'rate-limit.sqlite'), authRateLimit: 1, authWindowMs: 60_000
    });
    const rateBase = await listen(rateServer);
    try {
      const first = await request(rateBase, '/api/login', {
        method: 'POST', json: {email: 'nobody@example.com', password: 'long-enough-password'}
      });
      assert.equal(first.response.status, 401);
      const second = await request(rateBase, '/api/login', {
        method: 'POST', json: {email: 'nobody@example.com', password: 'long-enough-password'}
      });
      assert.equal(second.response.status, 429);
      assert.equal(second.data.error.code, 'rate_limited');
    } finally {
      await close(rateServer);
    }
  });

  await t.test('logout hủy phiên, login kiểm tra mật khẩu', async () => {
    const wrong = await request(base, '/api/login', {
      method: 'POST', json: {email: accountA.email, password: 'wrong password here'}
    });
    assert.equal(wrong.response.status, 401);
    assert.equal(wrong.data.error.code, 'invalid_credentials');

    const loggedOut = await request(base, '/api/logout', {method: 'POST', cookie: cookieA});
    assert.equal(loggedOut.response.status, 200);
    assert.match(loggedOut.response.headers.get('set-cookie'), /Max-Age=0/i);
    assert.equal((await request(base, '/api/state', {cookie: cookieA})).response.status, 401);

    const login = await request(base, '/api/login', {
      method: 'POST', json: {email: accountA.email.toUpperCase(), password: accountA.password}
    });
    assert.equal(login.response.status, 200);
    assert.ok(login.data.state.transactions.some(row => row.id === 'owned-by-a'));
    cookieA = login.cookie;
  });

  await t.test('SQLite giữ dữ liệu sau khi khởi động lại', async () => {
    await close(server);
    server = createApp({dbPath, authRateLimit: 100});
    base = await listen(server);
    const login = await request(base, '/api/login', {
      method: 'POST', json: {email: accountA.email, password: accountA.password}
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.data.revision, savedRevision);
    assert.ok(login.data.state.transactions.some(row => row.id === 'owned-by-a' && row.amount === 123456));
    cookieA = login.cookie;
  });

  await t.test('đổi mật khẩu đăng xuất phiên khác, xóa tài khoản xóa toàn bộ dữ liệu', async () => {
    const other = await request(base, '/api/login', {method: 'POST', json: {email: accountA.email, password: accountA.password}});
    const wrong = await request(base, '/api/password', {method: 'POST', cookie: cookieA,
      json: {currentPassword: 'not the password', newPassword: 'brand new password 1'}});
    assert.equal(wrong.response.status, 401);
    const changed = await request(base, '/api/password', {method: 'POST', cookie: cookieA,
      json: {currentPassword: accountA.password, newPassword: 'brand new password 1'}});
    assert.equal(changed.response.status, 200);
    assert.equal((await request(base, '/api/state', {cookie: other.cookie})).response.status, 401);
    assert.equal((await request(base, '/api/state', {cookie: cookieA})).response.status, 200);
    const audit = await request(base, '/api/audit', {cookie: cookieA});
    assert.ok(audit.data.events.some(event => event.action === 'password_change'));

    const refused = await request(base, '/api/account/delete', {method: 'POST', cookie: cookieA, json: {password: accountA.password}});
    assert.equal(refused.response.status, 401);
    const deleted = await request(base, '/api/account/delete', {method: 'POST', cookie: cookieA, json: {password: 'brand new password 1'}});
    assert.equal(deleted.response.status, 200);
    assert.match(deleted.response.headers.get('set-cookie'), /Max-Age=0/i);
    assert.equal((await request(base, '/api/state', {cookie: cookieA})).response.status, 401);
    const relogin = await request(base, '/api/login', {method: 'POST', json: {email: accountA.email, password: 'brand new password 1'}});
    assert.equal(relogin.response.status, 401);
    for (const table of ['transactions', 'wallet_meta', 'audit', 'sessions']) {
      const count = server.database.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE user_id = ?`).get(initialA.user.id).n;
      assert.equal(count, 0, table);
    }
  });

  await t.test('sổ demo tự dọn sau 24 giờ và tên miền triển khai cấu hình được', async () => {
    let clock = Date.parse('2026-11-12T00:00:00Z');
    const demoServer = createApp({dbPath: path.join(directory, 'demo.sqlite'), authRateLimit: 100, now: () => clock,
      allowedHosts: ['vinho.example.com']});
    const demoBase = await listen(demoServer);
    try {
      const first = await request(demoBase, '/api/demo', {method: 'POST', json: {}});
      assert.equal(first.response.status, 201);
      clock += 25 * 60 * 60 * 1000;
      const second = await request(demoBase, '/api/demo', {method: 'POST', json: {}});
      assert.equal(second.response.status, 201);
      const users = demoServer.database.prepare('SELECT id FROM users').all().map(row => row.id);
      assert.deepEqual(users, [second.data.user.id]);
      assert.equal((await request(demoBase, '/api/session', {cookie: first.cookie})).data.user, null);
      const demoDelete = await request(demoBase, '/api/account/delete', {method: 'POST', cookie: second.cookie, json: {}});
      assert.equal(demoDelete.response.status, 200);

      const port = new URL(demoBase).port;
      const allowed = await rawRequest(demoBase, '/health', {Host: 'vinho.example.com:' + port});
      assert.equal(allowed.status, 200);
      const blocked = await rawRequest(base, '/health', {Host: 'vinho.example.com'});
      assert.equal(blocked.status, 403);
    } finally {
      await close(demoServer);
    }
  });
});
