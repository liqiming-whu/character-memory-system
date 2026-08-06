"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const shared = require("../shared");
const { parseResult } = shared;
const theme = require("../theme");

const CATEGORIES = [
  { id: 'character', label: '角色信息' },
  { id: 'relationship', label: '关系记忆' },
  { id: 'preference', label: '偏好' },
  { id: 'interaction_rule', label: '互动规则' },
];

function render(ctx, personaFromScreen, memoriesFromScreen, readyFromScreen, refreshFromScreen) {
  var UI = ctx.UI;
  var colors = theme.c(ctx.MaterialTheme && ctx.MaterialTheme.colorScheme);
  // 分类 chip 用 primary/tertiary 交替强调
  var __charAutoLoadOnce = false;
var __charPropsLock = false;
var __charMemPropsLock = false;
var catColors = [colors.primary, colors.tertiary, colors.error, colors.secondary];
  var personaState = ctx.useState('cms_character_persona_context', {
    id: String(ctx.getEnv('MEMORY_SYSTEM_ACTIVE_PERSONA_ID') || ''),
    name: String(ctx.getEnv('MEMORY_SYSTEM_ACTIVE_PERSONA_NAME') || ''),
    type: String(ctx.getEnv('MEMORY_SYSTEM_ACTIVE_PERSONA_TYPE') || '')
  });
  // v1.6.9 治本：渲染体零 setState——数据只读 props（screen onLoad 加载后传入），回退 useState 初始值
  var __pProps = (personaFromScreen && (personaFromScreen.id || personaFromScreen.name)) ? personaFromScreen : null;  // v1.7.0 props 唯一数据源
  var personaId = String((__pProps && __pProps.id) || '');
  var personaName = String((__pProps && __pProps.name) || '');
  var personaType = String((__pProps && __pProps.type) || '');
  var memoriesState = ctx.useState('cms_character_memories', []);
  var __memProps = Array.isArray(memoriesFromScreen) ? memoriesFromScreen : [];  // v1.7.0 props 唯一数据源
  try { Tools.Files.write("/sdcard/Download/Operit/character_memory_system_data/dbg_ui.log", new Date().toISOString().slice(5, 19) + " [render] p=" + (__pProps ? 1 : 0) + " m=" + __memProps.length + " ready=" + (readyFromScreen ? 1 : 0) + "\n", true, "android"); } catch (e) {}
  var loadingState = ctx.useState('cms_character_loading', false);
  var loadedForRef = ctx.useRef('cms_character_loaded_for', '');
  var categoryState = ctx.useState('cms_character_category', 'relationship');
  var titleState = ctx.useState('cms_character_title', '');
  var contentState = ctx.useState('cms_character_content', '');
  var resultState = ctx.useState('cms_character_result', '');
  var contextLoadingRef = ctx.useRef('cms_character_context_loading', false);
  var retryAtRef = ctx.useRef('cms_character_retry_at', 0);
  var autoLoadAtRef = ctx.useRef('cms_character_auto_load_at', 0);
  // v1.7.0 数据 ready gate：未就绪时显示加载态（零副作用，不 setState 不加载）
  if (!readyFromScreen) {
    return [UI.Column({ fillMaxWidth: true, padding: 24 }, [
      UI.Text({ text: '正在读取角色信息...', style: 'titleMedium', color: colors.onSurfaceVariant }),
    ])];
  }

  // v1.8.2：Operit bridge 并发工具调用响应错配——全局串行队列（挂 ctx 跨模块共享，与 screen.js 同一队列）
  function __serialCtx(ctx, fn) {
    try {
      if (!ctx.__cmsToolQ) ctx.__cmsToolQ = Promise.resolve();
      var p = ctx.__cmsToolQ.then(function() { return fn(); }, function() { return fn(); });
      ctx.__cmsToolQ = p.then(function() {}, function() {});
      return p;
    } catch (e) { return Promise.resolve().then(function() { return fn(); }); }
  }
  async function callToolWithTimeout(name, params, timeoutMs) {
    var timer = null;
    try {
      return await Promise.race([
        __serialCtx(ctx, function() { return ctx.callTool(name, params); }),
        new Promise(function(_, reject) {
          timer = setTimeout(function() { reject(new Error('读取超时')); }, timeoutMs || 12000);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function loadForPersona(targetPersonaId) {
    if (!targetPersonaId) {
      memoriesState[1]([]);
      return;
    }
    loadingState[1](true);
    try {
      var raw = await callToolWithTimeout('memory_system:load_memories', {
        query: '*',
        limit: 100,
        scope: 'persona',
        caller_card_id: targetPersonaId
      }, 12000);
      var result = parseResult(raw);
      if (result && result.success) {
        memoriesState[1](result.memories || []);
        loadedForRef.current = targetPersonaId;
        retryAtRef.current = 0;
      } else {
        resultState[1]('读取失败：' + ((result && result.message) || '未知错误'));
        retryAtRef.current = Date.now() + 30000;
      }
    } catch (e) {
      resultState[1]('读取失败：' + (e.message || String(e)));
      retryAtRef.current = Date.now() + 30000;
    }
    loadingState[1](false);
  }

  async function loadContext() {
    if (contextLoadingRef.current) return;
    contextLoadingRef.current = true;
    try {
      var raw = await callToolWithTimeout('memory_system:get_persona_context', {}, 8000);
      var result = parseResult(raw);
      var persona = result && result.success && result.persona ? result.persona : { id: '', name: '', type: '' };
      personaState[1](persona);
      var nextId = String(persona.id || '');
      if (nextId) {
        // 找到角色后总是重新加载记忆，避免已加载标记导致记忆缺失
        retryAtRef.current = 0;
        await loadForPersona(nextId);
      } else {
        memoriesState[1]([]);
        retryAtRef.current = Date.now() + 30000;
      }
    } catch (e) {
      resultState[1]('角色上下文读取失败：' + (e.message || String(e)));
      retryAtRef.current = Date.now() + 30000;
    } finally {
      contextLoadingRef.current = false;
    }
  }

  async function loadMemories() {
    loadedForRef.current = personaId;
    await loadForPersona(personaId);
  }

  async function createMemory() {
    var title = String(titleState[0] || '').trim();
    var content = String(contentState[0] || '').trim();
    if (!title || !content) {
      resultState[1]('标题和内容不能为空');
      return;
    }
    var category = categoryState[0];
    var raw = await __serialCtx(ctx, function() { return ctx.callTool('memory_system:create_memory', {
      title: '[' + category + '] ' + title,
      content: content,
      tags: 'character_memory,' + category + ',manual,schema_v1',
      source: 'character_memory_role_manual',
      caller_card_id: personaId
    }); });
    var result = parseResult(raw);
    if (result && result.success) {
      titleState[1]('');
      contentState[1]('');
      resultState[1]('记忆创建成功');
      if (refreshFromScreen) { await refreshFromScreen(); } else { await loadMemories(); }
    } else resultState[1]((result && result.message) || '创建失败');
  }

  async function deleteMemory(title) {
    var raw = await __serialCtx(ctx, function() { return ctx.callTool('memory_system:delete_memory', { title: title, caller_card_id: personaId }); });
    var result = parseResult(raw);
    resultState[1](result && result.success ? '已删除' : ((result && result.message) || '删除失败'));
    if (result && result.success) { if (refreshFromScreen) { await refreshFromScreen(); } else { await loadMemories(); } }
  }

  async function loadOnEnter() {
    // 失败后退避：30 秒内不自动重试
    if (Date.now() < Number(retryAtRef.current || 0)) return;
    // 节流：同一角色页进入 1.5 秒内不重复自动加载（快速切 tab 不会风暴）
    var now = Date.now();
    if (now - Number(autoLoadAtRef.current || 0) < 1500) return;
    autoLoadAtRef.current = now;
    await loadContext();
  }
  // v1.6.9：渲染体不再触发加载——数据由 screen onLoad（loadScreenPersona）加载后经 props 传入

  if (!personaId) {
    return [UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 12 }, containerColor: colors.errorContainer, padding: 18 }, [
      UI.Column({ horizontalAlignment: 'center' }, [
        UI.Icon({ name: 'person_off', tint: colors.error, size: 36 }),
        UI.Spacer({ height: 8 }),
        UI.Text({ text: personaType === 'character_group' ? '首版暂不支持角色组记忆' : '当前未识别到角色卡', style: 'titleMedium', color: colors.error, fontWeight: 'bold' }),
        UI.Text({ text: '请在启用角色卡的对话中发送一条消息后再打开此页面。', style: 'bodySmall', color: colors.onSurfaceVariant }),
        UI.Spacer({ height: 8 }),
        UI.Button({ text: '重新识别角色卡', onClick: (refreshFromScreen || loadContext) }),
      ]),
    ])];
  }

  var items = [
    UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 12 }, containerColor: colors.primaryContainer, padding: 12 }, [
      UI.Row({ verticalAlignment: 'center' }, [
        UI.Icon({ name: 'person', tint: colors.primary, size: 28 }),
        UI.Spacer({ width: 8 }),
        UI.Column({ weight: 1 }, [
          UI.Text({ text: personaName || '未命名角色', style: 'titleMedium', color: colors.primary, fontWeight: 'bold' }),
          UI.Text({ text: '角色卡 ID：' + personaId, style: 'labelSmall', color: colors.onSurfaceVariant, maxLines: 1 }),
          UI.Text({ text: '原生 Memory Profile · ' + __memProps.length + ' 条', style: 'labelSmall', color: colors.primary }),
        ]),
        UI.Surface({ shape: { cornerRadius: 8 }, containerColor: colors.primary, padding: 6, onClick: (refreshFromScreen || loadMemories) }, [
          UI.Icon({ name: 'refresh', tint: colors.onPrimary, size: 18 }),
        ]),
      ]),
    ]),
    UI.Spacer({ height: 8 }),
    UI.Text({ text: '新增角色记忆', style: 'labelMedium', color: colors.onSurface, fontWeight: 'bold' }),
  ];

  var chips = [];
  for (var ci = 0; ci < CATEGORIES.length; ci++) {
    (function(category, idx) {
      var selected = categoryState[0] === category.id;
      var color = catColors[idx % catColors.length];
      chips.push(UI.FilterChip({
        label: UI.Text({ text: category.label, style: 'labelSmall', color: selected ? colors.primary : colors.onSurfaceVariant }),
        selected: selected,
        onClick: function() { categoryState[1](category.id); }
      }));
    })(CATEGORIES[ci], ci);
  }
  items.push(UI.Row({ fillMaxWidth: true, spacing: 4 }, chips));
  items.push(UI.TextField({ value: titleState[0], onValueChange: titleState[1], placeholder: '标题', singleLine: true }));
  items.push(UI.TextField({ value: contentState[0], onValueChange: contentState[1], placeholder: '明确、可复用的长期记忆' }));
  items.push(UI.Button({ text: '保存到当前角色', onClick: createMemory, fillMaxWidth: true }));
  if (resultState[0]) items.push(UI.Text({ text: resultState[0], style: 'labelSmall', color: colors.onSurfaceVariant }));
  items.push(UI.Spacer({ height: 8 }));
  items.push(UI.Text({ text: loadingState[0] ? '正在读取…' : '角色记忆', style: 'labelMedium', color: colors.onSurface, fontWeight: 'bold' }));

  for (var mi = 0; mi < __memProps.length; mi++) {
    (function(memory) {
      var displayTitle = String(memory.title || '未命名记忆').replace(/^\[persona:[^\]]+\]\s*/, '');
      items.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 8 }, containerColor: colors.surface, padding: 10 }, [
        UI.Row({ fillMaxWidth: true, verticalAlignment: 'center' }, [
          UI.Column({ weight: 1 }, [
            UI.Text({ text: displayTitle, style: 'bodySmall', color: colors.onSurface, fontWeight: 'bold' }),
            UI.Text({ text: memory.content || '', style: 'labelSmall', color: colors.onSurfaceVariant, maxLines: 3 }),
          ]),
          UI.Surface({ shape: { cornerRadius: 6 }, containerColor: colors.errorContainer, padding: 5, onClick: function() { deleteMemory(memory.title); } }, [
            UI.Icon({ name: 'delete', tint: colors.error, size: 16 }),
          ]),
        ]),
      ]));
      items.push(UI.Spacer({ height: 3 }));
    })(__memProps[mi]);
  }
  return items;
}

exports.render = render;
