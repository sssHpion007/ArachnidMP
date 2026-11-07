import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Gamepad2, Layers } from 'lucide-react';

const colorOptions = [
  { name: 'Морская волна', value: '#58a790' },
  { name: 'Игры', value: '#7775f2' },
  { name: 'Янтарный', value: '#e9a33a' },
  { name: 'Розовый', value: '#e66b91' },
];

const MiniGroupCardPreview: React.FC = () => {
  const [accent, setAccent] = useState(colorOptions[0].value);

  return (
    <main className="demo">
      <section className="preview" aria-labelledby="preview-title">
        <div className="eyebrow">Arachnid · мини-плеер</div>
        <h1 id="preview-title">Карточки групп</h1>
        <p className="description">
          Цвет группы приглушён и заполняет фон карточки, а значок окрашен исходным акцентом — без отдельной подложки.
        </p>
        <div className="mini-grid">
          <article className="group-card" style={{ '--accent': accent } as React.CSSProperties}>
            <Layers className="group-icon" strokeWidth={2.1} aria-hidden="true" />
            <div className="group-copy">
              <div className="group-name">Основное</div>
              <div className="group-count">1 элемент</div>
            </div>
          </article>
          <article className="group-card" style={{ '--accent': '#7775f2' } as React.CSSProperties}>
            <Gamepad2 className="group-icon" strokeWidth={2.1} aria-hidden="true" />
            <div className="group-copy">
              <div className="group-name">Игры</div>
              <div className="group-count">9 элементов</div>
            </div>
          </article>
        </div>
        <div className="palette" aria-label="Выбрать цвет примера">
          {colorOptions.map(option => (
            <button
              key={option.value}
              type="button"
              className="color-choice"
              style={{ backgroundColor: option.value }}
              aria-label={option.name}
              aria-pressed={accent === option.value}
              title={option.name}
              onClick={() => setAccent(option.value)}
            />
          ))}
        </div>
        <p className="note">Нажмите на цвет, чтобы посмотреть, как тот же стиль работает с другим акцентом.</p>
      </section>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<MiniGroupCardPreview />);
