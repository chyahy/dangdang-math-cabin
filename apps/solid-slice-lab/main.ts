import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createSolid, sectionFor, faceGeometry, frame, labels, TARGETS, targetCatalog, unavailableReason } from './sections';
import type { Solid, Section, SectionKind } from './sections';

type Shape = Solid;
const state = {
  shape: "cube" as Shape,
  sides: 4,
  tilt: 42,
  turn: 28,
  offset: 0,
  separation: 0,
};
const planeCenter = new THREE.Vector3(0, 0, 0);
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
$("backHome").setAttribute("href", location.protocol === "file:" ? "https://dangdanglaoshi.cn/" : "../");
const canvas = $("canvas"),
  stage = $("stage"),
  sectionName = $("sectionName"),
  shapeName = $("shapeName"),
  stageStatus = $("stageStatus"),
  sidePicker = $("sidePicker"),
  sideButtons = $("sideButtons");
const numeral = ["", "", "", "三", "四", "五", "六"];
const scene = new THREE.Scene();
scene.background = new THREE.Color("#eaf3f5");
scene.fog = new THREE.Fog("#eaf3f5", 18, 55);
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(5.4, 4.2, 6.2);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
canvas.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 4;
controls.maxDistance = 28;
controls.enablePan = false;
scene.add(new THREE.HemisphereLight(0xffffff, 0x476174, 2.2));
const light = new THREE.DirectionalLight(0xffffff, 3.2);
light.position.set(4, 7, 5);
light.castShadow = true;
scene.add(light);
const grid = new THREE.GridHelper(12, 24, 0x8aadb4, 0xc9dadd);
grid.position.y = -1.75;
scene.add(grid);
let model: THREE.Group | undefined;
let vertexMarkers: THREE.Mesh[] = [];
let selectedVertices: THREE.Vector3[] = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const defaultViewDirection = new THREE.Vector3(5.4, 4.2, 6.2).normalize();
let targetGoal: SectionKind | null = null;
const curvedSolid=()=>state.shape==='cylinder'||state.shape==='cone';
function refreshTargets(){
  const catalog=targetCatalog(state.shape,state.sides),select=$<HTMLSelectElement>('sectionTarget');
  select.replaceChildren(new Option('选择想得到的截面…',''));
  for(const kind of TARGETS){
    const available=catalog.has(kind),option=new Option(labels[kind]+(available?'':'（'+(curvedSolid()?'不能得到':'暂无定位示例')+'）'),kind);
    option.disabled=!available;select.append(option);
  }
  targetGoal=null;select.value='';$('targetNote').textContent=curvedSolid()?(state.shape==='cylinder'?'圆柱不能用平面切出梯形或三角形。斜切碰到底面时，截面可能同时包含弧线和线段。':'圆锥不能用平面切出梯形或长方形。选择三角形时，切面将通过顶点。'):'只列出已验证的自动定位示例；定位后仍可手动调整切面。';
  $('vertexTool').hidden=curvedSolid();$('vertexMethod').textContent=curvedSolid()?'圆柱没有顶点，圆锥只有1个顶点。请通过目标截面或角度、前后移动来探索。':'选择2个顶点可锁定一条轴线，再拖动两个角度让切面绕轴旋转；选择第3个顶点即可唯一确定切面。';
}
function renderSectionPreview(section:Section,normal:THREE.Vector3){
  const svg=$('sectionPreview');
  if(section.points.length<3){svg.innerHTML='<text x="90" y="55" text-anchor="middle" fill="#617886" font-size="12">未形成截面</text>';return}
  const {u,v}=frame(normal),p=section.points.map(p=>[p.dot(u),p.dot(v)]),xs=p.map(q=>q[0]),ys=p.map(q=>q[1]),minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(...xs)-minX,h=Math.max(...ys)-minY,scale=Math.min(145/Math.max(w,.01),85/Math.max(h,.01));
  svg.innerHTML=`<polygon points="${p.map(([x,y])=>[90+(x-minX-w/2)*scale,55-(y-minY-h/2)*scale].join(',')).join(' ')}" fill="#ffe596" stroke="#9d7418" stroke-width="1.8"/>`;
}
function locateTarget(){
 const value=$<HTMLSelectElement>('sectionTarget').value as SectionKind;if(!value)return;
 const pose=targetCatalog(state.shape,state.sides).get(value);
 if(!pose){$('targetNote').textContent=unavailableReason(state.shape,value);return}
 cancelCutAnimation();clearSelectedVertices();targetGoal=value;
 state.tilt=THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(pose.normal.y,-1,1)));
 state.turn=(THREE.MathUtils.radToDeg(Math.atan2(pose.normal.z,pose.normal.x))+360)%360;
 state.offset=pose.distance;state.separation=0;planeCenter.copy(pose.normal).multiplyScalar(pose.distance);
 syncInputs();rebuild();
 const basis=frame(pose.normal),view=pose.normal.clone().multiplyScalar(1.6).addScaledVector(basis.u,.6).addScaledVector(basis.v,.5).normalize();
 controls.target.set(0,0,0);camera.position.copy(view).multiplyScalar(12);fitView();
 $('targetNote').textContent='已定位到'+labels[value]+'截面。可继续手动调整，或点击“开始切割并拉开”。';
}
$('sectionTarget').addEventListener('change',locateTarget);$('locateTarget').onclick=locateTarget;

function cuttingNormal() {
  const tilt = THREE.MathUtils.degToRad(state.tilt);
  const direction = THREE.MathUtils.degToRad(state.turn);
  return new THREE.Vector3(
    Math.sin(tilt) * Math.cos(direction),
    Math.cos(tilt),
    Math.sin(tilt) * Math.sin(direction),
  ).normalize();
}

function effectiveCuttingNormal() {
  const desiredNormal = cuttingNormal();
  if (selectedVertices.length !== 2) return desiredNormal;
  const lockedAxis = selectedVertices[1]
    .clone()
    .sub(selectedVertices[0])
    .normalize();
  const constrainedNormal = desiredNormal
    .clone()
    .addScaledVector(lockedAxis, -desiredNormal.dot(lockedAxis));
  if (constrainedNormal.lengthSq() < 0.000001) {
    const helper =
      Math.abs(lockedAxis.y) < 0.9
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    constrainedNormal.crossVectors(lockedAxis, helper);
  }
  return constrainedNormal.normalize();
}

function uniqueVertices(g: THREE.BufferGeometry) {
  const positions = g.getAttribute("position");
  const vertices: THREE.Vector3[] = [];
  for (let i = 0; i < positions.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, i);
    if (!vertices.some((v) => v.distanceToSquared(point) < 0.000001)) {
      vertices.push(point);
    }
  }
  return vertices;
}

function updateVertexHint(message?: string) {
  const hint = $<HTMLSpanElement>("vertexHint");
  if (message) {
    hint.textContent = message;
    return;
  }
  const count = selectedVertices.length;
  hint.textContent =
    count === 0
      ? "已选0个顶点，请先选择2个顶点。"
      : count === 1
        ? "已选1个顶点，再选1个即可锁定切面。"
        : count === 2
          ? "双点已锁定：拖动两个角度，切面会绕两点连线旋转；也可再选第3点。"
          : count === 3
            ? "已选3个顶点，切面已确定；可再选1个共面顶点。"
            : "已选4个共面顶点，切面已经过这4个顶点。";
}

function clearSelectedVertices(showMessage = false) {
  selectedVertices = [];
  if (showMessage) updateVertexHint("已清除，请重新选择2个顶点。");
  else updateVertexHint();
}

function activateTwoPointLock() {
  planeCenter
    .copy(selectedVertices[0])
    .add(selectedVertices[1])
    .multiplyScalar(0.5);
  state.offset = 0;
  state.separation = 0;
  syncInputs();
  rebuild();
  updateVertexHint();
  stageStatus.textContent = "双点锁定：切面始终经过这两个顶点";
}

function viewDistance() {
  const width = Math.max(canvas.clientWidth, 1);
  const height = Math.max(canvas.clientHeight, 1);
  const aspect = width / height;
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const sphere = new THREE.Sphere(new THREE.Vector3(), 3.9);
  if (model) new THREE.Box3().setFromObject(model).getBoundingSphere(sphere);
  const modelRadius = Math.max(sphere.radius, 3.9);
  return THREE.MathUtils.clamp(
    (modelRadius / Math.sin(limitingFov / 2)) * 1.28,
    10,
    26,
  );
}

function fitView(resetDirection = false) {
  const direction = resetDirection
    ? defaultViewDirection.clone()
    : camera.position.clone().sub(controls.target).normalize();
  if (direction.lengthSq() < 0.1) direction.copy(defaultViewDirection);
  const center = new THREE.Vector3();
  if (model) new THREE.Box3().setFromObject(model).getCenter(center);
  controls.target.copy(center);
  camera.position.copy(center).add(direction.multiplyScalar(viewDistance()));
  controls.update();
}
function geometry() {
  return createSolid(state.shape,state.sides);
}

function planeFromFirstThreeVertices() {
  if (selectedVertices.length < 3) return null;
  const edgeA = selectedVertices[1].clone().sub(selectedVertices[0]);
  const edgeB = selectedVertices[2].clone().sub(selectedVertices[0]);
  const normal = new THREE.Vector3().crossVectors(edgeA, edgeB);
  if (normal.lengthSq() < 0.000001) return null;
  normal.normalize();
  if (normal.y < -0.00001 || (Math.abs(normal.y) < 0.00001 && normal.x < 0)) {
    normal.negate();
  }
  return new THREE.Plane().setFromNormalAndCoplanarPoint(
    normal,
    selectedVertices[0],
  );
}

function applyPlaneThroughSelectedVertices() {
  const plane = planeFromFirstThreeVertices();
  if (!plane) {
    updateVertexHint("这3个顶点在同一直线上，不能确定切面，请换一个顶点。");
    stageStatus.textContent = "三个共线点不能确定一个平面";
    rebuild();
    return false;
  }
  state.tilt = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(plane.normal.y, -1, 1)));
  state.turn = (THREE.MathUtils.radToDeg(Math.atan2(plane.normal.z,plane.normal.x))+360)%360;
  state.offset = plane.normal.dot(selectedVertices[0]);
  planeCenter.copy(plane.normal).multiplyScalar(state.offset);
  state.separation = 0;
  syncInputs();
  rebuild();
  updateVertexHint();
  stageStatus.textContent =
    selectedVertices.length === 4
      ? "切面经过4个已选顶点"
      : "切面经过3个已选顶点";
  return true;
}

function chooseVertex(point: THREE.Vector3) {
  const existing = selectedVertices.findIndex(
    (selected) => selected.distanceToSquared(point) < 0.000001,
  );
  if (existing >= 0) {
    selectedVertices.splice(existing, 1);
    if (selectedVertices.length >= 3) applyPlaneThroughSelectedVertices();
    else if (selectedVertices.length === 2) activateTwoPointLock();
    else {
      state.offset = 0;
      planeCenter.set(0, 0, 0);
      syncInputs();
      rebuild();
      updateVertexHint();
      stageStatus.textContent = "请选择两个顶点锁定切面";
    }
    return;
  }
  if (selectedVertices.length === 4) {
    updateVertexHint("最多选择4个顶点；请先清除或点已选顶点取消。 ");
    return;
  }
  if (selectedVertices.length === 3) {
    const plane = planeFromFirstThreeVertices();
    if (!plane || Math.abs(plane.distanceToPoint(point)) > 0.02) {
      updateVertexHint(
        "这个顶点与前三个顶点不共面，不能由同一切面通过，请换一个。 ",
      );
      stageStatus.textContent = "第四个顶点不共面，请换一个顶点";
      return;
    }
  }
  selectedVertices.push(point.clone());
  if (selectedVertices.length >= 3) applyPlaneThroughSelectedVertices();
  else if (selectedVertices.length === 2) activateTwoPointLock();
  else {
    state.separation = 0;
    syncInputs();
    rebuild();
    updateVertexHint();
    stageStatus.textContent = "再选一个顶点即可锁定切面";
  }
}
function clear() {
  if (!model) return;
  scene.remove(model);
  model.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      o.geometry.dispose();
      const m = o.material;
      (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
    }
  });
}
function rebuild() {
  clear();
  vertexMarkers = [];
  const group = new THREE.Group(),
    g = geometry(),
    normal = effectiveCuttingNormal(),
    base = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, planeCenter),
    gap = state.separation * 0.55,
    pa = base.clone(),
    pb = base.clone().negate();
  pa.constant -= gap;
  pb.constant -= gap;
  const ma = new THREE.MeshPhysicalMaterial({
      color: 0x2379ba,
      roughness: 0.26,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
      clippingPlanes: [pa],
    }),
    mb = new THREE.MeshPhysicalMaterial({
      color: 0xef6b4f,
      roughness: 0.3,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      clippingPlanes: [pb],
    }),
    a = new THREE.Mesh(g.clone(), ma),
    b = new THREE.Mesh(g.clone(), mb);
  a.position.copy(normal).multiplyScalar(gap);
  b.position.copy(normal).multiplyScalar(-gap);
  group.add(a, b);
  const edges = new THREE.EdgesGeometry(g,curvedSolid()?2:1),
    wireMat = new THREE.LineBasicMaterial({
      color: 0x17324d,
      transparent: true,
      opacity: 0.35,
    }),
    wa = new THREE.LineSegments(edges, wireMat),
    wb = new THREE.LineSegments(edges.clone(), wireMat.clone());
  wa.position.copy(a.position);
  wb.position.copy(b.position);
  group.add(wa, wb);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 5.4),
    new THREE.MeshBasicMaterial({
      color: 0xffcf40,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  plane.position.copy(planeCenter);
  group.add(plane);
  const actualSection = sectionFor(state.shape,g,base),sectionGeometry=faceGeometry(actualSection),label=labels[actualSection.kind];
  sectionName.textContent = label;
  if (sectionGeometry) {
    const cut = new THREE.Mesh(
      sectionGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xffd441,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: state.separation < 0.15 ? 0.88 : 0.98,
        depthTest: false,
        depthWrite: false,
      }),
    );
    cut.position.copy(normal).multiplyScalar(gap>0?gap:0.006);
    cut.renderOrder = 20;
    group.add(cut);
    if(gap>0){const other=new THREE.Mesh(sectionGeometry.clone(),(cut.material as THREE.Material).clone());other.position.copy(normal).multiplyScalar(-gap);other.renderOrder=20;group.add(other)}
  }
  if (state.separation < 0.15&&!curvedSolid()) {
    const clickableVertices = uniqueVertices(g).filter((point) => {
      if (state.shape === "cube") return true;
      const radialDistance = Math.hypot(point.x, point.z);
      return (
        radialDistance > 0.05 || (state.shape === "pyramid" && point.y > 0)
      );
    });
    for (const point of clickableVertices) {
      const selectedIndex = selectedVertices.findIndex(
        (selected) => selected.distanceToSquared(point) < 0.000001,
      );
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(selectedIndex >= 0 ? 0.21 : 0.145, 18, 12),
        new THREE.MeshBasicMaterial({
          color: selectedIndex >= 0 ? 0xffb400 : 0x0e7281,
          depthTest: false,
        }),
      );
      marker.position.copy(point);
      marker.renderOrder = 40;
      marker.userData.vertex = point.clone();
      vertexMarkers.push(marker);
      group.add(marker);
    }
  }
  g.dispose();
  model = group;
  scene.add(group);
  const title = state.shape==='cube'?'正方体':state.shape==='cuboid'?'长方体':state.shape==='cylinder'?'圆柱':state.shape==='cone'?'圆锥':`${numeral[state.sides]}${state.shape==='prism'?'棱柱':'棱锥'}`;
  shapeName.textContent = title;
  stageStatus.textContent =
    state.separation > 0.15 ? `切割完成：截面是${label}` : "亮黄色区域就是截面";
  if (state.separation <= 0.15 && selectedVertices.length === 2) {
    stageStatus.textContent = "双点锁定：切面始终经过这两个顶点";
  }
  stage.dataset.selectedVertices = String(selectedVertices.length);
  stage.dataset.separation = String(state.separation);
  stage.dataset.anchorError = String(selectedVertices.reduce((error, point) => Math.max(error, Math.abs(base.distanceToPoint(point))), 0));
  stage.dataset.sectionKind=actualSection.kind;stage.dataset.sectionArea=String(actualSection.area);stage.dataset.plane=JSON.stringify([...normal.toArray(),base.constant]);stage.dataset.sectionPoints=JSON.stringify(actualSection.points.map(p=>p.toArray()));
  $('sectionDetail').textContent=actualSection.note||'黄色区域为真实切面与立体的交集。';renderSectionPreview(actualSection,normal);
  if(targetGoal&&actualSection.kind!==targetGoal)$('targetNote').textContent='切面已手动改变，当前为'+label+'。可点击“重新定位”回到所选截面。';
  stage.classList.toggle("cut", state.separation > 0.15);
}
function updateOutputs() {
  $<HTMLInputElement>("tiltNumber").value = String(Number(state.tilt.toFixed(2)));
  $<HTMLInputElement>("turnNumber").value = String(Number(state.turn.toFixed(2)));
  const offsetInput = $<HTMLInputElement>("offset");
  offsetInput.disabled = selectedVertices.length >= 2;
  $<HTMLOutputElement>("offsetOut").textContent =
    selectedVertices.length >= 2
      ? "顶点锁定"
      : state.offset === 0
        ? "正中间"
        : state.offset > 0
          ? `向前 ${state.offset.toFixed(1)}`
          : `向后 ${Math.abs(state.offset).toFixed(1)}`;
  $<HTMLOutputElement>("distanceOut").textContent =
    state.separation === 0 ? "还没拉开" : "拖动可继续调整";
}
function renderSideButtons() {
  sidePicker.hidden = state.shape !== 'prism'&&state.shape!=='pyramid';
  sideButtons.innerHTML = "";
  for (let n = 3; n <= 6; n++) {
    const b = document.createElement("button");
    b.textContent = `${numeral[n]}${state.shape === "prism" ? "棱柱" : "棱锥"}`;
    b.classList.toggle("active", n === state.sides);
    b.onclick = () => {
      clearSelectedVertices();
      planeCenter.set(0, 0, 0);
      state.sides = n;
      state.offset = 0;
      state.separation = 0;
      syncInputs();
      renderSideButtons();
      refreshTargets();
      rebuild();
      fitView();
    };
    sideButtons.appendChild(b);
  }
}
function syncInputs() {
  ($("tilt") as HTMLInputElement).value = String(state.tilt);
  ($("turn") as HTMLInputElement).value = String(state.turn);
  ($("offset") as HTMLInputElement).value = String(state.offset);
  ($("distance") as HTMLInputElement).value = String(state.separation);
  updateOutputs();
}
document.querySelectorAll<HTMLButtonElement>(".family").forEach(
  (b) =>
    (b.onclick = () => {
      clearSelectedVertices();
      planeCenter.set(0, 0, 0);
      state.shape = b.dataset.shape as Shape;
      if (state.shape !== "cube" && state.sides < 3) state.sides = 3;
      state.offset = 0;
      state.separation = 0;
      document
        .querySelectorAll(".family")
        .forEach((x) => x.classList.toggle("active", x === b));
      syncInputs();
      renderSideButtons();
      refreshTargets();
      rebuild();
      fitView();
    }),
);
for (const id of ["tilt", "turn", "offset", "distance"]) {
  const input = $(id) as HTMLInputElement;
  input.oninput = () => {
    if (id !== "distance" && selectedVertices.length !== 2) {
      clearSelectedVertices();
    }
    const key = id === "distance" ? "separation" : id;
    state[key as "tilt" | "turn" | "offset" | "separation"] = Number(
      input.value,
    );
    if (id === "offset" && selectedVertices.length < 2) {
      planeCenter.copy(cuttingNormal()).multiplyScalar(state.offset);
    }
    updateOutputs();
    rebuild();
    if (id === "distance") fitView();
  };
}
for (const { numberId, rangeId, key, min, max } of [
  {
    numberId: "tiltNumber",
    rangeId: "tilt",
    key: "tilt" as const,
    min: 0,
    max: 180,
  },
  {
    numberId: "turnNumber",
    rangeId: "turn",
    key: "turn" as const,
    min: 0,
    max: 360,
  },
]) {
  const numberInput = $<HTMLInputElement>(numberId);
  const rangeInput = $<HTMLInputElement>(rangeId);
  const applyTypedAngle = () => {
    if (numberInput.value.trim() === "") return;
    const typedValue = Number(numberInput.value);
    if (!Number.isFinite(typedValue)) return;
    if (selectedVertices.length !== 2) clearSelectedVertices();
    const angle = THREE.MathUtils.clamp(typedValue, min, max);
    state[key] = angle;
    numberInput.value = String(angle);
    rangeInput.value = String(angle);
    rebuild();
  };
  numberInput.oninput = applyTypedAngle;
  numberInput.onchange = () => {
    applyTypedAngle();
    syncInputs();
  };
}
document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach(
  (b) =>
    (b.onclick = () => {
      clearSelectedVertices();
      planeCenter.set(0, 0, 0);
      const p = b.dataset.preset;
      if (p === "horizontal") {
        state.tilt = 0;
        state.turn = 0;
      } else if (p === "vertical") {
        state.tilt = 90;
        state.turn = 0;
      } else {
        state.tilt = 90;
        state.turn = 45;
      }
      state.offset = 0;
      state.separation = 0.95;
      syncInputs();
      rebuild();
      fitView();
    }),
);
let cutTimers: ReturnType<typeof setTimeout>[] = [];
function cancelCutAnimation() {
  cutTimers.forEach(clearTimeout);
  cutTimers = [];
}
// Any new interaction supersedes a pending cut, including merge and shape changes.
document.addEventListener("click", cancelCutAnimation, true);
document.addEventListener("input", cancelCutAnimation, true);
$("cut").onclick = () => {
  cancelCutAnimation();
  state.separation = 0;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.separation = 1.15;
    syncInputs(); rebuild(); fitView(); return;
  }
  cutTimers = [0.28, 0.58, 0.88, 1.15].map((v, i) =>
    setTimeout(
      () => {
        state.separation = v;
        syncInputs();
        rebuild();
        fitView();
      },
      70 * (i + 1),
    ),
  );
};
$("merge").onclick = () => {
  state.separation = 0;
  syncInputs();
  rebuild();
  fitView();
};
$("resetView").onclick = () => fitView(true);
$("clearVertices").onclick = () => {
  clearSelectedVertices(true);
  state.offset = 0;
  planeCenter.set(0, 0, 0);
  syncInputs();
  rebuild();
  stageStatus.textContent = "请选择2个顶点锁定切面";
};

function markerFromPointerEvent(event: PointerEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(vertexMarkers, false)[0]?.object as
    THREE.Mesh | undefined;
}

let pointerDownAt: { x: number; y: number } | undefined;
renderer.domElement.addEventListener("pointerdown", (event) => {
  pointerDownAt = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener("pointerup", (event) => {
  if (!pointerDownAt) return;
  const moved = Math.hypot(
    event.clientX - pointerDownAt.x,
    event.clientY - pointerDownAt.y,
  );
  pointerDownAt = undefined;
  if (moved > 6) return;
  const marker = markerFromPointerEvent(event);
  const point = marker?.userData.vertex as THREE.Vector3 | undefined;
  if (point) chooseVertex(point);
});
renderer.domElement.addEventListener("pointercancel", () => { pointerDownAt = undefined; });
renderer.domElement.addEventListener("pointermove", (event) => {
  if (pointerDownAt) return;
  renderer.domElement.style.cursor = markerFromPointerEvent(event)
    ? "pointer"
    : "grab";
});
let previousWidth = 0;
let previousHeight = 0;
function resize() {
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  if (w < 1 || h < 1) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Keep the WebGL drawing buffer sharp on high-DPI screens while making its
  // CSS size exactly match the visible stage. Without updating the CSS size,
  // devicePixelRatio can make the canvas twice as large and push the model to
  // the lower-right of the clipped viewport.
  renderer.setSize(w, h, true);
  if (Math.abs(w - previousWidth) > 2 || Math.abs(h - previousHeight) > 2) {
    previousWidth = w;
    previousHeight = h;
    fitView();
  }
}
new ResizeObserver(resize).observe(canvas);
resize();
renderSideButtons();
refreshTargets();
syncInputs();
rebuild();
fitView(true);
(function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
})();
