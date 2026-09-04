import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { BrandMark } from "../../design-system/components";
import {
  FilmProductFrame,
  type FilmFormat,
  type FilmShotId,
} from "./FilmProductFrames";
import "./filmMotion.css";

type Shot = {
  id: FilmShotId;
  label: string;
  seconds: string;
  durationMs: number;
  purpose: string;
};

const SHOTS: Shot[] = [
  { id: "question", label: "The question", seconds: "0:00–0:04", durationMs: 4000, purpose: "Start with the artist carrying the whole operation." },
  { id: "desk", label: "Desk enters", seconds: "0:04–0:07", durationMs: 3000, purpose: "Introduce Desk as the answer, not as another AI feature." },
  { id: "goal", label: "Give Desk the goal", seconds: "0:07–0:12", durationMs: 5000, purpose: "One natural artist request starts the operating loop." },
  { id: "understands", label: "Desk understands", seconds: "0:12–0:17", durationMs: 5000, purpose: "Show that the decision is grounded in artist and release context." },
  { id: "today", label: "Desk decides", seconds: "0:17–0:22", durationMs: 5000, purpose: "Reduce the whole release to one clear priority now." },
  { id: "work", label: "Desk does the work", seconds: "0:22–0:30", durationMs: 8000, purpose: "Prove that Desk creates actual release work, not just advice." },
  { id: "exact-human-work", label: "Exact human work", seconds: "0:30–0:37", durationMs: 7000, purpose: "The artist receives an executable brief instead of another planning problem." },
  { id: "adapt", label: "Reality changes", seconds: "0:37–0:47", durationMs: 10000, purpose: "A real constraint changes and Desk rearranges the route automatically." },
  { id: "watch", label: "Desk watches", seconds: "0:47–0:51", durationMs: 4000, purpose: "The artist can leave the product while Desk keeps the next decision alive." },
  { id: "approval", label: "You stay in control", seconds: "0:51–0:55", durationMs: 4000, purpose: "Desk prepares the exact external effect and asks only for authority." },
  { id: "meet-your-manager", label: "End card", seconds: "0:55–1:00", durationMs: 5000, purpose: "Resolve the entire film into the product promise." },
];

const FORMAT_META: Record<FilmFormat, { label: string; ratio: string; width: number; height: number; note: string }> = {
  vertical: {
    label: "9:16",
    ratio: "9 / 16",
    width: 2160,
    height: 3840,
    note: "Primary social master. Tightest product crops and largest readable UI.",
  },
  feed: {
    label: "4:5",
    ratio: "4 / 5",
    width: 2160,
    height: 2700,
    note: "Primary LinkedIn / feed composition. Product and typography share the frame.",
  },
  landscape: {
    label: "16:9",
    ratio: "16 / 9",
    width: 3840,
    height: 2160,
    note: "Website / YouTube master. Wider product-world compositions and more breathing room.",
  },
};

export function LaunchFilmStudio() {
  const params = new URLSearchParams(window.location.search);
  const format = readFormat(params.get("format"));
  const requestedShotId = readShot(params.get("shot"));
  const capture = params.get("capture") === "true";
  const guides = params.get("guides") === "true";
  const autoplay = params.get("autoplay") === "true";
  const loop = params.get("loop") === "true";
  const requestedIndex = Math.max(0, SHOTS.findIndex((shot) => shot.id === requestedShotId));
  const [runtimeIndex, setRuntimeIndex] = useState(requestedIndex);
  const shotIndex = autoplay ? runtimeIndex : requestedIndex;
  const shot = SHOTS[shotIndex];
  const meta = FORMAT_META[format];

  useEffect(() => {
    setRuntimeIndex(requestedIndex);
  }, [requestedIndex]);

  useEffect(() => {
    if (!autoplay) return undefined;
    if (runtimeIndex === SHOTS.length - 1 && !loop) return undefined;
    const timer = window.setTimeout(() => {
      setRuntimeIndex((current) => current === SHOTS.length - 1 ? 0 : current + 1);
    }, SHOTS[runtimeIndex].durationMs);
    return () => window.clearTimeout(timer);
  }, [autoplay, loop, runtimeIndex]);

  const open = (nextShot: FilmShotId, nextFormat = format, auto = false) => {
    const next = new URLSearchParams(window.location.search);
    next.set("shot", nextShot);
    next.set("format", nextFormat);
    if (auto) next.set("autoplay", "true");
    else next.delete("autoplay");
    window.location.search = next.toString();
  };

  const previous = SHOTS[Math.max(0, shotIndex - 1)];
  const next = SHOTS[Math.min(SHOTS.length - 1, shotIndex + 1)];

  return (
    <main className="min-h-screen bg-[#07070a] text-white">
      {!capture ? (
        <StudioHeader
          shot={shot}
          format={format}
          autoplay={autoplay}
          onFormat={(nextFormat) => open(shot.id, nextFormat, autoplay)}
          onPlay={() => open("question", format, true)}
        />
      ) : null}

      <div className={capture ? "grid min-h-screen place-items-center overflow-hidden bg-black" : "px-4 py-6 sm:px-6 sm:py-8"}>
        <div className={capture ? "h-screen max-h-screen w-screen max-w-screen overflow-hidden" : "mx-auto max-w-[1500px]"}>
          {!capture ? (
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-white/58">{meta.width} × {meta.height} · {meta.label} · 60 fps target</p>
                <p className="mt-1 max-w-[44rem] text-[11px] font-medium leading-relaxed text-white/32">{meta.note}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-violet-300/70">{shot.seconds}</p>
                <p className="mt-1 max-w-[28rem] text-[11px] font-medium leading-relaxed text-white/32">{shot.purpose}</p>
              </div>
            </div>
          ) : null}

          <div
            className={`relative overflow-hidden bg-[#0b0b10] shadow-2xl shadow-black/60 ${capture ? "h-full w-full" : "mx-auto max-h-[82vh] w-full"}`}
            style={capture ? undefined : {
              aspectRatio: meta.ratio,
              maxWidth: format === "vertical" ? "min(560px, 94vw)" : format === "feed" ? "min(760px, 94vw)" : "min(1450px, 94vw)",
            }}
          >
            <FilmProductFrame key={`${shot.id}-${format}-${autoplay ? runtimeIndex : "manual"}`} shot={shot.id} format={format} />
            {guides ? <SafeAreaGuides format={format} /> : null}
          </div>

          {!capture ? (
            <>
              <div className="mt-5 flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={shotIndex === 0 || autoplay}
                  onClick={() => open(previous.id)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-[12px] font-semibold text-white/65 transition-colors hover:border-white/20 hover:text-white disabled:opacity-25"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <div className="text-center">
                  <p className="text-[12px] font-semibold text-white">{shot.label}</p>
                  <p className="mt-1 text-[11px] font-medium text-white/36">{shotIndex + 1} / {SHOTS.length}{autoplay ? " · playing" : ""}</p>
                </div>
                <button
                  type="button"
                  disabled={shotIndex === SHOTS.length - 1 || autoplay}
                  onClick={() => open(next.id)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-[12px] font-semibold text-white/65 transition-colors hover:border-white/20 hover:text-white disabled:opacity-25"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {SHOTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={autoplay}
                    onClick={() => open(item.id)}
                    className={`rounded-[14px] border px-4 py-3 text-left transition-colors disabled:cursor-default ${
                      item.id === shot.id
                        ? "border-violet-400/35 bg-violet-400/10"
                        : "border-white/8 bg-white/[0.025] hover:bg-white/[0.045]"
                    }`}
                  >
                    <span className="block text-[11px] font-semibold text-white">{item.label}</span>
                    <span className="mt-1 block text-[10px] font-medium text-white/35">{item.seconds}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function StudioHeader({
  shot,
  format,
  autoplay,
  onFormat,
  onPlay,
}: {
  shot: Shot;
  format: FilmFormat;
  autoplay: boolean;
  onFormat: (format: FilmFormat) => void;
  onPlay: () => void;
}) {
  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-[#07070a]/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark size="sm" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">Meet your manager</p>
            <p className="text-[11px] font-medium text-white/45">Launch film studio · {autoplay ? "full animatic" : shot.label}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPlay}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${autoplay ? "border-violet-300/25 bg-violet-400/12 text-violet-200" : "border-white/10 text-white/65 hover:border-white/20 hover:text-white"}`}
          >
            <Play className="h-3 w-3" /> {autoplay ? "Playing" : "Play film"}
          </button>
          {(Object.keys(FORMAT_META) as FilmFormat[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onFormat(item)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                item === format
                  ? "border-white/30 bg-white text-black"
                  : "border-white/10 text-white/60 hover:border-white/20 hover:text-white"
              }`}
            >
              {FORMAT_META[item].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SafeAreaGuides({ format }: { format: FilmFormat }) {
  const inset = format === "vertical" ? "8% 12% 15% 8%" : format === "feed" ? "7% 8% 9%" : "5%";
  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      <div className="absolute border border-fuchsia-400/55" style={{ inset }} />
      <div className="absolute left-3 top-3 rounded bg-fuchsia-500/15 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-fuchsia-200">safe area</div>
    </div>
  );
}

function readFormat(value: string | null): FilmFormat {
  return value === "feed" || value === "landscape" ? value : "vertical";
}

function readShot(value: string | null): FilmShotId {
  return SHOTS.some((shot) => shot.id === value) ? (value as FilmShotId) : "question";
}
