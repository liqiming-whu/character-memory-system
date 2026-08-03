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
                { "name": "tags", "type": "string", "required": false, "description": "标签，逗号分隔" }
            ]
        },
        {
  "name": "load_memories",
"description": { "zh": "从向量库查询记忆", "en": "Query memories from vector store" },
"parameters": [
{ "name": "limit", "type": "integer", "required": false, "description": "最大返回数量，默认50" },
{ "name": "query", "type": "string", "required": false, "description": "搜索查询，不传则返回全部" }
]
},
        {
            "name": "delete_memory",
            "description": { "zh": "从向量库删除记忆", "en": "Delete a memory from vector store" },
            "parameters": [
                { "name": "memory_id", "type": "string", "required": false, "description": "记忆ID或标题" },
                { "name": "title", "type": "string", "required": false, "description": "记忆标题（可选，用于删除向量库记录" }
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
var DATA_DIR = '/sdcard/Download/Operit/memory_system_data';
var EXTRACTED_FILE = DATA_DIR + '/extracted.json';
var MEMORY_FILE = DATA_DIR + '/memories.json';
var UI_STATE_FILE = DATA_DIR + '/last_ui_state.json';
var UI_STATE_ENV = 'MEMORY_SYSTEM_UI_STATE_FILE';
// ===== UI 触发的"分析触发器"状态文件 =====
// 与 main.js 的 trigger.json 隔离，专门记录侧边栏自动分析的检测/水位线
var TRIGGER_STATE_FILE = DATA_DIR + '/trigger_state.json';
var ENV_KEY_CONTACTS = 'MW_DATA_CONTACTS';
var ENV_KEY_INFO = 'MW_DATA_INFO';
var ENV_KEY_FINANCE = 'MW_DATA_FINANCE';
var ENV_KEY_TODOS = 'MW_DATA_TODOS';
var ENV_KEY_MENSTRUAL = 'MW_DATA_MENSTRUAL';
var ENV_KEY_TIMESTAMP = 'MW_DATA_TIMESTAMP';

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

// ===== load_saved_data：只返回 extracted + memories =====
exports.load_saved_data = async function () {
    try {
        var ext = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
        if (!ext.todos) ext.todos = [];
        if (!ext.finance) ext.finance = [];
        var memories = await readJson(MEMORY_FILE, []);
        var uiState = await readUiState();
        complete({ success: true, extracted: ext, memories: memories, uiState: uiState });
    } catch (e) {
        complete({ success: false, message: e.message || String(e) });
    }
};

// ===== analyze_saved_messages：从数据库读取对话 → AI 提取结构化数据 =====
// 分批分析消息
async function analyzeMessagesBatch(messages, startIdx, batchSize, endpoint, apiKey, model, existingSummary) {
    var batch = messages.slice(startIdx, startIdx + batchSize);
    var text = batch.map(function (m) {
        var role = (m.sender === 'user' || m.sender === 'USER') ? '用户' : 'AI';
        var c = (m.content || '').replace(/<attachment[^>]*>[\s\S]*?<\/attachment>/g, '').trim();
        if (!c) return '';
        return '[' + role + '] ' + c;
    }).filter(Boolean).join('\n');

    if (!text || text.length < 10) return null;

    var prompt = '你是一个记忆系统。请理解以下对话整体讲了什么，然后提取有价值的信息。\n\n核心原则：\n- 你是在理解一段对话后做总结，不是逐条扫描消息\n- 一段对话可能只产生0-2条有价值的提取，这是正常的\n- 过程噪音（反复调试、重复提问、工具调用细节）不要提取\n- 无效信息（"继续""好的""开始"等）完全忽略\n- 如果与已有数据语义重复，不要重复提取\n' + existingSummary + '\n返回纯JSON（不要markdown代码块，不要任何额外文字）：\n{"summary":"对话核心内容的精炼总结（保留有价值的信息、决策、结论。如果对话没有保留价值，留空字符串）","events":[{"type":"activity|schedule|observation|milestone|mood","title":"标题","description":"描述","importance":"high|medium|low","date":"YYYY-MM-DD","time":"HH:MM"}],"todos":[{"title":"待办事项","description":"描述","priority":"high|medium|low","dueDate":"YYYY-MM-DD或null","completed":false}],"contacts":[{"name":"姓名","relation":"friend|family|colleague|classmate|service|other","attributes":[{"key":"属性名","value":"值"}],"context":"提到这个人的场景"}],"info":[{"category":"类别","content":"内容"}],"finance":[{"type":"expense|income","category":"类别","amount":0,"description":"描述","date":"YYYY-MM-DD"}],"menstrual":[{"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD或null","symptoms":"症状描述"}]}\n\n提取规则：\n1. events：有记录价值的事件。activity=做了什么事；schedule=有时间安排的事；observation=发现的现象；milestone=阶段性变化；mood=情绪\n2. todos：用户明确要做的事（"记得""要去""得买"等），不是已经做完的事\n3. contacts：提到的人物及其属性（生日/手机/喜好等）\n4. info：值得记住的知识/事实/参数（路径、密码提示、知识点等）\n5. finance：涉及花钱或收钱的记录\n6. menstrual：用户提到的经期记录，包括开始和结束日期及伴随症状\n7. 某类没数据用空数组\n8. 同一件事不要拆成多条——"侧边栏一直转圈，反复调试"是1个事件不是6个\n\n对话内容：\n' + text;

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

exports.analyze_saved_messages = async function (params) {
    try {
        var chatId = (params && params.chat_id) || '';
        
        // 如果没有传 chat_id，尝试获取最近对话
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
        
        // 分批处理：按token数量动态计算每批消息
        var allResults = {
            events: [],
            contacts: [],
            info: [],
            finance: [],
            todos: [],
            menstrual: [],
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
            
            var batchResult = await analyzeMessagesBatch(messages.slice(batchStart, batchStart + batchMessages.length), 0, batchMessages.length, endpoint, apiKey, model, existingSummary);
            if (batchResult) {
                if (batchResult.summary) allResults.summaries.push(batchResult.summary);
                if (batchResult.events) allResults.events = allResults.events.concat(batchResult.events);
                if (batchResult.contacts) allResults.contacts = allResults.contacts.concat(batchResult.contacts);
                if (batchResult.info) allResults.info = allResults.info.concat(batchResult.info);
                if (batchResult.finance) allResults.finance = allResults.finance.concat(batchResult.finance);
                if (batchResult.todos) allResults.todos = allResults.todos.concat(batchResult.todos);
                if (batchResult.menstrual) allResults.menstrual = allResults.menstrual.concat(batchResult.menstrual);
                
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
            current.events = current.events.concat(parsed.events.map(function (e) { e.timestamp = e.timestamp || now; return e; }));
        if (parsed.contacts)
            current.contacts = mergeContacts(current.contacts, parsed.contacts.map(function (c) { c.timestamp = c.timestamp || now; return c; }));
        if (parsed.info)
            current.info = current.info.concat(parsed.info.map(function (i) { i.timestamp = i.timestamp || now; return i; }));
        if (parsed.finance)
            current.finance = current.finance.concat(parsed.finance.map(function (f) { f.timestamp = f.timestamp || now; return f; }));
        if (parsed.todos)
            current.todos = current.todos.concat(parsed.todos.map(function (t) { t.timestamp = t.timestamp || now; if (t.completed === undefined) t.completed = false; return t; }));
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
            todos: (parsed.todos && parsed.todos.length) || 0
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
        if (!title || !content) {
            complete({ success: false, message: '标题和内容不能为空' });
            return;
        }
        var vectorResult = await Tools.Memory.create({
            title: title,
            content: content,
            tags: tags ? tags.split(',').map(function(t){ return t.trim(); }).filter(Boolean) : undefined
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
        var limit = parseInt(params.limit || '50', 10);
        var queryText = params.query || '*';
        var results = await Tools.Memory.query({
            query: queryText,
            limit: limit
        });
        var memories = [];
        if (results && results.memories) {
            memories = results.memories.map(function(m) {
                return {
                    id: m.id || m.title || '',
                    title: m.title || '',
                    content: m.content || '',
                    tags: m.tags || [],
                    timestamp: m.createdAt || m.timestamp || '',
                    score: m.score || 0
                };
            });
        }
        complete({ success: true, memories: memories, total: memories.length });
    } catch (e) {
        complete({ success: false, message: '出错：' + (e.message || String(e)) });
    }
};

// ===== delete_memory：从向量库删除 =====
exports.delete_memory = async function (params) {
    try {
        var targetId = params.memory_id || '';
        var targetTitle = params.title || '';
        if (!targetId && !targetTitle) {
            complete({ success: false, message: '缺少 memory_id 或 title' });
            return;
        }
        if (targetTitle) {
            try { await Tools.Memory.deleteMemory(targetTitle); } catch(e) {}
        } else if (targetId) {
            try { await Tools.Memory.deleteMemory(targetId); } catch(e) {}
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

        var allResults = { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [], summaries: [] };
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

            var batchResult = await analyzeMessagesBatch(messages, 0, batchMessages.length, endpoint, apiKey, model, existingSummary);
            if (batchResult) {
                processedAny = true;
                if (batchResult.summary) allResults.summaries.push(batchResult.summary);
                if (batchResult.events) allResults.events = allResults.events.concat(batchResult.events);
                if (batchResult.contacts) allResults.contacts = allResults.contacts.concat(batchResult.contacts);
                if (batchResult.info) allResults.info = allResults.info.concat(batchResult.info);
                if (batchResult.finance) allResults.finance = allResults.finance.concat(batchResult.finance);
                if (batchResult.todos) allResults.todos = allResults.todos.concat(batchResult.todos);
                if (batchResult.menstrual) allResults.menstrual = allResults.menstrual.concat(batchResult.menstrual);
            }
        }

        var parsed = allResults;
        var hasStructured = (parsed.events && parsed.events.length > 0) ||
                            (parsed.todos && parsed.todos.length > 0) ||
                            (parsed.contacts && parsed.contacts.length > 0) ||
                            (parsed.finance && parsed.finance.length > 0) ||
                            (parsed.info && parsed.info.length > 0) ||
                            (parsed.menstrual && parsed.menstrual.length > 0);

        if (hasStructured) {
            var current = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
            if (!current.todos) current.todos = [];
            if (!current.finance) current.finance = [];
            var isoNow = new Date().toISOString();
            if (parsed.events) current.events = current.events.concat(parsed.events.map(function (e) { e.timestamp = e.timestamp || isoNow; return e; }));
            if (parsed.contacts) current.contacts = mergeContacts(current.contacts, parsed.contacts.map(function (c) { c.timestamp = c.timestamp || isoNow; return c; }));
            if (parsed.info) current.info = current.info.concat(parsed.info.map(function (i) { i.timestamp = i.timestamp || isoNow; return i; }));
            if (parsed.finance) current.finance = current.finance.concat(parsed.finance.map(function (f) { f.timestamp = f.timestamp || isoNow; return f; }));
            if (parsed.todos) current.todos = current.todos.concat(parsed.todos.map(function (t) { t.timestamp = t.timestamp || isoNow; if (t.completed === undefined) t.completed = false; return t; }));
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
        if (maxTs > 0) stateAfter.lastProcessedTs = maxTs;
        stateAfter.lastAnalyzedAt = new Date().toISOString();
        stateAfter.lastAnalyzedChatId = chatId || 'current';
        stateAfter.lastAnalyzedNewCount = messages.length;
        stateAfter.lastResult = hasStructured ? 'has_data' : 'no_data';
        await writeJson(TRIGGER_STATE_FILE, stateAfter);

        return { success: true, newMessageCount: messages.length, hasData: hasStructured };
    } catch (e) {
        return { success: false, error: e.message || String(e) };
    }
}

exports.trigger_analysis = async function (params) {
    try {
        var chatId = (params && params.chat_id) || '';

        // 找最近对话（如果不传）
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
        var lastProcessedTs = triggerState.lastProcessedTs || 0;
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