"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Screen;

function Screen(ctx) {
  var UI = ctx.UI;
  var colors = ctx.MaterialTheme.colorScheme;

  // 状态
  var dataState = ctx.useState('wdata', null);
  var loadedRef = ctx.useRef('wloaded', false);

  if (!loadedRef.current) {
    loadedRef.current = true;
    (async function() {
      try {
        var raw = await ctx.callTool('memory_system:load_saved_data', {});
        var r = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (r && r.success) {
          var todos = (r.extracted && r.extracted.todos) || [];
          var pending = todos.filter(function(t) { return !t.completed; }).length;
          var now = new Date();
          var timeStr = (now.getMonth()+1) + '/' + now.getDate() + ' ' + now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
          dataState[1]({ pending: pending, total: todos.length, updated: timeStr });
        }
      } catch(e) {}
    })();
  }

  var d = dataState[0];
  var pendingCount = d ? d.pending : 0;
  var totalCount = d ? d.total : 0;
  var lastUpdate = d ? d.updated : '';

  var items = [];

  // 标题行
  items.push(UI.Row({ fillMaxWidth: true, verticalAlignment: 'center', horizontalArrangement: 'spaceBetween' }, [
    UI.Row({ verticalAlignment: 'center' }, [
      UI.Icon({ name: 'checklist', tint: '#FF5722', size: 20 }),
      UI.Spacer({ width: 6 }),
      UI.Text({ text: '待办事项', style: 'titleSmall', fontWeight: 'bold', color: '#FF5722' }),
    ]),
    UI.Surface({ shape: { cornerRadius: 8 }, containerColor: '#FBE9E7', padding: { left: 8, right: 8, top: 2, bottom: 2 } }, [
      UI.Text({ text: String(pendingCount) + ' 项', style: 'labelSmall', color: '#BF360C', fontWeight: 'bold' }),
    ]),
  ]));
  items.push(UI.Spacer({ height: 6 }));

  if (pendingCount === 0 && totalCount === 0) {
    items.push(UI.Column({ horizontalAlignment: 'center', fillMaxWidth: true, padding: 16 }, [
      UI.Text({ text: '暂无待办数据', style: 'bodySmall', color: '#999999' }),
      UI.Text({ text: '请先打开侧边栏加载', style: 'labelSmall', color: '#BBBBBB' }),
    ]));
  } else if (pendingCount === 0) {
    items.push(UI.Column({ horizontalAlignment: 'center', fillMaxWidth: true, padding: 16 }, [
      UI.Icon({ name: 'check_circle', tint: '#4CAF50', size: 28 }),
      UI.Spacer({ height: 6 }),
      UI.Text({ text: '全部完成！', style: 'bodySmall', color: '#4CAF50', fontWeight: 'bold' }),
    ]));
  } else {
    var doneCount = totalCount - pendingCount;
    var pct = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0;

    items.push(UI.Column({ fillMaxWidth: true, spacing: 4 }, [
      UI.Row({ fillMaxWidth: true, verticalAlignment: 'center' }, [
        UI.Text({ text: '完成 ', style: 'labelMedium', color: colors.onSurfaceVariant }),
        UI.Text({ text: String(doneCount), style: 'labelMedium', color: '#4CAF50', fontWeight: 'bold' }),
        UI.Text({ text: ' / ', style: 'labelMedium', color: colors.onSurfaceVariant }),
        UI.Text({ text: String(totalCount), style: 'labelMedium', color: colors.onSurface, fontWeight: 'bold' }),
        UI.Spacer({ width: 8 }),
        UI.Text({ text: String(pct) + '%', style: 'labelSmall', color: '#4CAF50' }),
      ]),
      UI.LinearProgressIndicator({ fillMaxWidth: true, progress: pct / 100 }),
    ]));
  }

  if (lastUpdate) {
    items.push(UI.Spacer({ height: 2 }));
    items.push(UI.Text({ text: '更新: ' + lastUpdate, style: 'labelSmall', color: '#BBBBBB', fontSize: 9 }));
  }

  items.push(UI.Spacer({ height: 4 }));
  items.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 8 }, containerColor: '#4CAF50', alpha: 0.1, padding: { left: 10, right: 10, top: 6, bottom: 6 }, onClick: function() { ctx.navigate('toolpkg:com.operit.character_memory_system:ui:memory_system_ui', {}); }, key: 'openFull' }, [
    UI.Row({ fillMaxWidth: true, horizontalArrangement: 'center', verticalAlignment: 'center' }, [
      UI.Text({ text: '打开完整页面', style: 'labelSmall', color: '#4CAF50', fontWeight: 'bold' }),
    ]),
  ]));

  return UI.Column({ fillMaxSize: true, padding: 12, spacing: 4 }, items);
}
