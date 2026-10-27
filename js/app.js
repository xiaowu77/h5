// ============================================================
//  主逻辑：按住说话 -> ASR -> 大模型 -> TTS；摄像头全场景
// ============================================================
(function () {
  const C = window.APP_CONFIG;
  const { chat, asr, tts } = window.MimoAPI;

  const HINT_IDLE = '你可以开始说话';
  const HINT_SCENE = '对准画面，按住麦克风提问';

  // DOM
  const $ = (id) => document.getElementById(id);
  const page = $('page');
  const navTitle = $('navTitle');
  const content = $('content');
  const answerArea = $('answerArea');
  const avatarWrap = $('avatarWrap');
  const sceneAnswer = $('sceneAnswer');
  const sceneQ = $('sceneQ');
  const sceneA = $('sceneA');
  const hint = $('hint');
  const cameraEl = $('camera');
  const recordingMask = $('recordingMask');
  const loadingMask = $('loadingMask');
  const loadingText = $('loadingText');
  const ttsAudio = $('ttsAudio');
  const ttsIcon = $('ttsIcon');

  // 按钮
  const btnCamera = $('btnCamera');
  const btnReset = $('btnReset');
  const btnMic = $('btnMic');
  const btnClose = $('btnClose');
  const btnTts = $('btnTts');

  // 状态
  const state = {
    sceneMode: false,
    recording: false,
    thinking: false,
    ttsEnabled: C.ENABLE_TTS !== false,
    micPressing: false,
    longPress: false
  };
  let micTimer = null;

  // ---------- UI 辅助 ----------
  function setHint(t) {
    hint.textContent = t;
  }
  function showRecording(show) {
    recordingMask.style.display = show ? 'flex' : 'none';
  }
  function showLoading(show, text) {
    loadingMask.style.display = show ? 'flex' : 'none';
    if (text) loadingText.textContent = text;
  }
  function setThinking(v) {
    state.thinking = v;
    avatarWrap.classList.toggle('pulsing', v);
    showLoading(v, '思考中…');
  }
  function pushBubble(role, text) {
    const div = document.createElement('div');
    div.className = 'bubble bubble-' + role;
    div.textContent = text;
    answerArea.appendChild(div);
    answerArea.scrollTop = answerArea.scrollHeight;
  }
  function updateTtsIcon() {
    ttsIcon.className = 'icon ' + (state.ttsEnabled ? 'icon-volume-on' : 'icon-volume-off');
  }

  // ---------- TTS 播放 ----------
  function stopTts() {
    try {
      ttsAudio.pause();
      ttsAudio.currentTime = 0;
    } catch (e) {}
  }
  function playTts(base64, format) {
    return new Promise((resolve) => {
      if (!base64) return resolve();
      const mime = format === 'wav' ? 'audio/wav' : 'audio/' + (format || 'wav');
      ttsAudio.src = 'data:' + mime + ';base64,' + base64;
      ttsAudio.onended = () => resolve();
      ttsAudio.onerror = () => resolve();
      const p = ttsAudio.play();
      if (p && p.catch) p.catch(() => resolve());
    });
  }

  // ---------- 麦克风（按住说话）----------
  function onMicDown(e) {
    e.preventDefault();
    if (state.thinking) return;
    state.micPressing = true;
    state.longPress = false;
    clearTimeout(micTimer);
    micTimer = setTimeout(beginRecord, 300);
  }

  async function beginRecord() {
    if (!state.micPressing) return;
    try {
      await window.Recorder.start();
    } catch (err) {
      handleMediaError(err, '麦克风');
      return;
    }
    if (!state.micPressing) {
      // 已松手，立即停掉
      try { await window.Recorder.stop(); } catch (e) {}
      return;
    }
    state.longPress = true;
    state.recording = true;
    btnMic.classList.add('active');
    showRecording(true);
    setHint('正在聆听…');
  }

  async function onMicUp(e) {
    if (e) e.preventDefault();
    state.micPressing = false;
    clearTimeout(micTimer);

    if (!state.longPress) {
      if (state.recording) {
        state.recording = false;
        btnMic.classList.remove('active');
        showRecording(false);
      }
      return;
    }
    state.longPress = false;
    if (!state.recording) return;

    state.recording = false;
    btnMic.classList.remove('active');
    showRecording(false);

    let result;
    try {
      result = await window.Recorder.stop();
    } catch (err) {
      setHint(state.sceneMode ? HINT_SCENE : HINT_IDLE);
      return;
    }
    if (!result || !result.dataUrl || result.duration < 500) {
      toast('说话时间太短');
      setHint(state.sceneMode ? HINT_SCENE : HINT_IDLE);
      return;
    }
    askMimo(result.dataUrl, result.format);
  }

  // ---------- 核心三段式 ----------
  async function askMimo(audioDataUrl, audioFormat) {
    stopTts();

    // 1) ASR
    setThinking(true);
    showLoading(true, '正在识别…');
    let userText = '';
    try {
      userText = await asr(audioDataUrl);
    } catch (err) {
      setThinking(false);
      alertError(err, '语音识别失败', audioFormat);
      return;
    }
    if (!userText) {
      setThinking(false);
      toast('没听清，请再说一次');
      setHint(state.sceneMode ? HINT_SCENE : HINT_IDLE);
      return;
    }

    if (state.sceneMode) {
      sceneQ.textContent = '我：' + userText;
      sceneA.textContent = '';
      sceneAnswer.style.display = 'block';
    } else {
      pushBubble('user', userText);
    }

    // 2) 大模型
    showLoading(true, '思考中…');
    const payload = { text: userText };
    if (state.sceneMode) {
      const img = window.Camera.capture();
      if (img) {
        payload.imageDataUrl = img;
        payload.text = userText + '（请结合画面回答）';
      }
    }

    let answer = '';
    try {
      answer = await chat(payload);
    } catch (err) {
      setThinking(false);
      alertError(err, '回答失败');
      return;
    }

    if (state.sceneMode) {
      sceneA.textContent = answer;
      setHint(HINT_SCENE);
    } else {
      pushBubble('ai', answer);
      setHint(HINT_IDLE);
    }
    setThinking(false);

    // 3) TTS
    if (state.ttsEnabled && answer) {
      speak(answer);
    }
  }

  async function speak(text) {
    try {
      const { base64, format } = await tts(text);
      await playTts(base64, format);
    } catch (e) {
      console.warn('[tts] 合成/播放失败，跳过', e);
    }
  }

  // ---------- 全场景 ----------
  async function toggleScene() {
    if (state.sceneMode) {
      exitScene();
      return;
    }
    try {
      await window.Camera.open(cameraEl);
    } catch (err) {
      handleMediaError(err, '摄像头');
      return;
    }
    state.sceneMode = true;
    page.classList.add('scene-mode');
    btnCamera.classList.add('active');
    sceneAnswer.style.display = 'none';
    sceneQ.textContent = '';
    sceneA.textContent = '';
    setHint(HINT_SCENE);
  }

  function exitScene() {
    window.Camera.close();
    state.sceneMode = false;
    page.classList.remove('scene-mode');
    btnCamera.classList.remove('active');
    sceneAnswer.style.display = 'none';
    setHint(HINT_IDLE);
  }

  // ---------- 其它按钮 ----------
  function onReset() {
    stopTts();
    answerArea.innerHTML = '';
    sceneQ.textContent = '';
    sceneA.textContent = '';
    sceneAnswer.style.display = 'none';
    setHint(state.sceneMode ? HINT_SCENE : HINT_IDLE);
  }

  function onClose() {
    if (state.sceneMode) exitScene();
    else onReset();
  }

  function toggleTts() {
    state.ttsEnabled = !state.ttsEnabled;
    if (!state.ttsEnabled) stopTts();
    updateTtsIcon();
    toast(state.ttsEnabled ? '已开启语音播报' : '已关闭语音播报');
  }

  // ---------- 错误 / 提示 ----------
  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText =
      'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
      'background:rgba(0,0,0,.75);color:#fff;padding:10px 18px;border-radius:10px;' +
      'font-size:14px;z-index:200;';
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1500);
  }

  function alertError(err, title, audioFormat) {
    console.error(title, err);
    const msg = (err && err.message) || '';
    let tip = '请求失败，请重试';
    if (msg === 'NO_API_KEY') tip = '请在 js/config.js 填写 API Key';
    else if (msg.indexOf('超时') > -1) tip = '请求超时，请检查网络';
    else if (msg.indexOf('HTTP 401') > -1) tip = 'API Key 无效或已过期';
    else if (msg.indexOf('audio format') > -1 || (audioFormat === 'webm'))
      tip = '当前浏览器录音格式不被支持，请改用 Safari 打开';
    else if (msg.indexOf('HTTP') > -1) tip = '服务返回错误：' + msg;
    else if (msg.indexOf('Failed to fetch') > -1) tip = '网络或跨域错误';
    alert(title + '：' + tip);
    setHint(state.sceneMode ? HINT_SCENE : HINT_IDLE);
  }

  function handleMediaError(err, name) {
    console.error(name + '访问失败', err);
    const msg = (err && (err.name || err.message)) || '';
    let tip = '无法访问' + name;
    if (msg === 'NO_GETUSERMEDIA' || msg.indexOf('getUserMedia') > -1) {
      tip = '当前环境不支持' + name + '，请用 Safari/Chrome 打开，并确保是 https 访问';
    } else if (msg === 'NotAllowedError' || msg.indexOf('Permission') > -1) {
      tip = name + '权限被拒绝，请在浏览器设置中允许';
    } else if (msg === 'NotFoundError') {
      tip = '未找到' + name + '设备';
    }
    alert(tip);
    if (name === '摄像头') {
      state.sceneMode = false;
      page.classList.remove('scene-mode');
      btnCamera.classList.remove('active');
    }
    showRecording(false);
    btnMic.classList.remove('active');
    state.recording = false;
  }

  // ---------- 事件绑定 ----------
  // 麦克风：触摸 + 鼠标（兼容桌面调试）
  btnMic.addEventListener('touchstart', onMicDown, { passive: false });
  btnMic.addEventListener('touchend', onMicUp, { passive: false });
  btnMic.addEventListener('touchcancel', onMicUp, { passive: false });
  btnMic.addEventListener('mousedown', onMicDown);
  window.addEventListener('mouseup', onMicUp);

  btnCamera.addEventListener('click', toggleScene);
  btnReset.addEventListener('click', onReset);
  btnClose.addEventListener('click', onClose);
  btnTts.addEventListener('click', toggleTts);

  // 初始化
  updateTtsIcon();
  setHint(HINT_IDLE);

  // 微信内置浏览器提示
  if (/MicroMessenger/i.test(navigator.userAgent)) {
    setTimeout(() => {
      toast('建议点右上角用 Safari/浏览器打开，以使用麦克风和摄像头');
    }, 800);
  }
})();
