import {FIXED_STEP,MAX_EVENTS,MAX_UNITS,STATS,WORLD} from './config';
import type {BattleEvent,Kind,Match,Player,Settings,Team,Unit,Word} from './types';
import {filterWords,judge,makeQuestion,rng,shuffle,typesFor} from '../questions/questions';
export const enemy=(team:Team):Team=>team==='red'?'blue':'red';
const player=():Player=>({hp:100,correct:0,wrong:0,skipped:0,streak:0,best:0,index:0,cycle:0,question:null,selected:[],feedback:null,errors:{},exhausted:false});
export function createMatch(words:Word[],settings:Settings,seed=Date.now()):Match {
 const bank=filterWords(words,settings);if(!bank.length)throw new Error('当前筛选没有单词，请先调整词库。');
 const m:Match={id:crypto.randomUUID(),phase:'COUNTDOWN',resumePhase:'COUNTDOWN',countdown:3,elapsed:0,remaining:settings.duration,players:{red:player(),blue:player()},units:[],projectiles:[],events:[],nextId:1,deck:shuffle(bank,rng(seed)),typeDeck:typesFor(settings,seed+20),settings:structuredClone(settings),seed,winner:null,reason:'',turn:'red',resultSaved:false};
 for(const team of ['red','blue'] as Team[])nextQuestion(m,team);return m;
}
function event(m:Match,data:Omit<BattleEvent,'id'|'time'>){m.events.push({...data,id:m.nextId++,time:m.elapsed});if(m.events.length>MAX_EVENTS)m.events.splice(0,m.events.length-MAX_EVENTS)}
export function summon(m:Match,team:Team,kind:Kind){
 const live=m.units.filter(u=>u.team===team&&u.deathAt===null);if(live.length>=MAX_UNITS/2){const old=live.find(u=>u.kind===kind)||live[0];old.hp=Math.min(old.maxHp,old.hp+STATS[kind].hp/2);event(m,{type:'summon',team,x:old.x,lane:old.lane,kind});return}
 const id=m.nextId++,lane=(id%3)-1,stats=STATS[kind];
 m.units.push({id,team,kind,x:team==='red'?WORLD.spawnLeft:WORLD.spawnRight,lane,hp:stats.hp,maxHp:stats.hp,cooldown:.2,state:'idle',stateUntil:m.elapsed+.22,deathAt:null,attackAt:-10});event(m,{type:'summon',team,x:team==='red'?WORLD.spawnLeft:WORLD.spawnRight,lane,kind});
}
export function reward(m:Match,team:Team){const p=m.players[team];p.streak++;p.best=Math.max(p.best,p.streak);summon(m,team,'soldier');if(p.streak===3)summon(m,team,'archer');if(p.streak===5)summon(m,team,'knight');if(p.streak===8){const foes=m.units.filter(u=>u.team!==team&&u.deathAt===null);const center=foes.length?foes.reduce((n,u)=>n+u.x,0)/foes.length:960;event(m,{type:'lightning',team,x:center,lane:0});for(const u of foes)if(Math.abs(u.x-center)<=500)hurt(m,u,32,team)}}
function nextQuestion(m:Match,team:Team){const p=m.players[team];if(p.index>=m.deck.length){if(m.settings.exhaustion==='stop'){p.question=null;p.exhausted=true;p.feedback=null;p.selected=[];return}p.index=0;p.cycle++}const word=m.deck[p.index],type=m.typeDeck[(p.index+p.cycle*m.deck.length)%m.typeDeck.length];p.question=makeQuestion(word,m.deck,type,p.index,p.cycle,m.seed,team);p.selected=[];p.feedback=null;}
export function canAnswer(m:Match,team:Team){return m.phase==='RUNNING'&&!m.players[team].feedback&&!m.players[team].exhausted&&(m.settings.inputMode==='simultaneous'||m.turn===team)}
export function selectCard(m:Match,team:Team,id:string){if(!canAnswer(m,team))return;const p=m.players[team],q=p.question;if(!q||!q.options.some(o=>o.id===id)||p.selected.includes(id))return;p.selected=q.type==='spell'?[...p.selected,id]:[id]}
export function submit(m:Match,team:Team,questionId:string,skip=false):boolean|null {
 const p=m.players[team];if(!canAnswer(m,team)||!p.question||p.question.id!==questionId)return null;
 if(!skip&&!p.selected.length)return null;
 const question=p.question,correct=!skip&&judge(question,p.selected);
 if(skip){p.skipped++;p.streak=0}else if(correct){p.correct++;reward(m,team)}else{p.wrong++;p.streak=0;const previous=p.errors[question.entry.id];p.errors[question.entry.id]={word:question.entry.word,meaning:question.entry.meaning,count:(previous?.count??0)+1}}
 const bonus=correct&&[3,5,8].includes(p.streak)?{3:' · 额外弓箭手！',5:' · 额外重装骑士！',8:' · 闪电魔法！'}[p.streak as 3|5|8]:'';
 p.feedback={correct,message:skip?'跳过，记住这个单词':correct?'回答正确 · 士兵出发'+(bonus||''):'再接再厉，正确答案是',answer:question.entry.word+' · '+question.entry.meaning,until:m.elapsed+(correct?.48:1.15),skipped:skip};event(m,{type:correct?'correct':'wrong',team,x:team==='red'?195:1725,lane:0});
 if(m.settings.inputMode==='turns')m.turn=enemy(team);return correct;
}
function hurt(m:Match,u:Unit,damage:number,by:Team){if(u.deathAt!==null)return;u.hp=Math.max(0,u.hp-damage);u.state='hurt';u.stateUntil=m.elapsed+.16;event(m,{type:'hit',team:by,x:u.x,lane:u.lane,amount:damage});if(u.hp===0){u.deathAt=m.elapsed;u.state='death';event(m,{type:'death',team:u.team,x:u.x,lane:u.lane})}}
function castle(m:Match,team:Team,damage:number){if(m.phase!=='RUNNING')return;m.players[team].hp=Math.max(0,m.players[team].hp-damage);event(m,{type:'castle',team,x:team==='red'?WORLD.left:WORLD.right,lane:0,amount:damage})}
export function finish(m:Match,reason:string){if(m.phase==='FINISHED')return;m.phase='FINISHED';m.reason=reason;const d=m.players.red.hp-m.players.blue.hp;m.winner=d===0?'draw':d>0?'red':'blue';event(m,{type:'finish',team:m.winner==='blue'?'blue':'red',x:960,lane:0})}
export function pause(m:Match){if(m.phase==='RUNNING'||m.phase==='COUNTDOWN'){m.resumePhase=m.phase;m.phase='PAUSED'}}
export function resume(m:Match){if(m.phase==='PAUSED')m.phase=m.resumePhase}
export function tick(m:Match,dt=FIXED_STEP){
 if(!Number.isFinite(dt)||dt<=0)return;
 if(m.phase==='COUNTDOWN'){m.countdown=Math.max(0,m.countdown-dt);if(m.countdown<1e-8){m.countdown=0;m.phase='RUNNING'}return}
 if(m.phase!=='RUNNING')return;
 const before=Math.ceil(m.remaining);m.elapsed+=dt;m.remaining=Math.max(0,m.settings.duration-m.elapsed);
 if(before!==Math.ceil(m.remaining)&&m.remaining<=10)event(m,{type:'tick',team:'red',x:960,lane:0});
 for(const team of ['red','blue'] as Team[]){const p=m.players[team];if(p.feedback&&m.elapsed>=p.feedback.until){p.index++;nextQuestion(m,team)}}
 const living=m.units.filter(u=>u.deathAt===null),positions=new Map(living.map(u=>[u.id,u.x]));
 const attacks:{target:Unit|null;castle:Team|null;damage:number;by:Team;x:number;lane:number}[]=[];
 for(const u of living){
  const stats=STATS[u.kind],dir=u.team==='red'?1:-1,opponent=enemy(u.team);u.cooldown=Math.max(0,u.cooldown-dt);
  if(u.state==='hurt'&&m.elapsed<u.stateUntil)continue;
  const foes=living.filter(f=>f.team!==u.team&&((positions.get(f.id)!-positions.get(u.id)!)*dir>=-35));foes.sort((a,b)=>Math.abs(a.x-u.x)-Math.abs(b.x-u.x));const target=foes[0];
  const targetX=target?positions.get(target.id)!:u.team==='red'?WORLD.right:WORLD.left;
  const inRange=Math.abs(targetX-u.x)<=stats.range+(target?0:30);
  if(inRange){u.state=m.elapsed-u.attackAt<.28?'attack':'idle';if(u.cooldown<=0){u.cooldown=stats.interval;u.state='attack';u.attackAt=m.elapsed;
   if(u.kind==='archer'){m.projectiles.push({id:m.nextId++,team:u.team,x:u.x,startX:u.x,targetId:target?.id??null,targetCastle:target?null:opponent,targetX,damage:stats.damage,castleDamage:stats.castleDamage,lane:u.lane});event(m,{type:'arrow',team:u.team,x:u.x,lane:u.lane})}
   else{attacks.push({target:target??null,castle:target?null:opponent,damage:target?stats.damage:stats.castleDamage,by:u.team,x:targetX,lane:u.lane});event(m,{type:'sword',team:u.team,x:u.x,lane:u.lane})}
  }}else{u.state='walk';const peers=living.filter(v=>v.team===u.team&&v.lane===u.lane&&v.id!==u.id&&(positions.get(v.id)!-u.x)*dir>0);const gap=peers.length?Math.min(...peers.map(v=>Math.abs(positions.get(v.id)!-u.x))):Infinity;u.x+=dir*Math.min(stats.speed*dt,Math.max(0,gap-42));}
 }
 // Gather attacks before applying them, avoiding red-first simulation advantage.
 for(const a of attacks)if(a.target)hurt(m,a.target,a.damage,a.by);else if(a.castle)castle(m,a.castle,a.damage);
 m.projectiles=m.projectiles.filter(p=>{const target=m.units.find(u=>u.id===p.targetId&&u.deathAt===null);if(p.targetId&&!target)return false;const targetX=target?.x??p.targetX,dir=p.team==='red'?1:-1,next=p.x+dir*720*dt;
  if((next-targetX)*dir>=0||Math.abs(next-targetX)<12){if(target)hurt(m,target,p.damage,p.team);else if(p.targetCastle)castle(m,p.targetCastle,p.castleDamage);return false}p.x=next;return true});
 m.units=m.units.filter(u=>u.deathAt===null||m.elapsed-u.deathAt<.65);
 if(m.players.red.hp<=0||m.players.blue.hp<=0)finish(m,'城堡被攻破');else if(m.remaining<=0)finish(m,'比赛时间结束，比较城堡生命值');
}
