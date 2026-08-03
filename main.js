"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerToolPkg = registerToolPkg;
exports.onPromptInput = onPromptInput;
exports.onInputMenuToggle = onInputMenuToggle;
exports.onPromptFinalize = onPromptFinalize;

var DATA_DIR = '/sdcard/Download/Operit/memory_system_data';
var TRIGGER_FILE = DATA_DIR + '/trigger.json';
var EXTRACTED_FILE = DATA_DIR + '/extracted.json';
var MEMORY_FILE = DATA_DIR + '/memories.json';
var COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2小时冷却期

function ensureDir() {
  try { Tools.Files.makeDirectory(DATA_DIR, true); } catch (e) {}
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
function buildTopicCheckPrompt(dialogText, chatIdChanged) {
  var hint = chatIdChanged
    ? '\n注意：用户已经切换到了不同的对话窗口，这强烈暗示之前的对话可能已经结束。'
    : '';
  return '请判断以下对话的话题是否已经结束（用户很可能不会再继续这个话题了）。' + hint + '\n\n对话内容：\n' + dialogText + '\n\n请返回纯JSON（不要markdown代码块）：\n{"topicEnded": true或false, "reason": "简要理由"}';
}

function buildExtractionPrompt(dialogText, existingData) {
  var existingSummary = '';
  if (existingData) {
    var parts = [];
    if (existingData.todos && existingData.todos.length > 0) {
      parts.push('已有待办: ' + existingData.todos.map(function(t) { return t.title; }).join('; '));
    }
    if (existingData.events && existingData.events.length > 0) {
      parts.push('已有事件: ' + existingData.events.slice(-10).map(function(e) { return e.title; }).join('; '));
    }
    if (existingData.info && existingData.info.length > 0) {
      parts.push('已有信息: ' + existingData.info.slice(-10).map(function(i) { return i.content; }).join('; '));
    }
    if (existingData.contacts && existingData.contacts.length > 0) {
      parts.push('已有联系人: ' + existingData.contacts.map(function(c) { return c.name; }).join('; '));
    }
    if (parts.length > 0) existingSummary = '\n\n【已有数据——不要重复提取语义相同的内容】\n' + parts.join('\n') + '\n';
  }

  return '你是一个记忆系统。请理解以下对话整体讲了什么，然后提取有价值的信息。\n\n核心原则：\n- 你是在理解一段对话后做总结，不是逐条扫描消息\n- 一段对话可能只产生0-2条有价值的提取，这是正常的\n- 过程噪音（反复调试、重复提问、工具调用细节）不要提取\n- 无效信息（"继续""好的""开始"等）完全忽略\n- 如果与已有数据语义重复，不要重复提取\n' + existingSummary + '\n返回纯JSON（不要markdown代码块）：\n{"events":[{"type":"activity|schedule|observation|milestone|mood","title":"标题","description":"描述","importance":"high|medium|low","date":"YYYY-MM-DD","time":"HH:MM"}],"todos":[{"title":"待办事项","description":"描述","priority":"high|medium|low","dueDate":"YYYY-MM-DD或null","completed":false}],"contacts":[{"name":"姓名","relation":"friend|family|colleague|classmate|service|other","attributes":[{"key":"属性名","value":"值"}],"context":"提到这个人的场景"}],"info":[{"category":"类别","content":"内容"}],"finance":[{"type":"expense|income","category":"类别","amount":0,"description":"描述","date":"YYYY-MM-DD"}],"menstrual":[{"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD或null","symptoms":"症状描述"}]}\n\n提取规则：\n1. events：有记录价值的事件。activity=做了什么事；schedule=有时间安排的事；observation=发现的现象；milestone=阶段性变化；mood=情绪\n2. todos：用户明确要做的事（"记得""要去""得买"等），不是已经做完的事\n3. contacts：提到的人物及其属性（生日/手机/喜好等）\n4. info：值得记住的知识/事实/参数（路径、密码提示、知识点等）\n5. finance：涉及花钱或收钱的记录\n6. menstrual：用户提到的经期记录，包括开始和结束日期及伴随症状\n7. 某类没数据用空数组\n8. 同一件事不要拆成多条——"侧边栏一直转圈，反复调试"是1个事件不是6个\n\n对话内容：\n' + dialogText;
}

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
async function processCooldown(processChatId, chatIdChanged, lastProcessedTs) {
  try {
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
        return m.timestamp > lastProcessedTs;
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
    if (!topicRaw) return;

    var topicData = null;
    try { topicData = JSON.parse(topicRaw); } catch (e) { return; }

    if (!topicData.topicEnded) {
      // 话题继续，不处理，等下次冷却期
      return;
    }

    // === 第二步：AI 摘要 + 结构化提取（完整调用） ===
    var extractRaw = await callAI(buildExtractionPrompt(dialogText), 0.3);
    if (!extractRaw) return;

    var extractData = null;
    try { extractData = JSON.parse(extractRaw); } catch (e) { return; }

    var now = Date.now();

    // === 写入结构化数据到 extracted.json ===
    var hasStructured = (extractData.events && extractData.events.length > 0) ||
                        (extractData.todos && extractData.todos.length > 0) ||
                        (extractData.contacts && extractData.contacts.length > 0) ||
                        (extractData.finance && extractData.finance.length > 0) ||
                        (extractData.info && extractData.info.length > 0) ||
                        (extractData.menstrual && extractData.menstrual.length > 0);

    if (hasStructured) {
      var current = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
      if (!current.todos) current.todos = [];
      if (!current.finance) current.finance = [];
      var isoNow = new Date().toISOString();

      if (extractData.events) {
        current.events = current.events.concat(extractData.events.map(function(e) { e.timestamp = e.timestamp || isoNow; return e; }));
      }
      if (extractData.contacts) {
        current.contacts = mergeContacts(current.contacts, extractData.contacts.map(function(c) { c.timestamp = c.timestamp || isoNow; return c; }));
      }
      if (extractData.info) {
        current.info = current.info.concat(extractData.info.map(function(i) { i.timestamp = i.timestamp || isoNow; return i; }));
      }
      if (extractData.finance) {
        current.finance = current.finance.concat(extractData.finance.map(function(f) { f.timestamp = f.timestamp || isoNow; return f; }));
      }
      if (extractData.todos) {
        current.todos = current.todos.concat(extractData.todos.map(function(t) {
          t.timestamp = t.timestamp || isoNow;
          if (t.completed === undefined) t.completed = false;
          return t;
        }));
      }
      if (extractData.menstrual && extractData.menstrual.length > 0) {
        if (!current.menstrual) current.menstrual = [];
        current.menstrual = current.menstrual.concat(extractData.menstrual.filter(function(m) { return m.startDate; }).map(function(m) { m.timestamp = m.timestamp || isoNow; return m; }));
        var menstrualSeen = {};
        current.menstrual = current.menstrual.filter(function(m) {
          if (menstrualSeen[m.startDate]) return false;
          menstrualSeen[m.startDate] = true;
          return true;
        });
        current.menstrual.sort(function(a, b) { return a.startDate.localeCompare(b.startDate); });
      }

      if (current.events.length > 500) current.events.splice(0, current.events.length - 500);
      if (current.contacts.length > 500) current.contacts.splice(0, current.contacts.length - 500);
      if (current.info.length > 500) current.info.splice(0, current.info.length - 500);
      if (current.finance.length > 500) current.finance.splice(0, current.finance.length - 500);
      if (current.todos.length > 500) current.todos.splice(0, current.todos.length - 500);

      await writeJson(EXTRACTED_FILE, current);

      // === extracted 条目直接入向量库（取代旧 memories.json 方案）===
      try {
        var vecEntries = [];
        if (extractData.events) extractData.events.forEach(function(e) {
          if (e.title) vecEntries.push({ title: '事件: ' + e.title, content: (e.description || '') + (e.date ? ' (' + e.date + ')' : '') });
        });
        if (extractData.info) extractData.info.forEach(function(i) {
          if (i.content) vecEntries.push({ title: '信息: ' + (i.category || ''), content: i.content });
        });
        if (extractData.contacts) extractData.contacts.forEach(function(c) {
          if (c.name) vecEntries.push({ title: '联系人: ' + c.name, content: c.context || (c.relation || '') });
        });
        if (extractData.finance) extractData.finance.forEach(function(f) {
          if (f.description) vecEntries.push({ title: (f.type === 'income' ? '收入' : '支出') + ': ' + f.description, content: String(f.amount || '') + (f.date ? ' (' + f.date + ')' : '') });
        });
        if (extractData.todos) extractData.todos.forEach(function(t) {
          if (t.title) vecEntries.push({ title: '待办: ' + t.title, content: t.description || '' });
        });
        if (extractData.menstrual) extractData.menstrual.forEach(function(m) {
          if (m.startDate) vecEntries.push({ title: '经期: ' + m.startDate, content: '经期记录 ' + m.startDate + (m.endDate ? ' ~ ' + m.endDate : '') + (m.symptoms ? ' ' + m.symptoms : '') });
        });
        for (var vei = 0; vei < vecEntries.length; vei++) {
          try {
            await Tools.Memory.create({
              title: vecEntries[vei].title,
              content: vecEntries[vei].content,
              source: 'memory_system_auto',
              tags: 'auto'
            });
          } catch(ve) {}
        }
      } catch(e) {}
    }

    // === 处理成功：更新水位线 ===
    var maxTs = 0;
    for (var mti = 0; mti < messages.length; mti++) {
      if (messages[mti].timestamp && messages[mti].timestamp > maxTs) {
        maxTs = messages[mti].timestamp;
      }
    }
    if (maxTs > 0) {
      var triggerAfter = await readJson(TRIGGER_FILE, {});
      triggerAfter.lastProcessedTs = maxTs;
      await writeJson(TRIGGER_FILE, triggerAfter);
    }
  } catch (e) {}
}

// ===== onPromptInput：不再暂存内容，只做 source 过滤透传 =====
async function onPromptInput(input) {
  return null;
}

// ===== onPromptFinalize：冷却期检查 + AI 处理 + 向量检索注入 =====
async function onPromptFinalize(input) {
  var stage = String(input.eventPayload.stage ?? input.eventName ?? "");
  if (stage !== "before_send_to_model") return null;

  try {
    ensureDir();
    var now = Date.now();
    var currentChatId = String(input.eventPayload.chatId || "").trim();
    // === 冷却期检查 ===
    var trigger = await readJson(TRIGGER_FILE, null);

    if (!trigger) {
      // 首次初始化
      await writeJson(TRIGGER_FILE, { chatId: currentChatId, cooldownStart: now });
    } else {
      var cooldownPassed = (now - (trigger.cooldownStart || now)) >= COOLDOWN_MS;
      var processChatId = trigger.chatId || currentChatId;
      var chatIdChanged = trigger.chatId && trigger.chatId !== currentChatId;

      if (cooldownPassed) {
        // 冷却期到了：先异步处理旧对话，再重置计时器
        var lastTs = trigger.lastProcessedTs || 0;
        processCooldown(processChatId, chatIdChanged, lastTs).catch(function() {});
      }

      // 每条消息都刷新冷却计时器 = 记录"最后活跃时间"
      // 同时保留 lastProcessedTs（只有 processCooldown 内部才会更新它）
      await writeJson(TRIGGER_FILE, {
        chatId: currentChatId,
        cooldownStart: now,
        lastProcessedTs: trigger.lastProcessedTs || 0
      });
    }

    // === 向量检索注入 systemPrompt ===
    var userInput = String(input.eventPayload.processedInput || input.eventPayload.rawInput || "").replace(/<attachment[^>]*>[\s\S]*?<\/attachment>/g, "").trim();
    if (userInput && userInput.length > 1) {
      var injectedText = "";

      try {
        var vectorResults = await Tools.Memory.query({
          query: userInput,
          limit: 3,
          threshold: 0.5
        });
        if (vectorResults && vectorResults.memories && vectorResults.memories.length > 0) {
          injectedText = "\n\n[相关记忆]\n" + vectorResults.memories.map(function(m) {
            var c = m.content.length > 200 ? m.content.substring(0, 200) + '...' : m.content;
            return "- " + m.title + ": " + c;
          }).join("\n") + "\n[/相关记忆]";
        }
      } catch (ve) {
        // 向量库不可用时，用 extracted.json 做关键词回退
        try {
          var fallbackData = await readJson(EXTRACTED_FILE, { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] });
          var allItems = [];
          (fallbackData.events || []).forEach(function(e) { allItems.push({ title: '事件: ' + (e.title || ''), content: (e.description || '') }); });
          (fallbackData.info || []).forEach(function(i) { allItems.push({ title: '信息: ' + (i.category || ''), content: i.content || '' }); });
          (fallbackData.contacts || []).forEach(function(c) { allItems.push({ title: '联系人: ' + (c.name || ''), content: c.contexts ? c.contexts.map(function(ct) { return ct.text; }).join('; ') : '' }); });
          if (allItems.length > 0) {
            var inputLower2 = userInput.toLowerCase();
            var inputWords2 = inputLower2.split(/[\s,，。！？、]+/).filter(function(w) { return w.length > 1; });
            var matched = [];
            for (var fi = 0; fi < allItems.length; fi++) {
              var searchable2 = ((allItems[fi].title || '') + ' ' + (allItems[fi].content || '')).toLowerCase();
              for (var fw = 0; fw < inputWords2.length; fw++) {
                if (searchable2.indexOf(inputWords2[fw]) >= 0) { matched.push(allItems[fi]); break; }
              }
            }
            if (matched.length > 0) {
              injectedText = "\n\n[相关记忆]\n" + matched.slice(0, 5).map(function(m) {
                return "- " + m.title + ": " + (m.content || '').substring(0, 200);
              }).join("\n") + "\n[/相关记忆]";
            }
          }
        } catch(fe) {}
      }

      if (injectedText) {
        var currentSystemPrompt = input.eventPayload.systemPrompt || "";
        return {
          systemPrompt: currentSystemPrompt + injectedText
        };
      }
    }
  } catch (e) {}
  return null;
}

// ===== InputMenuToggle：选中内容一键存记忆 =====
var _saveToggleChecked = false;

function onInputMenuToggle(params) {
  var action = params.action;
  if (action === "create") {
    return {
      toggles: [
        {
          id: "memory_system_save",
          title: "存入记忆",
          description: "将选中内容保存到记忆库",
          icon: "bookmark_add",
          isChecked: _saveToggleChecked,
          slot: "general"
        }
      ]
    };
  }
  if (action === "toggle" && params.toggleId === "memory_system_save") {
    _saveToggleChecked = !_saveToggleChecked;
    if (_saveToggleChecked) {
      (async function() {
        try {
          ensureDir();
          var selectedText = getEnv("MEMORY_SYSTEM_SELECTED_TEXT") || "";
          if (selectedText && selectedText.trim().length > 0) {
            var trimmedText = selectedText.trim();
            var firstLine = trimmedText.split("\n")[0];
            var memTitle = "手动记忆: " + (firstLine.length > 30 ? firstLine.substring(0, 30) + "..." : firstLine);
            var vectorOk = false;
            try {
              await Tools.Memory.create({
                title: memTitle,
                content: trimmedText,
                source: "memory_system_manual",
                tags: "manual"
              });
              vectorOk = true;
            } catch(ve) {}
            setEnv("MEMORY_SYSTEM_SAVE_SUCCESS", vectorOk ? "1" : "0");
          }
        } catch (e) {}
      })();
    }
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
    route: "toolpkg:com.operit.memory_system:ui:memory_system_ui",
    surface: "main_sidebar_plugins",
    title: { zh: "记忆系统", en: "Memory System" },
    icon: "memory",
    order: 50
  });

  ToolPkg.registerUiRoute({
    id: "todo_widget",
    route: "toolpkg:com.operit.memory_system:ui:todo_widget",
    runtime: "compose_dsl",
    screen: todo_widget_screen_js_1.default,
    params: {},
    title: { zh: "待办事项小组件", en: "Todo Widget" }
  });

  ToolPkg.registerUiRoute({
    id: "contacts_ui",
    route: "toolpkg:com.operit.memory_system:ui:contacts_ui",
    runtime: "compose_dsl",
    screen: contacts_ui_js_1.default,
    params: {},
    title: { zh: "人际关系", en: "Contacts & Relations" }
  });

  ToolPkg.registerNavigationEntry({
    id: "contacts_nav",
    route: "toolpkg:com.operit.memory_system:ui:contacts_ui",
    surface: "main_sidebar_plugins",
    title: { zh: "人际关系", en: "Contacts & Relations" },
    icon: "diversity_3",
    order: 51
  });

  ToolPkg.registerDesktopWidget({
    id: "memory_system_todo_widget",
    route: "toolpkg:com.operit.memory_system:ui:memory_system_ui",
    render: "toolpkg:com.operit.memory_system:ui:todo_widget",
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