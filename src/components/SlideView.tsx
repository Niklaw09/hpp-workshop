import type { ReactNode } from 'react';
import { sectionFor } from '../content/slides';
import type { LiveState, Slide } from '../types';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { VideoDemo } from './VideoDemo';

interface Props {
  slide: Slide;
  /** 'screen' = TV/projector layout, 'phone' = audience card layout. */
  variant: 'screen' | 'phone';
  live?: LiveState;
  /** Rendered in the poll slide's answer area (voting buttons, results, or a prompt). */
  pollArea?: ReactNode;
  /** Rendered on the title slide (e.g. the join QR on the main screen). */
  titleExtra?: ReactNode;
  /** Called while someone drags a before/after slider (presenter devices mirror it to everyone). */
  onDemoChange?: (slideId: string, position: number) => void;
}

/** Renders any slide kind. Add new kinds here and in types.ts. */
export function SlideView({ slide, variant, live, pollArea, titleExtra, onDemoChange }: Props) {
  const section = sectionFor(slide);
  const eyebrow = section ? `Part ${section.number} · ${section.title}` : null;
  const cls = `slide slide--${variant} slide--${slide.kind}`;

  switch (slide.kind) {
    case 'title':
      return (
        <article className={cls}>
          <img className="slide__bg" src={slide.image.src} alt={slide.image.alt} />
          <div className="slide__title-panel">
            {eyebrow && <p className="slide__eyebrow">{eyebrow}</p>}
            <h1 className="slide__h1">{slide.title}</h1>
            {slide.subtitle && <p className="slide__sub">{slide.subtitle}</p>}
          </div>
          {titleExtra && <div className="slide__title-extra">{titleExtra}</div>}
        </article>
      );

    case 'bullets':
      return (
        <article className={cls}>
          <div className="slide__text">
            {eyebrow && <p className="slide__eyebrow">{eyebrow}</p>}
            <h2 className="slide__h2">{slide.title}</h2>
            <ul className="slide__bullets">
              {slide.bullets.map((b) => <li key={b}>{b}</li>)}
            </ul>
          </div>
          <div className="slide__photo"><img src={slide.image.src} alt={slide.image.alt} /></div>
        </article>
      );

    case 'poll':
      return (
        <article className={cls}>
          <div className="slide__text">
            {eyebrow && <p className="slide__eyebrow">{eyebrow}</p>}
            <h2 className="slide__h2">{slide.title}</h2>
            {variant === 'screen' && <p className="slide__question">{slide.poll.question}</p>}
          </div>
          <div className="slide__poll-area">{pollArea}</div>
        </article>
      );

    case 'beforeAfter': {
      const pos = live?.demo?.slideId === slide.id ? live.demo.position : undefined;
      return (
        <article className={cls}>
          <BeforeAfterSlider before={slide.before} after={slide.after} position={pos} interactive
            onChange={onDemoChange ? (p) => onDemoChange(slide.id, p) : undefined} />
          <div className="slide__chip">
            {eyebrow && <p className="slide__eyebrow">{eyebrow}</p>}
            <h2 className="slide__h2">{slide.title}</h2>
            {slide.caption && <p className="slide__caption">{slide.caption}</p>}
          </div>
        </article>
      );
    }

    case 'video':
      return (
        <article className={cls}>
          <div className="slide__text slide__text--top">
            {eyebrow && <p className="slide__eyebrow">{eyebrow}</p>}
            <h2 className="slide__h2">{slide.title}</h2>
            {slide.caption && <p className="slide__caption">{slide.caption}</p>}
          </div>
          <VideoDemo
            src={slide.video.src}
            poster={slide.video.poster}
            slideId={slide.id}
            command={variant === 'screen' ? live?.media : undefined}
            controls={variant === 'phone'}
          />
        </article>
      );
  }
}
