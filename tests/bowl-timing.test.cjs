const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { defaults } = require('../bowl-audio.js');

function engine(params = defaults) {
  const beats = [];
  let Processor;
  // Drive the actual processor without browser timers or a UI event loop.
  const context = vm.createContext({
    sampleRate: 1000, currentFrame: 0,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: data => beats.push(data.time) }; } },
    registerProcessor: (name, processor) => { Processor = processor; }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../bowl-worklet.js'), 'utf8'), context);
  const processor = new Processor({ processorOptions: { params: { ...params }, playing: true } });
  return {
    beats,
    send: data => processor.port.onmessage({ data }),
    until(seconds) {
      while (context.currentFrame < seconds * context.sampleRate) {
        const size = Math.min(128, seconds * context.sampleRate - context.currentFrame);
        processor.process([], [[new Float32Array(size)]]);
        context.currentFrame += size;
      }
    }
  };
}

test('預設先敲一聲，之後每 10 秒敲擊，無需網頁計時器', () => {
  const audio = engine();
  audio.until(21);
  assert.deepEqual(audio.beats, [0, 10, 20]);
});

test('縮短間隔重新計時，音色調整不打斷節奏', () => {
  const audio = engine();
  audio.until(3);
  audio.send({ params: { ...defaults, interval: 2 } });
  audio.until(4);
  audio.send({ params: { ...defaults, interval: 2, brightness: .7 } });
  audio.until(8);
  assert.deepEqual(audio.beats, [0, 5, 7]);
});

test('延長間隔取消原節拍，暫停後恢復不補敲', () => {
  const audio = engine({ ...defaults, interval: 1 });
  audio.until(2);
  audio.send({ params: { ...defaults, interval: 10 } });
  audio.until(13);
  assert.deepEqual(audio.beats, [0, 1, 12]);
  audio.send({ playing: false });
  audio.until(30);
  assert.deepEqual(audio.beats, [0, 1, 12]);
  audio.send({ playing: true });
  audio.until(41);
  assert.deepEqual(audio.beats, [0, 1, 12, 30, 40]);
});
