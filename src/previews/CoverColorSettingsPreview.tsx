import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, Folder, ListMusic, Pipette, Settings2, Sparkles } from 'lucide-react';
import '../index.css';

const palette = [
  { name: 'По умолчанию', color: '#a855f7' },
  { name: 'Янтарный', color: '#f59e0b' },
  { name: 'Изумрудный', color: '#10b981' },
  { name: 'Индиго', color: '#6366f1' },
  { name: 'Пурпурный', color: '#a855f7' },
  { name: 'Розовый', color: '#f43f5e' },
  { name: 'Бирюзовый', color: '#06b6d4' },
];

const ColorAccentPreview: React.FC = () => {
  const [selected, setSelected] = useState<Record<string, string>>({ folder: '#a855f7', playlist: '#06b6d4' });

  return (
    <main className="min-h-screen bg-md3-background px-4 py-10 text-md3-on-background sm:px-8 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-md3-primary">ИНТЕРАКТИВНОЕ ПРЕВЬЮ · ЦВЕТОВОЙ АКЦЕНТ</div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Настройки папок и плейлистов</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-md3-on-surface-variant">Показано состояние после удаления широкой кнопки «Цвет по обложке».</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-md3-outline-variant/20 bg-md3-surface-container px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.65)]" /> LIVE PREVIEW
          </span>
        </header>

        <section className="overflow-hidden rounded-3xl border border-md3-outline-variant/25 bg-md3-surface-container shadow-2xl">
          <div className="flex items-center gap-3 border-b border-md3-outline-variant/20 bg-md3-surface/50 px-5 py-4 sm:px-7">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-md3-primary/10 text-md3-primary"><Settings2 className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-bold">Настройки</div>
              <div className="text-[11px] text-md3-on-surface-variant">Цветовые акценты элементов библиотеки</div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
            {[
              { id: 'folder', label: 'Папка', name: 'Рок-классика', icon: Folder },
              { id: 'playlist', label: 'Плейлист', name: 'Вечерний чилл', icon: ListMusic },
            ].map(item => {
              const Icon = item.icon;
              return (
                <article key={item.id} className="rounded-2xl border border-md3-outline-variant/20 bg-md3-surface p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-md3-primary/10 text-md3-primary"><Icon className="h-4 w-4" /></div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant">{item.label}</div>
                      <div className="text-sm font-semibold text-md3-on-surface">{item.name}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-md3-outline-variant/15 bg-md3-surface-container-low p-3.5">
                    <div className="mb-2.5 text-xs font-semibold text-md3-on-surface-variant">Цветовой акцент</div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      {palette.map(color => (
                        <button
                          key={color.name}
                          type="button"
                          title={color.name}
                          onClick={() => setSelected(current => ({ ...current, [item.id]: color.color }))}
                          className={`grid h-7 w-7 place-items-center rounded-full ring-offset-2 ring-offset-md3-surface-container-low transition-transform hover:scale-110 ${selected[item.id] === color.color ? 'scale-110 ring-2 ring-md3-primary' : ''}`}
                          style={{ backgroundColor: color.color }}
                        >
                          {selected[item.id] === color.color && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                        </button>
                      ))}
                      <button
                        type="button"
                        title="Цвет из обложки"
                        onClick={() => setSelected(current => ({ ...current, [item.id]: '#dc725b' }))}
                        className={`grid h-7 w-7 place-items-center rounded-full shadow-sm ring-offset-2 ring-offset-md3-surface-container-low transition-transform hover:scale-110 ${selected[item.id] === '#dc725b' ? 'scale-110 ring-2 ring-md3-primary' : ''}`}
                        style={{ backgroundColor: '#dc725b' }}
                      ><Sparkles className="h-3.5 w-3.5 text-white drop-shadow" /></button>
                      <button
                        type="button"
                        title="Взять из обложки"
                        aria-label="Взять из обложки"
                        onClick={() => setSelected(current => ({ ...current, [item.id]: '#dc725b' }))}
                        className="grid h-7 w-7 place-items-center rounded-full border border-md3-outline-variant/25 bg-md3-surface text-md3-on-surface-variant transition-colors hover:border-md3-primary/50 hover:bg-md3-primary/5 hover:text-md3-primary"
                      ><Pipette className="h-3.5 w-3.5" /></button>
                      <button
                        type="button"
                        title="Свой цвет"
                        onClick={() => setSelected(current => ({ ...current, [item.id]: '#6366f1' }))}
                        className="grid h-7 w-7 place-items-center rounded-full border border-md3-outline-variant/20 bg-md3-surface-container-high text-[9px] font-bold text-md3-on-surface-variant hover:text-md3-primary"
                      >HEX</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mx-5 mb-5 flex items-start gap-3 rounded-2xl border border-md3-primary/20 bg-md3-primary/5 p-4 sm:mx-7 sm:mb-7">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-md3-primary/10 text-md3-primary"><Check className="h-4 w-4" /></div>
            <div>
              <div className="text-xs font-bold text-md3-on-surface">Что изменено</div>
              <p className="mt-1 text-[11px] leading-relaxed text-md3-on-surface-variant">Удалена широкая кнопка «Цвет по обложке» над палитрой. Цветные образцы остались, а точный оттенок с обложки можно взять значком пипетки справа от них — наведите на него курсор, чтобы увидеть подсказку.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<ColorAccentPreview />);
