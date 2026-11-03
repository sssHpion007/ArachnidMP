import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, ChevronLeft, ChevronRight, Clock3, FolderOpen, GripVertical, Headphones, Plus, Radio, Settings2, X, type LucideIcon } from 'lucide-react';
import { getMainNavigationTabs, NavigationTabDefinition } from '../components/TopBar';
import { getTranslations } from '../i18n';
import '../index.css';

const allTabs = getMainNavigationTabs(getTranslations('ru'));
const initialOrder = ['tracks', 'playlists', 'albums', 'favorites'];

type OverflowDemoTab = { id: string; label: string; icon: LucideIcon };
const overflowDemoTabs: OverflowDemoTab[] = [
  ...allTabs,
  { id: 'folders-demo', label: 'Папки', icon: FolderOpen },
  { id: 'radio-demo', label: 'Радио', icon: Radio },
  { id: 'history-demo', label: 'История', icon: Clock3 },
  { id: 'podcasts-demo', label: 'Подкасты', icon: Headphones },
];

const OverflowNavigationPreview: React.FC = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const suppressNextClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeTabId, setActiveTabId] = useState(overflowDemoTabs[0].id);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateEdges = () => {
      setCanScrollLeft(viewport.scrollLeft > 2);
      setCanScrollRight(viewport.scrollLeft < viewport.scrollWidth - viewport.clientWidth - 2);
    };
    viewport.addEventListener('scroll', updateEdges, { passive: true });
    const resizeObserver = new ResizeObserver(updateEdges);
    resizeObserver.observe(viewport);
    updateEdges();
    return () => {
      viewport.removeEventListener('scroll', updateEdges);
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      const viewport = viewportRef.current;
      if (!drag || !viewport) return;
      const distance = event.clientX - drag.startX;
      if (Math.abs(distance) > 4) drag.moved = true;
      if (drag.moved) {
        setIsDragging(true);
        viewport.scrollLeft = drag.startScrollLeft - distance;
        event.preventDefault();
      }
    };
    const onMouseUp = () => {
      if (!dragRef.current) return;
      suppressNextClickRef.current = dragRef.current.moved;
      dragRef.current = null;
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const scrollByPage = (direction: -1 | 1) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({ left: direction * Math.max(160, viewport.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-md3-outline-variant/20 bg-md3-surface/45 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold">Обычный плеер · больше шести вкладок</div>
          <p className="mt-1 text-[11px] leading-relaxed text-md3-on-surface-variant">Демо показывает 6 стандартных вкладок и 4 дополнительных. Навигация прокручивается, не сжимая кнопки.</p>
        </div>
        <span className="rounded-full bg-md3-primary/10 px-2.5 py-1 text-[10px] font-semibold text-md3-primary">{overflowDemoTabs.length} вкладок</span>
      </div>

      <div className="flex h-11 min-w-0 overflow-hidden rounded-xl border border-md3-outline-variant/20 bg-md3-surface-container shadow-inner">
        <button
          type="button"
          title="Прокрутить влево"
          aria-label="Прокрутить вкладки влево"
          disabled={!canScrollLeft}
          onClick={() => scrollByPage(-1)}
          className="z-10 grid h-full w-7 shrink-0 place-items-center border-r border-md3-outline-variant/15 bg-md3-surface-container-high/80 text-md3-on-surface-variant transition-colors hover:bg-md3-primary/10 hover:text-md3-primary disabled:cursor-default disabled:opacity-25"
        ><ChevronLeft className="h-4 w-4" /></button>
        <div
          ref={viewportRef}
          onMouseDown={event => {
            if (event.button !== 0) return;
            dragRef.current = { startX: event.clientX, startScrollLeft: event.currentTarget.scrollLeft, moved: false };
            suppressNextClickRef.current = false;
            setIsDragging(false);
          }}
          onWheel={event => {
            const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
            if (delta === 0) return;
            event.preventDefault();
            event.currentTarget.scrollLeft += delta;
          }}
          onDragStart={event => event.preventDefault()}
          className={`flex min-w-0 flex-1 select-none items-center gap-1 overflow-x-auto px-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          {overflowDemoTabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={event => {
                  if (suppressNextClickRef.current) {
                    suppressNextClickRef.current = false;
                    event.preventDefault();
                    return;
                  }
                  setActiveTabId(tab.id);
                }}
                className={`flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-[11px] font-semibold transition-colors ${active ? 'bg-md3-primary text-md3-on-primary shadow-sm' : 'text-md3-on-surface-variant hover:bg-md3-surface-container-highest hover:text-md3-on-surface'}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          title="Прокрутить вправо"
          aria-label="Прокрутить вкладки вправо"
          disabled={!canScrollRight}
          onClick={() => scrollByPage(1)}
          className="z-10 grid h-full w-7 shrink-0 place-items-center border-l border-md3-outline-variant/15 bg-md3-surface-container-high/80 text-md3-on-surface-variant transition-colors hover:bg-md3-primary/10 hover:text-md3-primary disabled:cursor-default disabled:opacity-25"
        ><ChevronRight className="h-4 w-4" /></button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] text-md3-on-surface-variant/75">
        <span>Выбрано: <strong className="font-semibold text-md3-primary">{overflowDemoTabs.find(tab => tab.id === activeTabId)?.label}</strong></span>
        <span>Колесо мыши · зажмите ЛКМ и тяните · стрелки по краям</span>
      </div>
    </div>
  );
};

const NavigationTabsSettingsPreview: React.FC = () => {
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [activePreviewTab, setActivePreviewTab] = useState('tracks');
  const draggedTabIdRef = useRef<string | null>(null);
  const dragOrderRef = useRef<string[] | null>(null);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const visibleTabs = useMemo(
    () => order.map(id => allTabs.find(tab => tab.id === id)).filter((tab): tab is NavigationTabDefinition => Boolean(tab)),
    [order],
  );
  const availableTabs = allTabs.filter(tab => !order.includes(tab.id));

  const getReorderedTabOrder = (sourceId: string, targetId: string, afterTarget: boolean, baseOrder: string[]) => {
    if (sourceId === targetId) return null;
    const sourceIndex = baseOrder.indexOf(sourceId);
    const targetIndex = baseOrder.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return null;
    const next = [...baseOrder];
    const [movingId] = next.splice(sourceIndex, 1);
    let insertIndex = targetIndex + (afterTarget ? 1 : 0);
    if (sourceIndex < insertIndex) insertIndex -= 1;
    next.splice(insertIndex, 0, movingId);
    return next.every((id, index) => id === baseOrder[index]) ? null : next;
  };

  const startTabDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return;
    const tabElement = event.currentTarget.closest('[data-navigation-tab-id]') as HTMLElement | null;
    const listElement = event.currentTarget.closest('[data-navigation-tab-list]') as HTMLElement | null;
    const tabId = tabElement?.dataset.navigationTabId;
    if (!tabId || !listElement) return;
    event.preventDefault();
    event.stopPropagation();
    listElement.setPointerCapture(event.pointerId);
    draggedTabIdRef.current = tabId;
    dragOrderRef.current = [...order];
    setDraggedTabId(tabId);
  };

  const moveTabDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const sourceId = draggedTabIdRef.current;
    if (!sourceId) return;
    event.preventDefault();
    const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-navigation-tab-id]') as HTMLElement | null;
    const targetId = targetElement?.dataset.navigationTabId;
    if (!targetElement || !targetId || targetId === sourceId) {
      setDragOverTabId(null);
      return;
    }
    setDragOverTabId(targetId);
    const bounds = targetElement.getBoundingClientRect();
    const afterTarget = event.clientX >= bounds.left + bounds.width / 2;
    const nextOrder = getReorderedTabOrder(sourceId, targetId, afterTarget, dragOrderRef.current ?? order);
    if (nextOrder) {
      dragOrderRef.current = nextOrder;
      setOrder(nextOrder);
    }
  };

  const finishTabDrag = (event: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (commit && draggedTabIdRef.current && dragOrderRef.current) setOrder(dragOrderRef.current);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    draggedTabIdRef.current = null;
    dragOrderRef.current = null;
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  const removeTab = (tabId: string) => {
    if (order.length <= 1) return;
    const next = order.filter(id => id !== tabId);
    setOrder(next);
    if (activePreviewTab === tabId) setActivePreviewTab(next[0]);
  };

  const addTab = (tab: NavigationTabDefinition) => setOrder(current => [...current, tab.id]);

  const renderTabPills = (compact = false) => visibleTabs.map(tab => {
    const Icon = tab.icon;
    const active = activePreviewTab === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => setActivePreviewTab(tab.id)}
        className={`flex shrink-0 items-center gap-2 rounded-full transition-all ${compact ? 'px-3 py-2 text-[10px]' : 'px-3.5 py-2.5 text-xs'} ${active ? 'bg-md3-primary text-md3-on-primary shadow-sm' : 'bg-md3-surface-container-high text-md3-on-surface-variant hover:bg-md3-surface-container-highest hover:text-md3-on-surface'}`}
      >
        <Icon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        <span>{tab.label}</span>
      </button>
    );
  });

  return (
    <main className="min-h-screen bg-md3-background px-4 py-8 text-md3-on-background sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-md3-primary">ИНТЕРАКТИВНОЕ ПРЕВЬЮ · НАСТРОЙКИ</div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Порядок вкладок навигации</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-md3-on-surface-variant">
              Перетаскивайте вкладки для смены порядка, убирайте ненужные или добавляйте их обратно. Ниже показана прокрутка меню, если вкладок станет больше шести.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-md3-outline-variant/20 bg-md3-surface-container px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.65)]" />
            LIVE DEMO
          </div>
        </header>

        <section className="overflow-hidden rounded-3xl border border-md3-outline-variant/25 bg-md3-surface-container shadow-2xl">
          <div className="flex items-center justify-between border-b border-md3-outline-variant/20 bg-md3-surface/50 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-md3-primary/10 text-md3-primary"><Settings2 className="h-5 w-5" /></div>
              <div>
                <div className="text-sm font-bold">Настройки</div>
                <div className="text-[11px] text-md3-on-surface-variant">Навигация и интерфейс</div>
              </div>
            </div>
            <button type="button" className="rounded-full p-2 text-md3-on-surface-variant transition-colors hover:bg-md3-surface-container-high hover:text-md3-on-surface" aria-label="Закрыть превью">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-7 p-5 sm:p-7">
            <section className="space-y-3 border-b border-md3-outline-variant/15 pb-6">
              <div className="flex items-center gap-2 text-sm font-bold"><span className="h-4 w-1 rounded-full bg-md3-primary" /> Вкладки навигации</div>
              <p className="text-xs leading-relaxed text-md3-on-surface-variant">Добавляйте вкладки из списка, убирайте ненужные и меняйте порядок. В панели должна остаться хотя бы одна вкладка.</p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-md3-on-surface-variant">Показываются в панели</div>
                    <span className="text-[10px] tabular-nums text-md3-on-surface-variant/70">{visibleTabs.length}</span>
                  </div>
                  <div
                    data-navigation-tab-list
                    onPointerMove={moveTabDrag}
                    onPointerUp={event => finishTabDrag(event, true)}
                    onPointerCancel={event => finishTabDrag(event, false)}
                    className="flex flex-wrap gap-1.5 rounded-2xl border border-md3-outline-variant/20 bg-md3-surface/40 p-2"
                  >
                    {visibleTabs.map(tab => {
                      const Icon = tab.icon;
                      return (
                        <div
                          key={tab.id}
                          draggable={false}
                          data-navigation-tab-id={tab.id}
                          onPointerDown={startTabDrag}
                          className={`flex max-w-full items-center gap-1 rounded-full border bg-md3-surface py-1 pl-2 pr-1 transition-all ${draggedTabId === tab.id ? 'opacity-40' : ''} ${dragOverTabId === tab.id ? 'border-md3-primary/50 bg-md3-primary/5 ring-1 ring-md3-primary/20' : 'border-md3-outline-variant/15 hover:border-md3-outline-variant/30'} ${visibleTabs.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        >
                          <GripVertical className="h-3 w-3 shrink-0 select-none text-md3-on-surface-variant/60" />
                          <Icon className="h-3.5 w-3.5 shrink-0 text-md3-primary" />
                          <span className="max-w-32 truncate text-[11px] font-semibold">{tab.label}</span>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button type="button" title="Убрать вкладку" aria-label={`Убрать ${tab.label}`} disabled={visibleTabs.length <= 1} onClick={() => removeTab(tab.id)} className="rounded-md p-0.5 text-md3-on-surface-variant transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"><X className="h-3 w-3" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="px-1 text-[10px] font-extrabold uppercase tracking-wider text-md3-on-surface-variant">Можно добавить</div>
                  {availableTabs.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {availableTabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                          <button key={tab.id} type="button" onClick={() => addTab(tab)} className="flex max-w-full items-center gap-1.5 rounded-full border border-md3-outline-variant/15 bg-md3-surface/50 px-2.5 py-1.5 text-left text-md3-on-surface-variant transition-all hover:border-md3-primary/30 hover:bg-md3-primary/5 hover:text-md3-on-surface">
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate text-[11px] font-medium">{tab.label}</span>
                            <Plus className="h-3.5 w-3.5 shrink-0 text-md3-primary" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/5 p-2 text-[11px] text-emerald-300"><Check className="h-3.5 w-3.5" /> Все доступные вкладки уже добавлены.</div>
                  )}
                </div>
                <p className="px-1 text-[10px] leading-relaxed text-md3-on-surface-variant/70">Минимум одна вкладка остаётся в панели. Изменения применяются сразу.</p>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold">Предпросмотр навигации</div>
                  <div className="mt-1 text-[11px] text-md3-on-surface-variant">Нажмите на вкладки — выбранная подсветится.</div>
                </div>
                <span className="rounded-full bg-md3-primary/10 px-2.5 py-1 text-[10px] font-semibold text-md3-primary">{visibleTabs.length} из {allTabs.length} вкладок</span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="min-w-0 rounded-2xl border border-md3-outline-variant/15 bg-md3-surface p-4">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant">Обычное окно</div>
                  <nav className="flex min-w-0 gap-1 overflow-x-auto rounded-2xl border border-md3-outline-variant/15 bg-md3-surface-container p-1.5">
                    {renderTabPills()}
                  </nav>
                </div>
                <div className="min-w-0 rounded-2xl border border-md3-outline-variant/15 bg-md3-surface p-4">
                  <div className="mb-3 text-[10px] font-bold uppercase tracking-wider text-md3-on-surface-variant">Мини-плеер · библиотека</div>
                  <nav className="flex min-w-0 gap-1 overflow-x-auto rounded-full border border-md3-outline-variant/15 bg-md3-surface-container p-1">
                    {renderTabPills(true)}
                  </nav>
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-md3-surface-container-low px-3 py-2.5 text-[10px]">
                    <span className="text-md3-on-surface-variant">Открыта вкладка</span>
                    <span className="font-semibold text-md3-primary">{allTabs.find(tab => tab.id === activePreviewTab)?.label}</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-md3-outline-variant/15 pt-4">
                <OverflowNavigationPreview />
              </div>
            </section>
          </div>
        </section>
        <p className="mx-auto mt-5 max-w-3xl text-center text-[11px] leading-relaxed text-md3-on-surface-variant/70">Это интерактивный макет раздела настроек: порядок, добавление и скрытие вкладок можно проверить прямо здесь.</p>
      </div>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<NavigationTabsSettingsPreview />);
