import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STORAGE_KEY,
  emptyJournal,
  latestDailyWeights,
  loadJournal,
  parseJournal,
  saveJournal,
  shiftDate,
  weightForDisplay,
  weightFromDisplay,
} from '../src/data.ts';
import type { Journal, WeightEntry } from '../src/data.ts';

const journal: Journal = {
  version: 1,
  weightUnit: 'lb',
  entries: [
    { id: 'weight', kind: 'weight', date: '2026-10-11', createdAt: '2026-10-11T07:00:00Z', weight: 72.4 },
    { id: 'meal', kind: 'meal', date: '2026-10-11', createdAt: '2026-10-11T08:00:00Z', mealType: 'Breakfast', title: 'Black coffee', calories: 0 },
    { id: 'meal-unknown', kind: 'meal', date: '2026-10-11', createdAt: '2026-10-11T12:00:00Z', mealType: 'Lunch', title: 'Homemade soup' },
    { id: 'exercise', kind: 'exercise', date: '2026-10-11', createdAt: '2026-10-11T17:00:00Z', activity: 'Walking', minutes: 30, intensity: 'Easy' },
    { id: 'note', kind: 'note', date: '2026-10-11', createdAt: '2026-10-11T19:00:00Z', text: 'Felt rested today.' },
  ],
};

function weight(id: string, date: string, createdAt: string, value: number): WeightEntry {
  return { id, kind: 'weight', date, createdAt, weight: value };
}

function withStorage(run: (storage: {
  values: Map<string, string>;
  writes: string[];
  failRead: boolean;
  failWrite: boolean;
  failRecovery: boolean;
}) => void): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = {
    values: new Map<string, string>(),
    writes: [] as string[],
    failRead: false,
    failWrite: false,
    failRecovery: false,
    getItem(key: string): string | null {
      if (this.failRead) throw new Error('Storage access denied');
      return this.values.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      if (this.failWrite || (this.failRecovery && key.includes('.recovery.'))) throw new Error('Storage quota exceeded');
      this.writes.push(key);
      this.values.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try { run(storage); }
  finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}

test('a journal round trip preserves all entry kinds, zero calories, and unknown calories', () => {
  const restored = parseJournal(JSON.parse(JSON.stringify(journal)));
  assert.deepEqual(restored, journal);
  const zeroCalorieMeal = restored.entries.find(entry => entry.id === 'meal');
  const unknownCalorieMeal = restored.entries.find(entry => entry.id === 'meal-unknown');
  assert.equal(zeroCalorieMeal?.kind === 'meal' && zeroCalorieMeal.calories, 0);
  assert.equal(unknownCalorieMeal?.kind === 'meal' && 'calories' in unknownCalorieMeal, false);
});

test('imports reject invalid types, impossible dates, out-of-range values, and duplicate IDs', () => {
  const base = journal.entries[0];
  const invalidEntries = [
    { ...base, kind: 'unknown' },
    { ...base, weight: '72.4' },
    { ...base, weight: null },
    { ...base, weight: Number.POSITIVE_INFINITY },
    { ...base, weight: 0 },
    { ...base, weight: 701 },
    { ...base, date: '2026-02-30' },
    { ...base, date: '11/10/2026' },
    { ...base, createdAt: 'yesterday' },
    { ...journal.entries[1], calories: -1 },
    { ...journal.entries[1], mealType: 'Brunch' },
    { ...journal.entries[3], minutes: 0 },
    { ...journal.entries[3], minutes: 1441 },
    { ...journal.entries[3], intensity: 'Extreme' },
    { ...journal.entries[4], text: '   ' },
  ];
  for (const entry of invalidEntries) {
    assert.throws(() => parseJournal({ ...journal, entries: [entry] }), undefined, JSON.stringify(entry));
  }
  for (const input of [null, [], { ...journal, version: 2 }, { ...journal, weightUnit: 'stone' }, { ...journal, entries: {} }]) {
    assert.throws(() => parseJournal(input));
  }
  assert.throws(() => parseJournal({ ...journal, entries: [base, { ...base }] }), /duplicate/i);
});

test('daily weight history uses the latest actual timestamp and sorts days regardless of import order', () => {
  const morning = weight('morning', '2026-10-11', '2026-10-11T07:00:00Z', 72.4);
  const evening = weight('evening', '2026-10-11', '2026-10-11T18:00:00Z', 72.8);
  const offsetTime = weight('offset', '2026-10-11', '2026-10-11T19:00:00+04:00', 72.6);
  const previousDay = weight('previous', '2026-10-10', '2026-10-10T07:00:00Z', 73);
  const nextDay = weight('next', '2026-10-12', '2026-10-12T07:00:00Z', 72.5);
  const input = [evening, nextDay, morning, previousDay, offsetTime, journal.entries[1]];
  const expected = [previousDay, evening, nextDay];
  assert.deepEqual(latestDailyWeights(input), expected);
  assert.deepEqual(latestDailyWeights([...input].reverse()), expected);
  assert.deepEqual(latestDailyWeights([morning, offsetTime, previousDay, nextDay, evening]), expected);
});

test('calendar navigation crosses month and year boundaries and respects leap days', () => {
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDate('2027-01-01', -1), '2026-12-31');
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDate('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftDate('2026-10-31', 2), '2026-11-02');
  assert.throws(() => shiftDate('2026-02-29', 1));
});

test('pound entry conversion retains kilogram precision while display uses one decimal', () => {
  const kg = weightFromDisplay(200, 'lb');
  assert.ok(Math.abs(kg - 90.718474) < 0.000001);
  assert.equal(weightForDisplay(kg, 'lb'), 200);
  assert.equal(weightForDisplay(72.44, 'kg'), 72.4);
  assert.equal(weightForDisplay(72.4, 'lb'), 159.6);
  assert.equal(weightFromDisplay(72.44, 'kg'), 72.44);
});

test('saving and reloading persist a complete journal and an empty browser starts cleanly', () => {
  withStorage(storage => {
    assert.deepEqual(loadJournal(), { journal: emptyJournal(), error: null });
    assert.equal(saveJournal(journal), null);
    assert.deepEqual(loadJournal(), { journal, error: null });
    assert.deepEqual(JSON.parse(storage.values.get(STORAGE_KEY)!), journal);
    const updated = { ...journal, entries: journal.entries.slice(1) };
    assert.equal(saveJournal(updated), null);
    assert.deepEqual(loadJournal().journal, updated);
  });
});

test('storage failures return a visible warning and do not overwrite an existing saved journal', () => {
  withStorage(storage => {
    const original = JSON.stringify(journal);
    storage.values.set(STORAGE_KEY, original);
    storage.failWrite = true;
    assert.match(saveJournal(emptyJournal())!, /could not be saved.*Export/i);
    assert.equal(storage.values.get(STORAGE_KEY), original);
    storage.failWrite = false;
    storage.failRead = true;
    const loaded = loadJournal();
    assert.deepEqual(loaded.journal, emptyJournal());
    assert.match(loaded.error!, /could not be opened/i);
    assert.match(saveJournal(emptyJournal())!, /could not be saved/i);
    assert.equal(storage.values.get(STORAGE_KEY), original);
  });
});

test('corrupt saved data remains untouched on load and is preserved before replacement', () => {
  for (const original of ['{broken JSON', JSON.stringify({ version: 1, entries: [], weightUnit: 'invalid' })]) {
    withStorage(storage => {
      storage.values.set(STORAGE_KEY, original);
      assert.match(loadJournal().error!, /left untouched/i);
      assert.equal(storage.values.get(STORAGE_KEY), original);
      assert.equal(storage.writes.length, 0);

      storage.failRecovery = true;
      assert.match(saveJournal(journal)!, /could not be saved/i);
      assert.equal(storage.values.get(STORAGE_KEY), original);
      storage.failRecovery = false;

      assert.equal(saveJournal(journal), null);
      const recoveryKey = storage.writes.find(key => key.startsWith(`${STORAGE_KEY}.recovery.`));
      assert.ok(recoveryKey, 'The unreadable copy must be retained before replacement');
      assert.equal(storage.values.get(recoveryKey), original);
      assert.equal(storage.writes[0], recoveryKey);
      assert.equal(storage.writes[1], STORAGE_KEY);
      assert.deepEqual(loadJournal(), { journal, error: null });
    });
  }
});
