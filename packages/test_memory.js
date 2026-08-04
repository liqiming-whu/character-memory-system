"use strict";
exports.test_load_memories = async function () {
    try {
        var result = await Tools.Memory.query({ query: '*', limit: 50 });
        var memories = result && result.memories ? result.memories : [];
        var summary = memories.map(function(m) {
            return {
                id: m.id || m.title,
                title: m.title,
                content: m.content ? m.content.substring(0, 50) : '',
                timestamp: m.createdAt || m.timestamp ? new Date(m.createdAt || m.timestamp).toLocaleString('zh-CN') : ''
            };
        });
        complete({ success: true, total: memories.length, memories: summary });
    } catch (e) {
        complete({ success: false, message: e.message || String(e), total: 0 });
    }
};
