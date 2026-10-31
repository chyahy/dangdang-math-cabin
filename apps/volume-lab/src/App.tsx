import { useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, Beaker, Boxes, Check, ChevronRight, Droplets, FastForward, House, Info, Layers3, Maximize, Pause, Play, RotateCcw, SkipForward, Target } from 'lucide-react';
import { LabScene, WaterMagnifier } from './Scene';
import { CAPACITY, SCALE, UNITS, formatHeight, formatQuantity, inMl, ml, parseQuantity, type Unit } from './units';
import { conversionWarning, initialState, quantity, reducer, type Action, type LabState } from './state';

const MODES = [
  { id: 'water' as const, title: '透明水箱', subtitle: '水量就是所占空间', icon: Droplets },
  { id: 'cubes' as const, title: '立方体装箱', subtitle: '把 1000 个一一放进去', icon: Boxes },
  { id: 'pour' as const, title: '量杯倒水', subtitle: '换个容器，水量不变', icon: Beaker },
];
const KNOWLEDGE = [
  { title: '1 mL = 1 cm³', text: '看边长 1 cm 的小水盒', expression: '1 cm × 1 cm × 1 cm = 1 cm³', icon: Droplets },
  { title: '1 L = 1 dm³', text: '看装满 1 L 的正方体水箱', expression: '10 cm = 1 dm，满箱的水占 1 dm³', icon: Beaker },
  { title: '为什么是 1000 倍？', text: '看每排、每层与整个大方块', expression: '10 × 10 × 10 = 1000 个 1 cm³', icon: Boxes },
];
function QuantityField({ value, unit = 'mL', label, onCommit, onFocus, validate, displayUnit, id, className = '' }: { value: bigint; unit?: Unit; label: string; onCommit: (value: bigint) => void; onFocus?: () => void; validate?: (value: bigint) => void; displayUnit?: string; id?: string; className?: string }) {
  const [draft, setDraft] = useState(formatQuantity(value, unit)), [editing, setEditing] = useState(false), [error, setError] = useState('');
  const cancel = useRef(false);
  useEffect(() => { if (!editing) setDraft(formatQuantity(value, unit)); }, [value, unit, editing]);
  function commit() {
    setEditing(false); if (cancel.current) { cancel.current = false; setDraft(formatQuantity(value, unit)); return; }
    try { const parsed = parseQuantity(draft, unit); validate?.(parsed); if (parsed !== value) onCommit(parsed); setDraft(formatQuantity(parsed, unit)); setError(''); }
    catch (e) { setError((e as Error).message); setDraft(formatQuantity(value, unit)); }
  }
  return <div className={`quantity-field ${className}`}>
    <label htmlFor={id}>{label}</label><div className="quantity-input"><input id={id} aria-label={label} aria-invalid={!!error} inputMode="decimal" autoComplete="off" value={draft} onFocus={() => { setEditing(true); setError(''); onFocus?.(); }} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { cancel.current = true; e.currentTarget.blur(); } }} /><span>{displayUnit ?? UNITS.find(u => u.id === unit)!.symbol}</span></div>
    {error && <span className="field-error" role="alert">{error}</span>}
  </div>;
}
function AnimationBar({ state, dispatch }: { state: LabState; dispatch: Dispatch<Action> }) {
  const animation = state[state.mode].animation;
  return <div className="animation-slot"><AnimatePresence>{animation && <motion.div className="animation-bar" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
    <button onClick={() => dispatch({ type: 'pause' })}>{animation.paused ? <Play size={14} /> : <Pause size={14} />}{animation.paused ? '继续动画' : '暂停动画'}</button>
    <div className="progress-track" aria-hidden><span style={{ width: `${animation.elapsed / animation.duration * 100}%` }} /></div>
    <button onClick={() => dispatch({ type: 'skip' })}><SkipForward size={14} />直接到位</button>
  </motion.div>}</AnimatePresence></div>;
}
const tankRange = (v: bigint) => { if (v > CAPACITY) throw new Error('本水箱可装 0—1000 mL。更大的数可在换算面板中输入。'); };
function ModeControls({ state, dispatch, reduced }: { state: LabState; dispatch: Dispatch<Action>; reduced: boolean }) {
  const pause = () => dispatch({ type: 'pause', paused: true });
  if (state.mode === 'water') {
    const w = state.water;
    return <>
      <div className="control-heading"><span className="eyebrow">观察水量与水深</span><span className="capacity-tag">容量 1 L</span></div>
      <QuantityField id="water-amount" label="水箱中的水量" value={w.volume} onCommit={v => dispatch({ type: 'water-to', value: v, animate: false })} onFocus={pause} validate={tankRange} className="large-field" />
      <input className="main-range" type="range" min="0" max="1000" step="1" value={inMl(w.volume)} aria-label="调节水箱水量" onChange={e => dispatch({ type: 'water-to', value: ml(Number(e.target.value)), animate: false })} />
      <div className="range-labels"><span>0 mL</span><span>1000 mL</span></div>
      <div className="quick-grid" aria-label="快捷水量">{[1, 10, 100, 250, 500, 750, 1000].map(n => <button key={n} className={w.volume === ml(n) ? 'selected' : ''} onClick={() => dispatch({ type: 'water-to', value: ml(n), animate: true, reduced })}>{n}<span>mL</span></button>)}</div>
      <div className="operation-row"><QuantityField id="water-step" label="单次注入 / 排出" value={w.step} onCommit={v => dispatch({ type: 'water-step', value: v })} validate={v => { tankRange(v); if (v === 0n) throw new Error('请设置大于 0 的操作水量。'); }} /><div className="operation-buttons"><button className="primary" disabled={w.volume >= CAPACITY} onClick={() => dispatch({ type: 'water-to', value: w.volume + w.step, animate: true, reduced })}><ArrowDown size={16} />注水</button><button className="secondary" disabled={w.volume <= 0n} onClick={() => dispatch({ type: 'water-to', value: w.volume - w.step, animate: true, reduced })}><ArrowUp size={16} />排水</button></div></div>
      <div className="calculation"><div><span>底面积</span><b>10 × 10 = 100 cm²</b></div><div><span>水位高度</span><b data-testid="height-reading">{formatQuantity(w.volume)} ÷ 100 = <em>{formatHeight(w.volume)} cm</em></b></div></div>
    </>;
  }
  if (state.mode === 'cubes') {
    const c = state.cubes;
    return <>
      <div className="control-heading"><span className="eyebrow">一块一块，装满 1 dm³</span><span className="capacity-tag">每块 1 cm³</span></div>
      <QuantityField id="cube-count" label="已装入方块数量" value={BigInt(c.count) * SCALE} displayUnit="个" onCommit={v => dispatch({ type: 'cubes', count: inMl(v) })} onFocus={pause} validate={v => { tankRange(v); if (v % SCALE) throw new Error('装箱数量需要是整数个。'); }} className="large-field" />
      <input className="main-range" type="range" min="0" max="1000" step="1" value={c.count} aria-label="调节装箱数量" onChange={e => dispatch({ type: 'cubes', count: Number(e.target.value) })} /><div className="range-labels"><span>空箱</span><span>1000 个 · 满箱</span></div>
      <div className="packing-buttons"><button className="primary" disabled={!!c.animation} onClick={() => dispatch({ type: 'start-cubes', reduced })}><Play size={16} />{c.count === 1000 ? '重新装箱' : '开始装箱'}</button><button className="secondary" onClick={() => dispatch({ type: 'speed' })}><FastForward size={15} />{c.speed}× 速度</button><button className="secondary" onClick={() => { dispatch({ type: 'cubes', count: 1 }); dispatch({ type: 'focus', focus: 'one' }); }}><Target size={15} />只看 1 个</button></div>
      <div className="layer-progress"><div><b>{Math.floor(c.count / 100)}</b><span>已装满的层</span></div><div><b>{c.count % 100}</b><span>新一层的方块</span></div><div><b>10</b><span>装满需要的层</span></div></div>
      <div className="calculation"><div><span>每一层</span><b>10 × 10 = 100 个</b></div><div><span>整个大方块</span><b>100 × 10 = <em>1000 个</em></b></div></div>
      <label className="slice-toggle"><input type="checkbox" checked={c.slicing} onChange={e => dispatch({ type: 'slice', layer: c.slice, enabled: e.target.checked })} /><Layers3 size={16} />剖层观察，看看里面</label>
      {c.slicing && <div className="slice-control"><label htmlFor="slice-layer">只显示底部 {c.slice} 层</label><input id="slice-layer" type="range" min="1" max="10" value={c.slice} onChange={e => dispatch({ type: 'slice', layer: Number(e.target.value) })} /><p>上方方块只隐藏，不移走；实际已装数量仍是 {c.count} 个。</p></div>}
    </>;
  }
  const p = state.pour;
  return <>
    <div className="control-heading"><span className="eyebrow">换容器，不换水量</span><span className="capacity-tag">总水量始终 1 L</span></div>
    <div className="pour-balance" data-testid="pour-balance" data-cup-ml={formatQuantity(p.cup)} data-tank-ml={formatQuantity(p.tank)} data-total-ml={formatQuantity(p.cup + p.tank)}><div><Beaker size={23} /><span>量杯剩余</span><b>{formatQuantity(p.cup)}<small> mL</small></b></div><span className="balance-plus">＋</span><div><Droplets size={23} /><span>水箱已有</span><b>{formatQuantity(p.tank)}<small> cm³</small></b></div></div>
    <label className="control-label">这次倒入多少？</label><div className="pour-options">{[100, 250, 500, 1000].map(n => <button key={n} className={p.amount === ml(n) ? 'selected' : ''} disabled={!!p.animation} onClick={() => dispatch({ type: 'pour-amount', value: ml(n) })}>{n}<span>mL</span></button>)}</div>
    <button className="primary wide-button" disabled={!!p.animation || p.cup === 0n} onClick={() => dispatch({ type: 'start-pour', reduced })}><Beaker size={17} />{p.cup === 0n ? '量杯已经倒空' : '开始倒水'}</button>
    <p className="micro-note">余量不足时，只倒入杯中剩余的水。水流为视觉示意，水量只按杯与水箱的数据计算。</p>
    <div className="calculation"><div><span>水量守恒</span><b>{formatQuantity(p.cup)} + {formatQuantity(p.tank)} = <em>1000 mL</em></b></div><div><span>水箱水位</span><b>{formatQuantity(p.tank)} ÷ 100 = {formatHeight(p.tank)} cm</b></div></div>
  </>;
}
const QUESTIONS = [
  { prompt: '500 mL 的水，能装满多少个 1 cm³ 的小盒子？', unit: '个', answer: '500', explain: '每 1 mL 对应 1 cm³，所以能装满 500 个小盒子。' },
  { prompt: '一个边长 1 dm 的正方体容器，最多能装多少升水？', unit: 'L', answer: '1', explain: '1 dm × 1 dm × 1 dm = 1 dm³，正好能装 1 L。' },
  { prompt: '1 L 是 1 mL 的多少倍？', unit: '倍', answer: '1000', explain: '1 L = 1000 mL，所以是 1000 倍。' },
  { prompt: '1 dm³ 为什么等于 1000 cm³？选出正确的计算。', unit: '', answer: '10 × 10 × 10 = 1000', explain: '1 dm = 10 cm，长、宽、高都各有 10 个 1 cm，不只是比较一条边。' },
];
function Challenge({ dispatch, reduced }: { dispatch: Dispatch<Action>; reduced: boolean }) {
  const [index, setIndex] = useState(0), [answer, setAnswer] = useState(''), [feedback, setFeedback] = useState<boolean | null>(null);
  const q = QUESTIONS[index];
  function verify() {
    if (index === 0 || index === 3) { dispatch({ type: 'mode', mode: 'cubes' }); dispatch({ type: 'cubes', count: 0 }); dispatch({ type: 'start-cubes', to: index === 0 ? 500 : 1000, reduced }); }
    else { dispatch({ type: 'mode', mode: 'water' }); dispatch({ type: 'water-to', value: index === 1 ? 0n : ml(1), animate: false }); dispatch({ type: 'water-to', value: CAPACITY, animate: true, reduced }); }
    document.getElementById('experiment')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
  function submit() {
    if (index === 3) setFeedback(answer === q.answer);
    else { try { setFeedback(parseQuantity(answer) === parseQuantity(q.answer)); } catch { setFeedback(false); } }
  }
  return <section className="challenge" aria-labelledby="challenge-title"><div className="challenge-heading"><div><span className="eyebrow">猜一猜，再验证</span><h2 id="challenge-title">让实验回答你</h2></div><span className="question-counter">{index + 1} / {QUESTIONS.length}</span></div>
    <div className="question-dots" aria-label="选择练习题">{QUESTIONS.map((_, i) => <button key={i} className={index === i ? 'active' : ''} aria-label={`第 ${i + 1} 题`} aria-pressed={index === i} onClick={() => { setIndex(i); setAnswer(''); setFeedback(null); }}>{i + 1}</button>)}</div>
    <h3>{q.prompt}</h3>
    {index === 3 ? <div className="answer-options">{['10 + 10 + 10 = 30', '10 × 10 = 100', '10 × 10 × 10 = 1000'].map(option => <label key={option} className={answer === option ? 'chosen' : ''}><input type="radio" name="challenge-answer" value={option} checked={answer === option} onChange={e => { setAnswer(e.target.value); setFeedback(null); }} />{option}</label>)}</div> : <div className="answer-input"><input aria-label="填写练习答案" inputMode="decimal" value={answer} placeholder="填入你的猜想" onChange={e => { setAnswer(e.target.value); setFeedback(null); }} onKeyDown={e => { if (e.key === 'Enter') submit(); }} /><span>{q.unit}</span></div>}
    <div className="challenge-actions"><button className="primary" onClick={submit} disabled={!answer.trim()}><Check size={16} />检查答案</button><button className="secondary" onClick={verify}><Play size={15} />用实验验证</button></div>
    <div className={`answer-feedback ${feedback === null ? '' : feedback ? 'correct' : 'incorrect'}`} role="status">{feedback === null ? '先想一想，也可以用实验检验自己的猜想。' : feedback ? '答对了！' + q.explain : '再想一想。' + q.explain}</div>
  </section>;
}
export default function App() {
  const reducedInitial = useReducedMotion();
  const [state, dispatch] = useReducer(reducer, undefined, initialState), [reduced, setReduced] = useState(!!reducedInitial);
  useEffect(() => { const mq = matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReduced(mq.matches); change(); mq.addEventListener('change', change); return () => mq.removeEventListener('change', change); }, []);
  const activeAnimation = useRef(state[state.mode].animation); activeAnimation.current = state[state.mode].animation;
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    let handle = 0, previous = performance.now();
    function frame(time: number) { const dt = time - previous; if (dt >= 32) { previous = time; if (activeAnimation.current && !activeAnimation.current.paused && !document.hidden) dispatch({ type: 'tick', dt }); } handle = requestAnimationFrame(frame); }
    handle = requestAnimationFrame(frame);
    const visibility = () => { previous = performance.now(); if (document.hidden) dispatch({ type: 'pause', paused: true }); };
    document.addEventListener('visibilitychange', visibility); return () => { cancelAnimationFrame(handle); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => { if (reduced) dispatch({ type: 'skip' }); }, [reduced]);
  useEffect(() => { const handler = () => setFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', handler); return () => document.removeEventListener('fullscreenchange', handler); }, []);
  const q = quantity(state), warning = conversionWarning(state), active = MODES.find(m => m.id === state.mode)!;
  const actual = state.mode === 'water' ? state.water.volume : state.mode === 'cubes' ? BigInt(state.cubes.count) * SCALE : state.pour.tank;
  const completed = state.mode === 'cubes' ? state.cubes.count === 1000 : state.mode === 'pour' ? state.pour.cup === 0n : state.water.volume === CAPACITY;
  const animation = state[state.mode].animation;
  const expression = state.knowledge !== null ? KNOWLEDGE[state.knowledge].expression : state.mode === 'cubes' ? `${state.cubes.count} 个 × 1 cm³ = ${state.cubes.count} cm³` : `${formatQuantity(actual)} mL = ${formatQuantity(actual)} cm³`;
  async function toggleFullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else alert('这个浏览器可以通过横屏获得更大的画面。'); } catch { setFullscreen(false); } }
  return <div className={`app ${fullscreen ? 'presentation' : ''}`}>
    <header className="site-header"><a className="teacher-brand" href={location.protocol === 'file:' ? 'https://dangdanglaoshi.cn/' : '../'} aria-label="回到当当老师的小屋"><div className="brand-icon"><Droplets size={23} /></div><div><strong>3D 容积实验室</strong><span>当当老师小课堂</span></div></a>
      <nav className="mode-tabs" aria-label="实验模式">{MODES.map(m => <button key={m.id} aria-pressed={state.mode === m.id} onClick={() => dispatch({ type: 'mode', mode: m.id })} className={state.mode === m.id ? 'active' : ''}><m.icon size={17} /><span>{m.title}</span></button>)}</nav>
      <div className="header-tools"><button onClick={() => dispatch({ type: 'reset' })} title="重置当前实验"><RotateCcw size={16} /><span>重置本实验</span></button><button onClick={toggleFullscreen} aria-label={fullscreen ? '退出全屏授课' : '全屏授课'}><Maximize size={16} /><span>{fullscreen ? '退出全屏' : '全屏授课'}</span></button></div>
    </header>
    <main className="main-content"><div className="intro"><div><span className="eyebrow">把单位，放进真实的空间里</span><h1>一毫升水，<span>占多大地方？</span></h1></div><p>转一转、装一装、倒一倒。<br />用实验看懂容积与体积。</p></div>
      <div className="workspace" id="experiment"><section className="scene-panel" aria-label="三维实验区域"><div className="scene-heading"><div><active.icon size={17} /><h2>{active.title}</h2><span>{active.subtitle}</span></div><button className="scene-reset" onClick={() => dispatch({ type: 'focus', focus: 'front' })}><RotateCcw size={14} />恢复正面视角</button></div>
        <div className={`scene-viewport ${state.mode === 'pour' ? 'pour-view' : ''}`} data-testid="scene" data-mode={state.mode} data-main-water-height={heightCmForState(state)} data-cube-count={state.cubes.count} data-visible-cubes={state.cubes.slicing ? Math.min(state.cubes.count, state.cubes.slice * 100) : state.cubes.count} role="img" aria-label={`${active.title}。${state.mode === 'cubes' ? `已装入 ${state.cubes.count} 个小正方体。` : `水箱实际装入 ${formatQuantity(actual)} 毫升，水深 ${formatHeight(actual)} 厘米。`}拖动可以旋转和缩放。`}>
          <LabScene state={state} />
          <div className="model-tag">{state.mode === 'pour' ? '量杯容量 1000 mL · 水箱容积 1000 cm³' : state.focus === 'one' ? '对照模型：边长 1 cm 的小水盒 / 方块' : '内部尺寸 10 cm × 10 cm × 10 cm'}</div>
          {state.mode === 'water' && state.water.volume > 0n && state.water.volume <= ml(10) && <WaterMagnifier volume={state.water.volume} />}
          {state.mode === 'cubes' && state.cubes.slicing && <div className="slicing-badge"><Layers3 size={14} />剖层观察 · 只显示底部 {state.cubes.slice} 层</div>}
          <div className="scene-interaction-hint">单指 / 鼠标拖动旋转 · 滚轮 / 双指缩放 · 双指平移</div>
        </div>
        <div className="equivalence-bar"><span className="equal-mark">=</span><strong data-testid="scene-expression">{expression}</strong><span className="live-tag"><i />实际比例</span></div>
      </section>
      <aside className="controls-side" aria-label="实验控制与单位换算"><motion.section className="control-card" key={state.mode} initial={{ opacity: 0, y: reduced ? 0 : 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }}><ModeControls state={state} dispatch={dispatch} reduced={reduced} /><AnimationBar state={state} dispatch={dispatch} />
        <AnimatePresence>{completed && !animation && <motion.div className="completion" initial={{ opacity: 0, scale: reduced ? 1 : .97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} role="status"><Check size={19} /><div><b>1000 cm³ = 1 dm³</b><span>1000 mL = 1 L</span>{state.mode === 'pour' && <small>量杯中的 1 L 水，占满了水箱里的 1 dm³ 空间。</small>}</div></motion.div>}</AnimatePresence>
      </motion.section>
      <section className="conversion-panel" aria-labelledby="conversion-title"><div className="conversion-heading"><h2 id="conversion-title">同一个量，四种写法</h2><span>任意一格都能改</span></div><div className="unit-cards">{UNITS.map(u => <QuantityField key={u.id} id={`unit-${u.id}`} className={`unit-card unit-${u.id}`} value={q} unit={u.id} label={`${u.name} ${u.symbol}`} onCommit={v => dispatch({ type: 'quantity', value: v })} onFocus={() => dispatch({ type: 'pause', paused: true })} />)}</div>
      {warning ? <p className="conversion-warning" role="status"><Info size={15} /><span>{warning}<br />模型实际装入：{formatQuantity(actual)} {state.mode === 'cubes' ? 'cm³' : 'mL'}。</span></p> : <p className="conversion-note">{state.mode === 'pour' ? '修改水箱中的水量时，量杯自动保留剩余的水，总量仍为 1000 mL。' : state.mode === 'cubes' ? '改成整数体积，就能同步看到对应数量的小正方体。' : '1 mL 与 1 cm³ 数字相同；1 L 与 1 dm³ 数字相同。'}</p>}
      </section></aside></div>
      <section className="knowledge-section" aria-labelledby="knowledge-title"><div className="section-title"><div><span className="eyebrow">点一下，让模型解释</span><h2 id="knowledge-title">三个联系，一起看懂</h2></div><span>点击后自动聚焦</span></div><div className="knowledge-grid">{KNOWLEDGE.map((k, i) => <button key={k.title} className={`knowledge-card ${state.knowledge === i ? 'active' : ''}`} onClick={() => { dispatch({ type: 'knowledge', id: i }); document.getElementById('experiment')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }} aria-pressed={state.knowledge === i}><span className="knowledge-icon"><k.icon size={22} /></span><div><strong>{k.title}</strong><span>{k.text}</span></div><ChevronRight size={17} /></button>)}</div></section>
      <div className="bottom-grid"><section className="experiment-guide"><span className="eyebrow">当当老师小提示</span><h2>{state.mode === 'water' ? '先猜高度，再注水验证。' : state.mode === 'cubes' ? '把每一层都数清楚。' : '盯住两边的水量。'}</h2><ol>{(state.mode === 'water' ? ['先选择或输入一个水量。', '看水位，想一想底面积有多大。', '对照四个单位，找出相同的体积。'] : state.mode === 'cubes' ? ['先看 1 个边长 1 cm 的小方块。', '装满一层，数出 10 × 10 = 100 个。', '装满 10 层，看见 1000 个组成 1 dm³。'] : ['先选这次要倒入的水量。', '观察量杯减少和水箱增加的量。', '把两边相加，检验水量有没有变化。']).map((text, i) => <li key={text}><span>{i + 1}</span>{text}</li>)}</ol><details><summary><Info size={15} />为什么容量和体积能联系起来？</summary><p>水装进容器，会占据一定的空间。边长 1 cm 的小水盒，内部体积是 1 cm³，正好装 1 mL 水。边长 1 dm 的水箱，内部体积是 1 dm³，正好装 1 L 水。</p><p>本实验始终按容器的<strong>内部尺寸</strong>计算。</p></details><a className="home-link" href={location.protocol === 'file:' ? 'https://dangdanglaoshi.cn/' : '../'}><House size={14} />回到当当老师的小屋</a></section><Challenge dispatch={dispatch} reduced={reduced} /></div>
    </main><footer className="site-footer"><span>当当老师小课堂</span><span>1 mL = 1 cm³ · 1 L = 1 dm³</span><span>用实验，理解每一个单位。</span></footer>
  </div>;
}
function heightCmForState(state: LabState) { return state.mode === 'water' ? inMl(state.water.volume) / 100 : state.mode === 'pour' ? inMl(state.pour.tank) / 100 : undefined; }
