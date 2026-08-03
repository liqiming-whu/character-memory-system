"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Screen;

const shared = require("./shared");
const { relationMap, parseResult, pad2 } = shared;
const overviewTab = require("./tabs/overview");
const todosTab = require("./tabs/todos");
const timelineTab = require("./tabs/timeline");
const knowledgeTab = require("./tabs/knowledge");
const contactsTab = require("./tabs/contacts");
const messagesTab = require("./tabs/messages"); // 预留：消息Tab

// ===== Tab 注册表 =====
const TAB_REGISTRY = [
  { id: 0, icon: 'dashboard',     label: '概览',   color: '#4CAF50' },
  { id: 1, icon: 'checklist',     label: '待办',   color: '#FF5722' },
  { id: 2, icon: 'timeline',      label: '时间线', color: '#2196F3' },
  { id: 3, icon: 'menu_book',     label: '知识',   color: '#FF9800' },
  { id: 4, icon: 'people',        label: '联系人', color: '#7B1FA2' },
  { id: 5, icon: 'chat',          label: '消息',  color: '#00BCD4' }, // 预留
];

function Screen(ctx) {
  var UI = ctx.UI;

  // ===== 状态 =====
  var cachedData = { events: [], contacts: [], info: [], finance: [], todos: [], menstrual: [] };
  try {
    var _cached = ctx.getEnv('CACHED_ALL_DATA');
    if (_cached) cachedData = JSON.parse(_cached);
  } catch(e) {}

  // ===== 从 env 同步读取上次离开时的 UI 状态 =====
  // 这是"同步恢复"的关键：与 msg_watcher 的 CACHED_ALL_DATA 模式一致
  // 渲染上下文里 ctx.getEnv 是同步的，无需 await
  var uiBoot = {};
  try {
    var _uiRaw = ctx.getEnv('MEMORY_SYSTEM_UI_STATE');
    if (_uiRaw) uiBoot = JSON.parse(_uiRaw) || {};
  } catch(e) { uiBoot = {}; }

  var tabState = ctx.useState('tab', (uiBoot.tab !== undefined ? uiBoot.tab : 0));
  var dataState = ctx.useState('allData', cachedData);
  var analyzingState = ctx.useState('analyzing', false);
  var resultState = ctx.useState('resultText', '');
  var showCfgState = ctx.useState('showCfg', false);
  var queryState = ctx.useState('query', (uiBoot.query !== undefined ? uiBoot.query : ''));
  var dateStartState = ctx.useState('dateStart', (uiBoot.dateStart !== undefined ? uiBoot.dateStart : ''));
  var dateEndState = ctx.useState('dateEnd', (uiBoot.dateEnd !== undefined ? uiBoot.dateEnd : ''));
  var filterTypeState = ctx.useState('filterType', (uiBoot.filterType !== undefined ? uiBoot.filterType : ''));
  var showCalState = ctx.useState('showCal', false);
  var memoryState = ctx.useState('memories', []);
  var memoryQueryState = ctx.useState('memQuery', (uiBoot.memQuery !== undefined ? uiBoot.memQuery : ''));
var uiSaveRef = ctx.useRef('uiSaveRef', '');
  var memoryLoadingState = ctx.useState('memLoading', false);
  var pendingDeleteState = ctx.useState('pendingDelete', '');
  // 联系人 Tab：选中联系人同步恢复
  var selContactState = ctx.useState('selContact', (uiBoot.selContact !== undefined ? uiBoot.selContact : -1));
  // 消息Tab专用状态
  var chatsState = ctx.useState('msgs_chats', []);
  // 消息Tab：选中的对话同步恢复（注意 chatDetail 不持久化——它是网络请求结果，下次进入会重新加载）
  var selectedChatState = ctx.useState('msgs_selectedChat', (uiBoot.selectedChatId ? { chatId: uiBoot.selectedChatId } : null));
  var chatDetailState = ctx.useState('msgs_chatDetail', null);
  var loadingChatsState = ctx.useState('msgs_loadingChats', false);
  var loadingDetailState = ctx.useState('msgs_loadingDetail', false);
  var msgQueryState = ctx.useState('msgs_query', (uiBoot.msgQuery !== undefined ? uiBoot.msgQuery : ''));
  var hasMoreState = ctx.useState('msgs_hasMore', true);
  // 消息Tab：加载偏移同步恢复，避免回到列表头
var offsetState = ctx.useState('msgs_offset', (uiBoot.msgOffset !== undefined ? uiBoot.msgOffset : 0));
var analyzedChatsState = ctx.useState('msgs_analyzedChats', []);
var selectedMessagesState = ctx.useState('msgs_selectedMessages', []); // 多选的消息索引
// 后端真实对话总数（来自 list_chats_brief 的 data.totalCount），不会因为前端追加而变化
// 这个数字代表"你一共有多少对话"，不是"已拉取多少"——按用户原话："我需要看到实际拉取数量"
var totalChatsState = ctx.useState('msgs_totalChats', (uiBoot.totalChats !== undefined ? uiBoot.totalChats : 0));

  var cfgEndpoint = ctx.useState('cfgEndpoint', ctx.getEnv('MEMORY_SYSTEM_ENDPOINT') || '');
  var cfgKey = ctx.useState('cfgKey', ctx.getEnv('MEMORY_SYSTEM_KEY') || '');
  var cfgModel = ctx.useState('cfgModel', ctx.getEnv('MEMORY_SYSTEM_MODEL') || 'gpt-4o-mini');
  var endpoint = cfgEndpoint[0], setEndpoint = cfgEndpoint[1];
  var apiKey = cfgKey[0], setApiKey = cfgKey[1];
  var model = cfgModel[0], setModel = cfgModel[1];
var initRef = ctx.useRef('init', false);
  if (!initRef.current) {
 initRef.current = true;
 loadData();
 // ===== 自动触发分析：检测上次以来是否有新对话内容 =====
 (async function() {
   try {
     var raw = await ctx.callTool('memory_system:trigger_analysis', {});
     var r = parseResult(raw);
     if (r && r.started) {
       // 异步分析已启动 → 显示"分析中"并轮询刷新数据
       resultState[1]('🔄 检测到 ' + (r.newMessageCount || 0) + ' 条新对话，正在后台分析...');
       var triggerPollRef = ctx.useRef('triggerPoll', 0);
       triggerPollRef.current += 1;
       var pollId = triggerPollRef.current;
       var startMs = Date.now();
       var maxMs = 90000; // 最多轮询 90 秒
       var lastSnapshot = '';
       (function pollOnce() {
         if (pollId !== triggerPollRef.current) return; // 已被新触发取代
         if (Date.now() - startMs > maxMs) {
           resultState[1]('⏱️ 分析超时，请稍后手动刷新');
           return;
         }
         setTimeout(async function() {
           try {
             // 读 env 看分析是否结束
             var envResult = '';
             try { envResult = ctx.getEnv('MEMORY_SYSTEM_TRIGGER_RESULT') || ''; } catch(e) {}
             if (envResult && envResult !== lastSnapshot) {
               lastSnapshot = envResult;
               try {
                 var parsed = JSON.parse(envResult);
                 if (parsed && parsed.finishedAt) {
                   // 分析已结束
                   if (parsed.success && parsed.hasData) {
                     await loadData();
                     resultState[1]('✅ 后台分析完成：发现 ' + (parsed.newMessageCount || 0) + ' 条新内容');
                   } else if (parsed.success && !parsed.hasData) {
                     resultState[1]('✅ 后台分析完成：未发现可提取内容');
                   } else {
                     resultState[1]('⚠️ 分析失败：' + (parsed.error || '未知错误'));
                   }
                   return;
                 }
               } catch(pe) {}
             }
             pollOnce();
           } catch(e) {
             pollOnce();
           }
         }, 3000);
       })();
     } else if (r && r.skipped) {
       // 没有新内容：静默（也可选显示一句提示）
       resultState[1]('✅ 无新对话内容 (' + (r.lastAnalyzedAt ? '上次分析：' + new Date(r.lastAnalyzedAt).toLocaleString() : '首次检测') + ')');
     } else if (r && !r.success) {
       resultState[1]('⚠️ 检测失败：' + (r.message || r.error || '未知'));
     }
   } catch(e) {}
 })();
}
  // ===== 初始化时加载记忆 =====
  var currentTab = tabState[0];
  if (currentTab === 3 && memoryState[0].length === 0 && !memoryLoadingState[0]) {
    memoryLoadingState[1](true);
    (async function() {
      try {
        var raw = await ctx.callTool('memory_system:load_memories', { limit: 100 });
        var r = parseResult(raw);
        if (r && r.success) { memoryState[1](r.memories || []); }
      } catch(e) {}
      memoryLoadingState[1](false);
    })();
  }

  // ===== 初始化时加载已分析对话列表（用于消息Tab标记）=====
  var analyzedChatsInitRef = ctx.useRef('analyzedChatsInit', false);
  if (currentTab === 5 && !analyzedChatsInitRef.current) {
    analyzedChatsInitRef.current = true;
    (async function() {
      try {
        var raw = await ctx.callTool('memory_system:get_analyzed_chats', {});
        var r = parseResult(raw);
        if (r && r.success && r.chats) {
          analyzedChatsState[1](r.chats);
        }
      } catch(e) {}
    })();
  }

  // ===== 消息Tab：每次进入都强制刷新一次对话列表 =====
// 用户的诉求："点击侧边栏进入就算一次刷新"——不依赖 state 缓存，
// 每次从侧边栏进入消息 Tab 时都主动触发 list_chats_brief 重新拉取。
// 实现要点：
//  1. 用 useRef 防止同一次进入内重复触发；
//  2. 同时用 env 同步检查时间戳：如果距上次刷新超过 3 秒，认为是"新一次进入"，
//     重置 ref 并强制刷新——这样无论 OP 的 useRef 是持久化还是被销毁，都能保证刷新。
var lastMsgsLoadAt = 0;
try {
var _lm = ctx.getEnv('MEMORY_SYSTEM_LAST_MSGS_LOAD');
if (_lm) lastMsgsLoadAt = parseInt(_lm, 10) || 0;
} catch(__e) {}
var nowMs = Date.now();
var isFreshEnter = (lastMsgsLoadAt === 0) || ((nowMs - lastMsgsLoadAt) > 3000);
var msgsChatsEnterRef = ctx.useRef('msgsChatsEnter', false);
// 如果 env 判断是新进入，重置 ref
if (isFreshEnter) msgsChatsEnterRef.current = false;
if (currentTab === 5 && !msgsChatsEnterRef.current) {
msgsChatsEnterRef.current = true;
// 标记本次刷新时间，避免 3 秒内重复触发
try { ctx.setEnv('MEMORY_SYSTEM_LAST_MSGS_LOAD', String(Date.now())); } catch(__e2) {}
// 重置"已加载"标记，让 messages.js 内部也能正常兜底加载
try { ctx.setEnv('MEMORY_SYSTEM_MSGS_ENTER_LOADED', '0'); } catch(__eRst) {}
// 始终先清空旧列表 + 显示加载状态，避免误导用户
chatsState[1]([]);
selectedChatState[1](null);
chatDetailState[1](null);
loadingChatsState[1](true);
hasMoreState[1](true);
offsetState[1](0);
(async function() {
try {
// 注意：listChat 不支持 offset，所以一次性拉大数（200），
// 真实对话数通过 totalCount 显示给用户，不再分页。
var raw = await ctx.callTool('chat_exporter:list_chats_brief', {
limit: 200,
sort_order: 'desc'
});
var r = parseResult(raw);
if (r && r.success && r.data && r.data.chats) {
chatsState[1](r.data.chats);
hasMoreState[1](r.data.chats.length >= 200);
offsetState[1](r.data.chats.length);
// 记录后端真实总数（用于顶部"实际拉取数量"显示）
if (r.data.totalCount !== undefined) totalChatsState[1](r.data.totalCount);
// 标记"已加载"，防止 messages.js 内部再次触发重复请求
try { ctx.setEnv('MEMORY_SYSTEM_MSGS_ENTER_LOADED', '1'); } catch(__eSetFlag) {}
} else {
hasMoreState[1](false);
}
} catch(e) {
hasMoreState[1](false);
}
loadingChatsState[1](false);
})();
}

  // ===== 动作函数 =====
  async function loadData() {
    try {
      var raw = await ctx.callTool('memory_system:load_saved_data', {});
      var r = parseResult(raw);
      if (r && r.success) {
            dataState[1]({
                events: r.extracted && r.extracted.events || [],
                contacts: r.extracted && r.extracted.contacts || [],
                info: r.extracted && r.extracted.info || [],
                finance: r.extracted && r.extracted.finance || [],
                todos: r.extracted && r.extracted.todos || [],
                menstrual: r.extracted && r.extracted.menstrual || []
            });
            if (r.uiState && r.uiState.data) {
                var saved = r.uiState.data;
                if (saved.tab !== undefined) tabState[1](saved.tab);
                if (saved.query !== undefined) queryState[1](saved.query);
                if (saved.filterType !== undefined) filterTypeState[1](saved.filterType);
                if (saved.dateStart !== undefined) dateStartState[1](saved.dateStart);
                if (saved.dateEnd !== undefined) dateEndState[1](saved.dateEnd);
            }
        try {
          ctx.setEnv('CACHED_ALL_DATA', JSON.stringify({
            events: r.extracted && r.extracted.events || [],
            contacts: r.extracted && r.extracted.contacts || [],
            info: r.extracted && r.extracted.info || [],
            finance: r.extracted && r.extracted.finance || [],
            todos: r.extracted && r.extracted.todos || [],
            menstrual: r.extracted && r.extracted.menstrual || []
          }));
        } catch(ex) {}
      }
    } catch (e) {}
  }

  async function saveConfig() {
    await ctx.setEnv('MEMORY_SYSTEM_ENDPOINT', endpoint);
    await ctx.setEnv('MEMORY_SYSTEM_KEY', apiKey);
    await ctx.setEnv('MEMORY_SYSTEM_MODEL', model);
    resultState[1]('✅ 配置已保存');
  }

  async function doAnalyze() {
    analyzingState[1](true);
    resultState[1]('🔄 分析中...');
    try {
      var raw = await ctx.callTool('memory_system:analyze_saved_messages', {});
      var r = parseResult(raw);
      if (r && r.success) {
        await loadData();
        resultState[1]('✅ 完成：' + (r.events||0) + ' 事件，' + (r.todos||0) + ' 待办');
      } else {
        resultState[1]((r && r.message) || '❌ 分析失败');
      }
    } catch (e) {
      resultState[1]('❌ ' + (e.message || String(e)));
    }
    analyzingState[1](false);
  }

  async function deleteItem(category, index) {
    try {
      var raw = await ctx.callTool('memory_system:sync_to_env', { action: 'delete', category: category, index: String(index) });
      if (parseResult(raw) && parseResult(raw).success) {
        await loadData();
        resultState[1]('✅ 已删除');
      }
    } catch(e) {
      resultState[1]('❌ ' + (e.message || String(e)));
    }
  }

  // ===== 状态读取 =====
  var allData = dataState[0];
  var analyzing = analyzingState[0];
  var resultText = resultState[0];
  var showCfg = showCfgState[0];
  var q = queryState[0] || '';
  var dateStart = dateStartState[0] || '';
  var dateEnd = dateEndState[0] || '';
  var filterType = filterTypeState[0] || '';
  var showCal = showCalState[0];
  var calYearState = ctx.useState('calY', dateStart ? parseInt(dateStart.substring(0,4)) : new Date().getFullYear());
  var calMonthState = ctx.useState('calM', dateStart ? parseInt(dateStart.substring(5,7)) : new Date().getMonth() + 1);
  var calYear = calYearState[0];
  var calMonth = calMonthState[0];

  try {
// UI 状态快照：覆盖各 Tab 需要"恢复"的字段
//  - 公共：tab/query/filterType/dateStart/dateEnd/calYear/calMonth/memQuery
//  - 联系人 Tab：selContact（当前选中联系人）
//  - 消息 Tab：selectedChatId（当前展开的对话）、msgQuery（消息搜索词）、offset（已加载偏移）
// 注意：loading/analyzing/analyzedChats/chats/chatDetail/selectedMessages 故意不保存（运行时数据，下次进入会重新加载）
var __uiSnapshot = JSON.stringify({
tab: tabState[0],
query: queryState[0],
filterType: filterTypeState[0],
dateStart: dateStartState[0],
dateEnd: dateEndState[0],
memQuery: memoryQueryState[0],
calYear: calYear,
calMonth: calMonth,
selContact: selContactState[0],
selectedChatId: (selectedChatState[0] && selectedChatState[0].chatId) || '',
msgQuery: msgQueryState[0],
msgOffset: offsetState[0],
hasMore: hasMoreState[0],
totalChats: totalChatsState[0]
});
if (uiSaveRef.current !== __uiSnapshot) {
uiSaveRef.current = __uiSnapshot;
// 主路径：ctx.setEnv 同步写入；下次进入 getEnv 同步读取，无需异步等待
// 这是 msg_watcher 的 CACHED_ALL_DATA 同款模式
try { ctx.setEnv('MEMORY_SYSTEM_UI_STATE', __uiSnapshot); } catch(__eSet) {}
// 兜底：异步触发工具保存到磁盘，保证重启后也能恢复
try {
var __uiParams = JSON.stringify({ state_json: __uiSnapshot });
if (typeof NativeInterface !== 'undefined' && typeof NativeInterface.callTool === 'function') {
NativeInterface.callTool('memory_system', 'save_ui_state', __uiParams);
} else if (typeof Operit !== 'undefined' && Operit.NativeInterface && typeof Operit.NativeInterface.callTool === 'function') {
Operit.NativeInterface.callTool('memory_system', 'save_ui_state', __uiParams);
}
} catch(__eSave) {}
}
} catch (e) {}

  // ===== 日历点击处理 =====
  function handleCalClick(ds) {
    if (!dateStart || (dateStart && dateEnd)) {
      dateStartState[1](ds); dateEndState[1]('');
    } else {
      if (ds < dateStart) { dateEndState[1](dateStart); dateStartState[1](ds); }
      else { dateEndState[1](ds); }
      showCalState[1](false);
    }
  }

  // ===== 日历面板 =====
  var calPanel = [];
  if (showCal) {
    var fd = new Date(calYear, calMonth - 1, 1).getDay();
    var dim = new Date(calYear, calMonth, 0).getDate();
    var td = new Date();
    var todayStr = td.getFullYear() + '-' + pad2(td.getMonth()+1) + '-' + pad2(td.getDate());
    var cells = [];
    for (var b = 0; b < fd; b++) cells.push(null);
    for (var d = 1; d <= dim; d++) {
      var ds = calYear + '-' + pad2(calMonth) + '-' + pad2(d);
      cells.push({ day: d, dateStr: ds, isStart: ds === dateStart, isEnd: ds === dateEnd, isInRange: dateStart && dateEnd && ds > dateStart && ds < dateEnd, isToday: ds === todayStr });
    }
    var weekH = ['日','一','二','三','四','五','六'];
    var weekR = [];
    for (var w2 = 0; w2 < 7; w2++) weekR.push(UI.Column({ horizontalAlignment: 'center', weight: 1 }, [UI.Text({ text: weekH[w2], style: 'labelSmall', color: '#999999', fontSize: 10, fontWeight: 'bold' })]));
    var dateRows = [UI.Row({ fillMaxWidth: true }, weekR)];
    var curRow = [];
    for (var ci2 = 0; ci2 < cells.length; ci2++) {
      (function(cell) {
        if (!cell) {
          curRow.push(UI.Column({ horizontalAlignment: 'center', weight: 1 }, [UI.Text({ text: '', style: 'labelSmall' })]));
        } else {
          var bg = cell.isStart || cell.isEnd ? '#4CAF50' : cell.isInRange ? '#E8F5E9' : cell.isToday ? '#FFF3E0' : 'transparent';
          var fg = cell.isStart || cell.isEnd ? '#FFFFFF' : cell.isToday ? '#FF9800' : '#333333';
          curRow.push(UI.Column({ horizontalAlignment: 'center', weight: 1 }, [
            UI.Surface({ width: 28, height: 28, shape: { cornerRadius: 14 }, containerColor: bg, onClick: function() { handleCalClick(cell.dateStr); } }, [
              UI.Row({ fillMaxWidth: true, fillMaxHeight: true, horizontalArrangement: 'center', verticalAlignment: 'center' }, [
                UI.Text({ text: String(cell.day), style: 'labelSmall', color: fg, fontSize: 11 }),
              ]),
            ]),
          ]));
        }
        if (curRow.length === 7 || ci2 === cells.length - 1) {
          dateRows.push(UI.Row({ fillMaxWidth: true }, curRow));
          curRow = [];
        }
      })(cells[ci2]);
    }
    calPanel = [
      UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 10 }, containerColor: '#FAFAFA', border: { width: 1, color: '#E0E0E0' }, padding: 10 }, [
        UI.Column({ spacing: 4 }, [
          UI.Row({ fillMaxWidth: true, horizontalArrangement: 'spaceBetween', verticalAlignment: 'center' }, [
            UI.Surface({ shape: { cornerRadius: 6 }, containerColor: '#F5F5F5', padding: { left: 6, right: 6, top: 2, bottom: 2 }, onClick: function() {
              var pm = calMonth - 1; var py = calYear;
              if (pm < 1) { pm = 12; py--; }
              calYearState[1](py); calMonthState[1](pm);
            } }, [UI.Icon({ name: 'chevron_left', tint: '#666666', size: 18 })]),
            UI.Text({ text: calYear + '年' + calMonth + '月', style: 'labelMedium', color: '#333333', fontWeight: 'bold' }),
            UI.Surface({ shape: { cornerRadius: 6 }, containerColor: '#F5F5F5', padding: { left: 6, right: 6, top: 2, bottom: 2 }, onClick: function() {
              var nm = calMonth + 1; var ny = calYear;
              if (nm > 12) { nm = 1; ny++; }
              calYearState[1](ny); calMonthState[1](nm);
            } }, [UI.Icon({ name: 'chevron_right', tint: '#666666', size: 18 })]),
          ]),
        ].concat(dateRows)),
      ]),
      UI.Spacer({ height: 4 }),
    ];
  }

  // ===== 顶部卡片 =====
  var pendingTodoCount = (allData.todos || []).filter(function(t) { return !t.completed; }).length;
  var headerCard = UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 12 }, containerColor: '#4CAF50', alpha: 0.08, padding: 12 }, [
    UI.Column({ fillMaxWidth: true }, [
      UI.Row({ fillMaxWidth: true, horizontalArrangement: 'spaceBetween', verticalAlignment: 'center' }, [
        UI.Column({}, [
          UI.Text({ text: '📋 记忆系统', style: 'labelMedium', color: '#4CAF50' }),
          UI.Text({ text: (allData.todos || []).length + ' 待办 · ' + pendingTodoCount + ' 待完成 · ' + (allData.events || []).length + ' 事件', style: 'labelSmall', color: '#888888' }),
        ]),
        UI.Row({ verticalAlignment: 'center' }, [
          UI.Surface({ shape: { cornerRadius: 12 }, containerColor: '#E8F5E9', padding: { left: 8, right: 8, top: 4, bottom: 4 }, onClick: function() { showCfgState[1](!showCfg); } }, [
            UI.Row({ verticalAlignment: 'center' }, [
              UI.Icon({ name: 'settings', tint: showCfg ? '#4CAF50' : '#999999', size: 16 }),
              UI.Spacer({ width: 4 }),
              UI.Text({ text: 'API', style: 'labelSmall', color: showCfg ? '#4CAF50' : '#999999' }),
            ]),
          ]),
          UI.Spacer({ width: 6 }),
          UI.Surface({ shape: { cornerRadius: 12 }, containerColor: analyzing ? '#FFF3E0' : '#4CAF50', padding: { left: 10, right: 10, top: 4, bottom: 4 }, onClick: function() { if (!analyzing) doAnalyze(); } }, [
            UI.Text({ text: analyzing ? '⏳ 分析中' : '🤖 分析', style: 'labelSmall', color: analyzing ? '#FF9800' : '#FFFFFF', fontWeight: 'bold' }),
          ]),
        ]),
      ]),
      resultText ? UI.Surface({ shape: { cornerRadius: 6 }, containerColor: '#E8F5E9', padding: { left: 8, right: 8, top: 4, bottom: 4 }, margin: { top: 8 } }, [
        UI.Text({ text: resultText, style: 'labelSmall', color: '#2E7D32', fontSize: 11 }),
      ]) : null,
    ].filter(Boolean)),
  ]);

  // ===== 配置面板 =====
  var cfgSection = [];
  if (showCfg) {
    cfgSection = [
      UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 10 }, containerColor: '#FFF8E1', padding: 12, border: { width: 1, color: '#FFB300' } }, [
        UI.Column({ spacing: 8 }, [
          UI.Text({ text: '🔧 API 配置', style: 'labelMedium', fontWeight: 'bold', color: '#F57F17' }),
          UI.TextField({ value: endpoint, onValueChange: setEndpoint, placeholder: 'Endpoint', singleLine: true }),
          UI.TextField({ value: apiKey, onValueChange: setApiKey, placeholder: 'API Key', singleLine: true }),
          UI.TextField({ value: model, onValueChange: setModel, placeholder: '模型名', singleLine: true }),
          UI.Surface({ shape: { cornerRadius: 8 }, containerColor: '#4CAF50', onClick: saveConfig, fillMaxWidth: true, padding: { top: 6, bottom: 6 } }, [
            UI.Text({ text: '保存配置', style: 'labelMedium', color: '#FFFFFF', fontWeight: 'bold' }),
          ]),
        ]),
      ]),
      UI.Spacer({ height: 6 }),
    ];
  }

  // ===== 搜索栏 =====
  var searchBar = UI.Surface({ shape: { cornerRadius: 10 }, containerColor: '#F5F5F5', padding: { left: 8, right: 8, top: 4, bottom: 4 }, fillMaxWidth: true }, [
    UI.Row({ verticalAlignment: 'center' }, [
      UI.Icon({ name: 'search', tint: '#999999', size: 16 }),
      UI.Spacer({ width: 6 }),
      UI.TextField({ value: q, onValueChange: queryState[1], placeholder: '搜索...', weight: 1, singleLine: true }),
      (q || dateStart || dateEnd) ? UI.Surface({ shape: { cornerRadius: 6 }, containerColor: '#FFEBEE', padding: { left: 6, right: 6, top: 2, bottom: 2 }, onClick: function() { queryState[1](''); dateStartState[1](''); dateEndState[1](''); } }, [
        UI.Text({ text: '清除', style: 'labelSmall', color: '#F44336', fontSize: 10 }),
      ]) : null,
    ].filter(Boolean)),
  ]);

  // ===== 工具栏 =====
  var toolRow = UI.Row({ fillMaxWidth: true, spacing: 4 }, [
    UI.Surface({ shape: { cornerRadius: 8 }, containerColor: (dateStart || dateEnd) ? '#C8E6C9' : '#F5F5F5', padding: { left: 8, right: 8, top: 3, bottom: 3 }, onClick: function() { showCalState[1](!showCal); } }, [
      UI.Row({ verticalAlignment: 'center' }, [
        UI.Icon({ name: 'calendar_month', tint: (dateStart || dateEnd) ? '#4CAF50' : '#999999', size: 14 }),
        UI.Spacer({ width: 4 }),
        UI.Text({ text: dateStart && dateEnd ? dateStart + ' ~ ' + dateEnd : dateStart ? dateStart + ' ~ ?' : '日期', style: 'labelSmall', color: (dateStart || dateEnd) ? '#4CAF50' : '#999999', fontSize: 10 }),
      ]),
    ]),
    UI.Surface({ shape: { cornerRadius: 8 }, containerColor: '#4CAF50', padding: { left: 8, right: 8, top: 3, bottom: 3 }, onClick: function() { tabState[1](1); } }, [
      UI.Row({ verticalAlignment: 'center' }, [
        UI.Icon({ name: 'add', tint: '#FFFFFF', size: 14 }),
        UI.Spacer({ width: 4 }),
        UI.Text({ text: '新增', style: 'labelSmall', color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }),
      ]),
    ]),
  ]);

  // ===== 筛选 Chips =====
  var typeFilters = [];
  function makeFilterChip(label, value, color) {
    var isActive = filterType === value;
    typeFilters.push(UI.Surface({ shape: { cornerRadius: 12 }, containerColor: isActive ? color : '#F5F5F5', padding: { left: 10, right: 10, top: 4, bottom: 4 }, onClick: function() { filterTypeState[1](isActive ? '' : value); } }, [
      UI.Text({ text: label, style: 'labelSmall', color: isActive ? '#FFFFFF' : '#666666', fontSize: 11 }),
    ]));
  }

  if (currentTab === 1) {
    makeFilterChip('待完成', 'pending', '#FF5722');
    makeFilterChip('已完成', 'completed', '#4CAF50');
  } else if (currentTab === 2) {
    makeFilterChip('活动', 'activity', '#2196F3');
    makeFilterChip('日程', 'schedule', '#FF9800');
    makeFilterChip('支出', 'expense', '#F44336');
    makeFilterChip('收入', 'income', '#4CAF50');
    makeFilterChip('经期', 'menstrual', '#E91E63');
  } else if (currentTab === 4) {
    makeFilterChip('家人', 'family', '#E91E63');
    makeFilterChip('同事', 'colleague', '#2196F3');
    makeFilterChip('朋友', 'friend', '#4CAF50');
    makeFilterChip('同学', 'classmate', '#FF9800');
    makeFilterChip('服务', 'service', '#00BCD4');
  }

  var filterRow = typeFilters.length > 0 ? [
    UI.Row({ fillMaxWidth: true, spacing: 4 }, typeFilters),
    UI.Spacer({ height: 4 }),
  ] : [];

  // ===== Tab 导航栏 =====
  var tabItems = [];
  for (var ti = 0; ti < TAB_REGISTRY.length; ti++) {
    (function(t) {
      var isSel = currentTab === t.id;
      tabItems.push(UI.Surface({ weight: 1, shape: { cornerRadius: 8 }, containerColor: isSel ? t.color : 'transparent', onClick: function() { tabState[1](t.id); filterTypeState[1](''); } }, [
        UI.Column({ horizontalAlignment: 'center', padding: { top: 4, bottom: 4 } }, [
          UI.Icon({ name: t.icon, tint: isSel ? '#FFFFFF' : '#999999', size: 20 }),
          UI.Text({ text: t.label, style: 'labelSmall', color: isSel ? '#FFFFFF' : '#999999' }),
        ]),
      ]));
    })(TAB_REGISTRY[ti]);
  }

  // ===== 渲染当前Tab内容 =====
  var states = {
    query: q,
    dateStart: dateStart,
    dateEnd: dateEnd,
    filterType: filterType,
    pendingDelete: pendingDeleteState[0],
    selContact: selContactState[0],
    memQuery: memoryQueryState[0] || '',
    // 消息Tab状态
    chats: chatsState[0],
    selectedChat: selectedChatState[0],
    chatDetail: chatDetailState[0],
    loadingChats: loadingChatsState[0],
    loadingDetail: loadingDetailState[0],
    msgQuery: msgQueryState[0],
    hasMore: hasMoreState[0],
    offset: offsetState[0],
    analyzedChats: analyzedChatsState[0],
    selectedMessages: selectedMessagesState[0],
    totalChats: totalChatsState[0]
  };

  var actions = {
    loadData: loadData,
    setResult: resultState[1],
    setPendingDelete: pendingDeleteState[1],
    deleteItem: deleteItem,
    // 消息Tab actions
    setChats: chatsState[1],
    setSelectedChat: selectedChatState[1],
    setChatDetail: chatDetailState[1],
    setLoadingChats: loadingChatsState[1],
    setLoadingDetail: loadingDetailState[1],
    setMsgQuery: msgQueryState[1],
    setHasMore: hasMoreState[1],
    setOffset: offsetState[1],
    setAnalyzedChats: analyzedChatsState[1],
    setSelectedMessages: selectedMessagesState[1],
    setTotalChats: totalChatsState[1]
  };

  var tabContent;
  switch (currentTab) {
    case 0: tabContent = overviewTab.render(ctx, allData); break;
    case 1: tabContent = todosTab.render(ctx, allData, states, actions); break;
    case 2: tabContent = timelineTab.render(ctx, allData, states, actions); break;
    case 3: tabContent = knowledgeTab.render(ctx, allData, states, actions, memoryState[0]); break;
    case 4: tabContent = contactsTab.render(ctx, allData, states); break;
    case 5: tabContent = messagesTab.render(ctx, allData, states, actions); break;
    default: tabContent = overviewTab.render(ctx, allData);
  }

  // ===== 返回 =====
  return UI.Column({ fillMaxSize: true, padding: 8 }, [
    headerCard,
    UI.Spacer({ height: 6 }),
  ].concat(cfgSection).concat(currentTab === 0 ? [] : [searchBar]).concat([toolRow]).concat(calPanel).concat(filterRow).concat([
    UI.LazyColumn({ fillMaxWidth: true, weight: 1, spacing: 4 }, tabContent),
    UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 12 }, containerColor: 'surfaceVariant', padding: 4 }, [
      UI.Row({ fillMaxWidth: true }, tabItems),
    ]),
  ]));
}