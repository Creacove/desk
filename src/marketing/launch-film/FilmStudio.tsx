import type { ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  MoveRight,
  Send,
} from "lucide-react";
import { BrandMark } from "../../design-system/components";

type FilmFormat = "vertical" | "feed" | "landscape";
type ShotId =
  | "question"
  | "desk"
  | "goal"
  | "understands"
  | "today"
  | "work"
  | "exact-human-work"
  | "adapt"
  | "watch"
  | "approval"
  | "meet-your-manager";

type Shot = {
  id: ShotId;
  label: string;
  seconds: string;
};

const SHOTS: Shot[] = [
  { id: "question", label: "The question", seconds: "0:00–0:04" },
  { id: "desk", label: "Desk enters", seconds: "0:04–0:07" },
  { id: "goal", label: "Give Desk the goal", seconds: "0:07–0:12" },
  { id: "understands", label: "Desk understands", seconds: "0:12–0:17" },
  { id: "today", label: "Desk decides", seconds: "0:17–0:22" },
  { id: "work", label: "Desk does the work", seconds: "0:22–0:30" },
  { id: "exact-human-work", label: "Exact human work", seconds: "0:30–0:37" },
  { id: "adapt", label: "Reality changes", seconds: "0:37–0:47" },
  { id: "watch", label: "Desk watches", seconds: "0:47–0:51" },
  { id: "approval", label: "You stay in control", seconds: "0:51–0:55" },
  { id: "meet-your-manager", label: "End card", seconds: "0:55–0:60" },
];

const FORMAT_META: Record<FilmFormat, { label: string; ratio: string; width: number; height: number }> = {
  vertical: { label: "9:16", ratio: "9 / 16", width: 2160, height: 3840 },
  feed: { label: "4:5", ratio: "4 / 5", width: 2160, height: 2700 },
  landscape: { label: "16:9", ratio: "16 / 9", width: 3840, height: 2160 },
};

export function LaunchFilmStudio() {
  const params = new URLSearchParams(window.location.search);
  const format = readFormat(params.get("format"));
  const shotId = readShot(params.get("shot"));
  const capture = params.get("capture") === "true";
  const guides = params.get("guides") === "true";
  const shotIndex = Math.max(0, SHOTS.findIndex((shot) => shot.id === shotId));
  const shot = SHOTS[shotIndex];
  const meta = FORMAT_META[format];

  const open = (nextShot: ShotId, nextFormat = format) => {
    const next = new URLSearchParams(window.location.search);
    next.set("shot", nextShot);
    next.set("format", nextFormat);
    window.location.search = next.toString();
  };

  const previous = SHOTS[Math.max(0, shotIndex - 1)];
  const next = SHOTS[Math.min(SHOTS.length - 1, shotIndex + 1)];

  return (
    <main className="min-h-screen bg-[#07070a] text-white">
      {!capture ? (
        <div className="sticky top-0 z-50 border-b border-white/10 bg-[#07070a]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark size="sm" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">Meet your manager</p>
                <p className="text-[11px] font-medium text-white/45">Launch film studio · {shot.seconds}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(FORMAT_META) as FilmFormat[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => open(shot.id, item)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    item === format ? "border-white/30 bg-white text-black" : "border-white/10 text-white/60 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {FORMAT_META[item].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className={capture ? "grid min-h-screen place-items-center overflow-hidden bg-black" : "px-4 py-6 sm:px-6 sm:py-8"}>
        <div className={capture ? "h-screen max-h-screen w-screen max-w-screen overflow-hidden" : "mx-auto max-w-[1500px]"}>
          {!capture ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11px] font-medium text-white/40">
              <span>
                {meta.width} × {meta.height} master · {meta.label}
              </span>
              <span>Storyboard foundation. Motion and real component extraction follow.</span>
            </div>
          ) : null}

          <div
            className={`relative overflow-hidden bg-[#0b0b10] shadow-2xl shadow-black/60 ${capture ? "h-full w-full" : "mx-auto max-h-[82vh] w-full"}`}
            style={capture ? undefined : {
              aspectRatio: meta.ratio,
              maxWidth: format === "vertical" ? "min(560px, 94vw)" : format === "feed" ? "min(760px, 94vw)" : "min(1450px, 94vw)",
            }}
          >
            <FilmFrame shot={shot.id} format={format} />
            {guides ? <SafeAreaGuides format={format} /> : null}
          </div>

          {!capture ? (
            <>
              <div className="mt-5 flex items-center justify-between gap-4">
                <button
                  type="button"
                  disabled={shotIndex === 0}
                  onClick={() => open(previous.id)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-[12px] font-semibold text-white/65 disabled:opacity-25"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <div className="text-center">
                  <p className="text-[12px] font-semibold text-white">{shot.label}</p>
                  <p className="mt-1 text-[11px] font-medium text-white/40">{shotIndex + 1} / {SHOTS.length}</p>
                </div>
                <button
                  type="button"
                  disabled={shotIndex === SHOTS.length - 1}
                  onClick={() => open(next.id)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-[12px] font-semibold text-white/65 disabled:opacity-25"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {SHOTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => open(item.id)}
                    className={`rounded-[14px] border px-4 py-3 text-left transition-colors ${
                      item.id === shot.id ? "border-violet-400/35 bg-violet-400/10" : "border-white/8 bg-white/[0.025] hover:bg-white/[0.045]"
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

function FilmFrame({ shot, format }: { shot: ShotId; format: FilmFormat }) {
  const portrait = format !== "landscape";
  const padding = portrait ? "px-[8%] py-[9%]" : "px-[7%] py-[7%]";

  return (
    <section className={`relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_50%_10%,rgba(139,92,246,0.14),transparent_32%),linear-gradient(180deg,#101016_0%,#09090d_58%,#050507_100%)] ${padding}`}>
      <div className="absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative z-10 h-full">
        {shot === "question" ? <QuestionScene portrait={portrait} /> : null}
        {shot === "desk" ? <DeskScene portrait={portrait} /> : null}
        {shot === "goal" ? <GoalScene portrait={portrait} /> : null}
        {shot === "understands" ? <UnderstandingScene portrait={portrait} /> : null}
        {shot === "today" ? <TodayScene portrait={portrait} /> : null}
        {shot === "work" ? <WorkScene portrait={portrait} /> : null}
        {shot === "exact-human-work" ? <HumanWorkScene portrait={portrait} /> : null}
        {shot === "adapt" ? <AdaptScene portrait={portrait} /> : null}
        {shot === "watch" ? <WatchScene portrait={portrait} /> : null}
        {shot === "approval" ? <ApprovalScene portrait={portrait} /> : null}
        {shot === "meet-your-manager" ? <EndScene portrait={portrait} /> : null}
      </div>
    </section>
  );
}

function QuestionScene({ portrait }: { portrait: boolean }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className={`${portrait ? "text-[clamp(3.5rem,11vw,8.2rem)]" : "max-w-[11ch] text-[clamp(4.5rem,7.3vw,10rem)]"} font-display font-semibold leading-[0.92] tracking-[-0.055em] text-white`}>
        You make the music.
      </p>
      <p className={`${portrait ? "mt-[12%] max-w-[12ch] text-[clamp(2rem,7vw,4.8rem)]" : "mt-[5%] max-w-[14ch] text-[clamp(2.3rem,4.2vw,5.5rem)]"} font-display font-medium leading-[1.02] tracking-[-0.045em] text-white/45`}>
        Who runs everything else?
      </p>
    </div>
  );
}

function DeskScene({ portrait }: { portrait: boolean }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="text-center">
        <div className="mx-auto grid place-items-center rounded-[28%] border border-violet-300/20 bg-violet-500/10 p-[12%] shadow-[0_0_120px_rgba(139,92,246,.28)]">
          <BrandMark className={`${portrait ? "!h-24 !w-24" : "!h-28 !w-28"} !rounded-[24px]`} />
        </div>
        <p className={`${portrait ? "mt-10 text-[clamp(4rem,14vw,9rem)]" : "mt-10 text-[clamp(5rem,8vw,10rem)]"} font-display font-semibold leading-none tracking-[-0.06em] text-white`}>
          Desk.
        </p>
      </div>
    </div>
  );
}

function GoalScene({ portrait }: { portrait: boolean }) {
  return (
    <SceneShell eyebrow="Manager" headline="Give Desk the goal." portrait={portrait}>
      <div className={`${portrait ? "mt-auto" : "ml-auto w-[68%]"} rounded-[28px] border border-white/10 bg-white/[0.045] p-[5%] shadow-2xl shadow-black/35`}>
        <div className="flex items-center gap-3 border-b border-white/8 pb-4">
          <BrandMark size="sm" />
          <div>
            <p className="text-[12px] font-semibold text-white">Manager</p>
            <p className="text-[10px] font-medium text-white/35">Odaeshi</p>
          </div>
        </div>
        <div className="mt-[10%] rounded-[22px] border border-white/10 bg-black/25 p-[6%]">
          <p className={`${portrait ? "text-[clamp(1.35rem,5vw,2.4rem)]" : "text-[clamp(1.25rem,2.3vw,2.6rem)]"} font-medium leading-[1.3] tracking-[-0.02em] text-white`}>
            I want to release Odaeshi next month.
          </p>
          <div className="mt-[8%] flex justify-end">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-black">
              <Send className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </SceneShell>
  );
}

function UnderstandingScene({ portrait }: { portrait: boolean }) {
  const chips = ["Song", "Audience", "Files", "Release state", "Resources", "Artist context"];
  return (
    <SceneShell eyebrow="Context" headline="Desk gets the context." portrait={portrait}>
      <div className={`${portrait ? "mt-auto" : "ml-auto w-[70%]"} relative grid place-items-center py-[8%]`}>
        <div className="relative z-10 grid h-32 w-32 place-items-center rounded-full border border-violet-300/20 bg-violet-400/10 shadow-[0_0_90px_rgba(139,92,246,.24)]">
          <span className="text-center text-[13px] font-semibold leading-tight text-white">Odaeshi</span>
        </div>
        <div className={`mt-[8%] grid w-full ${portrait ? "grid-cols-2" : "grid-cols-3"} gap-3`}>
          {chips.map((chip) => (
            <div key={chip} className="rounded-[16px] border border-white/9 bg-white/[0.035] px-4 py-4 text-center text-[11px] font-semibold text-white/65">
              {chip}
            </div>
          ))}
        </div>
      </div>
    </SceneShell>
  );
}

function TodayScene({ portrait }: { portrait: boolean }) {
  return (
    <SceneShell eyebrow="Today" headline="Then decides what matters now." portrait={portrait}>
      <div className={`${portrait ? "mt-auto" : "ml-auto w-[72%]"} overflow-hidden rounded-[28px] border border-white/10 bg-[#f7f5f1] text-[#11131a] shadow-2xl shadow-black/40`}>
        <div className="border-b border-black/8 px-[7%] py-[5%]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-black/38">Today</p>
        </div>
        <div className="px-[7%] py-[8%]">
          <p className={`${portrait ? "text-[clamp(1.65rem,6vw,3.2rem)]" : "text-[clamp(1.7rem,3.4vw,4rem)]"} font-display font-semibold leading-[1.03] tracking-[-0.045em]`}>
            Odaeshi is the priority today.
          </p>
          <p className="mt-[5%] max-w-[34rem] text-[clamp(.95rem,2.4vw,1.45rem)] font-medium leading-relaxed text-black/55">
            Record “What couldn't finish us?”
          </p>
          <div className="mt-[9%] inline-flex rounded-[12px] bg-black px-5 py-3 text-[12px] font-semibold text-white">Start</div>
        </div>
      </div>
    </SceneShell>
  );
}

function WorkScene({ portrait }: { portrait: boolean }) {
  const artifacts = ["EPK", "Press release", "Content plan", "Playlist pitch"];
  return (
    <SceneShell eyebrow="Manager work" headline="Desk does the work it can." portrait={portrait}>
      <div className={`${portrait ? "mt-auto grid-cols-1" : "ml-auto w-[70%] grid-cols-2"} grid gap-3`}>
        {artifacts.map((artifact, index) => (
          <div key={artifact} className={`rounded-[22px] border border-white/9 bg-white/[0.045] p-[6%] ${portrait && index > 1 ? "hidden" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-violet-400/10 text-violet-200"><FileText className="h-4 w-4" /></span>
              <span className="rounded-full border border-emerald-300/15 bg-emerald-300/8 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-200">Ready</span>
            </div>
            <p className={`${portrait ? "mt-8 text-[clamp(1.45rem,5vw,2.4rem)]" : "mt-8 text-[clamp(1.4rem,2.2vw,2.5rem)]"} font-display font-semibold tracking-[-0.035em] text-white`}>{artifact}</p>
            <p className="mt-2 text-[11px] font-medium text-white/35">Created by Manager</p>
          </div>
        ))}
      </div>
    </SceneShell>
  );
}

function HumanWorkScene({ portrait }: { portrait: boolean }) {
  const steps = [
    "Parked car. Phone at eye level.",
    "Open: What did you think would finish you, but didn’t?",
    "Get short answers from both friends.",
    "Close with: That’s Odaeshi. Bring the song in after the line.",
  ];
  return (
    <SceneShell eyebrow="Your work" headline="When it needs you, you get the exact job." portrait={portrait}>
      <div className={`${portrait ? "mt-auto" : "ml-auto w-[72%]"} rounded-[26px] border border-white/10 bg-white/[0.04] p-[6%]`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200">Content task</p>
        <p className={`${portrait ? "mt-4 text-[clamp(1.6rem,5.8vw,2.8rem)]" : "mt-4 text-[clamp(1.7rem,2.9vw,3.4rem)]"} font-display font-semibold leading-tight tracking-[-0.04em] text-white`}>
          Record “What couldn't finish us?”
        </p>
        <div className="mt-[7%] grid gap-3">
          {steps.map((step, index) => (
            <div key={step} className="grid grid-cols-[auto_1fr] items-start gap-3 border-t border-white/8 pt-3">
              <span className="font-mono text-[10px] font-semibold text-white/25">0{index + 1}</span>
              <p className="text-[clamp(.8rem,2.5vw,1.15rem)] font-medium leading-relaxed text-white/68">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </SceneShell>
  );
}

function AdaptScene({ portrait }: { portrait: boolean }) {
  return (
    <SceneShell eyebrow="Reality changed" headline="Plans changed. Desk adjusted." portrait={portrait}>
      <div className={`${portrait ? "mt-auto" : "ml-auto w-[74%]"} grid gap-4`}>
        <div className="rounded-[22px] border border-white/8 bg-white/[0.025] p-[5%] opacity-40">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35">Old timing</p>
              <p className="mt-2 text-[clamp(1.35rem,3.8vw,2.5rem)] font-display font-semibold text-white line-through decoration-white/30">Friday shoot</p>
            </div>
            <MoveRight className="h-5 w-5 text-white/25" />
          </div>
        </div>
        <div className="rounded-[24px] border border-violet-300/18 bg-violet-400/10 p-[6%] shadow-[0_0_70px_rgba(139,92,246,.12)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-200">New current route</p>
          <p className={`${portrait ? "mt-3 text-[clamp(2rem,7vw,4rem)]" : "mt-3 text-[clamp(2.2rem,4vw,5rem)]"} font-display font-semibold leading-none tracking-[-0.045em] text-white`}>Sunday.</p>
          <p className="mt-4 max-w-[30rem] text-[clamp(.85rem,2.5vw,1.2rem)] font-medium leading-relaxed text-white/55">Both friends and the car are available. Downstream work has been updated.</p>
        </div>
      </div>
    </SceneShell>
  );
}

function WatchScene({ portrait }: { portrait: boolean }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <div className="flex items-center gap-3 text-violet-200">
        <Eye className="h-5 w-5" />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Desk is watching</span>
      </div>
      <p className={`${portrait ? "mt-8 text-[clamp(3rem,11vw,7rem)]" : "mt-8 max-w-[12ch] text-[clamp(4rem,6.6vw,9rem)]"} font-display font-semibold leading-[0.95] tracking-[-0.055em] text-white`}>
        The work doesn't stop at “done.”
      </p>
      <div className={`${portrait ? "mt-[14%]" : "mt-[7%] max-w-[70%]"} flex items-center gap-3 rounded-[20px] border border-white/9 bg-white/[0.035] px-5 py-4`}>
        <span className="h-2.5 w-2.5 rounded-full bg-violet-300 shadow-[0_0_22px_rgba(196,181,253,.8)]" />
        <p className="text-[12px] font-semibold text-white/65">Response watch active · next Manager review queued</p>
      </div>
    </div>
  );
}

function ApprovalScene({ portrait }: { portrait: boolean }) {
  return (
    <SceneShell eyebrow="Authority" headline="You stay in control." portrait={portrait}>
      <div className={`${portrait ? "mt-auto" : "ml-auto w-[66%]"} rounded-[26px] border border-white/10 bg-white/[0.045] p-[6%]`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Approval required</p>
            <p className={`${portrait ? "mt-3 text-[clamp(1.8rem,6vw,3.2rem)]" : "mt-3 text-[clamp(1.8rem,3vw,3.6rem)]"} font-display font-semibold tracking-[-0.04em] text-white`}>Send split confirmations</p>
          </div>
          <span className="rounded-full border border-violet-300/15 bg-violet-300/8 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.07em] text-violet-200">Desk can execute</span>
        </div>
        <p className="mt-[6%] text-[clamp(.85rem,2.4vw,1.15rem)] font-medium leading-relaxed text-white/50">Exact recipients and effect are frozen before approval.</p>
        <div className="mt-[8%] inline-flex items-center gap-2 rounded-[14px] bg-white px-5 py-3.5 text-[12px] font-semibold text-black">
          <Check className="h-4 w-4" />
          Approve & run
        </div>
      </div>
    </SceneShell>
  );
}

function EndScene({ portrait }: { portrait: boolean }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="text-center">
        <BrandMark className={`${portrait ? "!h-20 !w-20" : "!h-24 !w-24"} mx-auto !rounded-[22px]`} />
        <p className={`${portrait ? "mt-10 text-[clamp(3.6rem,13vw,8rem)]" : "mt-10 text-[clamp(5rem,7vw,10rem)]"} mx-auto max-w-[9ch] font-display font-semibold leading-[0.93] tracking-[-0.06em] text-white`}>
          Meet your manager.
        </p>
        <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32">OrderSounds · Desk</p>
      </div>
    </div>
  );
}

function SceneShell({ eyebrow, headline, portrait, children }: { eyebrow: string; headline: string; portrait: boolean; children: ReactNode }) {
  return (
    <div className={`${portrait ? "flex h-full flex-col" : "grid h-full grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)] items-center gap-[6%]"}`}>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200">{eyebrow}</p>
        <h1 className={`${portrait ? "mt-4 max-w-[11ch] text-[clamp(2.7rem,9.7vw,6rem)]" : "mt-5 max-w-[10ch] text-[clamp(3.4rem,5.2vw,7rem)]"} font-display font-semibold leading-[0.94] tracking-[-0.055em] text-white`}>
          {headline}
        </h1>
      </div>
      {children}
    </div>
  );
}

function SafeAreaGuides({ format }: { format: FilmFormat }) {
  const portrait = format !== "landscape";
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div className={`${portrait ? "inset-x-[8%] top-[8%] bottom-[13%]" : "inset-x-[5%] top-[6%] bottom-[8%]"} absolute border border-cyan-300/35`} />
      {format === "vertical" ? (
        <>
          <div className="absolute bottom-0 right-0 top-0 w-[16%] bg-rose-400/5" />
          <div className="absolute bottom-0 left-0 right-0 h-[12%] bg-amber-300/5" />
        </>
      ) : null}
      <span className="absolute left-[2%] top-[2%] rounded bg-black/65 px-2 py-1 font-mono text-[9px] text-cyan-200">SAFE AREA</span>
    </div>
  );
}

function readFormat(value: string | null): FilmFormat {
  return value === "feed" || value === "landscape" ? value : "vertical";
}

function readShot(value: string | null): ShotId {
  return SHOTS.some((shot) => shot.id === value) ? value as ShotId : "question";
}
