import type {Kind,Settings} from './types';
export const WORLD={width:1920,height:450,left:195,right:1725,spawnLeft:265,spawnRight:1655};
export const FIXED_STEP=1/30,MAX_UNITS=60,MAX_EVENTS=90,CASTLE_HP=150;
export const PRICES:Record<Kind,number>={soldier:20,archer:35,knight:100};
export const KIND_NAMES:Record<Kind,string>={soldier:'小兵',archer:'弓箭手',knight:'重装骑士'};
export const STATS:Record<Kind,{hp:number;damage:number;interval:number;speed:number;range:number;castleDamage:number;armor:number}>={
 soldier:{hp:42,damage:12,interval:.8,speed:112,range:65,castleDamage:10,armor:1},
 archer:{hp:28,damage:12,interval:1.2,speed:92,range:325,castleDamage:7,armor:0},
 knight:{hp:120,damage:26,interval:1.35,speed:72,range:82,castleDamage:18,armor:5}
};
export const DEFAULT_SETTINGS:Settings={redName:'赤焰王国',blueName:'星蓝王国',duration:240,bank:'all',grade:'四年级',topic:'全部',difficulty:0,weights:{calculate:40,missing:20,method:25,fraction:15},music:.13,sfx:.45,effects:'high',inputMode:'simultaneous',exhaustion:'cycle',deployment:'strategy',autoOrder:['soldier','archer','knight']};
