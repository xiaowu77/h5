// ============================================================
//  录音模块：Web Audio API 采集 PCM -> 编码为 WAV
//  原因：mimo ASR 只接受 wav/mp3，而 MediaRecorder 无法直接输出 wav，
//  因此用 AudioContext 采集原始 PCM，再手动封装成 WAV。
// ============================================================
(function () {
  const TARGET_RATE = 16000; // ASR 友好采样率

  let _stream = null;
  let _audioCtx = null;
  let _source = null;
  let _processor = null;
  let _buffers = []; // Float32 分片
  let _recording = false;
  let _startAt = 0;
  let _inputRate = 44100;

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
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('NO_AUDIOCONTEXT');
    _audioCtx = new AC();
    // 某些浏览器 AudioContext 初始为 suspended，需要 resume
    if (_audioCtx.state === 'suspended') {
      try { await _audioCtx.resume(); } catch (e) {}
    }
    _inputRate = _audioCtx.sampleRate;
    _source = _audioCtx.createMediaStreamSource(stream);

    // 用 ScriptProcessor（兼容性最好；AudioWorklet 更现代但需额外文件）
    const bufSize = 4096;
    _processor = _audioCtx.createScriptProcessor(bufSize, 1, 1);
    _buffers = [];
    _processor.onaudioprocess = (e) => {
      if (!_recording) return;
      const data = e.inputBuffer.getChannelData(0);
      _buffers.push(new Float32Array(data));
    };
    _source.connect(_processor);
    _processor.connect(_audioCtx.destination);

    _recording = true;
    _startAt = Date.now();
  }

  function stop() {
    return new Promise((resolve, reject) => {
      if (!_recording) {
        reject(new Error('未在录音'));
        return;
      }
      _recording = false;
      const duration = Date.now() - _startAt;

      // 断开节点
      try {
        _processor.disconnect();
        _source.disconnect();
      } catch (e) {}

      // 合并 PCM
      const merged = mergeBuffers(_buffers);
      // 重采样到 16k
      const resampled = downsample(merged, _inputRate, TARGET_RATE);
      // 编码 WAV
      const wavBuffer = encodeWav(resampled, TARGET_RATE);
      const base64 = arrayBufferToBase64(wavBuffer);
      const dataUrl = 'data:audio/wav;base64,' + base64;

      // 关闭 AudioContext（可选，释放资源）
      try { _audioCtx.close(); } catch (e) {}
      _audioCtx = null;

      resolve({ dataUrl, format: 'wav', duration });
    });
  }

  function release() {
    if (_stream) {
      _stream.getTracks().forEach((t) => t.stop());
      _stream = null;
    }
  }

  // ---------- PCM / WAV 工具 ----------
  function mergeBuffers(buffers) {
    let len = 0;
    for (const b of buffers) len += b.length;
    const out = new Float32Array(len);
    let off = 0;
    for (const b of buffers) {
      out.set(b, off);
      off += b.length;
    }
    return out;
  }

  function downsample(buffer, inRate, outRate) {
    if (outRate >= inRate) return buffer;
    const ratio = inRate / outRate;
    const newLen = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLen);
    let offResult = 0;
    let offBuffer = 0;
    while (offResult < newLen) {
      const nextOff = Math.round((offResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offBuffer; i < nextOff && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offResult] = count ? accum / count : 0;
      offResult++;
      offBuffer = nextOff;
    }
    return result;
  }

  // Float32 [-1,1] -> 16bit PCM WAV
  function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeStr = (off, s) => {
      for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // audio format = PCM
    view.setUint16(22, 1, true); // channels = 1
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeStr(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    let off = 44;
    for (let i = 0; i < samples.length; i++, off += 2) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  window.Recorder = { start, stop, release };
})();
