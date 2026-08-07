#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix fire-and-forget async onClick handlers in character-memory-system UI."""
import io, sys

BASE = "/root/cme_system_clone/ui/"

# (file, [(old, new, expected_count), ...])
PLAN = [
    ("memory_system_ui/tabs/character.js", [
        ("onClick: function() { deleteMemory(memory.title); }",
         "onClick: function() { return deleteMemory(memory.title); }", 1),
    ]),
    ("memory_system_ui/screen.js", [
        ("onClick: function() { if (!analyzing) doAnalyze(); }",
         "onClick: function() { if (!analyzing) return doAnalyze(); }", 1),
    ]),
    ("memory_system_ui/tabs/todos.js", [
        ("onClick: function() { toggleTodoItem(realIdx); }",
         "onClick: function() { return toggleTodoItem(realIdx); }", 2),
        ("        deleteItem(category, index);",
         "        return deleteItem(category, index);", 1),
    ]),
    ("memory_system_ui/tabs/knowledge.js", [
        ("        actions.deleteItem(category, index);",
         "        return actions.deleteItem(category, index);", 1),
    ]),
    ("memory_system_ui/tabs/timeline.js", [
        ("        actions.deleteItem(category, index);",
         "        return actions.deleteItem(category, index);", 1),
    ]),
    ("memory_system_ui/tabs/messages.js", [
        ("ctx.callTool('memory_system:analyze_saved_messages', { chat_id: targetChatId }).then(function(raw) {",
         "return ctx.callTool('memory_system:analyze_saved_messages', { chat_id: targetChatId }).then(function(raw) {", 1),
        ("      (function() {\n        var _asyncAnalyze",
         "      return (function() {\n        var _asyncAnalyze", 1),
        ("        _asyncAnalyze();",
         "        return _asyncAnalyze();", 1),
        ("      ctx.callTool('memory_system:analyze_saved_messages', {\n        chat_id: chat.chatId,",
         "      return ctx.callTool('memory_system:analyze_saved_messages', {\n        chat_id: chat.chatId,", 1),
        ("                  ctx.callTool('memory_system:analyze_saved_messages', {\n                    chat_id: targetChatId,\n                    message_index: targetIdx",
         "                  return ctx.callTool('memory_system:analyze_saved_messages', {\n                    chat_id: targetChatId,\n                    message_index: targetIdx", 1),
    ]),
]

failed = False
for rel, rules in PLAN:
    path = BASE + rel
    with io.open(path, "r", encoding="utf-8") as f:
        src = f.read()
    for old, new, expect in rules:
        cnt = src.count(old)
        if cnt != expect:
            print("FAIL %s: pattern x%d expected x%d -> %r" % (rel, cnt, expect, old[:60]))
            failed = True
            continue
        src = src.replace(old, new)
        print("OK   %s: %d replacement(s) -> %s" % (rel, cnt, new[:60]))
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(src)

sys.exit(1 if failed else 0)
