'use strict';

const http = require('node:http');
const {readFile} = require('node:fs/promises');
const {mkdirSync} = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {DatabaseSync} = require('node:sqlite');
const Wallet = require('./model');

const HOST = process.env.HOST || '127.0.0.1';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const DEMO_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_COOKIE = 'vn_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const AUTH_WINDOW_MS = 10 * 60 * 1000;
const AUTH_RATE_LIMIT = 20;

const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/model.js', ['model.js', 'text/javascript; charset=utf-8']],
  ['/api.js', ['api.js', 'text/javascript; charset=utf-8']],
  ['/icons.js', ['icons.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/docs/report.html', ['docs/report.html', 'text/html; charset=utf-8']],
  ['/docs/presentation.html', ['docs/presentation.html', 'text/html; charset=utf-8']],
  ['/docs/docs.css', ['docs/docs.css', 'text/css; charset=utf-8']],
  ['/docs/presentation.js', ['docs/presentation.js', 'text/javascript; charset=utf-8']],
  ['/docs/screenshots/dashboard.png', ['docs/screenshots/dashboard.png', 'image/png']],
  ['/docs/screenshots/mobile.png', ['docs/screenshots/mobile.png', 'image/png']],
  ['/docs/screenshots/reports.png', ['docs/screenshots/reports.png', 'image/png']],
  ['/docs/report.pdf', ['docs/report.pdf', 'application/pdf']],
  ['/docs/presentation.pdf', ['docs/presentation.pdf', 'application/pdf']],
  ['/docs/report.docx', ['docs/report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
  ['/docs/presentation.pptx', ['docs/presentation.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']]
]);

const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

const DOCS_CSP = "default-src 'none'; style-src 'self'; script-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

class HttpError extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function nowIso(now) {
  return new Date(now()).toISOString();
}

function publicUser(row) {
  return {id: row.id, name: row.name, email: row.email};
}

function safeJsonClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    throw new HttpError(400, 'invalid_state', 'Dữ liệu ví không hợp lệ.');
  }
}

function normalizeState(value) {
  const clone = safeJsonClone(value);
  try {
    const result = Wallet.validateState(clone);
    if (result === false) throw new Error('Invalid state');
    const normalized = result && typeof result === 'object' ? result : clone;
    if (normalized.version !== 2 || !Array.isArray(normalized.transactions) ||
        !Array.isArray(normalized.budgets) || !Array.isArray(normalized.goals) ||
        !Array.isArray(normalized.recurring)) throw new Error('Incomplete state');
    return safeJsonClone(normalized);
  } catch {
    throw new HttpError(400, 'invalid_state', 'Dữ liệu ví không hợp lệ.');
  }
}

function emptyState() {
  return normalizeState({version: 2, demo: false, transactions: [], budgets: [], goals: [], recurring: []});
}

function demoState() {
  const seeded = Wallet.seed(Wallet.localDate());
  return normalizeState({
    ...seeded,
    version: 2,
    demo: true,
    goals: seeded.goals ?? [],
    recurring: seeded.recurring ?? []
  });
}

function createSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS wallet_meta (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL,
      demo INTEGER NOT NULL CHECK (demo IN (0, 1))
    );
    CREATE TABLE IF NOT EXISTS "transactions" (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      date TEXT NOT NULL,
      note TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE INDEX IF NOT EXISTS transactions_user_date ON "transactions"(user_id, date);
    CREATE TABLE IF NOT EXISTS budgets (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      category TEXT NOT NULL,
      cap INTEGER NOT NULL,
      PRIMARY KEY (user_id, month, category)
    );
    CREATE TABLE IF NOT EXISTS goals (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      target INTEGER NOT NULL,
      saved INTEGER NOT NULL,
      deadline TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE IF NOT EXISTS recurring (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      note TEXT NOT NULL,
      day INTEGER NOT NULL,
      start_month TEXT NOT NULL,
      end_month TEXT,
      active INTEGER NOT NULL CHECK (active IN (0, 1)),
      PRIMARY KEY (user_id, id)
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS audit_user_created ON audit(user_id, id DESC);
  `);
}

function passwordRecord(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, {N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024});
  return {salt: salt.toString('base64url'), hash: hash.toString('base64url')};
}

function passwordMatches(password, saltText, hashText) {
  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = crypto.scryptSync(password, salt, expected.length, {N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024});
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function validateAccount(body, includeName) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'invalid_request', 'Yêu cầu không hợp lệ.');
  }
  const name = includeName && typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLocaleLowerCase('en-US') : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (includeName && (!name || name.length > 80)) {
    throw new HttpError(400, 'invalid_name', 'Tên phải có từ 1 đến 80 ký tự.');
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new HttpError(400, 'invalid_email', 'Email không hợp lệ.');
  }
  if (password.length < 10 || password.length > 128) {
    throw new HttpError(400, 'weak_password', 'Mật khẩu phải có từ 10 đến 128 ký tự.');
  }
  return {name, email, password};
}

function cookieValues(header) {
  const values = Object.create(null);
  for (const part of String(header ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0) values[part.slice(0, at).trim()] = part.slice(at + 1).trim();
  }
  return values;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

function sessionCookie(token, secure) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure ? '; Secure' : ''}`;
}

function clearSessionCookie(secure) {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}

function requestIsSecure(req) {
  if (req.socket.encrypted) return true;
  return TRUST_PROXY && String(req.headers['x-forwarded-proto'] ?? '').split(',', 1)[0].trim() === 'https';
}

function clientAddress(req) {
  if (TRUST_PROXY) {
    const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',', 1)[0].trim();
    if (forwarded) return forwarded;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

// Only local hosts are accepted by default (DNS-rebinding protection). A deployment adds its own
// domain through ALLOWED_HOSTS, for example ALLOWED_HOSTS=vinho.example.com.
function assertAllowedHost(req, extraHosts) {
  const host = String(req.headers.host ?? '');
  let hostname;
  try { hostname = new URL(`http://${host}`).hostname.toLowerCase(); }
  catch { throw new HttpError(400, 'invalid_host', 'Máy chủ yêu cầu không hợp lệ.'); }
  if (!['127.0.0.1', 'localhost', '[::1]', ...extraHosts].includes(hostname)) {
    throw new HttpError(403, 'invalid_host', 'Máy chủ yêu cầu không hợp lệ.');
  }
}

function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const host = req.headers.host;
  if (!host) throw new HttpError(403, 'invalid_origin', 'Nguồn yêu cầu không hợp lệ.');
  const expected = `${requestIsSecure(req) ? 'https' : 'http'}://${host}`;
  if (origin !== expected) throw new HttpError(403, 'invalid_origin', 'Nguồn yêu cầu không hợp lệ.');
}

function assertJsonRequest(req) {
  const contentType = String(req.headers['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new HttpError(415, 'json_required', 'Yêu cầu phải dùng application/json.');
  }
}

function readBody(req, maxBytes) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) {
    req.resume();
    throw new HttpError(413, 'body_too_large', 'Dữ liệu gửi lên quá lớn.');
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    req.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        reject(new HttpError(413, 'body_too_large', 'Dữ liệu gửi lên quá lớn.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks));
    });
    req.on('error', () => {
      if (!settled) reject(new HttpError(400, 'request_error', 'Không đọc được yêu cầu.'));
    });
  });
}

async function readJson(req, maxBytes) {
  const text = (await readBody(req, maxBytes)).toString('utf8');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json', 'JSON không hợp lệ.');
  }
}

function setHeaders(res, extra = {}) {
  for (const [name, value] of Object.entries({...SECURITY_HEADERS, ...extra})) res.setHeader(name, value);
}

function sendJson(res, status, value, extraHeaders) {
  const body = JSON.stringify(value);
  setHeaders(res, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.statusCode = status;
  res.end(body);
}

function sendError(res, error) {
  const known = error instanceof HttpError;
  const status = known ? error.status : 500;
  const payload = {
    error: {
      code: known ? error.code : 'internal_error',
      message: known ? error.message : 'Máy chủ gặp lỗi. Vui lòng thử lại.'
    },
    ...(known && error.extra ? error.extra : {})
  };
  sendJson(res, status, payload);
}

function databaseState(db, userId) {
  const meta = db.prepare('SELECT revision, demo FROM wallet_meta WHERE user_id = ?').get(userId);
  if (!meta) throw new HttpError(500, 'wallet_missing', 'Không tìm thấy dữ liệu ví.');
  return {
    state: {
      version: 2,
      demo: Boolean(meta.demo),
      transactions: db.prepare('SELECT id, type, category, amount, date, note FROM "transactions" WHERE user_id = ? ORDER BY rowid').all(userId),
      budgets: db.prepare('SELECT month, category, cap FROM budgets WHERE user_id = ? ORDER BY rowid').all(userId),
      goals: db.prepare('SELECT id, name, target, saved, deadline FROM goals WHERE user_id = ? ORDER BY rowid').all(userId),
      recurring: db.prepare('SELECT id, type, category, amount, note, day, start_month AS startMonth, end_month AS endMonth, active FROM recurring WHERE user_id = ? ORDER BY rowid')
        .all(userId).map(row => ({...row, active: Boolean(row.active), ...(row.endMonth === null ? {endMonth: undefined} : {})}))
        .map(row => {
          if (row.endMonth === undefined) delete row.endMonth;
          return row;
        })
    },
    revision: meta.revision
  };
}

function insertStateRows(db, userId, state) {
  const tx = db.prepare('INSERT INTO "transactions" (user_id, id, type, category, amount, date, note) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const budget = db.prepare('INSERT INTO budgets (user_id, month, category, cap) VALUES (?, ?, ?, ?)');
  const goal = db.prepare('INSERT INTO goals (user_id, id, name, target, saved, deadline) VALUES (?, ?, ?, ?, ?, ?)');
  const recurring = db.prepare('INSERT INTO recurring (user_id, id, type, category, amount, note, day, start_month, end_month, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (const row of state.transactions) tx.run(userId, row.id, row.type, row.category, row.amount, row.date, row.note);
  for (const row of state.budgets) budget.run(userId, row.month, row.category, row.cap);
  for (const row of state.goals) goal.run(userId, row.id, row.name, row.target, row.saved, row.deadline);
  for (const row of state.recurring) recurring.run(userId, row.id, row.type, row.category, row.amount, row.note, row.day, row.startMonth, row.endMonth ?? null, row.active ? 1 : 0);
}

function createWallet(db, userId, state, revision = 1) {
  db.prepare('INSERT INTO wallet_meta (user_id, revision, demo) VALUES (?, ?, ?)').run(userId, revision, state.demo ? 1 : 0);
  insertStateRows(db, userId, state);
}

function replaceWallet(db, userId, state, expectedRevision, createdAt) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = db.prepare('SELECT revision FROM wallet_meta WHERE user_id = ?').get(userId);
    if (!current) throw new HttpError(500, 'wallet_missing', 'Không tìm thấy dữ liệu ví.');
    if (current.revision !== expectedRevision) {
      const latest = databaseState(db, userId);
      throw new HttpError(409, 'revision_conflict', 'Dữ liệu đã được thay đổi ở nơi khác.', latest);
    }
    for (const table of ['transactions', 'budgets', 'goals', 'recurring']) {
      db.prepare(`DELETE FROM "${table}" WHERE user_id = ?`).run(userId);
    }
    insertStateRows(db, userId, state);
    const revision = current.revision + 1;
    db.prepare('UPDATE wallet_meta SET revision = ?, demo = ? WHERE user_id = ?').run(revision, state.demo ? 1 : 0, userId);
    db.prepare('INSERT INTO audit (user_id, action, created_at) VALUES (?, ?, ?)').run(userId, 'state_update', createdAt);
    db.exec('COMMIT');
    return revision;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

function createApp(options = {}) {
  const dbPath = options.dbPath ?? process.env.VN_DB_PATH ?? path.join(__dirname, 'data', 'vinho.sqlite');
  const now = options.now ?? Date.now;
  const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;
  const authRateLimit = options.authRateLimit ?? AUTH_RATE_LIMIT;
  const authWindowMs = options.authWindowMs ?? AUTH_WINDOW_MS;
  const allowedHosts = (options.allowedHosts ?? String(process.env.ALLOWED_HOSTS ?? '').split(','))
    .map(host => String(host).trim().toLowerCase()).filter(Boolean);
  const demoTtlMs = options.demoTtlMs ?? DEMO_TTL_MS;
  if (dbPath !== ':memory:') mkdirSync(path.dirname(path.resolve(dbPath)), {recursive: true});
  const db = new DatabaseSync(dbPath);
  createSchema(db);
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');

  const rate = new Map();
  const dummy = passwordRecord(crypto.randomBytes(18).toString('base64url'));

  function audit(userId, action) {
    db.prepare('INSERT INTO audit (user_id, action, created_at) VALUES (?, ?, ?)').run(userId, action, nowIso(now));
  }

  function consumeAuthAttempt(req) {
    const key = clientAddress(req);
    const current = now();
    const entry = rate.get(key);
    if (!entry || current - entry.startedAt >= authWindowMs) {
      rate.set(key, {startedAt: current, count: 1});
      return;
    }
    entry.count += 1;
    if (entry.count > authRateLimit) throw new HttpError(429, 'rate_limited', 'Bạn đã thử quá nhiều lần. Vui lòng đợi rồi thử lại.');
  }

  // Demo workspaces are throwaway: remove them (and their data, via ON DELETE CASCADE) after a day.
  function purgeDemoUsers() {
    const cutoff = new Date(now() - demoTtlMs).toISOString();
    db.prepare("DELETE FROM users WHERE email LIKE 'demo-%@local.invalid' AND created_at < ?").run(cutoff);
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
  }
  purgeDemoUsers();

  function createSession(res, userId, req) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = now() + SESSION_TTL_MS;
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
    db.prepare('INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(tokenHash(token), userId, expiresAt, nowIso(now));
    res.setHeader('Set-Cookie', sessionCookie(token, requestIsSecure(req)));
  }

  function currentUser(req) {
    const token = cookieValues(req.headers.cookie)[SESSION_COOKIE];
    if (!token || token.length > 200) return null;
    const hash = tokenHash(token);
    const row = db.prepare(`SELECT users.id, users.name, users.email, sessions.expires_at
      FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id_hash = ?`).get(hash);
    if (!row) return null;
    if (row.expires_at <= now()) {
      db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hash);
      return null;
    }
    return row;
  }

  function requireUser(req) {
    const user = currentUser(req);
    if (!user) throw new HttpError(401, 'authentication_required', 'Bạn cần đăng nhập.');
    return user;
  }

  function createUserWithWallet({name, email, password, state, action}) {
    const id = crypto.randomUUID();
    const createdAt = nowIso(now);
    const record = passwordRecord(password);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO users (id, name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, name, email, record.hash, record.salt, createdAt);
      createWallet(db, id, state);
      db.prepare('INSERT INTO audit (user_id, action, created_at) VALUES (?, ?, ?)').run(id, action, createdAt);
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      if (/UNIQUE constraint failed: users\.email/i.test(String(error?.message))) {
        throw new HttpError(409, 'email_exists', 'Email này đã được đăng ký.');
      }
      throw error;
    }
    return db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(id);
  }

  async function serveStatic(req, res, pathname) {
    const entry = STATIC_FILES.get(pathname);
    if (!entry) throw new HttpError(404, 'not_found', 'Không tìm thấy tài nguyên.');
    const [fileName, contentType] = entry;
    try {
      const content = await readFile(path.join(__dirname, fileName));
      setHeaders(res, {
        'Content-Type': contentType,
        'Content-Length': content.length,
        'Cache-Control': 'no-cache',
        ...(pathname.startsWith('/docs/') ? {'Content-Security-Policy': DOCS_CSP} : {})
      });
      res.statusCode = 200;
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      if (error?.code === 'ENOENT') throw new HttpError(404, 'not_found', 'Không tìm thấy tài nguyên.');
      throw error;
    }
  }

  async function route(req, res) {
    assertAllowedHost(req, allowedHosts);
    let pathname;
    try {
      pathname = new URL(req.url, 'http://local').pathname;
    } catch {
      throw new HttpError(400, 'invalid_url', 'Địa chỉ yêu cầu không hợp lệ.');
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && !pathname.startsWith('/api/') && pathname !== '/health') {
      return serveStatic(req, res, pathname);
    }

    if (req.method === 'GET' && (pathname === '/health' || pathname === '/api/health')) {
      return sendJson(res, 200, {ok: true});
    }

    if (req.method === 'GET' && pathname === '/api/session') {
      const user = currentUser(req);
      if (!user) return sendJson(res, 200, {user: null});
      return sendJson(res, 200, {user: publicUser(user), ...databaseState(db, user.id)});
    }

    if (req.method === 'POST' && pathname === '/api/register') {
      assertSameOrigin(req);
      assertJsonRequest(req);
      consumeAuthAttempt(req);
      const fields = validateAccount(await readJson(req, maxBodyBytes), true);
      const user = createUserWithWallet({...fields, state: emptyState(), action: 'register'});
      createSession(res, user.id, req);
      return sendJson(res, 201, {user: publicUser(user), ...databaseState(db, user.id)});
    }

    if (req.method === 'POST' && pathname === '/api/login') {
      assertSameOrigin(req);
      assertJsonRequest(req);
      consumeAuthAttempt(req);
      const fields = validateAccount(await readJson(req, maxBodyBytes), false);
      const row = db.prepare('SELECT id, name, email, password_hash, password_salt FROM users WHERE email = ?').get(fields.email);
      const matches = passwordMatches(fields.password, row?.password_salt ?? dummy.salt, row?.password_hash ?? dummy.hash);
      if (!row || !matches) throw new HttpError(401, 'invalid_credentials', 'Email hoặc mật khẩu không đúng.');
      createSession(res, row.id, req);
      audit(row.id, 'login');
      return sendJson(res, 200, {user: publicUser(row), ...databaseState(db, row.id)});
    }

    if (req.method === 'POST' && pathname === '/api/demo') {
      assertSameOrigin(req);
      assertJsonRequest(req);
      consumeAuthAttempt(req);
      await readJson(req, maxBodyBytes);
      purgeDemoUsers();
      const suffix = crypto.randomUUID();
      const state = demoState();
      const user = createUserWithWallet({
        name: 'Khách demo',
        email: `demo-${suffix}@local.invalid`,
        password: crypto.randomBytes(32).toString('base64url'),
        state,
        action: 'demo'
      });
      createSession(res, user.id, req);
      return sendJson(res, 201, {user: publicUser(user), ...databaseState(db, user.id)});
    }

    if (req.method === 'POST' && pathname === '/api/logout') {
      assertSameOrigin(req);
      await readBody(req, maxBodyBytes);
      const token = cookieValues(req.headers.cookie)[SESSION_COOKIE];
      const user = currentUser(req);
      if (user) audit(user.id, 'logout');
      if (token) db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(tokenHash(token));
      return sendJson(res, 200, {ok: true}, {'Set-Cookie': clearSessionCookie(requestIsSecure(req))});
    }

    if (req.method === 'POST' && pathname === '/api/password') {
      assertSameOrigin(req);
      assertJsonRequest(req);
      const user = requireUser(req);
      consumeAuthAttempt(req);
      const body = await readJson(req, maxBodyBytes);
      const current = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
      const next = typeof body?.newPassword === 'string' ? body.newPassword : '';
      if (next.length < 10 || next.length > 128) throw new HttpError(400, 'weak_password', 'Mật khẩu mới phải có từ 10 đến 128 ký tự.');
      const row = db.prepare('SELECT password_hash, password_salt FROM users WHERE id = ?').get(user.id);
      if (!passwordMatches(current, row.password_salt, row.password_hash)) {
        throw new HttpError(401, 'invalid_credentials', 'Mật khẩu hiện tại không đúng.');
      }
      const record = passwordRecord(next);
      const token = cookieValues(req.headers.cookie)[SESSION_COOKIE];
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(record.hash, record.salt, user.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash <> ?').run(user.id, tokenHash(token));
        db.prepare('INSERT INTO audit (user_id, action, created_at) VALUES (?, ?, ?)').run(user.id, 'password_change', nowIso(now));
        db.exec('COMMIT');
      } catch (error) {
        try { db.exec('ROLLBACK'); } catch {}
        throw error;
      }
      return sendJson(res, 200, {ok: true});
    }

    if (req.method === 'POST' && pathname === '/api/account/delete') {
      assertSameOrigin(req);
      assertJsonRequest(req);
      const user = requireUser(req);
      const body = await readJson(req, maxBodyBytes);
      const demo = user.email.endsWith('@local.invalid');
      if (!demo) {
        consumeAuthAttempt(req);
        const row = db.prepare('SELECT password_hash, password_salt FROM users WHERE id = ?').get(user.id);
        const password = typeof body?.password === 'string' ? body.password : '';
        if (!passwordMatches(password, row.password_salt, row.password_hash)) {
          throw new HttpError(401, 'invalid_credentials', 'Mật khẩu không đúng.');
        }
      }
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
      return sendJson(res, 200, {ok: true}, {'Set-Cookie': clearSessionCookie(requestIsSecure(req))});
    }

    if (req.method === 'GET' && pathname === '/api/state') {
      const user = requireUser(req);
      return sendJson(res, 200, databaseState(db, user.id));
    }

    if (req.method === 'PUT' && pathname === '/api/state') {
      assertSameOrigin(req);
      assertJsonRequest(req);
      const user = requireUser(req);
      const body = await readJson(req, maxBodyBytes);
      if (!body || typeof body !== 'object' || Array.isArray(body) || !Number.isSafeInteger(body.revision) || body.revision < 0) {
        throw new HttpError(400, 'invalid_revision', 'Phiên bản dữ liệu không hợp lệ.');
      }
      const state = normalizeState(body.state);
      const revision = replaceWallet(db, user.id, state, body.revision, nowIso(now));
      return sendJson(res, 200, {state, revision});
    }

    if (req.method === 'GET' && pathname === '/api/audit') {
      const user = requireUser(req);
      const events = db.prepare('SELECT id, action, created_at AS createdAt FROM audit WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(user.id);
      return sendJson(res, 200, {events});
    }

    if (pathname.startsWith('/api/') || pathname === '/health') {
      throw new HttpError(404, 'not_found', 'Không tìm thấy API.');
    }
    throw new HttpError(405, 'method_not_allowed', 'Phương thức không được hỗ trợ.');
  }

  const server = http.createServer((req, res) => {
    Promise.resolve(route(req, res)).catch(error => {
      if (!res.headersSent) sendError(res, error);
      else res.destroy();
    });
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 100;
  server.maxRequestsPerSocket = 100;
  server.on('close', () => {
    try { db.close(); } catch {}
  });
  server.database = db;
  return server;
}

module.exports = {createApp};

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    process.stderr.write('PORT must be an integer between 1 and 65535.\n');
    process.exitCode = 1;
  } else {
    const server = createApp();
    server.listen(port, HOST, () => {
      process.stdout.write(`Ví Nhỏ đang chạy tại http://${HOST}:${port}\n`);
    });
  }
}
