import type { CSSProperties, ReactNode } from "react";
import { ChevronRight, Eye } from "lucide-react";
import { ConversationWorkspace } from "../features/manager/ManagerConversationV2";
import { TaskSheet } from "../features/missions/MissionTaskSheet";
import { TodayRuntimeExecution } from "../features/desk/TodayRuntimeExecution";
import "../features/desk/deskHome.css";
import {
  approvalMission,
  odaeshiCheckpoint,
  odaeshiConversation,
  odaeshiMission,
  odaeshiTask,
  watchMission,
} from "./filmFixturesV3";

const noop = () => undefined;
const noopAsync = async () => undefined;

export function ProductViewport({
  children,
  style,
  className = "",
}: {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`bg-background text-foreground ${className}`}
      style={{
        width: 1280,
        minHeight: 860,
        overflow: "hidden",
        borderRadius: 28,
        border: "1px solid hsl(var(--border))",
        boxShadow: "0 28px 90px rgba(35,31,28,.12), 0 2px 10px rgba(35,31,28,.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function RealManagerStage() {
  return (
    <ProductViewport>
      <ConversationWorkspace
        conversation={odaeshiConversation}
        onBack={noop}
        onOpenCreatedWork={noop}
        onSendMessage={noop}
        onSendContextAnswers={noop}
        sendPending={false}
        sendError={null}
      />
    </ProductViewport>
  );
}

export function RealTodayStage({ mode = "task" }: { mode?: "task" | "watch" | "approval" }) {
  const mission = mode === "watch" ? watchMission : mode === "approval" ? approvalMission : odaeshiMission;
  return (
    <ProductViewport style={{ minHeight: 620, padding: "46px 66px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 34 }}>
          <div>
            <div className="font-display text-[36px] font-semibold tracking-[-0.045em] text-foreground">Home</div>
            <div className="mt-1 font-ui text-[13px] font-medium text-muted-foreground">Odaeshi · release in progress</div>
          </div>
          <div className="rounded-full border border-border bg-card px-3 py-1.5 font-ui text-[11px] font-semibold text-muted-foreground">Manager active</div>
        </div>
        <TodayRuntimeExecution
          missions={[mission]}
          fallbackItems={[]}
          onOpenMission={noop}
          onManager={noop}
          onOpenFallbackItem={noop}
        />
      </div>
    </ProductViewport>
  );
}

export function RealTaskStage() {
  return (
    <ProductViewport style={{ minHeight: 900, position: "relative" }}>
      <div style={{ padding: "42px 58px 110px" }}>
        <div className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Release Odaeshi</div>
        <div className="mt-2 font-display text-[38px] font-semibold tracking-[-0.045em] text-foreground">Work</div>
        <div className="mt-8 rounded-[18px] border border-border bg-card p-5">
          <div className="font-ui text-[12px] font-semibold text-muted-foreground">Current checkpoint</div>
          <div className="mt-2 font-display text-[22px] font-semibold tracking-[-0.025em] text-foreground">{odaeshiCheckpoint.title}</div>
        </div>
      </div>
      <TaskSheet
        task={odaeshiTask}
        checkpoint={odaeshiCheckpoint}
        approved
        done={false}
        deliverables={[]}
        onClose={noop}
        onApprove={noop}
        onStart={noopAsync}
        onMove={async () => undefined}
        onComplete={noop}
        onUpload={noop}
        onWorkWithManager={noop}
      />
    </ProductViewport>
  );
}

export function ApprovalReviewFilmAdapter({ approved = false }: { approved?: boolean }) {
  return (
    <ProductViewport style={{ minHeight: 690, padding: "48px 64px" }}>
      <div style={{ maxWidth: 990, margin: "0 auto" }}>
        <p className="home-section-label font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/72">Today</p>
        <div data-testid="film-approval" className="mt-4">
          <div className="home-today-row home-today-row-primary w-full">
            <span className="home-today-copy min-w-0">
              <span className="home-today-title block font-semibold text-foreground">Send collaborator split confirmation</span>
              <span className="home-today-description mt-1 block max-w-[50rem] font-medium text-muted-foreground">Desk prepared the exact message, recipient and split details. Only your authority is missing.</span>
            </span>
            <ChevronRight className="home-today-chevron rotate-90" aria-hidden="true" />
          </div>

          <div className="home-today-expanded mb-4 ml-10 max-w-[52rem] rounded-[14px] border border-foreground/10 bg-foreground/[0.018] p-4">
            {!approved ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">Send split confirmation</p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">To: Odaeshi collaborator · 20% split</p>
                  </div>
                  <span className="rounded-full border border-foreground/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Desk can execute</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-[12px] font-medium leading-relaxed text-foreground/80">
                  <li>Confirm the agreed 20% songwriting split.</li>
                  <li>Request acknowledgement before distributor delivery.</li>
                  <li>Record the provider outcome back into the release mission.</li>
                </ul>
                <p className="mt-3 text-[12px] font-medium leading-relaxed text-muted-foreground"><strong className="text-foreground/75">Risk:</strong> This sends an external message on your behalf.</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button type="button" className="rounded-[10px] bg-foreground px-3.5 py-2 text-[12px] font-semibold text-background">Approve &amp; run</button>
                  <button type="button" className="rounded-[10px] border border-foreground/12 px-3.5 py-2 text-[12px] font-semibold text-foreground">Reject</button>
                  <button type="button" className="px-2 py-2 text-[12px] font-semibold text-muted-foreground">Open Mission</button>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 py-1">
                <div className="mt-0.5 grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-700">✓</div>
                <div>
                  <p className="text-[13px] font-semibold text-foreground">Sent and recorded</p>
                  <p className="mt-1 text-[12px] font-medium leading-relaxed text-muted-foreground">The split confirmation was sent once. Desk recorded the provider outcome and moved the release admin forward.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProductViewport>
  );
}

export function RealWatchRowOnly() {
  return (
    <ProductViewport style={{ minHeight: 480, padding: "54px 68px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <p className="home-section-label font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/72">Today</p>
        <div className="home-today-list mt-4">
          <div className="home-today-row home-today-row-supporting">
            <span className="home-today-copy min-w-0">
              <span className="home-today-title flex items-center gap-2 font-semibold text-foreground">
                <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                <span><strong>Desk is watching:</strong> First story response</span>
              </span>
              <span className="home-today-description mt-1.5 block font-medium text-muted-foreground">No action needed. Desk is watching saves, profile visits and audience response before changing the plan.</span>
            </span>
            <ChevronRight className="home-today-chevron" aria-hidden="true" />
          </div>
        </div>
      </div>
    </ProductViewport>
  );
}
