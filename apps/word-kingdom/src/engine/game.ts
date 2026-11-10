import {CASTLE_HP,FIXED_STEP,MAX_EVENTS,MAX_UNITS,PRICES,STATS,FROST,TOWER,CASTLE_LEVELS,castleStats,WORLD} from './config';import type {BattleEvent,Word,Kind,Match,Player,Settings,Team,Unit} from './types';import {filterWords,judge,makeQuestion,rng,shuffle,typesFor} from '../questions/questions';
export const enemy=(t:Team):Team=>t==='red'?'blue':'red';export const accuracy=(p:Player)=>p.correct/(p.correct+p.wrong+p.skipped||1);
const player=():Player=>({hp:CASTLE_HP,maxHp:CASTLE_HP,castleLevel:1,lastUpgrade:-1,coins:0,earned:0,spent:0,purchases:{soldier:0,archer:0,knight:0,mage:0},correct:0,wrong:0,skipped:0,streak:0,best:0,index:0,cycle:0,question:null,selected:[],feedback:null,errors:{},exhausted:false,lastPurchase:-1,autoIndex:0});
export function createMatch(words:Word[],settings:Settings,seed=Date.now()):Match{
 if(!Object.values(settings.weights).some(v=>v>0))throw Error('至少启用一种英语题型。');
 const bank=filterWords(words,settings);if(!bank.length)throw Error('当前筛选没有单词，请先调整词库。');
 const m:Match={id:crypto.randomUUID(),phase:'COUNTDOWN',resumePhase:'COUNTDOWN',countdown:3,elapsed:0,remaining:settings.duration,players:{red:player(),blue:player()},towers:{red:{cooldown:0,attackAt:-10},blue:{cooldown:0,attackAt:-10}},units:[],projectiles:[],events:[],nextId:1,deck:shuffle(bank,rng(seed)),typeDeck:typesFor(settings,seed+20),settings:structuredClone(settings),seed,winner:null,reason:'',turn:'red',resultSaved:false};
 for(const t of ['red','blue'] as Team[])nextQuestion(m,t);return m;
}
function event(m:Match,data:Omit<BattleEvent,'id'|'time'>){m.events.push({...data,id:m.nextId++,time:m.elapsed});if(m.events.length>MAX_EVENTS)m.events.splice(0,m.events.length-MAX_EVENTS)}
function nextQuestion(m:Match,t:Team){const p=m.players[t];if(p.index>=m.deck.length){if(m.settings.exhaustion==='stop'){p.question=null;p.exhausted=true;p.feedback=null;p.selected=[];return}p.index=0;p.cycle++}const type=m.typeDeck[(p.index+p.cycle*m.deck.length)%m.typeDeck.length];p.question=makeQuestion(m.deck[p.index],m.deck,type,p.index,p.cycle,m.seed,t);p.selected=[];p.feedback=null}

export function canAnswer(m:Match,t:Team){return m.phase==='RUNNING'&&!m.players[t].feedback&&!m.players[t].exhausted&&(m.settings.inputMode==='simultaneous'||m.turn===t)}
export function selectCard(m:Match,t:Team,id:string){if(!canAnswer(m,t))return;const p=m.players[t],q=p.question;if(!q||!q.options.some(o=>o.id===id)||p.selected.includes(id))return;p.selected=q.type==='spell'?[...p.selected,id]:[id]}
export function purchase(m:Match,t:Team,kind:Kind):boolean{const p=m.players[t];if(m.phase!=='RUNNING'||!PRICES[kind]||p.coins<PRICES[kind]||m.elapsed-p.lastPurchase<.22||m.units.filter(u=>u.team===t&&u.deathAt===null).length>=MAX_UNITS/2)return false;p.lastPurchase=m.elapsed;p.coins-=PRICES[kind];p.spent+=PRICES[kind];p.purchases[kind]++;summon(m,t,kind);return true}
export function upgradeCastle(m:Match,t:Team):boolean{
 const p=m.players[t],next=CASTLE_LEVELS[p.castleLevel];
 if(m.phase!=='RUNNING'||p.hp<=0||!next||p.coins<next.price||m.elapsed-p.lastUpgrade<.35)return false;
 p.lastUpgrade=m.elapsed;p.coins-=next.price;p.spent+=next.price;
 p.hp=Math.min(next.maxHp,p.hp+next.maxHp-p.maxHp);p.maxHp=next.maxHp;p.castleLevel=next.level;
 m.towers[t].cooldown=Math.min(m.towers[t].cooldown,next.interval);
 event(m,{type:'upgrade',team:t,x:t==='red'?WORLD.left:WORLD.right,lane:0});
 return true;
}
export const movementSpeed=(u:Unit,time:number)=>STATS[u.kind].speed*(u.slowUntil>time?FROST.speedMultiplier:1);
export function summon(m:Match,t:Team,kind:Kind){const id=m.nextId++,stats=STATS[kind];m.units.push({id,team:t,kind,x:t==='red'?WORLD.spawnLeft:WORLD.spawnRight,lane:id%3-1,hp:stats.hp,maxHp:stats.hp,cooldown:.2,state:'idle',stateUntil:0,deathAt:null,attackAt:-10,slowUntil:0});event(m,{type:'summon',team:t,x:t==='red'?WORLD.spawnLeft:WORLD.spawnRight,lane:id%3-1,kind})}
export function reward(m:Match,t:Team):number{
 const p=m.players[t];p.streak++;p.best=Math.max(p.best,p.streak);
 const coins=({1:15,2:20,3:30}[p.question?.entry.difficulty??1]||15)+(p.streak%3===0?5:0);
 p.coins+=coins;p.earned+=coins;event(m,{type:'coin',team:t,x:t==='red'?270:1650,lane:0,amount:coins});return coins;
}
export function submit(m:Match,t:Team,qid:string,skip=false):boolean|null{
 const p=m.players[t],q=p.question;if(!canAnswer(m,t)||!q||q.id!==qid||!skip&&!p.selected.length)return null;
 const correct=!skip&&judge(q,p.selected);let coins=0;
 if(correct){p.correct++;coins=reward(m,t)}else{if(skip)p.skipped++;else p.wrong++;p.streak=0;const old=p.errors[q.entry.id];p.errors[q.entry.id]={word:q.entry.word,meaning:q.entry.meaning,count:(old?.count??0)+1,submitted:p.selected.map(id=>q.options.find(o=>o.id===id)?.text??'').join(''),skipped:skip}}
 p.feedback={correct,message:skip?'已跳过，记住这个单词':correct?`+${coins} 金币${p.streak%3===0?' · 连击 +5':''}`:'正确答案',answer:q.entry.word+' · '+q.entry.meaning,until:m.elapsed+(correct?.48:1.6),skipped:skip,coins};event(m,{type:correct?'correct':'wrong',team:t,x:t==='red'?195:1725,lane:0});if(m.settings.inputMode==='turns')m.turn=enemy(t);return correct;
}

function hurt(m:Match,u:Unit,raw:number,by:Team){if(u.deathAt!==null)return;const damage=Math.max(1,raw-STATS[u.kind].armor);u.hp=Math.max(0,u.hp-damage);u.state=(u.kind==='knight'||u.kind==='soldier')&&Math.floor(m.elapsed*10)%2===0?'defend':'hurt';u.stateUntil=m.elapsed+.16;event(m,{type:'hit',team:by,x:u.x,lane:u.lane,amount:damage});if(STATS[u.kind].armor)event(m,{type:'block',team:u.team,x:u.x,lane:u.lane});if(u.hp===0){u.deathAt=m.elapsed;u.state='death';event(m,{type:'death',team:u.team,x:u.x,lane:u.lane})}}
function castle(m:Match,t:Team,damage:number){if(m.phase!=='RUNNING')return;m.players[t].hp=Math.max(0,m.players[t].hp-damage);event(m,{type:'castle',team:t,x:t==='red'?WORLD.left:WORLD.right,lane:0,amount:damage})}
export function finish(m:Match,reason:string){if(m.phase==='FINISHED')return;m.phase='FINISHED';const r=m.players.red,b=m.players.blue;const comparisons=[r.hp-b.hp,r.earned-b.earned,accuracy(r)-accuracy(b)],labels=['城堡生命','累计获得金币','答题正确率'];const index=comparisons.findIndex(d=>d!==0);m.winner=index<0?'draw':comparisons[index]>0?'red':'blue';m.reason=reason+(index<0?'，双方各项相同，平局':`，按${labels[index]}判定`);event(m,{type:'finish',team:m.winner==='blue'?'blue':'red',x:960,lane:0})}
export function pause(m:Match){if(m.phase==='RUNNING'||m.phase==='COUNTDOWN'){m.resumePhase=m.phase;m.phase='PAUSED'}}export function resume(m:Match){if(m.phase==='PAUSED')m.phase=m.resumePhase}
/** Towers share the same projectile and armor rules as the army. */
function fireTowers(m:Match,dt:number){
 for(const team of ['red','blue'] as Team[]){
  const tower=m.towers[team],stats=castleStats(m.players[team].castleLevel);tower.cooldown=Math.max(0,tower.cooldown-dt);
  if(m.players[team].hp<=0||tower.cooldown>1e-8)continue;
  const x=team==='red'?WORLD.left:WORLD.right;
  const target=m.units.filter(u=>u.team!==team&&u.deathAt===null&&u.hp>0&&Math.abs(u.x-x)<=stats.range)
   .sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x)||a.id-b.id)[0];
  if(!target)continue;
  tower.cooldown=stats.interval;tower.attackAt=m.elapsed;
  m.projectiles.push({id:m.nextId++,team,source:'tower',x,startX:x,targetId:target.id,targetCastle:null,targetX:target.x,damage:stats.damage,castleDamage:0,lane:target.lane});
  event(m,{type:'tower',team,x,lane:target.lane});
 }
}
export function tick(m:Match,dt=FIXED_STEP){
 if(!Number.isFinite(dt)||dt<=0)return;if(m.phase==='COUNTDOWN'){m.countdown=Math.max(0,m.countdown-dt);if(m.countdown<1e-8){m.countdown=0;m.phase='RUNNING'}return}if(m.phase!=='RUNNING')return;
 const before=Math.ceil(m.remaining);m.elapsed+=dt;m.remaining=Math.max(0,m.settings.duration-m.elapsed);if(before!==Math.ceil(m.remaining)&&m.remaining<=10)event(m,{type:'tick',team:'red',x:960,lane:0});
 for(const t of ['red','blue'] as Team[]){const p=m.players[t];if(p.feedback&&m.elapsed>=p.feedback.until){p.index++;nextQuestion(m,t)}if(m.settings.deployment==='auto'){const kind=m.settings.autoOrder[p.autoIndex%m.settings.autoOrder.length];if(kind&&purchase(m,t,kind))p.autoIndex++}}
 fireTowers(m,dt);
 const living=m.units.filter(u=>u.deathAt===null),positions=new Map(living.map(u=>[u.id,u.x])),attacks:{target:Unit|null;castle:Team|null;damage:number;by:Team}[]=[];
 for(const u of living){const stats=STATS[u.kind],dir=u.team==='red'?1:-1,opponent=enemy(u.team);u.cooldown=Math.max(0,u.cooldown-dt);if((u.state==='hurt'||u.state==='defend')&&m.elapsed<u.stateUntil)continue;
 const foes=living.filter(f=>f.team!==u.team&&(positions.get(f.id)!-positions.get(u.id)!)*dir>=-35);foes.sort((a,b)=>Math.abs(a.x-u.x)-Math.abs(b.x-u.x));const target=foes[0],tx=target?positions.get(target.id)!:u.team==='red'?WORLD.right:WORLD.left;
 if(Math.abs(tx-u.x)<=stats.range+(target?0:30)){u.state=m.elapsed-u.attackAt<.36?'attack':(u.kind==='archer'||u.kind==='mage')&&u.cooldown<.28?'aim':'idle';if(u.cooldown<=0){u.cooldown=stats.interval;u.state='attack';u.attackAt=m.elapsed;if(u.kind==='archer'||u.kind==='mage'){m.projectiles.push({id:m.nextId++,team:u.team,source:'unit',effect:u.kind==='mage'?'frost':undefined,x:u.x,startX:u.x,targetId:target?.id??null,targetCastle:target?null:opponent,targetX:tx,damage:stats.damage,castleDamage:stats.castleDamage,lane:u.lane});event(m,{type:u.kind==='mage'?'frost':'arrow',team:u.team,x:u.x,lane:u.lane})}else{attacks.push({target:target||null,castle:target?null:opponent,damage:target?stats.damage:stats.castleDamage,by:u.team});event(m,{type:'sword',team:u.team,x:u.x,lane:u.lane})}}}
 else{u.state='walk';const peers=living.filter(v=>v.team===u.team&&v.lane===u.lane&&v.id!==u.id&&(positions.get(v.id)!-u.x)*dir>0),gap=peers.length?Math.min(...peers.map(v=>Math.abs(positions.get(v.id)!-u.x))):Infinity;u.x+=dir*Math.min(movementSpeed(u,m.elapsed)*dt,Math.max(0,gap-50))}}
 for(const a of attacks)if(a.target)hurt(m,a.target,a.damage,a.by);else if(a.castle)castle(m,a.castle,a.damage);
 m.projectiles=m.projectiles.filter(p=>{const target=m.units.find(u=>u.id===p.targetId&&u.deathAt===null);if(p.targetId&&!target)return false;const tx=target?.x??p.targetX,dir=p.team==='red'?1:-1,next=p.x+dir*(p.source==='tower'?TOWER.projectileSpeed:p.effect==='frost'?FROST.projectileSpeed:720)*dt;p.targetX=tx;if((next-tx)*dir>=0||Math.abs(next-tx)<12){if(target){hurt(m,target,p.damage,p.team);if(p.effect==='frost'&&target.deathAt===null)target.slowUntil=Math.max(target.slowUntil,m.elapsed+FROST.duration)}else if(p.targetCastle)castle(m,p.targetCastle,p.castleDamage);return false}p.x=next;return true});
 m.units=m.units.filter(u=>u.deathAt===null||m.elapsed-u.deathAt<.65);if(m.players.red.hp<=0||m.players.blue.hp<=0)finish(m,'城堡被攻破');else if(m.remaining<=0)finish(m,'比赛时间结束');
}
