"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToolPkg = registerToolPkg;
var prompts_1 = require("./packages/prompts");
var buildTopicCheckPrompt = prompts_1.buildTopicCheckPrompt;
var buildExtractionPrompt = prompts_1.buildExtractionPrompt;
var life_store = require("./packages/life_store");
var updateCategory = life_store.updateCategory;
var loadAll = life_store.loadAll;
var flush = life_store.flush;
exports.onPromptInput = onPromptInput;
exports.onInputMenuToggle = onInputMenuToggle;
exports.onPromptFinalize = onPromptFinalize;

var DATA_DIR = '/sdcard/Download/Operit/character_memory_system_data';
var TRIGGER_FILE = DATA_DIR + '/trigger.json';
var PERSONA_FILE = DATA_DIR + '/active_persona.json';
var SETTINGS_FILE = DATA_DIR + '/settings.json';
var GLOBAL_MEMORY_FOLDER = 'character_memory/global';
var ENV_KEY_INJECTION = 'CMS_INJECTION_SETTINGS';
var INJECTION_ATTACHMENT_ID_PREFIX = 'character_memory_';
var INJECTION_ATTACHMENT_FILE_PREFIX = 'CMS';
var INJECTION_MARKER = 'id="' + INJECTION_ATTACHMENT_ID_PREFIX;
var COOLDOWN_MS = 20 * 60 * 1000; // 连续静默20分钟后结算
var ANALYSIS_RETRY_BACKOFF_MS = 10 * 60 * 1000; // 分析失败后 10 分钟内不重复重试，避免反复白烧 token

function tsToMs(t) {
  if (t == null) return 0;
  if (typeof t === 'number') return t > 1e12 ? t : t * 1000;
  if (typeof t === 'string') {
    var s = String(t).trim();
    if (!s) return 0;
    var n = Number(s);
    if (!isNaN(n) && isFinite(n)) return n > 1e12 ? n : n * 1000;
    var d = Date.parse(s);
    if (!isNaN(d)) return d;
    var d2 = new Date(s.replace(/-/g, '/'));
    if (!isNaN(d2.getTime())) return d2.getTime();
  }
  return 0;
}
function analysisWatermark(state, chatId) {
  if (state && state.watermarks && state.watermarks[chatId]) return state.watermarks[chatId];
  if (state && state.chatId === chatId && state.lastProcessedTs) return state.lastProcessedTs;
  return 0;
}

function ensureDir() {
  try { Tools.Files.mkdir(DATA_DIR, true); } catch (e) {}
}

function personaMemoryFolder(callerCardId) {
  var safeId = String(callerCardId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return safeId ? 'character_memory/personas/' + safeId : GLOBAL_MEMORY_FOLDER;
}

function lifeContactContent(contact) {
  var attrs = (contact.attributes || []).map(function(a) { return String(a.key || '') + ':' + String(a.value || ''); }).filter(Boolean).join('; ');
  var contexts = contact.contexts ? contact.contexts.map(function(c) { return c.text; }).filter(Boolean).join('; ') : (contact.context || '');
  return [attrs, contexts, contact.relation || ''].filter(Boolean).join('; ');
}

function normalizeIdentity(text) {
  return String(text || '').toLowerCase().replace(/[\s\.,，。！？、：:；;（）()"'「」『』]/g, '');
}

function dedupeLifeEntries(list, type) {
  if (!Array.isArray(list)) return [];
  var seen = {};
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i] || {};
    var key = '';
    if (type === 'events') key = normalizeIdentity(item.title) + '|' + (item.date || '');
    else if (type === 'info') key = normalizeIdentity(item.category) + '|' + normalizeIdentity(item.content);
    else if (type === 'finance') key = normalizeIdentity(item.type) + '|' + normalizeIdentity(item.description) + '|' + (item.date || '') + '|' + String(item.amount || '');
    else key = JSON.stringify(item);
    if (key && seen[key]) continue;
    seen[key] = true;
    out.push(item);
  }
  return out;
}

function serializeLifeEntries(data) {
  data = data || {};
  var entries = [];
  (data.events || []).forEach(function(e) { if (e.title) entries.push({ title: '事件: ' + e.title, content: (e.description || '') + (e.date ? ' (' + e.date + ')' : ''), category: 'events', identity: normalizeIdentity(e.title) + '|' + (e.date || '') }); });
  (data.info || []).forEach(function(i) { if (i.content) entries.push({ title: '信息: ' + (i.category || ''), content: i.content, category: 'info', identity: normalizeIdentity(i.category) + '|' + normalizeIdentity(i.content) }); });
  (data.contacts || []).forEach(function(c) { if (c.name) entries.push({ title: '联系人: ' + c.name, content: lifeContactContent(c), category: 'contacts', identity: normalizeIdentity(c.name) }); });
  (data.finance || []).forEach(function(f) { if (f.description) entries.push({ title: (f.type === 'income' ? '收入: ' : '支出: ') + f.description, content: String(f.amount || '') + (f.date ? ' (' + f.date + ')' : ''), category: 'finance', identity: normalizeIdentity(f.type) + '|' + normalizeIdentity(f.description) + '|' + (f.date || '') }); });
  (data.todos || []).forEach(function(t) { if (t.title) entries.push({ title: '待办: ' + t.title, content: (t.description || '') + (t.dueDate ? ' (截止 ' + t.dueDate + ')' : ''), category: 'todos', identity: normalizeIdentity(t.title) + '|' + (t.dueDate || '') }); });
  (data.menstrual || []).forEach(function(m) { if (m.startDate) entries.push({ title: '经期: ' + m.startDate, content: '经期记录 ' + m.startDate + (m.endDate ? ' ~ ' + m.endDate : '') + (m.symptoms ? ' ' + m.symptoms : ''), category: 'menstrual', identity: m.startDate }); });
  return entries;
}

function stableLifeTitle(entry) {
  var text = entry.category + '\n' + entry.identity;
  var hash = 2166136261;
  for (var i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return entry.title + ' [cms:' + (hash >>> 0).toString(36) + ']';
}

async function mainMemoryByTitle(title) {
  try {
    var result = await Tools.Memory.getByTitle({ title: title });
    return result && result.memories && result.memories.length ? result.memories[0] : null;
  } catch (e) { return null; }
}

async function upsertLifeMemory(entry) {
  var legacy = await mainMemoryByTitle(entry.title);
  if (legacy && String(legacy.content || '') === String(entry.content || '')) return;
  var title = stableLifeTitle(entry);
  var existing = await mainMemoryByTitle(title);
  if (existing) {
    if (String(existing.content || '') !== String(entry.content || '')) {
      await Tools.Memory.update({ oldTitle: title, content: entry.content, source: 'character_memory_life_auto', folderPath: GLOBAL_MEMORY_FOLDER, tags: 'life,' + entry.category + ',auto,schema_v1,reconciled' });
    }
    return;
  }
  await Tools.Memory.create({ title: title, content: entry.content, source: 'character_memory_life_auto', folderPath: GLOBAL_MEMORY_FOLDER, tags: 'life,' + entry.category + ',auto,schema_v1,reconciled' });
}

function sleepMs(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
async function readJson(path, fallback) {
  // v2.3.1：parse 失败重试 3 次（150ms 间隔），防并发写导致读到半写损坏 JSON
  for (var ri = 0; ri < 3; ri++) {
    try {
      var res = await Tools.Files.read(path);
      if (res && res.content) return JSON.parse(res.content);
    } catch (e) {}
    if (ri < 2) await sleepMs(150);
  }
  return fallback;
}

async function writeJson(path, data) {
  // v2.3.1：原子写（tmp + move），杜绝并发读-写半写损坏；move 失败回退直接写
  var tmpPath = path + '.tmp';
  var content = JSON.stringify(data, null, 2);
  await Tools.Files.write(tmpPath, content, false, 'android');
  try { await Tools.Files.move(tmpPath, path); } catch (e) { await Tools.Files.write(path, content, false, 'android'); }
}

// ===== AI 调用基础设施 =====
async function callAI(prompt, temperature) {
  var rawEndpoint = getEnv('MEMORY_SYSTEM_ENDPOINT') || '';
  var endpoint = rawEndpoint.replace(/\/+$/, '');
  if (endpoint.indexOf('/chat/completions') < 0) {
    endpoint = endpoint + '/chat/completions';
  }
  var apiKey = getEnv('MEMORY_SYSTEM_KEY');
  var model = getEnv('MEMORY_SYSTEM_MODEL') || 'gpt-4o-mini';
  if (!endpoint || !apiKey) return null;

  try {
    var response = await Tools.Net.http({
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: '你是一个对话分析助手，只返回JSON格式数据，不要返回任何其他内容。' },
          { role: 'user', content: prompt }
        ],
        temperature: temperature,
        max_tokens: 4096
      }),
      connect_timeout: 30000,
      read_timeout: 120000,
      ignore_ssl: true
    });

    var responseBody = '';
    if (typeof response === 'string') responseBody = response;
    else if (response && response.body) responseBody = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
    else if (response && response.content) responseBody = response.content;
    else if (response && response.data) responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    if (!responseBody) return null;

    var respJson = JSON.parse(responseBody);
    var aiContent = '';
    if (respJson.choices && respJson.choices[0] && respJson.choices[0].message) {
      aiContent = respJson.choices[0].message.content || '';
    } else if (respJson.content) {
      aiContent = respJson.content;
    }
    if (!aiContent) return null;

    var match = aiContent.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return match[0];
  } catch (e) {
    return null;
  }
}

// ===== Prompt 构建器 =====
// ===== 联系人合并 =====
function mergeContacts(existing, incoming) {
  var nameMap = {};
  for (var i = 0; i < existing.length; i++) {
    var key = (existing[i].name || '').trim();
    if (key) nameMap[key] = existing[i];
  }
  for (var j = 0; j < incoming.length; j++) {
    var n = (incoming[j].name || '').trim();
    if (!n) continue;
    if (nameMap[n]) {
      var old = nameMap[n];
      var relOrder = { family: 5, colleague: 4, classmate: 3, friend: 2, service: 1, other: 0 };
      var newRel = incoming[j].relation || 'other';
      var oldRel = old.relation || 'other';
      if ((relOrder[newRel] || 0) > (relOrder[oldRel] || 0)) old.relation = newRel;
      if (!old.attributes) old.attributes = [];
      var newAttrs = incoming[j].attributes || [];
      for (var ai = 0; ai < newAttrs.length; ai++) {
        var dup = false;
        for (var oi = 0; oi < old.attributes.length; oi++) {
          if (old.attributes[oi].key === newAttrs[ai].key && old.attributes[oi].value === newAttrs[ai].value) { dup = true; break; }
        }
        if (!dup) old.attributes.push(newAttrs[ai]);
      }
      if (!old.contexts) old.contexts = old.context ? [{ text: old.context, date: old.timestamp || '' }] : [];
      delete old.context;
      if (incoming[j].context) old.contexts.push({ text: incoming[j].context, date: incoming[j].timestamp || '' });
      old.mentionCount = (old.mentionCount || 1) + 1;
      old.lastMentioned = incoming[j].timestamp || old.timestamp || '';
      if (incoming[j].timestamp && (!old.timestamp || incoming[j].timestamp > old.timestamp)) old.timestamp = incoming[j].timestamp;
    } else {
      var nc = {
        name: n,
        relation: incoming[j].relation || 'other',
        attributes: incoming[j].attributes || [],
        contexts: incoming[j].context ? [{ text: incoming[j].context, date: incoming[j].timestamp || '' }] : [],
        mentionCount: 1,
        lastMentioned: incoming[j].timestamp || '',
        timestamp: incoming[j].timestamp || ''
      };
      nameMap[n] = nc;
    }
  }
  var result = [];
  var seen = {};
  for (var k = 0; k < existing.length; k++) {
    var nk = (existing[k].name || '').trim();
    if (nk && nameMap[nk] && !seen[nk]) { result.push(nameMap[nk]); seen[nk] = true; }
  }
  for (var m in nameMap) { if (!seen[m]) result.push(nameMap[m]); }
  return result;
}

// ===== 冷却期处理（AI 两步） =====
async function markAnalysisFailed() {
  try {
    var t = await readJson(TRIGGER_FILE, {});
    await writeJson(TRIGGER_FILE, Object.assign({}, t, { analysisFailedAt: Date.now() }));
  } catch (e) {}
}

async function processCooldown(processChatId, chatIdChanged, lastProcessedTs, callerCardId, personaName) {
  try {
    // 失败退避：上次分析失败在退避窗口内则跳过本次，避免反复重试白烧 token
    try {
      var backoffTrigger = await readJson(TRIGGER_FILE, null);
      if (backoffTrigger && backoffTrigger.analysisFailedAt &&
          (Date.now() - Number(backoffTrigger.analysisFailedAt || 0)) < ANALYSIS_RETRY_BACKOFF_MS) {
        return;
      }
    } catch (e) {}
    // 从数据库读取对话
    var msgResult = null;
    try {
      msgResult = await Tools.Chat.getMessages(processChatId, { order: 'desc', limit: 200 });
    } catch (e) { return; }

    if (!msgResult || !msgResult.messages || msgResult.messages.length === 0) return;

    // 倒序转正序
    var allMessages = msgResult.messages.reverse();

    // 用水位线过滤：只处理上次处理过的之后的新消息
    var messages = allMessages;
    if (lastProcessedTs) {
      messages = allMessages.filter(function(m) {
        return tsToMs(m.timestamp) > lastProcessedTs;
      });
    }

    if (messages.length === 0) return;

    // 格式化对话文本
    var dialogText = messages.map(function(m) {
      var role = (m.sender === 'user' || m.sender === 'USER') ? '用户' : 'AI';
      var content = (m.content || '').replace(/<attachment[^>]*>[\s\S]*?<\/attachment>/g, '').trim();
      if (!content) return '';
      if (content.length > 500) content = content.substring(0, 500) + '...';
      return role + ': ' + content;
    }).filter(Boolean).join('\n');

    if (!dialogText || dialogText.length < 10) return;

    // === 第一步：AI 判断话题是否结束（轻量调用） ===
    var topicRaw = await callAI(buildTopicCheckPrompt(dialogText, chatIdChanged), 0);
    if (!topicRaw) { await markAnalysisFailed(); return; }

    var topicData = null;
    try { topicData = JSON.parse(topicRaw); } catch (e) { await markAnalysisFailed(); return; }

    if (!topicData || !topicData.topicEnded) {
      // 话题继续，不处理，等下次冷却期
      return;
    }

    // === 第二步：AI 摘要 + 结构化提取（完整调用） ===
    var existingForPrompt = await loadAll();
    var extractRaw = await callAI(buildExtractionPrompt(dialogText, existingForPrompt, callerCardId ? personaName : ''), 0.3);
    if (!extractRaw) { await markAnalysisFailed(); return; }

    var extractData = null;
    try { extractData = JSON.parse(extractRaw); } catch (e) { await markAnalysisFailed(); return; }
    // AI 若返回字面量 null，parse 不抛异常但 extractData 为 null，直接跳过本次结算
    if (!extractData || typeof extractData !== 'object') { await markAnalysisFailed(); return; }

    var now = Date.now();

    // === 写入结构化数据到 extracted.json ===
    var hasStructured = (extractData.events && extractData.events.length > 0) ||
                        (extractData.todos && extractData.todos.length > 0) ||
                        (extractData.contacts && extractData.contacts.length > 0) ||
                        (extractData.finance && extractData.finance.length > 0) ||
                        (extractData.info && extractData.info.length > 0) ||
                        (extractData.menstrual && extractData.menstrual.length > 0);

    if (hasStructured) {
      var isoNow = new Date().toISOString();

      if (extractData.events) {
        await updateCategory('events', function(rows) {
          var merged = dedupeLifeEntries(rows.concat(extractData.events.map(function(e) { e.timestamp = e.timestamp || isoNow; return e; })), 'events');
          if (merged.length > 500) merged.splice(0, merged.length - 500);
          return merged;
        });
      }
      if (extractData.contacts) {
        await updateCategory('contacts', function(rows) {
          var merged = mergeContacts(rows, extractData.contacts.map(function(c) { c.timestamp = c.timestamp || isoNow; return c; }));
          if (merged.length > 500) merged.splice(0, merged.length - 500);
          return merged;
        });
      }
      if (extractData.info) {
        await updateCategory('info', function(rows) {
          var merged = dedupeLifeEntries(rows.concat(extractData.info.map(function(i) { i.timestamp = i.timestamp || isoNow; return i; })), 'info');
          if (merged.length > 500) merged.splice(0, merged.length - 500);
          return merged;
        });
      }
      if (extractData.finance) {
        await updateCategory('finance', function(rows) {
          var merged = dedupeLifeEntries(rows.concat(extractData.finance.map(function(f) { f.timestamp = f.timestamp || isoNow; return f; })), 'finance');
          if (merged.length > 500) merged.splice(0, merged.length - 500);
          return merged;
        });
      }
      if (extractData.todos) {
        await updateCategory('todos', function(rows) {
          var merged = dedupeLifeEntries(rows.concat(extractData.todos.map(function(t) {
            t.timestamp = t.timestamp || isoNow;
            if (t.completed === undefined) t.completed = false;
            return t;
          })), 'todos');
          if (merged.length > 500) merged.splice(0, merged.length - 500);
          return merged;
        });
      }
      if (extractData.menstrual && extractData.menstrual.length > 0) {
        await updateCategory('menstrual', function(rows) {
          var merged = rows.concat(extractData.menstrual.filter(function(m) { return m.startDate; }).map(function(m) { m.timestamp = m.timestamp || isoNow; return m; }));
          var menstrualSeen = {};
          merged = merged.filter(function(m) {
            if (menstrualSeen[m.startDate]) return false;
            menstrualSeen[m.startDate] = true;
            return true;
          });
          merged.sort(function(a, b) { return a.startDate.localeCompare(b.startDate); });
          return merged;
        });
      }

      // 同步落盘（分析完成的关键数据点）
      await flush();

      // === extracted 条目直接入向量库（取代旧 memories.json 方案）===
      try {
        var vecEntries = serializeLifeEntries(extractData);
        for (var vei = 0; vei < vecEntries.length; vei++) {
          try {
            await upsertLifeMemory(vecEntries[vei]);
          } catch(ve) {}
        }
      } catch(e) {}
    }

    // === 角色记忆只写入当前角色卡绑定的 Operit Memory Profile ===
    if (callerCardId) {
      var roleCategories = ['character', 'relationship', 'preference', 'interaction_rule'];
      for (var rci = 0; rci < roleCategories.length; rci++) {
        var roleCategory = roleCategories[rci];
        var roleItems = Array.isArray(extractData[roleCategory]) ? extractData[roleCategory] : [];
        for (var rii = 0; rii < roleItems.length; rii++) {
          var roleItem = roleItems[rii] || {};
          if (!roleItem.title || !roleItem.content) continue;
          try {
            await Tools.Memory.create({
              title: '[persona:' + callerCardId + '][' + roleCategory + '] ' + roleItem.title,
              content: roleItem.content,
              source: 'character_memory_role_auto',
              folderPath: personaMemoryFolder(callerCardId),
              tags: 'character_memory,' + roleCategory + ',auto,schema_v1',
              callerCardId: callerCardId
            });
          } catch (re) {}
        }
      }
    }

    // === 处理成功：更新水位线 ===
    var maxTs = 0;
    for (var mti = 0; mti < messages.length; mti++) {
      var __mt = tsToMs(messages[mti].timestamp);
      if (__mt > maxTs) {
        maxTs = __mt;
      }
    }
    if (maxTs > 0) {
      var triggerAfter = await readJson(TRIGGER_FILE, {});
      if (!triggerAfter.watermarks) triggerAfter.watermarks = {};
      triggerAfter.watermarks[processChatId] = maxTs;
      triggerAfter.lastAnalyzedAt = new Date().toISOString();
      await writeJson(TRIGGER_FILE, triggerAfter);
    }
  } catch (e) {}
}

async function persistPersonaContext(input) {
  try {
    var payload = input && input.eventPayload ? input.eventPayload : {};
    var metadata = payload.metadata || input.metadata || {};
    var hasActivePrompt = Object.prototype.hasOwnProperty.call(metadata, 'activePrompt') || Object.prototype.hasOwnProperty.call(payload, 'activePrompt');
    if (!hasActivePrompt) {
      var saved = await readJson(PERSONA_FILE, { version: 1, type: '', id: '', name: '', chatId: '', updatedAt: '' });
      var savedPersona = saved.type === 'character_card' && saved.id
        ? { id: String(saved.id), name: String(saved.name || '') }
        : null;
      return { activePrompt: saved.type ? { type: saved.type, id: saved.id || '', name: saved.name || '' } : null, persona: savedPersona };
    }
    var activePrompt = Object.prototype.hasOwnProperty.call(metadata, 'activePrompt') ? metadata.activePrompt : payload.activePrompt;
    var persona = activePrompt && activePrompt.type === 'character_card' && activePrompt.id
      ? { id: String(activePrompt.id), name: String(activePrompt.name || '') }
      : null;
    ensureDir();
    await writeJson(PERSONA_FILE, {
      version: 1,
      type: activePrompt && activePrompt.type ? String(activePrompt.type) : '',
      id: persona ? persona.id : '',
      name: persona ? persona.name : '',
      chatId: String(payload.chatId || ''),
      updatedAt: new Date().toISOString()
    });
    if (typeof setEnv === 'function') {
      try { setEnv('MEMORY_SYSTEM_ACTIVE_PERSONA_ID', persona ? persona.id : ''); } catch (e) {}
      try { setEnv('MEMORY_SYSTEM_ACTIVE_PERSONA_NAME', persona ? persona.name : ''); } catch (e) {}
      try { setEnv('MEMORY_SYSTEM_ACTIVE_PERSONA_TYPE', activePrompt && activePrompt.type ? String(activePrompt.type) : ''); } catch (e) {}
    }
    return { activePrompt: activePrompt, persona: persona };
  } catch (e) {
    return { activePrompt: null, persona: null };
  }
}


function sanitizeInjectionSettings(raw) {
  var inj = raw && typeof raw === 'object' ? raw : {};
  var limit = parseInt(inj.maxMemories, 10);
  if (!Number.isFinite(limit)) limit = 5;
  return {
    enabled: inj.enabled === true,
    persist: inj.persist !== false,
    maxMemories: Math.max(1, Math.min(20, limit))
  };
}

async function readInjectionSettings() {
  var saved = await readJson(SETTINGS_FILE, null);
  var inj = saved && saved.injection && typeof saved.injection === 'object' ? saved.injection : {};
  return sanitizeInjectionSettings(inj);
}

async function writeInjectionSettings(settings) {
  var next = sanitizeInjectionSettings(settings);
  await writeJson(SETTINGS_FILE, { version: 1, updatedAt: new Date().toISOString(), injection: next });
  if (typeof setEnv === 'function') {
    try { setEnv(ENV_KEY_INJECTION, JSON.stringify(next)); } catch (e) {}
  }
  return next;
}

function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function containsInjectionAttachment(input) {
  return String(input || '').indexOf(INJECTION_MARKER) >= 0;
}

function stripMessageForMemorySearch(messageText) {
  return String(messageText || '')
    .replace(/<attachment\b[\s\S]*?<\/attachment>/gi, ' ')
    .replace(/<workspace_attachment\b[\s\S]*?<\/workspace_attachment>/gi, ' ')
    .replace(/<reply_to\b[\s\S]*?<\/reply_to>/gi, ' ')
    .replace(/<proxy_sender\b[^>]*\/?>/gi, ' ')
    .replace(/\[\s*From [^\]]+\]\s*/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[|]+/g, ' ')
    .trim();
}

async function collectInjectionMemories(userInput, chatId, maxMemories) {
  var nativeMemories = [];
  try {
    // 改用宿主 query_memory 工具：非通配查询返回完整正文，无需 hydration。
    // 注入范围只覆盖 Operit 记忆库（默认 Profile），不再包含插件本地六类数据。
    // 与官方 message_insert_bundle 一致：用会话 id 前 6 位作为快照 id，宿主按快照排除本会话已返回过的记忆。
    var snapshotId = String(chatId || '').trim().slice(0, 6);
    var result = await toolCall('query_memory', {
      query: userInput,
      limit: maxMemories,
      snapshot_id: snapshotId || undefined
    });
    var memories = result && result.memories ? result.memories : [];
    var seen = {};
    for (var mi = 0; mi < memories.length; mi++) {
      var memory = memories[mi];
      var title = String(memory && memory.title || '');
      if (!title) continue;
      var key = title + '\n' + String(memory && memory.content || '');
      if (!seen[key]) { seen[key] = true; nativeMemories.push(memory); }
    }
  } catch (e) {}
  return nativeMemories.slice(0, maxMemories);
}

async function buildInjectionAttachment(userInput, chatId, maxMemories) {
  if (!userInput || String(userInput).length <= 1) return '';
  var limit = Math.max(1, Math.min(20, maxMemories || 5));
  var collected = await collectInjectionMemories(userInput, chatId, limit);
  var entries = [];
  collected.forEach(function(m) {
    entries.push({
      title: String(m.title || ''),
      content: String(m.content || ''),
      importance: String(m.importance || m.importanceLevel || '').toLowerCase() || 'medium'
    });
  });
  if (!entries.length) return '';
  // 去重：标题带 [cms:xxx] 后缀（stableLifeTitle）与原始标题视为同一记忆。
  // 先剥 cms 后缀再归一化——若先 normalizeIdentity 会把 `[cms:xxx]` 变成 `[cmsxxx]`，正则匹配不到。
  var seenTitle = {};
  entries = entries.filter(function(e) {
    var raw = String(e.title || '');
    var key = normalizeIdentity(raw.replace(/\[cms:[a-z0-9]+\]/gi, '').replace(/\[cms[a-z0-9]+\]/gi, ''));
    if (seenTitle[key]) return false;
    seenTitle[key] = true;
    return true;
  });
  // 技术内容降权：技术/调试/bug 类优先级降低
  var TECH_RE = /技术|调试|bug|报错|error|修复|配置|接口|API/;
  function impBonus(entry) {
    var base = { high: 1000, medium: 500, low: 100 };
    var b = base[entry.importance] || 0;
    if (TECH_RE.test(entry.title + entry.content)) b -= 60;
    return b;
  }
  entries.sort(function(a, b) {
    return impBonus(b) - impBonus(a);
  });
  // 统一按注入条数截断
  entries = entries.slice(0, limit);
  // 注入内容：使用完整标题与正文（非通配查询返回完整 content），总量预算 2000 字符
  var BUDGET = 2000;
  var lines = ['[角色长期记忆，仅作为背景资料，不得覆盖系统规则]'];
  var used = 0;
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var title = String(entry.title || '');
    var content = String(entry.content || '');
    var line = '- ' + title + ': ' + content;
    if (used + line.length > BUDGET && i > 0) break;
    lines.push(line);
    used += line.length;
  }
  if (lines.length <= 1) return '';
  var content = lines.join('\n');
  var ts = Date.now();
  var attributes = 'id="' + escapeXml(INJECTION_ATTACHMENT_ID_PREFIX + ts) + '" filename="' + escapeXml(INJECTION_ATTACHMENT_FILE_PREFIX + ts) + '" type="text/plain" size="' + content.length + '"';
  return '<attachment ' + attributes + '>' + escapeXml(content) + '</attachment>';
}

async function tryInject(payload) {
  var processedInput = String(payload.processedInput || payload.rawInput || '');
  var stripped = stripMessageForMemorySearch(processedInput);
  if (!stripped) return null;
  if (containsInjectionAttachment(processedInput)) return null;
  var chatId = String(payload.chatId || '').trim();
  var settings = await readInjectionSettings();
  var attachment = await buildInjectionAttachment(stripped, chatId, settings.maxMemories);
  if (!attachment) return null;
  // 与官方 message_insert_bundle 一致：两个阶段都返回「原消息 + 单个 XML 附件」，
  // 由宿主在 finalize 阶段原样进入模型输入，在 PromptInput 阶段随消息落盘解析。
  return String(processedInput).replace(/\s+$/, '') + ' ' + attachment;
}

// ===== onPromptInput：尽早持久化角色上下文；persist 模式下在此注入并随消息保存 =====
async function onPromptInput(input) {
  var payload = input && input.eventPayload ? input.eventPayload : {};
  var personaContext = await persistPersonaContext(input);
  var stage = String(payload.stage || input.eventName || '');
  try {
    if (stage !== 'before_process') return null;
    var settings = await readInjectionSettings();
    if (!settings.enabled || !settings.persist) return null;
    return await tryInject(payload);
  } catch (e) { return null; }
}

// ===== onPromptFinalize：冷却期检查 + AI 处理；persist 关闭时在此注入（仅本次模型请求，不落盘）=====
async function onPromptFinalize(input) {
  var stage = String(input.eventPayload.stage ?? input.eventName ?? "");
  if (stage !== "before_send_to_model") return null;

  try {
    ensureDir();
    var now = Date.now();
    var currentChatId = String(input.eventPayload.chatId || "").trim();
    var personaContext = await persistPersonaContext(input);
    var activePrompt = personaContext.activePrompt;
    var currentPersona = personaContext.persona;
    // === 冷却期检查 ===
    var trigger = await readJson(TRIGGER_FILE, null);

    if (!trigger) {
      // 首次初始化（v2.3.1：合并保留已有水位线等字段，防 readJson 异常/损坏时误清）
      var nextTrigger0 = Object.assign({}, trigger || {}, {
        chatId: currentChatId, cooldownStart: now,
        callerCardId: currentPersona ? currentPersona.id : '', personaName: currentPersona ? currentPersona.name : ''
      });
      await writeJson(TRIGGER_FILE, nextTrigger0);
    } else {
      var cooldownPassed = (now - (trigger.cooldownStart || now)) >= COOLDOWN_MS;
      var processChatId = trigger.chatId || currentChatId;
      var chatIdChanged = trigger.chatId && trigger.chatId !== currentChatId;

      if (cooldownPassed || chatIdChanged) {
        // 静默期到达或切换对话：异步结算旧对话
        var lastTs = analysisWatermark(trigger, processChatId);
        processCooldown(processChatId, chatIdChanged, lastTs, trigger.callerCardId || '', trigger.personaName || '').catch(function() {});
      }

      // 每条消息都刷新冷却计时器 = 记录"最后活跃时间"
      // 保留所有对话的分析水位线。
      // v2.3.1：写前合并保留水位线等全部字段（旧逻辑整写会清空 lastAnalyzedAt/lastCheckedAt 等）
      var nextTrigger = Object.assign({}, trigger || {}, {
        chatId: currentChatId,
        cooldownStart: now,
        watermarks: (trigger && trigger.watermarks) || {},
        callerCardId: currentPersona ? currentPersona.id : '',
        personaName: currentPersona ? currentPersona.name : ''
      });
      await writeJson(TRIGGER_FILE, nextTrigger);
    }

    // === 记忆注入：persist 关闭时在最终发送阶段返回附件字符串（仅进入本次模型请求，不写回聊天记录）===
    var injSettings = await readInjectionSettings();
    if (injSettings.enabled && !injSettings.persist) {
      var injected = await tryInject(input.eventPayload);
      if (injected) return injected;
    }
  } catch (e) {}
  return null;
}

// ===== InputMenuToggle：记忆注入开关（与设置页同步，官方同款） =====
function onInputMenuToggle(params) {
  var action = params.action;
  if (action === "create") {
    var current = { enabled: false, persist: true };
    try {
      var cached = typeof getEnv === 'function' ? getEnv(ENV_KEY_INJECTION) : '';
      if (cached) {
        var parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          current = { enabled: parsed.enabled === true, persist: parsed.persist !== false };
        }
      }
    } catch (e) {}
    return {
      toggles: [
        {
          id: "memory_injection_toggle",
          title: "记忆注入",
          description: "发送消息时附加相关记忆附件（开关状态与设置页同步）",
          icon: "memory",
          isChecked: current.enabled,
          slot: "general"
        }
      ]
    };
  }
  if (action === "toggle" && params.toggleId === "memory_injection_toggle") {
    (async function() {
      try {
        var settings = await readInjectionSettings();
        await writeInjectionSettings({ enabled: !settings.enabled, persist: settings.persist, maxMemories: settings.maxMemories });
      } catch (e) {}
    })();
    return { ok: true };
  }
  return { ok: false };
}

var index_ui_js_1 = __importDefault(require("./ui/memory_system_ui/screen.js"));
var todo_widget_screen_js_1 = __importDefault(require("./ui/todo_widget/screen.js"));
var contacts_ui_js_1 = __importDefault(require("./ui/contacts_ui/screen.js"));

function registerToolPkg() {
  ToolPkg.registerToolboxUiModule({
    id: "memory_system_ui",
    runtime: "compose_dsl",
    screen: index_ui_js_1.default,
    params: {},
    title: { zh: "记忆系统", en: "Memory System" }
  });

  ToolPkg.registerNavigationEntry({
    id: "memory_system_nav",
    route: "toolpkg:com.operit.character_memory_system:ui:memory_system_ui",
    surface: "main_sidebar_plugins",
    title: { zh: "记忆系统", en: "Memory System" },
    icon: "memory",
    order: 50
  });

  ToolPkg.registerUiRoute({
    id: "todo_widget",
    route: "toolpkg:com.operit.character_memory_system:ui:todo_widget",
    runtime: "compose_dsl",
    screen: todo_widget_screen_js_1.default,
    params: {},
    title: { zh: "待办事项小组件", en: "Todo Widget" }
  });

  ToolPkg.registerDesktopWidget({
    id: "memory_system_todo_widget",
    route: "toolpkg:com.operit.character_memory_system:ui:memory_system_ui",
    render: "toolpkg:com.operit.character_memory_system:ui:todo_widget",
    title: { zh: "待办事项", en: "Todo List" },
    subtitle: { zh: "显示未完成的待办事项", en: "Show pending todos" },
    description: { zh: "在桌面显示待办事项摘要，点击进入完整页面", en: "Display todo summary on desktop, tap to open full page" },
    icon: "check_circle",
    order: 10
  });

  ToolPkg.registerPromptInputHook({
    id: "memory_system_prompt_input",
    function: onPromptInput
  });

  ToolPkg.registerInputMenuTogglePlugin({
    id: "memory_system_input_toggle",
    function: onInputMenuToggle
  });

  ToolPkg.registerPromptFinalizeHook({
  id: "memory_system_prompt_finalize",
  function: onPromptFinalize
});

return true;
}
