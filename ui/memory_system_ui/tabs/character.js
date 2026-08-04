"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const shared = require("../shared");
const { parseResult } = shared;

const CATEGORIES = [
  { id: 'character', label: '角色信息', color: '#5E35B1' },
  { id: 'relationship', label: '关系记忆', color: '#E91E63' },
  { id: 'preference', label: '偏好', color: '#00897B' },
  { id: 'interaction_rule', label: '互动规则', color: '#F57C00' },
];

function render(ctx, personaFromScreen, memoriesFromScreen) {
  var UI = ctx.UI;
  var personaState = ctx.useState('character_persona_context', {
    id: String(ctx.getEnv('MEMORY_SYSTEM_ACTIVE_PERSONA_ID') || ''),
    name: String(ctx.getEnv('MEMORY_SYSTEM_ACTIVE_PERSONA_NAME') || ''),
    type: String(ctx.getEnv('MEMORY_SYSTEM_ACTIVE_PERSONA_TYPE') || '')
  });
  // 外部传入的角色上下文优先：screen 根 onLoad 加载后传入，避免依赖子组件副作用
  if (personaFromScreen && (!personaState[0] || !personaState[0].id) && personaFromScreen.id) {
    personaState[1](personaFromScreen);
  }
  var personaId = String((personaState[0] && personaState[0].id) || '');
  var personaName = String((personaState[0] && personaState[0].name) || '');
  var personaType = String((personaState[0] && personaState[0].type) || '');
  var memoriesState = ctx.useState('character_memories', []);
  // 外部传入的角色记忆优先：screen 加载后传入，避免子组件自触发不可靠导致记忆缺失
  if (Array.isArray(memoriesFromScreen) && memoriesFromScreen.length > 0) {
    memoriesState[1](memoriesFromScreen);
  }
  var loadingState = ctx.useState('character_loading', false);
  var loadedForRef = ctx.useRef('character_loaded_for', '');
  var categoryState = ctx.useState('character_category', 'relationship');
  var titleState = ctx.useState('character_title', '');
  var contentState = ctx.useState('character_content', '');
  var resultState = ctx.useState('character_result', '');
  var contextLoadingRef = ctx.useRef('character_context_loading', false);
  var retryAtRef = ctx.useRef('character_retry_at', 0);
  var autoLoadAtRef = ctx.useRef('character_auto_load_at', 0);

  async function callToolWithTimeout(name, params, timeoutMs) {
    var timer = null;
    try {
      return await Promise.race([
        ctx.callTool(name, params),
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
    var raw = await ctx.callTool('memory_system:create_memory', {
      title: '[' + category + '] ' + title,
      content: content,
      tags: 'character_memory,' + category + ',manual,schema_v1',
      source: 'character_memory_role_manual',
      caller_card_id: personaId
    });
    var result = parseResult(raw);
    if (result && result.success) {
      titleState[1]('');
      contentState[1]('');
      resultState[1]('记忆创建成功');
      await loadMemories();
    } else resultState[1]((result && result.message) || '创建失败');
  }

  async function deleteMemory(title) {
    var raw = await ctx.callTool('memory_system:delete_memory', { title: title, caller_card_id: personaId });
    var result = parseResult(raw);
    resultState[1](result && result.success ? '已删除' : ((result && result.message) || '删除失败'));
    if (result && result.success) await loadMemories();
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
  // 渲染时直接触发自动加载：不用 setTimeout，避免依赖事件循环；
  // loadOnEnter 异步不阻塞渲染，loadContext 幂等（防重入 + 节流 + 失败退避）。
  loadOnEnter();

  if (!personaId) {
    return [UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 12 }, containerColor: '#FFF3E0', padding: 18 }, [
      UI.Column({ horizontalAlignment: 'center' }, [
        UI.Icon({ name: 'person_off', tint: '#F57C00', size: 36 }),
        UI.Spacer({ height: 8 }),
        UI.Text({ text: personaType === 'character_group' ? '首版暂不支持角色组记忆' : '当前未识别到角色卡', style: 'titleMedium', color: '#E65100', fontWeight: 'bold' }),
        UI.Text({ text: '请在启用角色卡的对话中发送一条消息后再打开此页面。', style: 'bodySmall', color: '#777777' }),
        UI.Spacer({ height: 8 }),
        UI.Surface({ shape: { cornerRadius: 8 }, containerColor: '#F57C00', padding: { left: 12, right: 12, top: 7, bottom: 7 }, onClick: loadContext }, [
          UI.Text({ text: '重新识别角色卡', style: 'labelMedium', color: '#FFFFFF', fontWeight: 'bold' }),
        ]),
      ]),
    ])];
  }

  var items = [
    UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 12 }, containerColor: '#EDE7F6', padding: 12 }, [
      UI.Row({ verticalAlignment: 'center' }, [
        UI.Icon({ name: 'person', tint: '#5E35B1', size: 28 }),
        UI.Spacer({ width: 8 }),
        UI.Column({ weight: 1 }, [
          UI.Text({ text: personaName || '未命名角色', style: 'titleMedium', color: '#4527A0', fontWeight: 'bold' }),
          UI.Text({ text: '角色卡 ID：' + personaId, style: 'labelSmall', color: '#777777', maxLines: 1 }),
          UI.Text({ text: '原生 Memory Profile · ' + memoriesState[0].length + ' 条', style: 'labelSmall', color: '#5E35B1' }),
        ]),
        UI.Surface({ shape: { cornerRadius: 8 }, containerColor: '#5E35B1', padding: 6, onClick: loadMemories }, [
          UI.Icon({ name: 'refresh', tint: '#FFFFFF', size: 18 }),
        ]),
      ]),
    ]),
    UI.Spacer({ height: 8 }),
    UI.Text({ text: '新增角色记忆', style: 'labelMedium', color: '#333333', fontWeight: 'bold' }),
  ];

  var chips = [];
  for (var ci = 0; ci < CATEGORIES.length; ci++) {
    (function(category) {
      var selected = categoryState[0] === category.id;
      chips.push(UI.Surface({ shape: { cornerRadius: 10 }, containerColor: selected ? category.color : '#F5F5F5', padding: { left: 8, right: 8, top: 4, bottom: 4 }, onClick: function() { categoryState[1](category.id); } }, [
        UI.Text({ text: category.label, style: 'labelSmall', color: selected ? '#FFFFFF' : '#666666' }),
      ]));
    })(CATEGORIES[ci]);
  }
  items.push(UI.Row({ fillMaxWidth: true, spacing: 4 }, chips));
  items.push(UI.TextField({ value: titleState[0], onValueChange: titleState[1], placeholder: '标题', singleLine: true }));
  items.push(UI.TextField({ value: contentState[0], onValueChange: contentState[1], placeholder: '明确、可复用的长期记忆' }));
  items.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 8 }, containerColor: '#5E35B1', padding: 8, onClick: createMemory }, [
    UI.Text({ text: '保存到当前角色', style: 'labelMedium', color: '#FFFFFF', fontWeight: 'bold' }),
  ]));
  if (resultState[0]) items.push(UI.Text({ text: resultState[0], style: 'labelSmall', color: '#555555' }));
  items.push(UI.Spacer({ height: 8 }));
  items.push(UI.Text({ text: loadingState[0] ? '正在读取…' : '角色记忆', style: 'labelMedium', color: '#333333', fontWeight: 'bold' }));

  for (var mi = 0; mi < memoriesState[0].length; mi++) {
    (function(memory) {
      var displayTitle = String(memory.title || '未命名记忆').replace(/^\[persona:[^\]]+\]\s*/, '');
      items.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 8 }, containerColor: '#FAFAFA', padding: 10 }, [
        UI.Row({ fillMaxWidth: true, verticalAlignment: 'center' }, [
          UI.Column({ weight: 1 }, [
            UI.Text({ text: displayTitle, style: 'bodySmall', color: '#333333', fontWeight: 'bold' }),
            UI.Text({ text: memory.content || '', style: 'labelSmall', color: '#777777', maxLines: 3 }),
          ]),
          UI.Surface({ shape: { cornerRadius: 6 }, containerColor: '#FFEBEE', padding: 5, onClick: function() { deleteMemory(memory.title); } }, [
            UI.Icon({ name: 'delete', tint: '#D32F2F', size: 16 }),
          ]),
        ]),
      ]));
      items.push(UI.Spacer({ height: 3 }));
    })(memoriesState[0][mi]);
  }
  return items;
}

exports.render = render;
