const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULTS, validate, calculate, taipeiParts } = require('../calculator.js');
const at = (time, day = '2026-11-05') => new Date(`${day}T${time}+08:00`);
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.000001, `${a} 應等於 ${b}`);
test('預設時間 08:00～17:00，午休一小時，實際工時八小時', () => {
  assert.equal(validate(DEFAULTS), ''); assert.equal(DEFAULTS.start, '08:00'); assert.equal(DEFAULTS.end, '17:00');
  assert.equal(calculate(DEFAULTS, at('10:00:00')).totalSeconds, 28800);
});
test('臺灣時間跨日，週別不受執行電腦時區影響', () => {
  const p = taipeiParts(new Date('2026-11-04T16:30:00.250Z'));
  assert.equal(p.day, 5); assert.equal(p.weekday, 4); assert.equal(p.seconds, 1800.25);
});
test('上班前與剛上班收入為零', () => {
  for (const time of ['07:00:00', '08:00:00']) { const c = calculate(DEFAULTS, at(time)); assert.equal(c.today, 0); assert.equal(c.progress, 0); }
  assert.equal(calculate(DEFAULTS, at('07:00:00')).status, 'before');
});
test('午休開始至結束收入維持不變，工時扣除午休', () => {
  const noon = calculate(DEFAULTS, at('12:00:00'));
  assert.equal(noon.status, 'lunch'); assert.equal(noon.progress, 50);
  close(calculate(DEFAULTS, at('12:30:00')).today, noon.today);
  close(calculate(DEFAULTS, at('13:00:00')).today, noon.today);
  assert.equal(calculate(DEFAULTS, at('13:00:00')).status, 'working');
  assert.equal(calculate(DEFAULTS, at('14:00:00')).elapsed, 18000);
});
test('下班與下班後最多為一天收入，進度為百分之百', () => {
  for (const time of ['17:00:00', '23:59:59']) { const c = calculate(DEFAULTS, at(time)); close(c.today, c.daily); assert.equal(c.progress, 100); assert.equal(c.status, 'after'); }
});
test('非工作日今日不累積，本月包含先前滿勤工作日', () => {
  const c = calculate(DEFAULTS, at('15:00:00', '2026-11-07'));
  assert.equal(c.status, 'rest'); assert.equal(c.today, 0); assert.equal(c.progress, 0); close(c.month, c.daily * 5);
});
test('本月工作日數與累計薪資正確，月底滿勤等於月薪', () => {
  const c = calculate(DEFAULTS, at('10:00:00'));
  assert.equal(c.monthDays, 21); assert.equal(c.pastDays, 3); close(c.month, c.daily * 3.25);
  close(calculate(DEFAULTS, at('17:00:00', '2026-11-30')).month, DEFAULTS.salary);
});
test('新月份第一個工作日重新累積', () => {
  const c = calculate(DEFAULTS, at('08:00:00', '2026-12-01'));
  assert.equal(c.pastDays, 0); assert.equal(c.month, 0); assert.equal(c.monthDays, 23);
});
test('關閉午休時九小時均分，午間持續累積', () => {
  const s = { ...DEFAULTS, lunchEnabled: false };
  const c = calculate(s, at('12:30:00'));
  assert.equal(c.totalSeconds, 32400); assert.equal(c.progress, 50); assert.equal(c.status, 'working');
});
test('自訂工作日可選週末，收入依該月工作日均分', () => {
  const s = { ...DEFAULTS, workdays: [0, 6] };
  const c = calculate(s, at('17:00:00', '2026-11-07'));
  assert.equal(c.monthDays, 9); close(c.today, s.salary / 9);
});
test('即時收入精確至秒的小數，未以整分鐘跳動', () => {
  const a = calculate(DEFAULTS, at('09:00:00.000')), b = calculate(DEFAULTS, at('09:00:00.500'));
  close(b.today - a.today, a.rate / 2);
});
test('驗證拒絕無效薪資、空白工作日、跨日班別與不合理午休', () => {
  for (const patch of [{ salary: NaN }, { salary: 0 }, { salary: 1.5 }, { salary: 1000000000 }, { workdays: [] }, { workdays: [1, 1] }, { workdays: [8] }, { start: '18:00' }, { start: '' }, { lunchStart: '07:00' }, { lunchEnd: '18:00' }, { lunchStart: '12:00', lunchEnd: '12:00' }, { lunchStart: '08:00', lunchEnd: '17:00' }, { theme: 'invalid' }]) assert.notEqual(validate({ ...DEFAULTS, ...patch }), '');
});
