import { Player } from "@remotion/player";
import { BrandMark } from "../../design-system/components";
import { FILM_DURATION_FRAMES, FILM_FORMATS, FILM_FPS, FILM_SECONDS, type FilmFormat } from "../../remotion/constants";
import { MeetYourManagerFilmV3 } from "../../remotion/MeetYourManagerFilmV3";

const CHAPTERS = [
  ["0:00", "Artist world"],
  ["0:03", "Give Desk the goal"],
  ["0:09", "Context assembles"],
  ["0:14", "Today focuses the release"],
  ["0:17", "Desk creates the work"],
  ["0:22", "Exact human work"],
  ["0:29", "Reality changes"],
  ["0:33", "Desk watches reality"],
  ["0:37", "Approve and run"],
  ["0:40", "Meet your manager"],
] as const;

export function LaunchFilmStudio() {
  const params = new URLSearchParams(window.location.search);
  const format = readFormat(params.get("format"));
  const capture = params.get("capture") === "true";
  const autoplay = params.get("autoplay") !== "false";
  const loop = params.get("loop") === "true";
  const meta = FILM_FORMATS[format];

  const openFormat = (nextFormat: FilmFormat) => {
    const next = new URLSearchParams(window.location.search);
    next.set("format", nextFormat);
    window.location.search = next.toString();
  };

  const player = (
    <Player
      component={MeetYourManagerFilmV3}
      inputProps={{ format }}
      durationInFrames={FILM_DURATION_FRAMES}
      fps={FILM_FPS}
      compositionWidth={meta.width}
      compositionHeight={meta.height}
      autoPlay={autoplay}
      loop={loop}
      controls={!capture}
      style={{ width: "100%", height: "100%" }}
    />
  );

  if (capture) {
    return <main className="h-screen w-screen overflow-hidden bg-[#f7f4ef]">{player}</main>;
  }

  return (
    <main className="min-h-screen bg-[#111014] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#111014]/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark size="sm" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white">Meet your manager</p>
              <p className="text-[11px] font-medium text-white/45">V3 · sourced media + real Desk components · {FILM_SECONDS}s · {FILM_FPS}fps</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(FILM_FORMATS) as FilmFormat[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => openFormat(item)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${item === format ? "border-white/30 bg-white text-black" : "border-white/10 text-white/60 hover:border-white/20 hover:text-white"}`}
              >
                {FILM_FORMATS[item].label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold text-white/60">{meta.width} × {meta.height} · {meta.label}</p>
              <p className="mt-1 max-w-[47rem] text-[11px] font-medium leading-relaxed text-white/34">This Player is the same V3 composition used for final MP4 renders. Product surfaces are production components and external media is stored deterministically on the motion branch.</p>
            </div>
            <div className="rounded-full border border-violet-300/15 bg-violet-400/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-200/75">V3 rebuild</div>
          </div>

          <div
            className="mx-auto overflow-hidden bg-[#f7f4ef] shadow-2xl shadow-black/60"
            style={{
              aspectRatio: `${meta.width} / ${meta.height}`,
              maxHeight: "80vh",
              maxWidth: format === "vertical" ? "min(560px, 94vw)" : format === "feed" ? "min(760px, 94vw)" : "min(1450px, 94vw)",
            }}
          >
            {player}
          </div>

          <div className="mt-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CHAPTERS.map(([time, label]) => (
              <div key={label} className="rounded-[14px] border border-white/8 bg-white/[0.025] px-4 py-3">
                <span className="block text-[10px] font-semibold text-violet-300/60">{time}</span>
                <span className="mt-1 block text-[12px] font-semibold text-white/76">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function readFormat(value: string | null): FilmFormat {
  return value === "feed" || value === "landscape" || value === "vertical" ? value : "vertical";
}
