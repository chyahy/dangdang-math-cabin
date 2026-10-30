(function () {
  'use strict';
  const { Cube, FACES, moveInfo, inverse, parse } = CubeMath;
  const $ = id => document.getElementById(id);
  const cube = new Cube();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const demos = {
    six: { moves: Array(6).fill("R U R' U'").join(' '), description: 'R U R′ U′ 重复 6 次，魔方回到起始状态。' },
    four: { moves: 'U U U U', description: '每次转动 90°，连续转 4 次，回到原位。' },
    checker: { moves: 'R2 L2 U2 D2 F2 B2', description: '相对的两面依次转半圈，让六面都出现棋盘格。' },
  };
  let selected = 'R', animation = null, playing = false, sequence = parse(demos.six.moves), index = 0;
  let history = [], future = [], freeMode = false, autoOrbit = false, lastFrame = 0, toastTimer;
  let yaw = .64, pitch = .46, distance = 9.2, geometryDirty = true, renderer;
  let pointerStart = null, gesture = null, suppressClick = false;
  const pointers = new Map();
  let scene, camera, assembly, turnGroup, meshes = [], hitMeshes = [], selectionOutline;
  const viewport = $('viewport'), orbitCanvas = $('orbits'), ctx = orbitCanvas.getContext('2d');
  const nice = token => token.replace("'", '′');
  function toast(text) {
    clearTimeout(toastTimer); $('toast').textContent = text; $('toast').classList.add('visible');
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3300);
  }
  function setFace(face) {
    selected = face;
    for (const button of $('faceButtons').children) button.setAttribute('aria-pressed', String(button.dataset.face === face));
    $('selectedName').textContent = FACES[face].name + ' / ' + face;
    $('faceBadge').textContent = face + ' · ' + FACES[face].name;
    $('faceBadge').style.color = FACES[face].color;
    $('faceBadge').style.borderColor = FACES[face].color + '66';
    if (!animation) updateOutline();
    geometryDirty = true;
  }
  for (const [face, info] of Object.entries(FACES)) {
    const b = document.createElement('button'); b.className = 'face'; b.dataset.face = face;
    b.style.setProperty('--face', info.color); b.setAttribute('aria-label', '选择' + info.name + ' ' + face);
    b.innerHTML = '<b>' + face + '</b><small>' + info.name[0] + '</small>';
    b.onclick = () => setFace(face); $('faceButtons').append(b);
  }
  // Rounded sticker corners are geometry, so the offline version needs no image assets.
  function stickerGeometry() {
    const s = new THREE.Shape(), h = .424, r = .053;
    s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r);
    s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
    s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r);
    s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
    return new THREE.ShapeGeometry(s, 4);
  }
  let blockGeo, stickerGeo, outlineGeo, blockMaterial, materials;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0c101b, 0); renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.domElement.setAttribute('aria-hidden', 'true'); viewport.append(renderer.domElement);
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
    assembly = new THREE.Group(); scene.add(assembly);
    scene.add(new THREE.AmbientLight(0xffffff, .9));
    const key = new THREE.DirectionalLight(0xffffff, .65); key.position.set(4, 7, 6); scene.add(key);
    const fill = new THREE.DirectionalLight(0x86a4ff, .25); fill.position.set(-4, -2, -3); scene.add(fill);
    blockGeo = new THREE.BoxGeometry(.966, .966, .966); stickerGeo = stickerGeometry();
    blockMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x11141d).convertSRGBToLinear() });
    materials = Object.fromEntries(Object.entries(FACES).map(([f, m]) => [f, new THREE.MeshLambertMaterial({ color: new THREE.Color(m.color).convertSRGBToLinear() })]));
    outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.035, 3.035, 3.035));
    rebuild();
    renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); playing = false; toast('三维画面已暂停。重新打开页面可恢复。'); });
  } catch (error) {
    $('fallback').hidden = false; console.error(error);
  }
  function rebuild() {
    if (!assembly) return;
    assembly.clear(); meshes = []; hitMeshes = [];
    for (const cubie of cube.cubies) {
      const group = new THREE.Group(); group.position.set(...cubie.pos); group.userData.cubie = cubie;
      group.add(new THREE.Mesh(blockGeo, blockMaterial));
      for (const sticker of cubie.stickers) {
        const mesh = new THREE.Mesh(stickerGeo, materials[sticker.face]);
        const normal = new THREE.Vector3(...sticker.normal);
        mesh.position.copy(normal).multiplyScalar(.488);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        mesh.userData.sticker = sticker; group.add(mesh); hitMeshes.push(mesh);
      }
      assembly.add(group); meshes.push(group);
    }
    updateOutline(); geometryDirty = true;
  }
  function updateOutline() {
    if (!assembly || animation) return;
    if (selectionOutline) { assembly.remove(selectionOutline); selectionOutline.material.dispose(); }
    const f = FACES[selected];
    selectionOutline = new THREE.LineSegments(outlineGeo, new THREE.LineBasicMaterial({ color: f.color, transparent: true, opacity: .22 }));
    selectionOutline.scale.setComponent(f.axis, 1 / 3);
    selectionOutline.position.setComponent(f.axis, f.layer);
    assembly.add(selectionOutline);
  }
  function updateCamera() {
    camera.position.set(distance * Math.cos(pitch) * Math.sin(yaw), distance * Math.sin(pitch), distance * Math.cos(pitch) * Math.cos(yaw));
    camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); geometryDirty = true;
  }
  function resize() {
    if (renderer) {
      const w = viewport.clientWidth, h = viewport.clientHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); updateCamera();
    }
    const r = orbitCanvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    orbitCanvas.width = Math.round(r.width * dpr); orbitCanvas.height = Math.round(r.height * dpr); geometryDirty = true;
  }
  new ResizeObserver(resize).observe(viewport); new ResizeObserver(resize).observe(orbitCanvas);
  function duration(token) {
    if (reduced) return 100;
    return (1250 - Number($('speed').value) * 10.5) * (token.endsWith('2') ? 1.35 : 1);
  }
  function startMove(token, { record = true, done = null } = {}) {
    if (animation || !renderer) return false;
    const move = moveInfo(token); setFace(token[0]);
    turnGroup = new THREE.Group(); assembly.add(turnGroup);
    for (const mesh of meshes) if (mesh.userData.cubie.pos[move.axis] === move.layer) turnGroup.add(mesh);
    if (selectionOutline) selectionOutline.visible = false;
    animation = { token, ...move, start: performance.now(), duration: duration(token), angle: 0, record, done };
    geometryDirty = true; updateControls(); return true;
  }
  function completeMove() {
    const move = animation; cube.turn(move.token);
    if (move.record) { history.push(move.token); future = []; }
    animation = null; rebuild();
    if (move.done) move.done();
    updateControls(); renderHistory(); geometryDirty = true;
  }
  function manual(token) {
    if (animation) return;
    playing = false; freeMode = true;
    startMove(token); renderSequence();
  }
  function renderSequence() {
    const element = $('sequence'); element.replaceChildren();
    if (freeMode) {
      const p = document.createElement('span'); p.className = 'empty'; p.textContent = '正在自由探索。点“从头演示”回到步骤播放。'; element.append(p);
    } else sequence.forEach((token, i) => {
      const span = document.createElement('span'); span.className = 'move-chip' + (i < index ? ' done' : '') + (i === index && animation ? ' current' : '');
      span.textContent = nice(token); span.title = '第 ' + (i + 1) + ' 步'; element.append(span);
    });
    $('progress').textContent = freeMode ? '自由探索' : index + ' / ' + sequence.length;
    const active = element.querySelector('.current');
    if (active) element.scrollTop = Math.max(0, active.offsetTop - element.offsetTop - 35);
  }
  function renderHistory() {
    $('history').replaceChildren();
    if (!history.length) $('history').innerHTML = '<span class="empty">选择一面，开始第一次转动。</span>';
    for (const token of history.slice(-100)) {
      const span = document.createElement('span'); span.className = 'move-chip'; span.textContent = nice(token); $('history').append(span);
    }
    $('moveCount').textContent = history.length + ' 步'; $('history').scrollTop = $('history').scrollHeight;
  }
  function updateControls() {
    const busy = !!animation;
    for (const id of ['clockwise', 'counterclockwise', 'halfTurn', 'scramble', 'reset', 'demoSelect', 'loadAlgorithm', 'restartDemo']) $(id).disabled = busy || (playing && id !== 'restartDemo');
    $('undo').disabled = busy || playing || history.length === 0;
    $('redo').disabled = busy || playing || future.length === 0;
    $('previous').disabled = busy || playing || freeMode || index === 0;
    $('next').disabled = busy || playing || freeMode || index >= sequence.length;
    $('play').disabled = busy && !playing;
    $('play').textContent = playing ? 'Ⅱ 暂停演示' : !freeMode && index >= sequence.length ? '↺ 再播放一次' : '▶ 播放演示';
    $('cubeState').innerHTML = '<i></i>' + (busy ? nice(animation.token) + ' · 转动中' : cube.solved() ? '已复原' : '探索中');
  }
  function resetState() {
    if (animation) return false;
    playing = false; cube.reset(); history = []; future = []; index = 0; freeMode = false;
    rebuild(); renderHistory(); renderSequence(); updateControls(); return true;
  }
  function loadDemo(key, quiet = false) {
    if (animation) return;
    if (key === 'custom') { playing = false; $('customPanel').hidden = false; updateControls(); return; }
    $('customPanel').hidden = true; resetState(); sequence = parse(demos[key].moves);
    $('demoDescription').textContent = demos[key].description;
    renderSequence(); updateControls(); if (!quiet) toast('已复原魔方，可以开始演示。');
  }
  function nextStep() {
    if (animation || freeMode || index >= sequence.length) return;
    startMove(sequence[index], { done: () => {
      index++; if (index >= sequence.length) {
        playing = false;
        toast(cube.solved() ? '演示完成，魔方回到了原点。' : '演示完成。拖动魔方，看看另外几面。');
      }
      renderSequence();
    } });
    renderSequence();
  }
  $('clockwise').onclick = () => manual(selected);
  $('counterclockwise').onclick = () => manual(selected + "'");
  $('halfTurn').onclick = () => manual(selected + '2');
  $('undo').onclick = () => {
    if (animation || playing || !history.length) return;
    const token = history.pop(); future.push(token); freeMode = true;
    startMove(inverse(token), { record: false }); renderSequence();
  };
  $('redo').onclick = () => {
    if (animation || playing || !future.length) return;
    const token = future.pop(); history.push(token); freeMode = true;
    startMove(token, { record: false }); renderSequence();
  };
  $('reset').onclick = () => { if (resetState()) toast('已复原，保留你当前的观察视角。'); };
  $('scramble').onclick = () => {
    if (animation || playing) return;
    resetState(); sequence = []; let lastAxis = -1;
    for (let i = 0; i < 20; i++) {
      const faces = Object.keys(FACES).filter(f => FACES[f].axis !== lastAxis);
      const f = faces[Math.floor(Math.random() * faces.length)];
      sequence.push(f + ['', "'", '2'][Math.floor(Math.random() * 3)]); lastAxis = FACES[f].axis;
    }
    $('demoDescription').textContent = '20 步随机打乱。可以暂停、逐步查看，也可以撤销。';
    playing = true; renderSequence(); updateControls();
  };
  $('demoSelect').onchange = e => loadDemo(e.target.value);
  $('loadAlgorithm').onclick = () => {
    if (animation || playing) return;
    try {
      const moves = parse($('algorithm').value); resetState(); sequence = moves;
      $('demoDescription').textContent = '你的步骤，共 ' + sequence.length + ' 步。已从复原状态开始。';
      renderSequence(); updateControls(); toast('已加载你的步骤。');
    } catch (error) { toast(error.message); }
  };
  $('play').onclick = () => {
    if (playing) { playing = false; updateControls(); return; }
    if (animation) return;
    if (freeMode || index >= sequence.length) resetState();
    playing = true; updateControls();
  };
  $('next').onclick = nextStep;
  $('previous').onclick = () => {
    if (animation || playing || freeMode || index === 0) return;
    const token = sequence[index - 1];
    startMove(inverse(token), { record: false, done: () => { index--; history.pop(); future = []; renderSequence(); } });
  };
  $('restartDemo').onclick = () => { if (resetState()) toast('已回到这组步骤的起点。'); };
  $('speed').oninput = () => { const v = Number($('speed').value); $('speedValue').textContent = v < 28 ? '慢速' : v < 70 ? '适中' : '快速'; };
  $('resetView').onclick = () => { yaw = .64; pitch = .46; distance = 9.2; autoOrbit = false; $('autoOrbit').setAttribute('aria-pressed', 'false'); if (camera) updateCamera(); };
  $('autoOrbit').onclick = () => { autoOrbit = !autoOrbit; $('autoOrbit').setAttribute('aria-pressed', String(autoOrbit)); };
  $('fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('这个浏览器可以通过横屏获得更大的画面。');
    } catch { toast('当前浏览器暂不支持全屏。'); }
  };
  $('helpButton').onclick = () => $('help').showModal(); $('closeHelp').onclick = $('gotIt').onclick = () => $('help').close();
  $('help').addEventListener('click', e => { if (e.target === $('help')) { const b = $('help').getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) $('help').close(); } });
  const raycaster = renderer ? new THREE.Raycaster() : null;
  function pickFace(x, y) {
    if (!renderer || animation) return;
    const r = viewport.getBoundingClientRect();
    scene.updateMatrixWorld(); raycaster.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, 1 - (y - r.top) / r.height * 2), camera);
    const hit = raycaster.intersectObjects(hitMeshes, false)[0]; if (!hit) return;
    const normal = hit.object.userData.sticker.normal;
    const face = Object.keys(FACES).find(f => normal[FACES[f].axis] === FACES[f].layer); if (face) setFace(face);
  }
  function pinchData() {
    const [a, b] = [...pointers.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }
  viewport.addEventListener('pointerdown', e => {
    if (e.target.closest('button') || !renderer || e.button > 0) return;
    e.preventDefault(); viewport.focus({ preventScroll: true }); viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) { pointerStart = { x: e.clientX, y: e.clientY, yaw, pitch }; suppressClick = false; }
    else if (pointers.size === 2) { gesture = { ...pinchData(), zoom: distance, yaw, pitch }; suppressClick = true; }
    autoOrbit = false; $('autoOrbit').setAttribute('aria-pressed', 'false');
  });
  viewport.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId) || !renderer) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && gesture) {
      const p = pinchData(); distance = Math.max(4.9, Math.min(13, gesture.zoom * gesture.distance / Math.max(p.distance, 10)));
      yaw = gesture.yaw - (p.cx - gesture.cx) * .006; pitch = Math.max(-1.35, Math.min(1.35, gesture.pitch + (p.cy - gesture.cy) * .006));
      suppressClick = true;
    } else if (pointers.size === 1 && pointerStart) {
      const dx = e.clientX - pointerStart.x, dy = e.clientY - pointerStart.y;
      if (Math.hypot(dx, dy) > 5) suppressClick = true;
      yaw = pointerStart.yaw - dx * .008; pitch = Math.max(-1.35, Math.min(1.35, pointerStart.pitch + dy * .008));
    }
    updateCamera();
  });
  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    if (e.type === 'pointerup' && pointers.size === 1 && !suppressClick) pickFace(e.clientX, e.clientY);
    pointers.delete(e.pointerId);
    if (pointers.size === 1) { const p = [...pointers.values()][0]; pointerStart = { ...p, yaw, pitch }; suppressClick = true; }
    else { pointerStart = null; gesture = null; }
    if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
  }
  viewport.addEventListener('pointerup', endPointer); viewport.addEventListener('pointercancel', endPointer); viewport.addEventListener('lostpointercapture', endPointer);
  window.addEventListener('blur', () => { pointers.clear(); pointerStart = null; gesture = null; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { playing = false; autoOrbit = false; pointers.clear(); pointerStart = null; gesture = null; $('autoOrbit').setAttribute('aria-pressed', 'false'); updateControls(); } });
  viewport.addEventListener('wheel', e => { if (!renderer || e.target.closest('button')) return; e.preventDefault(); distance = Math.max(4.9, Math.min(13, distance * Math.exp(e.deltaY * .001))); updateCamera(); }, { passive: false });
  window.addEventListener('keydown', e => {
    if ($('help').open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || e.altKey) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? $('redo') : $('undo')).click(); return; }
    if (e.ctrlKey || e.metaKey || e.repeat) return;
    if (FACES[e.key.toUpperCase()]) { e.preventDefault(); if (!playing) manual(e.key.toUpperCase() + (e.shiftKey ? "'" : '')); }
    if (e.code === 'Space' && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); $('play').click(); }
  });
  // Orthographic projection of the actual sticker centres; trajectories are
  // full circles about the very same axis used for the 3D layer animation.
  function continuousRotate(v, axis, angle) {
    const c = Math.cos(angle), s = Math.sin(angle), [x, y, z] = v;
    return axis === 0 ? [x, y * c - z * s, y * s + z * c] : axis === 1 ? [x * c + z * s, y, z * c - x * s] : [x * c - y * s, x * s + y * c, z];
  }
  function drawOrbit() {
    const w = orbitCanvas.clientWidth, h = orbitCanvas.clientHeight;
    if (!w || !h) return;
    ctx.setTransform(orbitCanvas.width / w, 0, 0, orbitCanvas.height / h, 0, 0); ctx.clearRect(0, 0, w, h);
    const cx = w * (w > 430 ? .59 : .56), cy = h * .51, scale = Math.min(h * .255, w * .20);
    const m = animation || moveInfo(selected);
    const project = p => [cx + (p[0] - p[2]) * .7071 * scale, cy - (p[1] * .8165 - (p[0] + p[2]) * .4082) * scale];
    const points = cube.stickers().map(s => ({ ...s, v: s.pos.map((n, i) => n + s.normal[i] * .488), active: s.pos[m.axis] === m.layer }));
    // Quiet reference orbits for all three coordinate directions.
    for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
      const seed = [1.15, 1.15, 1.15]; seed[axis] = .7 * sign;
      ctx.beginPath();
      for (let j = 0; j <= 96; j++) { const p = project(continuousRotate(seed, axis, j / 96 * Math.PI * 2)); j ? ctx.lineTo(...p) : ctx.moveTo(...p); }
      ctx.strokeStyle = '#53648824'; ctx.lineWidth = .7; ctx.stroke();
    }
    const drawn = new Set();
    for (const s of points.filter(p => p.active)) {
      const radius = Math.sqrt(s.v.reduce((n, a, i) => n + (i === m.axis ? 0 : a * a), 0));
      const key = s.v[m.axis].toFixed(2) + ':' + radius.toFixed(2); if (drawn.has(key)) continue; drawn.add(key);
      ctx.beginPath();
      for (let j = 0; j <= 120; j++) { const p = project(continuousRotate(s.v, m.axis, j / 120 * Math.PI * 2)); j ? ctx.lineTo(...p) : ctx.moveTo(...p); }
      ctx.strokeStyle = '#8599bc48'; ctx.lineWidth = .9; ctx.stroke();
    }
    if (animation) for (const s of points.filter(p => p.active)) {
      ctx.beginPath();
      for (let j = 0; j <= 32; j++) { const p = project(continuousRotate(s.v, m.axis, animation.angle * j / 32)); j ? ctx.lineTo(...p) : ctx.moveTo(...p); }
      ctx.strokeStyle = s.color + '7a'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    points.sort((a, b) => Number(a.active) - Number(b.active));
    for (const s of points) {
      const p = project(s.active && animation ? continuousRotate(s.v, m.axis, animation.angle) : s.v);
      ctx.beginPath(); ctx.arc(p[0], p[1], s.active ? 2.25 : 1.5, 0, Math.PI * 2);
      ctx.fillStyle = s.active ? s.color : s.color + '4a';
      ctx.shadowBlur = s.active ? 7 : 0; ctx.shadowColor = s.color; ctx.fill(); ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#677998'; ctx.font = '10px Consolas, monospace'; ctx.fillText(m.face + ' · ' + (animation ? Math.round(Math.abs(animation.angle) * 180 / Math.PI) + '°' : '90°'), w - 57, h - 13);
  }
  function frame(now) {
    const dt = Math.min(50, now - (lastFrame || now)); lastFrame = now;
    if (!document.hidden) {
      if (playing && !animation && index < sequence.length) nextStep();
      if (animation) {
        const t = Math.min(1, (now - animation.start) / animation.duration), eased = t * t * (3 - 2 * t);
        animation.angle = animation.quarter * Math.PI / 2 * eased;
        turnGroup.rotation.set(0, 0, 0); turnGroup.rotation[['x', 'y', 'z'][animation.axis]] = animation.angle;
        geometryDirty = true; if (t >= 1) completeMove();
      }
      if (autoOrbit && renderer) { yaw += dt * .00015; updateCamera(); }
      if (geometryDirty) {
        if (renderer) renderer.render(scene, camera); drawOrbit(); geometryDirty = false;
      }
    }
    requestAnimationFrame(frame);
  }
  setFace('R'); resize(); renderSequence(); renderHistory(); updateControls(); requestAnimationFrame(frame);
})();
