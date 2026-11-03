import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, Disc3, Play, Sun, Moon, Sparkles } from 'lucide-react';
import { getThemedPlayIconColor } from '../theme/playIconColor';
import '../index.css';

type PreviewTheme = 'dark' | 'amoled' | 'light';

const presets = [
  { name: 'Жжёный оранжевый', color: '#C04200' },
  { name: 'Кобальт', color: '#0759D4' },
  { name: 'Изумруд', color: '#16864A' },
  { name: 'Золото', color: '#D7B900' },
  { name: 'Фиолетовый', color: '#7B2CBF' },
  { name: 'Бирюза', color: '#13AFC2' },
];

const normalizeHex = (value: string): string | null => {
  const trimmed = value.trim();
  if (/^#[\da-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[\da-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split('').map(char => char + char).join('').toUpperCase()}`;
  }
  return null;
};

const PlayIconColorPreview: React.FC = () => {
  const [theme, setTheme] = useState<PreviewTheme>('dark');
  const [hexInput, setHexInput] = useState('#C04200');
  const selectedColor = normalizeHex(hexInput) ?? '#C04200';
  const darkTheme = theme !== 'light';
  const iconColor = useMemo(
    () => getThemedPlayIconColor(selectedColor, darkTheme) ?? '#ffffff',
    [selectedColor, darkTheme]
  );

  const themeClasses = theme === 'light'
    ? 'bg-[#f2f0f6] text-[#24222b]'
    : theme === 'amoled'
      ? 'bg-black text-[#f3eff7]'
      : 'bg-[#111116] text-[#f3eff7]';
  const panelClasses = theme === 'light'
    ? 'border-black/10 bg-white'
    : theme === 'amoled'
      ? 'border-white/10 bg-[#09090c]'
      : 'border-white/10 bg-[#1b1a20]';
  const mutedText = theme === 'light' ? 'text-[#686570]' : 'text-[#aaa6b2]';
  const accentText = theme === 'light' ? 'text-[#633a9e]' : 'text-[#c9afff]';
  const dividerBorder = theme === 'light' ? 'border-black/10' : 'border-white/10';

  return (
    <main className={`min-h-screen px-4 py-8 transition-colors duration-300 sm:px-8 sm:py-12 ${themeClasses}`}>
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className={`mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] ${accentText}`}>
              <Sparkles className="h-3.5 w-3.5" /> Live UI preview
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Оттенок значка Play</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${mutedText}`}>
              Меняйте тему и цвет карточки. Значок использует ту же функцию, что и кнопка быстрого воспроизведения в сетке.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${theme === 'light' ? 'border-black/10 bg-white/70' : 'border-white/10 bg-white/5'}`}>
            {theme === 'light' ? 'Светлая тема' : theme === 'amoled' ? 'AMOLED' : 'Тёмная тема'}
          </span>
        </header>

        <section className={`mb-5 rounded-3xl border p-4 shadow-xl sm:p-6 ${panelClasses}`}>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <div className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Тема оформления</div>
              <div className={`inline-flex rounded-2xl border p-1 ${theme === 'light' ? 'border-black/10 bg-black/5' : 'border-white/10 bg-black/20'}`}>
                {([
                  { id: 'dark', label: 'Тёмная', Icon: Moon },
                  { id: 'amoled', label: 'OLED', Icon: Sparkles },
                  { id: 'light', label: 'Светлая', Icon: Sun },
                ] as const).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTheme(id)}
                    aria-pressed={theme === id}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${theme === id ? 'bg-md3-primary text-md3-on-primary shadow-sm' : `${mutedText} hover:text-current`}`}
                  ><Icon className="h-3.5 w-3.5" />{label}</button>
                ))}
              </div>
              <p className={`mt-2 text-[11px] ${mutedText}`}>Тёмная и OLED темы используют один и тот же тёмный оттенок значка.</p>
            </div>

            <div>
              <label htmlFor="accent-hex" className={`mb-2 block text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Цвет карточки</label>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="color"
                  aria-label="Выбрать цвет карточки"
                  value={selectedColor}
                  onChange={event => setHexInput(event.target.value.toUpperCase())}
                  className={`h-10 w-12 cursor-pointer rounded-xl border p-1 ${theme === 'light' ? 'border-black/10 bg-white' : 'border-white/10 bg-black/20'}`}
                />
                <input
                  id="accent-hex"
                  type="text"
                  spellCheck={false}
                  value={hexInput}
                  onChange={event => setHexInput(event.target.value)}
                  onBlur={() => {
                    const normalized = normalizeHex(hexInput);
                    if (normalized) setHexInput(normalized);
                  }}
                  placeholder="#C04200"
                  className={`w-32 rounded-xl border px-3 py-2.5 font-mono text-sm font-bold outline-none focus:border-md3-primary ${theme === 'light' ? 'border-black/10 bg-black/[0.03]' : 'border-white/10 bg-black/20'}`}
                />
                <div className="flex items-center gap-2 rounded-xl border border-md3-primary/20 bg-md3-primary/5 px-3 py-2">
                  <span className="h-5 w-5 rounded-full" style={{ backgroundColor: selectedColor }} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${accentText}`}>Фон кнопки</span>
                </div>
              </div>
              {!normalizeHex(hexInput) && <p className="mt-1.5 text-[11px] text-rose-400">Введите HEX в формате #RGB или #RRGGBB.</p>}
            </div>
          </div>

          <div className={`mt-5 border-t pt-4 ${dividerBorder}`}>
            <div className={`mb-2 text-[10px] font-bold uppercase tracking-widest ${mutedText}`}>Быстрые цвета для проверки</div>
            <div className="flex flex-wrap gap-2">
              {presets.map(preset => (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => setHexInput(preset.color)}
                  title={`${preset.name} ${preset.color}`}
                  aria-label={`Выбрать ${preset.name}, ${preset.color}`}
                  className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition-all ${selectedColor === preset.color ? 'border-md3-primary/60 bg-md3-primary/10' : theme === 'light' ? 'border-black/10 hover:bg-black/5' : 'border-white/10 hover:bg-white/5'}`}
                >
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: preset.color }} />
                  {preset.name}
                  {selectedColor === preset.color && <Check className={`h-3 w-3 ${accentText}`} />}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <article className={`overflow-hidden rounded-3xl border shadow-xl ${panelClasses}`}>
            <div className="relative h-56 overflow-hidden sm:h-72" style={{ background: `linear-gradient(135deg, ${selectedColor} 0%, #180d18 60%, #09090c 100%)` }}>
              <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(circle at 25% 30%, ${selectedColor}, transparent 55%)` }} />
              <div className="absolute left-5 top-5 grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-black/20 text-white/90 backdrop-blur-sm"><Disc3 className="h-7 w-7" /></div>
              <button
                type="button"
                aria-label="Воспроизвести плейлист"
                title="Круглая кнопка воспроизведения карточки"
                style={{ backgroundColor: selectedColor, color: iconColor }}
                className="absolute bottom-5 right-5 grid h-14 w-14 place-items-center rounded-full shadow-2xl transition-transform hover:scale-110 active:scale-95"
              ><Play className="ml-1 h-6 w-6 fill-current" /></button>
              <div className="absolute bottom-5 left-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Плейлист · пример карточки</div>
                <div className="mt-1 text-xl font-extrabold text-white">Оранжевый закат</div>
                <div className="mt-1 text-xs text-white/70">24 трека · кнопка Play справа</div>
              </div>
            </div>
            <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${theme === 'light' ? 'bg-white' : theme === 'amoled' ? 'bg-[#09090c]' : 'bg-[#1b1a20]'}`}>
              <div>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedText}`}>Текущий результат</div>
                <div className="mt-1 font-mono text-sm font-bold">{iconColor.toUpperCase()}</div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="h-7 w-7 rounded-full ring-1 ring-black/10" style={{ backgroundColor: selectedColor }} title={`Фон ${selectedColor}`} />
                <span className={`text-lg ${mutedText}`}>→</span>
                <span className="h-7 w-7 rounded-full ring-1 ring-black/10" style={{ backgroundColor: iconColor }} title={`Значок ${iconColor}`} />
                <span className={`text-[10px] font-semibold ${mutedText}`}>фон → Play</span>
              </div>
            </div>
          </article>

          <aside className={`rounded-3xl border p-5 shadow-xl sm:p-6 ${panelClasses}`}>
            <h2 className="text-sm font-bold">Проверьте разные оттенки</h2>
            <p className={`mt-1 text-xs leading-relaxed ${mutedText}`}>В каждой строке — фон и вычисленный цвет значка в выбранной теме.</p>
            <div className="mt-4 space-y-2.5">
              {presets.map(preset => {
                const glyphColor = getThemedPlayIconColor(preset.color, darkTheme) ?? '#ffffff';
                const active = selectedColor === preset.color;
                return (
                  <button
                    key={preset.color}
                    type="button"
                    onClick={() => setHexInput(preset.color)}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-all ${active ? 'border-md3-primary/50 bg-md3-primary/5' : theme === 'light' ? 'border-black/5 hover:bg-black/[0.03]' : 'border-white/5 hover:bg-white/[0.03]'}`}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full shadow-md" style={{ backgroundColor: preset.color, color: glyphColor }}><Play className="ml-0.5 h-4 w-4 fill-current" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{preset.name}</span>
                      <span className={`mt-0.5 block font-mono text-[10px] ${mutedText}`}>{preset.color} <span className="px-1">→</span> {glyphColor.toUpperCase()}</span>
                    </span>
                    {active && <Check className={`mr-1 h-4 w-4 shrink-0 ${accentText}`} />}
                  </button>
                );
              })}
            </div>
            <p className={`mt-4 border-t pt-3 text-[10px] leading-relaxed ${dividerBorder} ${mutedText}`}>
              Цвет Play сохраняет тон карточки: затемнённый в тёмной/OLED-теме и осветлённый в светлой. Введите HEX или выберите цветовую точку, чтобы проверить свой оттенок.
            </p>
          </aside>
        </section>
      </div>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<PlayIconColorPreview />);
