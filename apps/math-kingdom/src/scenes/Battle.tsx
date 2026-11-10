import {useEffect,useRef} from 'react';import Phaser from 'phaser';
import {useGame} from '../store';import {FIXED_STEP,KIND_NAMES,TOWER,WORLD} from '../engine/config';import type {BattleEvent,Kind,Team} from '../engine/types';import {createCastle,createFighter} from './art';import {audio} from './audio';
type Fighter=ReturnType<typeof createFighter>;type Puff={x:number;y:number;vx:number;vy:number;life:number;max:number;color:number};
class Arena extends Phaser.Scene {
 private fighters=new Map<number,Fighter>();private pools=new Map<string,Fighter[]>();private castleRed!:ReturnType<typeof createCastle>;private castleBlue!:ReturnType<typeof createCastle>;private arrows!:Phaser.GameObjects.Graphics;private arrowSprites=new Map<number,Phaser.GameObjects.Image>();private endingTime=0;private particles!:Phaser.GameObjects.Graphics;private health!:Phaser.GameObjects.Graphics;private puffs:Puff[]=[];private floating:{text:Phaser.GameObjects.Text;life:number}[]=[];private freeTexts:Phaser.GameObjects.Text[]=[];private clouds:Phaser.GameObjects.Container[]=[];private accumulator=0;private lastId=0;private matchId='';private fpsTime=0;private fpsFrames=0;private effects:BattleEvent[]=[];
 constructor(){super('Arena')}
 preload(){this.load.image('landscape',import.meta.env.BASE_URL+'math-pixel/landscape.webp');this.load.image('frost-bolt',import.meta.env.BASE_URL+'math-pixel/frost.png');this.load.image('pixel-arrow',import.meta.env.BASE_URL+'math-pixel/arrow.png')}
 create(){
 this.cameras.main.setZoom(1/3).centerOn(WORLD.width/2,315).setRoundPixels(true);
 this.textures.get('landscape').setFilter(Phaser.Textures.FilterMode.NEAREST);this.textures.get('frost-bolt').setFilter(Phaser.Textures.FilterMode.NEAREST);this.textures.get('pixel-arrow').setFilter(Phaser.Textures.FilterMode.NEAREST);
 this.add.image(960,294,'landscape').setDisplaySize(1920,270);this.add.graphics().fillStyle(0x51aa38).fillRect(0,429,1920,24);
 for(let i=0;i<4;i++){const cloud=this.add.container(180+i*470,195+i%2*18),g=this.add.graphics();g.fillStyle(0xd8e9bc,.8);g.fillRect(0,6,99,18);g.fillRect(18,-3,63,9);g.fillRect(33,-12,30,9);g.fillStyle(0xf1f1d4,.95);g.fillRect(3,3,90,12);g.fillRect(21,-6,57,9);g.fillRect(36,-12,24,6);cloud.add(g);this.clouds.push(cloud)}
 this.castleRed=createCastle(this,'red');this.castleRed.root.setPosition(130,396).setScale(.7);this.castleBlue=createCastle(this,'blue');this.castleBlue.root.setPosition(1790,396).setScale(.7);this.arrows=this.add.graphics().setDepth(45);this.particles=this.add.graphics().setDepth(60);this.health=this.add.graphics().setDepth(50);
 this.events.once('shutdown',()=>{this.fighters.clear();this.pools.clear();this.puffs=[];this.floating=[];this.freeTexts=[];this.clouds=[]})}
 private take(team:Team,kind:Kind){const key=team+kind,pool=this.pools.get(key)||[],fig=pool.pop()||createFighter(this,team,kind);this.pools.set(key,pool);fig.root.setVisible(true).setAlpha(1).setScale(1);return fig}
 private release(id:number,fig:Fighter){const key=fig.root.getData('poolKey') as string;fig.root.setVisible(false);this.fighters.delete(id);const pool=this.pools.get(key)||[];pool.push(fig);this.pools.set(key,pool)}
 private floatingText(x:number,y:number,content:string,color:string){const text=this.freeTexts.pop()||this.add.text(0,0,'',{fontFamily:'Consolas, Microsoft YaHei',fontSize:'12px',fontStyle:'bold',backgroundColor:'#f5e2b9',padding:{x:1,y:0}}).setDepth(90).setScale(3);text.setPosition(Math.round(x/3)*3,Math.round(y/3)*3).setText(content).setColor(color).setVisible(true).setAlpha(1);this.floating.push({text,life:.8})}
 private effect(event:BattleEvent){audio.play(event.type==='upgrade'?'correct':event.type==='tower'?'arrow':event.type==='death'||event.type==='block'?'hit':event.type==='coin'?'correct':event.type);const count=useGame.getState().settings.effects==='low'?5:12,color=event.type==='frost'?0x9ce5f2:event.team==='red'?0xffb861:0x72d7ff,y=385+event.lane*8;
  if(event.type==='summon'||event.type==='upgrade'||event.type==='frost'||event.type==='hit'||event.type==='castle'||event.type==='lightning')for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;this.puffs.push({x:event.x,y:y-32,vx:Math.cos(angle)*90,vy:Math.sin(angle)*65-35,life:.5,max:.5,color})}
  if(event.type==='coin')return;
  if(event.type==='upgrade')this.floatingText(event.x,y-140,'城堡升级！','#547e62');
  if(event.amount)this.floatingText(event.x,y-85,'−'+event.amount,event.type==='castle'?'#bf4c37':'#7b5428');
  if(event.type==='lightning')this.effects.push(event);
  if(event.type==='summon'&&event.kind!=='soldier')this.floatingText(event.x,y-120,KIND_NAMES[event.kind!]+'出兵',event.team==='red'?'#a44c23':'#226b9c');
 }
 update(_time:number,delta:number){const dt=Math.min(delta/1000,.1),state=useGame.getState(),m=state.match;if(!m)return;this.fpsFrames++;if(_time-this.fpsTime>1000){const fps=Math.round(this.fpsFrames/((_time-this.fpsTime)/1000));this.fpsFrames=0;this.fpsTime=_time;const meter=document.getElementById('fps-meter');if(meter)meter.textContent=fps+' FPS'}
  if(m.id!==this.matchId){for(const [id,fig] of this.fighters)this.release(id,fig);this.matchId=m.id;this.lastId=0;this.endingTime=0;for(const image of this.arrowSprites.values())image.destroy();this.arrowSprites.clear();this.puffs=[];this.effects=[];this.arrows.clear();this.accumulator=0;for(const f of this.floating){f.text.setVisible(false);this.freeTexts.push(f.text)}this.floating=[]}
  if(m.phase==='RUNNING'||m.phase==='COUNTDOWN'){this.accumulator+=dt;while(this.accumulator>=FIXED_STEP){useGame.getState().step(FIXED_STEP);this.accumulator-=FIXED_STEP}}else this.accumulator=0;
  audio.configure(state.settings.music,state.settings.sfx,m.phase==='RUNNING');
  const time=m.elapsed;if(m.phase!=='PAUSED'&&m.phase!=='FINISHED')this.clouds.forEach((c,i)=>{c.x+=dt*(5+i);if(c.x>2020)c.x=-120});
  if(m.phase==='FINISHED')this.endingTime=Math.min(.85,this.endingTime+dt);this.castleRed.damage(m.players.red.hp/m.players.red.maxHp,time+this.endingTime,m.players.red.castleLevel);this.castleBlue.damage(m.players.blue.hp/m.players.blue.maxHp,time+this.endingTime,m.players.blue.castleLevel);
  const ids=new Set(m.units.map(u=>u.id));for(const [id,fig] of this.fighters)if(!ids.has(id))this.release(id,fig);
  this.health.clear();for(const u of m.units){let fig=this.fighters.get(u.id);if(!fig){fig=this.take(u.team,u.kind);fig.root.setData('poolKey',u.team+u.kind);this.fighters.set(u.id,fig)}const dir=u.team==='red'?1:-1,y=392+u.lane*9;fig.root.setPosition(u.x,y).setDepth(20+u.lane);fig.pose(u.state,u.state==='death'?time-(u.deathAt??time):u.state==='hurt'?time-(u.stateUntil-.16):u.state==='defend'?(time-(u.stateUntil-.16))*2.5:u.state==='aim'?Math.max(0,.28-u.cooldown):u.state==='attack'?time-u.attackAt:time+u.id*.03,dir);if(u.deathAt!==null)fig.root.setAlpha(Math.max(0,1-(time-u.deathAt)/.65));else{this.health.fillStyle(0x254440,.65).fillRect(Math.round((u.x-21)/3)*3,y-123,42,6);this.health.fillStyle(u.team==='red'?0xe68455:0x4eb6f1).fillRect(Math.round((u.x-21)/3)*3,y-123,Math.round(14*u.hp/u.maxHp)*3,6)}}
  for(const u of m.units)if(u.deathAt===null&&u.slowUntil>time){
   const x=Math.round(u.x/3)*3,y=392+u.lane*9;
   this.health.fillStyle(0x8ddbf0,.24).fillRect(x-30,y-108,60,102);
   this.health.lineStyle(3,0xd2fbff).lineBetween(x-9,y-140,x+9,y-128).lineBetween(x+9,y-140,x-9,y-128).lineBetween(x,y-146,x,y-122);
   this.health.lineStyle(3,0x7dcfe9,.8).lineBetween(x-24,y-3,x+24,y-3);
  }
  this.arrows.clear();
  for(const team of ['red','blue'] as Team[]){
   if(m.players[team].hp<=0)continue;
   const x=team==='red'?WORLD.left:WORLD.right,dir=team==='red'?1:-1,y=TOWER.muzzleY,recoil=time-m.towers[team].attackAt<.18;
   const bowX=x-(recoil?6:0)*dir;
   this.arrows.fillStyle(0x263b3d).fillRect(x-9,y,18,18);
   this.arrows.lineStyle(9,0x473126).lineBetween(bowX-9*dir,y,bowX+12*dir,y);
   this.arrows.lineStyle(6,team==='red'?0xd47745:0x4fa5d5).lineBetween(bowX+9*dir,y-18,bowX+18*dir,y).lineBetween(bowX+18*dir,y,bowX+9*dir,y+18);
   this.arrows.lineStyle(3,0xf7e1ac).lineBetween(bowX+9*dir,y-18,bowX+9*dir,y+18);
   if(recoil)this.arrows.fillStyle(0xffebad,.9).fillRect(x+21*dir-6,y-6,12,12);
  }
  const projectileIds=new Set(m.projectiles.map(p=>p.id));
  for(const [id,image] of this.arrowSprites)if(!projectileIds.has(id)){image.destroy();this.arrowSprites.delete(id)}
  for(const p of m.projectiles){
   let image=this.arrowSprites.get(p.id);
   if(!image){image=this.add.image(0,0,p.effect==='frost'?'frost-bolt':'pixel-arrow').setScale(p.source==='tower'?3.6:3).setDepth(45);if(p.source==='tower')image.setTint(p.team==='red'?0xffcf81:0xa6edff);this.arrowSprites.set(p.id,image)}
   const dir=p.team==='red'?1:-1,distance=Math.max(1,Math.abs(p.targetX-p.startX)),progress=Math.min(1,Math.abs(p.x-p.startX)/distance),targetY=330+p.lane*9;
   const y=p.source==='tower'?TOWER.muzzleY+(targetY-TOWER.muzzleY)*progress-Math.sin(progress*Math.PI)*36:targetY-Math.sin(progress*Math.PI)*(p.effect==='frost'?15:45);
   image.setPosition(Math.round(p.x/3)*3,Math.round(y/3)*3).setFlipX(dir<0);
   if(p.source==='tower')image.setRotation(Math.atan((targetY-TOWER.muzzleY-36*Math.PI*Math.cos(progress*Math.PI))/distance)*dir);
  }
  for(const ev of m.events)if(ev.id>this.lastId){this.effect(ev);this.lastId=ev.id}
  const visualDt=m.phase==='PAUSED'||m.phase==='FINISHED'?0:dt;this.particles.clear();for(const p of this.puffs){p.life-=visualDt;p.x+=p.vx*visualDt;p.y+=p.vy*visualDt;p.vy+=150*visualDt;this.particles.fillStyle(p.color,Math.max(0,p.life/p.max)).fillRect(Math.round(p.x/3)*3,Math.round(p.y/3)*3,6,6)}this.puffs=this.puffs.filter(p=>p.life>0);
  this.effects=this.effects.filter(ev=>time-ev.time<.25);for(const ev of this.effects){this.particles.lineStyle(5,0xffe7a8,.85);this.particles.beginPath();this.particles.moveTo(ev.x,30);this.particles.lineTo(ev.x-35,130);this.particles.lineTo(ev.x+25,125);this.particles.lineTo(ev.x-15,230);this.particles.lineTo(ev.x+17,225);this.particles.lineTo(ev.x,365);this.particles.strokePath()}
  this.floating=this.floating.filter(f=>{f.life-=visualDt;f.text.y-=visualDt*42;f.text.setAlpha(Math.max(0,f.life/.8));if(f.life<=0){f.text.setVisible(false);this.freeTexts.push(f.text);return false}return true});
 }
}
export function Battle(){const parent=useRef<HTMLDivElement>(null);useEffect(()=>{if(!parent.current)return;const game=new Phaser.Game({type:Phaser.AUTO,parent:parent.current,width:WORLD.width/3,height:90,backgroundColor:'#7eb3ac',transparent:false,render:{antialias:false,pixelArt:true,roundPixels:true},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[Arena],audio:{noAudio:true},fps:{target:60,limit:60,min:30,forceSetTimeOut:true}});return()=>game.destroy(true)},[]);return <div ref={parent} className="battle-canvas" aria-label="红蓝王国像素战场，士兵自动移动、战斗并攻城，冰冻法师命中减速，双方箭塔自动防守，城堡可升级" role="img"/>}
