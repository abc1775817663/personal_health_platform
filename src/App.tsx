import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, Globe, ChevronDown, ChevronLeft, ChevronRight, Download, Dumbbell, FileText, Heart, LayoutDashboard, Leaf, Plus, Scale, Search, Settings2, ShieldCheck, Sprout, Trash2, TrendingUp, Upload, Utensils, X, Pencil } from 'lucide-react';
import { createId, latestDailyWeights, loadJournal, parseJournal, sampleJournal, saveJournal, shiftDate, todayKey, weightForDisplay, weightFromDisplay, type HealthEntry, type Intensity, type Journal, type MealType, type WeightUnit } from './data';
import { I18nProvider, useI18n, type I18n, type Locale } from './i18n';
import './styles.css';

type Tab = 'today' | 'history' | 'trends';
type EntryKind = HealthEntry['kind'];
type EntryModal = { kind: EntryKind; entry?: HealthEntry };
const kindIcons = { weight: Scale, meal: Utensils, exercise: Dumbbell, note: FileText };
const mealTypes: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const intensities: Intensity[] = ['Easy', 'Moderate', 'Hard'];

function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = document.querySelector<HTMLElement>('.app-shell');
    if (root) root.inert = true;
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]') ?? []).filter(el => el.offsetParent !== null);
    const field = dialog.current?.querySelector<HTMLElement>('[data-autofocus]');
    (field ?? focusable()[0] ?? dialog.current)?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0]; const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; if (root) root.inert = false; document.removeEventListener('keydown', handleKey); previouslyFocused?.focus(); };
  }, []);
  return <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}>
      <div className="modal-header"><div><p className="eyebrow">{t("A MOMENT FOR YOU")}</p><h2 id="modal-title">{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label={t("Close dialog")}><X size={20} /></button></div>
      {children}
    </div>
  </div>;
}

function EntryForm({ model, unit, date, onClose, onSave }: { model: EntryModal; unit: WeightUnit; date: string; onClose: () => void; onSave: (entry: HealthEntry) => void }) {
  const { t, number, kindNames, mealName, intensityName } = useI18n();
  const entry = model.entry;
  const [kind, setKind] = useState<EntryKind>(model.kind);
  const [entryDate, setEntryDate] = useState(entry?.date ?? date);
  const [weight, setWeight] = useState(entry?.kind === 'weight' ? String(Number(weightForDisplay(entry.weight, unit).toFixed(2))) : '');
  const [mealType, setMealType] = useState<MealType>(entry?.kind === 'meal' ? entry.mealType : 'Breakfast');
  const [title, setTitle] = useState(entry?.kind === 'meal' ? entry.title : '');
  const [calories, setCalories] = useState(entry?.kind === 'meal' && entry.calories !== undefined ? String(entry.calories) : '');
  const [activity, setActivity] = useState(entry?.kind === 'exercise' ? entry.activity : '');
  const [minutes, setMinutes] = useState(entry?.kind === 'exercise' ? String(entry.minutes) : '');
  const [intensity, setIntensity] = useState<Intensity>(entry?.kind === 'exercise' ? entry.intensity : 'Moderate');
  const [note, setNote] = useState(entry?.kind === 'note' ? entry.text : '');
  const [error, setError] = useState('');
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    const base = { id: entry?.id ?? createId(), date: entryDate, createdAt: entry?.createdAt ?? new Date().toISOString() };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) { setError('Choose a valid date.'); return; }
    let next: HealthEntry;
    if (kind === 'weight') {
      const originalDisplay = entry?.kind === 'weight' ? Number(weightForDisplay(entry.weight, unit).toFixed(2)) : null;
      const kg = entry?.kind === 'weight' && Number(weight) === originalDisplay ? entry.weight : weightFromDisplay(Number(weight), unit);
      if (!weight.trim() || !Number.isFinite(kg) || kg < 1 || kg > 700) { setError(t('Enter a weight between {min} and {max} {unit}.', { min: number(weightForDisplay(1, unit), 2), max: number(weightForDisplay(700, unit), 2), unit })); return; }
      next = { ...base, kind, weight: kg };
    } else if (kind === 'meal') {
      if (!title.trim()) { setError('Add a short description of your meal.'); return; }
      if (calories.trim() && (!Number.isFinite(Number(calories)) || Number(calories) < 0 || Number(calories) > 20000)) { setError('Calories must be between 0 and 20,000.'); return; }
      next = { ...base, kind, mealType, title: title.trim(), ...(calories.trim() ? { calories: Number(calories) } : {}) };
    } else if (kind === 'exercise') {
      if (!activity.trim()) { setError('Add the name of your activity.'); return; }
      if (!Number.isFinite(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 1440) { setError('Duration must be between 1 and 1,440 minutes.'); return; }
      next = { ...base, kind, activity: activity.trim(), minutes: Number(minutes), intensity };
    } else {
      if (!note.trim()) { setError('Write a little something before saving.'); return; }
      next = { ...base, kind, text: note.trim() };
    }
    onSave(next);
  };
  return <Modal title={entry ? t('Edit {kind}', { kind: kindNames[kind].toLowerCase() }) : t("Add to your day")} subtitle={t("Small moments make a meaningful picture.")} onClose={onClose}>
    {!entry && <div className="entry-type-picker" aria-label={t("Entry type")}>{(Object.keys(kindNames) as EntryKind[]).map(type => { const Icon = kindIcons[type]; return <button key={type} className={kind === type ? 'selected' : ''} onClick={() => { setKind(type); setError(''); }} aria-pressed={kind === type}><Icon size={18} />{kindNames[type]}</button>; })}</div>}
    <form onSubmit={submit} className="entry-form" noValidate>
      <label>{t("Date")}<input data-autofocus type="date" value={entryDate} onChange={event => setEntryDate(event.target.value)} required /></label>
      {kind === 'weight' && <><label>{t('Weight ({unit})', { unit })}<div className="input-with-unit"><input type="number" inputMode="decimal" step="any" min={weightForDisplay(1, unit)} max={weightForDisplay(700, unit)} value={weight} onChange={event => setWeight(event.target.value)} placeholder={t(unit === 'kg' ? 'e.g. 68.5' : 'e.g. 151')} required /><span>{unit}</span></div></label><p className="field-hint">{t("Each weigh-in is kept in your journal. Trends use the latest entry for each day.")}</p></>}
      {kind === 'meal' && <><label>{t("Meal")}<select value={mealType} onChange={event => setMealType(event.target.value as MealType)}>{mealTypes.map(type => <option key={type} value={type}>{mealName(type)}</option>)}</select></label><label>{t("What did you eat?")}<input value={title} onChange={event => setTitle(event.target.value)} placeholder={t("e.g. Oatmeal with berries")} maxLength={200} required /></label><label>{t("Calories")} <span className="optional">{t("optional")}</span><div className="input-with-unit"><input type="number" inputMode="numeric" min="0" max="20000" step="any" value={calories} onChange={event => setCalories(event.target.value)} placeholder={t("e.g. 350")} /><span>{t("kcal")}</span></div></label><p className="field-hint">{t("A simple meal description is enough. Add calories if they’re useful to you.")}</p></>}
      {kind === 'exercise' && <><label>{t("Activity")}<input value={activity} onChange={event => setActivity(event.target.value)} placeholder={t("e.g. Morning walk")} maxLength={120} required /></label><div className="form-two-columns"><label>{t("Duration")}<div className="input-with-unit"><input type="number" inputMode="numeric" min="1" max="1440" step="any" value={minutes} onChange={event => setMinutes(event.target.value)} placeholder="30" required /><span>{t("min")}</span></div></label><label>{t("Intensity")}<select value={intensity} onChange={event => setIntensity(event.target.value as Intensity)}>{intensities.map(item => <option key={item} value={item}>{intensityName(item)}</option>)}</select></label></div></>}
      {kind === 'note' && <><label>{t("How are you feeling?")}<textarea rows={5} value={note} onChange={event => setNote(event.target.value)} placeholder={t("Energy, mood, sleep, or anything on your mind…")} maxLength={3000} required /></label><p className="field-hint">{t("Your journal is a space for the whole picture.")}</p></>}
      {error && <p className="form-error" role="alert">{t(error)}</p>}
      <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>{t("Cancel")}</button><button type="submit" className="button primary"><Check size={17} />{entry ? t("Update entry") : t("Save entry")}</button></div>
    </form>
  </Modal>;
}

function WeightChart({ entries, unit, end, days, compact = false }: { entries: HealthEntry[]; unit: WeightUnit; end: string; days: number; compact?: boolean }) {
  const { t, number, dateLabel } = useI18n();
  const start = shiftDate(end, -(days - 1));
  const weights = latestDailyWeights(entries).filter(entry => entry.date >= start && entry.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const chartContainer = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(620);
  const hasWeights = weights.length > 0;
  useEffect(() => {
    const container = chartContainer.current;
    if (!container) return;
    const observer = new ResizeObserver(([measurement]) => { if (measurement.contentRect.width >= 180) setChartWidth(measurement.contentRect.width); });
    observer.observe(container);
    return () => observer.disconnect();
  }, [hasWeights]);
  if (!weights.length) return <div className="chart-empty"><div className="empty-chart-grid"><span /><span /><span /><span /></div><div className="chart-empty-content"><span className="empty-icon"><TrendingUp size={24} /></span><h3>{t("Your progress starts here")}</h3><p>{t("Add a weigh-in to begin your weight history.")}</p></div></div>;
  const values = weights.map(entry => weightForDisplay(entry.weight, unit));
  const min = Math.min(...values); const max = Math.max(...values); const pad = Math.max((max - min) * 0.35, unit === 'kg' ? 0.8 : 1.8);
  const low = Math.max(0, min - pad); const high = max + pad;
  const w = chartWidth; const h = compact ? 175 : 225; const left = 44; const right = 18; const top = 18; const bottom = h - 32;
  const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86400000;
  const startDay = dayNumber(start);
  const points = weights.map((entry, index) => ({ x: left + (dayNumber(entry.date) - startDay) / Math.max(1, days - 1) * (w - left - right), y: top + (high - values[index]) / (high - low) * (bottom - top), value: values[index], date: entry.date }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const labels = [start, shiftDate(start, Math.floor((days - 1) / 2)), end];
  return <div ref={chartContainer} className="weight-chart"><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t('Weight history: {values}', { values: weights.map(entry => `${dateLabel(entry.date)} ${number(weightForDisplay(entry.weight, unit), 1)} ${unit}`).join(', ') })}>
    {[0, 1, 2, 3].map(index => { const y = top + index / 3 * (bottom - top); return <g key={index}><line x1={left} y1={y} x2={w - right} y2={y} className="chart-grid-line" /><text x={left - 12} y={y + 4} textAnchor="end" className="chart-axis">{number(high - index / 3 * (high - low), 1)}</text></g>; })}
    {points.length > 1 && <><path d={`${path} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`} fill="url(#weight-fill)" /><path d={path} className="chart-line" /></>}
    <defs><linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#70946f" stopOpacity="0.22" /><stop offset="100%" stopColor="#70946f" stopOpacity="0.015" /></linearGradient></defs>
    {points.map(point => <g key={point.date}><circle cx={point.x} cy={point.y} r="4.5" className="chart-point" /><title>{dateLabel(point.date)}: {number(point.value, 1)} {unit}</title></g>)}
    {labels.map((label, index) => <text key={index} x={left + index / 2 * (w - left - right)} y={h - 5} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'} className="chart-axis">{dateLabel(label)}</text>)}
  </svg><p className="chart-footnote">{t(weights.length === 1 ? '{count} day recorded · Latest weigh-in per day · {unit}' : '{count} days recorded · Latest weigh-in per day · {unit}', { count: number(weights.length), unit })}</p></div>;
}

function EntryActions({ entry, onEdit, onDelete, demo }: { entry: HealthEntry; onEdit: (entry: HealthEntry) => void; onDelete: (entry: HealthEntry) => void; demo: boolean }) {
  const { t, kindNames } = useI18n();
  if (demo) return null;
  return <div className="entry-actions"><button className="icon-button small" onClick={() => onEdit(entry)} aria-label={t('Edit {kind} entry', { kind: kindNames[entry.kind].toLowerCase() })}><Pencil size={15} /></button><button className="icon-button small delete" onClick={() => onDelete(entry)} aria-label={t('Delete {kind} entry', { kind: kindNames[entry.kind].toLowerCase() })}><Trash2 size={15} /></button></div>;
}
function getEntryTitle(entry: HealthEntry, unit: WeightUnit, { number }: I18n) {
  if (entry.kind === 'weight') return `${number(weightForDisplay(entry.weight, unit), 1)} ${unit}`;
  if (entry.kind === 'meal') return entry.title;
  if (entry.kind === 'exercise') return entry.activity;
  return entry.text;
}
function getEntryDetail(entry: HealthEntry, { t, number, mealName, intensityName }: I18n) {
  if (entry.kind === 'weight') return t('Weigh-in');
  if (entry.kind === 'meal') return `${mealName(entry.mealType)}${entry.calories !== undefined ? ` · ${number(entry.calories)} ${t('kcal')}` : ''}`;
  if (entry.kind === 'exercise') return t('{value} min · {intensity} intensity', { value: number(entry.minutes), intensity: intensityName(entry.intensity) });
  return t('Daily reflection');
}

export default function App() {
  return <I18nProvider><HealthApp /></I18nProvider>;
}

function HealthApp() {
  const i18n = useI18n();
  const { t, number, prettyDate, dateLabel, kindNames, mealName, intensityName, errorText, locale, setLocale, preferenceError } = i18n;
  const entryTitle = (entry: HealthEntry, unit: WeightUnit) => getEntryTitle(entry, unit, i18n);
  const entryDetail = (entry: HealthEntry) => getEntryDetail(entry, i18n);
  const [loaded] = useState(loadJournal);
  const [journal, setJournal] = useState<Journal>(loaded.journal);
  const [storageError, setStorageError] = useState(loaded.error);
  const [tab, setTab] = useState<Tab>('today');
  const [date, setDate] = useState(todayKey());
  const [demo, setDemo] = useState(false);
  const [demoData, setDemoData] = useState(() => sampleJournal(todayKey()));
  const [modal, setModal] = useState<EntryModal | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<HealthEntry | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importData, setImportData] = useState<Journal | null>(null);
  const [importError, setImportError] = useState('');
  const [importName, setImportName] = useState('');
  const [range, setRange] = useState(30);
  const [filter, setFilter] = useState<EntryKind | 'all'>('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const localizedDemo = useMemo(() => ({ ...demoData, entries: i18n.localizeDemo(demoData.entries) }), [demoData, locale]);
  const active = demo ? localizedDemo : journal;
  const unit = active.weightUnit;
  const dayEntries = active.entries.filter(entry => entry.date === date).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const meals = dayEntries.filter(entry => entry.kind === 'meal');
  const exercises = dayEntries.filter(entry => entry.kind === 'exercise');
  const notes = dayEntries.filter(entry => entry.kind === 'note');
  const dailyWeights = dayEntries.filter(entry => entry.kind === 'weight');
  const latestWeight = latestDailyWeights(active.entries).filter(entry => entry.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const activityMinutes = exercises.reduce((total, entry) => total + entry.minutes, 0);
  const calories = meals.reduce((total, entry) => total + (entry.calories ?? 0), 0);
  const hasCalories = meals.some(entry => entry.calories !== undefined);
  const weekStart = shiftDate(date, -6);
  const weekEntries = active.entries.filter(entry => entry.date >= weekStart && entry.date <= date);
  const weekMinutes = weekEntries.reduce((total, entry) => total + (entry.kind === 'exercise' ? entry.minutes : 0), 0);
  const weekMeals = weekEntries.filter(entry => entry.kind === 'meal').length;
  const activeDays = new Set(weekEntries.map(entry => entry.date)).size;
  const chartWeights = latestDailyWeights(active.entries).filter(entry => entry.date >= shiftDate(date, -(range - 1)) && entry.date <= date).sort((a, b) => a.date.localeCompare(b.date));
  const weightChange = chartWeights.length > 1 ? weightForDisplay(chartWeights[chartWeights.length - 1].weight - chartWeights[0].weight, unit) : null;
  const history = useMemo(() => active.entries.filter(entry => (filter === 'all' || entry.kind === filter) && `${entryTitle(entry, unit)} ${entryDetail(entry)} ${entry.date}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date) || Date.parse(b.createdAt) - Date.parse(a.createdAt)), [active.entries, filter, search, unit, locale]);
  const historyDates = [...new Set(history.map(entry => entry.date))];
  const navItems: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [{ key: 'today', label: t("Today"), icon: LayoutDashboard }, { key: 'history', label: t('Journal'), icon: CalendarDays }, { key: 'trends', label: t('Trends'), icon: TrendingUp }];
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(''), 4500); return () => window.clearTimeout(timeout); }, [toast]);
  const persist = (next: Journal, message: string) => {
    setJournal(next);
    const error = saveJournal(next); setStorageError(error);
    setToast(error ? 'Updated for this session. Download a backup to keep your entries.' : message);
  };
  const add = (kind: EntryKind = 'weight') => { if (demo) { setDemo(false); setToast('Your journal is ready for your own entries.'); } setModal({ kind }); };
  const save = (entry: HealthEntry) => { persist({ ...journal, entries: [...journal.entries.filter(item => item.id !== entry.id), entry] }, modal?.entry ? 'Entry updated.' : 'Entry saved on this device.'); setModal(null); };
  const edit = (entry: HealthEntry) => setModal({ kind: entry.kind, entry });
  const changeUnit = (next: WeightUnit) => { if (demo) setDemoData({ ...demoData, weightUnit: next }); else persist({ ...journal, weightUnit: next }, 'Weight unit updated.'); };
  const exportJournal = () => {
    const blob = new Blob([JSON.stringify(journal, null, 2)], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `daywell-journal-${todayKey()}.json`; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  const readImport = async (file: File | undefined) => {
    setImportData(null); setImportError(''); setImportName(file?.name ?? '');
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setImportError('Choose a journal JSON file smaller than 10 MB.'); return; }
    try { setImportData(parseJournal(JSON.parse(await file.text()))); } catch (error) { setImportError(error instanceof SyntaxError ? 'This file is not a valid journal backup.' : error instanceof Error ? error.message : 'This file is not a valid journal backup.'); }
  };
  const showImport = () => { setImportData(null); setImportError(''); setImportName(''); setImportOpen(true); };
  const exitDemo = () => { setDemo(false); setDate(todayKey()); };
  const cardHeader = (icon: ReactNode, title: string, action?: ReactNode) => <div className="card-header"><h2>{icon}{t(title)}</h2>{action}</div>;
  const addButton = (kind: EntryKind, text = 'Add') => <button className="text-button" onClick={() => add(kind)}><Plus size={16} />{t(text)}</button>;
  const rangeSwitch = <div className="range-switch" aria-label={t("Chart date range")}>{[7, 30, 90].map(days => <button key={days} className={range === days ? 'active' : ''} onClick={() => setRange(days)} aria-pressed={range === days}>{t('{days}D', { days: number(days) })}</button>)}</div>;
  return <>
    <div className="app-shell">
      <aside className="sidebar"><a className="brand" href="#" onClick={event => { event.preventDefault(); setTab('today'); }} aria-label={t("Daywell home")}><span className="brand-mark"><Sprout size={25} /></span><span>daywell<span className="brand-dot">.</span></span></a><p className="sidebar-caption">{t("A little better, every day.")}</p>
        <nav className="desktop-nav" aria-label={t("Main navigation")}>{navItems.map(({ key, label, icon: Icon }) => <button key={key} className={tab === key ? 'nav-item active' : 'nav-item'} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}><Icon size={20} /><span>{label}</span>{tab === key && <span className="nav-dot" />}</button>)}</nav>
        <div className="sidebar-note"><span className="leaf-art"><Leaf size={40} strokeWidth={1.25} /></span><h3>{t("Make room for you.")}</h3><p>{t("A meal, a walk, a moment to check in. It all counts.")}</p><button onClick={() => add('note')}>{t("Take a moment")} <ArrowRight size={16} /></button></div>
        <div className="sidebar-bottom"><span><ShieldCheck size={17} />{t("Stored on this device")}</span><p>{t("Export a backup to keep a copy.")}</p><div className="sidebar-tools"><button onClick={exportJournal} disabled={demo}><Download size={16} />{t("Export")}</button><button onClick={showImport}><Upload size={16} />{t("Import")}</button></div></div>
      </aside>
      <main className="main-content">
        <header className="page-header"><div><p className="eyebrow">{t("YOUR PERSONAL WELLNESS JOURNAL")}</p><h1>{tab === 'today' ? <>{t("A little care,")} <em>{t("every day.")}</em></> : tab === 'history' ? <>{t("Your story,")} <em>{t("one day at a time.")}</em></> : <>{t("Small steps.")} <em>{t("A bigger picture.")}</em></>}</h1><p className="header-description">{tab === 'today' ? t("A gentle place to keep track of what makes you feel good.") : tab === 'history' ? t("Look back on your meals, movement, and moments.") : t("See the patterns in your own pace of progress.")}</p></div><div className="header-actions"><div className="language-control"><label htmlFor="language-select"><Globe size={15} />语言 / Language</label><select id="language-select" aria-label="语言 / Language" value={locale} onChange={event => setLocale(event.target.value as Locale)}><option value="zh-CN">中文</option><option value="en">English</option></select></div><button className="button primary header-add" onClick={() => add()}><Plus size={18} />{t("Add entry")}</button></div></header>
        {preferenceError && <p className="language-warning" role="status">{t('Language preference could not be saved. Your selection works for this session.')}</p>}
        {demo && <div className="demo-banner"><span><Sprout size={20} /><strong>{t("Sample data")}</strong><span>{t("Explore the layout. These entries are a preview.")}</span></span><button onClick={exitDemo}>{t("Start my journal")} <ArrowRight size={16} /></button></div>}
        {storageError && <div className="storage-alert" role="alert"><ShieldCheck size={19} /><div><strong>{t("Your journal needs a backup.")}</strong><p>{errorText(storageError)} {t('Changes are available for this session. Export your data before closing this page.')}</p></div><button className="button secondary" onClick={exportJournal} disabled={demo}><Download size={16} />{t("Export backup")}</button></div>}
        <div className="day-toolbar"><div className="date-controls"><button className="icon-button" onClick={() => setDate(shiftDate(date, -1))} aria-label={t("Previous day")}><ChevronLeft size={19} /></button><label className="date-picker"><CalendarDays size={17} /><span>{date === todayKey() ? t("Today") : prettyDate(date, { weekday: 'short' })}<span className="date-separator">{locale === 'zh-CN' ? '，' : ','}</span> {prettyDate(date, { month: 'short', day: 'numeric', year: 'numeric' })}</span><ChevronDown size={14} /><input aria-label={t("Select journal date")} type="date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /></label><button className="icon-button" onClick={() => setDate(shiftDate(date, 1))} aria-label={t("Next day")}><ChevronRight size={19} /></button>{date !== todayKey() && <button className="today-button" onClick={() => setDate(todayKey())}>{t("Today")}</button>}</div><label className="unit-control"><Settings2 size={15} /><span>{t("Weight in")}</span><select aria-label={t("Weight unit")} value={unit} onChange={event => changeUnit(event.target.value as WeightUnit)}><option value="kg">kg</option><option value="lb">lb</option></select></label></div>
        {tab === 'today' && <>
          <section className="stats-grid" aria-label={t("Daily summary")}><button className="stat-card weight-stat" onClick={() => add('weight')}><div className="stat-top"><span>{t("Latest weight")}</span><Scale size={21} /></div><div className="stat-value">{latestWeight ? number(weightForDisplay(latestWeight.weight, unit), 1) : '—'}<span>{unit}</span></div><div className="stat-bottom">{latestWeight ? t('Recorded {date}', { date: dateLabel(latestWeight.date) }) : t("Your first weigh-in starts the story")}<span className="stat-add"><Plus size={16} /></span></div><div className="stat-decoration" aria-hidden="true" /></button>
          <button className="stat-card" onClick={() => add('meal')}><div className="stat-top"><span>{t("Meals recorded")}</span><span className="stat-icon peach"><Utensils size={21} /></span></div><div className="stat-value">{number(meals.length)}<span>{t(meals.length === 1 ? 'meal' : 'meals')}</span></div><div className="stat-bottom">{hasCalories ? t('{value} kcal recorded', { value: number(calories) }) : meals.length ? t("Nourishing your day") : t("What’s on your plate today?")}<span className="stat-add"><Plus size={16} /></span></div></button>
          <button className="stat-card" onClick={() => add('exercise')}><div className="stat-top"><span>{t("Time in motion")}</span><span className="stat-icon sage"><Activity size={22} /></span></div><div className="stat-value">{number(activityMinutes)}<span>{t("min")}</span></div><div className="stat-bottom">{exercises.length ? t(exercises.length === 1 ? '{count} activity recorded' : '{count} activities recorded', { count: number(exercises.length) }) : t("Every little bit of movement counts")}<span className="stat-add"><Plus size={16} /></span></div></button>
          </section>
          <div className="section-heading"><p className="eyebrow">{t("YOUR DAY, AT A GLANCE")}</p><span>{t("Small habits. Lasting care.")}</span></div>
          <section className="dashboard-grid">
            <div className="dashboard-left"><article className="card weight-card">{cardHeader(<TrendingUp size={19} />, 'Weight journey', rangeSwitch)}<div className="chart-meta"><p>{t("A little perspective on your progress.")}</p>{weightChange !== null && <span className="change-pill">{weightChange < 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{t('{value} {unit} in {days} days', { value: `${weightChange > 0 ? '+' : ''}${number(weightChange, 1)}`, unit, days: number(range) })}</span>}</div><WeightChart entries={active.entries} unit={unit} end={date} days={range} compact />{dailyWeights.length > 0 && <div className="weigh-in-row"><span><Scale size={15} />{dailyWeights.length === 1 ? t("Today’s weigh-in") : t("This day’s weigh-ins")}</span><div>{dailyWeights.map(entry => <div className="weigh-in-item" key={entry.id}><strong>{number(weightForDisplay(entry.weight, unit), 1)} {unit}</strong><EntryActions entry={entry} onEdit={edit} onDelete={setDeleteEntry} demo={demo} /></div>)}</div></div>}<div className="card-footer"><span><span className="legend-dot" />{t("Your recorded weight")}</span>{addButton('weight', 'Log weight')}</div></article>
            <article className="card meals-card">{cardHeader(<Utensils size={19} />, 'On the menu', addButton('meal', 'Add meal'))}{meals.length ? <div className="entry-list">{meals.map(entry => <div className="meal-row" key={entry.id}><span className={`meal-illustration ${entry.mealType.toLowerCase()}`}><Utensils size={22} strokeWidth={1.5} /></span><div className="entry-main"><span className="entry-label">{mealName(entry.mealType)}</span><h3>{entry.title}</h3>{entry.calories !== undefined && <p>{number(entry.calories)} {t('kcal')}</p>}</div><EntryActions entry={entry} onEdit={edit} onDelete={setDeleteEntry} demo={demo} /></div>)}</div> : <div className="card-empty horizontal"><span className="empty-icon peach"><Utensils size={25} /></span><div><h3>{t("A place for every plate")}</h3><p>{t("Breakfast, a favorite snack, or a meal shared.")}<br />{t("Record what nourished you today.")}</p><button className="text-button" onClick={() => add('meal')}>{t("Add your first meal")} <ArrowRight size={15} /></button></div></div>}</article></div>
            <div className="dashboard-right"><article className="card movement-card">{cardHeader(<Dumbbell size={20} />, 'A little movement', addButton('exercise'))}{exercises.length ? <div className="entry-list">{exercises.map(entry => <div className="exercise-row" key={entry.id}><span className="activity-icon"><Activity size={21} /></span><div className="entry-main"><h3>{entry.activity}</h3><p>{number(entry.minutes)} {t('min')} <span className="text-dot">·</span> {intensityName(entry.intensity)}</p></div><EntryActions entry={entry} onEdit={edit} onDelete={setDeleteEntry} demo={demo} /></div>)}</div> : <div className="card-empty"><span className="empty-icon"><Dumbbell size={26} strokeWidth={1.5} /></span><h3>{t("Move in your own way")}</h3><p>{t("A walk around the block or time on the mat.")}<br />{t("Every kind of movement belongs here.")}</p><button className="button secondary" onClick={() => add('exercise')}><Plus size={15} />{t("Log activity")}</button></div>}</article>
            <article className="card note-card">{cardHeader(<FileText size={19} />, 'A moment to reflect', addButton('note'))}{notes.length ? <div className="notes-list">{notes.map(entry => <div className="note-entry" key={entry.id}><p>{entry.text}</p><EntryActions entry={entry} onEdit={edit} onDelete={setDeleteEntry} demo={demo} /></div>)}</div> : <div className="note-empty"><p>{t("How are you feeling today?")}</p><span>{t("A thought, a little win, or something on your mind.")}</span><button className="text-button" onClick={() => add('note')}>{t("Write a note")} <ArrowRight size={15} /></button></div>}<Leaf className="note-leaf" size={63} strokeWidth={1} aria-hidden="true" /></article></div>
          </section>
          {!demo && journal.entries.length === 0 && <div className="welcome-strip"><span className="welcome-icon"><Sprout size={25} /></span><div><strong>{t("Your journey is yours to shape.")}</strong><p>{t("Start with one entry, or explore a filled-in preview.")}</p></div><button className="button secondary" onClick={() => { setDemo(true); setDate(todayKey()); }}>{t("Explore sample")} <ArrowRight size={16} /></button></div>}
        </>}
        {tab === 'history' && <section className="card history-card"><div className="card-header"><h2><CalendarDays size={20} />{t("Your journal")}</h2><span className="count-label">{t(active.entries.length === 1 ? '{count} entry' : '{count} entries', { count: number(active.entries.length) })}</span></div><div className="history-toolbar"><div className="history-filters" aria-label={t("Filter journal entries")}>{(['all', 'weight', 'meal', 'exercise', 'note'] as const).map(kind => <button key={kind} className={filter === kind ? 'selected' : ''} onClick={() => setFilter(kind)} aria-pressed={filter === kind}>{kind === 'all' ? t("All entries") : kindNames[kind]}</button>)}</div><label className="search-field"><Search size={17} /><input aria-label={t("Search journal")} value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Search your journal")} /></label></div>{history.length ? <div className="history-groups">{historyDates.map(day => <section className="history-day" key={day}><div className="history-date"><h3>{prettyDate(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3><button className="text-button" onClick={() => { setDate(day); setTab('today'); }}>{t("View day")} <ArrowRight size={15} /></button></div>{history.filter(entry => entry.date === day).map(entry => { const Icon = kindIcons[entry.kind]; return <div className={`history-entry kind-${entry.kind}`} key={entry.id}><span className="history-entry-icon"><Icon size={20} /></span><div className="entry-main"><span className="entry-label">{kindNames[entry.kind]}</span><h4>{entryTitle(entry, unit)}</h4><p>{entryDetail(entry)}</p></div><EntryActions entry={entry} onEdit={edit} onDelete={setDeleteEntry} demo={demo} /></div>; })}</section>)}</div> : <div className="card-empty large"><span className="empty-icon"><CalendarDays size={29} /></span><h3>{active.entries.length ? t("No entries match your search") : t("A fresh page, just for you")}</h3><p>{active.entries.length ? t("Try another word or choose a different entry type.") : t("Your meals, movement, and reflections will come together here.")}</p>{active.entries.length ? <button className="button secondary" onClick={() => { setFilter('all'); setSearch(''); }}>{t("Clear filters")}</button> : <button className="button primary" onClick={() => add()}><Plus size={16} />{t("Add your first entry")}</button>}</div>}</section>}
        {tab === 'trends' && <section className="trends-layout"><article className="card trends-weight">{cardHeader(<TrendingUp size={20} />, 'Weight over time', rangeSwitch)}<div className="trend-heading"><div><p className="muted">{t('{days}-day view ending {date}', { days: number(range), date: dateLabel(date) })}</p><h3>{latestWeight ? <>{number(weightForDisplay(latestWeight.weight, unit), 1)} <span>{unit}</span></> : <>{t("Your story is just beginning")}</>}</h3></div>{weightChange !== null && <span className="change-pill">{t('{value} {unit} across recorded days', { value: `${weightChange > 0 ? '+' : ''}${number(weightChange, 1)}`, unit })}</span>}</div><WeightChart entries={active.entries} unit={unit} end={date} days={range} /><div className="card-footer"><p>{t("Weight can vary day to day. These are your recorded observations.")}</p>{addButton('weight', 'Log weight')}</div></article><div className="section-heading"><p className="eyebrow">{t("YOUR LAST 7 DAYS")}</p><span>{dateLabel(weekStart)} – {dateLabel(date)}</span></div><div className="weekly-grid"><article className="card weekly-card"><span className="stat-icon sage"><Activity size={22} /></span><h3>{t("Time in motion")}</h3><div className="weekly-value">{number(weekMinutes)} <span>{t("min")}</span></div><p>{t('Across {count} recorded activities', { count: number(weekEntries.filter(entry => entry.kind === 'exercise').length) })}</p></article><article className="card weekly-card"><span className="stat-icon peach"><Utensils size={22} /></span><h3>{t("Meals remembered")}</h3><div className="weekly-value">{number(weekMeals)} <span>{t("meals")}</span></div><p>{t("Small moments of nourishment")}</p></article><article className="card weekly-card"><span className="stat-icon lavender"><CalendarDays size={22} /></span><h3>{t("Days you checked in")}</h3><div className="weekly-value">{number(activeDays)} <span>{t("of 7")}</span></div><p>{t("Days with at least one entry")}</p></article></div><article className="trend-note"><Heart size={22} strokeWidth={1.5} /><div><h3>{t("Progress has many shapes.")}</h3><p>{t("Your journal helps you notice patterns. There’s no perfect score, just a little more understanding of you.")}</p></div></article></section>}
        <footer className="page-footer"><span><Leaf size={14} />{t("A little better, at your own pace.")}</span><div><button onClick={exportJournal} disabled={demo}><Download size={14} />{t("Export journal")}</button><button onClick={showImport}><Upload size={14} />{t("Import backup")}</button></div></footer>
      </main>
      <nav className="mobile-nav" aria-label={t("Mobile navigation")}>{navItems.map(({ key, label, icon: Icon }) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}><Icon size={20} /><span>{label}</span></button>)}<button onClick={() => add()}><span className="mobile-add"><Plus size={21} /></span><span>{t("Add entry")}</span></button></nav>
    </div>
    {toast && <div className="toast" role="status"><Check size={17} /><span>{t(toast)}</span><button className="icon-button small" onClick={() => setToast('')} aria-label={t("Dismiss notification")}><X size={15} /></button></div>}
    {modal && <EntryForm model={modal} unit={journal.weightUnit} date={date} onClose={() => setModal(null)} onSave={save} />}
    {deleteEntry && <Modal title={t("Remove this entry?")} subtitle={t("This entry will be removed from your journal on this device.")} onClose={() => setDeleteEntry(null)}><div className="delete-preview"><span className="entry-label">{kindNames[deleteEntry.kind]} · {dateLabel(deleteEntry.date)}</span><p>{entryTitle(deleteEntry, journal.weightUnit)}</p></div><div className="modal-actions"><button className="button secondary" data-autofocus onClick={() => setDeleteEntry(null)}>{t("Keep entry")}</button><button className="button danger" onClick={() => { persist({ ...journal, entries: journal.entries.filter(entry => entry.id !== deleteEntry.id) }, 'Entry removed.'); setDeleteEntry(null); }}><Trash2 size={16} />{t("Remove entry")}</button></div></Modal>}
    {importOpen && <Modal title={t("Import your journal")} subtitle={t("Restore a Daywell JSON backup from your device.")} onClose={() => setImportOpen(false)}><div className="import-upload"><Upload size={28} strokeWidth={1.5} /><label className="file-label">{t("Choose a backup file")}<input data-autofocus type="file" accept=".json,application/json" onChange={event => void readImport(event.target.files?.[0])} /></label><span>{importName || t("JSON file · up to 10 MB")}</span></div>{importError && <p className="form-error" role="alert">{errorText(importError)}</p>}{importData && <div className="import-preview"><span className="entry-label">{t("BACKUP PREVIEW")}</span><h3>{t(importData.entries.length === 1 ? '{count} entry ready to restore' : '{count} entries ready to restore', { count: number(importData.entries.length) })}</h3><p>{t('Weight unit: {unit}.', { unit: importData.weightUnit })} {importData.entries.length ? t('Dates: {start} – {end}.', { start: dateLabel([...importData.entries].sort((a, b) => a.date.localeCompare(b.date))[0].date), end: dateLabel([...importData.entries].sort((a, b) => b.date.localeCompare(a.date))[0].date) }) : t('This is an empty journal.')}</p><div className="import-warning"><strong>{t(journal.entries.length === 1 ? 'This will replace your current {count} entry.' : 'This will replace your current {count} entries.', { count: number(journal.entries.length) })}</strong><span>{t("Export a backup first if you want to keep them.")}</span></div><button className="text-button" onClick={exportJournal}><Download size={16} />{t("Export current journal")}</button></div>}<div className="modal-actions"><button className="button secondary" onClick={() => setImportOpen(false)}>{t("Cancel")}</button><button className="button primary" disabled={!importData} onClick={() => { if (!importData) return; persist(importData, 'Journal imported on this device.'); setDemo(false); setImportOpen(false); }}><Upload size={16} />{t("Replace with backup")}</button></div></Modal>}
  </>;
}
