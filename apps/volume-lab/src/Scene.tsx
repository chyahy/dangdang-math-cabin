import { Component, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { cubePosition, formatHeight, heightCm, inMl, ml } from './units';
import type { Focus, LabState } from './state';
import { CUP_HEIGHT, CUP_RADIUS, pourAngle } from './beakerMath';
import { cupWaterGeometry } from './cupGeometry';

const glass = { color: '#d4f2ff', transparent: true, opacity: .105, roughness: .12, metalness: .03, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false } as const;
const waterColor = '#299edb';
function Label({ text, position, scale = 1, color = '#234e69', background = true }: { text: string; position: [number, number, number]; scale?: number; color?: string; background?: boolean }) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas');
    let c = canvas.getContext('2d')!; c.font = '600 64px "Microsoft YaHei", "PingFang SC", sans-serif';
    canvas.width = Math.ceil(c.measureText(text).width + 40); canvas.height = 108;
    c = canvas.getContext('2d')!;
    if (background) { c.fillStyle = 'rgba(250,254,255,.94)'; c.beginPath(); c.roundRect(2, 8, canvas.width - 4, 92, 16); c.fill(); }
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '600 64px "Microsoft YaHei", "PingFang SC", sans-serif'; c.fillText(text, canvas.width / 2, 57);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; return { texture: tex, aspect: canvas.width / canvas.height };
  }, [text, color, background]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={position} scale={[aspect * .86 * scale, .86 * scale, 1]} renderOrder={6}><spriteMaterial map={texture} transparent depthWrite={false} depthTest={false} /></sprite>;
}
function GlassBox({ size = 10 }: { size?: number }) {
  const t = size === 10 ? .12 : .028;
  const edges = useMemo(() => { const box = new THREE.BoxGeometry(size + t, size, size + t), e = new THREE.EdgesGeometry(box); box.dispose(); return e; }, [size, t]);
  useEffect(() => () => edges.dispose(), [edges]);
  const walls: { position: [number, number, number]; args: [number, number, number] }[] = [
    { position: [0, -t / 2, 0], args: [size + t * 2, t, size + t * 2] },
    { position: [-(size + t) / 2, size / 2, 0], args: [t, size, size + t * 2] },
    { position: [(size + t) / 2, size / 2, 0], args: [t, size, size + t * 2] },
    { position: [0, size / 2, -(size + t) / 2], args: [size, size, t] },
    { position: [0, size / 2, (size + t) / 2], args: [size, size, t] },
  ];
  return <group>
    {walls.map((w, i) => <mesh key={i} position={w.position} renderOrder={3}><boxGeometry args={w.args} /><meshPhysicalMaterial {...glass} /></mesh>)}
    <lineSegments position={[0, size / 2, 0]} geometry={edges}><lineBasicMaterial color="#5e91ac" transparent opacity={.65} /></lineSegments>
  </group>;
}
function Water({ volume, size = 10, waves = true }: { volume: bigint; size?: number; waves?: boolean }) {
  const h = size === 10 ? heightCm(volume) : Math.max(0, Math.min(size, inMl(volume) / (size * size)));
  const uniforms = useMemo(() => ({ uWaterTime: { value: 0 }, uWaterAmp: { value: 0 } }), []);
  const material = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ color: waterColor, transparent: true, opacity: .70, roughness: .18, metalness: .04, clearcoat: .9, depthWrite: false, side: THREE.FrontSide });
    m.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = 'uniform float uWaterTime; uniform float uWaterAmp;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += step(0.49, position.y) * uWaterAmp * sin(position.x * 0.62831853) * sin(position.z * 0.62831853) * sin(uWaterTime * 1.25);');
    };
    return m;
  }, [uniforms]);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => { uniforms.uWaterTime.value = clock.elapsedTime; uniforms.uWaterAmp.value = waves && h > 0 ? Math.min(.025, h * .012, (size - h) * .04) / h : 0; });
  if (h <= 0) return null;
  return <mesh position={[0, h / 2, 0]} scale={[1, h, 1]} renderOrder={2} material={material}><boxGeometry args={[size, 1, size, 24, 1, 24]} /></mesh>;
}
function Dimensions() {
  return <group>
    <Line points={[[-5, -.2, 6.3], [5, -.2, 6.3]]} color="#627f92" lineWidth={1} />
    <Line points={[[6.3, -.2, -5], [6.3, -.2, 5]]} color="#627f92" lineWidth={1} />
    <Line points={[[-6.1, 0, 5.1], [-6.1, 10, 5.1]]} color="#627f92" lineWidth={1} />
    {[-5, 5].map(x => <Line key={'x' + x} points={[[x, -.2, 6], [x, -.2, 6.6]]} color="#627f92" lineWidth={1} />)}
    {[-5, 5].map(z => <Line key={'z' + z} points={[[6, -.2, z], [6.6, -.2, z]]} color="#627f92" lineWidth={1} />)}
    {[0, 10].map(y => <Line key={y} points={[[-6.4, y, 5.1], [-5.8, y, 5.1]]} color="#627f92" lineWidth={1} />)}
    <Label text="10 cm" position={[0, -.7, 6.8]} scale={.9} />
    <Label text="10 cm" position={[6.7, -.7, 0]} scale={.9} />
    <Label text="10 cm" position={[-6.5, 5, 5.1]} scale={.85} />
  </group>;
}
function Ticks() {
  return <group>{Array.from({ length: 10 }, (_, i) => i + 1).map(i => <group key={i}>
    <Line points={[[4.5, i, 5.14], [5.2, i, 5.14]]} color="#406e8a" lineWidth={1.5} />
    <Label text={`${i * 100} mL`} position={[6.65, i, 5.15]} scale={.95} />
  </group>)}</group>;
}
function Tank({ volume, position = [0, 0, 0], ticks = true }: { volume: bigint; position?: [number, number, number]; ticks?: boolean }) {
  return <group position={position}><GlassBox /><Water volume={volume} /><Dimensions />{ticks && <Ticks />}</group>;
}
function UnitBox({ water, position = [-8.8, 0, 1] }: { water: boolean; position?: [number, number, number] }) {
  return <group position={position}>
    {water ? <><GlassBox size={1} /><Water volume={ml(1)} size={1} waves={false} /></> : <mesh position={[0, .5, 0]} castShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#45b8c6" roughness={.3} /><lineSegments><edgesGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} /><lineBasicMaterial color="#367e92" /></lineSegments></mesh>}
    <Label text={water ? '对照：1 mL = 1 cm³' : '对照：1 cm³'} position={[0, 1.65, 0]} scale={.65} />
    <Label text="边长 1 cm" position={[0, -.55, 0]} scale={.55} />
  </group>;
}
function CubePacking({ count, slice, slicing }: { count: number; slice: number; slicing: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const shown = slicing ? Math.min(count, slice * 100) : count;
  const lineGeometry = useMemo(() => {
    const unit = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), data = unit.getAttribute('position');
    const arr = new Float32Array(1000 * data.count * 3);
    for (let i = 0; i < 1000; i++) { const p = cubePosition(i); for (let j = 0; j < data.count; j++) { const k = (i * data.count + j) * 3; arr[k] = data.getX(j) + p[0]; arr[k + 1] = data.getY(j) + p[1]; arr[k + 2] = data.getZ(j) + p[2]; } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); unit.dispose(); return g;
  }, []);
  useEffect(() => () => lineGeometry.dispose(), [lineGeometry]);
  useLayoutEffect(() => {
    const instance = mesh.current!; const dummy = new THREE.Object3D();
    const colors = ['#86ccde', '#64bdce', '#4da9c6', '#65c4bc', '#79b9e2'];
    for (let i = 0; i < 1000; i++) { dummy.position.set(...cubePosition(i)); dummy.updateMatrix(); instance.setMatrixAt(i, dummy.matrix); instance.setColorAt(i, new THREE.Color(colors[Math.floor(i / 100) % 5]).multiplyScalar((i % 10 + Math.floor(i / 10)) % 2 ? .94 : 1)); }
    instance.instanceMatrix.needsUpdate = true; if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
    instance.computeBoundingSphere();
  }, []);
  useLayoutEffect(() => { if (mesh.current) mesh.current.count = shown; lineGeometry.setDrawRange(0, shown * 24); }, [shown, lineGeometry]);
  return <group>
    <GlassBox /><Dimensions />
    <instancedMesh ref={mesh} args={[undefined, undefined, 1000]} count={shown} castShadow receiveShadow frustumCulled={false}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial roughness={.4} metalness={.02} /></instancedMesh>
    <lineSegments geometry={lineGeometry} renderOrder={1}><lineBasicMaterial color="#3a7a97" transparent opacity={.52} /></lineSegments>
    <Label text="1 dm = 10 cm" position={[0, 11.4, 0]} scale={1.1} />
  </group>;
}
function Beaker({ volume, angle }: { volume: bigint; angle: number }) {
  const waterGeometry = useMemo(() => cupWaterGeometry(inMl(volume), angle), [volume, angle]);
  const lipGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([CUP_RADIUS - .1, CUP_HEIGHT, -.65, CUP_RADIUS + .65, CUP_HEIGHT, 0, CUP_RADIUS - .1, CUP_HEIGHT, .65], 3)); g.computeVertexNormals(); return g;
  }, []);
  useEffect(() => () => waterGeometry.dispose(), [waterGeometry]); useEffect(() => () => lipGeometry.dispose(), [lipGeometry]);
  return <group position={[-1.5, CUP_HEIGHT, 0]} rotation={[0, 0, -angle]}><group position={[-CUP_RADIUS, -CUP_HEIGHT, 0]}>
    <mesh position={[0, CUP_HEIGHT / 2, 0]} renderOrder={3}><cylinderGeometry args={[CUP_RADIUS + .08, CUP_RADIUS + .08, CUP_HEIGHT, 96, 1, true]} /><meshPhysicalMaterial {...glass} opacity={.14} /></mesh>
    <mesh position={[0, -.06, 0]} renderOrder={3}><cylinderGeometry args={[CUP_RADIUS + .08, CUP_RADIUS + .08, .12, 96]} /><meshPhysicalMaterial {...glass} /></mesh>
    {[0, CUP_HEIGHT].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[CUP_RADIUS + .08, .035, 6, 96]} /><meshBasicMaterial color="#84afc6" transparent opacity={.68} /></mesh>)}
    <mesh position={[-CUP_RADIUS, CUP_HEIGHT * .52, 0]} rotation={[0, 0, Math.PI / 2]} renderOrder={3}><torusGeometry args={[2.1, .16, 8, 40, Math.PI]} /><meshPhysicalMaterial {...glass} opacity={.45} /></mesh>
    <mesh geometry={lipGeometry} renderOrder={3}><meshPhysicalMaterial {...glass} opacity={.4} /></mesh>
    {volume > 0n && <mesh geometry={waterGeometry} renderOrder={2}><meshPhysicalMaterial color={waterColor} roughness={.16} transparent opacity={.72} depthWrite={false} clearcoat={1} /></mesh>}
    {[200, 400, 600, 800, 1000].map(amount => <group key={amount}>
      <Line points={Array.from({ length: 7 }, (_, i) => { const phi = 1.28 - i / 6 * .17; return [(CUP_RADIUS + .11) * Math.cos(phi), CUP_HEIGHT * amount / 1000, (CUP_RADIUS + .11) * Math.sin(phi)] as [number, number, number]; })} color="#477f9d" lineWidth={1.2} />
      <Label text={`${amount} mL`} position={[0, CUP_HEIGHT * amount / 1000, CUP_RADIUS + .12]} scale={.82} />
    </group>)}
  </group></group>;
}
function Stream({ angle, height, paused }: { angle: number; height: number; paused: boolean }) {
  const particles = useRef<THREE.InstancedMesh>(null), time = useRef(0);
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.5 + .65 * Math.cos(angle), CUP_HEIGHT - .65 * Math.sin(angle), 0), new THREE.Vector3(2, CUP_HEIGHT - 1.6, 0), new THREE.Vector3(7, height, 0)), [angle, height]);
  const tube = useMemo(() => new THREE.TubeGeometry(curve, 36, .07, 6, false), [curve]);
  useEffect(() => () => tube.dispose(), [tube]);
  useFrame((_, dt) => {
    if (!paused) time.current += dt;
    const instance = particles.current; if (!instance) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 26; i++) { const t = (time.current * .55 + i / 26) % 1; dummy.position.copy(curve.getPoint(t)); dummy.scale.setScalar(.65 + Math.sin(t * Math.PI) * .35); dummy.updateMatrix(); instance.setMatrixAt(i, dummy.matrix); }
    instance.instanceMatrix.needsUpdate = true;
  });
  return <group><mesh geometry={tube}><meshBasicMaterial color="#53bcec" transparent opacity={.43} depthWrite={false} /></mesh><instancedMesh ref={particles} args={[undefined, undefined, 26]} frustumCulled={false}><sphereGeometry args={[.12, 6, 6]} /><meshStandardMaterial color="#58b9e5" transparent opacity={.85} roughness={.1} /></instancedMesh></group>;
}
function FocusCamera({ focus, version, mode }: { focus: Focus; version: number; mode: LabState['mode'] }) {
  const controls = useRef<OrbitControlsImpl>(null), tween = useRef<{ from: THREE.Vector3; targetFrom: THREE.Vector3; to: THREE.Vector3; target: THREE.Vector3; t: number } | null>(null);
  const { camera } = useThree();
  useEffect(() => {
    const target = focus === 'one' ? new THREE.Vector3(-8.8, .5, 1) : mode === 'pour' ? new THREE.Vector3(-.5, 8, 0) : new THREE.Vector3(0, 4.2, 0);
    const to = focus === 'one' ? new THREE.Vector3(-6.5, 2.3, 5.6) : focus === 'front' ? new THREE.Vector3(mode === 'pour' ? -.5 : 0, mode === 'pour' ? 11 : 5.2, mode === 'pour' ? 47 : 29) : mode === 'pour' ? new THREE.Vector3(23, 24, 40) : new THREE.Vector3(18, 15.5, 23);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches && controls.current) { camera.position.copy(to); controls.current.target.copy(target); controls.current.update(); tween.current = null; return; }
    tween.current = { from: camera.position.clone(), targetFrom: controls.current?.target.clone() ?? new THREE.Vector3(), to, target, t: 0 };
  }, [camera, focus, version, mode]);
  useFrame((_, dt) => {
    const motion = tween.current; if (!motion || !controls.current) return;
    motion.t = Math.min(1, motion.t + dt / .8); const t = motion.t * motion.t * (3 - 2 * motion.t);
    camera.position.lerpVectors(motion.from, motion.to, t); controls.current.target.lerpVectors(motion.targetFrom, motion.target, t); controls.current.update();
    if (motion.t >= 1) tween.current = null;
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.09} minDistance={2.3} maxDistance={75} minPolarAngle={.08} maxPolarAngle={Math.PI * .49} onStart={() => { tween.current = null; }} />;
}
function Content({ state }: { state: LabState }) {
  const anim = state.pour.animation, p = anim ? anim.elapsed / anim.duration : 0;
  const angle = anim ? pourAngle(p, 1000 - inMl(anim.from), inMl(state.pour.cup), 1000 - inMl(anim.to)) : 0;
  const flow = !!anim && p > .18 && p < .82;
  return <>
    <ambientLight intensity={1.4} /><hemisphereLight args={['#effaff', '#abc5d1', 1.5]} />
    <directionalLight position={[10, 25, 14]} intensity={2.8} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={30} shadow-camera-bottom={-20} shadow-camera-far={80} shadow-bias={-.0004} />
    <directionalLight position={[-16, 12, -8]} intensity={1.0} color="#b0d5ff" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.18, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#eef7fb" roughness={.95} /></mesh>
    <gridHelper args={[60, 30, '#c8dce7', '#dfecf2']} position={[0, -.17, 0]} />
    {state.mode === 'water' && <><Tank volume={state.water.volume} /><UnitBox water /></>}
    {state.mode === 'cubes' && <><CubePacking count={state.cubes.count} slice={state.cubes.slice} slicing={state.cubes.slicing} /><UnitBox water={false} /></>}
    {state.mode === 'pour' && <><Tank position={[7, 0, 0]} volume={state.pour.tank} ticks={false} /><Beaker volume={state.pour.cup} angle={angle} />{flow && <Stream angle={angle} height={heightCm(state.pour.tank)} paused={!!anim?.paused} />}</>}
    <FocusCamera focus={state.focus} version={state.focusVersion} mode={state.mode} />
  </>;
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-fallback">当前浏览器未能开启 3D 画面。请用 Edge、Chrome 或 Safari 打开；右侧的换算和练习仍可使用。</div> : this.props.children; }
}
export function LabScene({ state }: { state: LabState }) {
  return <SceneBoundary><Canvas shadows camera={{ position: [18, 15.5, 23], fov: 40, near: .02, far: 250 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} fallback={<div className="scene-fallback">请开启浏览器的三维图形支持。</div>}><Content state={state} /></Canvas></SceneBoundary>;
}
function ZoomContent({ height, viewHeight }: { height: number; viewHeight: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera; cam.zoom = size.height / viewHeight; cam.position.set(0, viewHeight * .42, 3); cam.lookAt(0, viewHeight * .42, 0); cam.updateProjectionMatrix();
  }, [camera, size.height, viewHeight]);
  return <><ambientLight intensity={2} /><mesh position={[0, height / 2, 0]}><boxGeometry args={[1, height, .08]} /><meshBasicMaterial color="#44b8e8" transparent opacity={.68} /></mesh><Line points={[[-1, 0, .05], [1, 0, .05]]} color="#6a90a6" lineWidth={1.4} /><Line points={[[-1, height, .05], [1, height, .05]]} color="#007ea9" lineWidth={1.1} /></>;
}
export function WaterMagnifier({ volume }: { volume: bigint }) {
  const h = heightCm(volume), viewHeight = Math.max(.00000002, h * 2.2);
  return <div className="magnifier" data-testid="magnifier"><div><strong>局部放大</strong><span>仅放大观察画面</span></div><Canvas orthographic camera={{ position: [0, .02, 3], zoom: 3000, near: .01, far: 10 }} dpr={[1, 1.4]}><ZoomContent height={h} viewHeight={viewHeight} /></Canvas><p>实际水深 <b>{formatHeight(volume)} cm</b></p></div>;
}
