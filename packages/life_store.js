"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// ===== 六类生活数据结构化存储层 =====
// 拆分为独立小文件 + 内存缓存 + 防抖写入，避免单文件巨大导致读写卡顿。
//
// 文件布局（DATA_DIR 下）：
//   events.json / contacts.json / info.json / todos.json / finance.json / menstrual.json
//   旧版 extracted.json 在首次读取时迁移拆分，原文件保留为 extracted.json.bak
//
// 参考：
//   - multi-diary 的一日一文件 + 原子写入（tmp→校验→move）
//   - whereabouts 的 .bak 兜底

var CATEGORIES = ['events', 'contacts', 'info', 'todos', 'finance', 'menstrual'];
var DATA_DIR = '/sdcard/Download/Operit/character_memory_system_data';
var LEGACY_FILE = DATA_DIR + '/extracted.json';
var EMPTY_CAT = { events: [], contacts: [], info: [], todos: [], finance: [], menstrual: [] };

// 内存缓存：{ category: data } ；写入防抖 timer
var cache = {};
var writeTimers = {};

function fileFor(cat) { return DATA_DIR + '/' + cat + '.json'; }

async function ensureDir() {
  try { await Tools.Files.mkdir(DATA_DIR, true); } catch (e) {}
}

// ===== 底层文件读写 =====
async function readTextFile(path) {
  try {
    var res = await Tools.Files.read(path);
    if (res && typeof res.content === 'string') return res.content;
    if (res && typeof res === 'string') return res;
  } catch (e) {}
  return '';
}

async function writeTextFile(path, text) {
  await Tools.Files.write(path, text, false, 'android');
}

async function fileExists(path) {
  try {
    var r = await Tools.Files.exists(path, 'android');
    return !!(r && r.exists);
  } catch (e) { return false; }
}

async function removePath(path) {
  try { await Tools.Files.deleteFile(path, true, 'android'); } catch (e) {}
}

async function movePath(source, destination) {
  if (Tools.Files.move) {
    try { await Tools.Files.move(source, destination, 'android'); return; } catch (e) {}
  }
  // 无 move 时退回：读源写目标再删源
  var text = await readTextFile(source);
  await writeTextFile(destination, text);
  await removePath(source);
}

// ===== 原子写入（multi-diary 模式）=====
async function writeJsonAtomic(path, value) {
  var text = JSON.stringify(value, null, 2);
  try { JSON.parse(text); } catch (e) { throw new Error('Refusing to write unparseable JSON'); }
  await ensureDir();
  var tmpPath = path + '.tmp';
  await writeTextFile(tmpPath, text);
  var verify = await readTextFile(tmpPath);
  try { JSON.parse(verify); } catch (e) { await removePath(tmpPath); throw new Error('Temp verify failed'); }
  if (await fileExists(path)) {
    try {
      var prev = await readTextFile(path);
      if (prev && prev.trim()) await writeTextFile(path + '.bak', prev);
    } catch (e) {}
  }
  await movePath(tmpPath, path);
}

// ===== 旧版 extracted.json 迁移 =====
// 首次读取时若存在旧 extracted.json，拆分为六类文件，原文件改名 .bak。
async function migrateIfNeeded() {
  try {
    if (cache._migrated) return;
    var legacyExists = await fileExists(LEGACY_FILE);
    var anyNew = false;
    for (var ci = 0; ci < CATEGORIES.length; ci++) {
      if (await fileExists(fileFor(CATEGORIES[ci]))) { anyNew = true; break; }
    }
    // 已有拆分文件：旧文件若还在则仅做备份，不再覆盖新文件
    if (anyNew) {
      if (legacyExists) {
        try {
          if (!(await fileExists(LEGACY_FILE + '.bak'))) {
            var legacyText = await readTextFile(LEGACY_FILE);
            if (legacyText && legacyText.trim()) await writeTextFile(LEGACY_FILE + '.bak', legacyText);
          }
          await removePath(LEGACY_FILE);
        } catch (e) {}
      }
      cache._migrated = true;
      return;
    }
    if (legacyExists) {
      var raw = await readTextFile(LEGACY_FILE);
      if (raw && raw.trim()) {
        var legacy = JSON.parse(raw);
        for (var i = 0; i < CATEGORIES.length; i++) {
          var cat = CATEGORIES[i];
          var list = legacy[cat];
          if (!Array.isArray(list)) list = [];
          await writeJsonAtomic(fileFor(cat), { schemaVersion: 1, updatedAt: Date.now(), rows: list });
        }
        // 保留旧文件为 .bak
        try {
          if (!(await fileExists(LEGACY_FILE + '.bak'))) await writeTextFile(LEGACY_FILE + '.bak', raw);
        } catch (e) {}
        await removePath(LEGACY_FILE);
      }
      cache._migrated = true;
    }
  } catch (e) {}
}

// ===== 按类读取（带缓存）=====
async function readCategory(cat) {
  if (cache[cat] !== undefined) return cache[cat];
  await migrateIfNeeded();
  try {
    var raw = await readTextFile(fileFor(cat));
    if (raw && raw.trim()) {
      var parsed = JSON.parse(raw);
      var rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : [];
      cache[cat] = rows;
      return rows;
    }
  } catch (e) {}
  cache[cat] = [];
  return cache[cat];
}

// ===== 防抖写入 =====
function scheduleWrite(cat) {
  if (writeTimers[cat]) return; // 已有待写
  writeTimers[cat] = setTimeout(async function() {
    writeTimers[cat] = null;
    var data = cache[cat];
    if (data === undefined) return;
    try {
      await writeJsonAtomic(fileFor(cat), { schemaVersion: 1, updatedAt: Date.now(), rows: data });
    } catch (e) {}
  }, 150);
}

// 每类容量上限（menstrual 按周期记录，量小不设限）
var CAP_LIMITS = { events: 500, contacts: 500, info: 500, todos: 500, finance: 500 };

// ===== 更新某类（缓存 + 防抖落盘）=====
async function updateCategory(cat, updater) {
  if (CATEGORIES.indexOf(cat) < 0) return null;
  var current = await readCategory(cat);
  var next = updater(current);
  if (!Array.isArray(next)) next = current;
  // 容量控制：超出上限时丢弃最旧的
  var cap = CAP_LIMITS[cat];
  if (cap && next.length > cap) next = next.slice(next.length - cap);
  cache[cat] = next;
  scheduleWrite(cat);
  return next;
}

// ===== 立即落盘（用于退出/分析完成等需要同步点的场景）=====
async function flush(cat) {
  if (cat) {
    if (writeTimers[cat]) { try { clearTimeout(writeTimers[cat]); } catch (e) {} writeTimers[cat] = null; }
    var d = cache[cat];
    if (d === undefined) return;
    try { await writeJsonAtomic(fileFor(cat), { schemaVersion: 1, updatedAt: Date.now(), rows: d }); } catch (e) {}
    return;
  }
  // flush all
  var cats = CATEGORIES.slice();
  for (var i = 0; i < cats.length; i++) {
    if (writeTimers[cats[i]]) { try { clearTimeout(writeTimers[cats[i]]); } catch (e) {} writeTimers[cats[i]] = null; }
    var data = cache[cats[i]];
    if (data === undefined) continue;
    try { await writeJsonAtomic(fileFor(cats[i]), { schemaVersion: 1, updatedAt: Date.now(), rows: data }); } catch (e) {}
  }
}

// ===== 合并全部六类（供 UI / 注入 / 对账）=====
async function loadAll() {
  var out = { events: [], contacts: [], info: [], todos: [], finance: [], menstrual: [] };
  for (var i = 0; i < CATEGORIES.length; i++) {
    out[CATEGORIES[i]] = await readCategory(CATEGORIES[i]);
  }
  return out;
}

// ===== 手动写入某类完整列表（用于对账/导入后重置缓存）=====
async function setCategory(cat, list) {
  if (CATEGORIES.indexOf(cat) < 0) return;
  var arr = Array.isArray(list) ? list : [];
  cache[cat] = arr;
  if (writeTimers[cat]) { try { clearTimeout(writeTimers[cat]); } catch (e) {} writeTimers[cat] = null; }
  try { await writeJsonAtomic(fileFor(cat), { schemaVersion: 1, updatedAt: Date.now(), rows: arr }); } catch (e) {}
}

// ===== 清空缓存（导入恢复后）=====
function resetCache() {
  cache = {};
  for (var k in writeTimers) {
    if (writeTimers[k]) { try { clearTimeout(writeTimers[k]); } catch (e) {} }
  }
  writeTimers = {};
}

exports.CATEGORIES = CATEGORIES;
exports.readCategory = readCategory;
exports.updateCategory = updateCategory;
exports.loadAll = loadAll;
exports.setCategory = setCategory;
exports.flush = flush;
exports.migrateIfNeeded = migrateIfNeeded;
exports.resetCache = resetCache;
exports.DATA_DIR = DATA_DIR;
exports.LEGACY_FILE = LEGACY_FILE;
