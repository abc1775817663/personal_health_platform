import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { HealthEntry, Intensity, MealType } from './data';

export type Locale = 'zh-CN' | 'en';
export const LANGUAGE_KEY = 'daywell.language.v1';
type Values = Record<string, string | number>;
const chinese: Record<string, string> = {
  'A MOMENT FOR YOU': '给自己一点时间',
  'Close dialog': '关闭弹窗',
  'Weight': '体重', 'Meal': '饮食', 'Exercise': '运动', 'Note': '笔记',
  'Breakfast': '早餐', 'Lunch': '午餐', 'Dinner': '晚餐', 'Snack': '加餐',
  'Easy': '轻松', 'Moderate': '适中', 'Hard': '高强度',
  'Edit {kind}': '编辑{kind}', 'Edit {kind} entry': '编辑{kind}记录', 'Delete {kind} entry': '删除{kind}记录',
  'Add to your day': '记录今天', 'Small moments make a meaningful picture.': '记录日常的小事，慢慢看见自己的变化。',
  'Entry type': '记录类型', 'Date': '日期', 'Weight ({unit})': '体重（{unit}）',
  'e.g. 68.5': '例如 68.5', 'e.g. 151': '例如 151',
  'Each weigh-in is kept in your journal. Trends use the latest entry for each day.': '每次称重都会保留。趋势图采用每天的最后一次记录。',
  'What did you eat?': '吃了什么？', 'e.g. Oatmeal with berries': '例如：燕麦粥配莓果',
  'Calories': '热量', 'optional': '选填', 'e.g. 350': '例如 350', 'kcal': '千卡',
  'A simple meal description is enough. Add calories if they’re useful to you.': '简单描述这一餐就好，也可以按需填写热量。',
  'Activity': '运动项目', 'e.g. Morning walk': '例如：晨间散步', 'Duration': '时长', 'min': '分钟', 'Intensity': '运动强度',
  'How are you feeling?': '感觉怎么样？', 'Energy, mood, sleep, or anything on your mind…': '精力、心情、睡眠，或任何想记录的事情……',
  'Your journal is a space for the whole picture.': '这里也能记录你的心情和生活点滴。',
  'Cancel': '取消', 'Update entry': '更新记录', 'Save entry': '保存记录',
  'Choose a valid date.': '请选择有效日期。',
  'Enter a weight between {min} and {max} {unit}.': '请输入 {min} 至 {max} {unit} 之间的体重。',
  'Add a short description of your meal.': '请简单描述这一餐。',
  'Calories must be between 0 and 20,000.': '热量需在 0 至 20,000 千卡之间。',
  'Add the name of your activity.': '请输入运动项目名称。',
  'Duration must be between 1 and 1,440 minutes.': '运动时长需在 1 至 1,440 分钟之间。',
  'Write a little something before saving.': '请先写下想记录的内容。',
  'Your progress starts here': '从这里开始，记录变化', 'Add a weigh-in to begin your weight history.': '添加一次称重，开启你的体重记录。',
  'Weight history: {values}': '体重历史：{values}',
  '{count} days recorded · Latest weigh-in per day · {unit}': '已记录 {count} 天 · 每天最后一次称重 · {unit}',
  '{count} day recorded · Latest weigh-in per day · {unit}': '已记录 {count} 天 · 每天最后一次称重 · {unit}',
  'Weigh-in': '称重记录', 'Daily reflection': '每日随笔', '{value} min · {intensity} intensity': '{value} 分钟 · {intensity}',
  'Today': '今天', 'Journal': '日志', 'Trends': '趋势',
  'Updated for this session. Download a backup to keep your entries.': '本次会话已更新，请导出备份以保留记录。',
  'Your journal is ready for your own entries.': '你的日志已准备好，开始记录吧。',
  'Entry updated.': '记录已更新。', 'Entry saved on this device.': '记录已保存在此设备。', 'Weight unit updated.': '体重单位已更新。',
  'Choose a journal JSON file smaller than 10 MB.': '请选择小于 10 MB 的日志 JSON 文件。',
  'This file is not a valid journal backup.': '此文件不是有效的日志备份。',
  'Add': '添加', 'Chart date range': '图表日期范围', '{days}D': '{days}天',
  'Daywell home': 'Daywell 首页', 'A little better, every day.': '每天一点点，更好地照顾自己。', 'Main navigation': '主导航',
  'Make room for you.': '留一点时间给自己。', 'A meal, a walk, a moment to check in. It all counts.': '一餐饭、一段散步、一次自我关照，都是值得记录的日常。',
  'Take a moment': '写下此刻', 'Stored on this device': '保存在此设备', 'Export a backup to keep a copy.': '导出备份，留一份安心的副本。', 'Export': '导出', 'Import': '导入',
  'YOUR PERSONAL WELLNESS JOURNAL': '你的个人健康日志', 'A little care,': '一点关照，', 'every day.': '每一天。',
  'Your story,': '你的故事，', 'one day at a time.': '一天一页。', 'Small steps.': '点滴积累，', 'A bigger picture.': '看见变化。',
  'A gentle place to keep track of what makes you feel good.': '在这里，记录体重、饮食、运动与生活感受。',
  'Look back on your meals, movement, and moments.': '回顾你的饮食、运动与日常点滴。',
  'See the patterns in your own pace of progress.': '按自己的节奏，发现健康习惯的变化。',
  'Add entry': '添加记录', 'Sample data': '示例数据', 'Explore the layout. These entries are a preview.': '这些是示例记录，你可以先体验界面。',
  'Start my journal': '开始我的日志', 'Your journal needs a backup.': '请为你的日志导出备份。',
  'Changes are available for this session. Export your data before closing this page.': '更改仅在本次会话中有效，请在关闭页面前导出数据。',
  'Export backup': '导出备份', 'Previous day': '前一天', 'Select journal date': '选择日志日期', 'Next day': '后一天',
  'Weight in': '体重单位', 'Weight unit': '体重单位', 'Daily summary': '每日概览', 'Latest weight': '最近体重',
  'Recorded {date}': '记录于 {date}', 'Your first weigh-in starts the story': '从第一次称重开始记录',
  'Meals recorded': '饮食记录', 'meal': '餐', 'meals': '餐', '{value} kcal recorded': '已记录 {value} 千卡',
  'Nourishing your day': '好好吃饭，好好生活', 'What’s on your plate today?': '今天吃了什么？',
  'Time in motion': '运动时长', '{count} activity recorded': '已记录 {count} 项运动', '{count} activities recorded': '已记录 {count} 项运动',
  'Every little bit of movement counts': '每一点运动都算数', 'YOUR DAY, AT A GLANCE': '今日一览', 'Small habits. Lasting care.': '小习惯，长久的关照。',
  'Weight journey': '体重变化', 'A little perspective on your progress.': '回顾体重记录，看见自己的变化。',
  '{value} {unit} in {days} days': '{days} 天内 {value} {unit}',
  'Today’s weigh-in': '今日称重', 'This day’s weigh-ins': '当日称重', 'Your recorded weight': '体重记录', 'Log weight': '记录体重',
  'On the menu': '今日饮食', 'Add meal': '添加饮食', 'A place for every plate': '每一餐，都值得记录',
  'Breakfast, a favorite snack, or a meal shared.': '早餐、喜欢的零食，或与人分享的一餐。', 'Record what nourished you today.': '记下今天吃过的美味。',
  'Add your first meal': '记录第一餐', 'A little movement': '今日运动', 'Move in your own way': '找到适合自己的运动',
  'A walk around the block or time on the mat.': '出门散步，或在瑜伽垫上舒展身体。', 'Every kind of movement belongs here.': '每一种运动，都可以记录在这里。',
  'Log activity': '记录运动', 'A moment to reflect': '每日随笔', 'How are you feeling today?': '今天感觉怎么样？',
  'A thought, a little win, or something on your mind.': '一个想法、一点小进步，或心里惦记的事。', 'Write a note': '写一篇笔记',
  'Your journey is yours to shape.': '你的健康旅程，由你定义。', 'Start with one entry, or explore a filled-in preview.': '从一条记录开始，也可以先看看示例。',
  'Explore sample': '查看示例', 'Your journal': '我的日志', '{count} entry': '{count} 条记录', '{count} entries': '{count} 条记录',
  'Filter journal entries': '筛选日志记录', 'All entries': '全部记录', 'Search journal': '搜索日志', 'Search your journal': '搜索你的日志', 'View day': '查看当天',
  'No entries match your search': '没有找到符合条件的记录', 'A fresh page, just for you': '新的一页，等你来记录',
  'Try another word or choose a different entry type.': '试试其他关键词，或选择不同的记录类型。',
  'Your meals, movement, and reflections will come together here.': '你的饮食、运动与随笔，都将汇集在这里。',
  'Clear filters': '清除筛选', 'Add your first entry': '添加第一条记录', 'Weight over time': '体重趋势',
  '{days}-day view ending {date}': '截至 {date} 的近 {days} 天', 'Your story is just beginning': '你的记录才刚刚开始',
  '{value} {unit} across recorded days': '已记录日期间变化 {value} {unit}',
  'Weight can vary day to day. These are your recorded observations.': '体重每天可能有所波动，图表展示的是你的实际记录。',
  'YOUR LAST 7 DAYS': '最近 7 天', 'Across {count} recorded activities': '来自 {count} 项运动记录', 'Meals remembered': '饮食次数',
  'Small moments of nourishment': '每一餐，都是对自己的照顾', 'Days you checked in': '记录天数', 'of 7': '/ 7 天',
  'Days with at least one entry': '至少有一条记录的日子', 'Progress has many shapes.': '进步，有很多种模样。',
  'Your journal helps you notice patterns. There’s no perfect score, just a little more understanding of you.': '日志帮助你发现日常规律。不追求完美的分数，只是多了解自己一点。',
  'A little better, at your own pace.': '按自己的节奏，慢慢变好。', 'Export journal': '导出日志', 'Import backup': '导入备份',
  'Mobile navigation': '移动端导航', 'Dismiss notification': '关闭通知',
  'Remove this entry?': '删除这条记录？', 'This entry will be removed from your journal on this device.': '这条记录将从此设备上的日志中删除。',
  'Keep entry': '保留记录', 'Remove entry': '删除记录', 'Entry removed.': '记录已删除。',
  'Import your journal': '导入日志', 'Restore a Daywell JSON backup from your device.': '从此设备恢复 Daywell JSON 格式的备份。',
  'Choose a backup file': '选择备份文件', 'JSON file · up to 10 MB': 'JSON 文件 · 最大 10 MB', 'BACKUP PREVIEW': '备份预览',
  '{count} entry ready to restore': '{count} 条记录可恢复', '{count} entries ready to restore': '{count} 条记录可恢复',
  'Weight unit: {unit}.': '体重单位：{unit}。', 'Dates: {start} – {end}.': '日期：{start} 至 {end}。', 'This is an empty journal.': '这是一份空白日志。',
  'This will replace your current {count} entry.': '这将替换当前的 {count} 条记录。', 'This will replace your current {count} entries.': '这将替换当前的 {count} 条记录。',
  'Export a backup first if you want to keep them.': '如需保留，请先导出当前日志。', 'Export current journal': '导出当前日志', 'Replace with backup': '用备份替换',
  'Journal imported on this device.': '日志已导入此设备。',
  'Language preference could not be saved. Your selection works for this session.': '语言偏好无法保存，当前选择仅在本次会话中有效。',
  'Your saved journal could not be opened. Its stored copy has been left untouched.': '无法打开已保存的日志，原始数据仍然保留。',
  'Your changes could not be saved in this browser. Export your journal to keep a copy before closing this page.': '更改无法保存在此浏览器中，请在关闭页面前导出日志以保留副本。',
  'Expected a journal object.': '备份必须包含有效的日志对象。',
  'This file is not a supported Daywell journal (version 1).': '此文件不是支持的 Daywell 日志备份（版本 1）。',
  'Weight unit must be kg or lb.': '体重单位必须为 kg 或 lb。',
  'A journal must contain an entries list with at most 10,000 entries.': '日志必须包含记录列表，且不能超过 10,000 条。',
  'The journal contains duplicate entry IDs.': '日志中存在重复的记录标识。',
  'An entry has an invalid creation time.': '记录的创建时间无效。', 'Dates must use YYYY-MM-DD.': '日期必须使用 YYYY-MM-DD 格式。',
  'An entry has an invalid date.': '记录的日期无效。', 'An entry has an invalid meal type.': '记录的饮食类型无效。',
  'An entry has an invalid exercise intensity.': '记录的运动强度无效。', 'The journal contains an unknown entry type.': '日志中存在未知的记录类型。',
  '{label} must be nonempty and no longer than {limit} characters.': '{label}不能为空，且不能超过 {limit} 个字符。',
  '{label} must be between {min} and {max}.': '{label}需在 {min} 至 {max} 之间。',
  'Entry ID': '记录标识', 'Entry time': '记录时间', 'Weight in kg': '体重（kg）', 'Meal description': '饮食描述', 'Exercise minutes': '运动分钟数',
};
const sampleChinese: Record<string, string> = {
  'Oatmeal, berries & yogurt': '燕麦粥、莓果和酸奶', 'Roasted chickpea & avocado bowl': '烤鹰嘴豆牛油果碗',
  'A walk in the park': '公园散步', 'A little fresh air made a big difference today.': '今天呼吸了些新鲜空气，感觉好了许多。',
  'Toast & scrambled eggs': '吐司和炒蛋', 'Yoga': '瑜伽',
};
function initialLocale(): Locale {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'zh-CN'; }
  catch { return 'zh-CN'; }
}
function translate(locale: Locale, source: string, values: Values = {}): string {
  return (locale === 'zh-CN' ? chinese[source] ?? source : source).replace(/\{(\w+)\}/g, (placeholder, key: string) => values[key] === undefined ? placeholder : String(values[key]));
}
function errorTranslation(locale: Locale, message: string): string {
  if (locale === 'en' || chinese[message]) return translate(locale, message);
  const textError = message.match(/^(.*?) must be nonempty and no longer than (\d+) characters\.$/);
  if (textError) return translate(locale, '{label} must be nonempty and no longer than {limit} characters.', { label: translate(locale, textError[1]), limit: textError[2] });
  const numberError = message.match(/^(.*?) must be between ([\d.]+) and ([\d.]+)\.$/);
  if (numberError) return translate(locale, '{label} must be between {min} and {max}.', { label: translate(locale, numberError[1]), min: new Intl.NumberFormat('zh-CN').format(Number(numberError[2])), max: new Intl.NumberFormat('zh-CN').format(Number(numberError[3])) });
  // Browser-specific JSON and file-reading errors must not expose English parser diagnostics in a Chinese interface.
  return translate(locale, 'This file is not a valid journal backup.');
}
function buildI18n(locale: Locale) {
  const t = (source: string, values?: Values) => translate(locale, source, values);
  const number = (value: number, decimals = 0) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale, { maximumFractionDigits: decimals }).format(value);
  const prettyDate = (date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) => new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : locale, options).format(new Date(`${date}T12:00:00`));
  return {
    locale, t, number, prettyDate, dateLabel: (date: string) => prettyDate(date, { month: 'short', day: 'numeric' }),
    kindNames: { weight: t('Weight'), meal: t('Meal'), exercise: t('Exercise'), note: t('Note') },
    mealName: (value: MealType) => t(value), intensityName: (value: Intensity) => t(value),
    errorText: (message: string) => errorTranslation(locale, message),
    localizeDemo: (entries: HealthEntry[]): HealthEntry[] => locale === 'en' ? entries : entries.map(entry => {
      if (entry.kind === 'meal') return { ...entry, title: sampleChinese[entry.title] ?? entry.title };
      if (entry.kind === 'exercise') return { ...entry, activity: sampleChinese[entry.activity] ?? entry.activity };
      if (entry.kind === 'note') return { ...entry, text: sampleChinese[entry.text] ?? entry.text };
      return entry;
    }),
  };
}
export type I18n = ReturnType<typeof buildI18n>;
type I18nContext = I18n & { setLocale: (value: Locale) => void; preferenceError: boolean };
const context = createContext<I18nContext | null>(null);
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const [preferenceError, setPreferenceError] = useState(false);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'zh-CN' ? 'Daywell · 个人健康日志' : 'Daywell — Your personal wellness journal';
  }, [locale]);
  const value = useMemo<I18nContext>(() => ({ ...buildI18n(locale), preferenceError, setLocale: (next: Locale) => {
    if (next !== 'zh-CN' && next !== 'en') return;
    updateLocale(next);
    try { localStorage.setItem(LANGUAGE_KEY, next); setPreferenceError(false); }
    catch { setPreferenceError(true); }
  } }), [locale, preferenceError]);
  return <context.Provider value={value}>{children}</context.Provider>;
}
export function useI18n(): I18nContext {
  const value = useContext(context);
  if (!value) throw new Error('useI18n must be used inside I18nProvider.');
  return value;
}
