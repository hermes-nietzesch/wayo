/* =====================================================================
   Wayo shooter client: step 1, the guns range.
   Everything you see, hear and press for the guns lives here. The rules
   themselves are in rules.js. Prop hunt never runs this code.
   ===================================================================== */
const SHOOTER = (() => {
  const R = window.WAYO_RULES, W = R.WEAPONS, BOTS = window.WAYO_BOTS;
  const el = s => document.querySelector(s);
  const S = { active:false, now:0, me:null, targets:[], trigger:false, pressed:false, ads:false, adsT:0, paused:false,
    pitchDebt:0, recoverDebt:0, vKick:0, vRoll:0, swing:0, bob:0, flashT:0, hitT:0, stats:null, last:'pistol', mode:'range', diff:'medium', bots:[], W:null, deadT:0, hurtT:0, vx:0, vz:0, stepPhase:0, stepSide:1, sprintT:0, land:0, wasGround:true, assists:0, br:null, squad:false, oneLife:false, items:[], fight:false, team:false, round:null, score:[0, 0], spec:null, ended:false, deadAge:0, stance:0, eyeDrop:0, crouchAt:0, crouchHeld:false, runWas:false, ladders:[], climb:null, boltAt:0, baseSens:1 };

  /* ---------------- first-person gun, drawn after the world so it never pokes through walls */
  const vmScene = new THREE.Scene(), vmCam = new THREE.PerspectiveCamera(46, 1, 0.01, 10), rig = new THREE.Group();
  rig.scale.setScalar(0.72);
  vmScene.add(rig, new THREE.HemisphereLight(0xf2f5ff, 0x5a4a3c, 0.8));
  const vmSun = new THREE.DirectionalLight(0xfff1dc, 1.5); vmSun.position.set(1, 2, 1.2); vmScene.add(vmSun);
  const mat = (c, r = 0.55, m = 0.5) => new THREE.MeshStandardMaterial({ color:new THREE.Color(c).convertSRGBToLinear(), roughness:r, metalness:m });
  const STEEL = mat(0x24262a, 0.42, 0.75), DARK = mat(0x121316, 0.6, 0.4), WOOD = mat(0x6a3d1e, 0.6, 0.05), PLASTIC = mat(0x1d2024, 0.75, 0.1), SKIN = mat(0x5b3a26, 0.75, 0), SLEEVE = mat(0x2c3138, 0.9, 0), BLADE = mat(0xc4cad0, 0.25, 0.9);
  function part(g, m, sx, sy, sz, x, y, z, rx = 0){ const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.rotation.x = rx; g.add(b); return b; }
  function tube(g, m, r, len, x, y, z){ const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m); b.rotation.x = Math.PI / 2; b.position.set(x, y, z); g.add(b); return b; }
  function arm(g, x, y, z, ry = 0){ const a = new THREE.Group(); part(a, SKIN, 0.085, 0.085, 0.1, 0, 0, 0); part(a, SLEEVE, 0.095, 0.095, 0.42, 0, -0.03, 0.25, 0.15); a.position.set(x, y, z); a.rotation.y = ry; g.add(a); return a; }
  const GUNS = {
    pistol(g){ part(g, STEEL, 0.04, 0.05, 0.24, 0, 0.03, -0.1); part(g, PLASTIC, 0.036, 0.13, 0.065, 0, -0.06, 0.0, 0.2); part(g, DARK, 0.042, 0.02, 0.08, 0, -0.005, -0.1); g.userData.tip = -0.23; arm(g, 0, -0.1, 0.04); arm(g, -0.05, -0.1, 0.06, 0.35); },
    smg(g){ part(g, STEEL, 0.05, 0.07, 0.34, 0, 0.02, -0.12); tube(g, DARK, 0.012, 0.12, 0, 0.03, -0.35); part(g, DARK, 0.03, 0.2, 0.05, 0, -0.1, -0.13); part(g, PLASTIC, 0.04, 0.12, 0.055, 0, -0.07, 0.03, 0.25); part(g, DARK, 0.02, 0.02, 0.2, 0, 0.0, 0.14); g.userData.tip = -0.41; arm(g, 0, -0.11, 0.05); arm(g, -0.015, -0.03, -0.2, 0.3); },
    rifle(g){ part(g, STEEL, 0.05, 0.075, 0.42, 0, 0.02, -0.08); part(g, WOOD, 0.055, 0.06, 0.24, 0, 0.0, -0.38); tube(g, DARK, 0.012, 0.3, 0, 0.038, -0.6); part(g, WOOD, 0.045, 0.095, 0.24, 0, -0.015, 0.23, 0.12); const m = part(g, DARK, 0.035, 0.2, 0.08, 0, -0.1, -0.19, -0.3); m.position.y = -0.11; part(g, PLASTIC, 0.04, 0.11, 0.055, 0, -0.07, 0.07, 0.25); part(g, DARK, 0.012, 0.03, 0.012, 0, 0.075, -0.48); g.userData.tip = -0.76; arm(g, 0, -0.11, 0.09); arm(g, -0.015, -0.035, -0.38, 0.3); },
    shotgun(g){ tube(g, STEEL, 0.02, 0.62, 0, 0.04, -0.34); tube(g, DARK, 0.017, 0.46, 0, -0.005, -0.26); part(g, STEEL, 0.05, 0.08, 0.24, 0, 0.02, 0.0); part(g, WOOD, 0.056, 0.05, 0.16, 0, -0.01, -0.36); part(g, WOOD, 0.045, 0.1, 0.28, 0, -0.03, 0.25, 0.18); g.userData.tip = -0.66; arm(g, 0, -0.1, 0.12); arm(g, -0.015, -0.05, -0.36, 0.3); },
    sniper(g){ part(g, WOOD, 0.05, 0.07, 0.62, 0, -0.005, -0.05); part(g, WOOD, 0.045, 0.1, 0.22, 0, -0.03, 0.33, 0.14); tube(g, DARK, 0.011, 0.5, 0, 0.04, -0.6); tube(g, STEEL, 0.024, 0.3, 0, 0.098, -0.1); part(g, DARK, 0.018, 0.03, 0.05, 0, 0.065, -0.2); part(g, DARK, 0.018, 0.03, 0.05, 0, 0.065, 0.0); part(g, STEEL, 0.012, 0.012, 0.05, 0.035, 0.04, 0.07); g.userData.tip = -0.86; arm(g, 0, -0.1, 0.13); arm(g, -0.015, -0.05, -0.32, 0.3); },
    knife(g){ const b = part(g, BLADE, 0.012, 0.04, 0.24, 0, 0.0, -0.17); b.scale.y = 0.9; part(g, DARK, 0.036, 0.05, 0.03, 0, -0.002, -0.04); part(g, PLASTIC, 0.03, 0.04, 0.13, 0, -0.002, 0.04); g.userData.tip = -0.3; arm(g, 0, -0.03, 0.05); },
  };
  /* real gun models (CC0, 3DModelsCC0). grip says where the hand goes on each model; sight is how high the iron sights sit above it. */
  const FIT = { rifle:{ grip:[0, -0.115, 0.284], sight:0.083 }, smg:{ grip:[0, -0.11, 0.17], sight:0.09 }, pistol:{ grip:[0, -0.015, 0.015], sight:0.062, trim:0.06 }, shotgun:{ grip:[0, -0.085, 0.43], sight:0.082 }, sniper:{ grip:[0, -0.07, 0.23], sight:0.1, tilt:-0.214 } };
  /* how each gun is held and aimed. palm and fore: where the right and left hands close, measured from the grip with the muzzle towards -z.
     rear and front: [height, distance] of the two sights, which get lined up on the middle of the screen. relief: how far the rear sight sits from your eye. */
  const HOLD = {
    rifle:{ palm:[0, 0.035, 0.005], fore:[0, 0.045, -0.3], mag:[0, -0.11, -0.15], magS:[0.035, 0.16, 0.08], rear:[0.155, -0.194], front:[0.157, -0.569], relief:0.5, hip:[0.15, -0.18, -0.36] },
    smg:{ palm:[0, 0.01, -0.005], fore:[0, 0.03, -0.26], mag:[0, -0.1, -0.09], magS:[0.03, 0.15, 0.05], rear:[0.19, -0.02], front:[0.19, -0.3], relief:0.34, hip:[0.15, -0.16, -0.36], built:true },
    pistol:{ palm:[0, -0.01, 0], fore:[-0.025, -0.075, 0.015], mag:[0, -0.1, 0.02], magS:[0.024, 0.1, 0.04], rear:[0.075, 0], front:[0.074, -0.14], relief:0.5, hip:[0.13, -0.13, -0.44], elbowR:[0.3, -0.88, 0.36], elbowL:[-0.4, -0.86, 0.3] },
    shotgun:{ palm:[0, 0.065, 0.02], fore:[0, -0.005, -0.48], mag:[0, -0.05, -0.2], magS:[0.024, 0.024, 0.065], shells:true, rear:[0.134, -0.133], front:[0.134, -0.807], relief:0.46, hip:[0.15, -0.19, -0.34], clearAim:true },
    sniper:{ palm:[0, -0.005, 0.04], fore:[0, -0.03, -0.25], mag:[0, -0.07, -0.12], magS:[0.03, 0.09, 0.07], rear:[0.096, 0.087], front:[0.096, -0.14], relief:0.3, hip:[0.15, -0.17, -0.36] },
    knife:{ palm:[0, 0, 0.04], rear:[0, 0], front:[0, -1], relief:0.3, hip:[0.17, -0.12, -0.36], oneHand:true },
  };
  const MODEL = {};
  function modelFor(id){   // a copy of the gun with the hand at the origin and the muzzle towards -z
    const src = MODEL[id]; if (!src) return null;
    const g = new THREE.Group(), m = src.root.clone(true), F = FIT[id];
    m.position.sub(_v.set(F.grip[0], F.grip[1], F.grip[2])); if (F.tilt){ const w = new THREE.Group(); w.rotation.x = F.tilt; w.add(m); g.add(w); } else g.add(m);
    g.userData.tip = src.tip; return g;
  }
  function useModel(id){
    const old = GM[id], m = modelFor(id); if (!old || !m) return;
    for (const c of [...old.children]) old.remove(c);        // drop the box gun and box arms, real arms come with the character models
    old.add(m); old.userData.tip = m.userData.tip; old.userData.real = true;
    const H = HOLD[id]; if (id === 'sniper') return;   // the sniper aims through its scope
    // a small glowing dot on the front sight, so the point you aim with is easy to find on any background
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 10, 8), new THREE.MeshBasicMaterial({ color:0xff2a1a, fog:false })); dot.position.set(0, H.front[0], H.front[1]); old.add(dot);
    if (H.built){   // this gun came with no sights, so it gets a ring at the back and a post at the front
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.002, 6, 18), STEEL); ring.position.set(0, H.rear[0], H.rear[1]); old.add(ring);
      part(old, STEEL, 0.006, 0.02, 0.012, 0, H.rear[0] - 0.021, H.rear[1]); part(old, STEEL, 0.004, 0.02, 0.006, 0, H.front[0] - 0.012, H.front[1]);
    }
  }
  function loadGunModels(){
    { const K = GM.knife; K.remove(K.children[K.children.length - 1]); K.userData.real = true; }   // the knife keeps its blade, and your own hand takes the place of the box arm
    const gl = new THREE.GLTFLoader(); if (window.MeshoptDecoder) gl.setMeshoptDecoder(MeshoptDecoder);
    for (const id in FIT) gl.load(`guns/${id}.glb`, g => {
      if (typeof lightenModel === 'function') lightenModel(g.scene, 512);
      const F = FIT[id], root = g.scene; root.updateMatrixWorld(true);
      if (F.trim) root.traverse(o => {   // the model has a spare magazine beside the gun, joined into the same mesh, so its triangles get cut out
        if (!o.isMesh) return;
        const G = o.geometry, pos = G.attributes.position, idx = G.index.array, keep = [], z = i => _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).z;
        for (let i = 0; i < idx.length; i += 3) if (z(idx[i]) <= F.trim || z(idx[i + 1]) <= F.trim || z(idx[i + 2]) <= F.trim) keep.push(idx[i], idx[i + 1], idx[i + 2]);
        G.setIndex(keep);
      });
      root.traverse(o => { if (o.isMesh){ o.material.envMapIntensity = 1.1; o.castShadow = false; o.frustumCulled = false; } });
      const b = new THREE.Box3().setFromObject(root);
      MODEL[id] = { root, tip:(b.min.z - F.grip[2]) * Math.cos(F.tilt || 0) }; useModel(id);
    }, undefined, () => {});
  }
  /* ---------------- your own arms: the arms of your character, cut from the body and bent round whichever gun you hold */
  const ARMS = { name:null, root:null, L:null, R:null, b:{}, q:{}, id:null };
  const WANT_R = /^(RightForeArm|RightHand.*)$/, WANT_L = /^(LeftForeArm|LeftHand.*)$/;
  function buildArms(name){
    if (ARMS.name === name) return;
    if (ARMS.root) rig.remove(ARMS.root);
    const C = GAME.S.chars[name], root = THREE.SkeletonUtils.clone(GAME.S.armScenes[name] || C.root); let skin = null;
    root.traverse(o => { if (o.isSkinnedMesh) skin = o; });
    const bones = skin.skeleton.bones, names = bones.map(b => norm(b.name)), G = skin.geometry, J = G.attributes.skinIndex, W4 = G.attributes.skinWeight, idx = G.index.array;
    const armMat = skin.material.clone(); armMat.color.setScalar(0.7); armMat.envMapIntensity = 0.35; armMat.roughness = 0.75; armMat.metalness = 0;   // the arms sit right against the lamp of the gun scene
    const part1 = re => {   // keep only triangles that belong wholly to this arm
      const ok = new Uint8Array(J.count), out = [];
      for (let v = 0; v < J.count; v++){ let w = 0; for (let k = 0; k < 4; k++){ const c = 'XYZW'[k]; if (re.test(names[J['get' + c](v)] || '')) w += W4['get' + c](v); } ok[v] = w > 0.85 ? 1 : 0; }
      for (let i = 0; i < idx.length; i += 3) if (ok[idx[i]] && ok[idx[i + 1]] && ok[idx[i + 2]]) out.push(idx[i], idx[i + 1], idx[i + 2]);
      const g = G.clone(); g.setIndex(out); const m = new THREE.SkinnedMesh(g, armMat); m.bind(skin.skeleton, skin.bindMatrix); m.frustumCulled = false; skin.parent.add(m); return m;
    };
    ARMS.R = part1(WANT_R); ARMS.L = part1(WANT_L); skin.parent.remove(skin);
    root.scale.setScalar(C.scale * (ROSTER.find(c => c.id === name).armS || 1)); root.rotation.y = Math.PI; rig.add(root);   // the biggest fighters' arms are slimmed a little so they don't hide the gun
    ARMS.root = root; ARMS.name = name; ARMS.id = null; ARMS.b = {};
    root.traverse(o => { if (o.isBone) ARMS.b[norm(o.name)] = o; });
    // the rifle idle gives a natural hold: note how each hand sits against the gun, then put the same hold on every gun
    const rest = {}; root.updateMatrixWorld(true);
    for (const sd of ['Right', 'Left']){ const h = ARMS.b[sd + 'Hand'], at = h.getWorldPosition(new THREE.Vector3()), f = ARMS.b[sd + 'ForeArm'].getWorldPosition(new THREE.Vector3()); rest[sd] = h.worldToLocal(at.clone().add(at.clone().sub(f).setLength(0.028))); }
    const clips = GAME.S.rifle[name], mx = new THREE.AnimationMixer(root); mx.clipAction(clips.Idle).play(); mx.update(0);
    for (const t of clips.Grip.tracks){ const bone = root.getObjectByName(t.name.slice(0, t.name.lastIndexOf('.'))); if (bone) bone.quaternion.fromArray(t.values); }
    const saved = [rig.position.clone(), rig.rotation.clone()]; rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); root.position.set(0, 0, 0); rig.updateMatrixWorld(true);
    const B = ARMS.b, wp = o => o.getWorldPosition(new THREE.Vector3()), wq = o => o.getWorldQuaternion(new THREE.Quaternion());
    const rh = wp(B.RightHand), lh = wp(B.LeftHand), z = rh.clone().sub(lh).normalize(), x = new THREE.Vector3(0, 1, 0).cross(z).normalize(), y = z.clone().cross(x);
    const gun = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)), inv = gun.clone().invert(), Q = ARMS.q;
    const palm = sd => {   // heroes rigged with few or no finger bones: the palm lies down the hand's own line, as it was in the T pose
      const h = wp(B[sd + 'Hand']), f = B[sd + 'HandMiddle1'] || B[sd + 'HandIndex1'];
      return f ? wp(f).lerp(h, 0.25) : B[sd + 'Hand'].localToWorld(rest[sd].clone());
    };
    for (const sd of ['Right', 'Left']){
      const hand = B[sd + 'Hand'], fore = B[sd + 'ForeArm'], up = B[sd + 'Arm'];
      Q[sd] = { hand:inv.clone().multiply(wq(hand)), wrist:wp(hand).sub(palm(sd)).applyQuaternion(inv), foreToHand:wq(fore).invert().multiply(wq(hand)), upQ:inv.clone().multiply(wq(up)), lf:wp(fore).distanceTo(wp(hand)), lu:wp(up).distanceTo(wp(fore)) };
    }
    Q.mixer = mx; mx.stopAllAction(); mx.uncacheRoot(root);
    rig.position.copy(saved[0]); rig.rotation.copy(saved[1]);
  }
  const _s = new THREE.Vector3(), _t = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3(), _k = new THREE.Quaternion(), _l = new THREE.Quaternion(), _pp = new THREE.Quaternion();
  function placeBone(b, pos, q){
    if (pos){ _s.copy(pos); b.parent.worldToLocal(_s); b.position.copy(_s); }
    b.parent.getWorldQuaternion(_pp).invert(); b.quaternion.copy(_pp).multiply(q); b.updateMatrixWorld(true);
  }
  // swing a bone's rotation so its length (+y) runs from one point to another
  function along(q, dir){ _u.set(0, 1, 0).applyQuaternion(q); _k.setFromUnitVectors(_u, dir); return _l.copy(_k).multiply(q).clone(); }
  function poseArm(sd, at, elbowDir){
    const Q = ARMS.q[sd], B = ARMS.b, wrist = new THREE.Vector3().copy(Q.wrist).add(at), elbow = wrist.clone().addScaledVector(elbowDir, Q.lf), back = _w.set(sd === 'Right' ? 0.3 : -0.3, -0.25, 0.92).normalize().clone(), sh = elbow.clone().addScaledVector(back, Q.lu);
    placeBone(B[sd + 'Arm'], sh, along(Q.upQ, _t.copy(elbow).sub(sh).normalize()));
    placeBone(B[sd + 'ForeArm'], null, along(Q.hand.clone().multiply(Q.foreToHand.clone().invert()), _t.copy(wrist).sub(elbow).normalize()));
    B[sd + 'ForeArm'].position.copy(B[sd + 'Arm'].worldToLocal(elbow.clone())); B[sd + 'ForeArm'].updateMatrixWorld(true);
    placeBone(B[sd + 'Hand'], wrist, Q.hand);
  }
  function fitArms(id){
    if (!ARMS.root || ARMS.id === id) return;
    ARMS.id = id;
    const H = HOLD[id], px = rig.position.clone(), rx = rig.rotation.clone(); rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.updateMatrixWorld(true);
    poseArm('Right', new THREE.Vector3(...H.palm), H.elbowR ? new THREE.Vector3(...H.elbowR).normalize() : new THREE.Vector3(0.35, -0.85, 0.4).normalize());
    ARMS.L.visible = !H.oneHand;
    if (!H.oneHand) poseArm('Left', new THREE.Vector3(...H.fore), new THREE.Vector3(...(H.elbowL || [-0.25, -0.9, 0.35])).normalize());
    rig.position.copy(px); rig.rotation.copy(rx);
  }
  /* ---------------- reloading in first person: the left hand leaves the gun, fetches a new magazine and seats it. Times are fractions of the reload. */
  const POUCH = [-0.1, -0.3, 0.06], SHELLS = [-0.1, -0.24, -0.06];
  const SPARE = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color:0x1b1c1f, roughness:0.55, metalness:0.5 }));
  SPARE.visible = false; rig.add(SPARE);
  const relPath = H => H.shells
    ? [[0, H.fore], [0.13, H.mag], [0.23, SHELLS], [0.33, H.mag], [0.43, SHELLS], [0.53, H.mag], [0.63, SHELLS], [0.73, H.mag], [0.84, H.fore], [0.92, [H.fore[0], H.fore[1], H.fore[2] + 0.1]], [1, H.fore]]
    : [[0, H.fore], [0.2, H.mag], [0.42, POUCH], [0.54, POUCH], [0.76, H.mag], [1, H.fore]];
  const magOut = () => { click(0.12, 900); thump(0.06, 170, 0.05); }, magIn = () => { click(0.2, 1300); thump(0.12, 125, 0.07); }, bolt = () => { click(0.18, 2400); blast(0.08, 0.05, 1500, 2); }, shell = () => { click(0.13, 1900); thump(0.05, 210, 0.04); };
  const relSounds = H => H.shells ? [[0.13, shell], [0.33, shell], [0.53, shell], [0.73, shell], [0.88, bolt], [0.96, bolt]] : [[0.2, magOut], [0.74, magIn], [0.9, bolt]];
  const smooth = t => t * t * (3 - 2 * t), _rp = new THREE.Vector3(), _elb = new THREE.Vector3();
  function poseReload(t, H){
    const P = relPath(H); let i = 0; while (i < P.length - 2 && t > P[i + 1][0]) i++;
    const a = P[i], b = P[i + 1], u = smooth(Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0]))));
    _rp.set(a[1][0] + (b[1][0] - a[1][0]) * u, a[1][1] + (b[1][1] - a[1][1]) * u, a[1][2] + (b[1][2] - a[1][2]) * u);
    const px = rig.position.clone(), rx = rig.rotation.clone(); rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.updateMatrixWorld(true);
    poseArm('Left', _rp, _elb.set(...(H.elbowL || [-0.25, -0.9, 0.35])).normalize());
    rig.position.copy(px); rig.rotation.copy(rx);
    const show = H.shells ? _rp.y < -0.06 || t < 0.73 && t > 0.13 : t > 0.46 && t < 0.75;   // a fresh magazine, or a shell, comes up in the hand
    SPARE.visible = show; if (show){ SPARE.scale.set(...H.magS); SPARE.position.copy(_rp); SPARE.position.y += H.shells ? 0.03 : -0.02; }
  }
  const GM = {};
  for (const id in GUNS){ const g = new THREE.Group(); GUNS[id](g); g.visible = false; rig.add(g); GM[id] = g; }
  function glowTex(inner, outer){ const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 1, 32, 32, 31); r.addColorStop(0, inner); r.addColorStop(0.35, outer); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
  const FLASH = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex('#fff8dc', 'rgba(255,170,60,.85)'), blending:THREE.AdditiveBlending, depthWrite:false, depthTest:false, transparent:true }));
  FLASH.visible = false; rig.add(FLASH);

  /* ---------------- world effects: tracers, bullet marks and dust, all from small pools */
  const FX = { tr:[], mark:[], puff:[], ti:0, mi:0, pi:0 };
  const trM = new THREE.MeshBasicMaterial({ color:0xffd48a, transparent:true, opacity:0.75, blending:THREE.AdditiveBlending, depthWrite:false, fog:false });
  const trG = new THREE.BoxGeometry(0.014, 0.014, 1), mkG = new THREE.CircleGeometry(0.045, 8), mkM = new THREE.MeshBasicMaterial({ color:0x17120e, transparent:true, opacity:0.85, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2 });
  const dust = glowTex('rgba(205,190,170,.75)', 'rgba(170,150,130,.4)'), blood = glowTex('rgba(150,20,16,.9)', 'rgba(110,12,10,.55)');
  function makeFx(){
    if (FX.tr.length) return;
    for (let i = 0; i < 20; i++){ const m = new THREE.Mesh(trG, trM); m.visible = false; m.frustumCulled = false; scene.add(m); FX.tr.push({ m, life:0 }); }
    for (let i = 0; i < 48; i++){ const m = new THREE.Mesh(mkG, mkM); m.visible = false; scene.add(m); FX.mark.push(m); }
    for (let i = 0; i < 16; i++){ const m = new THREE.Sprite(new THREE.SpriteMaterial({ map:dust, transparent:true, depthWrite:false })); m.visible = false; scene.add(m); FX.puff.push({ m, life:0 }); }
  }
  const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  function tracer(ax, ay, az, bx, by, bz){
    const t = FX.tr[FX.ti++ % FX.tr.length], len = Math.hypot(bx - ax, by - ay, bz - az); if (len < 3) return;
    t.a = [ax, ay, az]; t.d = [(bx - ax) / len, (by - ay) / len, (bz - az) / len]; t.len = len; t.s = 0; t.life = 1;
    t.m.visible = true; t.m.position.set(ax, ay, az); t.m.lookAt(bx, by, bz);
  }
  function impact(x, y, z, o, onBody){
    if (!onBody){ const m = FX.mark[FX.mi++ % FX.mark.length]; m.position.set(x, y, z); m.lookAt(o[0], o[1], o[2]); m.translateZ(0.015); m.visible = true; }
    const p = FX.puff[FX.pi++ % FX.puff.length]; p.m.material.map = onBody ? blood : dust; p.m.position.set(x, y, z); p.m.scale.setScalar(0.12); p.m.material.opacity = 0.9; p.m.visible = true; p.life = 1;
  }
  function tickFx(dt){
    for (const t of FX.tr){ if (t.life <= 0) continue; t.s += 240 * dt; const seg = Math.min(7, t.s), mid = t.s - seg / 2; if (t.s - seg >= t.len){ t.life = 0; t.m.visible = false; continue; } t.m.position.set(t.a[0] + t.d[0] * mid, t.a[1] + t.d[1] * mid, t.a[2] + t.d[2] * mid); t.m.scale.z = seg; }
    for (const p of FX.puff){ if (p.life <= 0) continue; p.life -= dt * 3; p.m.scale.setScalar(0.12 + (1 - p.life) * 0.5); p.m.position.y += dt * 0.5; p.m.material.opacity = Math.max(0, p.life) * 0.9; if (p.life <= 0) p.m.visible = false; }
  }

  /* ---------------- sound: real recorded gunshots from audio/guns, with small changes so repeat shots differ.
     The knife, clicks and reload noises are still made in the browser. */
  let AC = null;
  function audio(){ if (!AC){ try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function noise(dur){ const b = AC.createBuffer(1, Math.max(1, AC.sampleRate * dur), AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); return b; }
  function blast(vol, dur, freq, q = 0.8){ const A = audio(); if (!A || A.state !== 'running') return; const s = A.createBufferSource(), f = A.createBiquadFilter(), g = A.createGain(), t = A.currentTime; s.buffer = noise(dur); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.15), t + dur); f.Q.value = q; g.gain.value = vol; s.connect(f).connect(g).connect(A.destination); s.start(t); }
  function thump(vol, f0, dur){ const A = audio(); if (!A || A.state !== 'running') return; const o = A.createOscillator(), g = A.createGain(), t = A.currentTime; o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(40, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(A.destination); o.start(t); o.stop(t + dur); }
  const BANG = { pistol:[0.55, 0.16, 4200, 160], smg:[0.42, 0.1, 5200, 190], rifle:[0.6, 0.2, 3600, 130], shotgun:[0.85, 0.32, 2400, 95] };
  const SHOTS = { pistol:{ n:2, gain:0.85 }, smg:{ n:5, gain:0.72 }, rifle:{ n:4, gain:0.9 }, shotgun:{ n:4, gain:1 }, sniper:{ n:4, gain:1 } };
  const BUF = {}, lastTake = {}; let limiter = null, soundsLoading = false;
  function loadShots(){
    const A = audio(); if (!A || soundsLoading) return; soundsLoading = true;
    limiter = A.createDynamicsCompressor(); limiter.threshold.value = -6; limiter.ratio.value = 12; limiter.attack.value = 0.002; limiter.release.value = 0.12; limiter.connect(A.destination);
    for (const id in SHOTS){
      BUF[id] = [];
      for (let i = 1; i <= SHOTS[id].n; i++) fetch(`audio/guns/${id}${i}.mp3`).then(r => r.arrayBuffer()).then(b => A.decodeAudioData(b)).then(d => BUF[id].push(d)).catch(() => {});
    }
  }
  // dist is in metres: far shots get quieter and lose their top end, ready for bots firing across the market
  function bang(id, dist = 0){
    const list = BUF[id], A = AC; if (A && A.state !== 'running') return;   // sounds can't finish while audio is suspended, so don't pile them up
    if (!list || !list.length || !A){ const b = BANG[id]; if (b){ blast(b[0], b[1], b[2]); thump(b[0] * 0.8, b[3], b[1] * 1.2); } else blast(0.12, 0.12, 2800, 2); return; }
    let k = Math.floor(Math.random() * list.length); if (list.length > 1 && k === lastTake[id]) k = (k + 1) % list.length; lastTake[id] = k;
    const src = A.createBufferSource(), g = A.createGain(), lp = A.createBiquadFilter();
    src.buffer = list[k]; src.playbackRate.value = 0.97 + Math.random() * 0.06;
    lp.type = 'lowpass'; lp.frequency.value = dist > 0 ? Math.max(900, 14000 / (1 + dist / 12)) : 20000;
    g.gain.value = SHOTS[id].gain * (0.92 + Math.random() * 0.08) / (1 + dist / 14);
    src.connect(lp).connect(g).connect(limiter); src.start();
  }
  const click = (v = 0.18, f = 3000) => blast(v, 0.03, f, 3);
  const slash = () => { blast(0.13, 0.13, 1900, 1.1); blast(0.07, 0.09, 3400, 1.4); };   // the blade cutting air
  function footstep(run, vol = 1){ blast((run ? 0.11 : 0.07) * vol, 0.06, run ? 900 : 650, 0.9); thump((run ? 0.09 : 0.05) * vol, 95, 0.06); }

  /* ---------------- first or third person, kept for next time */
  const VIEW_KEY = 'wayo-view';
  function savedView(){ try { return localStorage.getItem(VIEW_KEY) === 'tp' ? 'tp' : 'fp'; } catch (e) { return 'fp'; } }
  function setView(v){ S.view = v === 'tp' ? 'tp' : 'fp'; try { localStorage.setItem(VIEW_KEY, S.view); } catch (e) {} const b = el('#shView'); if (b) b.setAttribute('aria-pressed', String(S.view === 'tp')); const i = el('#viewIn'); if (i) i.value = S.view; }
  const BOOM = { back:2.9, side:0.6, up:0.32 };
  // the over-the-shoulder camera. Aiming pulls you into first person and through the sights, the way PUBG does it.
  function placeCam(dt){
    const f = S.me, want = S.view === 'tp' && !S.spec ? Math.max(0, 1 - S.adsT * 1.5) : 0; S.tpT = (S.tpT || 0) + (want - (S.tpT || 0)) * Math.min(1, dt * 13);
    if (S.tpT < 0.01){ S.camBack = 0; return; }
    const t = S.tpT, ex = camera.position.x, ey = camera.position.y, ez = camera.position.z;
    camera.getWorldDirection(_a); _b.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const dx = -_a.x * BOOM.back + _b.x * BOOM.side, dy = -_a.y * BOOM.back + BOOM.up, dz = -_a.z * BOOM.back + _b.z * BOOM.side, len = Math.hypot(dx, dy, dz), u = [dx / len, dy / len, dz / len];
    const far = Math.max(0.3, Math.min(len, R.rayWorld([ex, ey, ez], u, len, near) - 0.2)) * t;
    camera.position.set(ex + u[0] * far, ey + u[1] * far, ez + u[2] * far); S.camBack = far;
  }
  // your body, seen from behind in third person
  function tickMe(dt){
    const f = S.me, A = f.A; if (!A) return;
    const show = S.tpT > 0.5 || !!S.spec; A.root.visible = show;
    if (!f.alive){ if (f.fall) tickFall(f, dt); return; }
    f.x = P.x; f.y = P.y; f.z = P.z; f.vx = S.vx; f.vz = S.vz; f.speed = Math.hypot(S.vx, S.vz); f.stance = S.stance; f.aimYaw = P.yaw + Math.PI; f.ry = f.aimYaw; f.aimPitch = P.pitch;
    A.root.position.set(f.x, f.y, f.z); A.root.rotation.set(0, f.aimYaw, 0);
    if (A.gearId !== f.weapon){ regear(f); A.gearId = f.weapon; }
    if (!show) return;
    animBody(f, dt); A.root.updateMatrixWorld(true); aimPose(f);
    const fl = A.gun.userData.fl; if (A.flashT > 0){ A.flashT -= dt; fl.visible = true; } else fl.visible = false;
  }

  /* ---------------- on-screen display */
  function buildHud(){
    if (el('#shHud')) return;
    const css = document.createElement('style');
    css.textContent = `
body.sh-on #cross,body.sh-on #gbtns{display:none!important}
#shHud{position:fixed;inset:0;z-index:5;pointer-events:none;font:700 14px/1.2 var(--body)}
#shX{position:absolute;left:50%;top:50%;width:0;height:0}
#shX i{position:absolute;background:#fff;box-shadow:0 0 2px #000}
#shX .u,#shX .d{width:2px;height:9px;left:-1px}#shX .l,#shX .r{height:2px;width:9px;top:-1px}
#shX.knife i{display:none}
#shHit{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px;opacity:0;transform:rotate(45deg)}
#shHit:before,#shHit:after{content:"";position:absolute;background:#fff;box-shadow:0 0 2px #000}
#shHit:before{left:12px;top:0;bottom:0;width:2px;background:linear-gradient(#fff 0 35%,transparent 35% 65%,#fff 65%)}
#shHit:after{top:12px;left:0;right:0;height:2px;background:linear-gradient(90deg,#fff 0 35%,transparent 35% 65%,#fff 65%)}
#shHit.head:before{background:linear-gradient(#ff3b2f 0 35%,transparent 35% 65%,#ff3b2f 65%)}#shHit.head:after{background:linear-gradient(90deg,#ff3b2f 0 35%,transparent 35% 65%,#ff3b2f 65%)}
#shAmmo{position:absolute;right:calc(env(safe-area-inset-right,0px) + 24px);bottom:calc(env(safe-area-inset-bottom,0px) + 20px);text-align:right;text-shadow:0 1px 3px #000}
#shAmmo b{display:block;font:400 42px/1 var(--display);font-variant-numeric:tabular-nums}#shAmmo b small{font:700 17px/1 var(--body);color:var(--muted)}
#shAmmo span{color:var(--accent);letter-spacing:.06em;text-transform:uppercase;font-size:13px}#shAmmo.low b{color:var(--accent)}
#shSlots{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);transform:translateX(-50%);display:flex;gap:6px;pointer-events:auto}
#shSlots button{min-width:62px;height:46px;border-radius:7px;background:rgba(8,8,11,.6);border:1.5px solid var(--line);color:var(--muted);font:700 11px/1.1 var(--body);padding:3px 6px;touch-action:none}
#shSlots button[aria-pressed="true"]{border-color:var(--accent);color:#fff;background:rgba(225,32,26,.5)}#shSlots kbd{display:block;font:700 10px/1 var(--body);opacity:.7;margin-bottom:3px}
#shStats{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);transform:translateX(-50%);background:rgba(8,8,11,.55);padding:6px 12px;border-radius:7px;color:var(--muted);white-space:nowrap;font-size:12px}#shStats b{color:#fff}
#shReload{position:absolute;left:50%;top:calc(50% + 34px);transform:translateX(-50%);width:90px;height:4px;background:rgba(0,0,0,.5);border-radius:2px;overflow:hidden}#shReload i{display:block;height:100%;background:var(--accent);width:0}
#shFloat span{position:absolute;font:400 18px/1 var(--display);color:#fff;text-shadow:0 1px 3px #000;transform:translate(-50%,-50%);transition:transform .55s ease-out,opacity .55s ease-in}
#shFloat span.head{color:#ff3b2f;font-size:23px}
#shPause{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;pointer-events:auto;z-index:2}
#shPause div{text-align:center}#shPause h2{font:400 28px/1 var(--display);margin:0 0 14px}#shPause button,#shExit{background:rgba(8,8,11,.75);border:1.5px solid var(--line);color:#fff;border-radius:7px;padding:11px 18px;font:700 14px/1 var(--body);margin:0 5px;cursor:pointer}#shPause button.go{background:var(--red);border-color:var(--red)}
#shCrouch{width:46px;height:46px;right:calc(env(safe-area-inset-right,0px) + 170px);bottom:calc(env(safe-area-inset-bottom,0px) + 48px)}#shCrouch[aria-pressed="true"]{background:rgba(225,32,26,.55)}
#shStance{display:block;font:700 12px/1 var(--body);letter-spacing:.08em;color:#fff;margin-bottom:5px;text-transform:uppercase}
#shExit{position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:calc(env(safe-area-inset-right,0px) + 122px);pointer-events:auto;padding:5px 9px;font-size:11px;background:rgba(0,0,0,.25);border-color:rgba(255,255,255,.3)}
#shTouch{position:absolute;inset:0;pointer-events:none}
#shTouch button{position:absolute;pointer-events:auto;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.22);border:1.5px solid rgba(255,255,255,.38);color:rgba(255,255,255,.9);touch-action:none;-webkit-user-select:none;user-select:none}
#shTouch button svg{width:56%;height:56%;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
#shFire{width:78px;height:78px;right:calc(env(safe-area-inset-right,0px) + 26px);bottom:calc(env(safe-area-inset-bottom,0px) + 84px);background:rgba(225,32,26,.3)!important;border-color:rgba(255,90,80,.7)!important}
#shFireL{width:48px;height:48px;left:calc(env(safe-area-inset-left,0px) + 26px);bottom:calc(env(safe-area-inset-bottom,0px) + 158px);background:rgba(225,32,26,.2)!important;border-color:rgba(255,90,80,.5)!important}
#shAim{width:50px;height:50px;right:calc(env(safe-area-inset-right,0px) + 114px);bottom:calc(env(safe-area-inset-bottom,0px) + 118px)}#shAim[aria-pressed="true"]{background:rgba(225,32,26,.55)}
#shRel{width:42px;height:42px;right:calc(env(safe-area-inset-right,0px) + 44px);bottom:calc(env(safe-area-inset-bottom,0px) + 172px)}
#shView{width:40px;height:40px;right:calc(env(safe-area-inset-right,0px) + 45px);bottom:calc(env(safe-area-inset-bottom,0px) + 224px)}#shView[aria-pressed="true"]{background:rgba(225,32,26,.55)}
body.sh-on.sh-touch #tRun{display:none!important}body.sh-on #where{visibility:hidden}
body.sh-on.sh-touch #tJump{--r:112px;--b:32px;--s:52px;width:52px!important;height:52px!important;right:calc(env(safe-area-inset-right,0px) + 112px)!important;bottom:calc(env(safe-area-inset-bottom,0px) + 32px)!important;background:rgba(0,0,0,.22)!important;border:1.5px solid rgba(255,255,255,.38)!important;font-size:0!important;position:absolute;margin:0}
body.sh-on.sh-touch #tJump:after{content:"";position:absolute;left:50%;top:50%;width:13px;height:13px;margin:-4px 0 0 -7px;border-left:2.5px solid #fff;border-top:2.5px solid #fff;transform:rotate(45deg)}
body.sh-on.sh-touch #stick{left:calc(env(safe-area-inset-left,0px) + 34px)!important;bottom:calc(env(safe-area-inset-bottom,0px) + 28px)!important;width:112px!important;height:112px!important;background:rgba(0,0,0,.14)!important;border-color:rgba(255,255,255,.26)!important}
body.sh-on.sh-touch #knob{opacity:.55}body.sh-on.sh-touch #stick.sprint{border-color:rgba(255,190,70,.9)!important}
body.sh-on.sh-touch #shSlots{bottom:calc(env(safe-area-inset-bottom,0px) + 6px);gap:3px}
body.sh-on.sh-touch #shSlots button{min-width:44px;height:27px;border-radius:5px;font-size:9px;padding:1px 3px;background:rgba(0,0,0,.26);border-color:rgba(255,255,255,.2)}
body.sh-on.sh-touch #shSlots button[aria-pressed="true"]{background:rgba(225,32,26,.42);border-color:rgba(255,90,80,.7)}
body.sh-on.sh-touch #shAmmo{right:auto;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 38px);transform:translateX(-50%);text-align:center;white-space:nowrap}
body.sh-on.sh-touch #shAmmo b{display:inline;font-size:19px}body.sh-on.sh-touch #shAmmo b small{font-size:12px}body.sh-on.sh-touch #shAmmo span{display:none}body.sh-on.sh-touch #shStance{display:inline;margin-right:8px;font-size:10px}
body.sh-on.sh-touch #shStats{font-size:10px;padding:3px 8px;top:calc(env(safe-area-inset-top,0px) + 6px);background:rgba(8,8,11,.3);max-width:50vw;overflow:hidden;text-overflow:ellipsis}
#shHp{position:absolute;left:calc(env(safe-area-inset-left,0px) + 24px);bottom:calc(env(safe-area-inset-bottom,0px) + 20px);width:190px;text-shadow:0 1px 3px #000}
#shHp span{display:block;font:400 26px/1 var(--display);margin-bottom:5px}#shHp div{height:8px;background:rgba(0,0,0,.55);border-radius:3px;overflow:hidden}#shHp i{display:block;height:100%;background:#3fbf5f;width:100%}#shHp.low i{background:var(--accent)}#shHp.low span{color:var(--accent)}
body.sh-on.sh-touch #shHp{left:calc(env(safe-area-inset-left,0px) + 12px);top:calc(env(safe-area-inset-top,0px) + 8px);bottom:auto;width:96px}body.sh-on.sh-touch #shHp span{font-size:14px;margin-bottom:2px}body.sh-on.sh-touch #shHp div{height:5px}
#shHurt{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(190,16,10,.75) 100%)}
#shDir{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0}#shDir i{position:absolute;left:-46px;top:-150px;width:92px;height:22px;border-top:5px solid #ff3b2f;border-radius:50%;box-shadow:0 -2px 6px rgba(255,40,30,.7)}
#shFeed{position:absolute;right:calc(env(safe-area-inset-right,0px) + 14px);top:calc(env(safe-area-inset-top,0px) + 196px);text-align:right;font-size:12px;text-shadow:0 1px 2px #000}#shFeed div{background:rgba(8,8,11,.5);padding:3px 8px;border-radius:5px;margin-top:3px}#shFeed b{color:var(--accent)}
body.sh-on.sh-touch #shFeed{top:calc(env(safe-area-inset-top,0px) + 8px);left:calc(env(safe-area-inset-left,0px) + 118px);right:auto;text-align:left;font-size:10px}
#shDead{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(60,0,0,.45);text-align:center}#shDead b{display:block;font:400 34px/1 var(--display);color:var(--accent);margin-bottom:8px}
#shScope{position:absolute;inset:0;background:radial-gradient(circle at center,transparent 0 33vh,#000 33.4vh)}#shScope:before,#shScope:after{content:"";position:absolute;background:rgba(0,0,0,.85)}#shScope:before{left:50%;top:calc(50% - 33vh);bottom:calc(50% - 33vh);width:1px}#shScope:after{top:50%;left:calc(50% - 33vh);right:calc(50% - 33vh);height:1px}
#shElim{position:absolute;left:50%;top:32%;transform:translateX(-50%);font:400 24px/1 var(--display);color:#fff;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .25s;white-space:nowrap}#shElim b{color:var(--accent);font-weight:400}
#shBanner{position:absolute;left:50%;top:24%;transform:translateX(-50%);text-align:center;text-shadow:0 2px 8px #000;white-space:nowrap}#shBanner b{display:block;font:400 42px/1 var(--display)}#shBanner.win b{color:#5fd27d}#shBanner.lose b{color:var(--accent)}#shBanner span{font-size:15px}
#shSpec{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 74px);transform:translateX(-50%);display:flex;gap:10px;align-items:center;background:rgba(8,8,11,.7);padding:7px 12px;border-radius:8px;pointer-events:auto}#shSpec button{background:none;border:1.5px solid var(--line);color:#fff;border-radius:6px;padding:6px 12px;font:700 13px/1 var(--body)}
#shEnd{position:absolute;inset:0;background:rgba(5,5,8,.88);display:flex;pointer-events:auto;z-index:3;overflow:auto}#shEnd>div{width:min(680px,92vw);padding:10px 14px;margin:auto}#shEndB>section{display:grid;grid-template-columns:1fr 1fr;gap:18px}#shEnd h2{font:400 clamp(26px,9vh,44px)/1 var(--display);margin:0 0 4px;text-align:center}#shEnd h2.win{color:#5fd27d}#shEnd h2.lose{color:var(--accent)}#shEnd p{text-align:center;margin:0 0 12px;color:var(--muted)}#shEnd table{width:100%;border-collapse:collapse;font-size:13px}#shEnd td,#shEnd th{padding:4px 8px;text-align:right}#shEnd td:first-child,#shEnd th:first-child{text-align:left}#shEnd tr.me td{color:#fff;font-weight:800}#shEnd tr.sep td{padding-top:10px;color:var(--accent);font-weight:800}#shEnd .row{display:flex;gap:10px;justify-content:center;margin-top:14px}#shEnd button{background:rgba(8,8,11,.75);border:1.5px solid var(--line);color:#fff;border-radius:7px;padding:11px 18px;font:700 14px/1 var(--body);cursor:pointer}#shEnd button.go{background:var(--red);border-color:var(--red)}
#shArm{margin-top:3px;height:5px!important}#shArm i{background:#3a8bff!important}
#shZoneWarn{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 46px);transform:translateX(-50%);background:rgba(160,20,14,.85);padding:6px 14px;border-radius:6px;font-weight:800;font-size:13px}
#shBurn{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,transparent 35%,rgba(60,90,255,.55) 100%)}
#shHint{position:absolute;left:50%;top:62%;transform:translateX(-50%);background:rgba(8,8,11,.6);padding:6px 12px;border-radius:6px;font-size:13px}
body.sh-on #streetName,body.sh-on #coords{display:none}`;
    document.head.appendChild(css);
    const d = document.createElement('div'); d.id = 'shHud'; d.hidden = true;
    d.innerHTML = `<div id="shX"><i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i></div><div id="shHit"></div><div id="shFloat"></div>
<div id="shScope" hidden></div><div id="shBanner" hidden><b></b><span></span></div><div id="shSpec" hidden><span>Watching <b id="shSpecName"></b></span><button id="shSpecNext">Next</button></div><div id="shEnd" hidden><div><h2 id="shEndT"></h2><p id="shEndS"></p><div id="shEndB"></div><div class="row"><button class="go" id="shAgain">Play again</button><button id="shEndMenu">Back to menu</button></div></div></div><div id="shElim"></div><div id="shHint" hidden></div><div id="shBurn"></div><div id="shZoneWarn" hidden>Outside the zone. Move!</div><div id="shHurt"></div><div id="shDir"><i></i></div><div id="shFeed"></div><div id="shHp" hidden><span id="shHpN">100</span><div><i id="shHpBar"></i></div><div id="shArm" hidden><i id="shArmBar"></i></div></div><div id="shDead" hidden><div><b>You don fall</b><span id="shDeadBy"></span></div></div><div id="shStats"></div><div id="shReload" hidden><i></i></div><div id="shAmmo"><i id="shStance" hidden></i><b id="shMag"></b><span id="shName"></span></div><div id="shSlots"></div>
${TOUCH ? '<div id="shTouch"><button id="shFire" aria-label="Fire"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/></svg></button><button id="shFireL" aria-label="Fire"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/></svg></button><button id="shAim" aria-pressed="false" aria-label="Aim"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg></button><button id="shView" aria-label="Change view" aria-pressed="false"><svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/><path d="M3 12h3M18 12h3"/></svg></button><button id="shRel" aria-label="Reload"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 3v5h-5"/></svg></button><button id="shCrouch" aria-pressed="false" aria-label="Crouch, hold to lie down"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/><path d="M5 19h14"/></svg></button></div><button id="shExit">Exit</button>' : ''}
<div id="shPause" hidden><div><h2>Paused</h2><button class="go" id="shResume">Keep shooting</button><button id="shQuit">Back to menu</button></div></div>`;
    document.body.appendChild(d);
    const sl = el('#shSlots');
    for (const id of R.ORDER){ const b = document.createElement('button'); b.dataset.w = id; b.innerHTML = `${TOUCH ? '' : `<kbd>${W[id].slot}</kbd>`}${W[id].name}`; b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); swap(id); }); sl.appendChild(b); }
    el('#shResume').addEventListener('click', () => { setPaused(false); canvas.requestPointerLock?.()?.catch?.(() => {}); });
    el('#shQuit').addEventListener('click', stop);
    el('#shSpecNext').addEventListener('click', () => { if (S.spec) S.spec.i++; });
    el('#shEndMenu').addEventListener('click', stop);
    el('#shAgain').addEventListener('click', () => { if (S.net){ const n = S.net; S.keepNet = true; stop(); S.keepNet = false; n.toRoom(); return; } const o = { mode:S.mode, diff:S.diff, squad:S.squad }; stop(); start(o); });
    if (TOUCH){
      for (const id of ['#shFire', '#shFireL']){
        // the fire button also steers, so your thumb can aim and shoot at once
        const b = el(id); let p = null;
        b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.setPointerCapture(e.pointerId); p = [e.clientX, e.clientY]; setTrigger(true); });
        b.addEventListener('pointermove', e => { if (!p) return; look.dx += (e.clientX - p[0]) * 0.005 * SENS; look.dy += (e.clientY - p[1]) * 0.005 * SENS; p = [e.clientX, e.clientY]; });
        const up = () => { p = null; setTrigger(false); }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      }
      el('#shAim').addEventListener('pointerdown', e => { e.preventDefault(); S.ads = !S.ads; el('#shAim').setAttribute('aria-pressed', String(S.ads)); });
      el('#shRel').addEventListener('pointerdown', e => { e.preventDefault(); reload(); });
      el('#shView').addEventListener('pointerdown', e => { e.preventDefault(); setView(S.view === 'tp' ? 'fp' : 'tp'); });
      el('#shExit').addEventListener('click', stop);
      const cb = el('#shCrouch');   // tap to crouch, long-press to lie down
      cb.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); crouchDown(); });
      for (const ev of ['pointerup', 'pointercancel']) cb.addEventListener(ev, crouchUp);
    }
  }
  /* ---------------- phone aiming help: aim assist and optional auto-fire. Neither runs with a mouse. */
  const HELP = { aim:true, auto:false };
  try { Object.assign(HELP, JSON.parse(localStorage.getItem('wayo-aimhelp') || '{}')); } catch (e) {}
  function setHelp(k, v){ HELP[k] = v; try { localStorage.setItem('wayo-aimhelp', JSON.stringify(HELP)); } catch (e) {} }
  const LOCK_RANGE = 48;
  // the enemy closest to your crosshair, if one is in clear view
  function aimTarget(){
    let best = null, bo = 1e9; const o = eye(), yaw = P.yaw, pitch = P.pitch, ads = S.adsT > 0.5;
    for (const T of S.targets){
      if (!T.alive) continue;
      const aimY = T.y + R.STANCE[T.stance || 0].aimAt, dx = T.x - o[0], dy = aimY - o[1], dz = T.z - o[2], hd = Math.hypot(dx, dz), d = Math.hypot(hd, dy);
      if (d < 0.5 || d > (W[S.me.weapon].scope && ads ? 120 : LOCK_RANGE)) continue;
      const wy = Math.atan2(-dx, -dz), wp = Math.atan2(dy, hd), oy = wrapA(wy - yaw), op = wp - pitch, off = Math.hypot(oy, op), cone = (0.075 + 0.55 / d) * (ads ? 1.35 : 1);
      if (off > cone || off >= bo) continue;
      const u = [dx / d, dy / d, dz / d];
      if (R.rayWorld(o, u, d, near) < d - 0.2) continue;
      bo = off; best = { T, oy, op, off, d };
    }
    return best;
  }
  function tickAssist(dt){
    S.autoFire = false;
    if (!TOUCH){ return; }
    S.assistAt = (S.assistAt || 0) - dt;
    if (S.assistAt <= 0){ S.assistAt = 0.05; S.lock = S.me.alive && !S.climb ? aimTarget() : null; }
    let L = S.lock; if (L && !L.T.alive) L = S.lock = null;
    const m = moveState(), steering = Math.abs(P.yaw - (S.lastYaw ?? P.yaw)) + Math.abs(P.pitch - (S.lastPitch ?? P.pitch)) > 1e-4;
    S.assistSlow = HELP.aim && L ? 0.62 : 1;
    if (HELP.aim && L && (S.trigger || m.moving || steering || S.snapT > 0)){
      // a gentle pull towards the chest, stronger while you fire or just after you aim in
      const fresh = aimTarget() || L, k = 1 - Math.exp(-dt * (S.snapT > 0 ? 11 : S.trigger ? 5 : 3)), lim = (S.snapT > 0 ? 2.4 : 0.8) * dt;
      P.yaw += Math.max(-lim, Math.min(lim, fresh.oy * k)); P.pitch += Math.max(-lim, Math.min(lim, fresh.op * k));
    }
    S.snapT = Math.max(0, (S.snapT || 0) - dt); if (S.adsT < 0.2 && S.ads) S.snapT = 0.22;
    S.lastYaw = P.yaw; S.lastPitch = P.pitch;
    // auto-fire: shoots by itself when the crosshair is on an enemy
    if (HELP.auto && L && S.me.alive){
      const f = S.me, w = W[f.weapon], o = eye();
      if (w.melee) S.autoFire = L.d < w.reach + 0.4;
      else if ((!w.scope || S.adsT > 0.85) && (!(w.pellets > 1) || L.d < 20)){ const h = R.traceShot(o, aimDir(), w.range, S.targets, near, f); S.autoFire = !!h.target; }
    }
  }

  /* ---------------- first-time guide: what each button does, shown on a small picture of the screen */
  const TIPS_KEY = 'wayo-tips-v1';
  const seenTips = () => { try { return !!localStorage.getItem(TIPS_KEY); } catch (e) { return true; } };
  const markTips = () => { try { localStorage.setItem(TIPS_KEY, '1'); } catch (e) {} };
  // spots on the mini screen, in percent of its width and height
  const SPOT = { stick:[11, 78, 13], fire:[92, 68, 9.2], fireL:[6, 53, 5.6], aim:[83.5, 63, 6], rel:[92, 50, 5], view:[92, 37, 4.6], cr:[77, 82, 5.4], jump:[83.5, 85, 6.2] };
  const TOUCH_TIPS = [
    { on:['stick'], t:'Move', d:'Push the stick to walk. Push it all the way forward to sprint. The ring turns gold.' },
    { area:true, t:'Look around', d:'Drag your thumb anywhere on the right side of the screen.' },
    { on:['fire', 'fireL'], t:'Shoot', d:'Hold either fire button to shoot. Drag the button while you hold it to aim and fire together.' },
    { on:['aim'], t:'Aim', d:'Tap to aim down your sights. On the sniper this opens the scope. Tap again to stop.' },
    { on:['view'], t:'Change view', d:'Switch between first person and third person, over your shoulder. Aiming always goes through the sights.' },
    { on:['rel'], t:'Reload', d:'Tap to reload. Your gun also reloads by itself when it runs empty.' },
    { on:['cr'], t:'Crouch and lie down', d:'Tap to crouch. Press and hold to lie flat. Low stances are harder to spot and steadier to shoot from.' },
    { on:['jump'], t:'Jump', d:'Tap to jump. If you are crouching or lying down, it gets you up first.' },
    { slots:true, t:'Swap weapons', d:'Tap a weapon along the bottom. In battle royale you only have what you find, so check shop counters and alleys.' },
    { area:'ladder', t:'Climb', d:'Walk up to a yellow ladder and push forward to climb onto the roof. That is where the sniper shines.' },
  ];
  const KEY_TIPS = [
    { keys:['W', 'A', 'S', 'D'], t:'Move', d:'Hold Shift to sprint. Space jumps.' },
    { keys:['Mouse'], t:'Look and shoot', d:'Move the mouse to look. Left click shoots, right click aims. On the sniper, aiming opens the scope.' },
    { keys:['V'], t:'Change view', d:'Switch between first person and third person, over your shoulder. Aiming always goes through the sights.' },
    { keys:['R'], t:'Reload', d:'Your gun also reloads by itself when it runs empty.' },
    { keys:['C'], t:'Crouch and lie down', d:'Tap C to crouch. Hold C to lie flat. Low stances are harder to spot and steadier to shoot from.' },
    { keys:['1', '–', '6'], t:'Swap weapons', d:'Or use the mouse wheel. Q goes back to your last weapon. In battle royale you only have what you find.' },
    { keys:['W'], t:'Climb', d:'Walk up to a yellow ladder and hold W to climb onto the roof. That is where the sniper shines.' },
  ];
  function tipPicture(tip){
    if (tip.keys) return `<div class="tipKeys">${tip.keys.map(k => `<kbd>${k}</kbd>`).join('')}</div>`;
    const dots = Object.keys(SPOT).map(k => { const [x, y, r] = SPOT[k]; return `<i class="${tip.on && tip.on.includes(k) ? 'hot' : ''}" style="left:${x}%;top:${y}%;width:${r}%"></i>`; }).join('');
    return `<div class="tipPhone">${tip.area === true ? '<u></u>' : ''}${tip.area === 'ladder' ? '<s></s>' : ''}${dots}<b class="${tip.slots ? 'hot' : ''}"></b></div>`;
  }
  function showTips(done){
    const list = TOUCH ? TOUCH_TIPS : KEY_TIPS; let i = 0, root = el('#shTips');
    if (!root){
      const css = document.createElement('style');
      css.textContent = `#shTips{position:fixed;inset:0;z-index:60;background:rgba(5,5,8,.93);display:flex;overflow:auto;color:#fff;font:15px/1.35 var(--body);touch-action:pan-y}
#shTips .tc{margin:auto;width:min(620px,94vw);padding:10px 14px;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;align-items:center}
#shTips h3{font:400 clamp(20px,6vh,28px)/1.05 var(--display);margin:0 0 6px;color:var(--accent)}#shTips p{margin:0;color:#ddd}
#shTips .tipN{display:flex;gap:5px;margin:10px 0}#shTips .tipN i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.25)}#shTips .tipN i.on{background:var(--accent)}
#shTips .tipB{display:flex;gap:8px;align-items:center}#shTips button{background:rgba(255,255,255,.08);border:1.5px solid var(--line);color:#fff;border-radius:7px;padding:9px 14px;font:700 13px/1 var(--body);cursor:pointer}#shTips button.go{background:var(--red);border-color:var(--red)}#shTips button.ln{background:none;border:0;color:var(--muted);padding:9px 4px;margin-left:auto}
.tipPhone{position:relative;width:100%;aspect-ratio:844/390;border:2px solid rgba(255,255,255,.3);border-radius:12px;background:linear-gradient(#55708c,#39424c 55%,#26282c);overflow:hidden}
.tipPhone i{position:absolute;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;border:1.5px solid rgba(255,255,255,.4);background:rgba(0,0,0,.22)}.tipPhone i.hot{border-color:#fff;background:var(--red);box-shadow:0 0 0 4px rgba(225,32,26,.35)}
.tipPhone b{position:absolute;left:50%;bottom:4%;width:26%;height:8%;transform:translateX(-50%);border-radius:3px;border:1px solid rgba(255,255,255,.35)}.tipPhone b.hot{background:var(--red);border-color:#fff;box-shadow:0 0 0 4px rgba(225,32,26,.35)}
.tipPhone u{position:absolute;right:0;top:0;bottom:0;width:50%;background:rgba(225,32,26,.32);border-left:1.5px dashed #fff}.tipPhone s{position:absolute;left:47%;top:8%;bottom:30%;width:6%;background:repeating-linear-gradient(#f2c230 0 3px,transparent 3px 9px);border-left:2px solid #f2c230;border-right:2px solid #f2c230}
.tipKeys{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}.tipKeys kbd{min-width:46px;padding:12px 10px;text-align:center;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.4);border-bottom-width:4px;border-radius:8px;font:800 17px/1 var(--body)}`;
      document.head.appendChild(css);
      root = document.createElement('div'); root.id = 'shTips'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'How to play'); document.body.appendChild(root);
    }
    const close = () => { markTips(); root.hidden = true; root.onpointerdown = root.onpointerup = null; if (done) done(); };
    const draw = () => {
      const tip = list[i], last = i === list.length - 1;
      root.innerHTML = `<div class="tc"><div>${tipPicture(tip)}</div><div><h3>${tip.t}</h3><p>${tip.d}</p><div class="tipN">${list.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div><div class="tipB">${i ? '<button id="tipBack">Back</button>' : ''}<button class="go" id="tipNext">${last ? (done ? 'Start' : 'Done') : 'Next'}</button>${last ? '' : '<button class="ln" id="tipSkip">Skip</button>'}</div></div></div>`;
      el('#tipNext').onclick = () => { if (last) close(); else { i++; draw(); } };
      if (i) el('#tipBack').onclick = () => { i--; draw(); };
      if (!last) el('#tipSkip').onclick = close;
    };
    let sx = null;   // swipe left and right to move through the cards
    root.onpointerdown = e => { sx = e.clientX; };
    root.onpointerup = e => { if (sx === null) return; const d = e.clientX - sx; sx = null; if (Math.abs(d) < 50) return; if (d < 0 && i < list.length - 1){ i++; draw(); } else if (d > 0 && i > 0){ i--; draw(); } };
    root.hidden = false; draw();
  }
  // start a shooter mode, showing the guide first if this is the player's first time
  /* ---------------- the fighters. Add a line here and drop the files in chars/ and art/p/ to bring in a new one. */
  const TEAMS = { task:{ name:'Task Force', c:'#e1201a' }, zombies:{ name:'Zombies', c:'#7fbf3f' }, traders:{ name:'Traders', c:'#ffb020' }, heroes:{ name:'Heroes', c:'#3a8bff' } };
  const ROSTER = [
    { id:'tf', name:'Sarge', team:'task', h:1.8, arms:'tf_arms' },
    { id:'nysc_m', name:'Corporal', team:'task', h:1.78, arms:'nysc_m_arms' },
    { id:'nysc_f', name:'Officer Ada', team:'task', h:1.7, arms:'nysc_f_arms' },
    { id:'blazer', name:'Detective', team:'task', h:1.72, arms:'blazer_arms' },
    { id:'hoodie_m', name:'Undercover', team:'task', h:1.78, arms:'hoodie_m_arms' },
    { id:'zombie_tank', name:'Agbero', team:'zombies', h:1.85, arms:'zombie_tank_arms', armS:0.9 },
    { id:'z_mech', name:'Mechanic', team:'zombies', h:1.9, arms:'z_mech_arms', armS:0.82 },
    { id:'z_cond', name:'Conductor', team:'zombies', h:1.76, arms:'z_cond_arms' },
    { id:'z_hawk', name:'Hawker', team:'zombies', h:1.68, arms:'z_hawk_arms' },
    { id:'z_man', name:'Area Boy', team:'zombies', h:1.76, arms:'z_man_arms' },
    { id:'kaftan', name:'Alhaji', team:'traders', h:1.78, arms:'kaftan_arms' },
    { id:'stud_f', name:'Chioma', team:'traders', h:1.68, arms:'stud_f_arms' },
    { id:'stud_m', name:'Kunle', team:'traders', h:1.78, arms:'stud_m_arms' },
    { id:'chief', name:'Chief', team:'traders', h:1.78, arms:'chief_arms' },
    { id:'trader_m2', name:'Emeka', team:'traders', h:1.76, arms:'trader_m2_arms' },
    { id:'trader_f2', name:'Iya Bose', team:'traders', h:1.68, arms:'trader_f2_arms' },
    { id:'h_aba', name:'Aba Maid', team:'heroes', h:1.8, arms:'h_aba_arms', armS:0.78 },
    { id:'h_one', name:'One Chance', team:'heroes', h:1.82, arms:'h_one_arms', armS:0.85 },
    { id:'h_second', name:'Second Hand', team:'heroes', h:1.8, arms:'h_second_arms', armS:0.75 },
    { id:'h_stretch', name:'Stretch Mark', team:'heroes', h:1.78, arms:'h_stretch_arms', armS:0.9 },
  ];
  const PICK_KEY = 'kasala-pick', MAX_KINDS = GFX.low ? 5 : 10;
  const byId = id => ROSTER.find(c => c.id === id), inTeam = t => ROSTER.filter(c => c.team === t), pickable = t => inTeam(t).filter(c => !c.bot), shuffled = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function savedPick(){ try { const c = byId(localStorage.getItem(PICK_KEY)); if (c) return c; } catch (e) {} return ROSTER[0]; }
  // who is in this match. Only these fighters get downloaded, so a phone never holds the whole cast in memory.
  function makePlan(opts = {}, me = savedPick()){
    const P = { me:me.id, mates:[], foes:[], names:[TEAMS[me.team].name, 'Enemy'], others:[] }, teamed = opts.mode === 'team' || (opts.mode === 'br' && opts.squad);
    const fill = (list, n) => Array.from({ length:n }, (_, i) => list[i % list.length].id);
    const open = Object.keys(TEAMS).filter(t => inTeam(t).length);
    if (teamed){
      const foe = shuffled(open.filter(t => t !== me.team))[0] || me.team, own = shuffled(inTeam(me.team).filter(c => c !== me));
      P.mates = fill(own.length ? own : [me], 5); P.foes = fill(shuffled(inTeam(foe)), 5); P.names = [TEAMS[me.team].name, TEAMS[foe].name];
    } else P.others = fill(shuffled(ROSTER.filter(c => c !== me)).slice(0, MAX_KINDS - 1), 9);
    return P;
  }
  function prep(opts = {}, me){
    const P = S.plan = makePlan(opts, me), list = {}; for (const id of [P.me, ...P.mates, ...P.foes, ...P.others]) list[id] = byId(id).h;
    const c = byId(P.me); return GAME.debug.loadFighters(list, c.arms ? { [c.id]:c.arms } : {});
  }
  const preload = () => prep({ mode:'bots' }).catch(() => {});
  /* ---------------- pick your team and fighter */
  function showPicker(opts, done){
    let root = el('#shPick'), me = savedPick();
    if (!root){
      const css = document.createElement('style');
      css.textContent = `#shPick{position:fixed;inset:0;z-index:40;overflow:auto;background:radial-gradient(70% 110% at 50% 110%,rgba(255,90,20,.3),transparent 62%),#08080b;color:#fff;font:15px/1.3 var(--body);touch-action:pan-y}
#shPick .pw{max-width:980px;min-height:100%;margin:0 auto;padding:max(14px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) 14px max(16px,env(safe-area-inset-left));display:grid;grid-template-rows:auto auto 1fr auto;gap:10px;box-sizing:border-box}
#shPick h2{margin:0;font:400 clamp(22px,5vh,32px)/1 var(--display);color:#ffd27a}#shPick .pt{display:flex;gap:6px;flex-wrap:wrap}
#shPick .pt button{min-height:36px;padding:0 12px;border-radius:0;background:rgba(255,255,255,.08);border:0;border-bottom:3px solid transparent;font:800 13px var(--body)}#shPick .pt button[aria-pressed="true"]{color:#fff;background:rgba(255,255,255,.16);border-bottom-color:var(--tc)}
#shPick .pg{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;align-content:start}
#shPick .pc{position:relative;padding:0;border:2px solid var(--line);border-radius:0;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(0,0,0,.4));aspect-ratio:3/4;overflow:hidden;min-height:0;max-height:52vh;width:100%}#shPick .pc[aria-pressed="true"]{border-color:var(--tc);box-shadow:0 0 0 2px var(--tc)}
#shPick .pc img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:bottom}#shPick .pc i{position:absolute;inset:0;display:grid;place-items:center;font:400 42px var(--display);font-style:normal;color:rgba(255,255,255,.28)}
#shPick .pc[aria-pressed="true"]{color:#fff}#shPick .pc b{position:absolute;left:0;right:0;bottom:0;padding:5px 4px;background:linear-gradient(transparent,rgba(0,0,0,.85));font:800 12px var(--body);text-align:center}
#shPick .pb{display:grid;grid-template-columns:auto 1fr;gap:10px}#shPick .pb button{min-height:48px;border-radius:0;border:0}#shPick #pickBack{padding:0 18px;background:rgba(255,255,255,.1)}#shPick #pickGo{background:linear-gradient(90deg,#d3160f,#ff6a13);font:400 19px var(--display)}`;
      document.head.appendChild(css);
      root = document.createElement('div'); root.id = 'shPick'; root.hidden = true;
      root.innerHTML = '<div class="pw"><h2></h2><div class="pt"></div><div class="pg"></div><div class="pb"><button id="pickBack">Back</button><button id="pickGo">Fight</button></div></div>';
      document.body.appendChild(root);
    }
    const draw = () => {
      const open = Object.keys(TEAMS).filter(t => inTeam(t).length), t = TEAMS[me.team]; root.style.setProperty('--tc', t.c);
      root.querySelector('h2').textContent = opts.mode === 'team' ? 'Choose your team' : 'Choose your fighter';
      root.querySelector('.pt').innerHTML = open.map(k => `<button data-t="${k}" aria-pressed="${k === me.team}">${TEAMS[k].name}</button>`).join('');
      root.querySelector('.pg').innerHTML = pickable(me.team).map(c => `<button class="pc" data-c="${c.id}" aria-pressed="${c === me}" aria-label="${c.name}"><i>${c.name[0]}</i><img src="art/p/${c.id}.webp" alt="" onerror="this.remove()"><b>${c.name}</b></button>`).join('');
      root.querySelectorAll('[data-t]').forEach(b => { b.onclick = () => { me = pickable(b.dataset.t)[0]; draw(); }; });
      root.querySelectorAll('[data-c]').forEach(b => { b.onclick = () => { me = byId(b.dataset.c); draw(); }; });
    };
    draw(); root.hidden = false; root.scrollTop = 0; el('#pickGo').textContent = opts.go || 'Fight';
    el('#pickBack').onclick = () => { root.hidden = true; };
    el('#pickGo').onclick = () => { try { localStorage.setItem(PICK_KEY, me.id); } catch (e) {} const b = el('#pickGo'); b.textContent = 'Getting fighters ready…'; b.disabled = true; done(me, () => { b.textContent = 'Fight'; b.disabled = false; root.hidden = true; }, msg => { b.textContent = msg || 'Fight'; b.disabled = false; }); };
  }
  function play(opts = {}){
    const go = () => { if (!GAME.S.ready) return; showPicker(opts, (me, ok, bad) => prep(opts, me).then(() => { ok(); start(opts); }).catch(e => { console.warn(e); bad('Check your connection and try again'); })); };
    if (seenTips()) go(); else showTips(go);
  }

  /* ---------------- stance: tap crouch to duck, hold it to lie flat */
  function roomFor(h){
    for (const C of near(P.x, P.z)){ if (C.ramp) continue; const [lx, lz] = local(C, P.x, P.z); if (Math.abs(lx) < C.hw + RAD && Math.abs(lz) < C.hd + RAD && C.y0 > P.y + 0.3 && C.y0 < P.y + h) return false; }
    return true;
  }
  function setStance(n){
    if (n === S.stance || !S.active) return true;
    if (n < S.stance && !roomFor(R.STANCE[n].height)){ toast('No room to get up here', 1200); return false; }
    S.stance = n; HEAD = R.STANCE[n].height; blast(0.06, 0.08, 500, 0.8);
    const lab = el('#shStance'); lab.hidden = !n; lab.textContent = R.STANCE[n].name === 'prone' ? 'Lying down' : 'Crouching';
    if (TOUCH){ const c = el('#shCrouch'); c.setAttribute('aria-pressed', String(!!n)); c.style.transform = n === 2 ? 'scale(1.12)' : ''; }
    return true;
  }
  const canDuck = () => S.active && !S.paused && S.me.alive && !S.climb && P.onGround;
  function crouchDown(){ if (canDuck()){ S.crouchAt = S.now || 0.001; S.crouchHeld = false; } }
  function crouchUp(){
    if (!S.crouchAt) return; S.crouchAt = 0;
    if (!S.crouchHeld && canDuck()) setStance(S.stance === 1 ? 0 : 1);   // a quick tap from flat gets you to a crouch
    S.crouchHeld = false;
  }
  function tickStance(dt){
    if (S.crouchAt && !S.crouchHeld && S.now - S.crouchAt >= 0.35){ S.crouchHeld = true; if (canDuck()) setStance(2); }
    if (S.climb && S.stance) setStance(0);
    S.eyeDrop += (R.STANCE[0].eye - R.STANCE[S.stance].eye - S.eyeDrop) * Math.min(1, dt * (S.stance === 2 ? 7 : 12));
    camera.position.y -= S.eyeDrop;
    // reaching for sprint gets you back on your feet
    // on phones, pushing the stick all the way forward is sprint, like the big mobile shooters
    if (TOUCH){ const sprint = !S.stance && !S.climb && stick.y < -0.82; P.run = sprint; const st = el('#stick'); if (st) st.classList.toggle('sprint', sprint); }
    const run = !!(P.run || keys.ShiftLeft || keys.ShiftRight); if (run && !S.runWas && S.stance) setStance(0); S.runWas = run;
  }
  function noJump(){ if (!S.active || !S.stance) return false; keys.Space = false; setStance(S.stance - 1); return true; }   // jump stands you up first
  function setPaused(v){ S.paused = v; el('#shPause').hidden = !v; if (v) setTrigger(false); }
  function drawHud(){
    const f = S.me, w = W[f.weapon], a = f.ammo[f.weapon];
    el('#shMag').innerHTML = w.melee ? '&nbsp;' : `${a.mag} <small>/ ${a.reserve}</small>`;
    el('#shName').textContent = w.name; el('#shAmmo').classList.toggle('low', !w.melee && a.mag <= Math.ceil(w.mag * 0.2));
    for (const b of el('#shSlots').children){ b.setAttribute('aria-pressed', String(b.dataset.w === f.weapon)); b.hidden = !!(f.owned && !f.owned[b.dataset.w]); }
    const st = S.stats;
    if (S.br){
      const Z = S.br.zone, left = S.W.fighters.filter(x => x.alive).length, hp = Math.max(0, Math.ceil(f.hp));
      el('#shStats').innerHTML = `Alive <b>${left}</b> · Kills <b>${f.kills}</b> · ${Z.done ? 'Final zone' : Z.shrinking ? 'Zone closing <b>' + clock(Z.t) + '</b>' : 'Zone moves in <b>' + clock(Z.t) + '</b>'}`;
      el('#shHpN').textContent = hp; el('#shHpBar').style.width = hp + '%'; el('#shHp').classList.toggle('low', hp <= 35);
      el('#shArm').hidden = !f.armor; el('#shArmBar').style.width = (f.armor || 0) + '%';
    } else if (S.team){
      const a = teamOf(0), b = teamOf(1), r = S.round, hp = Math.max(0, Math.ceil(f.hp));
      el('#shStats').innerHTML = `${S.plan.names[0]} <b>${S.score[0]}</b> – <b>${S.score[1]}</b> ${S.plan.names[1]} · Alive <b>${a.filter(x => x.alive).length}</b> v <b>${b.filter(x => x.alive).length}</b> · ${clock(r.t)} · Kills <b>${f.kills}</b>`;
      el('#shHpN').textContent = hp; el('#shHpBar').style.width = hp + '%'; el('#shHp').classList.toggle('low', hp <= 35);
    } else if (S.fight){
      const top = S.bots.reduce((a, b) => b.kills > a.kills ? b : a, S.bots[0]), hp = Math.max(0, Math.ceil(f.hp));
      el('#shStats').innerHTML = `First to ${FFA_GOAL} · You <b>${f.kills}</b> · Top bot <b>${top.name} ${top.kills}</b> · Deaths <b>${f.deaths}</b> · ${clock(S.ffaT)}`;
      el('#shHpN').textContent = hp; el('#shHpBar').style.width = hp + '%'; el('#shHp').classList.toggle('low', hp <= 35);
    } else el('#shStats').innerHTML = `Hits <b>${st.hits}</b> · Headshots <b>${st.heads}</b> · Down <b>${st.kills}</b> · Accuracy <b>${st.shots ? Math.round(st.hits / st.shots * 100) : 0}%</b>`;
  }
  function floatNum(x, y, z, n, head){
    _v.set(x, y, z).project(camera); if (_v.z > 1) return;
    const s = document.createElement('span'); s.textContent = n; if (head) s.className = 'head'; s.style.left = (_v.x + 1) / 2 * innerWidth + 'px'; s.style.top = (1 - _v.y) / 2 * innerHeight + 'px';
    el('#shFloat').appendChild(s); requestAnimationFrame(() => { s.style.transform = 'translate(-50%,-160%)'; s.style.opacity = 0; }); setTimeout(() => s.remove(), 600);
  }
  function hitMark(head){ const h = el('#shHit'); h.className = head ? 'head' : ''; S.hitT = 0.16; h.style.opacity = 1; }

  /* ---------------- targets: Task Force and traders who walk the street. They don't shoot back yet. */
  function streetSpots(){ const pts = []; for (const st of LAYOUT.streets) walkLine(st.pts, 5, (x, z) => { if (inPlay(x, z, -4) && !blockedAt(x, z, 0.7)) pts.push([x, z, st.name]); }); return pts; }
  function clearPath(a, b){ const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 1.2); for (let i = 0; i <= n; i++){ const t = i / n; if (blockedAt(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0.5)) return false; } return true; }
  function spawnTargets(spots){
    const dbg = GAME.debug, chars = S.plan.others;
    const home = spots.slice().sort((a, b) => Math.hypot(a[0] - P.x, a[1] - P.z) - Math.hypot(b[0] - P.x, b[1] - P.z));
    const picks = []; for (const s of home){ const d = Math.hypot(s[0] - P.x, s[1] - P.z); if (d < 8 || picks.some(p => Math.hypot(p[0] - s[0], p[1] - s[1]) < 7)) continue; picks.push(s); if (picks.length === 9) break; }
    picks.forEach((s, i) => {
      const T = R.newFighter({ id:'t' + i, x:s[0], z:s[1] }); T.y = groundAt(s[0], s[1], 2); T.ry = Math.random() * 6.28;
      T.A = dbg.makeAvatar(chars[i % chars.length]); rigUp(T.A); T.home = [s[0], s[1]];
      const other = home.find(o => { const d = Math.hypot(o[0] - s[0], o[1] - s[1]); return d > 7 && d < 18 && clearPath(s, o); });
      T.path = i % 3 !== 2 && other ? [[s[0], s[1]], [other[0], other[1]]] : null; T.leg = 1; T.wait = Math.random() * 2; T.deadT = 0; addBar(T);
      S.targets.push(T);
    });
  }
  function tickTargets(dt){
    for (const T of S.targets){
      let sp = 0;
      if (!T.alive){ T.deadT -= dt; if (T.deadT <= 0) revive(T); }
      else if (T.path){
        if (T.wait > 0) T.wait -= dt;
        else { const g = T.path[T.leg], dx = g[0] - T.x, dz = g[1] - T.z, d = Math.hypot(dx, dz); if (d < 0.3){ T.leg = 1 - T.leg; T.wait = 0.4 + Math.random() * 1.6; } else { sp = 1.6; const m = Math.min(d, sp * dt); T.x += dx / d * m; T.z += dz / d * m; T.ry = Math.atan2(dx, dz); T.y = groundAt(T.x, T.z, T.y + 1); } }
      }
      T.speed = sp; if (T.alive){ T.A.root.position.set(T.x, T.y, T.z); T.A.root.rotation.set(0, T.ry, 0); animBody(T, dt); } else tickFall(T, dt);
    }
  }
  function revive(T){ T.hp = T.maxHp; T.alive = true; T.x = T.home[0]; T.z = T.home[1]; T.y = groundAt(T.x, T.z, 2); T.leg = 1; standUp(T); }

  /* ---------------- shooting */
  const eye = () => [camera.position.x, camera.position.y, camera.position.z];
  // in third person the camera sits behind you, so find what the crosshair is on, then shoot at that from where you stand
  function aimDir(){
    camera.getWorldDirection(_v); const d = [_v.x, _v.y, _v.z], back = S.camBack || 0; if (back < 0.3) return d;
    const o = eye(), bk = BOOM, c = S.lastCam || o, hit = R.traceShot(c, d, 240, S.targets, near, S.me), t = Math.max(hit.t, 4), ax = c[0] + d[0] * t - o[0], ay = c[1] + d[1] * t - o[1], az = c[2] + d[2] * t - o[2], l = Math.hypot(ax, ay, az);
    return [ax / l, ay / l, az / l];
  }
  function moveState(){ const moving = !!(keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight || Math.hypot(stick.x, stick.y) > 0.15); return { ads:S.ads, moving, running:moving && !S.stance && !!(P.run || keys.ShiftLeft || keys.ShiftRight), airborne:!P.onGround, stance:S.stance }; }
  function hurt(T, hit, id){
    const dmg = R.damageAt(id, hit.t, hit.zone), res = R.applyDamage(T, dmg); S.stats.hits++; if (hit.zone === 'head') S.stats.heads++;
    return { dmg, killed:res.killed };
  }
  function shoot(){
    const f = S.me, id = f.weapon, w = W[id], o = eye(), aim = aimDir(), ms = moveState(), seed = Math.floor(Math.random() * 2147483647), shot = R.fire(f, aim, ms, S.now, S.net ? R.seeded(seed) : Math.random);
    if (!shot) return false;
    if (S.net) S.net.send(['s', seed, ...o.map(v => +v.toFixed(3)), ...aim.map(v => +v.toFixed(4)), (ms.ads ? 1 : 0) | (ms.moving ? 2 : 0) | (ms.running ? 4 : 0) | (ms.airborne ? 8 : 0), +netClock().toFixed(3), R.ORDER.indexOf(id)]);
    if (w.melee) slash(); else bang(id);
    S.stats.shots++;
    if (S.fight) BOTS.hearShot(S.bots, f.x, f.z, f, botWorld());
    if (w.melee){
      S.swing = 1;
      const hit = S.net ? null : R.knifeTrace(o, shot.dirs[0], S.targets, near, f);
      if (hit){ const r = hurt(hit.target, hit, id); report(hit.target, [{ d:r.dmg, head:false, at:[hit.target.x, hit.target.y + 1.2, hit.target.z] }], r.killed); blast(0.3, 0.08, 1100, 1.6); thump(0.26, 105, 0.11); }
      return true;
    }
    const tally = new Map(); let hits = 0;
    camera.getWorldDirection(_a); _b.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const mx = o[0] + _a.x * 0.7 + _b.x * 0.18, my = o[1] + _a.y * 0.7 - 0.13, mz = o[2] + _a.z * 0.7 + _b.z * 0.18;
    shot.dirs.forEach((d, i) => {
      const hit = R.traceShot(o, d, w.range, S.targets, near, f), x = o[0] + d[0] * hit.t, y = o[1] + d[1] * hit.t, z = o[2] + d[2] * hit.t;
      if (i % 3 === 0) tracer(mx, my, mz, x, y, z);
      if (hit.t < w.range) impact(x, y, z, o, !!hit.target);
      if (hit.target && !S.net){ hits++; const r = hurt(hit.target, hit, id), e = tally.get(hit.target) || { list:[], killed:false }; e.list.push({ d:r.dmg, head:hit.zone === 'head', at:[x, y, z] }); e.killed = e.killed || r.killed; tally.set(hit.target, e); }
    });
    if (hits > 1) S.stats.hits -= hits - 1;   // a shotgun blast counts as one hit on the score line
    for (const [T, e] of tally){ const sum = e.list.reduce((a, b) => a + b.d, 0), head = e.list.some(h => h.head); report(T, [{ d:sum, head, at:e.list[0].at }], e.killed); }
    S.vKick = 1; S.vRoll = (Math.random() - 0.5); S.flashT = 0.045; if (f.A) f.A.flashT = 0.05;
    const steady = R.STANCE[S.stance].steady; S.pitchDebt += w.kick * (S.ads ? 0.6 : 1) * steady; P.yaw += (Math.random() - 0.5) * w.kick * 0.5 * steady;
    return true;
  }
  function report(T, parts, killed){
    const p = parts[0]; floatNum(p.at[0], p.at[1], p.at[2], p.d, p.head); hitMark(p.head); click(0.22, p.head ? 4800 : 3400);
    if (S.fight){ T.lastHitBy = S.me; T.lastHitAt = S.now; T.meHitAt = S.now; if (killed) downed(T, S.me); }
    else if (killed){ S.stats.kills++; T.deadT = 3.5; fall(T, S.me.x, S.me.z); elim('Target'); }
  }
  function setTrigger(v){ if (v && !S.trigger) S.pressed = true; S.trigger = v; }
  function swap(id){ if (!S.active) return; const cur = S.me.weapon; if (R.switchWeapon(S.me, id, S.now)){ S.last = cur; click(0.14, 1800); if (S.net) S.net.send(['w', R.ORDER.indexOf(id)]); } }
  function reload(){ if (S.active && R.startReload(S.me, S.now) && S.net) S.net.send(['r']); }
  function dry(){ click(0.2, 2400); }

  /* ---------------- bots: they walk the market, hunt each other and hunt you */
  const NAMES = ['Chidi', 'Bisi', 'Tunde', 'Ngozi', 'Emeka', 'Aisha', 'Musa', 'Funke', 'Segun'];
  const ARMS_FOR = ['rifle', 'smg', 'rifle', 'pistol', 'shotgun', 'smg', 'rifle', 'sniper', 'shotgun'];
  let NAV = null;
  function nav(){ return NAV || (NAV = BOTS.makeNav(LAYOUT.play, (x, z) => inPlay(x, z, -1.5) && !blockedAt(x, z, 0.5) && !inFootprint(x, z, 0.15))); }
  function botWorld(){ const w = S.W; w.now = S.now; return w; }
  function farSpot(){
    let best = null, bd = -1;
    for (let i = 0; i < 24; i++){ const s = nav().randomSpot(Math.random), d = Math.min(...[S.me, ...S.bots].filter(f => f.alive).map(f => Math.hypot(f.x - s[0], f.z - s[1])), 1e6); if (d > bd){ bd = d; best = s; } }
    return best;
  }
  const norm = n => n.replace(/^mixamorig:?/, '').replace(/_\d+$/, '');
  function outfit(b){
    const A = b.A, want = { RightHand:0, LeftHand:0, LeftArm:0, LeftForeArm:0, RightHandMiddle1:0, Spine:0, Spine1:0, Spine2:0 }; A.b = {};
    A.inner.traverse(o => { if (o.isBone && norm(o.name) in want) A.b[norm(o.name)] = o; });
    rigUp(A); gunFor(b);
  }
  // swap the hide and seek moves for the rifle set, and close the fingers round the gun for good
  function rigUp(A){
    for (const k in A.acts) A.acts[k].stop();
    const C = GAME.S.rifle[A.name]; A.r = {}; A.on = {}; A.phase = Math.random(); A.baseY = A.inner.position.y; A.lifts = GAME.S.lifts[A.name]; A.lift = A.lifts.Idle || 0;
    A.inner.traverse(o => { if (o.isBone && norm(o.name) === 'Hips') A.hips = o; });
    for (const k in C){
      if (k === 'Grip'){ for (const t of C.Grip.tracks){ const bone = A.inner.getObjectByName(t.name.slice(0, t.name.lastIndexOf('.'))); if (bone) bone.quaternion.fromArray(t.values); } continue; }
      const a = A.r[k] = A.mixer.clipAction(C[k]);
      if (/^Die|^JumpUp|^JumpDown/.test(k)){ a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
      else if (!/Idle|Loop/.test(k)) a.timeScale = 0;   // the moving clips are placed by hand so their footsteps stay in step
    }
  }
  // only the clips in use run, which keeps ten fighters cheap on a phone
  function setOn(A, want){
    for (const k in A.on) if (!(k in want)){ A.r[k].stop(); delete A.on[k]; }
    for (const k in want){ const a = A.r[k]; if (!A.on[k]){ a.play(); A.on[k] = 1; } a.setEffectiveWeight(want[k]); }
  }
  function gunFor(b){
    const A = b.A, g = new THREE.Group(), id = b.weapon, L = { pistol:0.2, smg:0.36, rifle:0.72, shotgun:0.78, sniper:0.95, knife:0.2 }[id];
    const model = modelFor(id);
    if (model){ model.rotation.y = Math.PI; g.add(model); }
    else { part(g, STEEL, 0.045, 0.06, L * 0.6, 0, 0.02, L * 0.12); part(g, id === 'rifle' || id === 'shotgun' || id === 'sniper' ? WOOD : PLASTIC, 0.04, 0.09, L * 0.3, 0, -0.01, -L * 0.25); tube(g, DARK, 0.012, L * 0.45, 0, 0.03, L * 0.5); part(g, PLASTIC, 0.03, 0.09, 0.05, 0, -0.06, 0); }
    const fl = new THREE.Sprite(FLASH.material); fl.position.set(0, 0.03, L * 0.75); fl.scale.setScalar(0.55); fl.visible = false; g.add(fl); g.userData.fl = fl;
    A.root.add(g); A.gun = g; A.flashT = 0; A.short = { pistol:[0.05, -0.05], smg:[0.2, -0.03] }[id] || null;
  }
  const _q0 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _y = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _yq = new THREE.Quaternion();
  const _hl = new THREE.Vector3(), _hr = new THREE.Vector3(), _ax = new THREE.Vector3(), _m = new THREE.Matrix4(), _o = new THREE.Vector3();
  // turn one spine bone around a world axis on top of the animation
  function bend(bone, axis, amt){
    if (!bone) return;
    bone.updateWorldMatrix(true, false); bone.getWorldQuaternion(_q0); _yq.setFromAxisAngle(axis, amt).multiply(_q0); bone.parent.getWorldQuaternion(_q2).invert(); bone.quaternion.copy(_q2.multiply(_yq));
  }
  const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const clamp01 = v => Math.max(0, Math.min(1, v)), SIDE = ['F', 'L', 'B', 'R'];
  // blend the two nearest directions of walking, running or crouching, however the fighter is moving against where they face
  function animBody(b, dt){
    const A = b.A, s = b.speed || 0, st = b.stance || 0, yaw = b.aimYaw ?? b.ry, sn = Math.sin(yaw), cs = Math.cos(yaw), vx = b.vx ?? sn * s, vz = b.vz ?? cs * s;
    const f = vx * sn + vz * cs, l = vx * cs - vz * sn, mv = clamp01(s / 0.5), want = {}, ang = Math.atan2(l, f), q = (ang / (Math.PI / 2) + 4) % 4, i = Math.floor(q), t = q - i;
    want[['Idle', 'CrouchIdle', 'ProneIdle'][st]] = 1 - mv;
    const add = (pre, w) => { if (w <= 0.01) return; if (1 - t > 0.01) want[pre + SIDE[i % 4]] = (want[pre + SIDE[i % 4]] || 0) + w * (1 - t); if (t > 0.01) want[pre + SIDE[(i + 1) % 4]] = (want[pre + SIDE[(i + 1) % 4]] || 0) + w * t; };
    let stride = 1.58;
    if (mv > 0){
      if (st === 2){ want[f >= 0 ? 'ProneF' : 'ProneB'] = mv; stride = 0.9; }
      else if (st === 1){ add('Crouch', mv); stride = 1.67; }
      else {
        const r = clamp01((s - 2.2) / 1), sp = Math.abs(ang) < 0.6 ? clamp01((s - 4.3) / 0.5) : 0;
        add('Walk', mv * (1 - r)); add('Run', mv * r * (1 - sp)); if (sp > 0) want.Sprint = mv * r * sp;
        stride = 1.58 + (1.97 - 1.58) * r + sp * 0.99;
      }
    }
    setOn(A, want);
    A.phase = (A.phase + dt * s / stride) % 1;
    for (const k in want) if (!/Idle/.test(k)){ const a = A.r[k]; a.time = A.phase * a.getClip().duration; }
    A.mixer.update(dt); liftTo(A, want, dt);
  }
  // keep the soles on the ground whatever move is playing, using the heights measured when the fighters loaded
  function liftTo(A, want, dt){
    let sum = 0, y = 0; for (const k in want){ const w = want[k]; sum += w; y += (A.lifts[k] || 0) * w; }
    if (sum > 0) y /= sum;
    A.lift += (y - A.lift) * Math.min(1, dt * 12); A.inner.position.y = A.baseY + A.lift;
  }
  // the gun sits in the right hand and points through the left, so it follows every pose; the chest tips to the aim and squares up with the target
  function holdGun(A, r){
    const B = A.b; if (!B.RightHand || !B.LeftHand || !A.gun) return;
    (B.RightHandMiddle1 || B.RightHand).updateWorldMatrix(true, false); B.LeftHand.updateWorldMatrix(true, false);
    B.RightHand.getWorldPosition(_hr); B.LeftHand.getWorldPosition(_hl); r.worldToLocal(_hr); r.worldToLocal(_hl);
    _d.copy(_hl).sub(_hr).normalize();
    _m.lookAt(_d, _o, _y); A.gun.quaternion.setFromRotationMatrix(_m); A.gun.position.copy(_hr);
  }
  // pistols and SMGs are shorter than the rifle the moves were made for, so the left arm reaches in to the gun instead of hanging in the air
  const _a0 = new THREE.Vector3(), _e0 = new THREE.Vector3(), _h0 = new THREE.Vector3(), _t0 = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _qs = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qw = new THREE.Quaternion();
  function swing(bone, from, to){
    _qs.setFromUnitVectors(from, to); bone.getWorldQuaternion(_qw); bone.parent.getWorldQuaternion(_qp).invert();
    bone.quaternion.copy(_qp).multiply(_qs).multiply(_qw); bone.updateMatrixWorld(true);
  }
  function reachGun(A, r){
    const B = A.b; if (!B.LeftArm || !B.LeftForeArm) return;
    r.getWorldPosition(_t0); if (_t0.distanceToSquared(camera.position) > 900) return;
    _t0.copy(_hr).addScaledVector(_d, A.short[0]); _t0.y += A.short[1]; r.localToWorld(_t0);
    B.LeftHand.updateWorldMatrix(true, false); B.LeftArm.getWorldPosition(_a0); B.LeftForeArm.getWorldPosition(_e0); B.LeftHand.getWorldPosition(_h0);
    const la = _a0.distanceTo(_e0), lb = _e0.distanceTo(_h0), lt = Math.max(0.05, Math.min(la + lb - 0.002, _a0.distanceTo(_t0)));
    _v1.copy(_t0).sub(_a0).normalize(); _v2.copy(_e0).sub(_a0); _v2.addScaledVector(_v1, -_v2.dot(_v1)).normalize();   // the elbow stays on the side it was already pointing
    const cs = (la * la + lt * lt - lb * lb) / (2 * la * lt), sn = Math.sqrt(Math.max(0, 1 - cs * cs));
    _h0.copy(_a0).addScaledVector(_v1, la * cs).addScaledVector(_v2, la * sn);   // the new elbow
    _v1.copy(_e0).sub(_a0).normalize(); _v2.copy(_h0).sub(_a0).normalize(); swing(B.LeftArm, _v1, _v2);
    B.LeftHand.updateWorldMatrix(true, false); B.LeftForeArm.getWorldPosition(_e0); B.LeftHand.getWorldPosition(_h0);
    _v1.copy(_h0).sub(_e0).normalize(); _v2.copy(_t0).sub(_e0).normalize(); swing(B.LeftForeArm, _v1, _v2);
  }
  function aimPose(b){
    const A = b.A, B = A.b, r = A.root, p = Math.max(-0.9, Math.min(0.9, b.aimPitch || 0)), yaw = b.aimYaw;
    _ax.set(Math.cos(yaw), 0, -Math.sin(yaw)); bend(B.Spine1, _ax, -p * 0.5); bend(B.Spine2, _ax, -p * 0.5);
    holdGun(A, r);
    const err = Math.atan2(_d.x, _d.z);
    if (Math.abs(err) < 1.3){ bend(B.Spine2, _y, -err); holdGun(A, r); }
    if (A.short) reachGun(A, r);
  }
  /* ---------------- going down: there is no death animation in the character files, so the body falls under code */
  const POOL = new THREE.CircleGeometry(0.55, 16), POOLM = new THREE.MeshBasicMaterial({ color:0x4a0806, transparent:true, opacity:0.8, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-3 });
  function fall(T, fromX, fromZ){
    const A = T.A, yaw = T.aimYaw ?? T.ry, rel = wrapA(Math.atan2(T.x - fromX, T.z - fromZ) - yaw), st = T.stance || 0, abs = Math.abs(rel);
    const k = st === 2 ? 'DieProne' : st === 1 ? 'DieCrouch' : abs < 0.8 ? 'DieBack' : abs > 2.3 ? (Math.random() < 0.35 ? 'DieHead' : 'DieFront') : 'DieRight', a = A.r[k];
    setOn(A, {}); a.reset(); a.timeScale = 1.25; a.setEffectiveWeight(1); a.play(); A.on[k] = 1; A.dieClip = k;
    T.fall = { t:0, land:a.getClip().duration / 1.25 * 0.42, landed:false };
  }
  function tickFall(T, dt){
    const F = T.fall, A = T.A; if (!F) return;
    F.t += dt; A.mixer.update(dt); liftTo(A, { [A.dieClip]:1 }, dt * 0.5);
    if (A.gun && !F.landed) holdGun(A, A.root);
    if (T.deadT >= 0.7) A.root.position.set(T.x, T.y, T.z);
    if (!F.landed && F.t >= F.land){
      F.landed = true; if (A.gun) A.gun.visible = false;
      const d = Math.hypot(T.x - S.me.x, T.z - S.me.z); blast(0.25 / (1 + d / 8), 0.1, 400, 0.8); thump(0.22 / (1 + d / 8), 80, 0.14);
      const at = A.hips.getWorldPosition(new THREE.Vector3());
      const m = new THREE.Mesh(POOL, POOLM); m.rotation.x = -Math.PI / 2; m.position.set(at.x, T.y + 0.02, at.z); m.scale.setScalar(0.1); scene.add(m); F.pool = m;
    }
    if (F.pool && F.pool.scale.x < 1) F.pool.scale.setScalar(F.pool.scale.x + dt * 0.9);
    // the body stays down a while, then sinks out of the way before the respawn
    if (T.deadT < 0.7){ A.root.position.y -= (0.7 - T.deadT) * 0.5; if (F.pool) F.pool.material.opacity = 0.8; }
  }
  function standUp(T){
    const A = T.A; if (T.fall && T.fall.pool) scene.remove(T.fall.pool); T.fall = null; A.root.rotation.set(0, T.ry, 0); A.root.visible = true; if (A.gun) A.gun.visible = true;
    setOn(A, {});
  }
  /* ---------------- a health bar over every fighter */
  const BARG = new THREE.PlaneGeometry(1, 1), BARBG = new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.55, fog:false, depthWrite:false });
  function addBar(T, ally){
    const g = new THREE.Group(), bgm = ally ? new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.55, fog:false, depthWrite:false, depthTest:false }) : BARBG, bg = new THREE.Mesh(BARG, bgm), fg = new THREE.Mesh(BARG, new THREE.MeshBasicMaterial({ color:0x3fbf5f, fog:false, depthWrite:false, depthTest:!ally }));
    bg.scale.set(0.56, 0.085, 1); fg.position.z = 0.002; g.add(bg, fg); g.renderOrder = 2; fg.renderOrder = 3; bg.renderOrder = 2; scene.add(g); T.bar = { g, fg, ally };
    if (ally){   // teammates show their name, and you can see them through walls
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.font = '800 40px Arial'; x.textAlign = 'center'; x.fillStyle = '#8fc1ff'; x.strokeStyle = '#000'; x.lineWidth = 6; x.strokeText(T.name, 128, 46); x.fillText(T.name, 128, 46);
      const n = new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(c), depthTest:false, depthWrite:false, fog:false, transparent:true })); n.scale.set(0.9, 0.225, 1); n.position.y = 0.17; n.renderOrder = 4; g.add(n);
    }
  }
  function drawBars(){
    for (const T of S.fight ? S.bots : S.targets){
      const B = T.bar; if (!B) continue; const d = Math.hypot(T.x - camera.position.x, T.z - camera.position.z);
      B.g.visible = T.alive && (d < 90 || B.ally); if (!B.g.visible) continue;
      const h = T.hp / T.maxHp, zoom = Math.max(1, d / 22); B.g.position.set(T.x, T.y + 2.02, T.z); B.g.quaternion.copy(camera.quaternion); B.g.scale.setScalar(zoom);
      B.fg.scale.set(0.52 * Math.max(0.001, h), 0.05, 1); B.fg.position.x = -0.26 * (1 - h); B.fg.material.color.setHex(B.ally ? 0x3a8bff : h > 0.6 ? 0x3fbf5f : h > 0.3 ? 0xe5b12a : 0xe1201a);
    }
  }
  function elim(name){ const e = el('#shElim'); e.innerHTML = `<b>Dropped</b> ${name}`; e.style.opacity = 1; clearTimeout(S.elimT); S.elimT = setTimeout(() => { e.style.opacity = 0; }, 1500); }
  function botShot(b, shot, o){
    const w = W[shot.weapon], d0 = Math.hypot(b.x - camera.position.x, b.z - camera.position.z), hand = b.A.gun, world = S.W;
    bang(shot.weapon, Math.max(1, d0));
    b.A.flashT = 0.05; BOTS.hearShot(S.bots, b.x, b.z, b, world);
    hand.updateWorldMatrix(true, false); hand.getWorldPosition(_a);
    const all = S.W.fighters.filter(f => b.team === null || f.team !== b.team), hits = new Map();   // no friendly fire
    shot.dirs.forEach((d, i) => {
      const hit = R.traceShot(o, d, w.range, all, near, b), x = o[0] + d[0] * hit.t, y = o[1] + d[1] * hit.t, z = o[2] + d[2] * hit.t;
      if (i % 3 === 0) tracer(_a.x, _a.y, _a.z, x, y, z);
      if (hit.t < w.range && d0 < 60) impact(x, y, z, o, !!hit.target);
      if (hit.target) hits.set(hit.target, (hits.get(hit.target) || 0) + R.damageAt(shot.weapon, hit.t, hit.zone));
    });
    for (const [T, dmg] of hits){ const res = R.applyDamage(T, dmg); T.lastHitBy = b; T.lastHitAt = S.now; if (T === S.me) hurtMe(res.dealt, b); if (res.killed) downed(T, b); }
  }
  function hurtMe(dmg, from){
    S.hurtT = 0.45; S.hurtFrom = Math.atan2(from.x - S.me.x, from.z - S.me.z); blast(0.3, 0.09, 700, 1); thump(0.3, 130, 0.12);
  }
  function feed(html){ const d = document.createElement('div'); d.innerHTML = html; const f = el('#shFeed'); f.appendChild(d); while (f.children.length > 4) f.firstChild.remove(); setTimeout(() => d.remove(), 5000); }
  function downed(T, by){
    if (by) by.kills = (by.kills || 0) + 1; T.deaths = (T.deaths || 0) + 1;
    const nm = f => !f ? 'The zone' : f === S.me ? 'You' : f.name; feed(`${nm(by)} <b>dropped</b> ${nm(T)}`);
    if (by === S.me) elim(T.name);
    else if (T !== S.me && T.meHitAt && S.now - T.meHitAt < 6){ S.assists++; feed('Assist on ' + T.name); }
    if (T === S.me){ S.deadT = S.oneLife ? 2 : 4; S.deadAge = 0; if (S.br) S.br.place = S.W.fighters.filter(f => f.alive).length + 1; T.ry = P.yaw + Math.PI; T.aimYaw = T.ry; T.A.root.position.set(P.x, P.y, P.z); T.A.root.rotation.set(0, T.ry, 0); T.deadT = 1e9; fall(T, by ? by.x : T.x + 1, by ? by.z : T.z); P.frozen = true; S.trigger = false; S.ads = false; el('#shDead').hidden = false; el('#shDeadBy').textContent = by ? `${by.name} got you with the ${W[by.weapon].name.toLowerCase()}` : 'The zone got you'; }
    else { T.deadT = S.oneLife ? 1e9 : 5 + Math.random() * 2; T.meHitAt = 0; S.stats.kills += by === S.me ? 1 : 0; fall(T, by ? by.x : T.x + 1, by ? by.z : T.z); }
    if (S.net) return;
    if (S.team) checkRound(); else if (S.br) checkBR();
  }
  function tickBots(dt){
    const Wd = botWorld(); let f = S.me; f.x = P.x; f.y = P.y; f.z = P.z; f.stance = S.stance; f.proneYaw = Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw)); const m = moveState(); f.speed = m.moving ? (m.running ? 7 : 4.3) : 0;
    if (S.deadT > 0 && S.oneLife){ S.deadT -= dt; if (S.deadT <= 0){ if (S.br && !S.squad) finishBR(); else enterSpec(); } }
    else if (S.deadT > 0){ S.deadT -= dt; if (S.deadT <= 0){ const keep = { kills:f.kills, deaths:f.deaths, w:f.weapon }; const s = farSpot(); S.me = Object.assign(R.newFighter({ weapon:keep.w }), { kills:keep.kills, deaths:keep.deaths, x:s[0], z:s[1], A:f.A, fall:f.fall }); standUp(S.me); Wd.fighters[0] = S.me; P.x = s[0]; P.z = s[1]; P.y = groundAt(s[0], s[1], 2); P.frozen = false; P.vy = 0; el('#shDead').hidden = true; setStance(0); } }
    for (const b of S.bots){
      if (!b.alive){ if (!S.oneLife) b.deadT -= dt; if (b.deadT <= 0){ BOTS.respawn(b, farSpot(), Wd); standUp(b); } else { tickFall(b, dt); continue; } }
      if (S.net) netMove(b, dt); else if (held()){ b.speed = 0; b.vx = b.vz = 0; } else BOTS.step(b, dt, Wd);
      b.A.root.position.set(b.x, b.y, b.z); b.A.root.rotation.set(0, b.aimYaw, 0);
      animBody(b, dt);
      if (b.alive){ aimPose(b); const fl = b.A.gun.userData.fl; if (b.A.flashT > 0){ b.A.flashT -= dt; fl.visible = true; } else fl.visible = false; }
    }
    if (S.hurtT > 0){ S.hurtT -= dt; el('#shHurt').style.opacity = Math.min(1, S.hurtT * 3); const dd = el('#shDir'); dd.style.opacity = Math.min(1, S.hurtT * 3); dd.style.transform = `rotate(${(P.yaw + Math.PI - S.hurtFrom) * 180 / Math.PI}deg)`; }
    else { el('#shHurt').style.opacity = 0; el('#shDir').style.opacity = 0; }
  }

  /* ---------------- playing online: the server decides everything, this side draws it */
  const netClock = () => performance.now() / 1000 + (S.netOff || 0) - 0.15;   // the moment of the match this screen is showing
  async function netPrep(m){
    const me = m.roster[m.you], side = me.team, list = {}; for (const r of m.roster) list[r.char] = byId(r.char).h;
    S.plan = { me:me.char, mates:[], foes:[], others:[], names:[m.names[side], m.names[1 - side]] };
    const c = byId(me.char); await GAME.debug.loadFighters(list, c.arms ? { [c.id]:c.arms } : {});
  }
  function netFighters(link){
    const m = link.m, side = m.roster[m.you].team; S.netSide = side; S.map = [];
    m.roster.forEach((r, i) => {
      if (i === m.you){ S.map[i] = S.me; return; }
      const team = r.team === side ? 0 : 1, b = R.newFighter({ id:'n' + i, team, weapon:r.weapon });
      Object.assign(b, { name:r.name, ry:0, aimYaw:0, aimPitch:0, speed:0, stance:0, vx:0, vz:0, kills:0, deaths:0, buf:[] });
      b.A = GAME.debug.makeAvatar(r.char); outfit(b); b.A.gearId = b.weapon; addBar(b, team === 0); S.bots.push(b); S.W.fighters.push(b); S.map[i] = b;
    });
    S.me.team = 0;
  }
  function netMove(b, dt){
    const B = b.buf, t = netClock(); if (!B.length) return;
    let p = B[0], q = B[B.length - 1]; for (let i = 0; i < B.length - 1; i++) if (B[i][0] <= t && B[i + 1][0] >= t){ p = B[i]; q = B[i + 1]; break; }
    if (t > q[0]) p = q;
    const u = q[0] > p[0] ? clamp01((t - p[0]) / (q[0] - p[0])) : 1, ox = b.x, oz = b.z, mix = i => p[i] + (q[i] - p[i]) * u, turn = i => p[i] + wrapA(q[i] - p[i]) * u, k = 1 / Math.max(dt, 0.001), s = Math.min(1, dt * 10);
    b.x = mix(1); b.y = mix(2); b.z = mix(3); b.ry = turn(4); b.aimYaw = turn(5); b.aimPitch = mix(6); b.speed = mix(7); b.stance = q[8];
    b.vx += ((b.x - ox) * k - b.vx) * s; b.vz += ((b.z - oz) * k - b.vz) * s;
  }
  function netRound(a){
    const [, n, s0, s1, freeze, t, spawns, alive] = a, side = S.netSide, Wd = botWorld(), mine = S.net.m.you;
    S.round = { n, t, freeze, over:0, done:false }; S.score = side === 0 ? [s0, s1] : [s1, s0]; Wd.intel = {};
    S.map.forEach((f, i) => {
      const [x, z, y, ry] = spawns[i];
      if (i === mine){
        const A = f.A; if (f.fall && f.fall.pool) scene.remove(f.fall.pool); f.fall = null;
        S.me = Object.assign(R.newFighter({ weapon:f.weapon, team:0 }), { kills:f.kills, deaths:f.deaths, x, z, y, A, aimYaw:ry, ry }); S.map[i] = S.me; Wd.fighters[0] = S.me;
        A.root.visible = false; A.root.rotation.set(0, 0, 0);
        P.x = x; P.z = z; P.y = y; P.vy = 0; P.pitch = 0; P.yaw = ry - Math.PI; P.frozen = freeze > 0; S.vx = S.vz = 0; S.deadT = 0; S.spec = null; S.climb = null;
        S.stance = 1; setStance(0); S.eyeDrop = 0; S.hurtT = 0; el('#shDead').hidden = true; el('#shSpec').hidden = true;
      } else {
        Object.assign(f, { x, z, y, ry, aimYaw:ry, hp:f.maxHp, alive:!!alive[i], speed:0, vx:0, vz:0, buf:[], meHitAt:0 }); standUp(f);
        if (!f.alive){ f.deadT = 1e9; f.A.root.visible = false; }
      }
    });
    banner('Round ' + n, `${S.plan.names[0]} ${S.score[0]} – ${S.score[1]} ${S.plan.names[1]} · first to ${WIN_AT}`);
  }
  function netMsg(a){
    if (!S.active || !S.net || S.ended && a[0] !== 'E') return;
    const k = a[0], F = S.map;
    if (k === 'S'){
      const t = a[1], off = t - performance.now() / 1000; S.netOff = S.netOff === null ? off : S.netOff + (off - S.netOff) * 0.05;
      a[2].forEach((r, i) => {
        const f = F[i]; f.hp = r[8]; f.armor = r[9]; if (f === S.me) return;
        f.buf.push([t, ...r]); if (f.buf.length > 10) f.buf.shift();
        const gun = R.ORDER[r[10]]; if (gun && gun !== f.weapon){ f.weapon = gun; f.A.gearId = gun; regear(f); }
      });
    } else if (k === 'R') netRound(a);
    else if (k === 'f'){
      const b = F[a[1]]; if (!b || b === S.me) return;
      const id = R.ORDER[a[2]], d0 = Math.hypot(b.x - camera.position.x, b.z - camera.position.z); bang(id, Math.max(1, d0)); b.A.flashT = 0.05;
      if (W[id].melee) return;
      b.A.gun.updateWorldMatrix(true, false); b.A.gun.getWorldPosition(_a); tracer(_a.x, _a.y, _a.z, a[6], a[7], a[8]);
      if (d0 < 60) impact(a[6], a[7], a[8], [a[3], a[4], a[5]], false);
    } else if (k === 'h'){
      const T = F[a[1]], by = F[a[2]], dmg = a[3], head = !!a[4];
      if (T === S.me){ S.me.hp = Math.max(0, S.me.hp - dmg); hurtMe(dmg, by); }
      if (by === S.me){ floatNum(a[5], a[6], a[7], dmg, head); hitMark(head); click(0.22, head ? 4800 : 3400); S.stats.hits++; if (head) S.stats.heads++; if (T !== S.me){ T.lastHitBy = S.me; T.meHitAt = S.now; } }
    } else if (k === 'k'){
      const T = F[a[1]], by = F[a[2]]; if (!T.alive && T.fall) return; T.alive = false; T.hp = 0; if (T === S.me){ setTrigger(false); } downed(T, by);
    } else if (k === 'r'){
      const r = S.round; r.done = true; r.over = 1e9; const w = a[1] === null ? null : a[1] === S.netSide ? 0 : 1, names = S.plan.names, mine = w === 0;
      S.score = S.netSide === 0 ? [a[3], a[4]] : [a[4], a[3]];
      banner(w === null ? 'Draw' : mine ? 'Round won' : 'Round lost', a[2] === 'time' ? 'Time up' : `${names[1 - (w ?? 0)]} wiped out`, w === null ? '' : mine ? 'win' : 'lose'); thump(0.3, mine ? 220 : 110, 0.4);
    } else if (k === 'E'){
      S.score = S.netSide === 0 ? [a[1], a[2]] : [a[2], a[1]]; a[3].forEach((v, i) => { F[i].kills = v[0]; F[i].deaths = v[1]; }); showEnd();
    }
  }
  function netLost(){ if (!S.active) return; toast('You lost the connection to the match', 3000); stop(); }
  const netNote = m => { if (S.active) feed(m.replace(/[<>&]/g, '')); };
  const myPick = () => savedPick().id;

  /* ---------------- free-for-all: first to the kill target wins, or most kills when time runs out */
  const FFA_GOAL = 15, FFA_TIME = 360;
  function tickFFA(dt){
    if (S.ffaEnd > 0){ S.ffaEnd -= dt; if (S.ffaEnd <= 0) finishFFA(); return; }
    S.ffaT -= dt;
    const lead = S.W.fighters.reduce((a, b) => (b.kills || 0) > (a.kills || 0) ? b : a);
    if ((lead.kills || 0) >= FFA_GOAL || S.ffaT <= 0){ S.ffaEnd = 1.5; banner(lead === S.me ? 'You got there first' : lead.name + ' got there first', S.ffaT <= 0 ? 'Time up' : FFA_GOAL + ' kills', lead === S.me ? 'win' : 'lose'); }
  }
  function finishFFA(){
    S.ended = true; setTrigger(false); S.ads = false; P.frozen = true; banner(); el('#shDead').hidden = true;
    const all = S.W.fighters.slice().sort((a, b) => (b.kills || 0) - (a.kills || 0) || (a.deaths || 0) - (b.deaths || 0)), place = all.indexOf(S.me) + 1, h = el('#shEndT');
    h.textContent = place === 1 ? 'You won' : '#' + place + ' of 10'; h.className = place === 1 ? 'win' : 'lose';
    el('#shEndS').textContent = `Free-for-all · ${S.diff} · ${S.me.kills} kill${S.me.kills === 1 ? '' : 's'}, ${S.assists} assist${S.assists === 1 ? '' : 's'}`;
    const row = f => `<tr class="${f === S.me ? 'me' : ''}"><td>${f === S.me ? 'You' : f.name}</td><td>${f.kills || 0}</td><td>${f.deaths || 0}</td></tr>`, tab = l => `<table><tr class="sep"><td>Player</td><td>Kills</td><td>Deaths</td></tr>${l.map(row).join('')}</table>`;
    el('#shEndB').innerHTML = `<section>${tab(all.slice(0, 5))}${tab(all.slice(5))}</section>`;
    el('#shEnd').hidden = false; if (document.pointerLockElement) document.exitPointerLock();
  }

  /* ---------------- battle royale: one life, loot the market, stay inside the shrinking zone */
  const held = () => S.team ? S.round.freeze > 0 || S.round.over > 0 : S.br ? S.br.freeze > 0 : false;
  const LOOT = [['gun', 'rifle', 5], ['gun', 'smg', 4], ['gun', 'shotgun', 3], ['gun', 'sniper', 2], ['ammo', '', 11], ['armor', '', 8], ['med', '', 9]];
  function itemMesh(it){
    const g = new THREE.Group();
    const model = it.kind === 'gun' && modelFor(it.weapon);
    if (model){ model.rotation.z = 0.25; model.position.y = -0.1; g.add(model); }
    else if (it.kind === 'gun'){ const L = { smg:0.42, rifle:0.8, shotgun:0.82, sniper:1 }[it.weapon]; part(g, STEEL, 0.05, 0.07, L * 0.6, 0, 0, 0); part(g, it.weapon === 'smg' ? PLASTIC : WOOD, 0.045, 0.09, L * 0.3, 0, -0.01, L * 0.42); tube(g, DARK, 0.013, L * 0.45, 0, 0.01, -L * 0.5); if (it.weapon === 'sniper') tube(g, STEEL, 0.026, 0.28, 0, 0.07, 0); }
    else if (it.kind === 'ammo'){ part(g, mat(0x3d4a2b, 0.8, 0.1), 0.34, 0.2, 0.22, 0, 0, 0); part(g, mat(0xd0a73a, 0.5, 0.6), 0.2, 0.03, 0.06, 0, 0.11, 0); }
    else if (it.kind === 'armor'){ part(g, mat(0x24406e, 0.8, 0.05), 0.42, 0.5, 0.16, 0, 0, 0); part(g, mat(0x3a8bff, 0.6, 0.1), 0.2, 0.2, 0.17, 0, 0.05, 0); }
    else { part(g, mat(0xf2f2f2, 0.5, 0), 0.34, 0.24, 0.16, 0, 0, 0); part(g, mat(0xd6201a, 0.5, 0), 0.2, 0.06, 0.17, 0, 0, 0); part(g, mat(0xd6201a, 0.5, 0), 0.06, 0.18, 0.17, 0, 0, 0); }
    const glow = new THREE.Sprite(ITEMGLOW[it.kind]); glow.scale.setScalar(it.kind === 'gun' ? 1.1 : 0.85); g.add(glow);
    return g;
  }
  const glowM = c => new THREE.SpriteMaterial({ map:glowTex(c, 'rgba(255,255,255,.08)'), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, opacity:0.5 });
  const ITEMGLOW = { gun:glowM('rgba(255,190,70,.55)'), ammo:glowM('rgba(150,220,90,.5)'), armor:glowM('rgba(70,140,255,.6)'), med:glowM('rgba(255,70,60,.5)') };
  function spreadSpots(n, gap){
    const out = [], N = nav();
    for (let i = 0; i < n * 60 && out.length < n; i++){ const p = N.randomSpot(Math.random); if (out.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) >= gap)) out.push(p); }
    return out;
  }
  // shop counters you can reach from the street
  function counterSpots(){
    const out = [], N = nav();
    for (const b of LAYOUT.buildings){
      if (!b.play || b.kind !== 'shop') continue;
      const F = frame(b.cx, b.cz, b.ry), bays = Math.max(1, Math.round(b.w / 3.7)), bw = b.w / bays, zf = -b.d / 2;
      for (let k = 0; k < bays; k++){
        const lx = -b.w / 2 + (k + 0.5) * bw - 0.35, p = W_(F, lx, zf + 0.78), g = groundAt(p[0], p[1], 2);
        if (Math.abs(g - 1.05) > 0.08) continue;              // no counter in this bay
        const a = W_(F, lx, zf - 0.95); if (!N.isOpen(a[0], a[1])) continue;
        out.push({ x:p[0], z:p[1], y:g + 0.3, ax:a[0], az:a[1] });
      }
    }
    return out;
  }
  // alleys and gaps between building blocks, away from the open streets
  function alleySpots(){
    const N = nav(), out = [];
    const onStreet = (x, z) => LAYOUT.streets.some(st => st.pts.some((p, k) => k && segDist(x, z, st.pts[k - 1], p) < st.w / 2 + st.band + 1.5));
    for (const k of N.cells){ const p = N.centre(k); if (!onStreet(p[0], p[1])) out.push({ x:p[0], z:p[1], y:groundAt(p[0], p[1], 2) + 0.55, ax:p[0], az:p[1] }); }
    return out;
  }
  function placeLoot(){
    const list = []; for (const [kind, weapon, n] of LOOT) for (let i = 0; i < n; i++) list.push({ kind, weapon });
    const shuffle = a => a.sort(() => Math.random() - 0.5), used = [], take = (pool, want, gap) => { for (const s of shuffle(pool)){ if (used.length >= want) break; if (used.every(u => Math.hypot(u.x - s.x, u.z - s.z) >= gap)) used.push(s); } };
    take(counterSpots(), Math.ceil(list.length * 0.6), 4); take(alleySpots(), list.length, 4); take([...counterSpots(), ...alleySpots()], list.length, 1.5);
    S.lootSpots = used.length;
    shuffle(list).forEach((it, i) => { const s = used[i % used.length]; Object.assign(it, s); });
    // the best sniper spots: two rifles waiting on rooftops, ladders only
    S.ladders.slice(0, 3).forEach((L, i) => list.push({ kind:'gun', weapon:'sniper', x:L.inX, z:L.inZ, y:L.top + 0.55, roof:true }));
    for (const it of list){ it.m = itemMesh(it); it.m.position.set(it.x, it.y, it.z); it.m.userData.ph = Math.random() * 6; scene.add(it.m); }
    S.items = list;
  }
  function itemTaken(it, who){
    it.gone = true; scene.remove(it.m);
    if (who === S.me){
      const names = { ammo:'Ammo', armor:'Armour', med:'Medkit' }; elimLine(it.kind === 'gun' ? W[it.weapon].name : names[it.kind]);
      click(0.2, 2200); if (it.kind === 'gun' && R.BEST.indexOf(it.weapon) < R.BEST.indexOf(S.me.weapon) || (it.kind === 'gun' && W[S.me.weapon].melee)) swap(it.weapon);
    }
  }
  function elimLine(t){ const h = el('#shHint'); h.hidden = false; h.textContent = '+ ' + t; S.hintT = 1.3; }
  function tickItems(dt){
    const f = S.me, t = S.now;
    for (const it of S.items){
      if (it.gone) continue;
      it.m.rotation.y += dt * 1.2; it.m.position.y = it.y + Math.sin(t * 2 + it.m.userData.ph) * 0.06;
      if (f.alive && Math.hypot(it.x - P.x, it.z - P.z) < 1.5 && Math.abs(it.y - 0.55 - P.y) < 1.2 && R.takeItem(f, it)) itemTaken(it, f);
    }
    if (S.hintT > 0){ S.hintT -= dt; if (S.hintT <= 0) el('#shHint').hidden = true; }
  }
  function regear(b){ const A = b.A; A.root.remove(A.gun); gunFor(b); }
  const ZONEM = new THREE.MeshBasicMaterial({ color:0x3a6bff, transparent:true, opacity:0.2, side:THREE.DoubleSide, depthWrite:false, fog:false });
  const ZONEG = new THREE.CylinderGeometry(1, 1, 60, 96, 1, true);
  function nextCentre(cx, cz, r, nr){
    const N = nav();
    for (let i = 0; i < 80; i++){ const a = Math.random() * 6.28, d = Math.random() * Math.max(0, r - nr), x = cx + Math.cos(a) * d, y = cz + Math.sin(a) * d; if (N.isOpen(x, y)) return [x, y]; }
    return [cx, cz];
  }
  function startBR(){
    const c = LAYOUT.play, mx = (c[0] + c[2]) / 2, mz = (c[1] + c[3]) / 2;
    const s = S.me; S.W.items = S.items; S.W.onItem = itemTaken; S.W.onGear = regear; S.W.graceUntil = FREEZE + 30;
    const z = R.makeZone(mx, mz, 112, nextCentre); S.W.zone = z; S.br.zone = z; S.br.freeze = FREEZE; S.br.endIn = 0; S.br.tick = 0; S.br.place = 0;
    const wall = new THREE.Mesh(ZONEG, ZONEM); wall.renderOrder = 1; scene.add(wall); S.br.wall = wall;
    let spots;
    if (S.squad){ pickBases(); spots = [...huddle(S.bases[0], 5), ...huddle(S.bases[1], 5)]; }
    else spots = spreadSpots(10, 30);
    s.x = spots[0][0]; s.z = spots[0][1]; P.x = s.x; P.z = s.z; P.y = groundAt(s.x, s.z, 2); s.y = P.y; P.vy = 0; P.frozen = true;
    P.yaw = Math.atan2(-(mx - s.x), -(mz - s.z)); P.pitch = 0;
    S.bots.forEach((b, i) => { const p = spots[(i + 1) % spots.length]; b.x = b.lastX = p[0]; b.z = b.lastZ = p[1]; b.y = groundAt(p[0], p[1], 2); b.ry = b.aimYaw = Math.atan2(mx - p[0], mz - p[1]); });
    banner('Battle royale', S.squad ? 'Last team standing · find weapons fast' : 'Last one standing · find weapons fast');
  }
  function tickBR(dt){
    const B = S.br, Z = B.zone;
    if (B.freeze > 0){ B.freeze -= dt; if (B.freeze <= 0){ P.frozen = false; banner(); } }
    else R.zoneTick(Z, dt);
    // bots start cautious and turn more aggressive as the zone squeezes everyone together
    S.W.sightMul = [0.45, 0.6, 0.75, 0.9, 1, 1][Z.phase]; S.W.hunt = [0.05, 0.12, 0.25, 0.45, 0.7, 0.9][Z.phase];
    // pacing: in a map this small bots would finish each other in a minute, so they only thin out as fast as the zone closes
    const alive = S.W.fighters.filter(f => f.alive).length, keep = [9, 8, 7, 6, 5, 1][Z.phase]; S.W.truce = alive <= keep;
    if (B.endIn > 0){ B.endIn -= dt; if (B.endIn <= 0){ finishBR(); return; } }
    B.wall.position.set(Z.cx, 28, Z.cz); B.wall.scale.set(Z.r, 1, Z.r);
    const outside = S.me.alive && !R.inZone(Z, P.x, P.z);
    el('#shZoneWarn').hidden = !outside; el('#shBurn').style.opacity = outside ? 0.8 : 0;
    // outside the zone your health drains steadily until you get back in, and it drains faster every phase
    if (B.freeze <= 0){
      for (const f of S.W.fighters){ if (!f.alive || R.inZone(Z, f.x, f.z)) continue; if (R.burn(f, Z.dps * dt)) downed(f, null); }
      B.tick -= dt; if (outside && B.tick <= 0){ B.tick = 0.9; blast(0.14, 0.08, 500, 1); S.hurtFrom = null; }
    }
  }
  function checkBR(){
    const B = S.br; if (B.endIn > 0 || S.ended) return;
    const left = S.W.fighters.filter(f => f.alive);
    const over = S.squad ? !teamOf(0).some(f => f.alive) || !teamOf(1).some(f => f.alive) : left.length <= 1 && S.me.alive;
    if (over){ B.endIn = 2; B.won = S.squad ? teamOf(0).some(f => f.alive) : S.me.alive; }
  }
  function finishBR(){
    const B = S.br; if (S.ended) return; S.ended = true; setTrigger(false); S.ads = false; P.frozen = true; banner(); el('#shSpec').hidden = true; el('#shDead').hidden = true; el('#shZoneWarn').hidden = true; el('#shBurn').style.opacity = 0;
    const won = B.endIn >= 0 && (S.squad ? teamOf(0).some(f => f.alive) && !teamOf(1).some(f => f.alive) : S.me.alive), h = el('#shEndT');
    h.textContent = won ? (S.squad ? 'Your team won' : 'Last one standing') : S.squad ? 'Your team fell' : '#' + B.place + ' of 10'; h.className = won ? 'win' : 'lose';
    el('#shEndS').textContent = `Battle royale · ${S.squad ? 'Teams' : 'Solo'} · ${S.diff} · you got ${S.me.kills} kill${S.me.kills === 1 ? '' : 's'}`;
    const all = S.W.fighters.slice().sort((a, b) => (b.kills || 0) - (a.kills || 0));
    const row = f => `<tr class="${f === S.me ? 'me' : ''}"><td>${f === S.me ? 'You' : f.name}</td><td>${f.kills || 0}</td><td>${f.alive ? 'Alive' : 'Down'}</td></tr>`, tab = l => `<table><tr class="sep"><td>Player</td><td>Kills</td><td></td></tr>${l.map(row).join('')}</table>`;
    el('#shEndB').innerHTML = `<section>${tab(all.slice(0, 5))}${tab(all.slice(5))}</section>`;
    el('#shEnd').hidden = false; if (document.pointerLockElement) document.exitPointerLock();
  }

  /* ---------------- team battle: rounds with no respawns, first to three wins */
  const WIN_AT = 3, ROUND_TIME = 180, FREEZE = 2.5, BETWEEN = 4.5;
  const teamOf = i => S.W.fighters.filter(f => f.team === i), clock = t => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  function banner(title, sub, cls){ const b = el('#shBanner'); b.hidden = !title; b.className = cls || ''; b.children[0].textContent = title || ''; b.children[1].textContent = sub || ''; }
  function huddle(c, n){
    const list = nav().cells.map(nav().centre).sort((a, b) => Math.hypot(a[0] - c[0], a[1] - c[1]) - Math.hypot(b[0] - c[0], b[1] - c[1])), out = [];
    for (const p of list){ if (out.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) >= 2.4)){ out.push(p); if (out.length === n) break; } }
    return out;
  }
  function pickBases(){
    const n = nav(), a = n.randomSpot(Math.random); let b = a, bd = 0;
    for (const k of n.cells){ const p = n.centre(k), d = Math.hypot(p[0] - a[0], p[1] - a[1]); if (d > bd){ bd = d; b = p; } }
    let c = b; bd = 0; for (const k of n.cells){ const p = n.centre(k), d = Math.hypot(p[0] - b[0], p[1] - b[1]); if (d > bd){ bd = d; c = p; } }
    S.bases = [b, c];
  }
  function newRound(n){
    const flip = n % 2 === 0, home = S.bases[flip ? 1 : 0], away = S.bases[flip ? 0 : 1], Wd = botWorld();
    S.round = { n, t:ROUND_TIME, freeze:FREEZE, over:0, done:false }; Wd.intel = {};
    const us = huddle(home, 5), them = huddle(away, 5), f = S.me, s = us[0];
    const A = f.A; if (f.fall && f.fall.pool) scene.remove(f.fall.pool); f.fall = null;
    S.me = Object.assign(R.newFighter({ weapon:f.weapon, team:0 }), { kills:f.kills, deaths:f.deaths, x:s[0], z:s[1], A }); Wd.fighters[0] = S.me;
    A.root.visible = false; A.root.rotation.set(0, 0, 0);
    P.x = s[0]; P.z = s[1]; P.y = groundAt(s[0], s[1], 2); S.me.y = P.y; P.vy = 0; P.pitch = 0; P.yaw = Math.atan2(-(away[0] - s[0]), -(away[1] - s[1])); P.frozen = true; S.vx = S.vz = 0; S.deadT = 0; S.spec = null; S.climb = null;
    S.stance = 1; setStance(0); S.eyeDrop = 0; S.hurtT = 0; el('#shDead').hidden = true; el('#shSpec').hidden = true;
    let a = 1, e = 0;
    for (const b of S.bots){ const p = b.team === 0 ? us[a++] : them[e++]; BOTS.respawn(b, p, Wd); standUp(b); const to = b.team === 0 ? away : home; b.ry = b.aimYaw = Math.atan2(to[0] - p[0], to[1] - p[1]); b.meHitAt = 0; }
    banner('Round ' + n, `${S.plan.names[0]} ${S.score[0]} – ${S.score[1]} ${S.plan.names[1]} · first to ${WIN_AT}`);
  }
  function endRound(winner, why){
    const r = S.round; if (r.done) return; r.done = true; r.over = BETWEEN; S.lastWhy = why;
    if (winner !== null) S.score[winner]++;
    const mine = winner === 0;
    banner(winner === null ? 'Draw' : mine ? 'Round won' : 'Round lost', why, winner === null ? '' : mine ? 'win' : 'lose');
    thump(0.3, mine ? 220 : 110, 0.4);
  }
  function checkRound(){
    if (S.round.done) return;
    const a = teamOf(0).filter(f => f.alive).length, b = teamOf(1).filter(f => f.alive).length;
    if (!b) endRound(0, `${S.plan.names[1]} wiped out`); else if (!a) endRound(1, `${S.plan.names[0]} wiped out`);
  }
  function tickRound(dt){
    const r = S.round; if (S.ended) return;
    if (S.net){   // the server runs the rounds; here we only count down the clock on screen
      if (r.done) return;
      if (r.freeze > 0){ r.freeze -= dt; if (r.freeze <= 0){ P.frozen = false; banner('Go', 'Find them', ''); setTimeout(() => { if (S.team && S.round === r && !r.done) banner(); }, 900); } return; }
      r.t = Math.max(0, r.t - dt); return;
    }
    if (r.over > 0){
      r.over -= dt;
      if (r.over <= 0){ if (S.score[0] >= WIN_AT || S.score[1] >= WIN_AT) showEnd(); else newRound(r.n + 1); }
      return;
    }
    if (r.freeze > 0){ r.freeze -= dt; if (r.freeze <= 0){ P.frozen = false; banner('Go', 'Find them', ''); setTimeout(() => { if (S.team && S.round === r && !r.done) banner(); }, 900); } return; }
    r.t -= dt;
    if (r.t <= 0){   // time up: most fighters left wins, then most health
      const left = i => teamOf(i).filter(f => f.alive), n = [left(0).length, left(1).length], hp = [0, 1].map(i => left(i).reduce((v, f) => v + f.hp, 0));
      endRound(n[0] !== n[1] ? (n[0] > n[1] ? 0 : 1) : hp[0] !== hp[1] ? (hp[0] > hp[1] ? 0 : 1) : null, 'Time up');
    }
  }
  function enterSpec(){
    el('#shDead').hidden = true; S.me.A.root.visible = true;
    if (!teamOf(0).some(f => f.alive)) return;
    S.spec = { i:0 }; el('#shSpec').hidden = false;
  }
  function tickSpec(){
    if (!S.spec) return;
    const mates = teamOf(0).filter(f => f.alive); if (!mates.length){ el('#shSpec').hidden = true; return; }
    const m = mates[S.spec.i % mates.length], sx = Math.sin(m.aimYaw), cx = Math.cos(m.aimYaw), o = [m.x, m.y + 1.9, m.z], d = [-sx * 0.9, 0.2, -cx * 0.9], l = Math.hypot(...d), u = d.map(v => v / l), far = Math.max(0.6, Math.min(3.4, R.rayWorld(o, u, 3.4, near) - 0.25));
    camera.position.set(o[0] + u[0] * far, o[1] + u[1] * far, o[2] + u[2] * far); camera.lookAt(m.x + sx * 8, m.y + 1.3, m.z + cx * 8);
    el('#shSpecName').textContent = m.name;
  }
  function showEnd(){
    S.ended = true; setTrigger(false); S.ads = false; P.frozen = true; banner(); el('#shSpec').hidden = true; el('#shDead').hidden = true;
    const won = S.score[0] > S.score[1], h = el('#shEndT'); h.textContent = won ? 'You won' : 'You lost'; h.className = won ? 'win' : 'lose';
    el('#shEndS').textContent = `${S.plan.names[0]} ${S.score[0]} – ${S.score[1]} ${S.plan.names[1]} · ${S.diff}`;
    const row = f => `<tr class="${f === S.me ? 'me' : ''}"><td>${f === S.me ? 'You' : f.name}</td><td>${f.kills || 0}</td><td>${f.deaths || 0}</td></tr>`;
    const list = (i, name) => `<table><tr class="sep"><td>${name}</td><td>Kills</td><td>Deaths</td></tr>${teamOf(i).sort((a, b) => (b.kills || 0) - (a.kills || 0)).map(row).join('')}</table>`;
    el('#shEndB').innerHTML = `<section>${list(0, S.plan.names[0])}${list(1, S.plan.names[1])}</section>${S.assists ? `<p style="margin-top:8px">You also got ${S.assists} assist${S.assists > 1 ? 's' : ''}</p>` : ''}`;
    el('#shEnd').hidden = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function mapDots(g, M){
    if (!S.active) return;
    if (S.br){ const Z = S.br.zone, cx = (Z.cx - M.ox) * M.s, cz = (Z.cz - M.oz) * M.s; g.lineWidth = 4; g.strokeStyle = '#6f93ff'; g.beginPath(); g.arc(cx, cz, Z.r * M.s, 0, 6.29); g.stroke(); g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.setLineDash([8, 6]); g.beginPath(); g.arc((Z.nx - M.ox) * M.s, (Z.nz - M.oz) * M.s, Z.nr * M.s, 0, 6.29); g.stroke(); g.setLineDash([]); }
    if (!S.team && !S.squad) return;
    for (const f of teamOf(0)){ if (f === S.me || !f.alive) continue; g.fillStyle = '#3a8bff'; g.strokeStyle = '#08080b'; g.lineWidth = 3; g.beginPath(); g.arc((f.x - M.ox) * M.s, (f.z - M.oz) * M.s, 8, 0, Math.PI * 2); g.stroke(); g.fill(); }
  }

  /* ---------------- first-person gun movement */
  function drawGun(dt){
    const f = S.me, id = f.weapon;
    for (const k in GM) GM[k].visible = k === id && f.alive;
    const w = W[id], g = GM[id], H = HOLD[id];
    S.adsT += ((S.ads && !w.melee && f.alive && !R.reloading(f, S.now) ? 1 : 0) - S.adsT) * Math.min(1, dt * 14);
    const scoped = !!w.scope && S.adsT > 0.85 && f.alive; if (scoped !== !!S.scoped){ S.scoped = scoped; el('#shScope').hidden = !scoped; }
    rig.visible = !scoped && S.tpT < 0.5 && f.alive;
    S.vKick = Math.max(0, S.vKick - dt * (w.melee ? 3 : 9));
    const m = moveState(); S.bob += dt * (m.running ? 13 : m.moving ? 9 : 2);
    const amp = (m.running ? 0.012 : m.moving ? 0.007 : 0.0015) * (1 - S.adsT * 0.9);
    const reloading = R.reloading(f, S.now) && f.alive, relT = reloading ? Math.min(1, 1 - (f.reloadAt - S.now) / W[f.reloadId].reload) : 0, rel = Math.sin(Math.PI * relT);
    const sw = S.now < f.swapAt ? (f.swapAt - S.now) / 0.32 : 0;
    const a = S.adsT, real = !!g.userData.real;
    if (!reloading && S.relPose){ S.relPose = false; SPARE.visible = false; ARMS.id = null; }
    if (ARMS.root){ ARMS.root.visible = real; if (real) fitArms(id); ARMS.R.visible = !(H.clearAim && a > 0.6); }   // a shotgun's stock is so low that the firing hand would sit right over the sights
    // aimed: the gun moves so the rear and front sights sit in a line through the exact middle of the screen
    const ry = H.rear[0], rz = H.rear[1], tilt = -Math.atan2(H.front[0] - ry, rz - H.front[1]), c = Math.cos(tilt), sn = Math.sin(tilt);
    const adsY = real ? -(ry * c - rz * sn) : -0.147, adsZ = real ? -H.relief - (ry * sn + rz * c) : -0.67;
    const hip = real ? H.hip : [0.19, -0.135, -0.62];
    rig.scale.setScalar(real ? 1 : 0.72);
    rig.position.set(hip[0] * (1 - a) - rel * 0.03 + (real ? 0 : a * 0.09) + Math.cos(S.bob * 0.5) * amp, hip[1] + (adsY - hip[1]) * a + Math.abs(Math.sin(S.bob * 0.5)) * amp + rel * 0.02 - sw * 0.28, hip[2] + (adsZ - hip[2]) * a + S.vKick * (w.pellets > 1 ? 0.09 : 0.04) * (1 - a * 0.6));
    rig.rotation.set(S.vKick * 0.05 * (w.pellets > 1 ? 2.2 : 1) * (1 - a * 0.7) + rel * 0.2 + (real ? 0.03 * (1 - a) + tilt * a : 0), (real ? 0.07 : 0.05) * (1 - a), S.vKick * S.vRoll * 0.04 * (1 - a * 0.7) - rel * 0.55);
    rig.position.y -= (S.stance === 2 ? 0.03 : 0) * (1 - a); rig.rotation.z += S.stance === 2 && !S.ads ? 0.1 : 0;
    const sp = S.sprintT; rig.position.x -= sp * 0.08; rig.position.y -= sp * 0.07; rig.rotation.x -= sp * 0.25; rig.rotation.y += sp * 0.75; rig.rotation.z += sp * 0.2 + Math.sin(S.stepPhase) * sp * 0.05;
    if (w.melee && S.swing > 0){ S.swing = Math.max(0, S.swing - dt * 4); const t = Math.sin(S.swing * Math.PI); rig.rotation.x = -t * 0.5; rig.rotation.y = t * 0.8; rig.position.x -= t * 0.2; rig.position.z -= t * 0.18; }
    if (S.flashT > 0){ S.flashT -= dt; FLASH.visible = true; FLASH.position.set(0, real ? H.front[0] - 0.02 : 0.03, g.userData.tip - 0.05); FLASH.scale.setScalar((id === 'shotgun' ? 0.42 : 0.28) * (0.8 + Math.random() * 0.5) * (1 - a * 0.4)); FLASH.material.rotation = Math.random() * 6; } else FLASH.visible = false;
    if (reloading){
      if (S.relKey !== f.reloadAt){ S.relKey = f.reloadAt; S.relI = 0; }
      const list = relSounds(H); while (S.relI < list.length && relT >= list[S.relI][0]) list[S.relI++][1]();
      if (real && ARMS.root && !H.oneHand && S.tpT < 0.5){ S.relPose = true; poseReload(relT, H); }
    }
    if (!vmScene.environment && scene.environment) vmScene.environment = scene.environment;
    vmCam.near = real ? 0.02 + a * 0.04 : 0.01;   // when aimed, the stock passes your cheek and is cut away
    vmCam.aspect = camera.aspect; vmCam.updateProjectionMatrix();
  }
  function drawCross(dt){
    const f = S.me, w = W[f.weapon], x = el('#shX');
    x.classList.toggle('knife', !!w.melee); x.style.opacity = Math.max(0, 1 - S.adsT * 2.5);   // the crosshair goes as the sights come up
    const sp = R.spreadOf(f, moveState()), gap = 3 + Math.tan(sp) / Math.tan(camera.fov * Math.PI / 360) * innerHeight / 2;
    const c = x.children; c[0].style.top = -gap - 9 + 'px'; c[1].style.top = gap + 'px'; c[2].style.left = -gap - 9 + 'px'; c[3].style.left = gap + 'px';
    const rl = el('#shReload'); rl.hidden = !R.reloading(f, S.now); if (!rl.hidden) rl.firstChild.style.width = (1 - (f.reloadAt - S.now) / W[f.reloadId].reload) * 100 + '%';
    if (S.hitT > 0){ S.hitT -= dt; if (S.hitT <= 0) el('#shHit').style.opacity = 0; }
  }

  /* ---------------- start, stop and the per-frame step */
  const STAND = { WALK, RUN, fov:camera.fov };
  /* ---------------- how your body moves: head bob, footsteps, sprinting, landing */
  function tickBody(dt){
    const speed = Math.hypot(S.vx, S.vz), m = moveState(), alive = S.me.alive, sprint = !S.stance && m.running && !S.ads && !S.trigger && !S.autoFire && speed > 4.5 && alive && !S.climb;
    S.sprintT += ((sprint ? 1 : 0) - S.sprintT) * Math.min(1, dt * 11);
    if (P.onGround && !S.wasGround && !S.climb){ S.land = 1; footstep(true, 1.5); } S.wasGround = P.onGround; S.land = Math.max(0, S.land - dt * 5);
    let bobY = 0, bobX = 0, roll = 0;
    if (P.onGround && speed > 0.4 && alive){
      const strideLen = 2 + speed * 0.12, prev = S.stepPhase; S.stepPhase += speed / strideLen * Math.PI * dt * 1.0;
      if (Math.floor(prev / Math.PI) !== Math.floor(S.stepPhase / Math.PI)){ S.stepSide *= -1; footstep(speed > 5, [1, 0.45, 0.3][S.stance]); }
      const a = Math.min(1, speed / (S.stance ? 2 : 4.3)) * (1 - S.adsT * 0.75) * (1 + S.sprintT * 0.7) * [1, 0.7, 0.6][S.stance];
      bobY = -Math.abs(Math.sin(S.stepPhase)) * 0.035 * a + 0.017 * a; bobX = Math.cos(S.stepPhase) * 0.02 * a; roll = Math.cos(S.stepPhase) * 0.0035 * a;
    }
    S.bobX = (S.bobX || 0) + (bobX - (S.bobX || 0)) * Math.min(1, dt * 14); S.bobY = (S.bobY || 0) + (bobY - (S.bobY || 0)) * Math.min(1, dt * 14); S.roll = (S.roll || 0) + (roll - (S.roll || 0)) * Math.min(1, dt * 14);
    _b.set(1, 0, 0).applyQuaternion(camera.quaternion);
    camera.position.x += _b.x * S.bobX; camera.position.z += _b.z * S.bobX; camera.position.y += S.bobY - Math.sin(S.land * Math.PI) * 0.09;
    let z = S.roll;
    if (!alive){ S.deadAge += dt; const t = Math.min(1, S.deadAge / 0.7); camera.position.y -= t * t * 1.25; z += t * 0.55; }
    camera.rotation.z = z;
  }
  /* ---------------- ladders up the side of buildings, for getting a sniper onto the roof */
  const LADG = new THREE.BoxGeometry(1, 1, 1), LADM = new THREE.MeshStandardMaterial({ color:new THREE.Color(0xf2c230).convertSRGBToLinear(), roughness:0.6, metalness:0.3 });
  function buildLadders(){
    if (S.ladMesh){ scene.add(S.ladMesh); return; }
    const pick = [], n = nav();
    for (const b of LAYOUT.buildings){
      if (!b.play || b.kind !== 'shop' || b.floors < 2 || b.floors > 5) continue;
      const F = frame(b.cx, b.cz, b.ry), top = b.floors * FH;
      // try each side wall and the back wall, wherever there is open ground to stand on
      for (const [nx, nz, half, spots] of [[1, 0, b.w / 2, [0, b.d * 0.22, -b.d * 0.22]], [-1, 0, b.w / 2, [0, b.d * 0.22, -b.d * 0.22]], [0, 1, b.d / 2, [0, b.w * 0.22, -b.w * 0.22]]]) {
        let done = false;
        for (const t of spots){
          const lx = nx ? nx * (half + 0.42) : t, lz = nz ? nz * (half + 0.42) : t, o = W_(F, lx, lz), far = W_(F, lx + nx * 0.9, lz + nz * 0.9), w0 = W_(F, lx - nx * 2.2, lz - nz * 2.2), g = groundAt(w0[0], w0[1], 200);
          if (Math.abs(g - top) > 1 || !n.isOpen(far[0], far[1]) || blockedAt(o[0], o[1], 0.12)) continue;
          if (pick.some(L => Math.hypot(L.x - o[0], L.z - o[1]) < 24)) continue;
          const tan = WN(F, nz, 0, nx), nor = WN(F, nx, 0, nz);
          pick.push({ x:o[0], z:o[1], top:g, inX:w0[0], inZ:w0[1], tx:tan[0], tz:tan[2], nx:nor[0], nz:nor[2] }); done = true; break;
        }
        if (done) break;
      }
      if (pick.length >= 9) break;
    }
    S.ladders = pick;
    let count = 0; for (const L of pick) count += 2 + Math.ceil((L.top + 1) / 0.42);
    const im = new THREE.InstancedMesh(LADG, LADM, count), m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), po = new THREE.Vector3(); let i = 0;
    for (const L of pick){
      q.setFromAxisAngle(_y, Math.atan2(L.tx, L.tz)); const H = L.top + 1, gnd = groundAt(L.x, L.z, 2);
      const put = (lz, y, sx, sy, sz) => { po.set(L.x - L.nx * 0.32 + L.tx * lz, gnd + y, L.z - L.nz * 0.32 + L.tz * lz); sc.set(sx, sy, sz); m.compose(po, q, sc); im.setMatrixAt(i++, m); };
      put(-0.26, H / 2, 0.06, H, 0.06); put(0.26, H / 2, 0.06, H, 0.06);
      for (let y = 0.3; y < H; y += 0.42) put(0, y, 0.04, 0.04, 0.5);
    }
    im.count = i; im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; S.ladMesh = im; scene.add(im);
  }
  const W_ = (F, x, z) => { const p = window.W(F, x, 0, z); return [p[0], p[2]]; };
  function clearLadders(){ if (S.ladMesh) scene.remove(S.ladMesh); S.climb = null; }
  function tickLadder(dt){
    const up = !!(keys.KeyW || keys.ArrowUp) || stick.y < -0.3, down = !!(keys.KeyS || keys.ArrowDown) || stick.y > 0.3, hint = el('#shHint');
    if (!S.me.alive){ S.climb = null; hint.hidden = true; return; }
    if (S.climb){
      const L = S.climb.L; S.climb.y += ((up ? 1 : 0) - (down ? 1 : 0)) * 3.2 * dt;
      if (Math.floor(S.climb.y / 0.8) !== S.climb.rung){ S.climb.rung = Math.floor(S.climb.y / 0.8); click(0.12, 1100); }
      P.x = L.x; P.z = L.z; P.y = Math.max(0, S.climb.y); P.vy = 0; P.onGround = true; S.vx = S.vz = 0;
      if (S.climb.y >= L.top - 0.2){ P.x = L.inX; P.z = L.inZ; P.y = L.top; S.climb = null; }
      else if (S.climb.y <= 0.02 && down) S.climb = null;
      hint.hidden = true; return;
    }
    let show = false;
    for (const L of S.ladders){
      if (Math.abs(P.y - groundAt(L.x, L.z, 2)) < 1 && Math.hypot(P.x - L.x, P.z - L.z) < 1.2){ show = true; if (up){ S.climb = { L, y:P.y + 0.1, rung:0 }; break; } }
      else if (Math.abs(P.y - L.top) < 0.6 && Math.hypot(P.x - L.inX, P.z - L.inZ) < 1.6){ show = true; if (down){ S.climb = { L, y:L.top - 0.3, rung:0 }; break; } }
    }
    hint.hidden = !show || !!S.climb; if (show) hint.textContent = P.y > 2 ? 'Hold back to climb down' : 'Hold forward to climb';
  }
  function start(opts = {}){
    if (S.active || !GAME.S.ready || !S.plan) return;
    S.net = opts.net || null; S.netOff = null; S.netSend = 0; S.mode = opts.mode || 'range'; S.diff = opts.diff || 'medium'; S.fight = S.mode !== 'range'; S.team = S.mode === 'team'; S.br = S.mode === 'br' ? {} : null; S.squad = !!(S.br && opts.squad); S.oneLife = S.team || !!S.br; S.ended = false; S.spec = null; S.round = null;
    buildHud(); setView(savedView()); makeFx(); audio(); loadShots();
    const spots = streetSpots(), s = spots[Math.floor(spots.length / 2)];
    P.x = s[0]; P.z = s[1]; P.y = groundAt(s[0], s[1], 2); P.vy = 0; P.yaw = 0; P.pitch = 0; P.fly = false; P.frozen = false;
    const kit = S.br ? { weapon:'pistol', loadout:['pistol', 'knife'] } : { weapon:'rifle' };
    S.me = Object.assign(R.newFighter(kit), { kills:0, deaths:0, x:P.x, y:P.y, z:P.z }); S.deadT = 0; S.hurtT = 0; S.vx = S.vz = 0; S.stance = 0; S.eyeDrop = 0; S.crouchAt = 0; S.assists = 0; S.climb = null; S.sprintT = 0; S.baseSens = SENS; S.stats = { shots:0, hits:0, heads:0, kills:0 }; S.now = 0; S.ads = false; S.adsT = 0; S.trigger = false; S.pressed = false; S.targets = [];
    S.bots = [];
    S.me.A = GAME.debug.makeAvatar(S.plan.me); outfit(S.me); S.me.A.gearId = S.me.weapon; S.me.A.root.visible = false; S.tpT = S.view === 'tp' ? 1 : 0; buildArms(S.plan.me); ARMS.id = null;
    if (S.fight){
      S.W = { fighters:[S.me], near, nav:nav(), groundAt:(x, z, y) => groundAt(x, z, y), rand:Math.random, now:0, onShot:botShot, intel:{} };
      if (opts.net) netFighters(opts.net);
      else for (let i = 0; i < 9; i++){
        const s = farSpot(), teamed = S.team || S.squad, team = teamed ? (i < 4 ? 0 : 1) : null, b = BOTS.newBot({ id:'b' + i, name:NAMES[i], x:s[0], z:s[1], weapon:S.br ? 'pistol' : ARMS_FOR[i], team, loadout:S.br ? ['pistol'] : undefined }, S.diff);
        b.y = groundAt(s[0], s[1], 2); b.A = GAME.debug.makeAvatar(teamed ? (team === 0 ? S.plan.mates[i] : S.plan.foes[i - 4]) : S.plan.others[i]); outfit(b); addBar(b, team === 0); S.bots.push(b); S.W.fighters.push(b);
      }
      S.targets = S.team || S.squad ? S.bots.filter(b => b.team === 1) : S.bots;
      if (S.team || S.squad) S.me.team = 0;
            if (S.team){ S.score = [0, 0]; if (S.net){ S.round = { n:0, t:ROUND_TIME, freeze:999, over:0, done:false }; P.frozen = true; banner('Get ready', 'Waiting for everyone'); } else { pickBases(); newRound(1); } }
    } else spawnTargets(spots);
    S.ffaT = FFA_TIME; S.ffaEnd = 0;
    buildLadders();
    if (S.br){ placeLoot(); startBR(); }
    MUSIC.stop(); started = true; S.active = true; el('#start').hidden = true; el('#shHud').hidden = false; setPaused(false); el('#shAgain').textContent = S.net ? 'Back to room' : 'Play again';
    document.body.classList.add('sh-on'); document.body.classList.toggle('sh-touch', TOUCH);
    el('#shHp').hidden = !S.fight; el('#shDead').hidden = true; el('#shFeed').innerHTML = ''; el('#shHurt').style.opacity = 0;
    if (!TOUCH) canvas.requestPointerLock?.()?.catch?.(() => {});
    toast(TOUCH && !S.fight ? 'Drag FIRE to aim and shoot. Push the stick right up to sprint' : S.br ? 'Loot is on shop counters and down the alleys. Stay inside the blue wall' : S.team ? 'Your team is in blue. Wipe out the other side' : S.fight ? 'First to 15 kills wins. Yellow ladders go up to the roofs' : TOUCH ? 'Drag FIRE to aim and shoot' : 'Click to shoot · right-click to aim · R reload · C crouch, hold C to lie down · 1 to 6 swap guns · Esc pause', 4200);
  }
  function stop(){
    if (!S.active) return;
    const link = S.net; S.net = null; if (link && !S.keepNet) link.leave();
    S.active = false; started = false; P.frozen = false; WALK = STAND.WALK; RUN = STAND.RUN; if (TOUCH) P.run = false; HEAD = R.STANCE[0].height; S.stance = 0; S.eyeDrop = 0; S.crouchAt = 0; SENS = S.baseSens; rig.visible = true; S.scoped = false; S.tpT = 0; S.camBack = 0; el('#shScope').hidden = true; el('#shHint').hidden = true; el('#shElim').style.opacity = 0; camera.rotation.z = 0; clearLadders(); camera.fov = STAND.fov; camera.updateProjectionMatrix();
    for (const T of new Set([...S.targets, ...S.bots, ...(S.me && S.me.A ? [S.me] : [])])){ if (T.fall && T.fall.pool) scene.remove(T.fall.pool); if (T.bar) scene.remove(T.bar.g); scene.remove(T.A.root); } S.targets = []; S.bots = [];
    for (const it of S.items) if (!it.gone) scene.remove(it.m); S.items = []; if (S.br && S.br.wall) scene.remove(S.br.wall); el('#shZoneWarn').hidden = true; el('#shBurn').style.opacity = 0; el('#shArm').hidden = true;
    S.spec = null; S.ended = false; S.round = null; S.team = false; S.fight = false; S.br = null; S.squad = false; S.oneLife = false; banner(); el('#shEnd').hidden = true; el('#shSpec').hidden = true; el('#shDead').hidden = true;
    for (const g of [...FX.tr, ...FX.puff]){ g.m.visible = false; g.life = 0; } for (const m of FX.mark) m.visible = false;
    el('#shHud').hidden = true; el('#start').hidden = false; document.body.classList.remove('sh-on', 'sh-touch');
    if (document.pointerLockElement) document.exitPointerLock(); MUSIC.start();
  }
  function tick(dt){
    if (!S.active) return;
    if ((S.paused && !S.net) || S.ended){ camera.position.y -= S.eyeDrop; placeCam(dt); return; }
    S.now += dt; if (S.W) S.W.now = S.now; let f = S.me; const w = W[f.weapon];
    R.tick(f, dt, S.now); tickStance(dt);
    if (S.team) tickRound(dt); else if (S.br) tickBR(dt); else if (S.fight) tickFFA(dt);
    if (S.ended) return;
    f = S.me;
    if (S.br) tickItems(dt);
    const canShoot = S.sprintT < 0.35 && !S.climb && !(S.net && S.round.done) && !(S.fight && (S.team ? S.round.freeze > 0 : S.br ? S.br.freeze > 0 : false));
    if (S.autoFire && !w.auto && R.canFire(f, S.now)) S.pressed = true;
    if (canShoot && (S.pressed || ((S.trigger || S.autoFire) && w.auto))){
      const fired = shoot();
      if (fired && w.scope) setTimeout(() => { if (S.active){ click(0.2, 1300); setTimeout(() => S.active && click(0.22, 1800), 240); } }, 380);
      if (!fired && S.pressed && !w.melee && f.ammo[f.weapon].mag === 0 && !R.reloading(f, S.now) && !R.startReload(f, S.now)) dry();
    }
    if (canShoot) S.pressed = false;
    // recoil climbs quickly, then the view settles most of the way back
    const up = Math.min(S.pitchDebt, S.pitchDebt * dt * 30); S.pitchDebt -= up; P.pitch = Math.min(1.45, P.pitch + up); S.recoverDebt += up * 0.7;
    if (!S.trigger && S.recoverDebt > 0){ const d = Math.min(S.recoverDebt, S.recoverDebt * dt * 7 + 0.0004); P.pitch -= d; S.recoverDebt -= d; } 
    const stanceSpeed = R.STANCE[S.stance].speed;
    WALK = STAND.WALK * w.moveMul * (S.ads ? 0.62 : 1) * stanceSpeed;
    RUN = S.stance ? WALK : STAND.RUN * w.moveMul * (S.ads || S.trigger || S.autoFire ? 0.62 : 1);
    SENS = S.baseSens * (w.scope && S.adsT > 0.5 ? 0.3 : 1 - S.adsT * 0.35) * (S.assistSlow || 1);
    tickAssist(dt); tickLadder(dt); tickBody(dt);
    const fov = STAND.fov + ((w.zoom || STAND.fov) - STAND.fov) * S.adsT; if (Math.abs(camera.fov - fov) > 0.01){ camera.fov = fov; camera.updateProjectionMatrix(); }
    if (S.fight) tickBots(dt); else tickTargets(dt);
    tickFx(dt); drawGun(dt); placeCam(dt); tickMe(dt); drawCross(dt); drawHud(); drawBars(); tickSpec();
    S.lastCam = [camera.position.x, camera.position.y, camera.position.z];
    if (S.net){ S.netSend -= dt; if (S.netSend <= 0 && S.me.alive){ S.netSend = 0.1; const m = S.me; S.net.send(['i', +P.x.toFixed(2), +P.y.toFixed(2), +P.z.toFixed(2), +m.aimYaw.toFixed(2), +P.pitch.toFixed(2), S.stance, +(m.speed || 0).toFixed(2), +(m.proneYaw || 0).toFixed(2)]); } }
  }
  function render(){
    if (!S.active) return;
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(vmScene, vmCam); renderer.autoClear = ac;
  }
  addEventListener('mousedown', e => {
    if (!S.active || S.paused || document.pointerLockElement !== canvas) return;
    if (S.spec){ if (e.button === 0) S.spec.i++; return; }
    if (e.button === 0) setTrigger(true); else if (e.button === 2) S.ads = true;
  });
  addEventListener('mouseup', e => { if (!S.active) return; if (e.button === 0) setTrigger(false); else if (e.button === 2) S.ads = false; });
  addEventListener('contextmenu', e => { if (S.active) e.preventDefault(); });
  addEventListener('keydown', e => {
    if (!S.active || e.repeat) return;
    if (e.code === 'KeyR') reload();
    else if (e.code === 'KeyC') crouchDown();
    else if (e.code === 'KeyQ') swap(S.last);
    else if (e.code === 'KeyV') setView(S.view === 'tp' ? 'fp' : 'tp');
    else if (/^Digit[1-6]$/.test(e.code)) swap(R.ORDER[+e.code.slice(5) - 1]);
  });
  addEventListener('keyup', e => { if (S.active && e.code === 'KeyC') crouchUp(); });
  addEventListener('wheel', e => { if (!S.active || document.pointerLockElement !== canvas) return; const i = R.ORDER.indexOf(S.me.weapon), n = R.ORDER.length; swap(R.ORDER[(i + (e.deltaY > 0 ? 1 : n - 1)) % n]); }, { passive:true });
  document.addEventListener('pointerlockchange', () => { if (S.active && !S.ended && !TOUCH && !window.__TEST) setPaused(document.pointerLockElement !== canvas); });
  function momentum(mx, mz, dt){
    const k = 1 - Math.exp(-dt * (P.onGround ? 11 : 2.5)); S.vx += (mx - S.vx) * k; S.vz += (mz - S.vz) * k;
    return S.climb ? [0, 0] : [S.vx, S.vz];
  }
  return { start, stop, tick, render, S, setView, savedView, ARMS, GM, HOLD, vmScene, vmCam, rig, drawGunFor:drawGun, setTrigger, swap, reload, BUF, aimPoseFor:aimPose, animBodyFor:animBody, fallFor:fall, tickFallFor:tickFall, momentum, noJump, setStance, mapDots, play, showTips, HELP, setHelp, loadGunModels, MODEL, regearFor:regear, preload, prep, ROSTER, TEAMS, showPicker, netPrep, netMsg, netLost, netNote, myPick };
})();
window.SHOOTER = SHOOTER;
{ const wait = () => (window.__ready ? SHOOTER.loadGunModels() : setTimeout(wait, 300)); wait(); }
{ const v = document.querySelector('#viewIn'); if (v){ v.value = SHOOTER.savedView(); v.addEventListener('change', e => SHOOTER.setView(e.target.value)); } }
// aim settings on the menu are for phones only
if (TOUCH){
  const q = s => document.querySelector(s), H = SHOOTER.HELP;
  q('#helpRow').hidden = false; q('#aimIn').value = H.aim ? '1' : '0'; q('#autoIn').value = H.auto ? '1' : '0';
  q('#aimIn').addEventListener('change', e => SHOOTER.setHelp('aim', e.target.value === '1'));
  q('#autoIn').addEventListener('change', e => SHOOTER.setHelp('auto', e.target.value === '1'));
}
