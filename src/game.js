const stations=[
  {name:'点单台',concept:'理解目标',intro:'哪张单可以直接开做？',kitchen:'问清人数、口味和上菜时间。',agent:'问清复习哪门课、哪天考试。',target:[-8.6,1.58]},
  {name:'备菜板',concept:'规划步骤',intro:'按做菜顺序点选五张卡。',kitchen:'先洗、再切，最后装盘。',agent:'先整理考点，再排复习计划，最后出题自测。',target:[-7.6,-4.90]},
  {name:'厨具架',concept:'调用工具',intro:'厨房和智能体都需要工具。各选一个。',kitchen:'查菜谱 → 用手机。',agent:'查课程资料 → 联网搜索。计算用代码，整理资料用文档工具。',target:[-3.82,-5.03]},
  {name:'熟客本',concept:'记忆偏好',intro:'小林说「我不要香菜」。',kitchen:'熟客再来时，自动去掉香菜。',agent:'记得你每天只有半小时，下次按半小时排复习。',target:[-5.63,3.83]},
  {name:'招牌菜谱',concept:'复用技能',intro:'把成功的做法交给三位小厨师。',kitchen:'同一份菜谱，三个厨师都能照着做。',agent:'把「整理考点 → 出题 → 核对答案」存起来，换门课也能用。',target:[-2.8,-.53]}
];
const interactionRange=1.52;
const steps=['洗番茄','切番茄','打蛋','下锅翻炒','装盘'];
const kitchenTools={
  knife:{name:'菜刀',target:[-7.6,-4.90],label:[-7.65,2.03,-6.27]},
  wok:{name:'炒锅',target:[-4.71,-.53],label:[-4.7,2.10,-2.51]},
  oven:{name:'烤箱',target:[-.37,-5.02],label:[-.37,1.93,-6.37]},
  plate:{name:'装盘台'}
};
const recipes=[
  {name:'番茄炒蛋',steps:[
    {name:'切番茄',tool:'knife'},{name:'炒蛋和番茄',tool:'wok',seconds:2.2},{name:'装盘',tool:'plate'}
  ]},
  {name:'芝士烤番茄',steps:[
    {name:'切番茄',tool:'knife'},{name:'铺芝士',tool:'knife'},{name:'进烤箱',tool:'oven',seconds:7},{name:'装盘',tool:'plate'}
  ]}
];
const storageKey='doubao-diner-v1';
const levels=[[105,'王牌店长'],[75,'金牌店长'],[45,'熟练店长'],[0,'新手店长']];
const level=player=>{
  const scoreLevel=levels.find(([minimum])=>(player.score??0)>=minimum)[1];
  return scoreLevel==='新手店长'&&player.qualifying>=2?'熟练店长':scoreLevel;
};
const normalized=name=>name.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('zh-CN');
function readData(){
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
    if(saved&&Array.isArray(saved.players)){
      const rounds=Array.isArray(saved.rounds)?saved.rounds.filter(r=>r&&typeof r.id==='string'&&
        typeof r.playerId==='string'&&Number.isInteger(r.score)&&r.score>=0):[];
      const players=saved.players.filter(p=>p&&typeof p.name==='string'&&p.name.trim()&&typeof p.id==='string')
        .map(({score,...p})=>{
          const legacyId='legacy:'+p.id;
          if(Number.isFinite(score)&&score>=0&&!rounds.some(r=>r.id===legacyId)){
            rounds.push({id:legacyId,playerId:p.id,score:Math.floor(score),endedAt:null});
          }
          return {...p,done:Number.isInteger(p.done)?p.done&31:0,
            learned:[1,2].includes(p.learned)?p.learned:0,
            qualifying:Number.isInteger(p.qualifying)?Math.max(0,p.qualifying):0};
        });
      return {last:saved.last,players,rounds};
    }
  }catch{}
  return {last:null,players:[],rounds:[]};
}
function mergeRounds(local,saved){
  return [...new Map([...local,...saved].map(entry=>[entry.id,entry])).values()];
}
function startGame(world){
  const byId=id=>document.getElementById(id);
  const playbar=byId('playbar'), modeLabel=byId('mode'), restaurantTitle=byId('restaurant-title');
  const playerButton=byId('player'), rankButton=byId('rank');
  const modal=byId('modal'), dialog=byId('dialog'), labels=byId('labels');
  let data=readData(), current=null, mode='training', panel='', task=null, round=null, trial=null;
  let waypoint=-1, done=Array(5).fill(false), last=performance.now();
  let feedback='', feedbackUntil=0, returnFocus=null;
  const keys=new Set();
  const htmlCache=new WeakMap();
  function setHTML(node,value){
    if(htmlCache.get(node)!==value){node.innerHTML=value;htmlCache.set(node,value);}
  }
  function node(tag,cls,text){
    const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;
  }
  function action(text,fn,cls='btn'){
    const b=node('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;
  }
  const stationTags=stations.map((s,i)=>{
    const button=action(s.name,()=>chooseStation(i),'station');
    button.prepend(node('i'));labels.append(button);return button;
  });
  const tableTags=world.tables.map((_,i)=>{
    const b=action('',()=>tableClick(i),'tablepin');
    b.append(node('span','table-text'),node('i','patience'));labels.append(b);return b;
  });
  const playerMarker=node('div','bubble you','你');playerMarker.hidden=true;labels.append(playerMarker);
  const customerBubble=node('div','bubble');customerBubble.hidden=true;labels.append(customerBubble);
  const hostTag=action('',hostOrder,'tablepin service-pin');labels.append(hostTag);
  const passTag=action('',takePlate,'tablepin service-pin');labels.append(passTag);
  const plateTag=action('装盘台',()=>useTool('plate'),'tablepin service-pin');labels.append(plateTag);
  const toolTags=Object.entries(kitchenTools).filter(([id])=>id!=='plate').map(([id,tool])=>{
    const el=action(tool.name,()=>useTool(id),'tablepin service-pin');
    labels.append(el);
    return {id,tool,el};
  });
  const kitchenTag=node('div','bubble kitchen-note');labels.append(kitchenTag);

  function savePlayer(changes={}){
    const fresh=readData();
    data.rounds=mergeRounds(data.rounds,fresh.rounds);
    for(const candidate of fresh.players){
      const own=data.players.find(p=>p.id===candidate.id);
      if(!own)data.players.push(candidate);
      else{
        own.done|=candidate.done;
        own.learned=Math.max(own.learned,candidate.learned);
        own.qualifying=Math.max(own.qualifying,candidate.qualifying);
      }
    }
    let entry=data.players.find(p=>p.id===current.id);
    if(!entry){entry={id:current.id,name:current.name,done:0,learned:0,qualifying:0};data.players.push(entry);}
    if(changes.restaurant)entry.restaurant=changes.restaurant;
    if(changes.name)entry.name=changes.name;
    entry.done|=changes.done||0;
    entry.learned=Math.max(entry.learned,changes.learned||0);
    const result=changes.result;
    if(result&&!data.rounds.some(record=>record.id===result.id)){
      data.rounds.push({id:result.id,playerId:entry.id,score:result.score,endedAt:Date.now()});
      entry.qualifying+=result.served;
    }
    current=entry;data.last=entry.id;
    try{localStorage.setItem(storageKey,JSON.stringify(data));}catch{}
  }
  function savedMask(){return done.reduce((mask,on,i)=>on?mask|(1<<i):mask,0);}
  function syncHeader(){
    const operating=['ready','round','result'].includes(mode);
    modeLabel.textContent=mode==='trial'?'试做菜谱':operating?'餐厅小游戏':'自由探索 · 开张准备';
    modeLabel.classList.toggle('open',operating);
    playerButton.disabled=mode==='round'||mode==='trial';
    const restaurant=current?.restaurant||'我的餐厅';
    restaurantTitle.textContent=restaurant;
    document.title=restaurant;
    playerMarker.textContent=current?.name||'你';
    const nickname=current?[...current.name]:[];
    playerButton.textContent=current?(nickname.length>7?nickname.slice(0,7).join('')+'…':current.name):'设置昵称';
    playerButton.title=current?'切换玩家':'设置昵称';
    playerButton.setAttribute('aria-label',current?'当前玩家 '+current.name+'，切换玩家':'设置昵称');
  }
  function setMode(next){
    mode=next;document.body.dataset.mode=mode;syncHeader();
  }
  function openPanel(kind,title,teach=false){
    if(!panel)returnFocus=document.activeElement;
    panel=kind;modal.hidden=false;modal.classList.remove('spectate');dialog.classList.toggle('teach',teach);
    dialog.replaceChildren();
    const close=action('×',()=>closePanel(),'close');close.setAttribute('aria-label','关闭');
    if(kind!=='save-recipe'&&(kind!=='player'||current))dialog.append(close);
    const heading=node('h2','',title);heading.id='dialog-title';dialog.append(heading);
    keys.clear();world.player.path.length=0;
    queueMicrotask(()=>{if(panel===kind&&!dialog.contains(document.activeElement))dialog.querySelector('button')?.focus({preventScroll:true});});
    return dialog;
  }
  function closePanel(restore=true){
    const previous=panel;panel='';modal.hidden=true;dialog.replaceChildren();
    if(previous==='task'){
      task=null;clearSamples();
      if(mode==='training'&&done.every(Boolean))enterReady();
    }
    if(restore&&returnFocus?.isConnected&&!returnFocus.closest('[hidden]'))returnFocus.focus({preventScroll:true});
    returnFocus=null;
  }
  function camera(x=0,z=0,zoom=1,yaw=.22){
    const narrow=innerWidth/innerHeight<.85;
    Object.assign(world.desired,{x:narrow?x*.86:x,z,zoom:narrow?Math.min(zoom,1.23):zoom,yaw});
  }
  function resetView(){
    world.reset();camera();waypoint=-1;task=null;trial=null;keys.clear();
    customerBubble.hidden=true;feedback='';feedbackUntil=0;
  }
  function playerPanel(){
    const existing=data.players.find(p=>p.id===(current?.id||data.last));
    const content=openPanel('player','给你的餐厅起个名字');
    const guide=node('p','','餐厅名会显示在游戏标题上。昵称用来显示角色名、保存进度和记录每局得分。');
    const form=node('form','identity-form');
    function field(label, name, placeholder, value){
      const wrapper=node('label','identity-field',label);
      const input=node('input');
      input.name=name;
      input.maxLength=16;
      input.required=true;
      input.placeholder=placeholder;
      input.value=value||'';
      input.addEventListener('input',()=>input.setCustomValidity(''));
      wrapper.append(input);
      form.append(wrapper);
      return input;
    }
    const restaurant=field('餐厅名','restaurant','比如：番茄小馆',existing?.restaurant);
    const nickname=field('玩家昵称','nickname','比如：小番茄',existing?.name);
    nickname.autocomplete='nickname';
    const submit=node('button','btn primary','进入餐厅');submit.type='submit';
    form.append(submit);content.append(guide,form);
    const previous=data.players.slice(0,10);
    if(previous.length){
      content.append(node('p','smallline','选择已有玩家可载入上次的名字'));
      const options=node('div','chips');
      previous.forEach(player=>options.append(action(player.name,()=>{
        nickname.value=player.name;nickname.setCustomValidity('');
        restaurant.value=player.restaurant||'';restaurant.setCustomValidity('');
        (restaurant.value?submit:restaurant).focus();
      },'choice')));
      content.append(options);
    }
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const values=[restaurant,nickname].map(input=>input.value.trim().replace(/\s+/gu,' '));
      for(const [i,input] of [restaurant,nickname].entries()){
        if(!values[i]||[...values[i]].length>16){
          input.setCustomValidity('请输入 1 至 16 个字');input.reportValidity();return;
        }
      }
      enterPlayer(values[1],values[0]);
    });
    queueMicrotask(()=>{if(panel==='player'){restaurant.focus({preventScroll:true});restaurant.select();}});
  }
  function enterPlayer(name,restaurant){
    const id=normalized(name), continuing=!current||current.id===id;
    current=data.players.find(p=>p.id===id)||{id,name,done:0};
    savePlayer({restaurant,name});
    done=stations.map((_,i)=>Boolean(current.done&(1<<i)));
    closePanel(false);
    if(!continuing){resetView();round=null;}
    setMode(done.every(Boolean)?'ready':'training');
    syncWorld();
  }

  function addRank(target){
    const fresh=readData();
    const players=new Map([...data.players,...fresh.players].map(p=>[p.id,p]));
    const ranked=mergeRounds(data.rounds,fresh.rounds)
      .filter(record=>players.has(record.playerId))
      .sort((a,b)=>b.score-a.score||(b.endedAt??0)-(a.endedAt??0));
    const timeFormat=new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    target.append(node('p','smallline','本机排行 · 每局单独记录 · 同分并列'));
    if(!ranked.length){target.append(node('p','','第一局结束后，店长就能上榜。'));return;}
    const table=node('table','board'), thead=node('thead'), headers=node('tr');
    for(const label of ['名次','昵称','得分','对局时间'])headers.append(node('th','',label));
    thead.append(headers);table.append(thead);
    const body=node('tbody');let rank=0;
    ranked.forEach((p,i)=>{
      if(i===0||ranked[i-1].score!==p.score)rank=i+1;
      const player=players.get(p.playerId);
      const row=node('tr',p.playerId===current?.id?'me':'');
      const endedAt=Number.isFinite(p.endedAt)?timeFormat.format(p.endedAt):'旧版记录';
      [rank,player.name,p.score,endedAt].forEach(value=>row.append(node('td','',value)));
      body.append(row);
    });
    table.append(body);target.append(table);
  }
  function rankPanel(){
    if(panel)return;
    addRank(openPanel('rank','餐厅排行榜'));
  }
  function conceptPanel(){
    const content=openPanel('concept',(current?.restaurant||'我的餐厅')+'开张成功！',true);
    const list=node('dl');
    [
      ['点单','你提的需求，比如「帮我准备期末复习」'],
      ['主厨','大模型'],
      ['备菜','规划'],
      ['厨具','联网搜索、写代码、办公软件、电脑操作'],
      ['熟客本','记忆'],
      ['招牌菜谱','技能（Skill）'],
      ['试味返工','自己检查，不合格就重做'],
      ['出餐','交付成果，比如一份复习手册']
    ].forEach(([term,value])=>list.append(node('dt','',term),node('dd','',value)));
    content.append(list,node('blockquote','','你提出目标，智能体可以按步骤使用工具，直到交付结果。'));
  }
  function position(element,coords,show){
    const p=world.screen(...coords);
    element.hidden=!show||!p.visible;
    element.style.left=p.x+'px';element.style.top=p.y+'px';
  }
  function clearSamples(){
    world.samples.forEach(p=>p.visible=false);
    world.apprentices.forEach(p=>p.g.visible=false);
  }
  function showSamples(){
    for(let i=0;i<3;i++){
      const x=-5.72+i*1.35, z=-.28;
      world.prop(world.apprentices[i].g,x,0,z);
      world.prop(world.samples[i],x,.12,z+.65);
    }
  }
  function enterReady(){
    waypoint=-1;setMode('ready');syncWorld();
  }
  function setFeedback(text,duration=3.2){feedback=text;feedbackUntil=performance.now()+duration*1000;}
  function stationDistance(index){
    const [x,z]=stations[index].target, p=world.player.g.position;
    return Math.hypot(p.x-x,p.z-z);
  }
  function nearbyStation(){
    let nearest=-1, distance=interactionRange;
    stations.forEach((_,i)=>{const d=stationDistance(i);if(d<distance){nearest=i;distance=d;}});
    return nearest;
  }
  function chooseStation(index){
    if(!['training','ready'].includes(mode)||panel||!current)return;
    const station=stations[index];
    if(stationDistance(index)>interactionRange){
      waypoint=index;world.move(...station.target);
      setFeedback('正在走向'+station.name+'。走到旁边后，再点一次或按 E。',6);
      return;
    }
    waypoint=-1;world.player.path.length=0;
    if(done[index])showExplanation(index);
    else beginTask(index);
  }
  function explain(target,index){
    const s=stations[index], compare=node('dl','station-compare');
    compare.append(node('dt','','在餐厅'),node('dd','',s.kitchen),
      node('dt','','用 AI 复习'),node('dd','',s.agent));
    target.append(compare);
  }
  function showExplanation(index){
    const s=stations[index], content=openPanel('station-note',s.name+' · '+s.concept);
    explain(content,index);
    content.append(action('回到餐厅',()=>closePanel(),'btn primary'));
  }
  function beginTask(index){
    const shuffled=[0,1,2,3,4];
    for(let i=shuffled.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
    }
    if(shuffled.every((v,i)=>v===i))shuffled.reverse();
    task={index,end:performance.now()+30000,shuffled,order:[],step:0,
      message:'',solved:false};
    drawTask();
  }
  function drawTask(){
    const t=task, station=stations[t.index];
    const content=openPanel('task',station.name+' · '+station.concept);
    if(t.solved){
      if(t.index===4)modal.classList.add('spectate');
      explain(content,t.index);
      content.append(action(done.every(Boolean)?'去试做第一道菜':'继续探索',()=>closePanel(),'btn primary'));
      return;
    }
    const clock=node('span','timer');clock.id='task-clock';content.prepend(clock);
    const remaining=Math.ceil((t.end-performance.now())/1000);
    clock.textContent=remaining>0?'剩余 '+remaining+' 秒':'时间到';
    content.append(node('p','',station.intro));
    if(remaining<=0){
      content.append(node('p','feedback','可以重新开始这一站。'),action('再试一次',()=>beginTask(t.index),'btn primary'));return;
    }
    const status=node('p','feedback',t.message);status.setAttribute('role','status');
    function taskMessage(message){t.message=message;status.textContent=message;}
    function complete(){
      t.solved=true;
      done[t.index]=true;
      savePlayer({done:savedMask()});
      if(t.index===4)showSamples();
      drawTask();
    }
    if(t.index===0){
      content.append(action('随便来点好吃的',()=>taskMessage('主厨还需要猜份量、口味和时间。再看看另一单。'),'choice'));
      content.append(action('两人份、不要辣、20 分钟内上菜',()=>complete(),'choice'));
    }else if(t.index===1){
      const picked=node('p','summary',t.order.length?t.order.map(i=>steps[i]).join(' → '):'已选工序会显示在这里');
      const chips=node('div','chips');
      t.shuffled.forEach(i=>{
        const b=action(steps[i],()=>{t.order.push(i);t.message='';drawTask();},'choice');
        b.disabled=t.order.includes(i);chips.append(b);
      });
      const buttons=node('div','game-hints');
      const undo=action('撤回上一步',()=>{t.order.pop();t.message='';drawTask();});
      const check=action('确认顺序',()=>{
        if(t.order.every((v,i)=>v===i))complete();
        else taskMessage('顺序还要调整。先洗番茄再切，最后装盘。');
      },'btn primary');
      check.disabled=t.order.length!==5;undo.disabled=!t.order.length;
      buttons.append(undo,check);content.append(picked,chips,buttons);
    }else if(t.index===2){
      const isAgent=t.step===1;
      content.append(node('p','summary',isAgent?'智能体要查课程资料。用什么工具？':'你要查菜谱。拿什么工具？'));
      const options=isAgent?['写代码','联网搜索','文档编辑']:['炒锅','菜刀','手机'];
      const answer=isAgent?'联网搜索':'手机';
      options.forEach(tool=>content.append(action(tool,()=>{
        if(tool!==answer){taskMessage(isAgent?'要从网上找资料，换一个工具。':'要看菜谱，换一个能查资料的工具。');return;}
        if(isAgent)complete();
        else {t.step=1;t.message='手机能查菜谱。现在换成智能体。';drawTask();}
      },'choice')));
    }else if(t.index===3){
      if(t.step===0)content.append(action('写进熟客本：我不要香菜',()=>{t.step=1;t.message='已记下小林的口味。';drawTask();},'btn primary'));
      else{
        content.append(node('p','summary','小林的偏好 · 不要香菜'));
        content.append(action('请小林再点一单',()=>complete(),'btn primary'));
      }
    }else{
      if(t.step===0)content.append(action('装订番茄炒蛋菜谱',()=>{t.step=1;t.message='菜谱已装订。';drawTask();},'btn primary'));
      else content.append(action('把菜谱交给三位小厨师',()=>complete(),'btn primary'));
    }
    content.append(status);
  }

  const schedule=[[0,2],[12,2],[25,4],[40,1],[54,3],[68,2],[82,2],[95,4],[106,2]];
  const roundLength=120, queuePatience=40;
  const serviceRange=1.28;
  function beginRound(){
    if(!current){playerPanel();return;}
    const next=nextRecipe();
    if(next!==null){prepareRecipe(next);return;}
    resetView();
    round={id:Date.now().toString(36)+'-'+crypto.getRandomValues(new Uint32Array(2)).join('-'),elapsed:0,score:0,served:0,waiting:[],tables:world.tables.map(()=>null),focus:null,selected:null,
      next:0,serial:0,started:performance.now()};
    setMode('round');tickRound(0);
  }
  function updateGuestQueue(){
    const positions=[[-8.64,3.81],[-9.38,5.11],[-9.36,6.08]];
    round.waiting.forEach((party,i)=>{
      const [x,z]=positions[i];world.pose(party.actor,x,z,0,Math.PI-.12);
    });
  }
  function spawnParty(size,at){
    const inUse=new Set([...round.waiting,...round.tables.filter(Boolean)].map(o=>o.actor));
    const actor=world.guests.find(a=>!inUse.has(a));
    if(!actor||round.waiting.length>=3)return;
    const id=++round.serial;
    const kind=id%4===2?'regular':id%4===3?'unclear':'plain';
    const recipe=current.learned===2&&id%2===1?1:0;
    round.waiting.push({id,size,actor,arrival:at,kind,recipe,confirmed:false,state:'waiting',step:0,until:0,garnished:false});
    updateGuestQueue();
  }
  function dropParty(i){
    const party=round.tables[i];party.actor.g.visible=false;round.tables[i]=null;
    world.tableDishes[i].visible=false;
    if(round.focus===i)round.focus=null;
    if(round.selected===i)round.selected=null;
  }
  function readyTable(){
    let next=-1;
    round.tables.forEach((p,i)=>{
      if(p?.state==='ready'&&(next<0||p.deadline<round.tables[next].deadline))next=i;
    });
    return next;
  }
  function nextRecipe(){
    if(!current.learned)return 0;
    if(current.learned===1&&current.qualifying>=2)return 1;
    return null;
  }
  function startTrial(recipe){
    resetView();
    trial={recipe,step:0,until:0,kind:'plain',garnished:false};
    setMode('trial');
  }
  function prepareRecipe(index){
    if(index===0){startTrial(index);return;}
    const recipe=recipes[index], planned=[];
    const content=openPanel('plan','新菜试做 · '+recipe.name);
    content.append(node('p','command-hint','按顺序点工序。排好后，到工位找工具试做。'));
    const sequence=node('p','summary','还没有选择工序。');
    const choices=node('div','chips');
    const submit=action('开始试做',()=>{
      if(!planned.every((step,i)=>step===i)){
        planned.length=0;
        sequence.textContent='先处理食材，烤完再装盘。请重新排序。';
        [...choices.children].forEach(button=>button.disabled=false);
        submit.disabled=true;
        return;
      }
      closePanel(false);startTrial(index);
    },'btn primary');
    submit.disabled=true;
    for(const i of [2,0,3,1]){
      const button=action(recipe.steps[i].name,()=>{
        planned.push(i);button.disabled=true;
        sequence.textContent=planned.map(step=>recipe.steps[step].name).join(' → ');
        submit.disabled=planned.length<recipe.steps.length;
      },'choice');
      choices.append(button);
    }
    content.append(sequence,choices,submit);
  }
  function activeJob(){
    if(mode==='trial')return trial;
    if(mode!=='round'||round.selected!==null)return null;
    const focused=round.tables[round.focus];
    return focused?.state==='prep'?focused:round.tables.find(p=>p?.state==='prep');
  }
  function jobStep(job){return job&&recipes[job.recipe].steps[job.step];}
  function recipeFlow(job){
    if(!job)return '';
    return recipes[job.recipe].steps.map((step,index)=>(index<job.step?'✓ ':'')+step.name).join(' → ');
  }
  function useTool(id){
    if(panel)return;
    const job=activeJob(), step=jobStep(job);
    if(!step){setFeedback('先接单并带位，再开始做菜。');return;}
    const tool=kitchenTools[id], target=id==='plate'?world.pass.target:tool.target;
    if(!approach(target,tool.name))return;
    if(job.until){
      setFeedback('正在'+step.name+'。'+(mode==='round'?'可点击另一张等餐桌切换订单。':'完成后再装盘。'));
      return;
    }
    if(step.tool!==id){
      setFeedback('下一步是「'+step.name+'」，去用'+kitchenTools[step.tool].name+'。');
      return;
    }
    if(id==='plate'){plateJob(job);return;}
    if(step.seconds){
      const busy=mode==='round'&&round.tables.some(other=>other!==job&&other?.until&&jobStep(other)?.tool===id);
      if(busy){setFeedback(tool.name+'正在做另一单。');return;}
      job.until=performance.now()+step.seconds*1000;
      setFeedback(step.name+'开始。'+(id==='oven'&&mode==='round'?'烘烤时可以做另一单。':''));
    }else{
      job.step++;
      setFeedback(step.name+'完成。');
    }
  }
  function plateJob(job){
    const content=openPanel('plate','装盘 · '+recipes[job.recipe].name);
    const noCilantro=job.kind==='regular';
    const hint=node('p','command-hint',noCilantro?'熟客本 · 小林不要香菜。':'菜谱 · 最后放一点香菜。');
    content.append(hint);
    for(const add of [true,false]){
      content.append(action(add?'加香菜':'不加香菜',()=>{
        if(activeJob()!==job){closePanel();return;}
        if(add===noCilantro){
          hint.textContent=noCilantro?'小林的订单要求去掉香菜。再检查一次。':'再看菜谱最后一步，然后装盘。';
          return;
        }
        closePanel(false);
        job.garnished=add;job.step++;
        if(mode==='trial'){
          world.dishStyle(world.serving,job.recipe,job.garnished);
          world.prop(world.serving,world.pass.x+.42,1.11,world.pass.z);
          const review=openPanel('save-recipe','试做通过 · '+recipes[job.recipe].name);
          review.append(node('p','summary','保存后，接到这道菜的订单就能直接调用这套步骤。'),
            action('保存菜谱',()=>{
              savePlayer({learned:job.recipe+1});closePanel(false);enterReady();
              setFeedback('已保存 '+recipes[job.recipe].name+'，可以营业了。');
            },'btn primary'));
        }else{
          job.state='ready';
          setFeedback('装盘完成。到出餐口取餐。');
        }
      },'choice'));
    }
  }
  function finishTimedStep(job,now){
    if(job.until&&now>=job.until){
      const step=jobStep(job);
      job.until=0;job.step++;
      if(activeJob()===job)setFeedback(step.name+'完成。');
    }
  }
  function tickRound(elapsed){
    round.elapsed=elapsed;
    if(elapsed>=roundLength){endRound();return;}
    for(let i=0;i<round.tables.length;i++){
      const p=round.tables[i];if(!p)continue;
      if(p.state==='eating'){
        if(elapsed>=p.leaveAt)dropParty(i);
        continue;
      }
      if(elapsed>=p.deadline){
        dropParty(i);setFeedback((i+1)+' 号桌等太久，客人先走了。');continue;
      }
      finishTimedStep(p,performance.now());
    }
    const front=round.waiting[0];
    const kept=round.waiting.filter(p=>{
      if(elapsed-p.arrival<queuePatience)return true;
      p.actor.g.visible=false;return false;
    });
    if(kept.length!==round.waiting.length){
      round.waiting=kept;updateGuestQueue();
      if(panel==='order'&&front!==kept[0])closePanel();
      setFeedback('一组客人等太久，先离开了。');
    }
    while(round.next<schedule.length&&schedule[round.next][0]<=elapsed){
      const [at,size]=schedule[round.next++];
      if(elapsed-at<queuePatience)spawnParty(size,at);
    }
    const servingIndex=round.selected??readyTable();
    world.serving.visible=servingIndex>=0;
    if(servingIndex>=0){
      const dish=round.tables[servingIndex];
      world.dishStyle(world.serving,dish.recipe,dish.garnished);
    }
    if(round.selected===null&&world.serving.visible){
      world.prop(world.serving,world.pass.x+.42,1.11,world.pass.z);
    }
    if(round.selected!==null){
      const a=world.player.g;
      world.prop(world.serving,a.position.x+Math.sin(a.rotation.y)*1.03,1.03,a.position.z+Math.cos(a.rotation.y)*1.03);
    }
  }
  function playerDistance(target){
    const p=world.player.g.position;
    return Math.hypot(p.x-target[0],p.z-target[1]);
  }
  function tableTarget(i){
    const t=world.tables[i];
    return [t.x,t.z+(t.z<0?1.93:-1.93)];
  }
  function approach(target,place){
    if(playerDistance(target)>serviceRange){
      world.move(...target);setFeedback('前往'+place+'。到旁边后，再点一次或按 E。',5);return false;
    }
    world.player.path.length=0;
    return true;
  }
  function confirmOrder(party){
    party.confirmed=true;
    setFeedback(party.kind==='regular'?'记忆 · 熟客本记得小林不要香菜。':
      '目标 · '+party.size+' 人份'+recipes[party.recipe].name+'。现在去空桌带位。',5);
  }
  function hostOrder(){
    if(mode!=='round'||panel)return;
    const party=round.waiting[0];
    if(!party){setFeedback('门口暂时没有客人。');return;}
    if(party.confirmed){setFeedback('订单已确认，请带这组客人去空桌。');return;}
    if(!approach(stations[0].target,'点单台'))return;
    if(party.kind!=='unclear'){confirmOrder(party);return;}
    const content=openPanel('order','客人说「随便来点」');
    const hint=node('p','command-hint','还缺哪些信息？');
    content.append(hint,action('先问人数和口味',()=>{
      if(mode!=='round'||round.waiting[0]!==party)return;
      closePanel();confirmOrder(party);
    },'choice'),action('直接让厨房随便做',()=>{
      hint.textContent='厨房还不知道做几人份、要什么口味。';
    },'choice'));
  }
  function seatParty(i){
    const party=round.waiting[0], table=world.tables[i];
    if(!party?.confirmed){setFeedback('先到点单台确认订单。');return;}
    if(round.tables[i]){setFeedback((i+1)+' 号桌有人，找一张空桌。');return;}
    if(party.size>table.capacity){setFeedback(party.size+' 位客人需要四人桌。');return;}
    if(!approach(tableTarget(i),(i+1)+' 号桌'))return;
    round.waiting.shift();updateGuestQueue();
    party.state='prep';party.patience=46;party.deadline=party.seated+party.patience;
    round.tables[i]=party;
    if(round.focus===null||round.tables[round.focus]?.state!=='prep')round.focus=i;
    world.seatGuest(party.actor,tableTarget(i),[table.x-(table.capacity===4?1.25:1.06),table.z]);
    setFeedback('客人已入座。按订单上的菜谱去用厨具。',4);
  }
  function takePlate(){
    if(mode!=='round'||panel)return;
    if(round.selected!==null){setFeedback('手上的菜要送到 '+(round.selected+1)+' 号桌。');return;}
    const i=readyTable();
    if(i<0){useTool('plate');return;}
    if(!approach(world.pass.target,'出餐口'))return;
    round.selected=i;
    setFeedback('已取餐。送到 '+(i+1)+' 号桌。');
  }
  function deliver(i){
    if(round.selected!==i){setFeedback('这盘菜是 '+(round.selected+1)+' 号桌的。');return;}
    if(!approach(tableTarget(i),(i+1)+' 号桌'))return;
    const party=round.tables[i], t=world.tables[i];
    if(party?.state!=='ready')return;
    const points=party.deadline-round.elapsed>=party.patience/2?15:10;
    round.score+=points;round.served++;
    party.state='eating';party.leaveAt=round.elapsed+5.4;round.selected=null;
    world.dishStyle(world.tableDishes[i],party.recipe,party.garnished);
    world.prop(world.tableDishes[i],t.x-.33,1.12,t.z+.16);
    setFeedback('上菜成功！＋'+points+' 分');
  }
  function tableClick(i){
    if(mode!=='round'||panel)return;
    if(round.selected!==null)deliver(i);
    else if(round.tables[i]?.state==='prep'){
      round.focus=i;setFeedback('已选 '+(i+1)+' 号桌的订单。');
    }
    else if(round.tables[i]?.state==='ready')setFeedback('到出餐口取这桌的餐。');
    else seatParty(i);
  }
  function interactKitchen(){
    const actions=toolTags.map(({id,tool})=>[tool.target,()=>useTool(id)]);
    if(mode==='trial')actions.push([world.pass.target,()=>useTool('plate')]);
    else actions.push([stations[0].target,hostOrder],[world.pass.target,takePlate],
      ...world.tables.map((_,i)=>[tableTarget(i),()=>tableClick(i)]));
    actions.sort((a,b)=>playerDistance(a[0])-playerDistance(b[0]));
    const nearest=actions.find(([target])=>playerDistance(target)<=serviceRange);
    if(nearest)nearest[1]();
    else setFeedback('先走近要操作的工位，再按 E。');
  }
  function endRound(){
    if(panel==='order'||panel==='plate')closePanel(false);
    const score=round.score, served=round.served;
    savePlayer({result:{id:round.id,score,served}});setMode('result');world.serving.visible=false;
    customerBubble.hidden=true;
    const content=openPanel('score','本局营业结束');
    content.append(node('p','summary','本局 '+score+' 分 · 成功上菜 '+served+' 桌'),
      node('p','','店长称号 · '+level({...current,score:round.score})));
    const unlocked=nextRecipe()===1;
    if(current.learned===1)content.append(node('p','smallline',unlocked?
      '已解锁芝士烤番茄。试做并保存后，客人就能点这道菜。':
      '解锁芝士烤番茄 · 已完成 '+current.qualifying+' / 2 份合格订单'));
    const controls=node('div','game-hints');
    controls.append(action(unlocked?'试做芝士烤番茄':'再来一局',()=>{closePanel(false);beginRound();},'btn primary'),
      action('切换玩家',()=>playerPanel()));
    content.append(controls);addRank(content);camera();
  }
  function renderPlay(now){
    const message=now<feedbackUntil?feedback:'';
    if(mode==='training'){
      const count=done.filter(Boolean).length;
      const nearest=nearbyStation(), next=waypoint>=0?waypoint:done.findIndex(on=>!on);
      const target=nearest>=0?nearest:next;
      const isNear=nearest>=0;
      const label=isNear?'互动 · '+stations[target].name:waypoint>=0?'正在前往 '+stations[target].name:'前往 '+stations[target].name;
      const heading=isNear?(done[target]?'回看这一站':stations[target].intro):'走到一个站点旁';
      setHTML(playbar,'<div class="card-head">自由探索 · 已点亮 '+count+' / 5</div>'+
        '<div class="bar-row"><div class="command-heading">'+heading+'</div>'+
        (target>=0?'<button class="btn '+(isNear?'primary':'')+' command-btn" data-go="'+target+'">'+label+'</button>':'')+'</div>'+
        '<p class="command-hint">'+(isNear?'按 E 或点当前标签互动。点其他站点标签可以走过去。':'点击地面移动。电脑也可以用方向键或 WASD。')+'</p>'+
        (message?'<p class="smallline">'+message+'</p>':''));
    }else if(mode==='ready'){
      const next=nextRecipe();
      const title=next===0?'开张准备 · 试做第一道菜':'餐厅开张啦！';
      const button=next===null?'开始一局':'试做'+recipes[next].name;
      const help=next===0?'试做并保存番茄炒蛋菜谱，就能开门接单。':
        next===1?'排好新菜的步骤，试做成功后就能加入菜单。':'每局两分钟。接单和带位后，按菜谱去工位做菜。';
      setHTML(playbar,'<div class="bar-row"><div class="card-head">'+title+'</div><button class="btn primary" data-op="round">'+button+'</button></div>'+
        '<p class="smallline">'+help+'</p>'+
        '<div class="game-hints"><button class="btn" data-op="concept">查看智能体对照卡</button></div>');
    }else if(mode==='trial'){
      const step=jobStep(trial);
      setHTML(playbar,'<div class="card-head">试做 · '+recipes[trial.recipe].name+'</div>'+
        '<div class="command-heading">'+(step?(trial.until?'正在':'下一步 · ')+step.name+' · '+kitchenTools[step.tool].name:'试做完成')+'</div>'+
        '<p class="command-hint">'+recipeFlow(trial)+'</p>'+
        '<p class="command-hint">点地图移动。走近工位后，再点标签或按 E。</p>'+
        (message?'<p class="command-hint">'+message+'</p>':''));
    }else if(mode==='round'){
      const seconds=Math.max(0,Math.ceil(roundLength-round.elapsed));
      const front=round.waiting[0], ready=readyTable(), selected=round.selected;
      const job=activeJob(), step=jobStep(job);
      const heading=selected!==null?'送餐 · '+(selected+1)+' 号桌':
        step&&!job.until?'去'+kitchenTools[step.tool].name+' · '+step.name:
        ready>=0?'到出餐口取餐 · '+(ready+1)+' 号桌':
        front?.confirmed?'带位 · 找一张能坐 '+front.size+' 人的空桌':
        front?'到点单台接单':step?'正在'+step.name:'留意新客人和出餐';
      const ticket=job?(round.tables.indexOf(job)+1)+' 号桌 · '+recipes[job.recipe].name+
        (job.kind==='regular'?' · 不要香菜':'')+(job.until?' · '+Math.max(1,Math.ceil((job.until-now)/1000))+' 秒后完成':''):'';

      if(!playbar.querySelector('#remaining')){
        setHTML(playbar,'<div class="metrics"><span class="metric">剩余 <strong id="remaining"></strong></span><span class="metric">本局 <strong id="score"></strong></span><span class="metric">等位 <strong id="queue"></strong></span></div>'+
          '<div class="command-heading" id="ops-step"></div><p class="command-hint" id="recipe-ticket"></p><p class="command-hint" id="recipe-flow"></p><p class="command-hint">走近工位后点标签或按 E。点等餐桌的桌牌可切换订单。</p>'+
          '<p class="command-hint" id="ops-info"></p>');
      }
      byId('remaining').textContent=seconds+' 秒';byId('score').textContent=round.score+' 分';
      byId('queue').textContent=round.waiting.length+' 组';
      byId('ops-step').textContent=heading;byId('recipe-ticket').textContent=ticket;byId('recipe-flow').textContent=recipeFlow(job);byId('ops-info').textContent=message;
    }else if(mode==='result'){
      setHTML(playbar,'<div class="bar-row"><div class="card-head">本局 '+round.score+' 分</div><button class="btn primary" data-op="round">'+(nextRecipe()===1?'试做新菜':'再来一局')+'</button></div>'+
        '<p class="smallline">店长称号 · '+level({...current,score:round.score})+'</p>'+
        '<div class="game-hints"><button class="btn" data-op="rank">查看排行榜</button></div>');
    }
  }
  function syncWorld(){
    const opened=['ready','round','result'].includes(mode)&&current?.learned>0;
    const job=activeJob(), step=jobStep(job);
    world.lights(done,opened,step?{knife:1,wok:2,oven:2,plate:4}[step.tool]:-1);
    world.cooking(mode==='trial'?Boolean(trial.until&&step?.tool==='wok'):
      mode==='round'&&round.tables.some(p=>p?.until&&jobStep(p)?.tool==='wok'));
    const showStations=mode==='training'||mode==='ready';
    const nearest=showStations?nearbyStation():-1;
    const recommended=nearest>=0?nearest:waypoint;
    const playerPosition=world.player.g.position;
    position(playerMarker,[playerPosition.x,2.86,playerPosition.z],!panel);
    stationTags.forEach((el,i)=>{
      position(el,world.labelPoints[i],showStations);
      el.classList.toggle('done',done[i]);el.classList.toggle('active',i===recommended);
      el.tabIndex=showStations?0:-1;
      el.setAttribute('aria-label',stations[i].name+(done[i]?'，已点亮':'，未点亮')+(nearest===i?'，可以互动':''));
    });
    tableTags.forEach((el,i)=>{
      if(mode!=='round'){el.hidden=true;return;}
      const t=world.tables[i], p=round.tables[i];
      const status=p?p.state==='eating'?'用餐':p.state==='ready'?'可上菜':p.until?'制作中':'等餐':t.capacity+'位';
      const label=(i+1)+'桌 · '+(p?.state==='prep'?recipes[p.recipe].name:status);
      if(el.firstChild.textContent!==label)el.firstChild.textContent=label;
      const patience=p&&p.state!=='eating'?Math.max(0,(p.deadline-round.elapsed)/p.patience):null;
      el.lastChild.hidden=patience===null;
      if(patience!==null){
        el.lastChild.style.setProperty('--time',patience.toFixed(3));
        el.lastChild.classList.toggle('urgent',patience<.5);
      }
      el.classList.toggle('target',round.selected===i||round.selected===null&&job===p&&Boolean(p));
      el.classList.toggle('candidate',!p&&round.selected===null&&Boolean(round.waiting[0]?.confirmed&&round.waiting[0].size<=t.capacity));
      el.classList.toggle('busy',Boolean(p));
      position(el,[t.x,1.68,t.z],true);
      el.title=p&&p.state!=='eating'?'耐心还剩 '+Math.max(0,Math.ceil(p.deadline-round.elapsed))+' 秒':status;
      el.setAttribute('aria-label',(i+1)+'号桌，'+status+(playerDistance(tableTarget(i))<=serviceRange?'，可以互动':''));
    });
    const operating=mode==='round';
    const front=operating?round.waiting[0]:null;
    const ready=operating?readyTable():-1;
    hostTag.textContent=front?.confirmed?'点单台 · 已接单':'点单台 · 接单';
    passTag.textContent=ready>=0?'出餐口 · '+(ready+1)+' 号桌':'出餐口';
    hostTag.classList.toggle('attention',Boolean(front&&!front.confirmed));
    passTag.classList.toggle('attention',ready>=0);
    hostTag.classList.toggle('target',Boolean(front&&!front.confirmed&&playerDistance(stations[0].target)<=serviceRange));
    passTag.classList.toggle('target',ready>=0&&playerDistance(world.pass.target)<=serviceRange);
    hostTag.setAttribute('aria-label',hostTag.textContent+(playerDistance(stations[0].target)<=serviceRange?'，可以互动':''));
    passTag.setAttribute('aria-label',passTag.textContent+(playerDistance(world.pass.target)<=serviceRange?'，可以互动':''));
    position(hostTag,world.labelPoints[0],operating);
    const canPlate=step?.tool==='plate'&&!job.until;
    const nearPass=playerDistance(world.pass.target)<=serviceRange;
    plateTag.classList.toggle('attention',canPlate);
    plateTag.classList.toggle('target',canPlate&&nearPass);
    plateTag.setAttribute('aria-label','装盘台'+(nearPass?'，可以互动':''));
    plateTag.style.marginTop=ready>=0?'-28px':'';
    position(plateTag,[-2.00,1.84,-2.25],canPlate);
    position(passTag,[world.pass.x+.30,1.87,world.pass.z],operating&&(!canPlate||ready>=0));
    for(const {id,tool,el} of toolTags){
      el.classList.toggle('attention',step?.tool===id&&!job.until);
      const near=playerDistance(tool.target)<=serviceRange;
      el.classList.toggle('target',near&&step?.tool===id&&!job.until);
      el.setAttribute('aria-label',tool.name+(near?'，可以互动':''));
      position(el,tool.label,operating||mode==='trial');
    }
    const baking=mode==='trial'&&trial.until&&step?.tool==='oven'?trial:
      operating?round.tables.find(p=>p?.until&&jobStep(p)?.tool==='oven'):null;
    kitchenTag.textContent=baking?'烘烤 '+Math.max(1,Math.ceil((baking.until-performance.now())/1000))+' 秒':'';
    position(kitchenTag,[-.37,2.55,-6.37],Boolean(baking));
    if(front){
      customerBubble.textContent=front.confirmed&&front.kind==='regular'?'小林 · 不要香菜':
        front.kind==='regular'?'熟客小林 · '+front.size+' 位':front.kind==='unclear'&&!front.confirmed?'想点点好吃的':recipes[front.recipe].name+' · '+front.size+' 位';
      const p=front.actor.g.position;position(customerBubble,[p.x,1.87,p.z+.22],true);
    }else customerBubble.hidden=true;
  }

  playerButton.addEventListener('click',()=>playerPanel());
  rankButton.addEventListener('click',rankPanel);
  playbar.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if(b.dataset.go!==undefined)chooseStation(Number(b.dataset.go));
    if(b.dataset.op==='round')beginRound();
    if(b.dataset.op==='concept')conceptPanel();
    if(b.dataset.op==='rank')rankPanel();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&panel&&panel!=='save-recipe'&&(panel!=='player'||current)){event.preventDefault();closePanel();}
    if(event.key==='Tab'&&panel){
      const items=[...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
      if(!items.length)return;
      if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1).focus();}
      else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}
    }
  });
  const pointers=new Map();
  let drag=false,pinch=0;
  const canMove=()=>!panel&&['training','ready','trial','round','result'].includes(mode);
  const moveKeys=new Set(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d']);
  document.addEventListener('keydown',event=>{
    const key=event.key.toLowerCase();
    if(!canMove()||event.altKey||event.ctrlKey||event.metaKey||event.isComposing)return;
    if(moveKeys.has(key)){event.preventDefault();keys.add(key);waypoint=-1;}
    if(key!=='e'||event.repeat)return;
    if(mode==='round'||mode==='trial'){interactKitchen();return;}
    if(mode==='training'||mode==='ready'){
      const nearby=nearbyStation();
      if(nearby>=0)chooseStation(nearby);
      else setFeedback('先走到任意站点旁，再按 E 互动。');
    }
  });
  document.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  function zoom(value){world.desired.zoom=Math.max(.77,Math.min(2.02,value));}
  world.canvas.addEventListener('pointerdown',e=>{
    if(!canMove()||e.button>0)return;
    world.canvas.setPointerCapture(e.pointerId);
    if(!pointers.size){drag=false;pinch=0;}
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY});
    if(pointers.size>1)drag=true;
  });
  world.canvas.addEventListener('pointermove',e=>{
    const item=pointers.get(e.pointerId);if(!item||!canMove())return;
    const delta=e.clientX-item.x;
    item.x=e.clientX;item.y=e.clientY;
    if(pointers.size>1){
      const [a,b]=pointers.values(), d=Math.hypot(a.x-b.x,a.y-b.y);
      if(pinch>0&&d>0)zoom(world.desired.zoom*d/pinch);
      pinch=d;return;
    }
    if(Math.hypot(item.x-item.startX,item.y-item.startY)>7)drag=true;
    if(drag)world.desired.yaw-=delta*.008;
  });
  world.canvas.addEventListener('pointerup',e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.delete(e.pointerId);pinch=0;
    if(drag||pointers.size||!canMove())return;
    const hit=world.world(e.clientX,e.clientY);if(!hit)return;
    if(mode==='round'){
      const tabletop=world.world(e.clientX,e.clientY,1.10);
      const i=world.tables.findIndex(t=>tabletop&&Math.hypot(t.x-tabletop.x,t.z-tabletop.z)<1.02);
      if(i>=0){tableClick(i);return;}
      if(tabletop&&Math.hypot(world.pass.x-tabletop.x,world.pass.z-tabletop.z)<1.14){takePlate();return;}
      if(tabletop&&Math.abs(tabletop.x+8.85)<1.95&&Math.abs(tabletop.z-2.76)<.72){hostOrder();return;}
    }
    waypoint=-1;world.move(hit.x,hit.z);
  });
  world.canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);drag=true;pinch=0;});
  world.canvas.addEventListener('wheel',e=>{
    if(!canMove())return;
    e.preventDefault();zoom(world.desired.zoom*Math.exp(-e.deltaY*.0015));
  },{passive:false});

  let lastHud=0,lastStats=0;
  function run(now){
    const wallDelta=Math.max(0,(now-last)/1000),dt=Math.min(.05,wallDelta);last=now;
    if(mode==='training'&&task&&!task.solved){
      const remain=Math.ceil((task.end-now)/1000), clock=byId('task-clock');
      if(remain<=0&&!task.expired){task.expired=true;drawTask();}
      else if(clock&&remain>0)clock.textContent='剩余 '+remain+' 秒';
    }else if(mode==='round')tickRound((now-round.started)/1000);
    else if(mode==='trial')finishTimedStep(trial,now);
    if(canMove()&&keys.size){
      const has=(a,b)=>keys.has(a)||keys.has(b);
      const x=Number(has('d','arrowright'))-Number(has('a','arrowleft'));
      const z=Number(has('s','arrowdown'))-Number(has('w','arrowup'));
      if(x||z)world.steer(x,z,dt);
    }
    world.frame(now/1000,dt);syncWorld();
    if(now-lastHud>85){renderPlay(now);lastHud=now;}
    if(now-lastStats>600){
      const stats=world.stats();document.body.dataset.triangles=stats.triangles;
      document.body.dataset.drawCalls=stats.drawCalls;document.body.dataset.pixelRatio=stats.pixelRatio.toFixed(2);lastStats=now;
    }
    requestAnimationFrame(run);
  }
  resetView();setMode('training');playerPanel();requestAnimationFrame(run);
}

loadThree().then(()=>startGame(createRestaurant(document.getElementById('stage')))).catch(error=>{
  console.error(error);
  const text=document.createElement('p');text.className='fail';
  text.textContent='餐厅的三维画面加载失败。请确认浏览器支持三维加速，联网后刷新，或将 three.min.js 放到网页旁边再打开。';
  document.getElementById('stage').append(text);
  document.querySelector('.bottom').hidden=true;
  document.querySelector('.actions').hidden=true;
});
