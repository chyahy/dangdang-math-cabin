import type {Kind,Settings} from './types';
export const WORLD={width:1920,height:450,left:195,right:1725,spawnLeft:245,spawnRight:1675};
export const FIXED_STEP=1/30,MAX_UNITS=72,MAX_EVENTS=90;
export const STATS:Record<Kind,{hp:number;damage:number;interval:number;speed:number;range:number;castleDamage:number}>={
 soldier:{hp:32,damage:10,interval:.8,speed:115,range:58,castleDamage:8},
 archer:{hp:21,damage:9,interval:1.15,speed:100,range:320,castleDamage:6},
 knight:{hp:85,damage:20,interval:1.05,speed:95,range:74,castleDamage:15}
};
export const DEFAULT_SETTINGS:Settings={redName:'赤焰王国',blueName:'星蓝王国',duration:180,bank:'all',grade:'四年级',unit:'全部',difficulty:0,weights:{spell:70,meaning:15,missing:15},music:.13,sfx:.45,effects:'high',inputMode:'simultaneous',exhaustion:'cycle'};
