"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// ===== 共享 Prompt 构建器 =====
// main.js 与 memory_system.js 统一从这里取 prompt，避免两边提取规则分叉。

// 话题是否结束判断
function buildTopicCheckPrompt(dialogText, chatIdChanged) {
  var hint = chatIdChanged
    ? '\n注意：用户已经切换到了不同的对话窗口，这强烈暗示之前的对话可能已经结束。'
    : '';
  return '请判断以下对话的话题是否已经结束（用户很可能不会再继续这个话题了）。' + hint + '\n\n对话内容：\n' + dialogText + '\n\n请返回纯JSON（不要markdown代码块）：\n{"topicEnded": true或false, "reason": "简要理由"}';
}

// 结构化提取（合并 main.js 与 memory_system.js 两版规则，以更完整版为准）
// params: { dialogText, existingData?, existingSummary?, personaName? }
// existingData 传对象时自动生成已有数据摘要；传字符串则直接用为 existingSummary。
function buildExtractionPrompt(dialogText, existingData, personaName) {
  var existingSummary = '';
  if (typeof existingData === 'string') {
    existingSummary = existingData;
  } else if (existingData) {
    var parts = [];
    if (existingData.todos && existingData.todos.length > 0) {
      parts.push('已有待办: ' + existingData.todos.map(function(t) { return t.title; }).join('; '));
    }
    if (existingData.events && existingData.events.length > 0) {
      parts.push('已有事件: ' + existingData.events.slice(-20).map(function(e) { return e.title; }).join('; '));
    }
    if (existingData.info && existingData.info.length > 0) {
      parts.push('已有信息: ' + existingData.info.slice(-20).map(function(i) { return i.content; }).join('; '));
    }
    if (existingData.contacts && existingData.contacts.length > 0) {
      parts.push('已有联系人: ' + existingData.contacts.map(function(c) { return c.name; }).join('; '));
    }
    if (parts.length > 0) existingSummary = '\n\n【已有数据——不要重复提取语义相同的内容】\n' + parts.join('\n') + '\n';
  }

  var personaHint = personaName ? '\n当前角色卡：' + personaName + '。仅提取对该角色长期互动确有价值且由本段对话明确支持的内容。' : '\n当前没有可确认的角色卡，四个角色分类必须返回空数组。';

  var prompt = '你是一个记忆系统。请理解以下对话整体讲了什么，然后提取有价值的信息。' + personaHint + '\n\n核心原则：\n- 你是在理解一段对话后做总结，不是逐条扫描消息\n- 一段对话可能只产生0-2条有价值的提取，这是正常的\n- 过程噪音（反复调试、重复提问、工具调用细节）不要提取\n- 无效信息（"继续""好的""开始"等）完全忽略\n- 如果与已有数据语义重复，不要重复提取；同一事件措辞不同但语义相同（如“再嗨两小时”和“再嗨2小时”）也只保留一条\n- 不推断未明确表达的人格、感情或关系等级\n' + existingSummary + '\n返回纯JSON（不要markdown代码块，不要任何额外文字）：\n{"summary":"对话核心内容的精炼总结（保留有价值的信息、决策、结论。如果对话没有保留价值，留空字符串）","events":[{"type":"activity|schedule|observation|milestone|mood","title":"标题","description":"描述","importance":"high|medium|low","date":"YYYY-MM-DD","time":"HH:MM"}],"todos":[{"title":"待办事项","description":"描述","priority":"high|medium|low","dueDate":"YYYY-MM-DD或null","completed":false}],"contacts":[{"name":"姓名","relation":"friend|family|colleague|classmate|service|other","attributes":[{"key":"属性名","value":"值"}],"context":"提到这个人的场景"}],"info":[{"category":"类别","content":"内容"}],"finance":[{"type":"expense|income","category":"类别","amount":0,"description":"描述","date":"YYYY-MM-DD"}],"menstrual":[{"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD或null","symptoms":"症状描述"}],"character":[{"title":"标题","content":"角色身份或背景事实"}],"relationship":[{"title":"标题","content":"用户与角色的明确关系事实或共同经历"}],"preference":[{"title":"标题","content":"用户或角色明确表达的偏好"}],"interaction_rule":[{"title":"标题","content":"明确约定的称呼、回复风格或互动边界"}]}\n\n提取规则：\n1. events：有记录价值的事件。activity=做了什么事；schedule=有时间安排的事；observation=发现的现象；milestone=阶段性变化；mood=情绪\n2. todos：用户明确要做的事（"记得""要去""得买"等），不是已经做完的事\n3. contacts：提到的人物及其属性（生日/手机/喜好等）\n4. info：值得记住的知识/事实/参数（路径、密码提示、知识点等）\n5. finance：涉及花钱或收钱的记录\n6. menstrual：用户提到的经期记录，包括开始和结束日期及伴随症状\n7. character/relationship/preference/interaction_rule：仅在存在当前角色卡且事实明确时提取，否则返回空数组\n8. 某类没数据用空数组\n9. 同一件事不要拆成多条——"侧边栏一直转圈，反复调试"是1个事件不是6个\n\n分类补充：用户明确表达的稳定习惯、作息和长期个人事实优先归入 info，category 使用“用户习惯”或准确的事实类别，不要只塞进 contacts.attributes。\n\n对话内容：\n' + dialogText;

  return prompt;
}

exports.buildTopicCheckPrompt = buildTopicCheckPrompt;
exports.buildExtractionPrompt = buildExtractionPrompt;
