"use strict";
/*
METADATA
{
    "name": "memory_system",
    "display_name": { "zh": "记忆系统工具", "en": "Memory System Tools" },
    "description": { "zh": "分析消息并提取结构化数据", "en": "Analyze messages and extract structured data" },
    "tools": [
        {
            "name": "analyze_saved_messages",
            "description": { "zh": "手动触发：从当前对话数据库读取最近消息，AI提取结构化数据（事件/联系人/信息/财务/待办）", "en": "Manually trigger: read recent messages from chat database, AI extract structured data" },
            "parameters": [
                { "name": "chat_id", "type": "string", "required": false, "description": "对话ID，不传则使用当前对话" }
            ]
        },
        {
            "name": "save_ui_state",
            "description": { "zh": "保存上次离开记忆系统时的界面状态，重新打开时恢复，无需刷新", "en": "Save the last UI state and restore it on next open" },
            "parameters": [
                { "name": "state_json", "type": "string", "required": true, "description": "界面状态JSON" }
            ]
        },
        {
            "name": "load_saved_data",
            "description": { "zh": "加载已保存的提取数据和记忆列表", "en": "Load saved extracted data and memory list" },
            "parameters": []
        },
        {
            "name": "get_persona_context",
            "description": { "zh": "读取最近一次Prompt Hook识别到的角色卡上下文", "en": "Read the character context most recently identified by Prompt Hook" },
            "parameters": []
        },
        {
            "name": "reconcile_native_memory",
            "description": { "zh": "将历史结构化生活数据幂等补齐到 Operit 原生 Memory", "en": "Idempotently reconcile historical structured life data into Operit native Memory" },
            "parameters": [
                { "name": "force", "type": "boolean", "required": false, "description": "忽略已完成标记并重新核对" }
            ]
        },
        {
            "name": "get_injection_settings",
            "description": { "zh": "读取记忆注入设置（注入开关、注入内容是否随消息保存）", "en": "Read memory injection settings" },
            "parameters": []
        },
        {
            "name": "set_injection_settings",
            "description": { "zh": "保存记忆注入设置（注入开关、注入内容是否随消息保存、注入记忆条数）", "en": "Save memory injection settings" },
            "parameters": [
                { "name": "enabled", "type": "boolean", "required": false, "description": "记忆注入总开关" },
                { "name": "persist", "type": "boolean", "required": false, "description": "注入内容是否随消息保存" },
                { "name": "max_memories", "type": "integer", "required": false, "description": "每次注入记忆条数上限，1-20" }
            ]
        },
        {
            "name": "toggle_todo",
            "description": { "zh": "切换待办事项的完成状态", "en": "Toggle todo item completion status" },
            "parameters": [
                { "name": "todo_index", "type": "integer", "required": true, "description": "待办事项的索引" }
            ]
        },
        {
            "name": "save_todos",
            "description": { "zh": "保存待办事项列表", "en": "Save todo list" },
            "parameters": [
                { "name": "todos_json", "type": "string", "required": true, "description": "待办事项JSON数组字符串" }
            ]
        },
        {
            "name": "sync_to_env",
            "description": { "zh": "将提取数据同步到环境变量缓存，供UI同步读取", "en": "Sync extracted data to env cache for synchronous UI reads" },
            "parameters": []
        },
        {
            "name": "debug_get_chat_model",
            "description": { "zh": "调试工具：获取当前CHAT绑定的模型配置信息", "en": "Debug: get current CHAT model config info" },
            "parameters": []
        },
        {
            "name": "copy_to_clipboard",
            "description": { "zh": "复制文本到剪贴板", "en": "Copy text to clipboard" },
            "parameters": [
                { "name": "text", "type": "string", "required": true, "description": "要复制的文本" }
            ]
        },
        {
            "name": "create_memory",
            "description": { "zh": "创建新记忆（接入Operit原生向量库）", "en": "Create a new memory using Operit native vector store" },
            "parameters": [
                { "name": "title", "type": "string", "required": true, "description": "记忆标题" },
                { "name": "content", "type": "string", "required": true, "description": "记忆内容" },
                { "name": "tags", "type": "string", "required": false, "description": "标签，逗号分隔" },
                { "name": "source", "type": "string", "required": false, "description": "明确的记忆来源；不传时按是否有角色卡ID自动选择" },
                { "name": "caller_card_id", "type": "string", "required": false, "description": "角色卡ID；传入时写入该角色绑定的Memory Profile" }
            ]
        },
        {
  "name": "load_memories",
"description": { "zh": "从向量库查询记忆", "en": "Query memories from vector store" },
"parameters": [
{ "name": "limit", "type": "integer", "required": false, "description": "最大返回数量，默认50" },
{ "name": "query", "type": "string", "required": false, "description": "搜索查询，不传则返回全部" },
{ "name": "scope", "type": "string", "required": false, "description": "查询范围：global、persona 或 all；默认按是否传角色卡ID选择" },
{ "name": "caller_card_id", "type": "string", "required": false, "description": "角色卡ID；传入时查询该角色绑定的Memory Profile" }
]
},
        {
            "name": "delete_memory",
            "description": { "zh": "从向量库删除记忆", "en": "Delete a memory from vector store" },
            "parameters": [
                { "name": "memory_id", "type": "string", "required": false, "description": "记忆ID或标题" },
                { "name": "title", "type": "string", "required": false, "description": "记忆标题（可选，用于删除向量库记录）" },
                { "name": "caller_card_id", "type": "string", "required": false, "description": "角色卡ID；传入时从该角色绑定的Memory Profile删除" }
            ]
        },
        {
            "name": "get_analyzed_chats",
            "description": { "zh": "获取已分析的对话ID列表，用于消息Tab标记", "en": "Get list of analyzed chat IDs for message tab marking" },
            "parameters": []
        },
        {
            "name": "trigger_analysis",
            "description": { "zh": "侧边栏打开时自动调用：检测上次分析以来是否有新对话内容，有则异步启动AI分析，无则直接跳过", "en": "Auto-trigger on sidebar open: detect new messages since last analysis; start async analysis if any, otherwise skip" },
            "parameters": [
                { "name": "chat_id", "type": "string", "required": false, "description": "对话ID，不传则使用最近对话" }
            ]
        }
    ]
}
*/
const prompts = require("./prompts");
var buildExtractionPrompt = prompts.buildExtractionPrompt;
var buildTopicCheckPrompt = prompts.buildTopicCheckPrompt;
var DATA_DIR = '/sdcard/Download/Operit/character_memory_system_data';
var EXTRACTED_FILE = DATA_DIR + '/extracted.json';
var PERSONA_FILE = DATA_DIR + '/active_persona.json';
var RECONCILE_FILE = DATA_DIR + '/reconcile_v1_4_0.json';
var SETTINGS_FILE = DATA_DIR + '/settings.json';
var GLOBAL_MEMORY_FOLDER = 'character_memory/global';
var UI_STATE_FILE = DATA_DIR + '/last_ui_state.json';
var UI_STATE_ENV = 'MEMORY_SYSTEM_UI_STATE_FILE';
// Hook 与侧边栏共用按对话保存的分析水位线。
var TRIGGER_STATE_FILE = DATA_DIR + '/trigger.json';
var ENV_KEY_EVENTS = 'MW_DATA_EVENTS';
var ENV_KEY_CONTACTS = 'MW_DATA_CONTACTS';
var ENV_KEY_INFO = 'MW_DATA_INFO';
var ENV_KEY_FINANCE = 'MW_DATA_FINANCE';
var ENV_KEY_TODOS = 'MW_DATA_TODOS';
var ENV_KEY_MENSTRUAL = 'MW_DATA_MENSTRUAL';
var ENV_KEY_TIMESTAMP = 'MW_DATA_TIMESTAMP';
var ENV_KEY_INJECTION = 'CMS_INJECTION_SETTINGS';

function personaMemoryFolder(callerCardId) {
    var safeId = String(callerCardId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return safeId ? 'character_memory/personas/' + safeId : GLOBAL_MEMORY_FOLDER;
}

function analysisWatermark(state, chatId) {
    if (state && state.watermarks && state.watermarks[chatId]) return state.watermarks[chatId];
    if (state && state.chatId === chatId && state.lastProcessedTs) return state.lastProcessedTs;
    return 0;
}

async function readJson(path, fallback) {
    try {
        var res = await Tools.Files.read(path);
        if (res && res.content) return JSON.parse(res.content);
    } catch (e) {}
    return fallback;
}

async function writeJson(path, data) {
    await Tools.Files.write(path, JSON.stringify(data, null, 2), false, 'android');
}

function getUiStatePath() {
    try {
        var p = typeof getEnv === 'function' ? String(getEnv(UI_STATE_ENV) || '').trim() : '';
        return p || UI_STATE_FILE;
    } catch (e) { return UI_STATE_FILE; }
}

async function readUiState() {
    return await readJson(getUiStatePath(), { version: 1, data: {} });
}

async function writeUiState(state) {
    try {
        await Tools.Files.makeDirectory(DATA_DIR, true);
        await writeJson(getUiStatePath(), {
            version: 1,
            savedAt: new Date().toISOString(),
            data: state || {}
        });
    } catch (e) {}
}

async function syncExtractedToEnv() {
    try {
        var ext = await readJson(EXTRACTED_FILE, {
            events: [], contacts: [], info: [], finance: [], todos: [], menstrual: []
        });
        if (!ext.todos) ext.todos = [];
        if (!ext.finance) ext.finance = [];
        var events = (ext.events || []).slice(-200);
        var contacts = (ext.contacts || []).slice(-200);
        var info = (ext.info || []).slice(-200);
        var finance = (ext.finance || []).slice(-200);
        var todos = (ext.todos || []).slice(-200);
        var menstrual = (ext.menstrual || []).slice(-50);
        setEnv(ENV_KEY_EVENTS, JSON.stringify(events));
        setEnv(ENV_KEY_CONTACTS, JSON.stringify(contacts));
        setEnv(ENV_KEY_INFO, JSON.stringify(info));
        setEnv(ENV_KEY_FINANCE, JSON.stringify(finance));
        setEnv(ENV_KEY_TODOS, JSON.stringify(todos));
        setEnv(ENV_KEY_MENSTRUAL, JSON.stringify(menstrual));
        var pending = todos.filter(function (t) { return !t.completed; }).length;
        var total = todos.length;
        var now = new Date();
        var timeStr = (now.getMonth() + 1) + '/' + now.getDate() + ' ' + now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
        setEnv('WIDGET_TODO_TOTAL', String(total));
        setEnv('WIDGET_TODO_PENDING', String(pending));
        setEnv('WIDGET_TODO_UPDATED', timeStr);
        setEnv(ENV_KEY_TIMESTAMP, String(Date.now()));
    } catch (e) {}
}

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
                    if (old.attributes[oi].key === newAttrs[ai].key && old.attributes[oi].value === newAttrs[ai].value) {
                        dup = true; break;
                    }
                }
                if (!dup) old.attributes.push(newAttrs[ai]);
            }
            if (!old.contexts) {
                old.contexts = old.context ? [{ text: old.context, date: old.timestamp || '' }] : [];
                delete old.context;
            }
            if (incoming[j].context) {
                old.contexts.push({ text: incoming[j].context, date: incoming[j].timestamp || '' });
            }
            old.mentionCount = (old.mentionCount || 1) + 1;
            old.lastMentioned = incoming[j].timestamp || old.timestamp || '';
            if (incoming[j].timestamp && (!old.timestamp || incoming[j].timestamp > old.timestamp)) {
                old.timestamp = incoming[j].timestamp;
            }
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
        if (nk && nameMap[nk] && !seen[nk]) {
            result.push(nameMap[nk]);
            seen[nk] = true;
        }
    }
    for (var m in nameMap) {
        if (!seen[m]) result.push(nameMap[m]);
    }
    return result;
}

exports.save_ui_state = async function (params) {
    try {
        var parsed = JSON.parse(String(params && params.state_json || '{}'));
        await writeUiState(parsed);
        complete({ success: true, message: '界面状态已保存' });
    } catch (e) {
        complete({ success: false, message: e.message || String(e) });
    }
};

// ===== load_saved_data：返回本地结构化数据；长期记忆由 load_memories 查询原生 Memory =====
exports.load_saved_data = async function () {
    try {
        var ext = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
        if (!ext.todos) ext.todos = [];
        if (!ext.finance) ext.finance = [];
        // 历史对账改为后台异步执行：首次对账可能遍历大量条目较慢，
        // 不能阻塞 UI 首次数据加载；reconcileNativeMemory 内部用文件标记防重复。
        (function () {
            try {
                reconcileNativeMemory(false).then(function (r) {
                    try { console.log('memory_system background reconcile done', JSON.stringify(r)); } catch (_) {}
                }).catch(function (e) {
                    try { console.log('memory_system background reconcile failed', String(e)); } catch (_) {}
                });
            } catch (e) {}
        })();
        var uiState = await readUiState();
        var injectionSettings = await readInjectionSettings();
        complete({ success: true, extracted: ext, uiState: uiState, injection: injectionSettings });
    } catch (e) {
        complete({ success: false, message: e.message || String(e) });
    }
};

exports.reconcile_native_memory = async function (params) {
    try {
        var result = await reconcileNativeMemory(!!(params && params.force));
        complete({ success: true, result: result });
    } catch (e) {
        complete({ success: false, message: e.message || String(e) });
    }
};

exports.get_persona_context = async function () {
    try {
        var context = await readJson(PERSONA_FILE, { version: 1, type: '', id: '', name: '', chatId: '', updatedAt: '' });
        complete({ success: true, persona: context });
    } catch (e) {
        complete({ success: false, message: e.message || String(e) });
    }
};

// ===== 记忆注入设置（JSON 持久化，随数据目录一起可导出）=====
var DEFAULT_INJECTION_SETTINGS = {
    enabled: false,
    persist: true,
    maxMemories: 5
};

function sanitizeInjectionSettings(input) {
    var raw = input && typeof input === 'object' ? input : {};
    var limit = parseInt(raw.maxMemories, 10);
    if (!Number.isFinite(limit)) limit = 5;
    return {
        enabled: raw.enabled === true,
        persist: raw.persist !== false,
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
    try { await Tools.Files.makeDirectory(DATA_DIR, true); } catch (e) {}
    await writeJson(SETTINGS_FILE, { version: 1, updatedAt: new Date().toISOString(), injection: next });
    return next;
}

exports.get_injection_settings = async function () {
    try {
        var settings = await readInjectionSettings();
        if (typeof setEnv === 'function') {
            try { setEnv(ENV_KEY_INJECTION, JSON.stringify(settings)); } catch (e) {}
        }
        complete({ success: true, injection: settings });
    } catch (e) {
        complete({ success: false, message: e.message || String(e) });
    }
};

exports.set_injection_settings = async function (params) {
    try {
        // 部分更新：先读当前设置，只覆盖传入的字段，避免重置其它开关
        var current = await readInjectionSettings();
        var patch = {
            enabled: current.enabled,
            persist: current.persist,
            maxMemories: current.maxMemories
        };
        if (params && params.enabled !== undefined) patch.enabled = !!params.enabled;
        if (params && params.persist !== undefined) patch.persist = !!params.persist;
        if (params && params.max_memories !== undefined && params.max_memories !== null && params.max_memories !== '') {
            patch.maxMemories = parseInt(params.max_memories, 10);
        }
        var settings = await writeInjectionSettings(patch);
        if (typeof setEnv === 'function') {
            try { setEnv(ENV_KEY_INJECTION, JSON.stringify(settings)); } catch (e) {}
        }
        complete({ success: true, injection: settings });
    } catch (e) {
        complete({ success: false, message: e.message || String(e) });
    }
};

// ===== analyze_saved_messages：从数据库读取对话 → AI 提取结构化数据 =====
// 分批分析消息
async function analyzeMessagesBatch(messages, startIdx, batchSize, endpoint, apiKey, model, existingSummary, personaName) {
    var batch = messages.slice(startIdx, startIdx + batchSize);
    var text = batch.map(function (m) {
        var role = (m.sender === 'user' || m.sender === 'USER') ? '用户' : 'AI';
        var c = (m.content || '').replace(/<attachment[^>]*>[\s\S]*?<\/attachment>/g, '').trim();
        if (!c) return '';
        return '[' + role + '] ' + c;
    }).filter(Boolean).join('\n');

    if (!text || text.length < 10) return null;

    var prompt = buildExtractionPrompt(text, existingSummary, personaName);

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
                { role: 'system', content: '你是一个数据分析助手，只返回JSON格式的结构化数据，不要返回任何其他内容。' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
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

    try {
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
        return JSON.parse(match[0]);
    } catch (e) {
        return null;
    }
}

async function persistParsedToNativeMemory(parsed, callerCardId) {
    var entries = serializeLifeEntries(parsed);
    for (var i = 0; i < entries.length; i++) {
        try {
            await upsertLifeMemory(entries[i], 'character_memory_life_auto');
        } catch (e) { try { console.log('memory_system life Memory.create failed', entries[i].title, String(e)); } catch (_) {} }
    }
    if (!callerCardId) return;
    var roleCategories = ['character', 'relationship', 'preference', 'interaction_rule'];
    for (var rci = 0; rci < roleCategories.length; rci++) {
        var category = roleCategories[rci];
        var roleItems = Array.isArray(parsed[category]) ? parsed[category] : [];
        for (var rii = 0; rii < roleItems.length; rii++) {
            var item = roleItems[rii] || {};
            if (!item.title || !item.content) continue;
            try {
                await Tools.Memory.create({
                    title: '[persona:' + callerCardId + '][' + category + '] ' + item.title,
                    content: item.content,
                    source: 'character_memory_role_auto',
                    folderPath: personaMemoryFolder(callerCardId),
                    tags: 'character_memory,' + category + ',auto,schema_v1',
                    callerCardId: callerCardId
                });
            } catch (e) { try { console.log('memory_system persona Memory.create failed', category, item.title, String(e)); } catch (_) {} }
        }
    }
}

function contactContent(contact) {
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
    (data.contacts || []).forEach(function(c) { if (c.name) entries.push({ title: '联系人: ' + c.name, content: contactContent(c), category: 'contacts', identity: normalizeIdentity(c.name) }); });
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

async function memoryByTitle(title) {
    try {
        var result = await Tools.Memory.getByTitle({ title: title });
        return result && result.memories && result.memories.length ? result.memories[0] : null;
    } catch (e) { return null; }
}

async function upsertLifeMemory(entry, source) {
    var legacy = await memoryByTitle(entry.title);
    if (legacy && String(legacy.content || '') === String(entry.content || '')) return 'skipped';
    var stableTitle = stableLifeTitle(entry);
    var existing = await memoryByTitle(stableTitle);
    if (existing) {
        if (String(existing.content || '') === String(entry.content || '')) return 'skipped';
        await Tools.Memory.update({
            oldTitle: stableTitle,
            content: entry.content,
            source: source,
            folderPath: GLOBAL_MEMORY_FOLDER,
            tags: 'life,' + entry.category + ',auto,schema_v1,reconciled'
        });
        return 'updated';
    }
    await Tools.Memory.create({
        title: stableTitle,
        content: entry.content,
        source: source,
        folderPath: GLOBAL_MEMORY_FOLDER,
        tags: 'life,' + entry.category + ',auto,schema_v1,reconciled'
    });
    return 'created';
}

async function reconcileNativeMemory(force) {
    var marker = await readJson(RECONCILE_FILE, null);
    if (!force && marker && marker.completed) return { skipped: true, created: 0, updated: 0, unchanged: marker.unchanged || 0, failed: 0 };
    var data = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
    var entries = serializeLifeEntries(data);
    var result = { skipped: false, created: 0, updated: 0, unchanged: 0, failed: 0, total: entries.length };
    for (var i = 0; i < entries.length; i++) {
        try {
            var action = await upsertLifeMemory(entries[i], 'character_memory_life_reconciled');
            if (action === 'created') result.created++;
            else if (action === 'updated') result.updated++;
            else result.unchanged++;
        } catch (e) {
            result.failed++;
            try { console.log('memory_system reconcile failed', entries[i].title, String(e)); } catch (_) {}
        }
    }
    if (result.failed === 0) await writeJson(RECONCILE_FILE, { version: 1, completed: true, completedAt: new Date().toISOString(), total: result.total, unchanged: result.unchanged });
    return result;
}

exports.analyze_saved_messages = async function (params) {
    try {
        var chatId = (params && params.chat_id) || '';

        if (!chatId) {
            var preferredPersona = await readJson(PERSONA_FILE, { type: '', id: '', name: '', chatId: '' });
            if (preferredPersona.type === 'character_card' && preferredPersona.chatId) chatId = String(preferredPersona.chatId);
        }

        // 没有角色绑定对话时，尝试获取最近对话。
        if (!chatId) {
            try {
                var chatList = await Tools.Chat.listChats({ sort_by: 'updatedAt', sort_order: 'desc', limit: 1 });
                if (chatList && chatList.chats && chatList.chats.length > 0) {
                    chatId = chatList.chats[0].id;
                }
            } catch (e) {}
        }

        var messages = [];
        if (chatId) {
            try {
                var msgResult = await Tools.Chat.getMessages(chatId, { order: 'asc' });
                if (msgResult && msgResult.messages) {
                    messages = msgResult.messages;
                }
            } catch (e) {}
        }
        
        if (messages.length === 0) {
            complete({ success: false, message: '没有找到对话消息，请确保当前有对话记录' });
            return;
        }
        
        // 过滤空消息和附件
        messages = messages.filter(function(m) {
            var c = (m.content || '').replace(/<attachment[^>]*>[\s\S]*?<\/attachment>/g, '').trim();
            return c && c.length > 0;
        });

        if (messages.length === 0) {
            complete({ success: false, message: '对话内容为空' });
            return;
        }

        var rawEndpoint = getEnv('MEMORY_SYSTEM_ENDPOINT') || '';
        var endpoint = rawEndpoint.replace(/\/+$/, '');
        if (endpoint.indexOf('/chat/completions') < 0) {
            endpoint = endpoint + '/chat/completions';
        }
        var apiKey = getEnv('MEMORY_SYSTEM_KEY');
        var model = getEnv('MEMORY_SYSTEM_MODEL') || 'gpt-4o-mini';
        if (!endpoint || !apiKey) {
            complete({ success: false, message: '未配置API Endpoint或Key' });
            return;
        }

        // 读取已有数据用于去重
        var existingData = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
        var existingSummary = '';
        if (existingData) {
            var ep = [];
            if (existingData.todos && existingData.todos.length > 0) ep.push('已有待办: ' + existingData.todos.map(function(t) { return t.title; }).join('; '));
            if (existingData.events && existingData.events.length > 0) ep.push('已有事件: ' + existingData.events.slice(-10).map(function(e) { return e.title; }).join('; '));
            if (existingData.info && existingData.info.length > 0) ep.push('已有信息: ' + existingData.info.slice(-10).map(function(i) { return i.content; }).join('; '));
            if (existingData.contacts && existingData.contacts.length > 0) ep.push('已有联系人: ' + existingData.contacts.map(function(c) { return c.name; }).join('; '));
            if (ep.length > 0) existingSummary = '\n\n【已有数据——不要重复提取语义相同的内容】\n' + ep.join('\n') + '\n';
        }

        // Token估算函数
        function estimateTokens(text) {
            if (!text) return 0;
            var chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
            var otherChars = text.length - chineseChars;
            return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
        }

        // 读取上下文长度设置（单位KB），默认64k
        var contextLength = parseInt(getEnv('MEMORY_SYSTEM_CONTEXT_LENGTH') || '64', 10) * 1024;
        // 每批token限制 = 上下文长度的80%
        var TOKEN_LIMIT_PER_BATCH = Math.floor(contextLength * 0.8);
        
        var manualPersona = await readJson(PERSONA_FILE, { type: '', id: '', name: '', chatId: '' });
        var manualPersonaMatches = !manualPersona.chatId || String(manualPersona.chatId) === String(chatId);
        var manualCallerCardId = manualPersonaMatches && manualPersona.type === 'character_card' ? String(manualPersona.id || '') : '';
        var manualPersonaName = manualCallerCardId ? String(manualPersona.name || '') : '';

        // 分批处理：按token数量动态计算每批消息
        var allResults = {
            events: [],
            contacts: [],
            info: [],
            finance: [],
            todos: [],
            menstrual: [],
            character: [],
            relationship: [],
            preference: [],
            interaction_rule: [],
            summaries: []
        };
        
        var batchStart = 0;
        while (batchStart < messages.length) {
            // 收集这一批消息，直到达到token限制
            var batchMessages = [];
            var batchTokens = 0;
            var PROMPT_OVERHEAD = 2000; // prompt模板和响应的预估token开销
            
            for (var bi = batchStart; bi < messages.length; bi++) {
                var msg = messages[bi];
                var content = (msg.content || '').replace(/<attachment[^>]*>[\s\S]*?<\/attachment>/g, '').trim();
                var msgTokens = estimateTokens(content);
                
                if (batchTokens + msgTokens > TOKEN_LIMIT_PER_BATCH - PROMPT_OVERHEAD && batchMessages.length > 0) {
                    break; // 达到限制，开始处理
                }
                batchMessages.push(msg);
                batchTokens += msgTokens;
            }
            
            var batchResult = await analyzeMessagesBatch(messages.slice(batchStart, batchStart + batchMessages.length), 0, batchMessages.length, endpoint, apiKey, model, existingSummary, manualPersonaName);
            if (batchResult) {
                if (batchResult.summary) allResults.summaries.push(batchResult.summary);
                if (batchResult.events) allResults.events = allResults.events.concat(batchResult.events);
                if (batchResult.contacts) allResults.contacts = allResults.contacts.concat(batchResult.contacts);
                if (batchResult.info) allResults.info = allResults.info.concat(batchResult.info);
                if (batchResult.finance) allResults.finance = allResults.finance.concat(batchResult.finance);
                if (batchResult.todos) allResults.todos = allResults.todos.concat(batchResult.todos);
                if (batchResult.menstrual) allResults.menstrual = allResults.menstrual.concat(batchResult.menstrual);
                if (batchResult.character) allResults.character = allResults.character.concat(batchResult.character);
                if (batchResult.relationship) allResults.relationship = allResults.relationship.concat(batchResult.relationship);
                if (batchResult.preference) allResults.preference = allResults.preference.concat(batchResult.preference);
                if (batchResult.interaction_rule) allResults.interaction_rule = allResults.interaction_rule.concat(batchResult.interaction_rule);
                
                // 更新 existingSummary 以便后续批次去重
                var batchSummary = [];
                if (batchResult.events && batchResult.events.length > 0) batchSummary.push('本批事件: ' + batchResult.events.map(function(e) { return e.title; }).join('; '));
                if (batchResult.todos && batchResult.todos.length > 0) batchSummary.push('本批待办: ' + batchResult.todos.map(function(t) { return t.title; }).join('; '));
                if (batchSummary.length > 0) {
                    existingSummary = '\n\n【已提取数据——不要重复提取语义相同的内容】\n' + batchSummary.join('\n') + '\n';
                }
            }
            batchStart += batchMessages.length;
        }

        var parsed = allResults;
        var current = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
        if (!current.todos) current.todos = [];
        if (!current.finance) current.finance = [];
        var now = new Date().toISOString();

        if (parsed.events)
            current.events = dedupeLifeEntries(current.events.concat(parsed.events.map(function (e) { e.timestamp = e.timestamp || now; return e; })), 'events');
        if (parsed.contacts)
            current.contacts = mergeContacts(current.contacts, parsed.contacts.map(function (c) { c.timestamp = c.timestamp || now; return c; }));
        if (parsed.info)
            current.info = dedupeLifeEntries(current.info.concat(parsed.info.map(function (i) { i.timestamp = i.timestamp || now; return i; })), 'info');
        if (parsed.finance)
            current.finance = dedupeLifeEntries(current.finance.concat(parsed.finance.map(function (f) { f.timestamp = f.timestamp || now; return f; })), 'finance');
        if (parsed.todos)
            current.todos = dedupeLifeEntries(current.todos.concat(parsed.todos.map(function (t) { t.timestamp = t.timestamp || now; if (t.completed === undefined) t.completed = false; return t; })), 'todos');
        if (parsed.menstrual && parsed.menstrual.length > 0) {
            current.menstrual = current.menstrual.concat(parsed.menstrual.filter(function (m) { return m.startDate; }).map(function (m) { m.timestamp = m.timestamp || now; return m; }));
            var seen = {};
            current.menstrual = current.menstrual.filter(function (m) {
                if (seen[m.startDate]) return false;
                seen[m.startDate] = true;
                return true;
            });
            current.menstrual.sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
        }

        if (current.events.length > 500) current.events.splice(0, current.events.length - 500);
        if (current.contacts.length > 500) current.contacts.splice(0, current.contacts.length - 500);
        if (current.info.length > 500) current.info.splice(0, current.info.length - 500);
        if (current.finance.length > 500) current.finance.splice(0, current.finance.length - 500);
        if (current.todos.length > 500) current.todos.splice(0, current.todos.length - 500);

        await writeJson(EXTRACTED_FILE, current);
        await syncExtractedToEnv();
        await persistParsedToNativeMemory(parsed, manualCallerCardId);

  // 记录已分析的对话
        var analyzedData = await readJson(DATA_DIR + '/analyzed_chats.json', { chats: [] });
        if (!analyzedData.chats) analyzedData.chats = [];
        var chatKey = chatId || 'current';
        if (!analyzedData.chats.includes(chatKey)) {
            analyzedData.chats.push(chatKey);
        }
        analyzedData.chats = analyzedData.chats.slice(-200); // 最多保留200条
        await writeJson(DATA_DIR + '/analyzed_chats.json', analyzedData);

        complete({
            success: true,
            message: '分析完成',
            events: (parsed.events && parsed.events.length) || 0,
            contacts: (parsed.contacts && parsed.contacts.length) || 0,
            info: (parsed.info && parsed.info.length) || 0,
            finance: (parsed.finance && parsed.finance.length) || 0,
            todos: (parsed.todos && parsed.todos.length) || 0,
            character: (parsed.character && parsed.character.length) || 0,
            relationship: (parsed.relationship && parsed.relationship.length) || 0,
            preference: (parsed.preference && parsed.preference.length) || 0,
            interaction_rule: (parsed.interaction_rule && parsed.interaction_rule.length) || 0
        });
    } catch (e) {
        complete({ success: false, message: '出错：' + (e.message || String(e)) });
    }
};

exports.toggle_todo = async function (params) {
    try {
        var idx = params.todo_index;
        var current = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
        if (!current.todos) current.todos = [];
        if (idx < 0 || idx >= current.todos.length) {
            complete({ success: false, message: '索引越界' });
            return;
        }
        current.todos[idx].completed = !current.todos[idx].completed;
        await writeJson(EXTRACTED_FILE, current);
  await syncExtractedToEnv();
  complete({ success: true, message: current.todos[idx].completed ? '已标记完成' : '已取消完成', todo: current.todos[idx] });
    } catch (e) {
        complete({ success: false, message: '出错：' + (e.message || String(e)) });
    }
};

exports.save_todos = async function (params) {
    try {
        var todos = JSON.parse(params.todos_json);
        var current = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
        if (!current.todos) current.todos = [];
        current.todos = todos;
        await writeJson(EXTRACTED_FILE, current);
  await syncExtractedToEnv();
  complete({ success: true, message: '保存成功', count: todos.length });
    } catch (e) {
        complete({ success: false, message: '出错：' + (e.message || String(e)) });
    }
};

exports.sync_to_env = async function (params) {
    try {
        // 如果带了 action 参数，执行删除或编辑
        if (params && params.action) {
            var current = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
            var cat = params.category || '';
            var idx = parseInt(params.index || '-1', 10);
            if (cat && current[cat]) {
                if (params.action === 'delete' && idx >= 0 && idx < current[cat].length) {
                    current[cat].splice(idx, 1);
                    await writeJson(EXTRACTED_FILE, current);
                } else if (params.action === 'upsert') {
                    var data = JSON.parse(params.data_json || '{}');
                    if (idx >= 0 && idx < current[cat].length) {
                        current[cat][idx] = data;
                    } else {
                        if (!data.timestamp) data.timestamp = new Date().toISOString();
                        current[cat].push(data);
                    }
                    await writeJson(EXTRACTED_FILE, current);
                }
            }
        }
  await syncExtractedToEnv();
  complete({ success: true, message: '操作成功' });
    } catch (e) {
        complete({ success: false, message: '操作失败：' + (e.message || String(e)) });
    }
};

exports.delete_extracted_item = async function (params) {
    try {
        var category = params.category || '';
        var index = parseInt(params.index || '-1', 10);
        if (!category || index < 0) {
            complete({ success: false, message: '参数错误' });
            return;
        }
        var current = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
        if (!current[category] || index >= current[category].length) {
            complete({ success: false, message: '索引越界' });
            return;
        }
        current[category].splice(index, 1);
        await writeJson(EXTRACTED_FILE, current);
  await syncExtractedToEnv();
  complete({ success: true, message: '已删除', remaining: current[category].length });
    } catch (e) {
        complete({ success: false, message: '出错：' + (e.message || String(e)) });
    }
};

exports.upsert_extracted_item = async function (params) {
    try {
        var category = params.category || '';
        var dataJson = params.data_json || '{}';
        var indexStr = params.index;
        var data = JSON.parse(dataJson);
        if (!category) {
            complete({ success: false, message: '缺少 category' });
            return;
        }
        var current = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
        if (!current[category]) current[category] = [];
        var now = new Date().toISOString();
        if (indexStr !== undefined && indexStr !== null && indexStr !== '') {
            var idx = parseInt(indexStr, 10);
            if (idx >= 0 && idx < current[category].length) {
                current[category][idx] = data;
            } else {
                complete({ success: false, message: '索引越界' });
                return;
            }
        } else {
            if (!data.timestamp) data.timestamp = now;
            current[category].push(data);
        }
        await writeJson(EXTRACTED_FILE, current);
  await syncExtractedToEnv();
  complete({ success: true, message: '已保存', count: current[category].length });
    } catch (e) {
        complete({ success: false, message: '出错：' + (e.message || String(e)) });
    }
};

exports.debug_get_chat_model = async function () {
    try {
        var rawResult = ctx.callTool('operit_editor:list_model_configs', {});
        var data = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
        var configs = data.data.configs;
        var mappings = data.data.functionMappings;
        var chatBinding = null;
        for (var i = 0; i < mappings.length; i++) {
            if (mappings[i].functionType === 'CHAT') { chatBinding = mappings[i]; break; }
        }
        var chatConfig = null;
        if (chatBinding) {
            for (var j = 0; j < configs.length; j++) {
                if (configs[j].id === chatBinding.configId) { chatConfig = configs[j]; break; }
            }
        }
        complete({
            success: true,
            chatConfigName: chatConfig ? chatConfig.name : null,
            chatEndpoint: chatConfig ? chatConfig.apiEndpoint : null,
            chatModel: chatConfig ? chatConfig.modelName : null,
            apiKeySet: chatConfig ? chatConfig.apiKeySet : null,
            allConfigNames: configs.map(function(c){ return c.name; })
        });
    } catch (e) {
        complete({ success: false, error: e.message, name: e.name });
    }
};

exports.copy_to_clipboard = async function (params) {
    try {
        var text = params.text || '';
        if (Tools.Clipboard && Tools.Clipboard.write) {
            await Tools.Clipboard.write(text);
        } else if (typeof Tools !== 'undefined' && Tools.System && Tools.System.setClipboard) {
            await Tools.System.setClipboard(text);
        } else {
            setEnv('MW_CLIPBOARD_TEXT', text);
        }
        complete({ success: true, message: '已复制到剪贴板' });
    } catch (e) {
        try { setEnv('MW_CLIPBOARD_TEXT', params.text || ''); } catch(e2) {}
        complete({ success: false, message: '剪贴板不可用，已暂存到环境变量' });
    }
};

// ===== create_memory：只写入向量库 =====
exports.create_memory = async function (params) {
    try {
        var title = params.title || '';
        var content = params.content || '';
        var tags = params.tags || '';
        var callerCardId = params.caller_card_id || '';
        var source = params.source || (callerCardId ? 'character_memory_role_manual' : 'character_memory_life_manual');
        var folderPath = personaMemoryFolder(callerCardId);
        if (callerCardId && title.indexOf('[persona:') !== 0) {
            title = '[persona:' + callerCardId + '] ' + title;
        }
        if (!title || !content) {
            complete({ success: false, message: '标题和内容不能为空' });
            return;
        }
        var vectorResult = await Tools.Memory.create({
            title: title,
            content: content,
            source: source,
            folderPath: folderPath,
            tags: tags || undefined,
            callerCardId: callerCardId || undefined
        });
        complete({
            success: !!vectorResult,
            message: '记忆创建成功',
            vectorId: vectorResult ? String(vectorResult) : null
        });
    } catch (e) {
        complete({ success: false, message: '出错：' + (e.message || String(e)) });
    }
};

// ===== load_memories：从向量库查询记忆 =====
exports.load_memories = async function (params) {
    try {
        params = params || {};
        var limit = Math.max(1, Math.min(parseInt(params.limit || '50', 10) || 50, 500));
        var rawQuery = String(params.query == null ? '' : params.query).trim();
        var normalizedQuery = rawQuery.toLowerCase();
        var fullQuery = !normalizedQuery || normalizedQuery === '*' || normalizedQuery === 'all';
        var searchTerms = [];
        if (!fullQuery) {
            var termSeen = {};
            function addTerm(term) {
                term = String(term || '').trim();
                if (term.length < 2 || termSeen[term]) return;
                termSeen[term] = true;
                searchTerms.push(term);
            }
            addTerm(normalizedQuery);
            normalizedQuery.split(/[\s,，。！？、：:；;（）()]+/).forEach(addTerm);
            var compact = normalizedQuery.replace(/[\s,，。！？、：:；;（）()]/g, '');
            var ignored = { '什么': true, '我的': true, '一下': true, '这个': true, '那个': true, '是否': true };
            for (var size = 4; size >= 2; size--) {
                for (var pos = 0; pos + size <= compact.length; pos++) {
                    var fragment = compact.substring(pos, pos + size);
                    if (!ignored[fragment]) addTerm(fragment);
                }
            }
        }
        var callerCardId = String(params.caller_card_id || '').trim();
        var scope = String(params.scope || (callerCardId ? 'persona' : 'global')).toLowerCase();
        if (scope !== 'global' && scope !== 'persona' && scope !== 'all') scope = callerCardId ? 'persona' : 'global';
        if (scope === 'persona' && !callerCardId) {
            complete({ success: false, message: 'persona 查询需要 caller_card_id' });
            return;
        }

        var targets = [];
        if (scope === 'global' || scope === 'all') targets.push({ name: 'global', folderPath: GLOBAL_MEMORY_FOLDER, callerCardId: '' });
        if ((scope === 'persona' || scope === 'all') && callerCardId) targets.push({ name: 'persona', folderPath: personaMemoryFolder(callerCardId), callerCardId: callerCardId });
        if (scope === 'all') targets.push({ name: 'default', folderPath: '', callerCardId: '' });

        var merged = {};
        function addMemory(memory, matchedBy, sourceScope) {
            var title = String(memory.title || '');
            var content = String(memory.content || '');
            var key = title + '|' + content;
            var existing = merged[key];
            if (existing) {
                if (existing.matched_by !== matchedBy) existing.matched_by = 'keyword+native';
                if (Number(memory.score || 0) > existing.score) existing.score = Number(memory.score || 0);
                if (existing.source_scope.indexOf(sourceScope) < 0) existing.source_scope += '+' + sourceScope;
                return;
            }
            merged[key] = {
                id: memory.id || title,
                title: title,
                content: content,
                tags: memory.tags || [],
                timestamp: memory.createdAt || memory.timestamp || '',
                score: Number(memory.score || 0),
                matched_by: matchedBy,
                source_scope: sourceScope
            };
        }

        for (var ti = 0; ti < targets.length; ti++) {
            var target = targets[ti];
            var allResult = await Tools.Memory.query({ query: '*', limit: 500, folderPath: target.folderPath, callerCardId: target.callerCardId || undefined });
            var allMemories = allResult && allResult.memories ? allResult.memories : [];
            if (target.name === 'default') allMemories = allMemories.filter(function(memory) { return String(memory.title || '').indexOf('[persona:') !== 0; });
            // Operit 的通配查询只返回正文前 10 个字符。用原生 getByTitle 分批补全，
            // 保持 Operit Memory 为唯一数据源，同时让本地关键词兜底能够匹配正文后半段。
            for (var hi = 0; hi < allMemories.length; hi += 8) {
                var hydrateBatch = allMemories.slice(hi, hi + 8);
                await Promise.all(hydrateBatch.map(async function(memory) {
                    if (!memory || !memory.title || !/\.\.\.$/.test(String(memory.content || ''))) return;
                    try {
                        var fullResult = await Tools.Memory.getByTitle({
                            title: memory.title,
                            callerCardId: target.callerCardId || undefined
                        });
                        var fullMemories = fullResult && fullResult.memories ? fullResult.memories : [];
                        if (fullMemories.length && String(fullMemories[0].title || '') === String(memory.title)) {
                            memory.content = String(fullMemories[0].content || memory.content || '');
                        }
                    } catch (e) { try { console.log('memory_system content hydration failed', memory.title, String(e)); } catch (_) {} }
                }));
            }
            if (fullQuery) {
                allMemories.forEach(function(memory) { addMemory(memory, 'all', target.name); });
                continue;
            }
            allMemories.forEach(function(memory) {
                var searchable = (String(memory.title || '') + '\n' + String(memory.content || '')).toLowerCase();
                for (var sti = 0; sti < searchTerms.length; sti++) {
                    if (searchable.indexOf(searchTerms[sti]) >= 0) { addMemory(memory, 'keyword', target.name); break; }
                }
            });
            try {
                var vectorResult = await Tools.Memory.query({ query: rawQuery, limit: limit, folderPath: target.folderPath, callerCardId: target.callerCardId || undefined });
                var vectorMemories = vectorResult && vectorResult.memories ? vectorResult.memories : [];
                vectorMemories.forEach(function(memory) { addMemory(memory, 'native', target.name); });
            } catch (e) { try { console.log('memory_system native query failed', target.name, String(e)); } catch (_) {} }
        }

        var memories = Object.keys(merged).map(function(key) { return merged[key]; });
        memories.sort(function(a, b) {
            var ak = a.matched_by.indexOf('keyword') >= 0 ? 1 : 0;
            var bk = b.matched_by.indexOf('keyword') >= 0 ? 1 : 0;
            if (ak !== bk) return bk - ak;
            return b.score - a.score;
        });
        memories = memories.slice(0, limit);
        complete({ success: true, memories: memories, total: memories.length, scope: scope, query: fullQuery ? '*' : rawQuery });
    } catch (e) {
        complete({ success: false, message: '出错：' + (e.message || String(e)) });
    }
};

// ===== delete_memory：从向量库删除 =====
exports.delete_memory = async function (params) {
    try {
        var targetId = params.memory_id || '';
        var targetTitle = params.title || '';
        var callerCardId = params.caller_card_id || '';
        if (!targetId && !targetTitle) {
            complete({ success: false, message: '缺少 memory_id 或 title' });
            return;
        }
        if (targetTitle) {
            await Tools.Memory.deleteMemory({ title: targetTitle, callerCardId: callerCardId || undefined });
        } else if (targetId) {
            await Tools.Memory.deleteMemory({ title: targetId, callerCardId: callerCardId || undefined });
        }
        complete({ success: true, message: '已从向量库删除' });
    } catch (e) {
        complete({ success: false, message: '出错：' + (e.message || String(e)) });
    }
};

// ===== get_analyzed_chats：获取已分析的对话列表 =====
exports.get_analyzed_chats = async function () {
    try {
        var analyzedData = await readJson(DATA_DIR + '/analyzed_chats.json', { chats: [] });
        if (!analyzedData.chats) analyzedData.chats = [];
        complete({ success: true, chats: analyzedData.chats });
    } catch (e) {
        complete({ success: true, chats: [] });
    }
};

// ===== trigger_analysis：侧边栏打开时自动检测+异步分析 =====
// 行为：
//   1) 读取 TRIGGER_STATE_FILE 拿到上次水位线和上次触发时间
//   2) 用 Tools.Chat 拉取最近对话，过滤 timestamp > 水位线 的新消息
//   3) 若新消息 = 0：立即返回 { skipped: true, reason: 'no_new_content' }
//   4) 若有：异步跑 analyzeMessagesBatch（与现有 analyze_saved_messages 完全一致的提交流程），
//          立即返回 { started: true, newMessageCount: N }，不阻塞 UI
//   5) 分析完成后写水位线、写 extracted.json、调 syncExtractedToEnv
async function _runAutoAnalysis(chatId, messages, lastProcessedTs) {
    try {
        var personaContext = await readJson(PERSONA_FILE, { type: '', id: '', name: '' });
        var personaMatchesChat = !personaContext.chatId || String(personaContext.chatId) === String(chatId);
        var callerCardId = personaMatchesChat && personaContext.type === 'character_card' ? String(personaContext.id || '') : '';
        var personaName = callerCardId ? String(personaContext.name || '') : '';
        // 读现有数据用于去重
        var existingData = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
        var existingSummary = '';
        if (existingData) {
            var ep = [];
            if (existingData.todos && existingData.todos.length > 0) ep.push('已有待办: ' + existingData.todos.map(function (t) { return t.title; }).join('; '));
            if (existingData.events && existingData.events.length > 0) ep.push('已有事件: ' + existingData.events.slice(-10).map(function (e) { return e.title; }).join('; '));
            if (existingData.info && existingData.info.length > 0) ep.push('已有信息: ' + existingData.info.slice(-10).map(function (i) { return i.content; }).join('; '));
            if (existingData.contacts && existingData.contacts.length > 0) ep.push('已有联系人: ' + existingData.contacts.map(function (c) { return c.name; }).join('; '));
            if (ep.length > 0) existingSummary = '\n\n【已有数据——不要重复提取语义相同的内容】\n' + ep.join('\n') + '\n';
        }

        var rawEndpoint = getEnv('MEMORY_SYSTEM_ENDPOINT') || '';
        var endpoint = rawEndpoint.replace(/\/+$/, '');
        if (endpoint.indexOf('/chat/completions') < 0) {
            endpoint = endpoint + '/chat/completions';
        }
        var apiKey = getEnv('MEMORY_SYSTEM_KEY');
        var model = getEnv('MEMORY_SYSTEM_MODEL') || 'gpt-4o-mini';

        var allResults = { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [], character: [], relationship: [], preference: [], interaction_rule: [], summaries: [] };
        var processedAny = false;

        if (endpoint && apiKey) {
            // token 估算
            function estimateTokens(text) {
                if (!text) return 0;
                var cn = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
                var other = text.length - cn;
                return Math.ceil(cn / 2) + Math.ceil(other / 4);
            }
            var contextLength = parseInt(getEnv('MEMORY_SYSTEM_CONTEXT_LENGTH') || '64', 10) * 1024;
            var TOKEN_LIMIT_PER_BATCH = Math.floor(contextLength * 0.8);
            var PROMPT_OVERHEAD = 2000;

            // 一次跑完（侧边栏触发场景下消息量不会太大，省去分批逻辑的复杂度）
            var batchMessages = [];
            var batchTokens = 0;
            for (var bi = 0; bi < messages.length; bi++) {
                var content = (messages[bi].content || '').replace(/<attachment[^>]*>[\s\S]*?<\/attachment>/g, '').trim();
                var msgTokens = estimateTokens(content);
                if (batchTokens + msgTokens > TOKEN_LIMIT_PER_BATCH - PROMPT_OVERHEAD && batchMessages.length > 0) break;
                batchMessages.push(messages[bi]);
                batchTokens += msgTokens;
            }

            var batchResult = await analyzeMessagesBatch(messages, 0, batchMessages.length, endpoint, apiKey, model, existingSummary, personaName);
            if (batchResult) {
                processedAny = true;
                if (batchResult.summary) allResults.summaries.push(batchResult.summary);
                if (batchResult.events) allResults.events = allResults.events.concat(batchResult.events);
                if (batchResult.contacts) allResults.contacts = allResults.contacts.concat(batchResult.contacts);
                if (batchResult.info) allResults.info = allResults.info.concat(batchResult.info);
                if (batchResult.finance) allResults.finance = allResults.finance.concat(batchResult.finance);
                if (batchResult.todos) allResults.todos = allResults.todos.concat(batchResult.todos);
                if (batchResult.menstrual) allResults.menstrual = allResults.menstrual.concat(batchResult.menstrual);
                if (batchResult.character) allResults.character = allResults.character.concat(batchResult.character);
                if (batchResult.relationship) allResults.relationship = allResults.relationship.concat(batchResult.relationship);
                if (batchResult.preference) allResults.preference = allResults.preference.concat(batchResult.preference);
                if (batchResult.interaction_rule) allResults.interaction_rule = allResults.interaction_rule.concat(batchResult.interaction_rule);
            }
        }

        var parsed = allResults;
        var hasStructured = (parsed.events && parsed.events.length > 0) ||
                            (parsed.todos && parsed.todos.length > 0) ||
                            (parsed.contacts && parsed.contacts.length > 0) ||
                            (parsed.finance && parsed.finance.length > 0) ||
                            (parsed.info && parsed.info.length > 0) ||
                            (parsed.menstrual && parsed.menstrual.length > 0) ||
                            (parsed.character && parsed.character.length > 0) ||
                            (parsed.relationship && parsed.relationship.length > 0) ||
                            (parsed.preference && parsed.preference.length > 0) ||
                            (parsed.interaction_rule && parsed.interaction_rule.length > 0);

        if (hasStructured) {
            var current = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
            if (!current.todos) current.todos = [];
            if (!current.finance) current.finance = [];
            var isoNow = new Date().toISOString();
            if (parsed.events) current.events = dedupeLifeEntries(current.events.concat(parsed.events.map(function (e) { e.timestamp = e.timestamp || isoNow; return e; })), 'events');
            if (parsed.contacts) current.contacts = mergeContacts(current.contacts, parsed.contacts.map(function (c) { c.timestamp = c.timestamp || isoNow; return c; }));
            if (parsed.info) current.info = dedupeLifeEntries(current.info.concat(parsed.info.map(function (i) { i.timestamp = i.timestamp || isoNow; return i; })), 'info');
            if (parsed.finance) current.finance = dedupeLifeEntries(current.finance.concat(parsed.finance.map(function (f) { f.timestamp = f.timestamp || isoNow; return f; })), 'finance');
            if (parsed.todos) current.todos = dedupeLifeEntries(current.todos.concat(parsed.todos.map(function (t) { t.timestamp = t.timestamp || isoNow; if (t.completed === undefined) t.completed = false; return t; })), 'todos');
            if (parsed.menstrual && parsed.menstrual.length > 0) {
                if (!current.menstrual) current.menstrual = [];
                current.menstrual = current.menstrual.concat(parsed.menstrual.filter(function (m) { return m.startDate; }).map(function (m) { m.timestamp = m.timestamp || isoNow; return m; }));
                var seen = {};
                current.menstrual = current.menstrual.filter(function (m) { if (seen[m.startDate]) return false; seen[m.startDate] = true; return true; });
                current.menstrual.sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
            }
            if (current.events.length > 500) current.events.splice(0, current.events.length - 500);
            if (current.contacts.length > 500) current.contacts.splice(0, current.contacts.length - 500);
            if (current.info.length > 500) current.info.splice(0, current.info.length - 500);
            if (current.finance.length > 500) current.finance.splice(0, current.finance.length - 500);
            if (current.todos.length > 500) current.todos.splice(0, current.todos.length - 500);
            await writeJson(EXTRACTED_FILE, current);
            await syncExtractedToEnv();
        }

        await persistParsedToNativeMemory(parsed, callerCardId);

        // 记录已分析的对话
        try {
            var analyzedData = await readJson(DATA_DIR + '/analyzed_chats.json', { chats: [] });
            if (!analyzedData.chats) analyzedData.chats = [];
            var chatKey = chatId || 'current';
            if (analyzedData.chats.indexOf(chatKey) < 0) analyzedData.chats.push(chatKey);
            analyzedData.chats = analyzedData.chats.slice(-200);
            await writeJson(DATA_DIR + '/analyzed_chats.json', analyzedData);
        } catch (e) {}

        // 推进水位线
        var maxTs = 0;
        for (var mti = 0; mti < messages.length; mti++) {
            if (messages[mti].timestamp && messages[mti].timestamp > maxTs) maxTs = messages[mti].timestamp;
        }
        var stateAfter = await readJson(TRIGGER_STATE_FILE, {});
        if (!stateAfter.watermarks) stateAfter.watermarks = {};
        if (maxTs > 0) stateAfter.watermarks[chatId] = maxTs;
        stateAfter.lastAnalyzedAt = new Date().toISOString();
        stateAfter.lastAnalyzedChatId = chatId || 'current';
        stateAfter.lastAnalyzedNewCount = messages.length;
        stateAfter.lastResult = hasStructured ? 'has_data' : 'no_data';
        stateAfter.callerCardId = callerCardId;
        stateAfter.personaName = personaName;
        await writeJson(TRIGGER_STATE_FILE, stateAfter);

        return { success: true, newMessageCount: messages.length, hasData: hasStructured };
    } catch (e) {
        return { success: false, error: e.message || String(e) };
    }
}

exports.trigger_analysis = async function (params) {
    try {
        var chatId = (params && params.chat_id) || '';

        // 未指定时优先分析当前角色卡绑定的对话，避免把其他会话归入当前角色。
        if (!chatId) {
            var activePersona = await readJson(PERSONA_FILE, { type: '', id: '', name: '', chatId: '' });
            if (activePersona.type === 'character_card' && activePersona.chatId) chatId = String(activePersona.chatId);
        }

        // 没有角色绑定对话时再选择最近对话。
        if (!chatId) {
            try {
                var chatList = await Tools.Chat.listChats({ sort_by: 'updatedAt', sort_order: 'desc', limit: 1 });
                if (chatList && chatList.chats && chatList.chats.length > 0) {
                    chatId = chatList.chats[0].id;
                }
            } catch (e) {}
        }

        if (!chatId) {
            complete({ success: false, skipped: true, reason: 'no_chat', message: '未找到最近对话' });
            return;
        }

        // 拉消息
        var allMessages = [];
        try {
            var msgResult = await Tools.Chat.getMessages(chatId, { order: 'asc', limit: 500 });
            if (msgResult && msgResult.messages) allMessages = msgResult.messages;
        } catch (e) {}

        // 过滤掉空消息和附件
        allMessages = allMessages.filter(function (m) {
            var c = (m.content || '').replace(/<attachment[^>]*>[\s\S]*?<\/attachment>/g, '').trim();
            return c && c.length > 0;
        });

        // ===== 核心：用上次水位线过滤新消息 =====
        var triggerState = await readJson(TRIGGER_STATE_FILE, { lastProcessedTs: 0, lastAnalyzedAt: null });
        var triggerPersona = await readJson(PERSONA_FILE, { type: '', id: '', name: '', chatId: '' });
        var triggerPersonaMatches = !triggerPersona.chatId || String(triggerPersona.chatId) === String(chatId);
        triggerState.callerCardId = triggerPersonaMatches && triggerPersona.type === 'character_card' ? String(triggerPersona.id || '') : '';
        triggerState.personaName = triggerState.callerCardId ? String(triggerPersona.name || '') : '';
        var lastProcessedTs = analysisWatermark(triggerState, chatId);
        var newMessages = allMessages;
        if (lastProcessedTs) {
            newMessages = allMessages.filter(function (m) { return m.timestamp > lastProcessedTs; });
        }

        if (newMessages.length === 0) {
            // 没有新内容：更新一下 lastAnalyzedAt（标记"已检测过"），但不动水位线
            triggerState.lastCheckedAt = new Date().toISOString();
            triggerState.lastCheckedChatId = chatId;
            await writeJson(TRIGGER_STATE_FILE, triggerState);
            complete({
                success: true,
                skipped: true,
                reason: 'no_new_content',
                lastProcessedTs: lastProcessedTs,
                lastAnalyzedAt: triggerState.lastAnalyzedAt || null,
                message: '没有新内容，跳过分析'
            });
            return;
        }

        // 有新内容：异步启动分析，立即返回，不阻塞 UI
        (function () {
            _runAutoAnalysis(chatId, newMessages, lastProcessedTs).then(function (r) {
                try {
                    setEnv('MEMORY_SYSTEM_TRIGGER_RESULT', JSON.stringify({
                        finishedAt: new Date().toISOString(),
                        chatId: chatId,
                        newMessageCount: newMessages.length,
                        success: !!(r && r.success),
                        hasData: !!(r && r.hasData),
                        error: r && r.error ? r.error : null
                    }));
                } catch (e) {}
            }).catch(function (e) {
                try {
                    setEnv('MEMORY_SYSTEM_TRIGGER_RESULT', JSON.stringify({
                        finishedAt: new Date().toISOString(),
                        chatId: chatId,
                        newMessageCount: newMessages.length,
                        success: false,
                        error: e && (e.message || String(e))
                    }));
                } catch (e2) {}
            });
        })();

        complete({
            success: true,
            started: true,
            chatId: chatId,
            newMessageCount: newMessages.length,
            lastProcessedTs: lastProcessedTs,
            message: '已异步启动分析 ' + newMessages.length + ' 条新消息'
        });
    } catch (e) {
        complete({ success: false, error: e.message || String(e) });
    }
};
