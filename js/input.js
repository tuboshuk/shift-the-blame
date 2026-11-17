// 统一输入：只认 Shift 首次 keydown（过滤系统 repeat），上报 blur/visibility 暂停。
export class Input {
  constructor() {
    this._downCbs = [];
    this._upCbs = [];
    this._blurCbs = [];
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Shift' || e.repeat) return;
      e.preventDefault();
      this._downCbs.forEach((cb) => cb());
    });
    window.addEventListener('keyup', (e) => {
      if (e.key !== 'Shift') return;
      this._upCbs.forEach((cb) => cb());
    });
    window.addEventListener('blur', () => this._blurCbs.forEach((cb) => cb()));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this._blurCbs.forEach((cb) => cb());
    });
  }

  onShiftDown(cb) { this._downCbs.push(cb); }
  onShiftUp(cb) { this._upCbs.push(cb); }
  onBlur(cb) { this._blurCbs.push(cb); }
}
