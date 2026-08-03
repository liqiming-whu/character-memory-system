"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const shared = require("../shared");
const { multiMatch, parseResult } = shared;

// ===== Tab 1: 待办 =====
function render(ctx, allData, states, actions) {
  var UI = ctx.UI;
  var items = [];
  var allTodos = allData.todos || [];
  var q = states.query || '';
  var filterType = states.filterType || '';

  // 筛选
  var filteredTodos = allTodos.filter(function(t) {
    if (filterType === 'pending' && t.completed) return false;
    if (filterType === 'completed' && !t.completed) return false;
    if (!multiMatch((t.title||'') + ' ' + (t.description||''), q)) return false;
    return true;
  });

  var pendingTodos = filteredTodos.filter(function(t) { return !t.completed; });
  var completedTodos = filteredTodos.filter(function(t) { return t.completed; });

  // 切换待办
  async function toggleTodoItem(idx) {
    try {
      var raw = await ctx.callTool('memory_system:toggle_todo', { todo_index: idx });
      if (parseResult(raw) && parseResult(raw).success) {
        await actions.loadData();
      }
    } catch(e) {}
  }

  // 删除
  async function deleteItem(category, index) {
    try {
      var raw = await ctx.callTool('memory_system:sync_to_env', { action: 'delete', category: category, index: String(index) });
      if (parseResult(raw) && parseResult(raw).success) {
        await actions.loadData();
        actions.setResult('✅ 已删除');
      }
    } catch(e) {
      actions.setResult('❌ ' + (e.message || String(e)));
    }
  }

  // 生成删除按钮
  function makeDeleteBtn(category, index, pendingKey) {
    var isPending = states.pendingDelete === pendingKey;
    return UI.Surface({ shape: { cornerRadius: 4 }, containerColor: isPending ? '#D32F2F' : '#FFEBEE', padding: { left: 6, right: 6, top: 2, bottom: 2 }, onClick: function() {
      if (isPending) {
        actions.setPendingDelete('');
        deleteItem(category, index);
      } else {
        actions.setPendingDelete(pendingKey);
      }
    } }, [
      UI.Text({ text: isPending ? '确认' : '删除', style: 'labelSmall', color: isPending ? '#FFFFFF' : '#D32F2F', fontSize: 9, fontWeight: 'bold' }),
    ]);
  }

  // 统计卡片
  items.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 12 }, containerColor: '#FBE9E7', padding: 14 }, [
    UI.Row({ fillMaxWidth: true, horizontalArrangement: 'spaceBetween', verticalAlignment: 'center' }, [
      UI.Row({ verticalAlignment: 'center' }, [
        UI.Icon({ name: 'checklist', tint: '#BF360C', size: 28 }),
        UI.Spacer({ width: 10 }),
        UI.Column({}, [
          UI.Text({ text: pendingTodos.length + ' 项待完成', style: 'titleMedium', fontWeight: 'bold', color: '#BF360C' }),
          UI.Text({ text: '共 ' + filteredTodos.length + ' 项', style: 'bodySmall', color: '#666666' }),
        ]),
      ]),
      UI.Column({ horizontalAlignment: 'center' }, [
        UI.Text({ text: filteredTodos.length > 0 ? Math.round(completedTodos.length / filteredTodos.length * 100) + '%' : '0%', style: 'titleMedium', fontWeight: 'bold', color: '#795548' }),
        UI.Text({ text: '完成率', style: 'labelSmall', color: '#888888' }),
      ]),
    ]),
  ]));
  items.push(UI.Spacer({ height: 8 }));

  // 待完成列表
  if (pendingTodos.length > 0) {
    var pendingItems = [];
    for (var tpi = 0; tpi < pendingTodos.length; tpi++) {
      (function(todo, tIdx) {
        var priColor = todo.priority === 'high' ? '#F44336' : todo.priority === 'medium' ? '#FF9800' : '#4CAF50';
        var priText = todo.priority === 'high' ? '高' : todo.priority === 'medium' ? '中' : '低';
        var realIdx = allTodos.indexOf(todo);
        var key = 'todos:' + realIdx;
        pendingItems.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 8 }, containerColor: 'surfaceVariant', padding: 8 }, [
          UI.Row({ fillMaxWidth: true, verticalAlignment: 'center' }, [
            UI.Surface({ width: 22, height: 22, shape: { cornerRadius: 11 }, containerColor: '#FFFFFF', border: { width: 2, color: '#FF5722' }, onClick: function() { toggleTodoItem(realIdx); } }, []),
            UI.Spacer({ width: 8 }),
            UI.Column({ weight: 1 }, [
              UI.Text({ text: todo.title || '未命名', style: 'bodySmall', fontWeight: 'bold', color: '#333333', maxLines: 1 }),
              UI.Row({}, [
                UI.Surface({ shape: { cornerRadius: 4 }, containerColor: priColor, alpha: 0.15, padding: { left: 4, right: 4, top: 1, bottom: 1 } }, [
                  UI.Text({ text: priText, style: 'labelSmall', color: priColor, fontSize: 9 }),
                ]),
                todo.dueDate ? UI.Text({ text: ' 截止 ' + todo.dueDate, style: 'labelSmall', color: '#999999', fontSize: 9 }) : null,
              ].filter(Boolean)),
            ]),
            makeDeleteBtn('todos', realIdx, key),
          ]),
        ]));
        pendingItems.push(UI.Spacer({ height: 3 }));
      })(pendingTodos[tpi], tpi);
    }
    items.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 10 }, containerColor: 'surfaceVariant', padding: 10 }, [
      UI.Column({}, [UI.Row({ verticalAlignment: 'center' }, [UI.Icon({ name: 'pending_actions', tint: '#FF5722', size: 18 }), UI.Spacer({ width: 6 }), UI.Text({ text: '待完成', style: 'titleSmall', fontWeight: 'bold', color: '#FF5722' })]), UI.Spacer({ height: 6 })].concat(pendingItems)),
    ]));
    items.push(UI.Spacer({ height: 8 }));
  }

  // 已完成列表
  if (completedTodos.length > 0) {
    var doneItems = [];
    for (var tdi = 0; tdi < completedTodos.length; tdi++) {
      (function(todo, tIdx) {
        var realIdx = allTodos.indexOf(todo);
        var key = 'todos:' + realIdx;
        doneItems.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 8 }, containerColor: '#E8F5E9', alpha: 0.5, padding: 8 }, [
          UI.Row({ fillMaxWidth: true, verticalAlignment: 'center' }, [
            UI.Surface({ width: 22, height: 22, shape: { cornerRadius: 11 }, containerColor: '#4CAF50', onClick: function() { toggleTodoItem(realIdx); } }, [
              UI.Row({ fillMaxWidth: true, height: 22, horizontalArrangement: 'center', verticalAlignment: 'center' }, [UI.Icon({ name: 'check', tint: '#FFFFFF', size: 14 })]),
            ]),
            UI.Spacer({ width: 8 }),
            UI.Text({ text: todo.title || '未命名', style: 'bodySmall', color: '#999999', maxLines: 1, textDecorationLine: 'lineThrough' }),
            makeDeleteBtn('todos', realIdx, key),
          ]),
        ]));
        doneItems.push(UI.Spacer({ height: 3 }));
      })(completedTodos[tdi], tdi);
    }
    items.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 10 }, containerColor: 'surfaceVariant', padding: 10 }, [
      UI.Column({}, [UI.Row({ verticalAlignment: 'center' }, [UI.Icon({ name: 'task_alt', tint: '#4CAF50', size: 18 }), UI.Spacer({ width: 6 }), UI.Text({ text: '已完成', style: 'titleSmall', fontWeight: 'bold', color: '#4CAF50' })]), UI.Spacer({ height: 6 })].concat(doneItems)),
    ]));
  }

  if (filteredTodos.length === 0) {
    items.push(UI.Column({ horizontalAlignment: 'center', fillMaxWidth: true, padding: 24 }, [
      UI.Icon({ name: 'checklist', tint: '#BBBBBB', size: 40 }),
      UI.Spacer({ height: 10 }),
      UI.Text({ text: '暂无待办事项', style: 'bodyMedium', color: '#999999' }),
    ]));
  }

  return items;
}

exports.render = render;