(() => {
  "use strict";

  const QUESTIONS = [
    {q:"What does the Greek word “arithmos” mean?",a:["Art","Number","Science","Brain"],c:1},
    {q:"Where was arithmetic first used about 4,000 years ago?",a:["Ancient Greece","Ancient Rome","Ancient Egypt","India"],c:2},
    {q:"Who helped popularize Arabic numerals in Europe?",a:["Isaac Newton","Leonardo da Vinci","Fibonacci","Albert Einstein"],c:2},
    {q:"What is mental arithmetic?",a:["Calculating without a calculator","Learning foreign languages","Drawing mathematical pictures","Using a computer"],c:0},
    {q:"At what age do children in Kazakhstan usually start learning mental arithmetic?",a:["3–5","5–12","13–15","16–18"],c:1},
    {q:"How long does the mental arithmetic course take?",a:["Six months","One year","Eighteen months","Two years"],c:2},
    {q:"What is one of the earliest calculating tools?",a:["A smartphone","An abacus","A calculator","A computer"],c:1},
    {q:"What happens after children learn to use an abacus?",a:["They stop studying mathematics","They use calculators all the time","They learn to visualize it in their minds","They start learning physics"],c:2},
    {q:"What skills can mental arithmetic develop?",a:["Concentration and imagination","Dancing and singing","Cooking and painting","Running and jumping"],c:0},
    {q:"Why did some people worry about calculators and smartphones?",a:["They were too expensive","Children might lose basic calculation skills","They were difficult to use","They made mathematics more complicated"],c:1},
    {q:"How do many parents in Kazakhstan feel about mental arithmetic?",a:["They are disappointed","They are worried","They are delighted with the results","They are not interested"],c:2},
    {q:"What changes have some parents noticed in their children?",a:["They have become less confident","They are more motivated and involved in class","They do not like mathematics anymore","They spend less time studying"],c:1},
    {q:"Who questioned the effectiveness of mental arithmetic?",a:["Naliya Kasenova","Fibonacci","Andrey Malakhov","A university professor"],c:0},
    {q:"What is one criticism of mental arithmetic competitions?",a:["Children do not enjoy mathematics","Students focus too much on speed instead of thinking","The questions are always too easy","There are not enough competitions"],c:1},
    {q:"What do experts believe is important in modern education?",a:["Learning only mathematical calculations","Memorizing all the answers","A balanced approach to education","Using calculators in every lesson"],c:2}
  ];

  const $ = id => document.getElementById(id);
  const menuScreen = $("menuScreen"), gameScreen = $("gameScreen"), resultScreen = $("resultScreen"), leaderboardScreen = $("leaderboardScreen");
  const canvas = $("gameCanvas"), ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  let state = "menu", player = "Player", score = 0, coins = 0, lives = 3, correct = 0, asked = 0, streak = 0;
  let lane = 1, laneVisual = 1, jump = 0, slide = 0, speed = 260, distance = 0, spawnTimer = 0, quizTimer = 13;
  let objects = [], particles = [], questionOrder = [], questionIndex = 0, currentQuestion = null;
  let lastTime = 0, animationId = 0, muted = false, soundCtx = null, quizLock = false;
  let feedbackTimer = 0;

  function show(screen) {
    [menuScreen, gameScreen, resultScreen, leaderboardScreen].forEach(s => s.classList.add("hidden"));
    screen.classList.remove("hidden");
  }
  function sound(freq=660, duration=.09, type="sine") {
    if (muted) return;
    try {
      soundCtx = soundCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = soundCtx.createOscillator(), gain = soundCtx.createGain();
      osc.type = type; osc.frequency.value = freq; gain.gain.value = .06;
      osc.connect(gain); gain.connect(soundCtx.destination); osc.start();
      gain.gain.exponentialRampToValueAtTime(.001, soundCtx.currentTime + duration);
      osc.stop(soundCtx.currentTime + duration);
    } catch (_) {}
  }
  function updateHud() {
    $("scoreValue").textContent = score.toLocaleString();
    $("coinValue").textContent = coins;
    $("livesValue").textContent = "❤️".repeat(Math.max(0,lives)) + "🖤".repeat(3-Math.max(0,lives));
  }
  function shuffleQuestions() {
    questionOrder = QUESTIONS.map((_,i)=>i);
    for(let i=questionOrder.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[questionOrder[i],questionOrder[j]]=[questionOrder[j],questionOrder[i]];}
    questionIndex = 0;
  }
  function startGame() {
    player = $("playerName").value.trim() || "Player";
    score=0; coins=0; lives=3; correct=0; asked=0; streak=0; lane=1; laneVisual=1;
    jump=0;slide=0;speed=260;distance=0;spawnTimer=.8;quizTimer=12;objects=[];particles=[];
    shuffleQuestions(); updateHud(); $("pauseBtn").textContent="Ⅱ";
    state="running"; show(gameScreen); lastTime=performance.now(); cancelAnimationFrame(animationId); animationId=requestAnimationFrame(loop);
  }
  function pauseGame() {
    if(state==="running"){state="paused";$("pauseOverlay").classList.remove("hidden");$("pauseBtn").textContent="▶";}
    else if(state==="paused") resumeGame();
  }
  function resumeGame() {
    if(state!=="paused")return;
    $("pauseOverlay").classList.add("hidden");$("pauseBtn").textContent="Ⅱ";state="running";lastTime=performance.now();animationId=requestAnimationFrame(loop);
  }
  function endGame() {
    state="ended"; cancelAnimationFrame(animationId); $("quizPanel").classList.add("hidden");
    const accuracy=asked?Math.round(correct/asked*100):0;
    const medal=score>=1800?"🥇":score>=900?"🥈":"🥉";
    $("medalIcon").textContent=medal;$("resultTitle").textContent=score>=1800?"AMAZING RUN!":score>=900?"GREAT JOB!":"KEEP PRACTISING!";
    $("resultPlayer").textContent=player+" — your English Subway results";
    $("finalScore").textContent=score.toLocaleString();$("finalCoins").textContent=coins;
    $("finalCorrect").textContent=correct+" / "+asked;$("finalAccuracy").textContent=accuracy+"%";
    $("resultMessage").textContent=accuracy>=80?"Excellent reading comprehension! Keep it up!":accuracy>=50?"Good effort! Review the article and try again.":"Every run is a new chance to learn. Try again!";
    saveResult({name:player,score,coins,correct,asked,accuracy,date:Date.now()}); show(resultScreen);
  }
  function saveResult(result) {
    let list=[];try{list=JSON.parse(localStorage.getItem("escLeaderboard")||"[]");}catch(_){}
    list.push(result);list.sort((a,b)=>b.score-a.score);localStorage.setItem("escLeaderboard",JSON.stringify(list.slice(0,10)));
  }
  function showLeaderboard() {
    let list=[];try{list=JSON.parse(localStorage.getItem("escLeaderboard")||"[]");}catch(_){}
    $("leaderboardList").innerHTML="";
    $("emptyBoard").classList.toggle("hidden",list.length>0);
    list.forEach((r,i)=>{const li=document.createElement("li");li.textContent=(i+1)+". "+r.name+" — ";const span=document.createElement("span");span.textContent=r.score.toLocaleString()+" pts";li.appendChild(span);$("leaderboardList").appendChild(li);});
    show(leaderboardScreen);
  }
  function showQuestion() {
    if(questionIndex>=questionOrder.length){shuffleQuestions();}
    currentQuestion=QUESTIONS[questionOrder[questionIndex++]];
    asked++; quizLock=true; state="quiz";
    $("questionNumber").textContent="QUESTION "+asked;
    $("questionText").textContent=currentQuestion.q;
    $("quizFeedback").textContent="";
    const box=$("answers");box.innerHTML="";
    currentQuestion.a.forEach((answer,i)=>{
      const btn=document.createElement("button");btn.className="answer-btn";btn.textContent=String.fromCharCode(65+i)+". "+answer;
      btn.addEventListener("click",()=>answerQuestion(i,btn));box.appendChild(btn);
    });
    $("quizPanel").classList.remove("hidden");sound(520,.12);
  }
  function answerQuestion(index, clicked) {
    if(!quizLock)return;quizLock=false;
    const buttons=[...$("answers").querySelectorAll("button")];
    buttons.forEach((b,i)=>{b.disabled=true;if(i===currentQuestion.c)b.classList.add("correct");});
    if(index===currentQuestion.c){
      correct++;streak++;score+=100;
      $("quizFeedback").textContent="✓ CORRECT! +100 POINTS";
      if(streak===3){score+=50;$("quizFeedback").textContent+="  STREAK BONUS +50!";}
      if(streak===5){score+=100;$("quizFeedback").textContent+="  SUPER STREAK +100!";}
      sound(880,.16);
      for(let i=0;i<18;i++)particles.push({x:W/2,y:H/2,vx:(Math.random()-.5)*220,vy:(Math.random()-.5)*180,life:.8});
    }else{
      streak=0;lives--;clicked.classList.add("wrong");
      $("quizFeedback").textContent="✗ NOT QUITE! Correct answer: "+currentQuestion.a[currentQuestion.c];
      sound(180,.2,"triangle");
    }
    updateHud();
    feedbackTimer=1.65;
    // The runner is paused while the answer feedback is displayed.
    window.setTimeout(() => {
      if (state !== "quiz") return;
      $("quizPanel").classList.add("hidden");
      quizLock = false;
      if (lives <= 0) {
        endGame();
      } else {
        state = "running";
        quizTimer = 15;
        lastTime = performance.now();
        animationId = requestAnimationFrame(loop);
      }
    }, 1650);
  }
  function spawnObject() {
    const l=Math.floor(Math.random()*3), r=Math.random();
    if(r<.48) objects.push({type:"coin",lane:l,z:1.08,hit:false});
    else objects.push({type:r<.74?"barrier":"train",lane:l,z:1.08,hit:false});
  }
  function move(direction) {
    if(state!=="running")return;
    if(direction==="left")lane=Math.max(0,lane-1);
    if(direction==="right")lane=Math.min(2,lane+1);
    if(direction==="up"&&jump<=0)jump=.72;
    if(direction==="down")slide=.55;
  }
  function roadGeometry(z) {
    const t=Math.max(0,Math.min(1,z)), y=H*.28+t*H*.72;
    const half=70+t*330, center=W/2;
    return {y,left:center-half,right:center+half,half};
  }
  function drawScene(dt) {
    const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#62c5e6");sky.addColorStop(.55,"#d0edf0");sky.addColorStop(.56,"#6176a8");sky.addColorStop(1,"#182747");
    ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    // skyline
    ctx.fillStyle="#52648e";
    for(let i=0;i<13;i++){const x=i*78+((distance*.12)%78);const h=70+(i*37%95);ctx.fillRect(x,H*.28-h,55,h);}
    // tracks perspective
    const top=roadGeometry(0),bottom=roadGeometry(1);
    ctx.fillStyle="#414b63";ctx.beginPath();ctx.moveTo(top.left,top.y);ctx.lineTo(top.right,top.y);ctx.lineTo(bottom.right,H);ctx.lineTo(bottom.left,H);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#c5cbd7";ctx.lineWidth=8;
    [-.33,.33].forEach(f=>{ctx.beginPath();ctx.moveTo(W/2+top.half*f,top.y);ctx.lineTo(W/2+bottom.half*f,H);ctx.stroke();});
    // sleepers
    ctx.strokeStyle="#202d48";ctx.lineWidth=5;
    for(let i=0;i<13;i++){let z=((i/13+(distance*.0015))%1);let g=roadGeometry(z);ctx.beginPath();ctx.moveTo(g.left+12*z,g.y);ctx.lineTo(g.right-12*z,g.y);ctx.stroke();}
    // side lights
    for(let side of [0,1]){for(let i=0;i<5;i++){let z=(i/5+(distance*.0008))%1,g=roadGeometry(z),x=side?g.right+22:g.left-22;ctx.fillStyle="#ffdf72";ctx.beginPath();ctx.arc(x,g.y,3+z*4,0,Math.PI*2);ctx.fill();}}
    // objects, back to front
    objects.sort((a,b)=>a.z-b.z);
    objects.forEach(o=>{
      const g=roadGeometry(o.z),x=W/2+(o.lane-1)*g.half*.56,s=.25+o.z*.95;
      if(o.type==="coin"){
        ctx.fillStyle="#ffd83e";ctx.strokeStyle="#fff2a3";ctx.lineWidth=3;
        ctx.beginPath();ctx.ellipse(x,g.y-18*s,10*s,15*s,0,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.fillStyle="#b97813";ctx.font=`bold ${13*s}px Arial`;ctx.textAlign="center";ctx.fillText("$",x,g.y-13*s);
      }else if(o.type==="barrier"){
        ctx.fillStyle="#e64d5d";ctx.fillRect(x-25*s,g.y-40*s,50*s,40*s);
        ctx.fillStyle="#ffe3a1";ctx.fillRect(x-25*s,g.y-28*s,50*s,8*s);
        ctx.fillStyle="#9c263d";ctx.fillRect(x-30*s,g.y-4*s,60*s,7*s);
      }else{
        ctx.fillStyle="#2877b9";ctx.fillRect(x-34*s,g.y-70*s,68*s,70*s);
        ctx.fillStyle="#a9eaff";ctx.fillRect(x-24*s,g.y-58*s,48*s,23*s);
        ctx.fillStyle="#f7c64b";ctx.fillRect(x-30*s,g.y-10*s,60*s,10*s);
      }
    });
    // player
    laneVisual+=(lane-laneVisual)*Math.min(1,dt*12);
    const pg=roadGeometry(.93),px=W/2+(laneVisual-1)*pg.half*.56,baseY=H*.91;
    let jumpY=jump>0?Math.sin((.72-jump)/.72*Math.PI)*105:0;
    const py=baseY-jumpY;
    ctx.save();ctx.translate(px,py);
    ctx.fillStyle="#0005";ctx.beginPath();ctx.ellipse(0,7,29,9,0,0,Math.PI*2);ctx.fill();
    if(slide>0){
      ctx.fillStyle="#ffb02e";ctx.fillRect(-24,-25,48,20);
      ctx.fillStyle="#f1c29a";ctx.beginPath();ctx.arc(18,-24,13,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#253e85";ctx.fillRect(-22,-9,42,8);
    }else{
      // legs
      ctx.strokeStyle="#202a50";ctx.lineWidth=12;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(-9,-26);ctx.lineTo(-15,-3);ctx.moveTo(9,-26);ctx.lineTo(16,-3);ctx.stroke();
      // body and arms
      ctx.fillStyle="#ff9d28";ctx.fillRect(-19,-65,38,42);
      ctx.strokeStyle="#f1c29a";ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-17,-58);ctx.lineTo(-30,-39);ctx.moveTo(17,-58);ctx.lineTo(29,-40);ctx.stroke();
      // head
      ctx.fillStyle="#f1c29a";ctx.beginPath();ctx.arc(0,-79,18,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#26355e";ctx.beginPath();ctx.arc(0,-86,18,Math.PI,Math.PI*2);ctx.fill();
      ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(6,-79,2.5,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    // particles
    particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle="#ffe36c";ctx.fillRect(p.x,p.y,5,5);});ctx.globalAlpha=1;
  }
  function loop(now) {
    if(state!=="running")return;
    const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;
    updateGame(dt);drawScene(dt);
    if(state==="running")animationId=requestAnimationFrame(loop);
  }
  function updateGame(dt) {
    distance+=speed*dt;speed=Math.min(480,speed+dt*2.3);
    if(jump>0)jump=Math.max(0,jump-dt);if(slide>0)slide=Math.max(0,slide-dt);
    spawnTimer-=dt;if(spawnTimer<=0){spawnObject();spawnTimer=Math.max(.55,1.15-(speed-260)/450)+Math.random()*.35;}
    quizTimer-=dt;
    if(quizTimer<=0&&!quizLock){showQuestion();return;}
    objects.forEach(o=>{
      o.z-=dt*(speed/390)*.48;
      if(o.z<.12&&!o.hit){
        o.hit=true;
        if(o.type==="coin"){coins++;score+=10;sound(760,.06);}
        else{
          const safe=(o.type==="barrier"&&jump>0)||(o.type==="train"&&slide>0);
          if(!safe){lives--;streak=0;sound(130,.2,"sawtooth");}
        }
      }
    });
    objects=objects.filter(o=>o.z>-.04);
    particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);
    updateHud();
    if(feedbackTimer>0){feedbackTimer-=dt;if(feedbackTimer<=0){$("quizPanel").classList.add("hidden");quizLock=false;state="running";quizTimer=15;if(lives<=0){endGame();return;}}}
    if(lives<=0&&state==="running")endGame();
  }
  // A question pauses the runner. Feedback remains visible briefly, then the run resumes.
  const originalAnswerQuestion=answerQuestion;
  // Input
  document.addEventListener("keydown",e=>{
    const map={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",a:"left",d:"right",w:"up",s:"down"};
    if(map[e.key]){e.preventDefault();move(map[e.key]);}
    if(e.key===" "){e.preventDefault();pauseGame();}
  });
  let touchX=0,touchY=0;
  canvas.addEventListener("touchstart",e=>{const t=e.changedTouches[0];touchX=t.clientX;touchY=t.clientY;},{passive:true});
  canvas.addEventListener("touchend",e=>{
    const t=e.changedTouches[0],dx=t.clientX-touchX,dy=t.clientY-touchY;
    if(Math.max(Math.abs(dx),Math.abs(dy))<22)return;
    if(Math.abs(dx)>Math.abs(dy))move(dx>0?"right":"left");else move(dy>0?"down":"up");
  },{passive:true});
  $("startBtn").addEventListener("click",startGame);
  $("pauseBtn").addEventListener("click",pauseGame);
  $("resumeBtn").addEventListener("click",resumeGame);
  $("playAgainBtn").addEventListener("click",startGame);
  $("menuBtn").addEventListener("click",()=>{state="menu";show(menuScreen);});
  $("leaderboardBtn").addEventListener("click",showLeaderboard);
  $("resultsBoardBtn").addEventListener("click",showLeaderboard);
  $("boardBackBtn").addEventListener("click",()=>show(state==="ended"?resultScreen:menuScreen));
  $("clearBoardBtn").addEventListener("click",()=>{if(confirm("Clear all saved leaderboard results on this device?")){localStorage.removeItem("escLeaderboard");showLeaderboard();}});
  $("soundBtn").addEventListener("click",()=>{muted=!muted;$("soundBtn").textContent=muted?"🔇":"🔊";});
  // Initial canvas scene
  drawScene(0);
})();