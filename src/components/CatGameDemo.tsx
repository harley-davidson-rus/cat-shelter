import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Heart, MousePointer2, Sparkles } from 'lucide-react';

type Pose = 'idle' | 'petted' | 'playful';

const POSE_IMAGES: Record<Pose, string> = {
  idle: '/game/mramorka-idle.png',
  petted: '/game/mramorka-petted.png',
  playful: '/game/mramorka-playful.png',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function CatGameDemo() {
  const stageRef = useRef<HTMLDivElement>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [pose, setPose] = useState<Pose>('idle');
  const [affection, setAffection] = useState(36);
  const [toyMode, setToyMode] = useState(false);
  const [toyPosition, setToyPosition] = useState({ x: 70, y: 28 });
  const [message, setMessage] = useState('Мраморка присматривается к вам…');
  const [heartBurst, setHeartBurst] = useState(0);

  useEffect(() => {
    document.title = 'Поиграть с Мраморкой — Доброта для кота';
  }, []);

  useEffect(() => () => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
  }, []);

  const scheduleIdle = (delay = 1800) => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      if (!toyMode) {
        setPose('idle');
        setMessage('Мраморка спокойно устроилась рядом.');
      }
    }, delay);
  };

  const petMramorka = () => {
    setToyMode(false);
    setPose('petted');
    setAffection((value) => clamp(value + 8, 0, 100));
    setMessage('М-р-р-р… Мраморке нравится!');
    setHeartBurst((value) => value + 1);
    navigator.vibrate?.(20);
    scheduleIdle(2200);
  };

  const toggleToy = () => {
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    setToyMode((enabled) => {
      const next = !enabled;
      setPose(next ? 'playful' : 'idle');
      setMessage(next ? 'Водите бантиком по комнате — Мраморка следит за ним.' : 'Мраморка немного отдохнёт.');
      if (next) setAffection((value) => clamp(value + 3, 0, 100));
      return next;
    });
  };

  const callMramorka = () => {
    setToyMode(false);
    setPose('idle');
    setAffection((value) => clamp(value + 2, 0, 100));
    setMessage('Мраморка услышала вас и внимательно смотрит.');
    scheduleIdle(2100);
  };

  const moveToy = (clientX: number, clientY: number) => {
    if (!toyMode || !stageRef.current) return;
    const bounds = stageRef.current.getBoundingClientRect();
    const x = clamp(((clientX - bounds.left) / bounds.width) * 100, 8, 92);
    const y = clamp(((clientY - bounds.top) / bounds.height) * 100, 10, 72);
    setToyPosition({ x, y });
    setPose('playful');
  };

  return (
    <main className="cat-game-page min-h-screen overflow-x-hidden bg-[#fffaf1] text-stone-900">
      <style>{`
        @keyframes cat-breathe { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-5px) scale(1.008); } }
        @keyframes cat-ready { 0%, 100% { transform: translate(-2px, 0) rotate(-0.4deg); } 50% { transform: translate(4px, -7px) rotate(0.6deg); } }
        @keyframes ribbon-sway { 0%, 100% { transform: rotate(-13deg); } 50% { transform: rotate(16deg); } }
        @keyframes heart-float { 0% { opacity: 0; transform: translateY(6px) scale(.45); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(-92px) translateX(var(--heart-x)) scale(1.15); } }
        .cat-game-character { animation: cat-breathe 3.6s ease-in-out infinite; }
        .cat-game-character[data-pose="playful"] { animation: cat-ready 1.15s ease-in-out infinite; }
        .cat-game-ribbon { animation: ribbon-sway .75s ease-in-out infinite; transform-origin: top center; }
        .cat-game-heart { animation: heart-float 1.55s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) { .cat-game-character, .cat-game-ribbon, .cat-game-heart { animation: none; } }
      `}</style>

      <header className="border-b border-amber-100 bg-white/90 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-4 sm:px-6">
          <a href="/" className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-bold text-stone-700 transition hover:bg-amber-50 sm:px-3">
            <ArrowLeft className="h-4 w-4" />
            Вернуться на сайт
          </a>
          <div className="min-w-0 text-right">
            <p className="truncate font-heading text-base font-black sm:text-lg">Мраморка рядом</p>
            <p className="hidden text-xs text-stone-500 sm:block">экспериментальная игровая комната</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-800">
              <Sparkles className="h-3.5 w-3.5" /> Ласковый темперамент
            </div>
            <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">Познакомьтесь<br className="sm:hidden" /> с Мраморкой</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
              Погладьте её или предложите поиграть. Чем больше внимания, тем быстрее растёт доверие.
            </p>
          </div>
          <div className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm sm:w-auto sm:min-w-56">
            <div className="mb-2 flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5"><Heart className="h-4 w-4 fill-rose-500 text-rose-500" /> Доверие</span>
              <span>{affection}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500 transition-all duration-500" style={{ width: `${affection}%` }} />
            </div>
          </div>
        </div>

        <div
          ref={stageRef}
          className={`relative isolate min-h-[500px] overflow-hidden rounded-[2rem] border border-amber-200 bg-gradient-to-b from-[#fff8e7] via-[#fffdf8] to-[#ead8bd] shadow-xl shadow-amber-900/10 sm:min-h-[590px] ${toyMode ? 'cursor-none' : ''}`}
          onPointerMove={(event) => moveToy(event.clientX, event.clientY)}
          onPointerDown={(event) => moveToy(event.clientX, event.clientY)}
        >
          <div className="absolute left-[7%] top-[8%] h-44 w-36 overflow-hidden rounded-t-[4rem] border-[10px] border-white bg-gradient-to-b from-sky-200 to-sky-50 shadow-lg sm:h-56 sm:w-48">
            <div className="absolute inset-x-0 top-1/2 h-2 bg-white" />
            <div className="absolute inset-y-0 left-1/2 w-2 bg-white" />
            <div className="absolute right-4 top-5 h-12 w-12 rounded-full bg-amber-200/80 blur-sm" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[27%] bg-[#d6b98e]" />
          <div className="absolute bottom-[7%] left-1/2 h-[24%] w-[76%] -translate-x-1/2 rounded-[50%] bg-amber-100/90 shadow-inner ring-8 ring-white/50 sm:w-[62%]" />
          <div className="absolute right-[5%] top-[8%] max-w-[72%] rounded-2xl border border-amber-200/70 bg-white/80 px-3 py-2 text-xs font-semibold leading-5 text-stone-700 shadow-sm backdrop-blur sm:right-[7%] sm:top-[11%] sm:max-w-none sm:px-4 sm:py-3 sm:text-sm">
            {message}
          </div>

          <button
            type="button"
            aria-label="Погладить Мраморку"
            className="absolute bottom-[9%] left-1/2 z-20 w-[min(86%,620px)] -translate-x-1/2 cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:rounded-full focus-visible:ring-4 focus-visible:ring-amber-400/70"
            onClick={petMramorka}
          >
            <img
              key={pose}
              src={POSE_IMAGES[pose]}
              alt="Анимированная Мраморка"
              draggable={false}
              data-pose={pose}
              className="cat-game-character mx-auto block max-h-[385px] w-full object-contain drop-shadow-[0_24px_18px_rgba(67,38,17,0.25)] transition-all duration-300 sm:max-h-[455px]"
            />
            {pose === 'petted' && (
              <span key={heartBurst} aria-hidden="true" className="absolute left-1/2 top-[24%]">
                {[-42, -12, 24, 52].map((offset, index) => (
                  <Heart
                    key={`${heartBurst}-${offset}`}
                    className="cat-game-heart absolute h-7 w-7 fill-rose-500 text-rose-500"
                    style={{ left: offset, animationDelay: `${index * 90}ms`, ['--heart-x' as string]: `${offset / 2}px` }}
                  />
                ))}
              </span>
            )}
          </button>

          {toyMode && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-3 transition-[left,top] duration-100 ease-out"
              style={{ left: `${toyPosition.x}%`, top: `${toyPosition.y}%` }}
            >
              <div className="h-24 w-px bg-stone-500/70" />
              <div className="cat-game-ribbon -ml-5 -mt-1 flex items-center">
                <span className="h-7 w-7 rounded-full rounded-r-sm bg-rose-500 shadow-md" />
                <span className="-ml-1 h-7 w-7 rounded-full rounded-l-sm bg-amber-400 shadow-md" />
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap justify-center gap-2 sm:bottom-6 sm:gap-3">
            <button type="button" onClick={petMramorka} className="rounded-xl bg-white px-3 py-2.5 text-xs font-extrabold shadow-lg ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:bg-rose-50 sm:px-4 sm:py-3 sm:text-sm">
              🤍 Погладить
            </button>
            <button type="button" onClick={toggleToy} className={`rounded-xl px-3 py-2.5 text-xs font-extrabold shadow-lg transition hover:-translate-y-0.5 sm:px-4 sm:py-3 sm:text-sm ${toyMode ? 'bg-stone-900 text-white' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
              🎀 {toyMode ? 'Убрать бантик' : 'Играть бантиком'}
            </button>
            <button type="button" onClick={callMramorka} className="rounded-xl bg-white px-3 py-2.5 text-xs font-extrabold shadow-lg ring-1 ring-stone-200 transition hover:-translate-y-0.5 hover:bg-amber-50 sm:px-4 sm:py-3 sm:text-sm">
              <MousePointer2 className="mr-1 inline h-4 w-4" /> Позвать
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs leading-5 text-stone-500">
          Это первая демонстрация. Изображение создано по настоящим фотографиям Мраморки, а реакции настроены под её ласковый и спокойный характер.
        </p>
      </section>
    </main>
  );
}
