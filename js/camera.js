// ============================================================
//  摄像头模块：getUserMedia(video) 预览 + canvas 截当前帧
// ============================================================
(function () {
  let _stream = null;
  let _videoEl = null;

  // 打开摄像头并绑定到 video 元素
  async function open(videoEl) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('NO_GETUSERMEDIA');
    }
    _videoEl = videoEl;
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, // 优先后置
      audio: false
    });
    _videoEl.srcObject = _stream;
    _videoEl.setAttribute('playsinline', 'true'); // iOS 内联播放
    _videoEl.muted = true;
    await _videoEl.play().catch(() => {});
  }

  // 截取当前帧 -> data:image/jpeg;base64,...
  function capture() {
    if (!_videoEl || !_videoEl.videoWidth) return null;
    const w = _videoEl.videoWidth;
    const h = _videoEl.videoHeight;
    // 限制最大边，减小体积
    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(_videoEl, 0, 0, cw, ch);
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  function close() {
    if (_stream) {
      _stream.getTracks().forEach((t) => t.stop());
      _stream = null;
    }
    if (_videoEl) {
      _videoEl.srcObject = null;
    }
  }

  window.Camera = { open, capture, close };
})();
