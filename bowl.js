(()=>{'use strict';const $=id=>document.getElementById(id);const {defaults,BowlAudio}=BowlSynth;const key='singing-bowl-studio-v1';let p={...defaults};try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Object.keys(defaults).every(k=>Number.isFinite(saved[k])))p={...p,...saved};}catch{}const fields=[['frequency','缽身基頻','低頻沉穩，高頻清亮；對應缽身尺寸與壁厚。',120,440,1,'赫茲'],['decay','餘韻長度','調節阻尼，決定敲擊後的自然衰減。',3,16,.5,'秒'],['brightness','泛音明亮度','提高高頻振動模態的相對能量。',0,1,.01,'%'],['hardness','槌頭硬度','由柔軟包覆到硬木，改變起音與高頻。',0,1,.01,'%'],['beat','拍頻起伏','兩個相近頻率，交織出緩慢的波動。',0,4,.1,'赫茲'],['strength','敲擊力道','改變每次敲擊的振幅。',.1,1,.01,'%'],['reverb','空間殘響','從近身聆聽，走向有空氣感的空間。',0,.6,.01,'%'],['volume','聆聽音量','調整整體輸出，從輕聲開始。',0,.8,.01,'%']];for(const [k,, ,min,max]of fields)p[k]=Math.min(max,Math.max(min,p[k]));const presets={warm:{...defaults},deep:{...defaults,frequency:147,decay:14,brightness:.15,hardness:.12,beat:.7,reverb:.32},clear:{...defaults,frequency:294,decay:7,brightness:.65,hardness:.62,beat:2.2,reverb:.18}};let audio,worklet,starting=false,playing=false,muted=false,count=0;fields.forEach(([k,label,help,min,max,step,unit])=>{const row=document.createElement('div');row.className='parameter';row.innerHTML=`<div class="parameter-header"><label for="b-${k}">${label}</label><output id="o-${k}" for="b-${k}"></output></div><p id="h-${k}">${help}</p><input id="b-${k}" type="range" min="${min}" max="${max}" step="${step}" aria-describedby="h-${k}">`;$('sliders').append(row);$('b-'+k).addEventListener('input',e=>{p[k]=Number(e.target.value);update();$('preset-name').textContent='自訂音色';document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('selected'));save();});});
 function update(){fields.forEach(([k,label,help,min,max,step,unit])=>{const el=$('b-'+k);el.value=p[k];el.style.setProperty('--fill',((p[k]-min)/(max-min)*100)+'%');$('o-'+k).textContent=(unit==='%'?Math.round(p[k]*100):p[k])+' '+unit;});if(audio)audio.mix(p,muted);if(worklet)worklet.port.postMessage({params:p});}
 function save(){try{localStorage.setItem(key,JSON.stringify(p));$('sound-save').textContent='已儲存 · 下次敲擊生效';}catch{$('sound-save').textContent='本次有效 · 瀏覽器無法儲存';}}
 function ensureAudio(){
  if(!audio){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('unsupported');audio=new BowlAudio(new Context());audio.ctx.onstatechange=()=>{if(audio.ctx.state!=='running'&&playing){stop();$('play-state').textContent='音訊中斷 · 請點選繼續';}};}
 }
 async function enable(){
  ensureAudio();await audio.ctx.resume();audio.mix(p,muted);
 }
 function visual(animate=true){count++;$('strike-count').textContent=String(count).padStart(3,'0');if(animate&&!document.hidden){$('instrument').classList.remove('struck');void $('instrument').offsetWidth;$('instrument').classList.add('struck');}}
 async function setupBeat(){
  if(worklet)return;
  await audio.ctx.audioWorklet.addModule('./bowl-worklet.js');
  worklet=new AudioWorkletNode(audio.ctx,'singing-bowl',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1]});
  worklet.connect(audio.input);
  worklet.port.onmessage=({data})=>visual(playing&&audio.ctx.currentTime-data.time<.2);
 }
 function stop(){autoRequested=false;playing=false;if(worklet)worklet.port.postMessage({playing:false});$('play-label').textContent='開始聆聽';$('play-icon').textContent='▶';$('play-state').textContent='餘韻漸息';document.body.classList.remove('is-playing');}
 async function toggle(){
  autoRequested=false;
  if(starting)return;
  if(playing){stop();return;}
  starting=true;
  try{await enable();await setupBeat();playing=true;worklet.port.postMessage({params:p,playing:true});$('play-label').textContent='暫停敲擊';$('play-icon').textContent='Ⅱ';$('play-state').textContent=document.hidden?'背景聆聽中':'一秒一聲';document.body.classList.add('is-playing');$('audio-hint').textContent='下班與假日照常敲缽 · 可於背景持續聆聽 · 空白鍵暫停';}
  catch{$('audio-hint').textContent='無法啟用聲音，請用最新版瀏覽器並透過網站網址開啟。';}
  finally{starting=false;}
 }
 const autoKey='singing-bowl-autostart-v1';let autoStart=true,autoRequested=false;
 try{autoStart=localStorage.getItem(autoKey)!=='false';}catch{}
 $('auto-start').checked=autoStart;
 $('auto-start').addEventListener('change',()=>{
  autoStart=$('auto-start').checked;autoRequested=false;
  try{localStorage.setItem(autoKey,String(autoStart));}catch{}
  if(autoStart&&!playing)toggle();else if(!autoStart)stop();
 });
 function tryAutoStart(){
  if(!autoStart)return;
  try{
   ensureAudio();autoRequested=true;
   if(audio.ctx.state!=='running'){$('play-state').textContent='等待啟用聲音';$('audio-hint').textContent='自動敲缽已開啟 · 請先點選「開始聆聽」啟用聲音';}
   audio.ctx.resume().then(()=>{if(autoRequested&&!playing&&!starting)toggle();}).catch(()=>{autoRequested=false;});
  }catch{$('audio-hint').textContent='請點選開始聆聽以啟用聲音。';}
 }
 $('play').addEventListener('click',toggle);let lastManual=-Infinity;$('bowl-strike').addEventListener('click',async()=>{autoRequested=false;try{await enable();if(audio.ctx.currentTime-lastManual<.15)return;lastManual=audio.ctx.currentTime;audio.strike({...p});visual();}catch{$('audio-hint').textContent='目前無法啟用聲音，請重新整理後再試。';}});$('mute').addEventListener('click',()=>{muted=!muted;$('mute').setAttribute('aria-pressed',String(muted));$('mute').textContent=muted?'開啟聲音':'靜音';if(audio)audio.mix(p,muted);if(worklet)worklet.port.postMessage({params:p});});document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{p={...presets[b.dataset.preset],volume:p.volume};update();save();document.querySelectorAll('[data-preset]').forEach(x=>x.classList.toggle('selected',x===b));$('preset-name').textContent=b.textContent;}));$('reset-sound').onclick=()=>{p={...defaults};update();save();document.querySelector('[data-preset="warm"]').click();};for(const name of ['sound','income'])$(name+'-tab').onclick=()=>{for(const n of ['sound','income']){$(n+'-panel').hidden=n!==name;$(n+'-tab').setAttribute('aria-selected',String(n===name));}};$('about-open').onclick=()=>$('about').showModal();$('about-close').onclick=()=>$('about').close();document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON','TEXTAREA','SELECT'].includes(e.target.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();toggle();}});document.addEventListener('visibilitychange',()=>{if(playing)$('play-state').textContent=document.hidden?'背景聆聽中':'一秒一聲';});window.addEventListener('pagehide',()=>{stop();if(audio)audio.ctx.suspend();});update();if(Object.keys(defaults).some(k=>p[k]!==defaults[k])){$('preset-name').textContent='已儲存的音色';document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('selected'));}tryAutoStart();})();
