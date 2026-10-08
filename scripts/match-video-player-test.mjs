import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
const ts = frontendRequire('typescript');
const source = readFileSync(new URL('../frontend/src/components/match/MatchVideo.tsx', import.meta.url),'utf8');
const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function setup(start) {
 let effect, cleanup, events, current=0, destroyed=false;
 const seeks=[],timers=new Map(),children=[];
 const player={seekTo:(value)=>seeks.push(value),getCurrentTime:()=>current,destroy:()=>{destroyed=true;}};
 const container={appendChild:node=>children.push(node),replaceChildren:()=>children.splice(0)};
 const react={useEffect:fn=>{effect=fn;},useRef:()=>({current:container}),useState:()=>['',()=>{}]};
 const module={exports:{}};
 const context=vm.createContext({module,exports:module.exports,URL,Promise,
  require:name=>name==='react'?react:{jsx:()=>null,jsxs:()=>null},
  document:{createElement:()=>({})},
  window:{location:{origin:'https://fgcscout.example'},YT:{Player:function(iframe,options){events=options.events;return player;}}},
  setInterval:fn=>{const id=timers.size+1;timers.set(id,fn);return id;},clearInterval:id=>timers.delete(id)});
 vm.runInContext(code,context);
 module.exports.default({src:`https://www.youtube-nocookie.com/embed/rQO7Ml3pYxk?start=${start}&end=${start+150}`,title:'Ranking Match 35'});
 cleanup=effect();await Promise.resolve();await Promise.resolve();
 events.onReady({target:player});
 return {seeks,timers,children,playing:()=>events.onStateChange({target:player,data:1}),
  tick:()=>[...timers.values()].forEach(fn=>fn()),time:value=>{current=value;},cleanup,destroyed:()=>destroyed};
}
const live=await setup(6531);
assert.equal(new URL(live.children[0].src).searchParams.get('origin'),'https://fgcscout.example');
assert.equal(new URL(live.children[0].src).searchParams.get('enablejsapi'),'1');
assert.deepEqual(live.seeks,[6531]);
live.playing();live.tick();assert.equal(live.seeks.length,3,'retry when a live player ignores the initial seek');
live.time(6532);live.tick();assert.equal(live.timers.size,0);
const count=live.seeks.length;live.time(100);live.playing();assert.equal(live.seeks.length,count,'manual seeking after initialization is unrestricted');
live.cleanup();assert.equal(live.timers.size,0);assert.ok(live.destroyed());
const unavailable=await setup(6531);unavailable.playing();for(let i=0;i<20;i++)unavailable.tick();
assert.equal(unavailable.timers.size,0,'retries are bounded');unavailable.cleanup();
const untimed=await setup(0);untimed.playing();assert.equal(untimed.timers.size,0);assert.deepEqual(untimed.seeks,[]);untimed.cleanup();
console.log('PASS: live seek retries, manual seek, bounded failure, untimed videos and cleanup');
const page=readFileSync(new URL('../frontend/src/app/match/[id]/page.tsx',import.meta.url),'utf8');
const embedHelper=page.slice(page.indexOf('function toYouTubeEmbed('),page.indexOf('function TeamLink('));
const watchBuilder=page.slice(page.indexOf('  const videoWatch ='),page.indexOf('  const barriersRed ='));
const urls=vm.createContext({URL});
vm.runInContext(ts.transpileModule(embedHelper,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,urls);
for(const url of ['https://www.youtube.com/watch?v=rQO7Ml3pYxk','https://www.youtube.com/live/rQO7Ml3pYxk','https://youtu.be/rQO7Ml3pYxk']) {
 urls.videoEmbed=urls.toYouTubeEmbed(url,6531.311,6681.311);
 const watch=new URL(vm.runInContext(`(() => {${watchBuilder};return videoWatch;})()`,urls));
 assert.equal(watch.searchParams.get('t'),'6531');assert.equal(watch.searchParams.get('start'),'6531');
 assert.equal(watch.searchParams.get('v'),'rQO7Ml3pYxk');
 assert.equal(new URL(urls.videoEmbed).searchParams.get('end'),'6682');
}
console.log('PASS: external watch/live/short URLs preserve the field 5 timestamp');
