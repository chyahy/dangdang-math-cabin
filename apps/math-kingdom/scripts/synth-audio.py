"""Original, deterministic WAV exports of the game's synthesized sound palette."""
from pathlib import Path
import math, wave, struct
root=Path(__file__).resolve().parents[1]/'public'/'audio'
root.mkdir(parents=True,exist_ok=True)
sounds={'click':(560,.05,60),'correct':(660,.18,220),'wrong':(240,.15,-80),'summon':(370,.22,370),'sword':(160,.08,-90),'arrow':(800,.12,-550),'hit':(110,.08,-60),'lightning':(95,.3,800),'castle':(85,.23,-45),'countdown':(880,.09,0),'victory':(520,.5,260),'defeat':(280,.5,-160)}
def save(name,values):
    with wave.open(str(root/(name+'.wav')),'wb') as w:
        w.setparams((1,2,22050,0,'NONE','not compressed'))
        w.writeframes(b''.join(struct.pack('<h',int(max(-1,min(1,n))*32760)) for n in values))
for name,(freq,length,slide) in sounds.items():
    phase=0;data=[]
    for i in range(int(length*22050)):
        t=i/22050;phase+=2*math.pi*max(35,freq+slide*t/length)/22050
        env=min(1,t/.008)*math.exp(-5*t/length)
        data.append((math.sin(phase)+.18*math.sin(phase*2))*.23*env)
    save(name,data)
notes=[60,64,67,72,67,64,62,67,59,62,67,71,67,62,60,64]
data=[]
for i in range(int(15.36*22050)):
    t=i/22050;beat=int(t/.24);local=t% .24;freq=440*2**((notes[beat%len(notes)]-69)/12)
    env=min(1,local/.01)*math.exp(-10*local)
    data.append(.14*math.sin(2*math.pi*freq*local)*env+.04*math.sin(2*math.pi*130.81*t))
save('kingdom-theme',data)
