import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  FileText,
  House,
  Library,
  MessageCircle,
  MoveRight,
  Send,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "../../design-system/components";
import { filmFixture } from "./filmFixture";

export type FilmFormat = "vertical" | "feed" | "landscape";
export type FilmShotId =
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

export function FilmProductFrame({ shot, format }: { shot: FilmShotId; format: FilmFormat }) {
  const portrait = format !== "landscape";

  return (
    <section
      data-film-shot={shot}
      data-film-format={format}
      className="film-stage relative h-full w-full overflow-hidden bg-[#08080b] text-white"
    >
      <div className="film-ambient absolute inset-0" />
      <div className="relative z-10 h-full">
        {shot === "question" ? <QuestionScene portrait={portrait} /> : null}
        {shot === "desk" ? <DeskScene portrait={portrait} /> : null}
        {shot === "goal" ? <GoalScene portrait={portrait} /> : null}
        {shot === "understands" ? <UnderstandingScene portrait={portrait} /> : null}
        {shot === "today" ? <TodayScene portrait={portrait} /> : null}
        {shot === "work" ? <ManagerWorkScene portrait={portrait} /> : null}
        {shot === "exact-human-work" ? <ExactHumanWorkScene portrait={portrait} /> : null}
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
    <div className="film-safe flex h-full flex-col justify-center">
      <p className={`film-rise font-display font-semibold leading-[0.9] tracking-[-0.06em] text-white ${portrait ? "text-[clamp(4rem,13vw,9rem)]" : "max-w-[10ch] text-[clamp(5rem,7.5vw,10rem)]"}`}>
        You make the music.
      </p>
      <p className={`film-rise film-delay-1 font-display font-medium leading-[1.02] tracking-[-0.045em] text-white/40 ${portrait ? "mt-[14%] max-w-[11ch] text-[clamp(2.2rem,7vw,5rem)]" : "mt-[4%] max-w-[13ch] text-[clamp(2.5rem,4vw,5.5rem)]"}`}>
        Who runs everything else?
      </p>
    </div>
  );
}

function DeskScene({ portrait }: { portrait: boolean }) {
  return (
    <div className="film-safe grid h-full place-items-center">
      <div className="film-pop text-center">
        <div className="film-orb mx-auto grid aspect-square w-[8.5rem] place-items-center rounded-[30px] border border-violet-300/20 bg-violet-400/10 shadow-[0_0_100px_rgba(139,92,246,.25)] sm:w-[10rem]">
          <BrandMark className="!h-24 !w-24 !rounded-[24px]" />
        </div>
        <p className={`mt-10 font-display font-semibold leading-none tracking-[-0.06em] ${portrait ? "text-[clamp(4.5rem,15vw,9.5rem)]" : "text-[clamp(5.5rem,8vw,10rem)]"}`}>
          Desk.
        </p>
      </div>
    </div>
  );
}

function GoalScene({ portrait }: { portrait: boolean }) {
  return (
    <EditorialScene eyebrow="Manager" headline="Give Desk the goal." portrait={portrait}>
      <DeskWindow portrait={portrait} section="Manager">
        <div className="mx-auto flex h-full w-full max-w-[48rem] flex-col justify-end px-[6%] pb-[7%] pt-[12%]">
          <div className="film-rise ml-auto max-w-[88%] rounded-[20px] bg-black/[0.055] px-5 py-4 sm:max-w-[76%]">
            <p className="text-[clamp(1.15rem,3.8vw,1.85rem)] font-medium leading-[1.35] tracking-[-0.02em] text-[#12131a]">
              {filmFixture.goal}
            </p>
          </div>
          <div className="film-rise film-delay-1 mt-5 rounded-[18px] border border-black/[0.08] bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13px] font-medium text-black/42">Tell Desk what changed, or ask something</span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#11131a] text-white">
                <Send className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>
      </DeskWindow>
    </EditorialScene>
  );
}

function UnderstandingScene({ portrait }: { portrait: boolean }) {
  return (
    <EditorialScene eyebrow="Context" headline="Desk gets the context." portrait={portrait}>
      <DeskWindow portrait={portrait} section="Manager">
        <div className="h-full px-[6%] py-[7%]">
          <div className="mb-5 flex items-center justify-between border-b border-black/[0.08] pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-black/38">Working context</p>
              <p className="mt-1 text-[20px] font-semibold tracking-[-0.025em] text-[#11131a]">{filmFixture.artist.song}</p>
            </div>
            <span className="rounded-full bg-violet-600/[0.08] px-3 py-1.5 text-[11px] font-semibold text-violet-700">Current</span>
          </div>
          <div className={`grid ${portrait ? "grid-cols-1" : "grid-cols-2"} gap-2.5`}>
            {filmFixture.context.map((item, index) => (
              <div key={item.label} className="film-rise rounded-[14px] border border-black/[0.075] bg-black/[0.018] p-4" style={{ animationDelay: `${80 + index * 55}ms` }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-black/35">{item.label}</p>
                <p className="mt-1.5 text-[13px] font-semibold leading-[1.35] text-[#171820]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </DeskWindow>
    </EditorialScene>
  );
}

function TodayScene({ portrait }: { portrait: boolean }) {
  return (
    <EditorialScene eyebrow="Today" headline="Then decides what matters now." portrait={portrait}>
      <DeskWindow portrait={portrait} section="Home">
        <div className="h-full px-[6%] py-[7%]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/35">Today</p>
          <div className="film-camera-push mt-4 border-y border-black/[0.08] py-5 sm:py-7">
            <p className="text-[12px] font-semibold text-black/45">{filmFixture.today.kicker}</p>
            <div className="mt-2 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[clamp(1.45rem,4vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-[#11131a]">{filmFixture.today.title}</p>
                <p className="mt-2 max-w-[44rem] text-[12px] font-medium leading-relaxed text-black/48 sm:text-[13px]">{filmFixture.today.why}</p>
              </div>
              <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-black/28" />
            </div>
            <button className="mt-4 rounded-[10px] bg-[#11131a] px-4 py-2.5 text-[12px] font-semibold text-white">{filmFixture.today.action}</button>
          </div>
          <div className="mt-6 opacity-45">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-black/35">Today&apos;s Brief</p>
            <div className="mt-3 h-3 w-[78%] rounded-full bg-black/[0.09]" />
            <div className="mt-2 h-3 w-[56%] rounded-full bg-black/[0.06]" />
          </div>
        </div>
      </DeskWindow>
    </EditorialScene>
  );
}

function ManagerWorkScene({ portrait }: { portrait: boolean }) {
  return (
    <EditorialScene eyebrow="Manager" headline="Desk does the work it can." portrait={portrait}>
      <DeskWindow portrait={portrait} section="Manager">
        <div className="flex h-full flex-col px-[6%] py-[7%]">
          <p className="max-w-[37rem] text-[14px] font-medium leading-relaxed text-black/62">
            I built the release work around Odaeshi&apos;s resilience idea. These are ready for review.
          </p>
          <div className={`mt-5 grid ${portrait ? "grid-cols-1" : "grid-cols-2"} gap-2.5`}>
            {filmFixture.managerWork.map((item, index) => (
              <div key={item.title} className="film-artifact rounded-[14px] border border-black/[0.08] bg-white p-4 shadow-[0_10px_28px_rgba(20,20,30,.05)]" style={{ animationDelay: `${90 + index * 80}ms` }}>
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-violet-600/[0.08] text-violet-700"><FileText className="h-4 w-4" /></span>
                  <Check className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-4 text-[14px] font-semibold text-[#11131a]">{item.title}</p>
                <p className="mt-1 text-[11px] font-medium text-black/40">{item.meta}</p>
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-center gap-2 pt-4 text-[11px] font-semibold text-violet-700">
            <Sparkles className="h-3.5 w-3.5" /> Saved to Files
          </div>
        </div>
      </DeskWindow>
    </EditorialScene>
  );
}

function ExactHumanWorkScene({ portrait }: { portrait: boolean }) {
  return (
    <EditorialScene eyebrow="Mission" headline="When Desk needs you, the job is exact." portrait={portrait}>
      <DeskWindow portrait={portrait} section="Missions">
        <div className="h-full overflow-hidden px-[6%] py-[6%]">
          <div className="flex items-center justify-between gap-3 border-b border-black/[0.08] pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-black/36">Current task</p>
              <p className="mt-1 text-[18px] font-semibold tracking-[-0.025em] text-[#11131a]">{filmFixture.humanTask.title}</p>
            </div>
            <span className="rounded-full bg-[#11131a] px-3 py-1.5 text-[10px] font-semibold text-white">Artist action</span>
          </div>
          <p className="mt-4 text-[12px] font-medium leading-relaxed text-black/55">{filmFixture.humanTask.purpose}</p>
          <ol className="mt-4 grid gap-2.5">
            {filmFixture.humanTask.steps.map((step, index) => (
              <li key={step} className="film-rise flex gap-3 rounded-[12px] bg-black/[0.025] p-3" style={{ animationDelay: `${80 + index * 65}ms` }}>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#11131a] text-[10px] font-semibold text-white">{index + 1}</span>
                <span className="text-[11px] font-medium leading-relaxed text-black/66 sm:text-[12px]">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3 rounded-[12px] border border-violet-600/10 bg-violet-600/[0.035] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-700">Fallback</p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-black/60">{filmFixture.humanTask.fallback}</p>
          </div>
        </div>
      </DeskWindow>
    </EditorialScene>
  );
}

function AdaptScene({ portrait }: { portrait: boolean }) {
  return (
    <EditorialScene eyebrow="Reality changed" headline="Desk moves with it." portrait={portrait}>
      <DeskWindow portrait={portrait} section="Missions">
        <div className="flex h-full flex-col px-[6%] py-[7%]">
          <div className="film-slide-left rounded-[14px] border border-black/[0.08] bg-black/[0.02] p-4 opacity-55">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black/35">Before</p>
                <p className="mt-1 text-[14px] font-semibold text-[#11131a]">{filmFixture.replan.previous}</p>
              </div>
              <span className="text-[11px] font-semibold text-black/42">{filmFixture.move.from}</span>
            </div>
          </div>
          <div className="film-slide-right mt-3 rounded-[16px] border border-violet-600/15 bg-violet-600/[0.05] p-4 shadow-[0_16px_34px_rgba(90,55,190,.08)]">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-violet-600 text-white"><MoveRight className="h-4 w-4" /></span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-700">Moved to {filmFixture.move.to}</p>
                <p className="mt-1 text-[15px] font-semibold leading-snug text-[#11131a]">{filmFixture.replan.next}</p>
                <p className="mt-2 text-[11px] font-medium leading-relaxed text-black/50">{filmFixture.move.reason}</p>
              </div>
            </div>
          </div>
          <div className="mt-auto border-t border-black/[0.08] pt-4">
            <p className="text-[11px] font-semibold text-[#11131a]">{filmFixture.move.response}</p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-black/43">{filmFixture.replan.note}</p>
          </div>
        </div>
      </DeskWindow>
    </EditorialScene>
  );
}

function WatchScene({ portrait }: { portrait: boolean }) {
  return (
    <EditorialScene eyebrow="After you post" headline="Desk keeps watching." portrait={portrait}>
      <DeskWindow portrait={portrait} section="Home">
        <div className="grid h-full place-items-center px-[6%] py-[7%]">
          <div className="film-pulse-soft w-full max-w-[44rem] border-y border-black/[0.08] py-6">
            <div className="flex items-start gap-3">
              <Eye className="mt-1 h-5 w-5 shrink-0 text-violet-700" />
              <div>
                <p className="text-[clamp(1.35rem,3.5vw,2.3rem)] font-semibold leading-tight tracking-[-0.03em] text-[#11131a]">{filmFixture.watch.title}</p>
                <p className="mt-2 text-[12px] font-medium leading-relaxed text-black/50 sm:text-[13px]">{filmFixture.watch.why}</p>
                <span className="mt-4 inline-flex rounded-full bg-black/[0.045] px-3 py-1.5 text-[10px] font-semibold text-black/45">{filmFixture.watch.status}</span>
              </div>
            </div>
          </div>
        </div>
      </DeskWindow>
    </EditorialScene>
  );
}

function ApprovalScene({ portrait }: { portrait: boolean }) {
  return (
    <EditorialScene eyebrow="Your authority" headline="You stay in control." portrait={portrait}>
      <DeskWindow portrait={portrait} section="Home">
        <div className="grid h-full place-items-center px-[6%] py-[7%]">
          <div className="film-camera-push w-full max-w-[45rem] rounded-[16px] border border-black/[0.09] bg-white p-5 shadow-[0_18px_50px_rgba(20,20,30,.08)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-black/35">Approval</p>
                <p className="mt-1 text-[17px] font-semibold tracking-[-0.025em] text-[#11131a]">{filmFixture.approval.title}</p>
                <p className="mt-1 text-[11px] font-medium text-black/42">{filmFixture.approval.target}</p>
              </div>
              <span className="rounded-full border border-black/[0.08] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.07em] text-black/40">Desk can execute</span>
            </div>
            <ul className="mt-4 grid gap-2">
              {filmFixture.approval.details.map((detail) => (
                <li key={detail} className="flex items-center gap-2 text-[11px] font-medium text-black/58"><Check className="h-3.5 w-3.5 text-emerald-600" />{detail}</li>
              ))}
            </ul>
            <button className="film-approval-click mt-5 rounded-[10px] bg-[#11131a] px-4 py-2.5 text-[12px] font-semibold text-white">{filmFixture.approval.action}</button>
          </div>
        </div>
      </DeskWindow>
    </EditorialScene>
  );
}

function EndScene({ portrait }: { portrait: boolean }) {
  return (
    <div className="film-safe grid h-full place-items-center">
      <div className="film-pop text-center">
        <BrandMark className="mx-auto !h-16 !w-16 !rounded-[18px] sm:!h-20 sm:!w-20" />
        <p className={`mt-8 font-display font-semibold leading-[0.92] tracking-[-0.055em] ${portrait ? "text-[clamp(4.2rem,14vw,9rem)]" : "text-[clamp(5rem,7.5vw,10rem)]"}`}>
          Meet your manager.
        </p>
        <p className="mt-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/38">OrderSounds Desk</p>
      </div>
    </div>
  );
}

function EditorialScene({ eyebrow, headline, portrait, children }: { eyebrow: string; headline: string; portrait: boolean; children: ReactNode }) {
  return (
    <div className={`film-safe grid h-full ${portrait ? "grid-rows-[auto_minmax(0,1fr)] gap-[6%]" : "grid-cols-[0.72fr_1.28fr] items-center gap-[5%]"}`}>
      <div className={portrait ? "pt-[3%]" : "self-center"}>
        <p className="film-rise text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/70 sm:text-[11px]">{eyebrow}</p>
        <h1 className={`film-rise film-delay-1 mt-3 max-w-[11ch] font-display font-semibold leading-[0.96] tracking-[-0.05em] ${portrait ? "text-[clamp(2.3rem,8.5vw,5.2rem)]" : "text-[clamp(2.8rem,4.4vw,6rem)]"}`}>
          {headline}
        </h1>
      </div>
      <div className={`${portrait ? "min-h-0" : "min-h-0 self-stretch"}`}>{children}</div>
    </div>
  );
}

function DeskWindow({ portrait, section, children }: { portrait: boolean; section: "Home" | "Manager" | "Missions"; children: ReactNode }) {
  return (
    <div className={`film-product-window h-full min-h-0 overflow-hidden rounded-[22px] border border-white/10 bg-[#f8f7f4] text-[#11131a] shadow-[0_28px_90px_rgba(0,0,0,.42)] ${portrait ? "w-full" : "ml-auto w-full max-w-[64rem]"}`}>
      <div className="grid h-full grid-cols-1 lg:grid-cols-[9.2rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-black/[0.07] bg-[#f6f6f5] p-3 lg:flex lg:flex-col">
          <div className="flex items-center gap-2.5 px-1 py-1">
            <BrandMark size="sm" />
            <span className="text-[11px] font-semibold text-[#11131a]">Desk</span>
          </div>
          <nav className="mt-6 grid gap-1 text-[10px] font-semibold text-black/46">
            <RailItem label="Home" icon={<House className="h-3.5 w-3.5" />} active={section === "Home"} />
            <RailItem label="Music" icon={<Library className="h-3.5 w-3.5" />} />
            <RailItem label="Manager" icon={<MessageCircle className="h-3.5 w-3.5" />} active={section === "Manager"} />
            <RailItem label="Missions" icon={<ArrowRight className="h-3.5 w-3.5" />} active={section === "Missions"} />
          </nav>
          <div className="mt-auto border-t border-black/[0.07] pt-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-black/28">Artist workspace</p>
            <p className="mt-1 text-[11px] font-semibold text-[#11131a]">{filmFixture.artist.name}</p>
          </div>
        </aside>
        <div className="min-w-0 overflow-hidden">
          <div className="flex h-12 items-center justify-between border-b border-black/[0.07] px-[5%] lg:h-14">
            <p className="text-[12px] font-semibold text-[#11131a]">{section}</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-black/35">{filmFixture.artist.song}</span>
              <span className="h-6 w-6 rounded-full bg-violet-600/[0.09]" />
            </div>
          </div>
          <div className="h-[calc(100%-3rem)] lg:h-[calc(100%-3.5rem)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

function RailItem({ label, icon, active = false }: { label: string; icon: ReactNode; active?: boolean }) {
  return (
    <div className={`flex items-center gap-2 rounded-[9px] px-2 py-2 ${active ? "bg-violet-600/[0.07] text-violet-700" : ""}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
}
