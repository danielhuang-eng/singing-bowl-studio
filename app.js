(() => {
  'use strict';
  const { DEFAULTS, validate, calculate } = window.SalaryCalculator;
  const KEY = 'bowl-income-settings-v1';
  const $ = id => document.getElementById(id);
  const money = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const integer = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
  const pad = n => String(n).padStart(2, '0');
  const hours = seconds => Number((seconds / 3600).toFixed(2)).toString();
  const quotes = ['慢慢來，每一秒的努力都算數。', '今天的你，也有好好往前走。', '薪水正在路上，好日子也是。', '不必時時發光，穩穩前進就好。', '累了就深呼吸，你已經做得很好。', '把日子過好，是最值得的投資。', '努力有回音，下班有生活。', '小小累積，也能換來大大的快樂。'];
  let settings = structuredClone(DEFAULTS), paused = false, quoteIndex = 0, toastTimer, storageAvailable = true;
  try { const stored = localStorage.getItem(KEY); if (stored) { const parsed = JSON.parse(stored); if (!validate(parsed)) settings = parsed; } } catch { storageAvailable = false; }
  const dialog = $('settings-dialog'), form = $('settings-form');
  function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2600); }
  function duration(seconds) { const n = Math.ceil(seconds); const h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60; return `${h ? h + ' 小時 ' : ''}${m ? m + ' 分 ' : ''}${s} 秒`; }
  function drawMoney(value) {
    const [whole, fraction] = value.toFixed(4).split('.');
    $('today-money').replaceChildren(document.createTextNode(integer.format(Number(whole))));
    const decimal = document.createElement('span'); decimal.className = 'money-decimal'; decimal.textContent = '.' + fraction; $('today-money').append(decimal);
    $('today-money').classList.toggle('large-value', Number(whole) >= 10000 && Number(whole) < 1000000);
    $('today-money').classList.toggle('extra-large-value', Number(whole) >= 1000000);
  }
  function render() {
    const c = calculate(settings), p = c.parts;
    $('today-date').textContent = `${p.year}-${pad(p.month)}-${pad(p.day)}`;
    $('today-weekday').textContent = '週' + '日一二三四五六'[p.weekday];
    $('clock').textContent = `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
    $('clock').dateTime = `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}+08:00`;
    $('schedule-summary').textContent = `每日 ${hours(c.totalSeconds)} 小時・${settings.lunchEnabled ? '午休 ' + hours(c.lunchSeconds) + ' 小時' : '不扣午休'}`;
    const statuses = { working: '上班中', lunch: '午休中', before: '尚未上班', after: '下班啦', rest: '休息日' };
    const heading = $('work-status'); heading.firstChild.textContent = statuses[c.status];
    heading.dataset.status = c.status;
    const countdown = $('countdown');
    if (c.status === 'working' || c.status === 'lunch') countdown.textContent = `距離下班還有 ${duration(c.remaining)}（${settings.end} 下班）`;
    else if (c.status === 'before') countdown.textContent = `距離上班還有 ${duration(c.start - p.seconds)}（${settings.start} 上班）`;
    else if (c.status === 'after') countdown.textContent = '今日任務完成，把剩下的時間留給自己。';
    else countdown.textContent = '今天好好休息，也是一件很重要的事。';
    const tags = { working: '慢慢累積，也很了不起', lunch: '好好吃飯，補充能量', before: '新的一天，慢慢開始', after: '辛苦了，準時下班', rest: '休息，是為了好好生活' };
    $('earnings-tag').textContent = paused ? '數字已暫停，努力持續累積' : tags[c.status];
    if (!paused) drawMoney(c.today);
    const activeRate = c.status === 'working' ? c.rate : 0;
    $('per-second').textContent = `NT$${activeRate.toFixed(4)}／秒`;
    $('progress-percent').textContent = c.progress.toFixed(1) + '%';
    $('worked-hours').textContent = `已工作 ${(c.elapsed / 3600).toFixed(2)}／${(c.totalSeconds / 3600).toFixed(2)} 小時`;
    $('progress-fill').style.width = c.progress + '%';
    $('work-progress').setAttribute('aria-valuenow', c.progress.toFixed(1));
    $('start-label').textContent = settings.start + ' 上班'; $('end-label').textContent = settings.end + ' 下班';
    $('hourly-pay').textContent = 'NT$' + money.format(c.hourly);
    $('daily-pay').textContent = 'NT$' + money.format(c.daily);
    document.querySelector('.stats-section').classList.toggle('long-amount', c.daily >= 100000);
    $('daily-hours').textContent = `認真生活的 ${hours(c.totalSeconds)} 小時`;
    $('month-pay').textContent = 'NT$' + money.format(c.month);
    $('month-days').textContent = `本月共 ${c.monthDays} 個工作日`;
    $('monthly-salary').textContent = '月薪 NT$' + integer.format(settings.salary);
    const equivalentText = $('equivalent').querySelector('p');
    if (c.today >= 60) equivalentText.textContent = `今天已賺到 ${Math.floor(c.today / 60)} 杯咖啡的錢（每杯 NT$60），犒賞一下自己。`;
    else if (c.today >= 20) equivalentText.textContent = `今天已賺到 ${Math.floor(c.today / 20)} 瓶礦泉水的錢（每瓶 NT$20），記得喝水。`;
    else equivalentText.textContent = '努力慢慢累積，小確幸正在路上。';
    document.title = "缽間｜一聲，回到此刻";
  }
  function setTheme() { document.body.dataset.theme = settings.theme; document.querySelector('meta[name="theme-color"]').content = { cream: '#f1eee6', forest: '#e8ebe4', lavender: '#eeebf3' }[settings.theme]; }
  function fillForm(s) {
    for (const key of ['salary', 'start', 'end', 'lunchStart', 'lunchEnd']) form.elements[key].value = s[key];
    form.elements.lunchEnabled.checked = s.lunchEnabled;
    form.querySelectorAll('[name="workdays"]').forEach(el => { el.checked = s.workdays.includes(Number(el.value)); });
    form.elements.theme.value = s.theme; updateLunch(); $('form-error').hidden = true;
  }
  function updateLunch() { const enabled = form.elements.lunchEnabled.checked; $('lunch-fields').hidden = !enabled; form.elements.lunchStart.required = enabled; form.elements.lunchEnd.required = enabled; }
  $('open-settings').addEventListener('click', () => { fillForm(settings); dialog.showModal(); });
  $('close-settings').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { const r = dialog.getBoundingClientRect(); if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close(); });
  form.elements.lunchEnabled.addEventListener('change', updateLunch);
  $('reset-settings').addEventListener('click', () => { fillForm(structuredClone(DEFAULTS)); toast('已填入預設值，儲存後生效'); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const next = { salary: Number(form.elements.salary.value), start: form.elements.start.value, end: form.elements.end.value, lunchEnabled: form.elements.lunchEnabled.checked, lunchStart: form.elements.lunchStart.value, lunchEnd: form.elements.lunchEnd.value, workdays: Array.from(form.querySelectorAll('[name="workdays"]:checked'), el => Number(el.value)), theme: form.elements.theme.value };
    const error = validate(next);
    if (error) { $('form-error').textContent = error; $('form-error').hidden = false; return; }
    settings = next; paused = false; syncPause();
    try { localStorage.setItem(KEY, JSON.stringify(settings)); storageAvailable = true; } catch { storageAvailable = false; }
    updateStorageStatus(); setTheme(); render(); dialog.close(); toast(storageAvailable ? '設定已儲存，讓努力繼續累積。' : '設定已套用，此瀏覽器無法永久儲存。');
  });
  function updateStorageStatus() { $('save-status').textContent = storageAvailable ? '設定儲存在此瀏覽器' : '設定僅在本次開啟期間保留'; }
  function syncPause() { $('toggle-pause').setAttribute('aria-pressed', String(paused)); $('toggle-pause').innerHTML = paused ? '繼續 <span aria-hidden="true">▷</span>' : '暫停 <span aria-hidden="true">Ⅱ</span>'; }
  $('toggle-pause').addEventListener('click', () => { paused = !paused; syncPause(); render(); toast(paused ? '已暫停數字動畫，收入仍按時間計算。' : '繼續顯示即時收入。'); });
  $('next-quote').addEventListener('click', () => { quoteIndex = (quoteIndex + 1) % quotes.length; $('quote').textContent = quotes[quoteIndex]; });
  $('fullscreen').addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('此瀏覽器暫不支援全螢幕模式。'); } catch { toast('目前無法開啟全螢幕，請使用瀏覽器的全螢幕功能。'); }
  });
  document.addEventListener('fullscreenchange', () => { $('fullscreen').querySelector('span').textContent = document.fullscreenElement ? '離開專注' : '專注模式'; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('storage', e => { if (e.key !== KEY) return; try { const next = e.newValue ? JSON.parse(e.newValue) : structuredClone(DEFAULTS); if (!validate(next)) { settings = next; paused = false; syncPause(); setTheme(); render(); } } catch { /* 保留目前有效設定。 */ } });
  setTheme(); updateStorageStatus(); render(); setInterval(render, 100);
})();
