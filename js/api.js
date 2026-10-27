// ============================================================
//  mimo API 封装（fetch）
//  - chat(): 大模型对话（文本 / 图片）
//  - asr():  语音转文字
//  - tts():  文字转语音（返回音频 base64）
// ============================================================
(function () {
  const C = window.APP_CONFIG;

  // 底层请求：带超时、key 校验、HTTP 错误处理
  async function _request(body, { useApiKeyHeader } = {}) {
    if (!C.API_KEY) throw new Error('NO_API_KEY');

    const headers = { 'Content-Type': 'application/json' };
    if (useApiKeyHeader) headers['api-key'] = C.API_KEY;
    else headers['Authorization'] = 'Bearer ' + C.API_KEY;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), C.TIMEOUT || 60000);
    let res;
    try {
      res = await fetch(C.BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error('请求超时');
      throw new Error(e.message || '网络请求失败');
    }
    clearTimeout(timer);

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    if (!res.ok) {
      throw new Error('HTTP ' + res.status + ': ' + (text || '').slice(0, 300));
    }
    return data;
  }

  // ---------- 大模型 ----------
  function buildContent({ text, imageDataUrl }) {
    const content = [];
    if (imageDataUrl) {
      content.push({ type: 'image_url', image_url: { url: imageDataUrl } });
    }
    if (text) content.push({ type: 'text', text });
    return content;
  }

  async function chat({ text, imageDataUrl } = {}) {
    const userContent = buildContent({ text, imageDataUrl });
    if (!userContent.length) throw new Error('EMPTY_INPUT');
    const body = {
      model: C.MODEL,
      messages: [
        { role: 'system', content: C.SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ],
      max_completion_tokens: C.MAX_TOKENS,
      thinking: { type: C.THINKING ? 'enabled' : 'disabled' }
    };
    const data = await _request(body);
    const answer = extractAnswer(data);
    if (!answer) throw new Error('空回答：' + JSON.stringify(data).slice(0, 200));
    return answer;
  }

  // ---------- ASR ----------
  // audioDataUrl: data:audio/xxx;base64,....
  async function asr(audioDataUrl) {
    if (!audioDataUrl) throw new Error('EMPTY_INPUT');
    const body = {
      model: C.ASR_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'input_audio', input_audio: { data: audioDataUrl } }
          ]
        }
      ],
      asr_options: { language: C.ASR_LANGUAGE || 'auto' }
    };
    const data = await _request(body);
    const t = extractAnswer(data);
    console.log('[asr] text=', t);
    return t;
  }

  // ---------- TTS ----------
  async function tts(text) {
    if (!text) throw new Error('EMPTY_INPUT');
    const messages = [];
    if (C.TTS_STYLE_PROMPT) messages.push({ role: 'user', content: C.TTS_STYLE_PROMPT });
    messages.push({ role: 'assistant', content: text });
    const body = {
      model: C.TTS_MODEL,
      messages,
      audio: { format: C.TTS_FORMAT || 'wav', voice: C.TTS_VOICE || 'Chloe' }
    };
    const data = await _request(body, { useApiKeyHeader: true });
    const b64 = extractAudio(data);
    if (!b64) throw new Error('TTS 无音频：' + JSON.stringify(data).slice(0, 200));
    return { base64: b64, format: C.TTS_FORMAT || 'wav' };
  }

  // ---------- 解析 ----------
  function extractAnswer(data) {
    if (!data || !data.choices || !data.choices.length) return '';
    const msg = data.choices[0].message;
    if (!msg) return '';
    if (typeof msg.content === 'string') return msg.content.trim();
    if (Array.isArray(msg.content)) {
      return msg.content
        .map((c) => (typeof c === 'string' ? c : c.text || ''))
        .join('')
        .trim();
    }
    return '';
  }

  function extractAudio(data) {
    if (!data || !data.choices || !data.choices.length) return '';
    const msg = data.choices[0].message || {};
    if (msg.audio && msg.audio.data) return stripPrefix(msg.audio.data);
    if (Array.isArray(msg.content)) {
      for (const c of msg.content) {
        if (c && c.audio && c.audio.data) return stripPrefix(c.audio.data);
        if (c && c.input_audio && c.input_audio.data) return stripPrefix(c.input_audio.data);
        if (c && c.type === 'audio' && c.data) return stripPrefix(c.data);
      }
    }
    if (data.audio && data.audio.data) return stripPrefix(data.audio.data);
    return '';
  }

  function stripPrefix(s) {
    if (typeof s !== 'string') return '';
    const i = s.indexOf('base64,');
    return i >= 0 ? s.slice(i + 'base64,'.length) : s;
  }

  window.MimoAPI = { chat, asr, tts };
})();
