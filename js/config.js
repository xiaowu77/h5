// ============================================================
//  mimo-view H5 配置
//  ⚠️ 纯前端 H5，API Key 会暴露在浏览器中，仅用于 Demo 演示！
// ============================================================

window.APP_CONFIG = {
  // mimo 接口地址
  BASE_URL: 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions',

  // API Key
  API_KEY: 'tp-cj7clpvml1f9sdf1864czieeu9xk0rz2kc4y338g531wj8dj',

  // 多模态大模型（文本 / 图片理解）
  MODEL: 'mimo-v2.6-pro',

  // ASR 语音转文字
  ASR_MODEL: 'mimo-v2.5-asr',
  ASR_LANGUAGE: 'zh', // zh / en / auto

  // TTS 文字转语音
  ENABLE_TTS: true,
  TTS_MODEL: 'mimo-v2.5-tts',
  TTS_VOICE: 'Chloe',
  TTS_FORMAT: 'wav',
  TTS_STYLE_PROMPT: '用自然、亲切、友好的语气朗读下面这段中文。',

  // 人设
  SYSTEM_PROMPT:
    '你是“个人助手”，由小米 MiMo 大模型驱动的智能语音助手。请用简洁、口语化、友好的中文回答用户的问题。当用户发来一张画面并提问时，请结合画面内容准确作答。回答控制在 3 句话以内，除非用户要求详细说明。',

  MAX_TOKENS: 1024,
  THINKING: false,
  TIMEOUT: 60000
};
