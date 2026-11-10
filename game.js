(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const hangar = $('#hangarScreen'), gameScreen = $('#gameScreen');
  const stageCanvas = $('#hangarCanvas'), stageCtx = stageCanvas.getContext('2d');
  const canvas = $('#gameCanvas'), ctx = canvas.getContext('2d');
  const planes = [
    {name:'A6M ZERO', model:'ZERO-SEN', short:'A6M', role:'TURN FIGHTER', color:'#587653', trim:'#c8b878', speed:4.7, turn:1.04, hp:100, label:'Imperial jade'},
    {name:'F4F WILDCAT', model:'WILDCAT', short:'F4F', role:'RUGGED DEFENDER', color:'#536c75', trim:'#d4c08a', speed:4.2, turn:.82, hp:130, label:'Navy slate'},
    {name:'P-38 LIGHTNING', model:'LIGHTNING', short:'P-38', role:'TWIN-ENGINE ACE', color:'#82735b', trim:'#d8cfaa', speed:4.5, turn:.9, hp:110, label:'Desert olive'}
  ];
  const paints = [
    {name:'Imperial jade', colors:['#587653','#c8b878','#ddd6b1','#25372f']},
    {name:'Navy slate', colors:['#536c75','#d4c08a','#e4dfc9','#273b46']},
    {name:'Desert olive', colors:['#82735b','#d8cfaa','#ece4ca','#4b4a39']},
    {name:'Signal red', colors:['#a7553d','#ded0a1','#f0ead4','#493c36']}
  ];
  let planeIndex = 0, paintIndex = 0, ordnanceIndex = 0;
  const ordnance = [{name:'2 × 60 kg bomb',ammo:2,damage:5},{name:'4 × 30 kg bomb',ammo:4,damage:3},{name:'Drop tank',ammo:1,damage:1}];
  const state = {running:false, paused:false, ended:false, muted:false, time:360, kills:0, score:0, shots:0, hits:0, health:100, bombs:2, enemies:[], bullets:[], enemyShots:[], particles:[], clouds:[], islands:[], keys:{}, pointer:{x:innerWidth/2,y:innerHeight/2}, firing:false, spawn:0, last:0, damageFlash:0};
  let dpr=1, width=0, height=0, audioCtx=null, toastTimer;
  const rand=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function drawPlane(c, x,y, scale, angle, color, trim, type=0, alpha=1) {
    c.save(); c.translate(x,y); c.rotate(angle+Math.PI/2); c.scale(scale,scale); c.globalAlpha=alpha;
    c.lineJoin='round'; c.lineCap='round';
    // wing silhouette and tail
    c.fillStyle='#172521'; c.beginPath(); c.moveTo(-2,-22); c.lineTo(-27,-9); c.lineTo(-34,-5); c.lineTo(-33,0); c.lineTo(-7,-3); c.lineTo(-8,12); c.lineTo(-17,17); c.lineTo(-16,20); c.lineTo(-3,17); c.lineTo(0,20); c.lineTo(3,17); c.lineTo(16,20); c.lineTo(17,17); c.lineTo(8,12); c.lineTo(7,-3); c.lineTo(33,0); c.lineTo(34,-5); c.lineTo(27,-9); c.lineTo(2,-22); c.closePath(); c.fill();
    c.fillStyle=color; c.beginPath(); c.moveTo(0,-29); c.quadraticCurveTo(4,-21,5,-11); c.lineTo(29,-5); c.lineTo(31,-2); c.lineTo(6,-4); c.lineTo(6,12); c.lineTo(16,17); c.lineTo(15,19); c.lineTo(2,16); c.lineTo(0,19); c.lineTo(-2,16); c.lineTo(-15,19); c.lineTo(-16,17); c.lineTo(-6,12); c.lineTo(-6,-4); c.lineTo(-31,-2); c.lineTo(-29,-5); c.lineTo(-5,-11); c.quadraticCurveTo(-4,-21,0,-29); c.closePath(); c.fill();
    c.fillStyle=trim; c.globalAlpha=alpha*.78; c.fillRect(-28,-5,9,2);c.fillRect(19,-5,9,2); c.globalAlpha=alpha;
    // cockpit, spinner, national insignia
    c.fillStyle='#263a37';c.beginPath();c.ellipse(0,-13,2.1,5,0,0,Math.PI*2);c.fill();
    c.fillStyle='#e7e1c9'; c.beginPath();c.arc(-19,-5,2.15,0,Math.PI*2);c.arc(19,-5,2.15,0,Math.PI*2);c.fill();
    c.fillStyle='#c45d3c';c.beginPath();c.arc(-19,-5,1.05,0,Math.PI*2);c.arc(19,-5,1.05,0,Math.PI*2);c.fill();
    if(type===2){c.fillStyle='#182a26';c.fillRect(-10,-10,3,12);c.fillRect(7,-10,3,12)}
    c.fillStyle='#e9dfbd';c.fillRect(-1,-27,2,4); c.restore();
  }
  function resize() {
    const rect=canvas.getBoundingClientRect(); dpr=Math.min(devicePixelRatio||1,1.7); width=rect.width; height=rect.height;
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    const sr=stageCanvas.getBoundingClientRect();stageCanvas.width=Math.round(sr.width*dpr);stageCanvas.height=Math.round(sr.height*dpr);stageCtx.setTransform(dpr,0,0,dpr,0,0);drawHangar();
  }
  function drawHangar(){const c=stageCtx,w=stageCanvas.clientWidth,h=stageCanvas.clientHeight;if(!w||!h)return;c.clearRect(0,0,w,h);const p=planes[planeIndex], colors=paints[paintIndex].colors;
    // subtle cloud wisps
    c.save();c.globalAlpha=.13;c.fillStyle='#fff';for(let i=0;i<8;i++){let x=((i*137+Date.now()*.003)% (w+100))-50,y=35+(i*47)%Math.max(60,h-70);c.beginPath();c.ellipse(x,y,rand(28,66),4,0,0,Math.PI*2);c.fill()}c.restore();
    const cx=w*.51,cy=h*.52; c.save();c.translate(cx,cy);c.rotate(-.08);c.scale(2.5,2.5);
    if(planeIndex===2){c.fillStyle='#182521';c.fillRect(-23,-5,9,16);c.fillRect(14,-5,9,16)}
    // top-down aircraft
    c.fillStyle='#1f3029';c.beginPath();c.moveTo(0,-48);c.quadraticCurveTo(5,-41,6,-23);c.lineTo(50,-8);c.lineTo(52,-4);c.lineTo(8,-7);c.lineTo(9,18);c.lineTo(23,26);c.lineTo(21,29);c.lineTo(3,25);c.lineTo(0,30);c.lineTo(-3,25);c.lineTo(-21,29);c.lineTo(-23,26);c.lineTo(-9,18);c.lineTo(-8,-7);c.lineTo(-52,-4);c.lineTo(-50,-8);c.lineTo(-6,-23);c.quadraticCurveTo(-5,-41,0,-48);c.fill();
    c.fillStyle=colors[0];c.beginPath();c.moveTo(0,-50);c.quadraticCurveTo(6,-42,6,-24);c.lineTo(48,-8);c.lineTo(50,-4);c.lineTo(8,-7);c.lineTo(9,18);c.lineTo(22,25);c.lineTo(20,27);c.lineTo(3,23);c.lineTo(0,28);c.lineTo(-3,23);c.lineTo(-20,27);c.lineTo(-22,25);c.lineTo(-9,18);c.lineTo(-8,-7);c.lineTo(-50,-4);c.lineTo(-48,-8);c.lineTo(-6,-24);c.quadraticCurveTo(-6,-42,0,-50);c.fill();
    c.fillStyle=colors[1];c.fillRect(-43,-7,14,2);c.fillRect(29,-7,14,2);c.fillStyle=colors[2];c.beginPath();c.arc(-34,-5,3.8,0,7);c.arc(34,-5,3.8,0,7);c.fill();c.fillStyle='#c65e3f';c.beginPath();c.arc(-34,-5,1.7,0,7);c.arc(34,-5,1.7,0,7);c.fill();c.fillStyle='#263d40';c.beginPath();c.ellipse(0,-25,3,9,0,0,7);c.fill();c.restore();
    c.fillStyle='#fff9';c.font='8px "DM Mono"';c.fillText(p.short+' · '+p.role,w*.51-26,h*.84);
  }
  function setupPicker(){const picker=$('#aircraftPicker');picker.innerHTML='';planes.forEach((p,i)=>{const b=document.createElement('button');b.className='aircraft-card'+(i===planeIndex?' selected':'');b.innerHTML=`<span class="mini-plane">✦</span><span><b>${p.name}</b><small>${p.role} · ${Math.round(p.speed*20)} MPH</small></span>`;b.onclick=()=>selectPlane(i);picker.appendChild(b)});$('#planeIndex').textContent=`0${planeIndex+1} / 03`;$('.display-id').textContent=planes[planeIndex].short+' · '+planes[planeIndex].model;$('#paintText').textContent=paints[paintIndex].name;$('#ordnanceText').textContent=ordnance[ordnanceIndex].name;$('.swatch').innerHTML=paints[paintIndex].colors.map(c=>`<i style="background:${c}"></i>`).join('');drawHangar()}
  function selectPlane(i){planeIndex=(i+planes.length)%planes.length;paintIndex=planeIndex;setupPicker()}
  $('#prevPlane').onclick=()=>selectPlane(planeIndex-1);$('#nextPlane').onclick=()=>selectPlane(planeIndex+1);
  $('#cyclePaint').onclick=()=>{paintIndex=(paintIndex+1)%paints.length;setupPicker();toast('PAINT SCHEME · '+paints[paintIndex].name.toUpperCase())};
  $('#cycleOrdnance').onclick=()=>{ordnanceIndex=(ordnanceIndex+1)%ordnance.length;$('#ordnanceText').textContent=ordnance[ordnanceIndex].name;toast('LOADOUT UPDATED · '+ordnance[ordnanceIndex].name.toUpperCase())};
  $('#resetLoadout').onclick=()=>{ordnanceIndex=0;paintIndex=planeIndex;setupPicker();toast('STANDARD LOADOUT RESTORED')};

  function resetGame(){state.time=360;state.kills=0;state.score=0;state.shots=0;state.hits=0;state.health=planes[planeIndex].hp;state.bombs=ordnance[ordnanceIndex].ammo;state.enemies=[];state.bullets=[];state.enemyShots=[];state.particles=[];state.spawn=1.2;state.ended=false;state.paused=false;state.running=true;state.player={x:width/2,y:height*.68,vx:0,vy:0,angle:-Math.PI/2,fireWait:0,bombFlash:0};state.clouds=Array.from({length:15},()=>({x:rand(0,width),y:rand(0,height),s:rand(.45,1.5),a:rand(.035,.12)}));state.islands=Array.from({length:4},(_,i)=>({x:rand(0,width),y:rand(0,height),s:rand(.6,1.6),seed:i}));updateHud();$('#pauseOverlay').classList.remove('show');$('#resultOverlay').classList.remove('show');
  }
  function launch(){hangar.classList.remove('active');gameScreen.classList.add('active');resize();resetGame();state.last=performance.now();requestAnimationFrame(loop)}
  $('#launchBtn').onclick=launch;document.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();state.keys[e.key.toLowerCase()]=true;if(e.key==='Enter'&&!gameScreen.classList.contains('active'))launch();if(e.key==='Escape'&&gameScreen.classList.contains('active'))togglePause();if(e.key.toLowerCase()==='b'&&state.running&&!state.paused)dropBomb()});document.addEventListener('keyup',e=>state.keys[e.key.toLowerCase()]=false);
  window.addEventListener('resize',resize);
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();state.pointer={x:e.clientX-r.left,y:e.clientY-r.top}});canvas.addEventListener('pointerdown',e=>{if(e.button===0){state.firing=true;canvas.setPointerCapture?.(e.pointerId)}});canvas.addEventListener('pointerup',()=>state.firing=false);canvas.addEventListener('pointerleave',()=>state.firing=false);
  $('#pauseBtn').onclick=togglePause;$('#resumeBtn').onclick=togglePause;function togglePause(){if(!state.running||state.ended)return;state.paused=!state.paused;$('#pauseOverlay').classList.toggle('show',state.paused);if(!state.paused){state.last=performance.now();requestAnimationFrame(loop)}}
  $('#quitBtn').onclick=()=>{state.running=false;state.paused=false;gameScreen.classList.remove('active');hangar.classList.add('active');$('#pauseOverlay').classList.remove('show')};$('#returnBtn').onclick=$('#quitBtn').onclick;$('#retryBtn').onclick=()=>{resetGame();state.last=performance.now();requestAnimationFrame(loop)};
  $('#soundBtn').onclick=()=>{state.muted=!state.muted;$('#soundBtn').textContent=state.muted?'♫̸':'♫';toast(state.muted?'AUDIO MUTED':'AUDIO ON')};
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1800)}
  function sound(freq=420,duration=.06,type='square'){if(state.muted)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration)}catch{}}
  function updateHud(){const secs=Math.ceil(state.time);$('#timerText').textContent=`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;$('#killCount').textContent=String(state.kills).padStart(2,'0');$('#healthPct').textContent=Math.max(0,Math.ceil(state.health/planes[planeIndex].hp*100))+'%';$('#healthBar').style.width=clamp(state.health/planes[planeIndex].hp*100,0,100)+'%';$('#objectiveCount').innerHTML=`ENEMY AIRCRAFT &nbsp; <strong>${Math.min(state.kills,8)} / 8</strong>`;$('#objectiveProgress').style.width=Math.min(state.kills/8*100,100)+'%';$('#bombAmmo').textContent=`BOMBS · ${state.bombs} REMAIN`;$('#altitude').textContent=(4200+Math.round(Math.sin(performance.now()/2200)*80)).toLocaleString()}
  function spawnEnemy(){const edge=Math.random();let x=edge<.7?rand(25,width-25):(Math.random()<.5?-25:width+25),y=edge<.7?-35:rand(35,height*.44);state.enemies.push({x,y,vx:rand(-.45,.45),vy:rand(.6,1.15),angle:Math.PI/2,hp:3+(planeIndex===2?1:0),max:3+(planeIndex===2?1:0),speed:rand(28,47),fire:rand(1.2,3.4),phase:rand(0,6),type:Math.random()<.45?2:1,scale:rand(.8,1.03),dead:false})}
  function playerFire(){const p=state.player;if(p.fireWait>0)return;p.fireWait=.16;state.shots++;let dx=Math.cos(p.angle),dy=Math.sin(p.angle);for(const side of [-1,1])state.bullets.push({x:p.x+dx*18-dy*7*side,y:p.y+dy*18+dx*7*side,vx:dx*560+p.vx*.12,vy:dy*560+p.vy*.12,life:1.05,side});sound(175+Math.random()*65,.045)}
  function dropBomb(){if(!state.running||state.bombs<=0)return;state.bombs--;const p=state.player;state.bullets.push({x:p.x,y:p.y,vx:0,vy:130,life:1.5,bomb:true,damage:ordnance[ordnanceIndex].damage});sound(85,.24,'sawtooth');updateHud()}
  $('#touchFire').addEventListener('pointerdown',e=>{e.preventDefault();state.firing=true});$('#touchFire').addEventListener('pointerup',()=>state.firing=false);$('#touchBomb').onclick=dropBomb;
  const stick=$('#touchStick');let stickPointer=null;stick.addEventListener('pointerdown',e=>{stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e)});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)moveStick(e)});stick.addEventListener('pointerup',e=>{if(e.pointerId===stickPointer){stickPointer=null;state.keys.w=state.keys.a=state.keys.s=state.keys.d=false;stick.querySelector('span').style.transform=''}});function moveStick(e){const r=stick.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width/2),dy=(e.clientY-r.top-r.height/2)/(r.height/2);state.keys.a=dx<-.2;state.keys.d=dx>.2;state.keys.w=dy<-.2;state.keys.s=dy>.2;stick.querySelector('span').style.transform=`translate(${clamp(dx,-1,1)*18}px,${clamp(dy,-1,1)*18}px)`}

  function loop(now){if(!state.running||state.paused)return;const elapsed=Math.min(Math.max(0,(now-state.last)/1000),.5);state.last=now;const dt=Math.min(elapsed,.08);update(dt,elapsed);render(dt);requestAnimationFrame(loop)}
  function update(dt,elapsed=dt){
    const p=state.player;if(!p)return;
    state.time=Math.max(0,state.time-elapsed);p.fireWait-=dt;p.bombFlash=Math.max(0,p.bombFlash-dt);state.damageFlash=Math.max(0,state.damageFlash-dt);
    const up=state.keys.w||state.keys.arrowup,down=state.keys.s||state.keys.arrowdown,left=state.keys.a||state.keys.arrowleft,right=state.keys.d||state.keys.arrowright;
    const mx=(right?1:0)-(left?1:0),my=(down?1:0)-(up?1:0),length=Math.hypot(mx,my)||1, sp=planes[planeIndex].speed*74;
    p.vx+=(mx/length*sp-p.vx)*Math.min(1,dt*4.2);p.vy+=(my/length*sp-p.vy)*Math.min(1,dt*4.2);p.x=clamp(p.x+p.vx*dt,32,width-32);p.y=clamp(p.y+p.vy*dt,50,height-35);
    const aim=Math.atan2(state.pointer.y-p.y,state.pointer.x-p.x);let diff=((aim-p.angle+Math.PI*3)%(Math.PI*2))-Math.PI;p.angle+=diff*Math.min(1,dt*planes[planeIndex].turn*5);
    if(state.keys[' ']||state.firing)playerFire();
    state.spawn-=dt;if(state.spawn<=0&&state.enemies.length<6&&state.kills<8){spawnEnemy();state.spawn=rand(1.7,2.9)}
    for(const e of state.enemies){e.phase+=dt*1.6;e.fire-=dt;e.x+= (e.vx+Math.sin(e.phase)*.38)*e.speed*dt;e.y+=e.vy*e.speed*dt;
      const a=Math.atan2(p.y-e.y,p.x-e.x);e.angle+=((((a-e.angle+Math.PI*3)%(Math.PI*2))-Math.PI)*Math.min(1,dt*1.5));
      if(e.fire<0&&e.y<height-100){e.fire=rand(2,3.8);const dx=(p.x-e.x),dy=(p.y-e.y),len=Math.hypot(dx,dy)||1;state.enemyShots.push({x:e.x,y:e.y,vx:dx/len*190,vy:dy/len*190,life:3});}
      if(Math.hypot(e.x-p.x,e.y-p.y)<30){damagePlayer(14*dt);e.x+=(e.x-p.x)*dt*2}
    }
    for(const b of state.bullets){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.bomb&&b.life<.05&&!b.boom){b.boom=true;explode(b.x,b.y,95,b.damage||4)}}
    for(const b of state.bullets){if(b.dead||b.bomb)continue;for(const e of state.enemies){if(e.dead)continue;if(Math.hypot(e.x-b.x,e.y-b.y)<19*e.scale){b.dead=true;e.hp--;state.hits++;state.score+=20;particles(b.x,b.y,'#ffcc7b',4);sound(270,.035,'triangle');if(e.hp<=0){e.dead=true;state.kills++;state.score+=180;particles(e.x,e.y,'#ef8a54',22);state.islands.push({x:e.x,y:e.y,s:.8,seed:Math.random()*100});if(state.kills>=8){endGame(true);return}}break}}
    }
    for(const b of state.enemyShots){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(Math.hypot(b.x-p.x,b.y-p.y)<17){b.life=0;damagePlayer(9);particles(b.x,b.y,'#f18258',5)}}
    state.bullets=state.bullets.filter(b=>b.life>0&&!b.dead&&b.x>-80&&b.x<width+80&&b.y>-100&&b.y<height+100);state.enemyShots=state.enemyShots.filter(b=>b.life>0);state.enemies=state.enemies.filter(e=>!e.dead&&e.y<height+80&&e.x>-100&&e.x<width+100);
    for(const q of state.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.98;q.vy*=.98;q.life-=dt}state.particles=state.particles.filter(q=>q.life>0);
    for(const cl of state.clouds){cl.y+=dt*(14+cl.s*13);if(cl.y>height+60){cl.y=-55;cl.x=rand(0,width)}}
    for(const island of state.islands){island.y+=dt*12;if(island.y>height+120){island.y=-120;island.x=rand(0,width)}}
    if(state.time<=0)endGame(true);if(state.health<=0)endGame(false);updateHud();updateRadar();
  }
  function damagePlayer(amount){state.health-=amount;state.damageFlash=.17;if(amount>1)sound(90,.09,'sawtooth');}
  function particles(x,y,color,n){for(let i=0;i<n;i++){const a=rand(0,Math.PI*2),speed=rand(30,170);state.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:rand(.16,.62),max:.62,color,size:rand(1,4)})}}
  function explode(x,y,r,damage){particles(x,y,'#ffbc69',34);for(const e of state.enemies){const d=Math.hypot(x-e.x,y-e.y);if(d<r){e.hp-=damage*(1-d/r*.5);if(e.hp<=0){e.dead=true;state.kills++;state.score+=180;particles(e.x,e.y,'#ef8a54',22)}}}state.particles.push({x,y,vx:0,vy:0,life:.36,max:.36,color:'#ffe3a3',size:r,ring:true});sound(75,.2,'sawtooth');if(state.kills>=8)endGame(true)}
  function updateRadar(){const radar=$('#radar');radar.querySelectorAll('.radar-enemy').forEach(n=>n.remove());for(const e of state.enemies){const dot=document.createElement('i');dot.className='radar-enemy';dot.style.left=`${clamp(50+(e.x-state.player.x)/width*90,8,92)}%`;dot.style.top=`${clamp(50+(e.y-state.player.y)/height*90,8,92)}%`;radar.appendChild(dot)}}
  function endGame(won){if(state.ended)return;state.ended=true;state.running=false;$('#resultEyebrow').textContent=won?'MISSION REPORT · VF-6':'AIRCRAFT LOST · VF-6';$('#resultTitle').textContent=won?'SKY CLEARED.':'RETURN TO BASE.';$('#resultCopy').textContent=won?'Hostile patrol neutralized. The Pacific is a little safer tonight.':'You fought bravely, Lieutenant. There will be another sortie.';$('#resultKills').textContent=state.kills;$('#resultAccuracy').textContent=(state.shots?Math.round(state.hits/state.shots*100):0)+'%';$('#resultScore').textContent=String(state.score).padStart(4,'0');$('#resultOverlay').classList.add('show');sound(won?520:130,.3,'triangle')}
  function render(){
    if(!width||!height)return;
    const c=ctx,w=width,h=height,p=state.player;
    const sky=c.createLinearGradient(0,0,0,h*.49);sky.addColorStop(0,'#83a3a2');sky.addColorStop(1,'#c1d0c4');c.fillStyle=sky;c.fillRect(0,0,w,h*.49);
    const sea=c.createLinearGradient(0,h*.49,0,h);sea.addColorStop(0,'#718e87');sea.addColorStop(1,'#426d6d');c.fillStyle=sea;c.fillRect(0,h*.49,w,h*.51);
    const haze=c.createRadialGradient(w*.78,h*.18,4,w*.78,h*.18,Math.min(w,h)*.42);haze.addColorStop(0,'#fff3d533');haze.addColorStop(1,'#fff3d500');c.fillStyle=haze;c.fillRect(0,0,w,h);
    c.fillStyle='#e7d9bb';c.fillRect(0,h*.49-2,w,4);
    c.fillStyle='#d2d7c3';c.globalAlpha=.16;
    for(let i=0;i<34;i++){const x=(i*173)%w,y=h*.49+((i*71+performance.now()*.018)%(h*.51));c.fillRect(x,y,18,1)}
    c.globalAlpha=1;
    for(const island of state.islands){c.fillStyle='#315d56';c.beginPath();c.ellipse(island.x,island.y,36*island.s,13*island.s,0,0,Math.PI*2);c.fill();c.fillStyle='#597563';c.beginPath();c.ellipse(island.x-4,island.y-2,23*island.s,8*island.s,0,0,Math.PI*2);c.fill()}
    for(const cl of state.clouds){c.fillStyle='#fff9e9';c.globalAlpha=cl.a*2;c.beginPath();c.ellipse(cl.x,cl.y,45*cl.s,9*cl.s,0,0,Math.PI*2);c.ellipse(cl.x+18*cl.s,cl.y+1,25*cl.s,7*cl.s,0,0,Math.PI*2);c.fill()}c.globalAlpha=1;
    for(const b of state.bullets){c.strokeStyle=b.bomb?'#ffc977':'#fff1bf';c.lineWidth=b.bomb?3:2;c.beginPath();c.moveTo(b.x-b.vx*.025,b.y-b.vy*.025);c.lineTo(b.x,b.y);c.stroke()}
    for(const b of state.enemyShots){c.fillStyle='#ef7958';c.beginPath();c.arc(b.x,b.y,3,0,Math.PI*2);c.fill()}
    for(const e of state.enemies){drawPlane(c,e.x,e.y,e.scale,e.angle,e.type===2?'#77745b':'#9b634f','#e3c898',e.type);if(e.hp<e.max){c.fillStyle='#142a2a';c.fillRect(e.x-13,e.y-25,26,2);c.fillStyle='#ec8859';c.fillRect(e.x-13,e.y-25,26*e.hp/e.max,2)}}
    for(const q of state.particles){c.globalAlpha=clamp(q.life/q.max,0,1);c.fillStyle=q.color;c.beginPath();c.arc(q.x,q.y,q.size*c.globalAlpha,0,Math.PI*2);c.fill()}c.globalAlpha=1;
    drawPlane(c,p.x+7,p.y+8,1.12,p.angle,'#293631','#293631',planeIndex);
    if(state.damageFlash>0){c.fillStyle='#f06e4c';c.globalAlpha=.35;c.beginPath();c.arc(p.x,p.y,25+state.damageFlash*60,0,Math.PI*2);c.fill();c.globalAlpha=1}
    drawPlane(c,p.x,p.y,1.13,p.angle,paints[paintIndex].colors[0],paints[paintIndex].colors[1],planeIndex);
  }

  setupPicker();resize();
})();
