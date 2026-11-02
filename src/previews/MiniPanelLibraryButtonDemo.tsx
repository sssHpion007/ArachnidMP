import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Library, ListMusic } from 'lucide-react';
import { MiniPanelLibraryButton } from '../components/MiniPanelLibraryButton';
import '../index.css';

type Panel = 'queue' | 'library';

const MiniPanelLibraryButtonDemo: React.FC = () => {
  const [activePanel, setActivePanel] = useState<Panel>('queue');
  const isLibraryActive = activePanel === 'library';

  return (
    <main className="mini-nav-demo">
      <header className="mini-nav-heading">
        <div>
          <span className="mini-nav-eyebrow">ИНТЕРАКТИВНОЕ ПРЕВЬЮ</span>
          <h1>Состояние кнопки «Библиотека»</h1>
          <p>Нажмите «Очередь» или «Библиотека» — подсветка должна совпадать с открытой панелью.</p>
        </div>
        <span className="mini-nav-live"><i /> LIVE</span>
      </header>

      <section className="mini-nav-frame" aria-label="Пример панели мини-плеера">
        <div className="mini-nav-player">
          <div className="mini-nav-art"><span>♪</span></div>
          <div className="mini-nav-track"><strong>Midnight Signals</strong><span>Demo Artist</span></div>
          <div className="mini-nav-controls"><span>‹</span><b>Ⅱ</b><span>›</span></div>
          <button
            type="button"
            className={`mini-nav-panel-toggle ${activePanel === 'queue' ? 'is-active' : ''}`}
            aria-pressed={activePanel === 'queue'}
            onClick={() => setActivePanel('queue')}
          ><ListMusic size={15} /> Очередь <small>12</small></button>
        </div>

        <div className="mini-nav-panel">
          <header className="mini-nav-panel-header">
            <MiniPanelLibraryButton
              language="ru"
              className="mini-nav-library-button"
              isActive={isLibraryActive}
              onClick={() => setActivePanel('library')}
            />
            {activePanel === 'queue' ? (
              <>
                <span className="mini-nav-spacer" />
                <span className="mini-nav-count">12 треков</span>
                <button className="mini-nav-icon-button" aria-label="Очередь активна"><ListMusic size={15} /></button>
              </>
            ) : (
              <>
                <span className="mini-nav-current">Медиатека</span>
                <button className="mini-nav-icon-button is-active" aria-label="Библиотека открыта"><Library size={15} /></button>
              </>
            )}
          </header>
          <div className="mini-nav-content">
            <span className="mini-nav-eyebrow">{isLibraryActive ? 'ОТКРЫТА БИБЛИОТЕКА' : 'ОТКРЫТА ОЧЕРЕДЬ'}</span>
            <h2>{isLibraryActive ? 'Треки и коллекции' : 'Следующие треки'}</h2>
            <div className="mini-nav-row"><span className="mini-nav-row-art" />{isLibraryActive ? 'Midnight Signals' : 'Soft Focus'}</div>
            <div className="mini-nav-row"><span className="mini-nav-row-art alt" />{isLibraryActive ? 'Blue Hour' : 'Late Train Home'}</div>
          </div>
        </div>
      </section>

      <p className="mini-nav-note">В приложении используется тот же компонент кнопки, что и здесь. Неактивная библиотека нейтральная; активная получает заливку и основной цвет.</p>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<MiniPanelLibraryButtonDemo />);
