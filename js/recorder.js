// ============================================================
//  录音模块：getUserMedia + MediaRecorder
//  ASR 支持 mp3/flac/m4a/wav/ogg；MediaRecorder 常见输出 webm(不支持)/mp4(支持)/ogg(支持)
//  这里优先选 ASR 支持的 mimeType
// ============================================================
(function () {
  // MIME -> ASR format / 文件后缀
  // 优先级：mp4(m4a) > ogg > webm(兜底，可能被 ASR 拒绝)
  const PREFERRED = [
    { mime: 'audio/mp4', fmt: 'm4a' },
    { mime: 'audio/ogg;codecs=opus', fmt: 'ogg' },
    { mime: 'audio/ogg', fmt: 'ogg' },
    { mime: 'audio/webm;codecs=opus', fmt: 'webm' },
    { mime: 'audio/webm', fmt: 'webm' }
  ];

  let _stream = null;
  let _recorder = null;
  let _chunks = [];
  let _picked = null; // { mime, fmt }
  let _startAt = 0;

  function pickMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) {
      return null;
    }
    for (const p of PREFERRED) {
      if (MediaRecorder.isTypeSupported(p.mime)) return p;
    }
    return null; // 让浏览器用默认
  }

  async function _ensureStream() {
    if (_stream) return _stream;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('NO_GETUSERMEDIA');
    }
    _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return _stream;
  }

  async function start() {
    const stream = await _ensureStream();
    _picked = pickMime();
    _chunks = [];
    const opts = _picked ? { mimeType: _picked.mime } : undefined;
    _recorder = new MediaRecorder(stream, opts);
    _recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) _chunks.push(e.data);
    };
    _recorder.start();
    _startAt = Date.now();
  }

  // 返回 { dataUrl, format, duration, blob }
  function stop() {
    return new Promise((resolve, reject) => {
      if (!_recorder) {
        reject(new Error('未在录音'));
        return;
      }
      const rec = _recorder;
      rec.onstop = async () => {
        const duration = Date.now() - _startAt;
        const mime = (_picked && _picked.mime) || rec.mimeType || 'audio/webm';
        const fmt = (_picked && _picked.fmt) || mimeToFmt(mime);
        const blob = new Blob(_chunks, { type: mime });
        try {
          const dataUrl = await blobToDataUrl(blob, fmt);
          resolve({ dataUrl, format: fmt, duration, blob });
        } catch (e) {
          reject(e);
        }
        _recorder = null;
      };
      rec.stop();
    });
  }

  function mimeToFmt(mime) {
    if (mime.indexOf('mp4') > -1) return 'm4a';
    if (mime.indexOf('ogg') > -1) return 'ogg';
    if (mime.indexOf('webm') > -1) return 'webm';
    if (mime.indexOf('wav') > -1) return 'wav';
    return 'webm';
  }

  // 生成带正确 MIME 前缀的 dataURL（ASR 用）
  function blobToDataUrl(blob, fmt) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // reader 结果形如 data:audio/xxx;base64,....
        // 统一成 ASR 识别的 mime
        const mimeMap = {
          m4a: 'audio/m4a',
          ogg: 'audio/ogg',
          wav: 'audio/wav',
          mp3: 'audio/mpeg',
          webm: 'audio/webm'
        };
        const raw = reader.result;
        const base64 = raw.slice(raw.indexOf('base64,') + 'base64,'.length);
        resolve('data:' + (mimeMap[fmt] || 'audio/webm') + ';base64,' + base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // 释放麦克风（可选）
  function release() {
    if (_stream) {
      _stream.getTracks().forEach((t) => t.stop());
      _stream = null;
    }
  }

  window.Recorder = { start, stop, release, pickMime };
})();
