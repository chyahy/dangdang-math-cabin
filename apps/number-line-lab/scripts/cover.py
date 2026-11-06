"""Render the catalog cover from real number-line coordinates; no external media."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root = Path(__file__).resolve().parents[3]
im = Image.new('RGB', (960, 600), '#eaf3fc')
d = ImageDraw.Draw(im)
font = lambda size: ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', size)
mono = lambda size: ImageFont.truetype('C:/Windows/Fonts/consola.ttf', size)
for x in range(0, 960, 32): d.line((x, 0, x, 600), fill='#deebf5')
for y in range(0, 600, 32): d.line((0, y, 960, y), fill='#deebf5')
d.rounded_rectangle((52, 45, 908, 550), 30, fill='white', outline='#c9dfef', width=2)
d.text((92, 84), 'NUMBER LINE LAB', font=mono(18), fill='#7694ae')
d.text((90, 120), '数轴实验室', font=font(45), fill='#23445f')
d.text((92, 190), '把抽象的数，变成看得见的距离', font=font(19), fill='#738ca2')
xp = lambda n: 480 + n * 58
y = 365
d.line((103, y, 854, y), fill='#385975', width=3)
d.polygon(((100,y),(114,y-6),(114,y+6)), fill='#385975')
d.polygon(((860,y),(846,y-6),(846,y+6)), fill='#385975')
for n in range(-6, 7):
    x = xp(n)
    d.line((x, y-9, x, y+9), fill='#385975', width=2)
    d.text((x, y+22), str(n), font=mono(20), fill='#56738c', anchor='mt')
d.line((480, 250, 480, 468), fill='#c1d4e4', width=2)
for n, color, label in [(-3,'#2269cb','A = −3'),(3,'#e37e35',"A′ = 3")]:
    x=xp(n)
    d.line((x, 312, x, y), fill=color, width=2)
    d.ellipse((x-23,289,x+23,335),fill='#eaf1fb' if n<0 else '#fff1e4')
    d.ellipse((x-12,300,x+12,324),fill=color)
    d.text((x, 260), label, font=font(21), fill=color, anchor='mt')
    yy=437 if n<0 else 465
    d.line((x,yy,480,yy),fill=color,width=4)
    d.line((x,yy-6,x,yy+6),fill=color,width=2)
    d.line((480,yy-6,480,yy+6),fill=color,width=2)
d.text((480,493),'移动 · 测量 · 比较',font=font(19),fill='#698aa4',anchor='mt')
im.save(root/'site/portal-assets/game-numberline.webp',quality=89,method=6)
