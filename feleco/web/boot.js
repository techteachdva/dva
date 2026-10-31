addEventListener('DOMContentLoaded',function(){
var L=[[[[0,2],[0,0],[1,0]],[[0,1],[.8,1]]],[[[1,0],[0,0],[0,2],[1,2]],[[0,1],[.8,1]]],[[[0,0],[0,2],[1,2]]],[[[1,0],[0,0],[0,2],[1,2]],[[0,1],[.8,1]]],[[[1,0],[0,0],[0,2],[1,2]]],[[[0,0],[1,0],[1,2],[0,2],[0,0]]]];
var v=document.createElement('canvas');v.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:9;background:#121915;pointer-events:none';document.body.appendChild(v);
var M=new Image();M.src='godot_logo.png';var x=v.getContext('2d'),G='#e6c36a',T=performance.now(),S=0;
var hide=document.getElementById('status-splash');if(hide)hide.style.display='none';
var bar=document.getElementById('status-progress');if(bar)bar.style.opacity=0;
function tree(a,b,g,l,d,k){if(d<=0||k<.02)return;var c=a+Math.cos(g)*l*k,e=b+Math.sin(g)*l*k;x.lineWidth=.5+d*.4;x.beginPath();x.moveTo(a,b);x.lineTo(c,e);x.stroke();tree(c,e,g-.55,l*.66,d-1,k);tree(c,e,g+.55,l*.66,d-1,k)}
function draw(){var st=document.getElementById('status');if(!st||st.style.visibility==='hidden'||st.style.display==='none'){v.remove();return}
var w=v.width=innerWidth,h=v.height=innerHeight,r=Math.min(w,h)*.33,cx=w/2,cy=h*.46;
var real=bar&&bar.max?(bar.value/bar.max):0;S=Math.max(S,real,Math.min(.9,(performance.now()-T)/30000));
var p=S,turn=Math.pow(1-p,3)*Math.PI*.6,cl=performance.now()*.0004;
for(var i=0;i<12;i++){var a=turn+i*Math.PI/6,l=(cl+i*.37)%1,k=Math.sin(l*Math.PI)*Math.min(1,p*2+.2);x.strokeStyle='hsla('+(70+i*10)+',70%,75%,'+k*.65+')';tree(cx+Math.cos(a)*r*.97,cy+Math.sin(a)*r*.97,a+Math.PI,r*.3,4,k)}
x.strokeStyle='rgba(230,195,106,.25)';x.lineWidth=2;x.beginPath();x.arc(cx,cy,r,0,7);x.stroke();
x.strokeStyle=G;x.lineWidth=4;x.beginPath();x.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+6.2832*p);x.stroke();
var c=r*.2,n=0,s=[];L.forEach(function(q,i){q.forEach(function(t){s.push(t.map(function(u){var m=(i-2.75+u[0]*.72)*c*1.05,o=(u[1]-1)*c;return[cx+m*Math.cos(turn)-o*Math.sin(turn),cy+m*Math.sin(turn)+o*Math.cos(turn)]}))})});
x.lineCap='round';s.forEach(function(t,i){var b=Math.max(0,Math.min(1,p*s.length-i));x.beginPath();t.forEach(function(q,j){j?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1])});x.strokeStyle='rgba(230,195,106,.12)';x.lineWidth=3;x.stroke();if(b){x.strokeStyle='rgba(255,245,205,'+b+')';x.lineWidth=4;x.shadowColor=G;x.shadowBlur=14;x.stroke();x.shadowBlur=0}});
if(M.complete)x.drawImage(M,cx-96,h*.91-14,26,28);
x.fillStyle='#c9c6b5';x.font='15px sans-serif';x.textAlign='left';x.fillText('Godot Game Engine',cx-64,h*.91+5);
requestAnimationFrame(draw)}
draw()});
