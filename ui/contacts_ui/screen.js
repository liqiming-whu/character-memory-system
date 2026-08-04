"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Screen;

const theme = require("../memory_system_ui/theme");

function Screen(ctx) {
  var UI = ctx.UI;
  var colors = theme.c(ctx.MaterialTheme && ctx.MaterialTheme.colorScheme);

  // 状态
  var dataState = ctx.useState('cdata', null);
  var queryState = ctx.useState('cquery', '');
  var groupFilterState = ctx.useState('cgroup', '');
  var selectedContactState = ctx.useState('csel', -1);
  var initRef = ctx.useRef('cinit', false);

  // 图标映射（颜色走 Material token）
  var relationMap = {
    family: { label: '家人', icon: 'family_restroom', color: colors.error, bg: colors.errorContainer },
    colleague: { label: '同事', icon: 'work', color: colors.primary, bg: colors.primaryContainer },
    classmate: { label: '同学', icon: 'school', color: colors.tertiary, bg: colors.tertiaryContainer },
    friend: { label: '朋友', icon: 'sentiment_satisfied_alt', color: colors.primary, bg: colors.primaryContainer },
    service: { label: '服务', icon: 'support_agent', color: colors.tertiary, bg: colors.tertiaryContainer },
    other: { label: '其他', icon: 'person', color: colors.onSurfaceVariant, bg: colors.surfaceVariant }
  };
  var groupOrder = ['family', 'colleague', 'friend', 'classmate', 'service', 'other'];

  // 加载数据
  if (!initRef.current) {
    initRef.current = true;
    (async function() {
      try {
        var raw = await ctx.callTool('memory_system:load_saved_data', {});
        var r = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (r && r.success) {
          dataState[1](r.extracted && r.extracted.contacts || []);
        }
      } catch(e) {}
    })();
  }

  var allContacts = dataState[0] || [];
  var q = (queryState[0] || '').toLowerCase();
  var groupFilter = groupFilterState[0] || '';
  var selIdx = selectedContactState[0];

  // 过滤
  var filtered = allContacts.filter(function(c) {
    if (groupFilter && (c.relation || 'other') !== groupFilter) return false;
    if (q) {
      var t = ((c.name || '') + ' ' + (c.context || '') + ' ' + ((c.contexts || []).map(function(x){return x.text;}).join(' '))).toLowerCase();
      if (t.indexOf(q) < 0) return false;
    }
    return true;
  });

  // 按关系分组
  var contactGroups = {};
  for (var gi = 0; gi < filtered.length; gi++) {
    var rel = filtered[gi].relation || 'other';
    if (!contactGroups[rel]) contactGroups[rel] = [];
    contactGroups[rel].push(filtered[gi]);
  }

  // 关系颜色环（用于顶部可视化）
  var activeGroups = groupOrder.filter(function(g) { return contactGroups[g] && contactGroups[g].length > 0; });

  var items = [];

  // 标题
  items.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 14 }, containerColor: colors.tertiary, alpha: 0.08, padding: 14, key: 'cTitle' }, [
    UI.Row({ verticalAlignment: 'center' }, [
      UI.Surface({ width: 44, height: 44, shape: { cornerRadius: 22 }, containerColor: colors.tertiary }, [
        UI.Row({ fillMaxWidth: true, height: 44, horizontalArrangement: 'center', verticalAlignment: 'center' }, [
          UI.Icon({ name: 'diversity_3', tint: colors.onPrimary, size: 24 }),
        ]),
      ]),
      UI.Spacer({ width: 12 }),
      UI.Column({}, [
        UI.Text({ text: '人际关系', style: 'titleMedium', fontWeight: 'bold', color: colors.tertiary }),
        UI.Text({ text: '共 ' + allContacts.length + ' 位联系人，' + activeGroups.length + ' 个分组', style: 'bodySmall', color: colors.onSurfaceVariant }),
      ]),
    ]),
  ]));
  items.push(UI.Spacer({ height: 8 }));

  // 关系分组条（可点选筛选）
  var filterChips = [];
  // 全部
  filterChips.push(UI.FilterChip({
    label: UI.Text({ text: '全部 (' + filtered.length + ')', style: 'labelSmall' }),
    selected: !groupFilter,
    onClick: function() { groupFilterState[1](''); selectedContactState[1](-1); },
    key: 'chip-all'
  }));
  for (var fi = 0; fi < groupOrder.length; fi++) {
    (function(gk) {
      var gInfo = relationMap[gk];
      var cnt = contactGroups[gk] ? contactGroups[gk].length : 0;
      if (cnt === 0) return;
      var isSel = groupFilter === gk;
      filterChips.push(UI.FilterChip({
        label: UI.Text({ text: gInfo.label + ' (' + cnt + ')', style: 'labelSmall', color: isSel ? colors.primary : colors.onSurfaceVariant }),
        selected: isSel,
        onClick: function() { groupFilterState[1](isSel ? '' : gk); selectedContactState[1](-1); },
        key: 'chip-' + gk
      }));
    })(groupOrder[fi]);
  }
  items.push(UI.Row({ fillMaxWidth: true, spacing: 6, key: 'chips' }, filterChips));
  items.push(UI.Spacer({ height: 6 }));

  // 搜索
  items.push(UI.Surface({ shape: { cornerRadius: 10 }, containerColor: colors.surfaceVariant, padding: { left: 10, right: 10, top: 4, bottom: 4 }, key: 'cSearch' }, [
    UI.Row({ verticalAlignment: 'center' }, [
      UI.Icon({ name: 'search', tint: colors.outline, size: 16 }),
      UI.Spacer({ width: 6 }),
      UI.TextField({ value: queryState[0] || '', onValueChange: function(v) { queryState[1](v); selectedContactState[1](-1); }, placeholder: '搜索联系人...', weight: 1, singleLine: true }),
    ]),
  ]));
  items.push(UI.Spacer({ height: 8 }));

  // 选中详情
  if (selIdx >= 0 && selIdx < filtered.length) {
    (function() {
      var sc = filtered[selIdx];
      var rInfo = relationMap[sc.relation || 'other'];
      var attrs = sc.attributes || [];
      var ctxs = sc.contexts || [];
      if (!ctxs.length && sc.context) ctxs = [{ text: sc.context, date: '' }];
      var lastDate = sc.lastMentioned ? new Date(sc.lastMentioned).toLocaleDateString('zh-CN') : '';

      var detail = [];
      // 头部
      detail.push(UI.Row({ fillMaxWidth: true, horizontalArrangement: 'spaceBetween', verticalAlignment: 'center' }, [
        UI.Row({ verticalAlignment: 'center', weight: 1 }, [
          UI.Surface({ width: 48, height: 48, shape: { cornerRadius: 24 }, containerColor: rInfo.color }, [
            UI.Row({ fillMaxWidth: true, height: 48, horizontalArrangement: 'center', verticalAlignment: 'center' }, [
              UI.Text({ text: (sc.name || '?').charAt(0), style: 'titleMedium', fontWeight: 'bold', color: colors.onPrimary }),
            ]),
          ]),
          UI.Spacer({ width: 12 }),
          UI.Column({ weight: 1 }, [
            UI.Text({ text: sc.name || '未知', style: 'titleSmall', fontWeight: 'bold', color: colors.onSurface }),
            UI.Row({ verticalAlignment: 'center' }, [
              UI.Surface({ shape: { cornerRadius: 6 }, containerColor: rInfo.bg, padding: { left: 8, right: 8, top: 2, bottom: 2 } }, [
                UI.Row({ verticalAlignment: 'center' }, [
                  UI.Icon({ name: rInfo.icon, tint: rInfo.color, size: 12 }),
                  UI.Spacer({ width: 4 }),
                  UI.Text({ text: rInfo.label, style: 'labelSmall', color: rInfo.color, fontSize: 10, fontWeight: 'bold' }),
                ]),
              ]),
              UI.Spacer({ width: 8 }),
              UI.Text({ text: '提及 ' + (sc.mentionCount || 1) + ' 次', style: 'labelSmall', color: colors.outline, fontSize: 10 }),
            ]),
          ]),
        ]),
        UI.Surface({ shape: { cornerRadius: 10 }, containerColor: colors.surfaceVariant, padding: { left: 8, right: 8, top: 4, bottom: 4 }, onClick: function() { selectedContactState[1](-1); } }, [
          UI.Icon({ name: 'close', tint: colors.onSurfaceVariant, size: 18 }),
        ]),
      ]));

      // 属性卡
      if (attrs.length > 0) {
        detail.push(UI.Spacer({ height: 10 }));
        detail.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 10 }, containerColor: colors.tertiaryContainer, padding: 10, key: 'cdAttrs' }, [
          UI.Column({}, [
            UI.Row({ verticalAlignment: 'center' }, [
              UI.Icon({ name: 'badge', tint: colors.tertiary, size: 16 }),
              UI.Spacer({ width: 6 }),
              UI.Text({ text: '属性信息', style: 'labelMedium', fontWeight: 'bold', color: colors.tertiary }),
            ]),
            UI.Spacer({ height: 6 }),
          ].concat(attrs.map(function(a, idx) {
            return UI.Row({ fillMaxWidth: true, verticalAlignment: 'center', key: 'cda-' + idx }, [
              UI.Surface({ shape: { cornerRadius: 6 }, containerColor: colors.tertiaryContainer, padding: { left: 8, right: 8, top: 3, bottom: 3 }, key: 'cdak-' + idx }, [
                UI.Text({ text: a.key, style: 'labelSmall', color: colors.tertiary, fontSize: 11, fontWeight: 'bold' }),
              ]),
              UI.Spacer({ width: 8 }),
              UI.Text({ text: a.value, style: 'bodySmall', color: colors.onSurface, weight: 1 }),
            ]);
          }))),
        ]));
      }

      // 提及时间线
      if (ctxs.length > 0) {
        detail.push(UI.Spacer({ height: 10 }));
        detail.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 10 }, containerColor: colors.surfaceVariant, padding: 10, key: 'cdCtx' }, [
          UI.Column({}, [
            UI.Row({ verticalAlignment: 'center' }, [
              UI.Icon({ name: 'history', tint: colors.tertiary, size: 16 }),
              UI.Spacer({ width: 6 }),
              UI.Text({ text: '提及记录 (' + ctxs.length + ')', style: 'labelMedium', fontWeight: 'bold', color: colors.tertiary }),
            ]),
            UI.Spacer({ height: 6 }),
          ].concat(ctxs.slice(-10).reverse().map(function(cx, cxi) {
            return UI.Row({ fillMaxWidth: true, verticalAlignment: 'top', key: 'cdcx-' + cxi }, [
              UI.Column({ horizontalAlignment: 'center', width: 20 }, [
                UI.Surface({ width: 8, height: 8, shape: { cornerRadius: 4 }, containerColor: colors.tertiary, key: 'cdot-' + cxi }),
                cxi < Math.min(ctxs.length, 10) - 1 ? UI.Surface({ width: 2, height: 20, containerColor: colors.outlineVariant, key: 'dline-' + cxi }) : null,
              ].filter(Boolean)),
              UI.Spacer({ width: 8 }),
              UI.Column({ weight: 1 }, [
                UI.Text({ text: cx.text || '', style: 'bodySmall', color: colors.onSurfaceVariant, fontSize: 12 }),
                cx.date ? UI.Text({ text: new Date(cx.date).toLocaleDateString('zh-CN'), style: 'labelSmall', color: colors.outlineVariant, fontSize: 9 }) : null,
              ].filter(Boolean)),
            ]);
          })).concat(ctxs.length > 10 ? [UI.Text({ text: '... 还有 ' + (ctxs.length - 10) + ' 条记录', style: 'labelSmall', color: colors.outlineVariant, fontSize: 10 })] : [])),
        ]));
      }

      if (lastDate) {
        detail.push(UI.Spacer({ height: 4 }));
        detail.push(UI.Row({ fillMaxWidth: true, horizontalArrangement: 'end' }, [
          UI.Text({ text: '最近提及: ' + lastDate, style: 'labelSmall', color: colors.outline, fontSize: 10 }),
        ]));
      }

      items.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 14 }, containerColor: colors.surface, border: { width: 2, color: colors.outlineVariant }, padding: 14, key: 'cDetailPanel' }, [
        UI.Column({ spacing: 4 }, detail),
      ]));
      items.push(UI.Spacer({ height: 8 }));
    })();
  }

  // 联系人列表
  if (filtered.length === 0) {
    items.push(UI.Column({ horizontalAlignment: 'center', fillMaxWidth: true, padding: 32 }, [
      UI.Icon({ name: 'group_off', tint: colors.outlineVariant, size: 48 }),
      UI.Spacer({ height: 12 }),
      UI.Text({ text: '暂无联系人数据', style: 'bodyMedium', color: colors.outline }),
      UI.Text({ text: '聊天中提到的人物将被自动提取', style: 'bodySmall', color: colors.outlineVariant }),
    ]));
  } else {
    // 按分组展示
    for (var ggi = 0; ggi < groupOrder.length; ggi++) {
      (function(groupKey) {
        var group = contactGroups[groupKey];
        if (!group || group.length === 0) return;
        var rInfo = relationMap[groupKey];

        // 分组标题
        items.push(UI.Row({ fillMaxWidth: true, verticalAlignment: 'center', key: 'grp-' + groupKey }, [
          UI.Surface({ width: 28, height: 28, shape: { cornerRadius: 14 }, containerColor: rInfo.color, alpha: 0.15 }, [
            UI.Row({ fillMaxWidth: true, height: 28, horizontalArrangement: 'center', verticalAlignment: 'center' }, [
              UI.Icon({ name: rInfo.icon, tint: rInfo.color, size: 16 }),
            ]),
          ]),
          UI.Spacer({ width: 8 }),
          UI.Text({ text: rInfo.label, style: 'labelMedium', fontWeight: 'bold', color: rInfo.color }),
          UI.Spacer({ width: 6 }),
          UI.Surface({ shape: { cornerRadius: 8 }, containerColor: rInfo.bg, padding: { left: 6, right: 6, top: 1, bottom: 1 } }, [
            UI.Text({ text: String(group.length) + ' 人', style: 'labelSmall', color: rInfo.color, fontSize: 10 }),
          ]),
        ]));
        items.push(UI.Spacer({ height: 4 }));

        for (var cci = 0; cci < group.length; cci++) {
          (function(c, gIdx) {
            var globalIdx = filtered.indexOf(c);
            var isSel = globalIdx === selIdx;
            var initial = c.name ? c.name.charAt(0) : '?';
            var attrs = c.attributes || [];
            var ctxs = c.contexts || [];
            if (!ctxs.length && c.context) ctxs = [{ text: c.context, date: '' }];
            var lastCtx = ctxs.length > 0 ? ctxs[ctxs.length - 1].text : '';

            var cardItems = [];
            cardItems.push(UI.Row({ fillMaxWidth: true, verticalAlignment: 'center' }, [
              UI.Surface({ width: 38, height: 38, shape: { cornerRadius: 19 }, containerColor: rInfo.color }, [
                UI.Row({ fillMaxWidth: true, height: 38, horizontalArrangement: 'center', verticalAlignment: 'center' }, [
                  UI.Text({ text: initial, style: 'labelMedium', fontWeight: 'bold', color: colors.onPrimary }),
                ]),
              ]),
              UI.Spacer({ width: 10 }),
              UI.Column({ weight: 1 }, [
                UI.Row({ verticalAlignment: 'center' }, [
                  UI.Text({ text: c.name || '未知', style: 'bodySmall', fontWeight: 'bold', color: colors.onSurface }),
                ]),
                UI.Row({ verticalAlignment: 'center' }, [
                  UI.Surface({ shape: { cornerRadius: 4 }, containerColor: rInfo.bg, padding: { left: 4, right: 4, top: 1, bottom: 1 } }, [
                    UI.Text({ text: rInfo.label, style: 'labelSmall', color: rInfo.color, fontSize: 9 }),
                  ]),
                  UI.Spacer({ width: 4 }),
                  UI.Text({ text: (c.mentionCount || 1) + '次', style: 'labelSmall', color: colors.outlineVariant, fontSize: 9 }),
                  attrs.length > 0 ? UI.Text({ text: ' · ' + attrs.length + '个属性', style: 'labelSmall', color: colors.outlineVariant, fontSize: 9 }) : null,
                ].filter(Boolean)),
                lastCtx ? UI.Text({ text: lastCtx, style: 'labelSmall', color: colors.outline, fontSize: 10, maxLines: 1 }) : null,
              ].filter(Boolean)),
              UI.Icon({ name: isSel ? 'expand_less' : 'chevron_right', tint: rInfo.color, size: 18 }),
            ]));

            items.push(UI.Surface({ fillMaxWidth: true, shape: { cornerRadius: 10 }, containerColor: isSel ? rInfo.bg : colors.surfaceVariant, padding: 10, onClick: function() { selectedContactState[1](isSel ? -1 : globalIdx); }, key: 'cc-' + gIdx }, [
              UI.Column({}, cardItems),
            ]));
            items.push(UI.Spacer({ height: 3 }));
          })(group[cci], groupKey + '-' + cci);
        }
        items.push(UI.Spacer({ height: 6 }));
      })(groupOrder[ggi]);
    }
  }

  return UI.Column({ fillMaxSize: true, padding: 10, spacing: 4 }, items);
}
