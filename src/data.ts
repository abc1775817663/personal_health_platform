export type WeightUnit = 'kg' | 'lb';
export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
export type Intensity = 'Easy' | 'Moderate' | 'Hard';

interface EntryBase { id: string; date: string; createdAt: string }
export interface WeightEntry extends EntryBase { kind: 'weight'; weight: number }
export interface MealEntry extends EntryBase { kind: 'meal'; mealType: MealType; title: string; calories?: number }
export interface ExerciseEntry extends EntryBase { kind: 'exercise'; activity: string; minutes: number; intensity: Intensity }
export interface NoteEntry extends EntryBase { kind: 'note'; text: string }
export type HealthEntry = WeightEntry | MealEntry | ExerciseEntry | NoteEntry;
export interface Journal { version: 1; entries: HealthEntry[]; weightUnit: WeightUnit }

export const STORAGE_KEY = 'daywell.journal.v1';
const POUNDS_PER_KG = 2.2046226218;
const mealTypes: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const intensities: Intensity[] = ['Easy', 'Moderate', 'Hard'];

export function emptyJournal(): Journal { return { version: 1, entries: [], weightUnit: 'kg' }; }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a journal object.');
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, limit: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    throw new Error(`${label} must be nonempty and no longer than ${limit} characters.`);
  }
  return value.trim();
}

function number(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return value;
}

function validDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Dates must use YYYY-MM-DD.');
  const parsed = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('An entry has an invalid date.');
  return value;
}

/** Validate imports completely before replacing any saved journal. */
export function parseJournal(input: unknown): Journal {
  const raw = object(input);
  if (raw.version !== 1) throw new Error('This file is not a supported Daywell journal (version 1).');
  if (raw.weightUnit !== 'kg' && raw.weightUnit !== 'lb') throw new Error('Weight unit must be kg or lb.');
  if (!Array.isArray(raw.entries) || raw.entries.length > 10000) throw new Error('A journal must contain an entries list with at most 10,000 entries.');
  const ids = new Set<string>();
  const entries: HealthEntry[] = raw.entries.map((value: unknown) => {
    const entry = object(value);
    const id = text(entry.id, 'Entry ID', 128);
    if (ids.has(id)) throw new Error('The journal contains duplicate entry IDs.');
    ids.add(id);
    const createdAt = text(entry.createdAt, 'Entry time', 40);
    if (!Number.isFinite(Date.parse(createdAt))) throw new Error('An entry has an invalid creation time.');
    const base = { id, date: validDate(entry.date), createdAt };
    switch (entry.kind) {
      case 'weight': return { ...base, kind: 'weight', weight: number(entry.weight, 'Weight in kg', 1, 700) };
      case 'meal': {
        if (!mealTypes.includes(entry.mealType as MealType)) throw new Error('An entry has an invalid meal type.');
        return { ...base, kind: 'meal', mealType: entry.mealType as MealType, title: text(entry.title, 'Meal description', 200),
          ...(entry.calories === undefined ? {} : { calories: number(entry.calories, 'Calories', 0, 20000) }) };
      }
      case 'exercise': {
        if (!intensities.includes(entry.intensity as Intensity)) throw new Error('An entry has an invalid exercise intensity.');
        return { ...base, kind: 'exercise', activity: text(entry.activity, 'Activity', 120), minutes: number(entry.minutes, 'Exercise minutes', 1, 1440), intensity: entry.intensity as Intensity };
      }
      case 'note': return { ...base, kind: 'note', text: text(entry.text, 'Note', 3000) };
      default: throw new Error('The journal contains an unknown entry type.');
    }
  });
  return { version: 1, entries, weightUnit: raw.weightUnit };
}

export function loadJournal(): { journal: Journal; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { journal: raw ? parseJournal(JSON.parse(raw)) : emptyJournal(), error: null };
  } catch {
    return { journal: emptyJournal(), error: 'Your saved journal could not be opened. Its stored copy has been left untouched.' };
  }
}

/** Retain an unreadable original before allowing a new valid journal to replace it. */
export function saveJournal(journal: Journal): string | null {
  try {
    const normalized = parseJournal(journal);
    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous) {
      try { parseJournal(JSON.parse(previous)); }
      catch { localStorage.setItem(`${STORAGE_KEY}.recovery.${Date.now()}`, previous); }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return null;
  } catch {
    return 'Your changes could not be saved in this browser. Export your journal to keep a copy before closing this page.';
  }
}

export function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${validDate(date)}T12:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function prettyDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }): string {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(`${validDate(date)}T12:00:00`));
}

export function weightForDisplay(kg: number, unit: WeightUnit): number { return Math.round(kg * (unit === 'lb' ? POUNDS_PER_KG : 1) * 10) / 10; }
export function weightFromDisplay(value: number, unit: WeightUnit): number { return unit === 'lb' ? value / POUNDS_PER_KG : value; }
export function createId(): string { return crypto.randomUUID(); }

/** Charts use the last check-in on each day, regardless of import order. */
export function latestDailyWeights(entries: HealthEntry[]): WeightEntry[] {
  const days = new Map<string, WeightEntry>();
  for (const entry of entries) {
    if (entry.kind !== 'weight') continue;
    const previous = days.get(entry.date);
    if (!previous || Date.parse(entry.createdAt) >= Date.parse(previous.createdAt)) days.set(entry.date, entry);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function sampleJournal(anchorDate: string): Journal {
  const base = (offset: number, time: string): EntryBase => {
    const date = shiftDate(anchorDate, offset);
    return { id: `sample-${offset}-${time}`, date, createdAt: `${date}T${time}:00Z` };
  };
  const entries: HealthEntry[] = [
    ...[73.1, 72.9, 73, 72.7, 72.6, 72.5, 72.4].map((weight, index): WeightEntry => ({ ...base(index - 6, '07:30'), kind: 'weight', weight })),
    { ...base(0, '08:00'), kind: 'meal', mealType: 'Breakfast', title: 'Oatmeal, berries & yogurt', calories: 380 },
    { ...base(0, '12:30'), kind: 'meal', mealType: 'Lunch', title: 'Roasted chickpea & avocado bowl', calories: 520 },
    { ...base(0, '17:00'), kind: 'exercise', activity: 'A walk in the park', minutes: 30, intensity: 'Easy' },
    { ...base(0, '19:00'), kind: 'note', text: 'A little fresh air made a big difference today.' },
    { ...base(-1, '08:00'), kind: 'meal', mealType: 'Breakfast', title: 'Toast & scrambled eggs', calories: 410 },
    { ...base(-1, '17:00'), kind: 'exercise', activity: 'Yoga', minutes: 25, intensity: 'Easy' },
  ];
  return { version: 1, weightUnit: 'kg', entries };
}
