// Giao diện chọn nền bản đồ: nút quả cầu mở một bảng nhỏ (Google Maps / Sơ đồ dự phòng + ô khoá API + tuỳ chọn giao thông).
// Google Maps là mặc định khi đã có khoá; chưa có khoá thì dùng sơ đồ và thuật toán đồ án.
import { GoogleBase, savedKey, savedOn, saveKey, saveOn, savedTraffic, saveTraffic, looksLikeKey, needsReload } from './gmaps.js';

export function initBaseMap({ map, stage, toast }) {
  const btn = document.querySelector('#gm-btn'), pop = document.querySelector('#gm-pop');
  const keyIn = pop.querySelector('#gm-key'), status = pop.querySelector('#gm-status');
  const base = new GoogleBase(stage, map);
  let busy = false;

  const say = (text, bad = false) => { status.textContent = text || ''; status.classList.toggle('bad', !!bad); };
  const paint = () => {
    const on = base.active;
    btn.setAttribute('aria-pressed', String(on));
    for (const b of pop.querySelectorAll('[data-base]')) b.setAttribute('aria-checked', String((b.dataset.base === 'google') === on));
    pop.querySelector('#gm-clear').hidden = !savedKey();
    btn.classList.toggle('needs-key', !savedKey() && !on);
    const tr = pop.querySelector('#gm-traffic'); if (tr) tr.checked = savedTraffic();
    const st = base.geo && base.geo.stats();
    pop.querySelector('#gm-stats').textContent = st ? `Đã hỏi Google ${st.calls} lượt tìm đường, đang nhớ ${st.cached} tuyến.` : '';
  };
  document.addEventListener('geo:update', () => { if (!pop.hidden) paint(); });
  base.onNotice = (m) => { toast(m, 'error'); paint(); say(m, true); };
  base.onError = (e) => { saveOn(false); paint(); say(e.message, true); toast(`Google Maps không dùng được: ${e.message}. Đã quay về sơ đồ.`, 'error'); };

  async function useGoogle({ quiet = false } = {}) {
    const key = (keyIn.value || savedKey()).trim();
    if (!key) { say('Dán khoá API vào ô trên rồi bấm Lưu.', true); keyIn.focus(); paint(); return; }
    if (!looksLikeKey(key)) { say('Khoá có vẻ chưa đúng (khoá Google thường bắt đầu bằng AIza và dài khoảng 39 ký tự).', true); keyIn.focus(); return; }
    if (needsReload(key)) { saveKey(key); saveOn(true); location.reload(); return; }
    if (busy) return;
    busy = true; say('Đang tải Google Maps…');
    try {
      saveKey(key);
      await base.enable(key);
      saveOn(true); keyIn.value = '';
      say('Đang dùng Google Maps: nền bản đồ và đường đi thật. Điểm giao, đường cấm tải, đơn gấp do hệ thống vẽ phía trên.');
    } catch (e) {
      saveOn(false);
      say(`${e.message}. Đang dùng sơ đồ.`, true);
      if (quiet) toast(`Không bật được Google Maps (${e.message}), đang dùng sơ đồ.`);
    } finally { busy = false; paint(); }
  }

  function useSchematic() { base.disable(); saveOn(false); say('Đang dùng sơ đồ.'); paint(); }

  const open = (on) => {
    pop.hidden = !on; btn.setAttribute('aria-expanded', String(on));
    if (on) { paint(); (savedKey() ? pop.querySelector('[data-base]') : keyIn).focus(); }
  };
  btn.addEventListener('click', () => open(pop.hidden));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { open(false); btn.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) open(false); });
  pop.querySelector('#gm-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-base]');
    if (!b) return;
    if (b.dataset.base === 'google') useGoogle(); else useSchematic();
  });
  pop.querySelector('#gm-save').addEventListener('click', () => useGoogle());
  keyIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); useGoogle(); } });
  pop.querySelector('#gm-clear').addEventListener('click', () => { useSchematic(); saveKey(''); keyIn.value = ''; say('Đã xoá khoá khỏi trình duyệt này.'); paint(); });

  pop.querySelector('#gm-traffic').addEventListener('change', (e) => { saveTraffic(e.target.checked); if (base.geo) base.geo.setTraffic(e.target.checked); });
  paint();
  if (savedOn() && savedKey()) useGoogle({ quiet: true });
  else if (!savedKey()) {   // chưa có khoá: nhắc một lần mỗi phiên, vẫn chạy bằng sơ đồ
    let told = false;
    try { told = sessionStorage.getItem('gmaps.hint') === '1'; sessionStorage.setItem('gmaps.hint', '1'); } catch { /* bỏ qua */ }
    if (!told) setTimeout(() => toast('Đang dùng sơ đồ. Bấm nút quả cầu trên bản đồ và dán khoá API để dùng Google Maps (đường đi thật).'), 2500);
  }
  return base;
}
