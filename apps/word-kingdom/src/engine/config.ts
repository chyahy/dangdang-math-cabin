import type {Kind,Settings} from './types';
export const WORLD={width:1920,height:450,left:195,right:1725,spawnLeft:265,spawnRight:1655};
export const FIXED_STEP=1/30,MAX_UNITS=60,MAX_EVENTS=90,CASTLE_HP=150;
export const TOWER={range:420,damage:12,interval:1.5,projectileSpeed:600,muzzleY:264};
export const LIGHTNING={radius:125,maxTargets:3,chainMultiplier:.65,castDelay:.2};
export const FROST={speedMultiplier:.55,duration:3,projectileSpeed:560};
export const CASTLE_LEVELS=[
 {level:1,price:0,maxHp:150,...TOWER},
 {level:2,price:100,maxHp:220,...TOWER,range:450,damage:16,interval:1.35},
 {level:3,price:160,maxHp:300,...TOWER,range:480,damage:22,interval:1.2}
] as const;
export const castleStats=(level:number)=>CASTLE_LEVELS[Math.max(0,Math.min(2,level-1))];
export const PRICES:Record<Kind,number>={soldier:20,archer:35,knight:100,mage:50,teacher:200};
export const KIND_NAMES:Record<Kind,string>={soldier:'小兵',archer:'弓箭手',knight:'重装骑士',mage:'冰冻法师',teacher:'当当老师'};
export const STATS:Record<Kind,{hp:number;damage:number;interval:number;speed:number;range:number;castleDamage:number;armor:number}>={
 soldier:{hp:42,damage:12,interval:.8,speed:112,range:65,castleDamage:10,armor:1},
 archer:{hp:28,damage:12,interval:1.2,speed:92,range:325,castleDamage:7,armor:0},
 knight:{hp:120,damage:26,interval:1.35,speed:72,range:82,castleDamage:18,armor:5},
 mage:{hp:34,damage:8,interval:1.8,speed:82,range:310,castleDamage:5,armor:0},
 teacher:{hp:150,damage:36,interval:2.6,speed:70,range:400,castleDamage:18,armor:2}
};
export const DEFAULT_SETTINGS:Settings={redName:'赤焰王国',blueName:'星蓝王国',duration:240,bank:'all',grade:'四年级',unit:'全部',difficulty:0,weights:{spell:70,meaning:15,missing:15},music:.13,sfx:.45,effects:'high',inputMode:'simultaneous',exhaustion:'cycle',deployment:'strategy',autoOrder:['soldier','archer','knight']};
