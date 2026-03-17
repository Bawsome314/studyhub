import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Wrench, X, StickyNote, Calculator, Pencil, Delete, RotateCcw, TrendingUp, BarChart3, BookOpen, Plus, Trash2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useCurrentCourseTools } from '../hooks/useCurrentCourseTools';

const BASE_TABS = [
  { id: 'notes', icon: StickyNote, label: 'Notes' },
  { id: 'calc', icon: Calculator, label: 'Calc' },
  { id: 'draw', icon: Pencil, label: 'Draw' },
];

const EXTRA_TAB_MAP = {
  finance: { id: 'tvm', icon: TrendingUp, label: 'TVM' },
  graph: { id: 'graph', icon: BarChart3, label: 'Graph' },
  accounting: { id: 'taccount', icon: BookOpen, label: 'T-Acct' },
};

const PEN_SIZES = [2, 4, 8];
const PEN_COLORS = ['#ffffff', '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7'];

export default function FloatingToolbar() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('notes');
  const [notes, setNotes] = useLocalStorage('studyhub-scratchpad', '');
  const { courseTools, courseId } = useCurrentCourseTools();

  // Build tabs array dynamically
  const tabs = useMemo(() => {
    const extra = courseTools
      .map(t => EXTRA_TAB_MAP[t])
      .filter(Boolean);
    return [...BASE_TABS, ...extra];
  }, [courseTools]);

  // If active tab is no longer available, switch to Notes
  useEffect(() => {
    if (!tabs.find(t => t.id === tab)) {
      setTab('notes');
    }
  }, [tabs, tab]);

  // Determine panel width - wider for graph tab
  const panelWidth = tab === 'graph' ? 560 : 340;

  // Drag state
  const [pos, setPos] = useState({ x: null, y: null });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef(null);

  function startDrag(e) {
    if (e.target.closest('button, textarea, canvas, input, iframe, select')) return;
    dragging.current = true;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  }

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 360, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y)),
      });
    }
    function onUp() { dragging.current = false; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const panelStyle = pos.x !== null
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto', width: panelWidth }
    : { width: panelWidth };

  return (
    <>
      {/* FAB button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 lg:bottom-6 right-4 z-50 w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/25 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 glow-pulse"
        >
          <Wrench className="w-5 h-5" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          onMouseDown={startDrag}
          style={panelStyle}
          className={`fixed z-50 glass border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-[width] duration-200 ${
            pos.x === null ? 'bottom-24 lg:bottom-6 right-4' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-tertiary cursor-move select-none">
            <div className="flex gap-1 overflow-x-auto scrollbar-none">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    tab === t.id ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={() => { setOpen(false); setPos({ x: null, y: null }); }} className="p-1 text-text-muted hover:text-text-primary transition-colors ml-2 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className={tab === 'graph' ? 'h-[400px]' : 'h-[280px]'}>
            {tab === 'notes' && <NotesTab notes={notes} setNotes={setNotes} />}
            {tab === 'calc' && <CalcTab />}
            {tab === 'draw' && <DrawTab />}
            {tab === 'tvm' && <TVMCalcTab />}
            {tab === 'graph' && <DesmosGraphTab />}
            {tab === 'taccount' && <TAccountTab courseId={courseId} />}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Notes Tab ── */
function NotesTab({ notes, setNotes }) {
  return (
    <div className="h-full flex flex-col">
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Quick notes, reminders, thoughts..."
        className="flex-1 w-full bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none"
      />
      <div className="px-3 py-1.5 text-[10px] text-text-muted border-t border-border">
        Auto-saved &middot; {notes.length} chars
      </div>
    </div>
  );
}

/* ── Calculator Tab ── */
function CalcTab() {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);

  function input(val) {
    if (fresh) { setDisplay(val); setFresh(false); }
    else setDisplay(prev => prev === '0' ? val : prev + val);
  }

  function decimal() {
    if (fresh) { setDisplay('0.'); setFresh(false); return; }
    if (!display.includes('.')) setDisplay(prev => prev + '.');
  }

  function operate(nextOp) {
    if (prev !== null && op && !fresh) {
      const result = calc(prev, parseFloat(display), op);
      setDisplay(String(result));
      setPrev(result);
    } else {
      setPrev(parseFloat(display));
    }
    setOp(nextOp);
    setFresh(true);
  }

  function equals() {
    if (prev === null || !op) return;
    const result = calc(prev, parseFloat(display), op);
    setDisplay(String(result));
    setPrev(null);
    setOp(null);
    setFresh(true);
  }

  function clear() { setDisplay('0'); setPrev(null); setOp(null); setFresh(true); }

  function calc(a, b, operator) {
    switch (operator) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : 0;
      default: return b;
    }
  }

  const btn = (label, onClick, cls = '') => (
    <button onClick={onClick} className={`rounded-lg text-sm font-medium py-2.5 transition-colors ${cls}`}>
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col p-3 gap-2">
      <div className="bg-bg-tertiary rounded-lg px-3 py-2 text-right">
        {prev !== null && op && <div className="text-[10px] text-text-muted font-num">{prev} {op}</div>}
        <div className="text-xl font-bold font-num text-text-primary truncate">{display}</div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 flex-1">
        {btn('C', clear, 'bg-danger/15 text-danger hover:bg-danger/25')}
        {btn('+/-', () => setDisplay(d => String(-parseFloat(d))), 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover')}
        {btn('%', () => setDisplay(d => String(parseFloat(d) / 100)), 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover')}
        {btn('/', () => operate('/'), 'bg-accent/15 text-accent hover:bg-accent/25')}

        {btn('7', () => input('7'), 'bg-bg-tertiary text-text-primary hover:bg-bg-hover')}
        {btn('8', () => input('8'), 'bg-bg-tertiary text-text-primary hover:bg-bg-hover')}
        {btn('9', () => input('9'), 'bg-bg-tertiary text-text-primary hover:bg-bg-hover')}
        {btn('*', () => operate('*'), 'bg-accent/15 text-accent hover:bg-accent/25')}

        {btn('4', () => input('4'), 'bg-bg-tertiary text-text-primary hover:bg-bg-hover')}
        {btn('5', () => input('5'), 'bg-bg-tertiary text-text-primary hover:bg-bg-hover')}
        {btn('6', () => input('6'), 'bg-bg-tertiary text-text-primary hover:bg-bg-hover')}
        {btn('-', () => operate('-'), 'bg-accent/15 text-accent hover:bg-accent/25')}

        {btn('1', () => input('1'), 'bg-bg-tertiary text-text-primary hover:bg-bg-hover')}
        {btn('2', () => input('2'), 'bg-bg-tertiary text-text-primary hover:bg-bg-hover')}
        {btn('3', () => input('3'), 'bg-bg-tertiary text-text-primary hover:bg-bg-hover')}
        {btn('+', () => operate('+'), 'bg-accent/15 text-accent hover:bg-accent/25')}

        <button onClick={() => input('0')} className="col-span-2 rounded-lg text-sm font-medium py-2.5 bg-bg-tertiary text-text-primary hover:bg-bg-hover transition-colors">0</button>
        {btn('.', decimal, 'bg-bg-tertiary text-text-primary hover:bg-bg-hover')}
        {btn('=', equals, 'bg-accent text-white hover:bg-accent-hover')}
      </div>
    </div>
  );
}

/* ── Draw Tab ── */
function DrawTab() {
  const canvasRef = useRef(null);
  const [penSize, setPenSize] = useState(4);
  const [penColor, setPenColor] = useState('#ffffff');
  const [erasing, setErasing] = useState(false);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  }, []);

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(e) {
    e.stopPropagation();
    drawing.current = true;
    lastPos.current = getPos(e);
  }

  function draw(e) {
    if (!drawing.current) return;
    e.stopPropagation();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = erasing ? '#1a1a1a' : penColor;
    ctx.lineWidth = erasing ? penSize * 3 : penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }

  function stopDraw() { drawing.current = false; lastPos.current = null; }

  function clearCanvas() {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  }

  return (
    <div className="h-full flex flex-col">
      <canvas
        ref={canvasRef}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
        className="flex-1 w-full cursor-crosshair touch-none"
      />
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        {/* Colors */}
        <div className="flex gap-1">
          {PEN_COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setPenColor(c); setErasing(false); }}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                !erasing && penColor === c ? 'border-accent scale-125' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="w-px h-4 bg-border" />
        {/* Sizes */}
        <div className="flex gap-1">
          {PEN_SIZES.map(s => (
            <button
              key={s}
              onClick={() => { setPenSize(s); setErasing(false); }}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                !erasing && penSize === s ? 'bg-accent/20' : 'hover:bg-bg-hover'
              }`}
            >
              <div className="rounded-full bg-text-primary" style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-border" />
        <button
          onClick={() => setErasing(!erasing)}
          className={`p-1 rounded transition-colors ${erasing ? 'bg-danger/20 text-danger' : 'text-text-muted hover:text-text-primary'}`}
        >
          <Delete className="w-4 h-4" />
        </button>
        <button onClick={clearCanvas} className="p-1 text-text-muted hover:text-text-primary transition-colors ml-auto">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ── TVM Calculator Tab ── */
function TVMCalcTab() {
  const [fields, setFields] = useState({ n: '', iy: '', pv: '', pmt: '', fv: '' });
  const [solved, setSolved] = useState(null); // which field was solved
  const [mode, setMode] = useState('tvm'); // 'tvm' | 'npv' | 'irr'
  const [npvRate, setNpvRate] = useState('');
  const [cashFlows, setCashFlows] = useState('');
  const [npvResult, setNpvResult] = useState(null);
  const [irrResult, setIrrResult] = useState(null);

  function updateField(key, val) {
    setFields(f => ({ ...f, [key]: val }));
    setSolved(null);
  }

  function solveFor(target) {
    const n = target !== 'n' ? parseFloat(fields.n) : NaN;
    const iy = target !== 'iy' ? parseFloat(fields.iy) : NaN;
    const pv = target !== 'pv' ? parseFloat(fields.pv) : NaN;
    const pmt = target !== 'pmt' ? parseFloat(fields.pmt) : NaN;
    const fv = target !== 'fv' ? parseFloat(fields.fv) : NaN;

    // Check we have exactly 4 valid inputs
    const vals = { n, iy, pv, pmt, fv };
    delete vals[target];
    if (Object.values(vals).some(v => isNaN(v))) return;

    const r = iy / 100;
    let result;

    try {
      if (target === 'fv') {
        if (r === 0) {
          result = -(pv + pmt * n);
        } else {
          result = -(pv * Math.pow(1 + r, n) + pmt * (Math.pow(1 + r, n) - 1) / r);
        }
      } else if (target === 'pv') {
        if (r === 0) {
          result = -(fv + pmt * n);
        } else {
          result = -(fv / Math.pow(1 + r, n) + pmt * (1 - Math.pow(1 + r, -n)) / r);
        }
      } else if (target === 'pmt') {
        if (r === 0) {
          result = -(pv + fv) / n;
        } else {
          result = -(pv * Math.pow(1 + r, n) + fv) * r / (Math.pow(1 + r, n) - 1);
        }
      } else if (target === 'n') {
        if (r === 0) {
          result = -(pv + fv) / pmt;
        } else {
          // FV + PV(1+r)^n + PMT*((1+r)^n - 1)/r = 0
          // Solve: (1+r)^n * (PV + PMT/r) = -FV + PMT/r
          const a = pv + pmt / r;
          const b = -fv + pmt / r;
          if (a === 0 || b / a <= 0) return;
          result = Math.log(b / a) / Math.log(1 + r);
        }
      } else if (target === 'iy') {
        // Newton's method for interest rate
        let guess = 0.1;
        for (let i = 0; i < 200; i++) {
          const g = guess;
          let f, fp;
          if (Math.abs(g) < 1e-12) {
            f = pv + fv + pmt * n;
            fp = pv * n + pmt * n * (n - 1) / 2; // derivative approximation
          } else {
            const gn = Math.pow(1 + g, n);
            f = pv * gn + pmt * (gn - 1) / g + fv;
            fp = pv * n * Math.pow(1 + g, n - 1) +
              pmt * (n * Math.pow(1 + g, n - 1) * g - (gn - 1)) / (g * g);
          }
          if (Math.abs(fp) < 1e-20) break;
          const next = g - f / fp;
          if (Math.abs(next - g) < 1e-10) { guess = next; break; }
          guess = next;
        }
        result = guess * 100;
      }

      if (result !== undefined && isFinite(result)) {
        setFields(f => ({ ...f, [target]: result.toFixed(target === 'n' ? 2 : target === 'iy' ? 4 : 2) }));
        setSolved(target);
      }
    } catch {
      // calculation error
    }
  }

  function calcNPV() {
    const rate = parseFloat(npvRate) / 100;
    if (isNaN(rate)) return;
    const cfs = cashFlows.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (cfs.length === 0) return;
    let npv = 0;
    for (let t = 0; t < cfs.length; t++) {
      npv += cfs[t] / Math.pow(1 + rate, t);
    }
    setNpvResult(npv.toFixed(2));
  }

  function calcIRR() {
    const cfs = cashFlows.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (cfs.length < 2) return;
    // Newton's method
    let guess = 0.1;
    for (let i = 0; i < 300; i++) {
      let npv = 0, dnpv = 0;
      for (let t = 0; t < cfs.length; t++) {
        npv += cfs[t] / Math.pow(1 + guess, t);
        dnpv -= t * cfs[t] / Math.pow(1 + guess, t + 1);
      }
      if (Math.abs(dnpv) < 1e-20) break;
      const next = guess - npv / dnpv;
      if (Math.abs(next - guess) < 1e-10) { guess = next; break; }
      guess = next;
    }
    setIrrResult((guess * 100).toFixed(4));
  }

  const fieldLabel = { n: 'N', iy: 'I/Y %', pv: 'PV', pmt: 'PMT', fv: 'FV' };

  if (mode === 'npv' || mode === 'irr') {
    return (
      <div className="h-full flex flex-col p-3 gap-2 overflow-y-auto">
        <div className="flex gap-1 mb-1">
          <button onClick={() => setMode('tvm')} className="px-2 py-1 rounded text-[10px] font-medium text-text-secondary hover:bg-bg-hover">TVM</button>
          <button onClick={() => setMode('npv')} className={`px-2 py-1 rounded text-[10px] font-medium ${mode === 'npv' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>NPV</button>
          <button onClick={() => setMode('irr')} className={`px-2 py-1 rounded text-[10px] font-medium ${mode === 'irr' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>IRR</button>
        </div>

        {mode === 'npv' && (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-text-muted block mb-0.5">Discount Rate (%)</label>
              <input type="number" value={npvRate} onChange={e => { setNpvRate(e.target.value); setNpvResult(null); }}
                className="w-full bg-bg-tertiary border border-border rounded-lg px-2 py-1.5 text-sm font-num text-text-primary focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-0.5">Cash Flows (comma-separated, CF0 first)</label>
              <input type="text" value={cashFlows} onChange={e => { setCashFlows(e.target.value); setNpvResult(null); }}
                placeholder="-1000, 300, 400, 500"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-2 py-1.5 text-sm font-num text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            </div>
            <button onClick={calcNPV} className="w-full py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors">Calculate NPV</button>
            {npvResult !== null && (
              <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 text-center">
                <span className="text-[10px] text-text-muted">NPV = </span>
                <span className="text-sm font-bold font-num text-accent">{npvResult}</span>
              </div>
            )}
          </div>
        )}

        {mode === 'irr' && (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-text-muted block mb-0.5">Cash Flows (comma-separated, CF0 first)</label>
              <input type="text" value={cashFlows} onChange={e => { setCashFlows(e.target.value); setIrrResult(null); }}
                placeholder="-1000, 300, 400, 500"
                className="w-full bg-bg-tertiary border border-border rounded-lg px-2 py-1.5 text-sm font-num text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
            </div>
            <button onClick={calcIRR} className="w-full py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors">Calculate IRR</button>
            {irrResult !== null && (
              <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2 text-center">
                <span className="text-[10px] text-text-muted">IRR = </span>
                <span className="text-sm font-bold font-num text-accent">{irrResult}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-3 gap-2 overflow-y-auto">
      <div className="flex gap-1 mb-1">
        <button onClick={() => setMode('tvm')} className={`px-2 py-1 rounded text-[10px] font-medium ${mode === 'tvm' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover'}`}>TVM</button>
        <button onClick={() => setMode('npv')} className="px-2 py-1 rounded text-[10px] font-medium text-text-secondary hover:bg-bg-hover">NPV</button>
        <button onClick={() => setMode('irr')} className="px-2 py-1 rounded text-[10px] font-medium text-text-secondary hover:bg-bg-hover">IRR</button>
      </div>

      {Object.keys(fieldLabel).map(key => (
        <div key={key} className="flex items-center gap-2">
          <label className="text-[10px] text-text-muted w-8 shrink-0 text-right">{fieldLabel[key]}</label>
          <input
            type="number"
            value={fields[key]}
            onChange={e => updateField(key, e.target.value)}
            className={`flex-1 bg-bg-tertiary border rounded-lg px-2 py-1 text-sm font-num text-text-primary focus:outline-none focus:border-accent ${
              solved === key ? 'border-accent bg-accent/10' : 'border-border'
            }`}
          />
          <button
            onClick={() => solveFor(key)}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors shrink-0"
          >
            Solve
          </button>
        </div>
      ))}

      <p className="text-[9px] text-text-muted mt-1">Fill 4 fields, click Solve on the 5th. Use cash flow sign convention (negative = outflow).</p>
    </div>
  );
}

/* ── Desmos Graph Tab ── */
function DesmosGraphTab() {
  return (
    <div className="h-full flex flex-col">
      <iframe
        src="https://www.desmos.com/calculator"
        title="Desmos Graphing Calculator"
        className="flex-1 w-full border-none"
        allow="clipboard-write"
      />
      <div className="px-3 py-1 text-[9px] text-text-muted border-t border-border">
        Powered by Desmos
      </div>
    </div>
  );
}

/* ── T-Account Tab ── */
function TAccountTab({ courseId }) {
  const storageKey = `studyhub-t-accounts-${courseId || 'global'}`;
  const [accounts, setAccounts] = useLocalStorage(storageKey, []);

  function addAccount() {
    setAccounts(prev => [
      { id: Date.now().toString(), name: '', debits: [''], credits: [''] },
      ...prev,
    ]);
  }

  function updateAccount(id, updates) {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }

  function deleteAccount(id) {
    setAccounts(prev => prev.filter(a => a.id !== id));
  }

  function addRow(id, side) {
    setAccounts(prev => prev.map(a => {
      if (a.id !== id) return a;
      return { ...a, [side]: [...a[side], ''] };
    }));
  }

  function updateRow(id, side, index, value) {
    setAccounts(prev => prev.map(a => {
      if (a.id !== id) return a;
      const arr = [...a[side]];
      arr[index] = value;
      return { ...a, [side]: arr };
    }));
  }

  function sumSide(arr) {
    return arr.reduce((s, v) => s + (parseFloat(v) || 0), 0);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
        <span className="text-[10px] text-text-muted font-medium">T-Accounts</span>
        <button onClick={addAccount} className="flex items-center gap-1 text-[10px] text-accent hover:text-accent-hover transition-colors">
          <Plus className="w-3 h-3" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {accounts.length === 0 && (
          <p className="text-[11px] text-text-muted text-center py-6">Click "New" to create a T-Account</p>
        )}
        {accounts.map(acct => (
          <div key={acct.id} className="border border-border rounded-lg overflow-hidden">
            {/* Account name */}
            <div className="flex items-center gap-1 px-2 py-1 bg-bg-tertiary border-b border-border">
              <input
                type="text"
                value={acct.name}
                onChange={e => updateAccount(acct.id, { name: e.target.value })}
                placeholder="Account Name"
                className="flex-1 bg-transparent text-xs font-medium text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <button onClick={() => deleteAccount(acct.id)} className="p-0.5 text-text-muted hover:text-danger transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Debit / Credit columns */}
            <div className="grid grid-cols-2 divide-x divide-border">
              {/* Debit side */}
              <div className="p-1.5">
                <div className="text-[9px] font-semibold text-text-muted text-center mb-1">Debit</div>
                {acct.debits.map((val, i) => (
                  <input
                    key={i}
                    type="number"
                    value={val}
                    onChange={e => updateRow(acct.id, 'debits', i, e.target.value)}
                    className="w-full bg-transparent text-xs font-num text-text-primary text-right px-1 py-0.5 focus:outline-none focus:bg-bg-hover rounded"
                    placeholder="0.00"
                  />
                ))}
                <button onClick={() => addRow(acct.id, 'debits')} className="w-full text-[9px] text-accent hover:text-accent-hover py-0.5 transition-colors">+ row</button>
                <div className="border-t border-border mt-1 pt-1 text-right text-xs font-bold font-num text-text-primary px-1">
                  {sumSide(acct.debits).toFixed(2)}
                </div>
              </div>

              {/* Credit side */}
              <div className="p-1.5">
                <div className="text-[9px] font-semibold text-text-muted text-center mb-1">Credit</div>
                {acct.credits.map((val, i) => (
                  <input
                    key={i}
                    type="number"
                    value={val}
                    onChange={e => updateRow(acct.id, 'credits', i, e.target.value)}
                    className="w-full bg-transparent text-xs font-num text-text-primary text-right px-1 py-0.5 focus:outline-none focus:bg-bg-hover rounded"
                    placeholder="0.00"
                  />
                ))}
                <button onClick={() => addRow(acct.id, 'credits')} className="w-full text-[9px] text-accent hover:text-accent-hover py-0.5 transition-colors">+ row</button>
                <div className="border-t border-border mt-1 pt-1 text-right text-xs font-bold font-num text-text-primary px-1">
                  {sumSide(acct.credits).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
