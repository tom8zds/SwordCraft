import { createCanvas } from '@napi-rs/canvas'
import { writeFileSync, mkdirSync } from 'node:fs'

const W = 1920
const H = 1080
const c = createCanvas(W, H)
const x = c.getContext('2d')
x.imageSmoothingEnabled = false

const C = {
  black: '#0b0809', ink: '#171011', wall0: '#211719', wall1: '#352225', wall2: '#51302b', mortar: '#130e10',
  wood0: '#241716', wood1: '#4d2e24', wood2: '#79503a', wood3: '#ad7650', stone0: '#29282b', stone1: '#49484b', stone2: '#747174',
  iron0: '#282b2d', iron1: '#4f5559', iron2: '#858b8c', iron3: '#c9c9c0', ember: '#a92922', flame: '#f26427', core: '#ffd265', white: '#fff1bd', purple: '#8d68c4', violet: '#c0a2f2'
}
const rnd = (() => { let s=918273645; return () => ((s=Math.imul(s^s>>>15,1|s))>>>0)/4294967296 })()
const R=(a,b,d,e,f)=>{x.fillStyle=f;x.fillRect(Math.round(a),Math.round(b),Math.round(d),Math.round(e))}
const L=(a,b,d,e,f,g=1)=>{x.strokeStyle=f;x.lineWidth=g;x.beginPath();x.moveTo(Math.round(a),Math.round(b));x.lineTo(Math.round(d),Math.round(e));x.stroke()}
const P=(pts,col)=>{x.fillStyle=col;x.beginPath();x.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)x.lineTo(...pts[i]);x.closePath();x.fill()}
const glow=(cx,cy,r,col,alpha)=>{const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,col);g.addColorStop(.35,col);g.addColorStop(1,'transparent');x.globalAlpha=alpha;x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2);x.globalAlpha=1}

// Background base and timber frame
R(0,0,W,H,C.black)
const sky=x.createLinearGradient(0,0,0,760);sky.addColorStop(0,'#17131c');sky.addColorStop(.55,'#251a20');sky.addColorStop(1,'#3b251f');x.fillStyle=sky;x.fillRect(0,0,W,760)
R(0,760,W,320,'#1a1112')
R(0,78,W,32,C.wood0);R(0,93,W,7,C.wood3);R(0,735,W,42,C.wood0);R(0,740,W,7,C.wood3)
for(const px of [140,580,1040,1500,1840]){R(px,70,34,700,C.wood0);R(px+5,76,6,680,C.wood2);for(let j=0;j<16;j++)R(px+14+rnd()*9,100+j*38,12+rnd()*8,2,C.wood3)}

// Detailed masonry: individually varied bricks, cracks, soot
for(let row=0,py=112;py<736;row++,py+=47){const bh=43;const offset=row%2?-62:0;for(let px=offset;px<W;px+=126){const shade=[C.wall1,C.wall2,'#43282a','#5b332c'][Math.floor(rnd()*4)];R(px+3,py,120,bh,shade);R(px+3,py,120,4,'#694038');R(px+3,py+bh-5,120,5,'#1a1013');R(px,py-4,126,4,C.mortar);R(px,py,4,bh,C.mortar);if(rnd()>.48){R(px+15+rnd()*80,py+9+rnd()*20,12+rnd()*22,3,'#2a171b');R(px+17+rnd()*70,py+12+rnd()*18,5+rnd()*12,2,'#744137')}if(rnd()>.78){const cx=px+20+rnd()*75,cy=py+6;L(cx,cy,cx+8,cy+9,'#180e11',2);L(cx+8,cy+9,cx+2,cy+22,'#180e11',2)}}}
// soot around chimney
for(let i=0;i<180;i++){const px=260+(rnd()-.5)*270,py=70+rnd()*400,rad=3+rnd()*17;x.globalAlpha=.04+rnd()*.11;R(px,py,rad,rad,'#020203')}x.globalAlpha=1

// Roof cold shafts / volumetric rays
x.save();x.globalCompositeOperation='screen';const ray=x.createLinearGradient(700,0,980,670);ray.addColorStop(0,'rgba(157,184,211,.22)');ray.addColorStop(.55,'rgba(105,135,164,.08)');ray.addColorStop(1,'rgba(80,110,140,0)');P([[700,0],[830,0],[1110,720],[900,720]],ray);x.restore()
for(let i=0;i<160;i++){const px=680+rnd()*530,py=20+rnd()*700,sz=rnd()>0.8?3:1;x.globalAlpha=.12+rnd()*.24;R(px,py,sz,sz,'#c4d2d3')}x.globalAlpha=1

// Floor boards with perspective and rich wear
for(let py=770;py<H;py+=58){R(0,py,W,54,py%116?C.wood1:'#3e271f');R(0,py,W,5,'#120c0c');R(0,py+5,W,3,C.wood2)}
for(let px=-250;px<W+250;px+=145){L(px,760,px-120,H,'#110b0b',5);L(px+6,760,px-114,H,'#694433',2)}
for(let i=0;i<280;i++){const py=790+rnd()*270,px=rnd()*W;R(px,py,8+rnd()*40,2,rnd()>.5?'#6a4432':'#281817')}

// Forge structure: chimney, masonry body, iron fittings
R(80,50,390,400,'#100c0e');R(97,52,356,394,C.stone0);R(116,58,320,385,'#353033')
for(let row=0,py=70;py<430;row++,py+=44){for(let px=104+(row%2?42:-18);px<450;px+=94){R(px,py,89,39,row%3===0?C.stone1:'#3f3c40');R(px,py,89,4,C.stone2);R(px,py+35,89,4,'#1b191c');R(px-4,py,4,40,'#181619')}}
// iron chimney bands and rivets
for(const py of [128,286,412]){R(85,py,379,18,C.iron0);R(91,py+3,367,5,C.iron2);for(let px=106;px<448;px+=42){R(px,py+6,5,5,C.iron3);R(px+1,py+7,3,3,C.iron1)}}
// Furnace outer block with cut brick arch
P([[44,402],[502,402],[534,474],[534,820],[30,820],[30,475]],C.stone0)
R(40,472,484,338,'#4a3d3a')
for(let row=0,py=420;py<805;row++,py+=46){for(let px=38+(row%2?56:0);px<523;px+=112){const hot=Math.max(0,1-Math.hypot(px-275,py-620)/320);const colors=hot>.55?['#654039','#724036','#54302f']:['#4a3b3a','#57433d','#3c3334'];const col=colors[Math.floor(rnd()*colors.length)];R(px+3,py,106,41,col);R(px+4,py+2,103,4,hot>.55?'#996048':'#6a5149');R(px,py-4,112,4,'#21191b');R(px,py,4,43,'#21191b');if(rnd()>.45)R(px+20+rnd()*50,py+13+rnd()*15,8+rnd()*24,3,'#312326')}}
// chipped corners/cracks
for(const [a,b] of [[65,473],[475,515],[87,742],[451,774]]){R(a,b,18,10,'#241b1d');R(a+10,b+8,14,8,'#241b1d');L(a+4,b+18,a+25,b+43,'#1b1416',3);L(a+25,b+43,a+17,b+68,'#1b1416',2)}
// arched throat, inner depth, iron lip
P([[102,704],[102,560],[128,504],[178,466],[344,466],[402,504],[428,560],[428,704]],'#151012')
P([[130,700],[130,574],[153,528],[198,500],[324,500],[373,528],[400,574],[400,700]],'#080708')
R(108,687,316,38,C.iron0);R(116,692,300,10,C.iron2);for(let px=135;px<400;px+=38){R(px,701,7,7,C.iron3);R(px+2,703,3,3,'#4a4441')}
// Air vent / grate
R(63,727,62,58,C.iron0);R(70,733,48,44,'#171719');for(let px=76;px<116;px+=10)R(px,737,5,35,C.iron2)
// fuel bed - ash, logs, coal, embers
R(141,665,250,32,'#2a1c19');for(let i=0;i<38;i++){const px=150+rnd()*225,py=650+rnd()*45,sz=7+rnd()*17;P([[px,py],[px+sz*.7,py-5-rnd()*8],[px+sz,py+sz*.4],[px+4,py+sz*.55]],rnd()>.45?'#191517':'#342629');if(rnd()>.45)R(px+3,py,sz*.5,3,rnd()>.5?C.ember:C.flame)}
for(const [px,py,rot] of [[155,661,.18],[234,674,-.13],[307,658,.09]]){x.save();x.translate(px,py);x.rotate(rot);R(0,0,88,20,'#3b2119');R(4,3,80,5,'#895139');R(9,15,70,4,'#1a1010');for(let i=15;i<76;i+=18)L(i,3,i-7,17,'#1e1212',2);x.restore()}
// layered detailed fire
x.save();x.globalCompositeOperation='screen';glow(266,610,250,'#ff6428',.23);glow(266,625,150,'#ffbd4d',.32);x.restore()
P([[142,665],[158,612],[179,630],[193,552],[217,606],[239,515],[265,591],[286,478],[311,580],[335,529],[352,616],[379,567],[390,665]],'#8f241f')
P([[156,665],[174,623],[195,638],[208,579],[229,618],[249,548],[267,609],[288,519],[309,611],[329,577],[347,637],[371,603],[383,665]],C.flame)
P([[178,665],[197,634],[211,644],[226,606],[244,638],[260,586],[275,630],[291,570],[309,634],[327,613],[343,653],[359,635],[371,665]],C.core)
P([[211,665],[228,643],[242,651],[257,619],[270,647],[286,607],[300,651],[317,632],[329,665]],C.white)
// Sparks + smoke particles
for(let i=0;i<90;i++){const px=145+rnd()*260,py=330+rnd()*320,sz=rnd()>.82?5:2;x.globalAlpha=.25+rnd()*.7;R(px,py,sz,sz,rnd()>.48?C.core:C.flame)}x.globalAlpha=1
for(let i=0;i<35;i++){const px=160+rnd()*220,py=250+rnd()*240,rr=8+rnd()*22;x.globalAlpha=.025+rnd()*.05;R(px,py,rr,rr,'#b6a2a0')}x.globalAlpha=1

// Workbench with heavy detailed timber
R(585,648,585,42,C.wood0);R(598,632,560,47,C.wood2);R(607,636,542,8,C.wood3);R(620,676,40,255,C.wood0);R(1090,676,40,255,C.wood0);R(642,846,467,32,C.wood0);R(650,850,450,7,C.wood2)
for(let i=0;i<45;i++){const px=610+rnd()*535,py=640+rnd()*26;R(px,py,12+rnd()*44,2,rnd()>.5?C.wood3:'#3d241e')}for(let i=0;i<12;i++){R(628,704+i*17,24,3,C.wood1);R(1098,704+i*17,24,3,C.wood1)}
// Anvil rich metal
P([[690,550],[1012,550],[1060,587],[1035,620],[930,632],[724,620],[660,589]],C.iron0)
P([[680,551],[1008,551],[1043,579],[1019,598],[707,598],[671,580]],C.iron2)
P([[695,551],[998,551],[1010,559],[690,559]],C.iron3)
P([[750,598],[952,598],[938,766],[1005,835],[686,835],[765,766]],C.iron0)
P([[779,605],[923,605],[913,749],[950,794],[735,794],[787,749]],C.iron1)
R(686,826,319,40,C.iron0);R(704,830,283,8,C.iron2)
// scratches, dents, cool highlights
for(let i=0;i<28;i++){const px=700+rnd()*300,py=564+rnd()*24;R(px,py,12+rnd()*45,2,rnd()>.55?C.iron3:'#34383a')}for(let i=0;i<10;i++){const px=765+rnd()*165,py=620+rnd()*130;L(px,py,px+6+rnd()*13,py+7+rnd()*18,'#25282a',2)}
// Heated sword laid on anvil, detailed blade
x.save();x.translate(835,566);x.rotate(-.03);R(-210,-13,420,26,'#161214');P([[-204,-8],[157,-8],[207,0],[157,8],[-204,8],[-229,0]],'#a73528');P([[-201,-5],[156,-5],[193,0],[156,4],[-201,4],[-219,0]],'#ed7034');L(-185,-3,154,-3,'#ffd36d',4);R(151,-23,15,46,C.iron0);R(154,-19,9,38,C.core);R(166,-9,73,18,C.wood0);for(let i=174;i<233;i+=12)R(i,-8,5,16,'#b57a46');R(235,-16,18,32,C.iron0);R(239,-12,10,24,C.iron2);x.restore();x.save();x.globalCompositeOperation='screen';glow(838,565,145,'#ff7432',.18);x.restore()
// Hammer and smith arm partial
x.save();x.translate(1075,365);x.rotate(-.35);R(-31,-22,115,50,C.iron0);R(-24,-16,101,34,C.iron2);R(-19,-12,90,7,C.iron3);R(46,23,25,236,C.wood0);R(51,29,14,222,C.wood3);for(let py=50;py<235;py+=31)R(48,py,21,8,'#2a1916');x.restore()
// gloved arms / apron edge
P([[1150,372],[1280,406],[1232,510],[1112,451]],'#6f3e30');P([[1112,451],[1195,478],[1160,545],[1084,493]],'#38282a');R(1080,486,70,42,'#9a6d50');R(1084,492,61,30,'#55362c')

// Detailed rack, weapons and hanging tools
R(1420,125,390,600,C.wood0);R(1438,143,354,565,C.wood1);for(const py of [300,475,650]){R(1434,py,364,28,C.wood0);R(1442,py+3,348,8,C.wood3)}R(1435,140,27,570,C.wood0);R(1768,140,27,570,C.wood0)
for(let i=0;i<8;i++){const px=1475+(i%4)*77,py=220+Math.floor(i/4)*178;x.save();x.translate(px,py);x.rotate((i%3-1)*.08);const fancy=i===3||i===7;P([[-7,-74],[7,-74],[fancy?15:10,38],[0,53],[fancy?-15:-10,38]],fancy?'#8d77b2':C.iron2);L(-3,-68,-2,35,C.iron3,4);R(-27,34,54,12,fancy?C.purple:'#b27a39');R(-7,45,14,43,C.wood1);if(fancy){R(-15,-25,5,35,C.violet);R(11,-38,5,44,C.core)}x.restore()}
// wall tools
for(const [px,py,type] of [[560,192,0],[618,180,1],[680,204,2],[1275,167,0],[1335,185,1]]){R(px,py,7,126,C.iron1);R(px+2,py,3,120,C.iron3);if(type===0)R(px-18,py-8,42,16,C.iron2);if(type===1)P([[px-14,py],[px+20,py],[px+4,py+29]],C.iron2);if(type===2){L(px,py,px-18,py+29,C.iron2,6);L(px+6,py,px+24,py+29,C.iron2,6)}}
// Submit counter and bell
R(1370,785,448,180,C.wood0);R(1384,801,420,148,C.wood1);R(1355,755,475,58,C.wood2);R(1367,759,450,10,C.wood3);for(let i=0;i<25;i++)R(1395+rnd()*390,820+rnd()*110,12+rnd()*33,2,rnd()>.5?C.wood2:'#32201b')
P([[1692,753],[1703,704],[1734,677],[1764,704],[1775,753]],'#b17d2d');P([[1702,749],[1713,708],[1734,691],[1754,708],[1765,749]],C.core);R(1682,748,104,22,'#4b321c');R(1690,750,88,8,C.iron2);x.save();x.globalCompositeOperation='screen';glow(1734,719,75,'#f4c458',.15);x.restore()
// altar, magic bloom
R(1195,850,130,105,C.stone0);R(1209,831,102,35,C.stone1);P([[1230,834],[1260,795],[1290,834],[1260,867]],C.purple);P([[1244,834],[1260,813],[1277,834],[1260,851]],C.violet);x.save();x.globalCompositeOperation='screen';glow(1260,830,120,'#9168dc',.28);x.restore();for(let i=0;i<36;i++){const a=rnd()*Math.PI*2,r=28+rnd()*85;R(1260+Math.cos(a)*r,830+Math.sin(a)*r*.6,2+rnd()*3,2+rnd()*3,rnd()>.5?C.violet:C.purple)}

// Foreground chains / depth of field cues (drawn soft intentionally)
x.save();x.filter='blur(5px)';x.globalAlpha=.45;for(let py=-20;py<420;py+=34){x.strokeStyle='#181419';x.lineWidth=12;x.beginPath();x.ellipse(37,py,13,23,py%68?.35:-.35,0,Math.PI*2);x.stroke()}R(1820,400,110,620,'#0d0a0b');x.restore()
// Bloom composite spots
x.save();x.globalCompositeOperation='screen';glow(270,620,360,'#ff4f22',.2);glow(836,562,170,'#ff7b39',.1);glow(1260,830,170,'#9b72e2',.15);x.restore()
// Smoke haze / volumetric scatter
const haze=x.createLinearGradient(0,300,1500,700);haze.addColorStop(0,'rgba(245,118,49,.12)');haze.addColorStop(.5,'rgba(164,105,83,.035)');haze.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=haze;x.fillRect(0,200,1500,700)
// Vignette
const vig=x.createRadialGradient(W/2,H/2,380,W/2,H/2,1120);vig.addColorStop(.45,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,.72)');x.fillStyle=vig;x.fillRect(0,0,W,H)
// Pixel upscale cue: restrained grid-aligned highlights
for(let i=0;i<50;i++){const px=Math.round((500+rnd()*850)/3)*3,py=Math.round((320+rnd()*500)/3)*3;x.globalAlpha=.08+rnd()*.1;R(px,py,3,3,'#ffd39a')}x.globalAlpha=1

mkdirSync('docs/art-style-options',{recursive:true})
writeFileSync('docs/art-style-options/hd2d-forge-concept.png',c.toBuffer('image/png'))
