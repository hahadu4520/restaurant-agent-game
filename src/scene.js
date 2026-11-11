function createRestaurant(stage){
  const T=window.THREE, scene=new T.Scene(), fixed=new T.Group();
  scene.add(fixed);
  const mobile=matchMedia('(pointer:coarse)').matches;
  const renderer=new T.WebGLRenderer({alpha:true,antialias:!mobile,powerPreference:'high-performance'});
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.16;
  stage.append(renderer.domElement);
  const camera=new T.OrthographicCamera(-15,15,9,-9,.1,120);
  const ambient=new T.HemisphereLight(0xfff9eb,0xc49d83,1.63);
  const sun=new T.DirectionalLight(0xffe4c2,2.26);
  sun.position.set(-12,17,8);
  const fill=new T.DirectionalLight(0xd6e3ff,.7);
  fill.position.set(9,5,-7);
  scene.add(ambient,sun,fill);

  const blue=0x2b6cff, white=0xfff8ec, red=0xff6b5b, wood=0xc98b57;
  const navy=0x1f3967, honey=0xf0bd7b, dark=0x583c34, green=0x629448;
  const materials=new Map(), geometry=new Map(), obstacles=[];
  let parent=fixed, reusable=new T.BoxGeometry(1,1,1);
  function mat(color){
    if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.86}));
    return materials.get(color);
  }
  function mesh(g,m,x,y,z,sx=1,sy=1,sz=1){
    const a=new T.Mesh(g,typeof m==='number'?mat(m):m);
    a.position.set(x,y,z);a.scale.set(sx,sy,sz);parent.add(a);return a;
  }
  function block(x,y,z,w,h,d,c){return mesh(reusable,c,x,y,z,w,h,d)}
  function round(x,y,z,w,h,d,r,c){
    r=Math.min(r,w*.42,h*.42,d*.42);
    const key=[w,h,d,r].join();
    if(!geometry.has(key)){
      const s=new T.Shape(), l=w/2-r, t=h/2-r;
      s.moveTo(-l,-t);s.lineTo(l,-t);s.lineTo(l,t);s.lineTo(-l,t);s.closePath();
      const g=new T.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:1,curveSegments:1,steps:1});
      g.translate(0,0,-(d-2*r)/2);geometry.set(key,g);
    }
    return mesh(geometry.get(key),c,x,y,z);
  }
  // 圆角木台面使用沿水平方向挤出的平面轮廓。
  function slab(x,y,z,w,d,h,r,c){
    const s=new T.Shape(), l=w/2, t=d/2;
    s.moveTo(-l+r,-t);s.lineTo(l-r,-t);s.quadraticCurveTo(l,-t,l,-t+r);
    s.lineTo(l,t-r);s.quadraticCurveTo(l,t,l-r,t);s.lineTo(-l+r,t);
    s.quadraticCurveTo(-l,t,-l,t-r);s.lineTo(-l,-t+r);s.quadraticCurveTo(-l,-t,-l+r,-t);
    const g=new T.ExtrudeGeometry(s,{depth:h,curveSegments:4,bevelEnabled:false});
    g.rotateX(-Math.PI/2);g.translate(0,-h/2,0);
    return mesh(g,c,x,y,z);
  }
  const sphere=new T.SphereGeometry(1,10,6), cylinder=new T.CylinderGeometry(1,1,1,14);
  const cone=new T.CylinderGeometry(.7,1,1,12), circle=new T.CircleGeometry(1,20), morsel=new T.IcosahedronGeometry(1,0);
  function ball(x,y,z,w,h,d,c){return mesh(sphere,c,x,y,z,w,h,d)}
  function tube(x,y,z,w,h,d,c){return mesh(cylinder,c,x,y,z,w,h,d)}
  function tapered(x,y,z,w,h,d,c){return mesh(cone,c,x,y,z,w,h,d)}
  const shadowM=new T.MeshBasicMaterial({color:0x67422d,transparent:true,opacity:.11,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  function shade(x,z,w,d,y=.025){
    const a=mesh(circle,shadowM,x,y,z,w,d,1);a.rotation.x=-Math.PI/2;
  }
  function fence(x,z,w,d,pad=.26){obstacles.push([x-w/2-pad,x+w/2+pad,z-d/2-pad,z+d/2+pad]);}
  function pot(x,z,y=0,s=1,flower=false){
    tapered(x,y+.22*s,z,.31*s,.43*s,.31*s,flower?white:0xc28453);
    tube(x,y+.45*s,z,.32*s,.10*s,.32*s,flower?white:honey);
    for(let j=0;j<5;j++){
      const a=j*2.4, r=(j%2?.18:.25)*s;
      const leaf=ball(x+Math.cos(a)*r,y+(.63+j%3*.13)*s,z+Math.sin(a)*r,.13*s,.29*s,.10*s,j%2?0x7aa74e:green);
      leaf.rotation.z=Math.sin(a)*.65;leaf.rotation.x=Math.cos(a)*.60;
    }
    if(flower){tube(x,y+.78*s,z,.035*s,.60*s,.035*s,green);
      ball(x,y+1.08*s,z,.14*s,.2*s,.13*s,red);
      ball(x+.075*s,y+1.1*s,z,.10*s,.15*s,.12*s,red);
    }
  }
  function tomato(x,y,z,s=1){
    ball(x,y,z,.22*s,.20*s,.22*s,0xe94431);
    tube(x,y+.19*s,z,.10*s,.035*s,.07*s,green);
    tube(x,y+.23*s,z,.035*s,.09*s,.035*s,green);
  }
  function cabinet(x,z,w,d=1.32){
    block(x,.55,z,w,1.05,d,0xb16f42);
    round(x,1.12,z,w+.12,.18,d+.12,.065,honey);
    for(let i=0;i<Math.floor(w/.88);i++){
      const cx=x-w/2+.47+i*.88;
      round(cx,.57,z+d/2+.026,.79,.80,.065,.025,wood);
      block(cx,.79,z+d/2+.082,.24,.055,.055,0xf8c97f);
    }
    shade(x,z,w*.59,d*.73);fence(x,z,w,d);
  }
  function book(x,y,z,closed=false){
    const prior=parent, g=new T.Group();g.position.set(x,y,z);g.rotation.x=closed?.57:.20;prior.add(g);parent=g;
    round(0,.06,0,1.25,.13,.91,.045,closed?red:0xaa5b3c);
    round(-.29,.148,0,.54,.10,.77,.033,white);round(.29,.148,0,.54,.10,.77,.033,0xffedce);
    for(let j=0;j<4;j++){
      block(-.29,.202,-.26+j*.15,.32-j%2*.08,.012,.029,0xcba789);
      block(.30,.202,-.26+j*.15,.32-j%2*.08,.012,.029,0xcba789);
    }
    if(closed){
      tube(.31,.212,-.1,.14,.02,.15,blue);ball(.31,.23,-.1,.11,.035,.10,red);
      for(let i=0;i<3;i++)round(0,.214,-.28+i*.26,.19,.066,.069,.018,0xd6d9d6);
    }
    else for(let j=0;j<3;j++)ball(-.48,.216,-.25+j*.18,.047,.012,.05,blue);
    parent=prior;
  }

  for(let i=0;i<8;i++){
    const soft=new T.MeshBasicMaterial({color:0x986246,transparent:true,opacity:.025+i*.004,depthWrite:false});
    const o=mesh(circle,soft,.40,-1.02+i*.002,.30,14.8-i*.39,10.2-i*.29,1);
    o.rotation.x=-Math.PI/2;
  }
  slab(0,-.72,0,24.5,16.0,.48,1.06,0x986043);
  slab(0,-.42,0,24.8,16.24,.27,1.07,0xb67548);
  slab(0,-.225,0,24.55,16.02,.16,1.03,0xf1b67c);
  slab(0,-.105,0,24.36,15.83,.22,.98,wood);
  const planks=[0xc38853,0xcb915e,0xd59b67,0xce935d,0xd19a62,0xc78c56,0xd5a06f];
  for(let j=0;j<24;j++){
    const z=-7.67+j*.66, limit=Math.abs(z)>7.3?11.58:12.03;
    let left=-limit;
    for(let i=0;left<limit-.02;i++){
      const right=Math.min(limit,left+((i===0)?(1.2+(j%3)*.91):3.9));
      if(right-left>.028)block((left+right)/2,.013,z,right-left-.018,.027,.637,planks[(i*3+j*5)%planks.length]);
      left=right;
    }
  }
  // 开放桌面模型，边缘只用贴地的木收边和盆栽。
  block(0,.07,-7.48,23.62,.12,.16,0xa97553);
  for(const x of [2.4,6.7,10.56])pot(x,-7.02,0,.91,true);
  for(const x of [-11.4,11.38])for(const z of [-1.2,6.65]){pot(x,z,0,.95);fence(x,z,.62,.62);}

  // 左前门廊与点单台。
  const doorX=-9.25, doorZ=6.65;
  shade(doorX,doorZ,1.8,.85);
  for(const offset of [-1.16,1.16]){
    round(doorX+offset,1.30,doorZ,.38,2.58,.53,.11,blue);
    round(doorX+offset,.13,doorZ,.53,.24,.67,.07,white);
    fence(doorX+offset,doorZ,.53,.67);
  }
  round(doorX,2.49,doorZ,2.74,.46,.57,.13,blue);
  for(let i=0;i<7;i++){
    const a=round(doorX-1.10+i*.366,2.32,doorZ+.31,.39,.19,.61,.073,i%2?white:red);
    a.rotation.x=-.28;
  }
  round(doorX,.06,doorZ+.37,1.55,.075,.88,.028,0x5387dd);
  const signBody=round(doorX,2.77,doorZ,1.58,.36,.13,.05,navy);
  const signLamp=round(doorX,2.77,doorZ+.075,1.31,.14,.035,.011,0x89765d);
  for(let i=0;i<4;i++){
    const x=doorX-1.5+i*1.05;
    tube(x,.08,4.48,.16,.12,.16,0xc69c56);
    tube(x,.38,4.48,.048,.66,.048,0xc69c56);ball(x,.73,4.48,.095,.095,.095,honey);
    if(i<3)round(x+.525,.57,4.48,1.04,.074,.09,.028,blue);
  }
  fence(doorX+.075,4.48,3.39,.20);
  const counter={x:-8.85,z:2.76};
  shade(counter.x,counter.z,2.28,.95);
  round(counter.x,.56,counter.z,3.90,1.04,1.34,.22,0xe4a55c);
  round(counter.x,.56,counter.z+.65,3.38,.66,.10,.047,0xffd997);
  round(counter.x,1.15,counter.z,4.11,.23,1.53,.10,blue);
  tube(-10.03,1.30,2.94,.33,.09,.28,0xb58634);
  ball(-10.03,1.39,2.94,.26,.18,.23,0xf3be55);
  ball(-10.03,1.58,2.94,.055,.057,.055,0xffdfa2);
  for(let j=0;j<2;j++){
    const slip=round(-7.72+j*.45,1.30,2.75,.34,.045,.46,.017,white);
    slip.rotation.y=j*.21;
    for(let i=0;i<3;i++)block(-7.72+j*.45,1.329,2.61+i*.09,.20,.01,.02,0xb79b80);
  }
  fence(counter.x,counter.z,4,1.45);
  pot(-6.96,2.61,1.26,.48);

  // 紧凑且互通的备菜、工具、料理岛。
  cabinet(-8.8,-6.30,5.44);
  cabinet(-3.67,-6.30,4.65);
  round(-10.45,1.22,-6.29,1.15,.10,.90,.04,0x839d9e);
  round(-10.45,1.27,-6.29,.94,.028,.70,.013,0x739ab9);
  tube(-10.45,1.50,-6.66,.058,.53,.058,0x879ba5);
  round(-10.45,1.74,-6.49,.12,.11,.40,.047,0x879ba5);
  round(-7.58,1.25,-6.24,2.15,.12,.81,.05,0xde9d53);
  for(let i=0;i<3;i++)tomato(-8.24+i*.43,1.49,-6.30,.9);
  for(let i=0;i<2;i++)ball(-6.75+i*.25,1.42,-6.18,.11,.14,.105,white);
  for(let i=0;i<5;i++){
    const x=-9.98+i*.93;
    round(x,.32,-5.48,.73,.54,.36,.035,0xb47744);
    ball(x-.17,.62,-5.48,.14,.15,.14,i%2?red:green);
    ball(x+.11,.63,-5.43,.14,.14,.14,i%2?red:green);
  }
  for(const x of [-5.47,-2.35]){
    round(x,1.10,-7.30,.17,2.20,.23,.055,0xa66d49);
    round(x,.06,-7.28,.35,.11,.39,.042,wood);
    fence(x,-7.30,.35,.39);
  }
  round(-3.92,2.16,-7.30,3.67,1.28,.16,.055,0xc08b60);
  for(let i=0;i<10;i++)for(let j=0;j<3;j++)ball(-5.56+i*.36,1.78+j*.36,-7.22,.025,.026,.022,dark);
  const pan=tube(-5.03,2.06,-7.13,.30,.10,.30,navy);pan.rotation.x=Math.PI/2;
  block(-5.03,2.41,-7.09,.076,.28,.082,navy);
  round(-4.17,2.1,-7.1,.33,.55,.06,.02,white);
  for(let j=0;j<3;j++)block(-4.26+j*.09,2.03,-7.06,.033,.18,.022,0x927862);
  block(-4.17,2.45,-7.07,.064,.25,.065,0x897264);
  const spoon=ball(-3.30,2,-7.11,.16,.23,.05,0xc4ccd0);spoon.rotation.z=.16;
  block(-3.30,2.34,-7.10,.075,.41,.064,0xc4ccd0);
  round(-2.65,2.10,-7.1,.35,.47,.10,.034,blue);
  round(-2.83,2.16,-7.09,.21,.15,.10,.035,blue);
  round(-.37,.66,-6.37,1.47,1.29,1.38,.11,white);
  round(-.37,.64,-5.66,1.12,.61,.09,.037,navy);
  round(-.37,.63,-5.60,.90,.40,.045,.017,0xd88941);
  for(let j=0;j<3;j++){
    const knob=tube(-.77+j*.40,1.05,-5.66,.09,.12,.09,red);
    knob.rotation.x=Math.PI/2;
  }
  fence(-.37,-6.37,1.47,1.38);
  for(let j=0;j<4;j++){
    const x=-10.75+j*.58;
    round(x,.31,-7.06,.53,.56,.45,.05,0x9c653b);
    for(let k=0;k<3;k++)tomato(x-.18+k*.17,.69+(k%2)*.13,-7.05,.68);
  }
  const island={x:-4.55,z:-2.57};
  shade(island.x,island.z,3.1,1.2);
  slab(island.x,.51,island.z,5.45,1.92,.94,.46,blue);
  slab(island.x,.12,island.z,5.30,1.90,.19,.42,0x305596);
  slab(island.x,1.09,island.z,5.67,2.07,.23,.44,white);
  for(let j=0;j<4;j++){
    const trim=tube(-6.53+j*1.16,.55,-1.60,.14,.07,.14,honey);trim.rotation.x=Math.PI/2;
  }
  fence(island.x,island.z,5.67,2.07,.89);
  slab(-4.72,.18,-3.84,1.35,.87,.35,.19,wood);
  round(-4.70,1.23,-2.51,1.32,.12,1.04,.045,navy);
  tube(-4.70,1.32,-2.51,.46,.08,.46,0x5190ff);
  tapered(-4.70,1.49,-2.51,.55,.24,.53,navy);
  tube(-4.70,1.61,-2.51,.52,.04,.50,0x27313c);
  round(-4.14,1.55,-2.51,.55,.072,.083,.03,navy);
  for(let i=0;i<8;i++){
    const a=i*2.4;
    ball(-4.70+Math.cos(a)*.31,1.66+(i%2)*.03,-2.51+Math.sin(a)*.29,.115,.067,.105,i%3?0xfcb34e:red);
  }
  round(-6.42,1.24,-2.44,.74,.09,.64,.038,0xcc8e4b);
  tomato(-6.5,1.45,-2.47,.88);
  const knife=round(-6.20,1.36,-2.40,.13,.047,.34,.015,0xc9d1d0);knife.rotation.y=.2;
  round(-6.18,1.36,-2.16,.095,.061,.17,.021,navy);
  block(-2.99,1.37,-2.67,.89,.32,.13,wood);
  book(-2.99,1.36,-2.55,true);
  const pass={x:-.85,z:-2.50,target:[-.58,-1.12]};
  for(const x of [-1.79,.08])for(const z of [-2.91,-2.12])tube(x,.47,z,.092,.92,.092,honey);
  slab(pass.x,.90,pass.z,2.38,1.26,.27,.32,blue);
  slab(pass.x,1.06,pass.z,2.16,1.08,.085,.27,0x527fc4);
  for(let i=0;i<9;i++)block(-1.76+i*.227,1.108,-2.50,.021,.013,.74,0xadc4ef);
  fence(pass.x,pass.z,2.38,1.26);

  const lectern={x:-5.62,z:4.86};
  round(lectern.x,.43,lectern.z,1.08,.80,.88,.065,0xb87848);
  round(lectern.x,.82,lectern.z,1.30,.18,1.04,.064,honey);
  round(lectern.x,.51,lectern.z+.45,.80,.20,.10,.026,wood);
  block(lectern.x,.53,lectern.z+.52,.26,.065,.06,honey);
  book(lectern.x,.97,lectern.z);
  shade(lectern.x,lectern.z,.85,.67);fence(lectern.x,lectern.z,1.26,1.04);
  pot(-6.55,4.85,0,.7);

  const tables=[
    {x:2.28,z:-4.34,capacity:2},{x:5.86,z:-4.34,capacity:4},{x:9.66,z:-4.23,capacity:2},
    {x:1.42,z:3.44,capacity:2},{x:5.37,z:3.44,capacity:2},{x:9.64,z:3.44,capacity:4}
  ];
  function chair(x,z,angle){
    const before=parent,g=new T.Group();g.position.set(x,0,z);g.rotation.y=angle;before.add(g);parent=g;
    for(const ox of [-.29,.29])for(const oz of [-.29,.29])round(ox,.26,oz,.14,.48,.14,.025,white);
    round(0,.52,0,.81,.18,.79,.069,blue);
    round(0,.84,-.35,.79,.66,.17,.075,blue);
    parent=before;shade(x,z,.46,.46);
  }
  tables.forEach((t,i)=>{
    const w=t.capacity===4?1.95:1.49, d=t.capacity===4?1.68:1.37;
    shade(t.x,t.z,w*.83,d*.94);
    round(t.x,.135,t.z,.78,.18,.71,.068,blue);
    tube(t.x,.56,t.z,.18,.83,.18,blue);
    if(i===2||i===4)tube(t.x,1.02,t.z,.79,.19,.75,white);
    else slab(t.x,1.02,t.z,w,d,.19,.31,white);
    pot(t.x+.24,t.z-.25,1.12,.36,i%2===0);
    chair(t.x-w/2-.36,t.z,Math.PI/2);
    if(i===5){
      round(t.x+1.33,.26,t.z,.82,.46,1.78,.12,white);
      round(t.x+1.33,.53,t.z,.75,.16,1.72,.065,blue);
      round(t.x+1.70,.92,t.z,.19,.88,1.79,.086,blue);
      round(t.x+1.53,.76,t.z+.40,.19,.40,.35,.079,red);
    }else chair(t.x+w/2+.36,t.z,-Math.PI/2);
    if(i===1){chair(t.x,t.z-d/2-.37,0);chair(t.x,t.z+d/2+.37,Math.PI);}
    if(i===5)chair(t.x,t.z+d/2+.37,Math.PI);
    fence(t.x,t.z,w+1.38,d+(t.capacity===4?1.15:.12));
  });
  // 底板沿边摆植栽，中央保持连续通道。
  for(const pos of [[-11,6.67],[11,6.70],[10.94,-6.42],[1.54,-6.53],[-10.96,-3.89]]){
    pot(pos[0],pos[1],0,1.02,true);fence(pos[0],pos[1],.66,.66);
  }
  for(const x of [-4.55,7.55]){round(x,.11,7.33,2.22,.17,.66,.069,0xcc9358);
    for(let j=0;j<5;j++)ball(x-.85+j*.42,.31,7.33,.28,.28,.29,j%2?green:0x8aab4d);}
  const labelPoints=[[-9.53,1.99,2.72],[-7.65,2.03,-6.27],[-3.64,3.0,-7.17],[-5.62,1.83,4.78],[-2.81,2.05,-2.52]];
  const lamps=labelPoints.map((p,i)=>{
    const m=new T.MeshStandardMaterial({color:0x73666a,roughness:.6});
    const positions=[[-7.22,1.35,3.16],[-6.53,1.29,-5.78],[-2.29,2.46,-7.16],[-5.22,1.02,5.10],[-2.28,1.36,-2.25]];
    parent=scene;const bulb=ball(...positions[i],.092,.092,.092,m);parent=fixed;return bulb.material;
  });
  // 静态几何按材质合并，降低渲染调用数。可动角色和餐盘单独保留。
  function batchFixed(){
    const batches=new Map(), matNormal=new T.Matrix3();
    fixed.updateMatrixWorld(true);
    fixed.traverse(o=>{
      if(!o.isMesh||o===signLamp||(o.material.transparent&&o.material!==shadowM))return;
      const g=o.geometry, position=g.getAttribute('position'), normal=g.getAttribute('normal');
      if(!batches.has(o.material))batches.set(o.material,{positions:[],normals:[]});
      const b=batches.get(o.material), count=g.index?g.index.count:position.count;
      matNormal.getNormalMatrix(o.matrixWorld);
      const v=new T.Vector3(), n=new T.Vector3();
      for(let i=0;i<count;i++){
        const k=g.index?g.index.getX(i):i;
        v.fromBufferAttribute(position,k).applyMatrix4(o.matrixWorld);
        n.fromBufferAttribute(normal,k).applyMatrix3(matNormal).normalize();
        b.positions.push(v.x,v.y,v.z);b.normals.push(n.x,n.y,n.z);
      }
      o.visible=false;
    });
    batches.forEach((b,m)=>{
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));
      g.setAttribute('normal',new T.Float32BufferAttribute(b.normals,3));
      scene.add(new T.Mesh(g,m));
    });
  }
  batchFixed();

  const actors=[];
  function person(color,hair){
    const g=new T.Group();scene.add(g);parent=g;
    const skin=0xffc898;
    shade(0,0,.47,.31);
    const body=round(0,.68,0,.54,.65,.37,.1,color);
    round(0,1.27,0,.62,.56,.55,.12,skin);
    round(0,1.53,-.025,.64,.18,.58,.07,hair);
    round(0,1.33,-.24,.61,.35,.11,.037,hair);
    ball(-.11,1.30,.286,.034,.043,.022,dark);ball(.11,1.30,.286,.034,.043,.022,dark);
    ball(0,1.18,.288,.06,.023,.018,0xab5742);
    const legs=[], arms=[];
    for(const side of [-1,1]){
      const limb=new T.Group();limb.position.set(.145*side,.38,0);g.add(limb);parent=limb;
      round(0,-.10,0,.21,.33,.21,.048,navy);round(0,-.27,.048,.23,.17,.28,.045,dark);
      legs.push(limb);
      const arm=new T.Group();arm.position.set(.34*side,.88,0);g.add(arm);parent=arm;
      round(0,-.095,0,.18,.29,.19,.052,color);
      ball(0,-.26,0,.09,.11,.09,skin);arms.push(arm);
    }
    parent=scene;
    const a={g,body,legs,arms,path:[],walking:false};
    actors.push(a);return a;
  }
  const partyColors=[0xde7356,0x4d7fc3,0x6e9764,0xc481aa,0xf1a846,0x8b83c9,0x72aaa4,0x7f9cdb];
  const guests=partyColors.map((c,i)=>person(c,i%2?0x694332:0x4c3936));
  function chef(s=1){
    const g=new T.Group();g.scale.setScalar(s);scene.add(g);parent=g;
    shade(0,0,.52,.36);
    const b=new T.Group();g.add(b);parent=b;
    ball(0,.67,0,.63,.64,.52,blue);ball(0,.58,.27,.51,.46,.31,white);
    ball(-.163,.69,.531,.046,.060,.029,navy);ball(.163,.69,.531,.046,.060,.029,navy);
    ball(0,.53,.575,.061,.030,.022,0xa55245);
    ball(-.62,.62,0,.19,.16,.15,blue);ball(.62,.62,0,.19,.16,.15,blue);
    ball(-.22,.135,.21,.19,.12,.18,0x3871d6);ball(.22,.135,.21,.19,.12,.18,0x3871d6);
    round(0,1.24,.015,.68,.21,.52,.07,white);
    ball(-.235,1.42,.005,.245,.25,.235,white);
    ball(.23,1.42,.005,.245,.25,.235,white);
    ball(0,1.53,.018,.26,.265,.25,white);
    parent=scene;return {g,b};
  }
  const player={...chef(1.40),path:[],legs:[],arms:[]};
  actors.push(player);
  const apprentices=[chef(.76),chef(.76),chef(.76)];
  function dish(){
    const g=new T.Group();scene.add(g);parent=g;
    tube(0,.06,0,.34,.10,.34,white);tube(0,.115,0,.257,.04,.257,0xffdb94);
    const egg=new T.Group(), cheese=new T.Group();
    g.add(egg,cheese);
    parent=egg;
    for(let i=0;i<7;i++){const a=i*2.4;mesh(morsel,i%2?0xf0ae41:red,Math.cos(a)*.16,.16,Math.sin(a)*.16,.094,.063,.088);}
    parent=cheese;
    for(const [x,z] of [[-.12,-.09],[.12,-.09],[0,.12]]){
      tube(x,.15,z,.105,.062,.096,red);
      block(x,.193,z,.155,.033,.14,0xffdc67);
    }
    parent=g;
    g.userData.egg=egg;g.userData.cheese=cheese;cheese.visible=false;
    g.userData.garnish=mesh(morsel,0x69a740,.062,.235,-.052,.087,.024,.076);
    parent=scene;return g;
  }
  function dishStyle(plate,recipe,hasGarnish){
    plate.userData.egg.visible=recipe===0;
    plate.userData.cheese.visible=recipe===1;
    plate.userData.garnish.visible=hasGarnish;
  }
  const serving=dish(), samples=[dish(),dish(),dish()], tableDishes=tables.map(()=>dish());
  const steamMat=new T.MeshBasicMaterial({color:0xfff7e5,transparent:true,opacity:.48,depthWrite:false});
  const steam=[0,1,2].map(()=>ball(0,0,0,.085,.19,.08,steamMat));
  const p=new T.Vector3();
  const ground=new T.Plane(new T.Vector3(0,1,0),-.027), ray=new T.Raycaster();
  let aspect=1, width=1, height=1, desired={x:0,z:0,yaw:.22,zoom:1}, view={...desired}, slow=0, baseRatio=1, frameMean=16;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function resize(){
    const w=stage.clientWidth||innerWidth,h=stage.clientHeight||innerHeight;
    width=w;height=h;aspect=w/h;
    baseRatio=Math.min(devicePixelRatio||1,mobile?1.5:1.65,Math.sqrt((mobile?1150000:3400000)/(w*h)));
    renderer.setPixelRatio(Math.max(.7,baseRatio));
    renderer.setSize(w,h);
  }
  addEventListener('resize',resize);resize();
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function pose(actor,x,z,y=0,yaw=0,seated=false){
    actor.g.position.set(x,y,z);actor.g.rotation.y=yaw;actor.g.visible=true;actor.path.length=0;actor.seated=seated;actor.seat=null;
    actor.legs.forEach(l=>l.rotation.x=0);actor.arms.forEach(a=>a.rotation.x=0);
  }
  function blockPoint(x,z){return obstacles.some(([l,r,b,t])=>x>=l&&x<=r&&z>=b&&z<=t);}
  function clearSegment(x,z,endX,endZ){
    const dx=endX-x,dz=endZ-z;
    return !obstacles.some(([left,right,back,front])=>{
      if(Math.max(x,endX)<left||Math.min(x,endX)>right||
         Math.max(z,endZ)<back||Math.min(z,endZ)>front)return false;
      const tx=dx?[(left-x)/dx,(right-x)/dx]:[-Infinity,Infinity];
      const tz=dz?[(back-z)/dz,(front-z)/dz]:[-Infinity,Infinity];
      return Math.max(0,Math.min(...tx),Math.min(...tz))<=Math.min(1,Math.max(...tx),Math.max(...tz));
    });
  }
  function navPath(fromX,fromZ,toX,toZ){
    const step=.48, cols=49, rows=31, minX=-11.52,minZ=-7.20;
    const point=n=>[minX+(n%cols)*step,minZ+Math.floor(n/cols)*step];
    const nearest=(x,z,mustConnect)=>{
      let best=-1,d=Infinity;
      for(let i=0;i<cols*rows;i++){
        const [px,pz]=point(i), distance=(px-x)**2+(pz-z)**2;
        if(distance<d&&!blockPoint(px,pz)&&(!mustConnect||clearSegment(x,z,px,pz))){best=i;d=distance;}
      }
      return best;
    };
    const target=[clamp(toX,-11.5,11.5),clamp(toZ,-7.2,7.2)];
    if(clearSegment(fromX,fromZ,...target))return [target];
    const start=nearest(fromX,fromZ,true);
    const end=nearest(...target,!blockPoint(...target));
    if(start<0||end<0)return [];
    const back=new Int32Array(cols*rows).fill(-1);
    back[start]=start;const todo=[start];
    for(let head=0;head<todo.length&&back[end]<0;head++){
      const n=todo[head], x=n%cols,z=Math.floor(n/cols), cell=point(n);
      for(const k of [x>0?n-1:-1,x<cols-1?n+1:-1,z>0?n-cols:-1,z<rows-1?n+cols:-1]){
        if(k<0||back[k]>=0||!clearSegment(...cell,...point(k)))continue;
        back[k]=n;todo.push(k);
      }
    }
    if(back[end]<0)return [];
    const path=[];
    for(let n=end;n!==start;n=back[n])path.push(point(n));
    path.push(point(start));
    path.reverse();
    if(clearSegment(...path.at(-1),...target))path.push(target);
    const simple=[];
    let x=fromX,z=fromZ;
    for(let i=0;i<path.length;){
      let j=i+1;
      while(j<path.length&&clearSegment(x,z,...path[j]))j++;
      simple.push(path[j-1]);[x,z]=path[j-1];i=j;
    }
    return simple;
  }
  function move(x,z){player.path=navPath(player.g.position.x,player.g.position.z,x,z);}
  function steer(horizontal,vertical,dt){
    player.path.length=0;
    const length=Math.hypot(horizontal,vertical)||1;
    const x=horizontal/length, z=vertical/length;
    const c=Math.cos(view.yaw), s=Math.sin(view.yaw), speed=5.9;
    const dx=(x*c+z*s)*speed*dt, dz=(-x*s+z*c)*speed*dt;
    const p=player.g.position;
    const nextX=clamp(p.x+dx,-11.5,11.5), nextZ=clamp(p.z+dz,-7.08,7.16);
    if(clearSegment(p.x,p.z,nextX,p.z))p.x=nextX;
    if(clearSegment(p.x,p.z,p.x,nextZ))p.z=nextZ;
    player.g.rotation.y=Math.atan2(dx,dz);
  }
  function seatGuest(actor,target,seat){
    const p=actor.g.position;
    actor.path=navPath(p.x,p.z,...target);
    actor.seat=seat;
  }
  function actorTick(a,time,dt){
    if(!a.g.visible)return;
    const target=a.path[0];let moving=false;
    if(target){
      const dx=target[0]-a.g.position.x,dz=target[1]-a.g.position.z, d=Math.hypot(dx,dz);
      const step=Math.min(d,dt*6.2);
      const x=step===d?target[0]:a.g.position.x+dx*step/d;
      const z=step===d?target[1]:a.g.position.z+dz*step/d;
      if(clearSegment(a.g.position.x,a.g.position.z,x,z)){
        a.g.position.x=x;a.g.position.z=z;
        if(step===d)a.path.shift();
        moving=step>0;
        if(moving)a.g.rotation.y=Math.atan2(dx,dz);
      }else a.path.length=0;
    }
    if(a.seat&&!a.path.length)pose(a,...a.seat,.25,Math.PI/2,true);
    a.legs.forEach((l,i)=>l.rotation.x=moving?Math.sin(time*13+i*Math.PI)*.51:a.seated?-1.20:0);
    a.arms.forEach((l,i)=>l.rotation.x=moving?-Math.sin(time*13+i*Math.PI)*.45:0);
  }
  function screen(x,y,z){
    p.set(x,y,z).project(camera);
    return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,visible:Math.abs(p.x)<1.1&&Math.abs(p.y)<1.04};
  }
  function world(x,y,height=.027){
    ground.constant=-height;
    const rect=renderer.domElement.getBoundingClientRect();
    ray.setFromCamera({x:((x-rect.left)/rect.width)*2-1,y:1-((y-rect.top)/rect.height)*2},camera);
    const hit=ray.ray.intersectPlane(ground,new T.Vector3());
    if(!hit||Math.abs(hit.x)>12.2||Math.abs(hit.z)>7.9)return null;
    return hit;
  }
  function frame(time,dt){
    frameMean=frameMean*.96+Math.min(dt*1000,65)*.04;
    if(frameMean>25&&++slow>75&&renderer.getPixelRatio()>.8){
      renderer.setPixelRatio(Math.max(.75,renderer.getPixelRatio()*.84));slow=0;frameMean=19;
    }else if(frameMean<23)slow=0;
    const lerp=1-Math.exp(-dt*(reduced?14:3.05));
    for(const k of Object.keys(view))view[k]+=(desired[k]-view[k])*lerp;
    const angle=Math.PI*35/180, radius=32;
    camera.position.set(view.x+Math.sin(view.yaw)*Math.cos(angle)*radius,Math.sin(angle)*radius,view.z+Math.cos(view.yaw)*Math.cos(angle)*radius);
    camera.lookAt(view.x,0,view.z);
    const fit=Math.max(9.45,14.60/aspect)/view.zoom;
    const vertical=aspect<.85?fit*.13:-fit*.014;
    camera.left=-fit*aspect;camera.right=fit*aspect;camera.top=fit-vertical;camera.bottom=-fit-vertical;
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    actors.forEach(a=>actorTick(a,time,dt));
    [player,...apprentices].forEach((a,i)=>{a.b.position.y=reduced?0:(1+Math.sin(time*3.5+i))*.047});
    steam.forEach((a,i)=>{
      const phase=(time*.72+i/3)%1;
      a.position.set(-4.71+Math.sin(phase*7+i)*.16,1.73+phase*.93,-2.51-i*.07);
      a.scale.set(.08+phase*.08,.13+phase*.09,.085+phase*.06);
    });
    renderer.render(scene,camera);
  }
  function cooking(active){steam.forEach(p=>p.visible=active);}
  function lights(done,open,highlight){
    lamps.forEach((m,i)=>{
      m.color.setHex(i===highlight?0x87b5ff:done[i]?0xffcf63:0x827876);
      m.emissive.setHex(i===highlight?0x2b6cff:done[i]?0xffa82d:0x000000);m.emissiveIntensity=i===highlight?1.25:done[i]?.56:0;
    });
    signLamp.material=mat(open?0xffcf61:0x89765d);
  }
  function reset(){
    pose(player,-2.82,2.63,0,.25);
    guests.forEach(a=>{a.g.visible=false;a.path.length=0});
    [serving,...samples,...tableDishes].forEach(a=>a.visible=false);
    apprentices.forEach(a=>a.g.visible=false);
  }
  function prop(a,x,y,z){a.visible=true;a.position.set(x,y,z);}
  function stats(){return {triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,pixelRatio:renderer.getPixelRatio()};}
  reset();
  return {canvas:renderer.domElement,frame,desired,screen,world,move,steer,pose,seatGuest,prop,reset,lights,stats,dishStyle,cooking,
    tables,labelPoints,player,guests,apprentices,serving,samples,tableDishes,pass};
}
