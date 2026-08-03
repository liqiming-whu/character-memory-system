"use strict";
exports.test_load_memories = async function () {
    var DATA_DIR = '/sdcard/Download/Operit/memory_system_data';
    var MEMORY_FILE = DATA_DIR + '/memories.json';
    try {
        var res = await Tools.Files.read(MEMORY_FILE);
        if (res && res.content) {
            var memories = JSON.parse(res.content);
            var summary = memories.map(function(m) {
                return {
                    id: m.id,
                    type: m.type,
                    title: m.title,
                    content: m.content ? m.content.substring(0, 50) : '',
                    timestamp: m.timestamp ? new Date(m.timestamp).toLocaleString('zh-CN') : ''
                };
            });
            complete({ success: true, total: memories.length, memories: summary });
        } else {
            complete({ success: false, message: '文件为空或读取失败', total: 0 });
        }
    } catch (e) {
        complete({ success: false, message: e.message || String(e), total: 0 });
    }
};