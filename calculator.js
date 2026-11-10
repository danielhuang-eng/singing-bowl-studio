/* 薪資以當月工作日均分；所有日期與工時皆以臺灣時間計算。 */
(function (root) {
  'use strict';
  const DEFAULTS = Object.freeze({ salary: 35000, start: '08:00', end: '17:00', lunchEnabled: true, lunchStart: '12:00', lunchEnd: '13:00', workdays: [1, 2, 3, 4, 5], theme: 'cream' });
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  function taipeiParts(date = new Date()) {
    const parts = Object.fromEntries(formatter.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
    return { ...parts, weekday: new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay(), seconds: parts.hour * 3600 + parts.minute * 60 + parts.second + date.getMilliseconds() / 1000 };
  }
  function timeSeconds(time) {
    if (typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
    const [h, m] = time.split(':').map(Number);
    return h * 3600 + m * 60;
  }
  function validate(s) {
    if (!s || !Number.isFinite(s.salary) || s.salary < 1 || s.salary > 999999999 || !Number.isInteger(s.salary)) return '請填寫 1～999,999,999 元之間的整數月薪。';
    const start = timeSeconds(s.start), end = timeSeconds(s.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return '下班時間必須晚於上班時間，目前支援當日班別。';
    if (typeof s.lunchEnabled !== 'boolean') return '請確認午休設定。';
    if (s.lunchEnabled) {
      const a = timeSeconds(s.lunchStart), b = timeSeconds(s.lunchEnd);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < start || b > end || b <= a || b - a >= end - start) return '午休須在上班時段內，結束晚於開始，並保留實際工作時間。';
    }
    if (!Array.isArray(s.workdays) || !s.workdays.length || s.workdays.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(s.workdays).size !== s.workdays.length) return '請至少選擇一個工作日。';
    if (!['cream', 'forest', 'lavender'].includes(s.theme)) return '請選擇有效的配色。';
    return '';
  }
  function calculate(s, now = new Date()) {
    const p = taipeiParts(now);
    const start = timeSeconds(s.start), end = timeSeconds(s.end);
    const lunchStart = timeSeconds(s.lunchStart), lunchEnd = timeSeconds(s.lunchEnd);
    const lunchSeconds = s.lunchEnabled ? lunchEnd - lunchStart : 0;
    const totalSeconds = end - start - lunchSeconds;
    let monthDays = 0, pastDays = 0;
    const daysInMonth = new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
    for (let d = 1; d <= daysInMonth; d++) {
      if (s.workdays.includes(new Date(Date.UTC(p.year, p.month - 1, d)).getUTCDay())) {
        monthDays++;
        if (d < p.day) pastDays++;
      }
    }
    const isWorkday = s.workdays.includes(p.weekday);
    const clampedNow = Math.max(start, Math.min(end, p.seconds));
    const elapsedLunch = s.lunchEnabled ? Math.max(0, Math.min(clampedNow, lunchEnd) - lunchStart) : 0;
    const elapsed = isWorkday ? Math.max(0, Math.min(totalSeconds, clampedNow - start - elapsedLunch)) : 0;
    const daily = s.salary / monthDays;
    const rate = daily / totalSeconds;
    const today = daily * elapsed / totalSeconds;
    const status = !isWorkday ? 'rest' : p.seconds < start ? 'before' : p.seconds >= end ? 'after' : s.lunchEnabled && p.seconds >= lunchStart && p.seconds < lunchEnd ? 'lunch' : 'working';
    return { parts: p, status, isWorkday, start, end, lunchSeconds, totalSeconds, elapsed, monthDays, pastDays, daily, hourly: rate * 3600, rate, today, month: Math.min(s.salary, pastDays * daily + today), progress: elapsed / totalSeconds * 100, remaining: Math.max(0, end - p.seconds) };
  }
  const api = { DEFAULTS, taipeiParts, timeSeconds, validate, calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SalaryCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
