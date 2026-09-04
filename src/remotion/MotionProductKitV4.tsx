import type { CSSProperties, ReactNode } from "react";
import { Check, ChevronRight, Circle, FileText, Sparkles } from "lucide-react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const ink = "#141216";
const muted = "rgba(20,18,22,.48)";
const line = "rgba(20,18,22,.09)";
const purple = "#6f43dc";
const paper = "#fbfaf7";

export function TypewriterText({ text, start, duration = 54, caret = true, style }: { text: string; start: number; duration?: number; caret?: boolean; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [start, start + duration], [0, 1], clamp);
  const chars = Math.floor(text.length * progress);
  const caretVisible = frame >= start && frame <= start + duration + 20 && Math.floor(frame / 9) % 2 === 0;
  return (
    <span style={style}>
      {text.slice(0, chars)}
      {caret && caretVisible ? <span style={{ color: purple, marginLeft: 2 }}>|</span> : null}
    </span>
  );
}

export function RevealLine({ children, start, fromY = 20, blur = 8, style }: { children: ReactNode; start: number; fromY?: number; blur?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const p = spring({ frame: Math.max(0, frame - start), fps: 60, config: { damping: 20, stiffness: 110, mass: 0.82 } });
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * fromY}px)`, filter: `blur(${(1 - p) * blur}px)`, ...style }}>
      {children}
    </div>
  );
}

export function MotionWindow({ children, style, chrome = true }: { children: ReactNode; style?: CSSProperties; chrome?: boolean }) {
  return (
    <div style={{ position: "relative", background: "rgba(255,255,255,.96)", border: `1px solid ${line}`, borderRadius: 28, boxShadow: "0 32px 100px rgba(29,24,21,.11), 0 4px 18px rgba(29,24,21,.05)", overflow: "hidden", color: ink, ...style }}>
      {chrome ? (
        <div style={{ height: 54, borderBottom: `1px solid ${line}`, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", background: "rgba(250,249,246,.86)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: "rgba(20,18,22,.14)" }} />
          <span style={{ width: 8, height: 8, borderRadius: 99, background: "rgba(20,18,22,.10)" }} />
          <span style={{ width: 8, height: 8, borderRadius: 99, background: "rgba(20,18,22,.07)" }} />
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function MediaAtmosphere({ src, focusX = 50, focusY = 50, style, overlay = "rgba(23,16,12,.10)" }: { src: string; focusX?: number; focusY?: number; style?: CSSProperties; overlay?: string }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", ...style }}>
      <Img src={staticFile(src)} style={{ position: "absolute", inset: -36, width: "calc(100% + 72px)", height: "calc(100% + 72px)", objectFit: "cover", objectPosition: `${focusX}% ${focusY}%`, filter: "blur(26px) saturate(.9)", opacity: .40, transform: "scale(1.08)" }} />
      <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focusX}% ${focusY}%`, maskImage: "linear-gradient(180deg,transparent 0%,#000 12%,#000 84%,transparent 100%)", WebkitMaskImage: "linear-gradient(180deg,transparent 0%,#000 12%,#000 84%,transparent 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: overlay }} />
    </div>
  );
}

export function ManagerComposerMotion({ start = 0 }: { start?: number }) {
  const frame = useCurrentFrame();
  const sendIn = spring({ frame: Math.max(0, frame - start - 72), fps: 60, config: { damping: 18, stiffness: 120 } });
  return (
    <MotionWindow style={{ width: 1120, minHeight: 720 }}>
      <div style={{ padding: "48px 54px 58px" }}>
        <RevealLine start={start + 4}>
          <div style={{ fontSize: 18, color: muted, fontWeight: 680, letterSpacing: "-.01em" }}>Manager · Odaeshi</div>
        </RevealLine>
        <RevealLine start={start + 14}>
          <div style={{ fontSize: 46, fontWeight: 760, letterSpacing: "-.055em", lineHeight: 1 }}>What are we trying to make happen?</div>
        </RevealLine>

        <div style={{ marginTop: 132, border: `1px solid ${line}`, background: paper, borderRadius: 22, padding: "28px 30px 24px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.8)" }}>
          <div style={{ minHeight: 78, fontSize: 28, lineHeight: 1.4, fontWeight: 610, letterSpacing: "-.025em" }}>
            <TypewriterText text="I want to release Odaeshi next month. Help me run it." start={start + 28} duration={62} />
          </div>
          <div style={{ marginTop: 26, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: muted, fontSize: 15, fontWeight: 650 }}>Odaeshi attached</span>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: ink, display: "grid", placeItems: "center", transform: `scale(${.72 + sendIn * .28})`, opacity: sendIn }}>
              <ChevronRight size={23} color="white" strokeWidth={2.6} />
            </div>
          </div>
        </div>
      </div>
    </MotionWindow>
  );
}

const CREATED_WORK = [
  ["Release mission", "Plan, checkpoints and next work"],
  ["EPK", "Artist story, release context and links"],
  ["Press release", "Release-ready draft"],
  ["Content plan", "Three stories, sequence and CTA"],
  ["Editorial pitch", "Why Odaeshi matters now"],
] as const;

export function ManagerCreatesWorkMotion({ start = 0 }: { start?: number }) {
  return (
    <MotionWindow style={{ width: 1180, minHeight: 810 }}>
      <div style={{ padding: "52px 58px" }}>
        <RevealLine start={start}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: purple, fontWeight: 750, fontSize: 16 }}><Sparkles size={18} /> Desk</div>
        </RevealLine>
        <RevealLine start={start + 10}>
          <div style={{ marginTop: 16, width: 900, fontSize: 30, lineHeight: 1.36, letterSpacing: "-.035em", fontWeight: 660 }}>
            I’ve got the release. I’m protecting the story first, and I’ve already built the work around it.
          </div>
        </RevealLine>

        <div style={{ marginTop: 46, borderTop: `1px solid ${line}` }}>
          {CREATED_WORK.map(([title, meta], index) => (
            <RevealLine key={title} start={start + 36 + index * 15} fromY={26} blur={10}>
              <div style={{ minHeight: 104, borderBottom: `1px solid ${line}`, display: "grid", gridTemplateColumns: "48px 1fr 36px", alignItems: "center", gap: 18 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: index === 0 ? "#ede6ff" : "rgba(20,18,22,.045)", display: "grid", placeItems: "center", color: index === 0 ? purple : ink }}>
                  {index === 0 ? <Circle size={17} fill="currentColor" /> : <FileText size={18} />}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 720, letterSpacing: "-.028em" }}>{title}</div>
                  <div style={{ marginTop: 5, fontSize: 15, color: muted, fontWeight: 570 }}>{meta}</div>
                </div>
                <Check size={19} color={purple} strokeWidth={2.5} />
              </div>
            </RevealLine>
          ))}
        </div>
      </div>
    </MotionWindow>
  );
}

export function TaskBriefMotion({ start = 0 }: { start?: number }) {
  const steps = [
    "Open on camera: ‘There was a point I thought this song would never come out.’",
    "Tell the 15-second version of what almost stopped the record.",
    "Bring in the strongest 7–10 seconds of Odaeshi under the final line.",
    "End with: ‘Odaeshi. Next month.’",
  ];
  const frame = useCurrentFrame();
  const buttonIn = spring({ frame: Math.max(0, frame - start - 112), fps: 60, config: { damping: 19, stiffness: 116 } });
  return (
    <MotionWindow chrome={false} style={{ width: 1040, minHeight: 900, padding: "54px 58px 48px" }}>
      <RevealLine start={start}>
        <div style={{ color: muted, fontSize: 14, fontWeight: 760, letterSpacing: ".08em", textTransform: "uppercase" }}>Current task · Content ready before release week</div>
      </RevealLine>
      <RevealLine start={start + 12}>
        <div style={{ marginTop: 18, fontSize: 42, lineHeight: 1.04, fontWeight: 780, letterSpacing: "-.055em" }}>Record: What couldn’t finish us?</div>
      </RevealLine>
      <RevealLine start={start + 24}>
        <div style={{ marginTop: 18, width: 830, fontSize: 19, lineHeight: 1.5, color: "rgba(20,18,22,.68)", fontWeight: 570 }}>Desk chose the angle, hook, story structure and CTA. You only need to record it.</div>
      </RevealLine>

      <div style={{ marginTop: 38, borderTop: `1px solid ${line}` }}>
        {steps.map((step, index) => (
          <RevealLine key={step} start={start + 42 + index * 16} fromY={22} blur={8}>
            <div style={{ display: "grid", gridTemplateColumns: "38px 1fr", gap: 18, padding: "22px 0", borderBottom: `1px solid ${line}`, alignItems: "start" }}>
              <div style={{ width: 32, height: 32, borderRadius: 99, background: index === 0 ? "#ede6ff" : "rgba(20,18,22,.05)", color: index === 0 ? purple : ink, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800 }}>{index + 1}</div>
              <div style={{ fontSize: 20, lineHeight: 1.45, letterSpacing: "-.018em", fontWeight: 610 }}>{step}</div>
            </div>
          </RevealLine>
        ))}
      </div>

      <div style={{ marginTop: 34, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <RevealLine start={start + 92}><div style={{ fontSize: 15, color: muted, fontWeight: 650 }}>25–35 sec · 9:16 · close and direct</div></RevealLine>
        <div style={{ opacity: buttonIn, transform: `translateY(${(1 - buttonIn) * 18}px) scale(${.92 + buttonIn * .08})`, background: ink, color: "white", minWidth: 152, height: 52, borderRadius: 14, display: "grid", placeItems: "center", fontSize: 16, fontWeight: 760 }}>Start task</div>
      </div>
    </MotionWindow>
  );
}

export function ApprovalMotion({ start = 0 }: { start?: number }) {
  const frame = useCurrentFrame();
  const click = spring({ frame: Math.max(0, frame - start - 108), fps: 60, config: { damping: 15, stiffness: 150 } });
  const complete = spring({ frame: Math.max(0, frame - start - 132), fps: 60, config: { damping: 18, stiffness: 120 } });
  return (
    <MotionWindow chrome={false} style={{ width: 1030, minHeight: 670, padding: "52px 58px" }}>
      <RevealLine start={start}><div style={{ color: purple, fontSize: 14, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase" }}>Needs your authority</div></RevealLine>
      <RevealLine start={start + 10}><div style={{ marginTop: 16, fontSize: 39, lineHeight: 1.06, fontWeight: 780, letterSpacing: "-.052em" }}>Send collaborator split confirmation</div></RevealLine>
      <RevealLine start={start + 24}><div style={{ marginTop: 28, padding: "24px 26px", borderRadius: 18, background: "rgba(20,18,22,.035)", border: `1px solid ${line}` }}>
        <div style={{ fontSize: 14, color: muted, fontWeight: 700 }}>Exact effect</div>
        <div style={{ marginTop: 10, fontSize: 19, lineHeight: 1.45, fontWeight: 620 }}>Send the prepared split confirmation to the collaborator using the approved percentages and release details.</div>
      </div></RevealLine>
      <RevealLine start={start + 42}><div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "160px 1fr", rowGap: 13, fontSize: 16 }}>
        <span style={{ color: muted, fontWeight: 650 }}>Recipient</span><span style={{ fontWeight: 680 }}>Collaborator</span>
        <span style={{ color: muted, fontWeight: 650 }}>Track</span><span style={{ fontWeight: 680 }}>Odaeshi</span>
        <span style={{ color: muted, fontWeight: 650 }}>Risk</span><span style={{ fontWeight: 680 }}>External message is sent once</span>
      </div></RevealLine>

      <div style={{ marginTop: 34, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
        <RevealLine start={start + 68}><div style={{ height: 52, padding: "0 24px", borderRadius: 14, border: `1px solid ${line}`, display: "grid", placeItems: "center", fontSize: 15, fontWeight: 720 }}>Reject</div></RevealLine>
        <RevealLine start={start + 74}>
          <div style={{ position: "relative", height: 52, minWidth: 178, padding: "0 26px", borderRadius: 14, background: complete > .7 ? purple : ink, color: "white", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 760, transform: `scale(${1 - Math.min(click, 1) * .045})`, boxShadow: complete > .7 ? "0 12px 28px rgba(111,67,220,.24)" : undefined }}>
            {complete > .7 ? "Sent" : "Approve & run"}
            {complete > .7 ? <Check size={17} style={{ position: "absolute", right: 18 }} /> : null}
          </div>
        </RevealLine>
      </div>
    </MotionWindow>
  );
}

export function MotionCursor({ start, x, y, clickAt, style }: { start: number; x: number; y: number; clickAt?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const inP = spring({ frame: Math.max(0, frame - start), fps: 60, config: { damping: 18, stiffness: 120 } });
  const pressed = clickAt === undefined ? 0 : spring({ frame: Math.max(0, frame - clickAt), fps: 60, config: { damping: 13, stiffness: 200 } });
  return (
    <div style={{ position: "absolute", left: x * width, top: y * height, width: 34, height: 42, transform: `translate(-4px,-3px) translateY(${(1 - inP) * 46}px) scale(${1 - Math.min(pressed, 1) * .12})`, opacity: inP, filter: "drop-shadow(0 4px 6px rgba(0,0,0,.18))", zIndex: 30, ...style }}>
      <svg viewBox="0 0 28 36" width="100%" height="100%"><path d="M3 2L24 21L15 22L20 32L14 35L9 24L3 30V2Z" fill="white" stroke="#141216" strokeWidth="2" strokeLinejoin="round" /></svg>
      {pressed > .05 && pressed < .9 ? <span style={{ position: "absolute", left: -12, top: -12, width: 44, height: 44, borderRadius: 99, border: `2px solid ${purple}`, opacity: 1 - pressed }} /> : null}
    </div>
  );
}
