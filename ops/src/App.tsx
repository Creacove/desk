import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  LogOut,
  Menu,
  Music2,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
  X,
} from "lucide-react";
import {
  completeFollowup,
  createCase,
  createFollowup,
  createMeeting,
  getCase,
  getSessionUser,
  linkCaseWorkspace,
  listCases,
  listMeetings,
  listToday,
  onAuthStateChange,
  searchLinkableWorkspaces,
  sendMagicLink,
  signInWithPassword,
  signOut,
  updateCase,
  updateMeeting,
} from "./lib/opsApi";
import { getNextAction, validateCaseDraft, type CaseDraft } from "./lib/opsService";
import { supabaseConfigured } from "./lib/supabase";
import type { LinkableWorkspace, OpsActivity, OpsCase, OpsFollowup, OpsMeeting, Stage, TodayItem } from "./lib/types";
import "./styles.css";

type View = "today" | "pipeline" | "meetings" | "case";

const stages: Stage[] = ["new", "qualifying", "meeting", "activation", "active", "closed"];
const stageLabels: Record<Stage, string> = {
  new: "New",
  qualifying: "Qualifying",
  meeting: "Meeting",
  activation: "Activation",
  active: "Active",
  closed: "Closed",
};

function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value));
}

function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function initials(label: string): string {
  return label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "OP";
}

export default function App() {
  const [session, setSession] = useState<{ user: { email?: string }; operator: { active: boolean } } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [view, setView] = useState<View>("today");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const refreshAuth = async () => {
    if (!supabaseConfigured) {
      setAuthLoading(false);
      return;
    }
    try {
      setAuthError(null);
      setSession(await getSessionUser());
    } catch (error) {
      setSession(null);
      setAuthError(error instanceof Error ? error.message : "Could not verify Ops access.");
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    void refreshAuth();
    if (!supabaseConfigured) return;
    let unsubscribe: (() => void) | undefined;
    void onAuthStateChange(() => void refreshAuth()).then((cleanup) => { unsubscribe = cleanup; });
    return () => unsubscribe?.();
  }, []);

  if (!supabaseConfigured) return <ConfigState />;
  if (authLoading) return <LoadingState label="Checking operator access" />;
  if (!session) return <LoginScreen error={authError} onSignedIn={() => void refreshAuth()} />;

  const openCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setView("case");
    setMobileNav(false);
  };

  return (
    <div className="ops-shell">
      <aside className={`ops-sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Music2 size={17} strokeWidth={2.5} /></div>
          <div><span className="brand-name">OrderSounds</span><span className="brand-sub">OPS CONTROL ROOM</span></div>
        </div>
        <nav className="primary-nav" aria-label="Ops navigation">
          <NavButton icon={<Activity size={17} />} label="Today" active={view === "today"} onClick={() => { setView("today"); setMobileNav(false); }} />
          <NavButton icon={<ClipboardList size={17} />} label="Pipeline" active={view === "pipeline"} onClick={() => { setView("pipeline"); setMobileNav(false); }} />
          <NavButton icon={<CalendarClock size={17} />} label="Meetings" active={view === "meetings"} onClick={() => { setView("meetings"); setMobileNav(false); }} />
        </nav>
        <div className="sidebar-foot">
          <div className="operator-card"><div className="avatar">{initials(session.user.email || "Operator")}</div><div className="operator-copy"><strong>{session.user.email || "Operator"}</strong><span><span className="status-dot" /> Ops operator</span></div></div>
          <button className="quiet-button full-width" onClick={() => void signOut()}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <main className="ops-main">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="crumbs"><span>Ops</span><ChevronRight size={13} /><strong>{view === "case" ? "Case detail" : view[0].toUpperCase() + view.slice(1)}</strong></div>
          <div className="topbar-actions"><span className="secure-pill"><ShieldCheck size={14} /> Internal only</span><button className="icon-button" aria-label="Operator settings"><SlidersHorizontal size={17} /></button></div>
        </header>
        {view === "today" && <TodayView onOpenCase={openCase} />}
        {view === "pipeline" && <PipelineView onOpenCase={openCase} />}
        {view === "meetings" && <MeetingsView onOpenCase={openCase} />}
        {view === "case" && selectedCaseId && <CaseDetailView caseId={selectedCaseId} onBack={() => setView("pipeline")} />}
      </main>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{active && <span className="nav-active-line" />}</button>;
}

function ConfigState() {
  return <div className="center-state"><div className="state-orbit"><ShieldCheck size={24} /></div><h1>Ops is ready for its keys.</h1><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to this Ops deployment. It uses the same Supabase project as Desk.</p></div>;
}

function LoadingState({ label }: { label: string }) {
  return <div className="center-state"><div className="loader" /><p>{label}…</p></div>;
}

function LoginScreen({ error, onSignedIn }: { error: string | null; onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setFormError(null); setMessage(null);
    try { await signInWithPassword(email, password); onSignedIn(); } catch (e) { setFormError(e instanceof Error ? e.message : "Sign-in failed."); } finally { setBusy(false); }
  };
  const magicLink = async () => {
    setBusy(true); setFormError(null); setMessage(null);
    try { await sendMagicLink(email); setMessage("Check your inbox for a secure sign-in link."); } catch (e) { setFormError(e instanceof Error ? e.message : "Could not send the link."); } finally { setBusy(false); }
  };
  return <div className="login-shell"><div className="login-visual"><div className="visual-kicker">ORDERSOUNDS / INTERNAL</div><h1>Keep the signal<br /><em>moving.</em></h1><p>The calm place for every artist conversation before it becomes a Desk workspace.</p><div className="visual-stats"><span><strong>01</strong><small>Control plane</small></span><span><strong>24/7</strong><small>Operator context</small></span></div></div><div className="login-panel"><div className="login-brand"><div className="brand-mark"><Music2 size={17} /></div><span>Ops control room</span></div><div className="login-copy"><span className="eyebrow">Operator access</span><h2>Welcome back.</h2><p>Use your existing OrderSounds account. Ops access is granted from the shared operator allow-list.</p></div><form onSubmit={submit} className="login-form"><label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required placeholder="you@ordersounds.com" /></label><label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required placeholder="••••••••" /></label>{(error || formError) && <div className="form-alert"><CircleAlert size={15} /> {formError || error}</div>}{message && <div className="form-success"><Check size={15} /> {message}</div>}<button className="primary-button full-width" disabled={busy}>{busy ? "Checking…" : "Enter Ops"}<ArrowUpRight size={16} /></button><button type="button" className="text-button" disabled={busy || !email} onClick={() => void magicLink()}>Send me a magic link</button></form><div className="login-foot"><ShieldCheck size={14} /> Internal access only · same identity as Desk</div></div></div>;
}

function PageHeader({ kicker, title, description, action }: { kicker: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function TodayView({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const [items, setItems] = useState<TodayItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void listToday().then(setItems).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  const grouped = useMemo(() => ({ urgent: items.filter((item) => item.kind === "failed_processing" || item.kind === "overdue_followup"), scheduled: items.filter((item) => item.kind === "meeting_today"), ready: items.filter((item) => item.kind === "transcript_ready" || item.kind === "desk_link_missing" || item.kind === "transcript_missing") }), [items]);
  return <section className="page-content"><PageHeader kicker={`${new Intl.DateTimeFormat("en-NG", { weekday: "long" }).format(new Date())} · operator brief`} title="Today, in motion." description="The few things worth your attention before the day gets loud." action={<span className="date-stamp">{new Intl.DateTimeFormat("en-NG", { dateStyle: "full" }).format(new Date())}</span>} />{loading ? <LoadingState label="Loading today" /> : error ? <ErrorState message={error} /> : <><div className="signal-strip"><div><span className="strip-label">Attention now</span><strong>{grouped.urgent.length}</strong><small>items need a response</small></div><div><span className="strip-label">On the calendar</span><strong>{grouped.scheduled.length}</strong><small>meetings today</small></div><div><span className="strip-label">Ready to move</span><strong>{grouped.ready.length}</strong><small>handoffs or processing</small></div></div><div className="today-grid"><TodayColumn title="Attention now" items={grouped.urgent} onOpenCase={onOpenCase} empty="Nothing urgent. Keep your focus." tone="warm" /><TodayColumn title="On the calendar" items={grouped.scheduled} onOpenCase={onOpenCase} empty="No meetings on the calendar." /><TodayColumn title="Ready to move" items={grouped.ready} onOpenCase={onOpenCase} empty="No handoffs waiting." tone="cool" /></div></>}</section>;
}

function TodayColumn({ title, items, empty, onOpenCase, tone = "neutral" }: { title: string; items: TodayItem[]; empty: string; onOpenCase: (id: string) => void; tone?: string }) {
  return <div className={`today-column ${tone}`}><div className="column-heading"><h2>{title}</h2><span>{items.length.toString().padStart(2, "0")}</span></div>{items.length ? items.map((item) => { const action = getNextAction(item); return <button className="today-card" key={item.item_key} onClick={() => onOpenCase(item.case_id)}><div className="card-topline"><span className={`kind-dot ${tone}`} /><span>{item.kind.replace(/_/g, " ")}</span><time>{item.due_at ? formatDate(item.due_at, true) : "No due date"}</time></div><strong>{item.display_name}</strong><p>{item.reason}</p><span className={`card-action ${action.tone}`}>{action.label}<ArrowUpRight size={14} /></span></button>; }) : <div className="empty-card"><Check size={17} /><span>{empty}</span></div>}</div>;
}

function PipelineView({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const [cases, setCases] = useState<OpsCase[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [query, setQuery] = useState(""); const [stage, setStage] = useState<Stage | "all">("all"); const [newOpen, setNewOpen] = useState(false);
  const load = () => { setLoading(true); void listCases().then(setCases).catch((e) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, []);
  const filtered = cases.filter((item) => (stage === "all" || item.stage === stage) && `${item.display_name} ${item.source} ${item.primary_contact_handle || ""}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="page-content"><PageHeader kicker="Relationship map" title="The pipeline." description="Every conversation, with its next move visible." action={<button className="primary-button" onClick={() => setNewOpen(true)}><Plus size={16} /> New case</button>} /><div className="filter-bar"><label className="search-field"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cases" /></label><select value={stage} onChange={(e) => setStage(e.target.value as Stage | "all")}><option value="all">All stages</option>{stages.map((value) => <option key={value} value={value}>{stageLabels[value]}</option>)}</select><span className="filter-count">{filtered.length} case{filtered.length === 1 ? "" : "s"}</span></div>{loading ? <LoadingState label="Loading pipeline" /> : error ? <ErrorState message={error} /> : <div className="pipeline-table"><div className="table-head"><span>Case</span><span>Stage</span><span>Source</span><span>Updated</span><span /></div>{filtered.map((item) => <button className="table-row" key={item.id} onClick={() => onOpenCase(item.id)}><span className="case-cell"><span className="case-avatar">{initials(item.display_name)}</span><span><strong>{item.display_name}</strong><small>{item.primary_contact_name || item.primary_contact_handle || item.primary_contact_email || "No contact name"}</small></span></span><span><span className={`stage-badge stage-${item.stage}`}>{stageLabels[item.stage]}</span></span><span className="muted-cell">{item.source}</span><span className="muted-cell">{formatDate(item.updated_at)}</span><ChevronRight size={17} className="row-chevron" /></button>)}{!filtered.length && <div className="empty-table"><ClipboardList size={22} /><strong>No cases match this view.</strong><span>Try another stage or add your first case.</span></div>}</div>}{newOpen && <NewCaseModal onClose={() => setNewOpen(false)} onCreated={() => { setNewOpen(false); load(); }} />}</section>;
}

function NewCaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [draft, setDraft] = useState<CaseDraft>({ display_name: "", source: "", release_timing: "upcoming", primary_contact_email: "", primary_contact_handle: "", music_url: "", music_file: null });
  const [name, setName] = useState(""); const [contactName, setContactName] = useState(""); const [channel, setChannel] = useState(""); const [releaseDate, setReleaseDate] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const validation = validateCaseDraft(draft); if (validation) { setError(validation); return; } if (draft.music_file && draft.music_file.size > 50 * 1024 * 1024) { setError("Keep uploads under 50MB."); return; } setBusy(true); setError(null); try { await createCase({ ...draft, primary_contact_name: contactName, preferred_channel: channel, release_date: releaseDate }); onCreated(); } catch (e) { setError(e instanceof Error ? e.message : "Could not create the case."); } finally { setBusy(false); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><form className="modal-card" onSubmit={submit}><div className="modal-head"><div><span className="eyebrow">New relationship</span><h2>Open a case.</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><div className="form-grid"><label>Project / artist name<input value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} placeholder="e.g. Lojay" /></label><label>Source<input value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} placeholder="Referral, Instagram…" /></label><label>Primary contact<input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" /></label><label>Preferred channel<input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="WhatsApp, email…" /></label><label>Email<input value={draft.primary_contact_email} onChange={(e) => setDraft({ ...draft, primary_contact_email: e.target.value })} type="email" placeholder="artist@example.com" /></label><label>Social handle<input value={draft.primary_contact_handle} onChange={(e) => setDraft({ ...draft, primary_contact_handle: e.target.value })} placeholder="@artist" /></label><label>Release timing<select value={draft.release_timing} onChange={(e) => setDraft({ ...draft, release_timing: e.target.value })}><option value="upcoming">Upcoming</option><option value="released">Released</option><option value="unknown">Exploring</option></select></label><label>Release date <span className="optional">optional</span><input value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} type="date" /></label></div><div className="music-source"><span className="field-label">Music source</span><div className="music-source-grid"><label className="upload-zone"><UploadCloud size={18} /><span>{draft.music_file ? draft.music_file.name : "Upload an audio file"}</span><small>MP3, WAV, M4A, FLAC · max 50MB</small><input type="file" accept="audio/*" onChange={(e) => setDraft({ ...draft, music_file: e.target.files?.[0] || null })} /></label><span className="or-divider">or</span><label>Private link<input value={draft.music_url} onChange={(e) => setDraft({ ...draft, music_url: e.target.value })} placeholder="https://…" /></label></div></div>{error && <div className="form-alert"><CircleAlert size={15} /> {error}</div>}<div className="modal-actions"><button type="button" className="quiet-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}>{busy ? "Creating…" : "Create case"}<ArrowUpRight size={16} /></button></div></form></div>;
}

function MeetingsView({ onOpenCase }: { onOpenCase: (id: string) => void }) {
  const [meetings, setMeetings] = useState<(OpsMeeting & { caseName: string })[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void listMeetings().then(setMeetings).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  return <section className="page-content"><PageHeader kicker="Conversation log" title="Meetings." description="The context that makes the next conversation better." />{loading ? <LoadingState label="Loading meetings" /> : error ? <ErrorState message={error} /> : <div className="meeting-list">{meetings.map((meeting) => <button className="meeting-row" key={meeting.id} onClick={() => onOpenCase(meeting.ops_case_id)}><span className="meeting-date"><strong>{meeting.scheduled_at ? new Date(meeting.scheduled_at).getDate() : "—"}</strong><small>{meeting.scheduled_at ? new Intl.DateTimeFormat("en-NG", { month: "short" }).format(new Date(meeting.scheduled_at)).toUpperCase() : "OPEN"}</small></span><span className="meeting-main"><strong>{meeting.caseName}</strong><span>{meeting.meeting_type.replace(/_/g, " ")} · {meeting.scheduled_at ? formatDate(meeting.scheduled_at, true) : "Unscheduled"}</span></span><span className={`processing-badge ${meeting.processing_status}`}>{meeting.processing_status}</span><ChevronRight size={17} /></button>)}{!meetings.length && <div className="empty-table"><CalendarClock size={22} /><strong>No meetings yet.</strong><span>Create a meeting from a case detail page.</span></div>}</div>}</section>;
}

function CaseDetailView({ caseId, onBack }: { caseId: string; onBack: () => void }) {
  const [data, setData] = useState<{ caseRow: OpsCase; meetings: OpsMeeting[]; followups: OpsFollowup[]; activity: OpsActivity[] } | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [linkSearch, setLinkSearch] = useState(""); const [workspaces, setWorkspaces] = useState<LinkableWorkspace[]>([]); const [selectedWorkspace, setSelectedWorkspace] = useState<LinkableWorkspace | null>(null); const [linking, setLinking] = useState(false); const [notice, setNotice] = useState<string | null>(null);
  const load = () => { setLoading(true); void getCase(caseId).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false)); };
  useEffect(load, [caseId]);
  if (loading) return <section className="page-content"><LoadingState label="Loading case" /></section>;
  if (error || !data) return <section className="page-content"><ErrorState message={error || "Case not found."} /></section>;
  const { caseRow, meetings, followups, activity } = data;
  const musicUrl = safeHttpUrl(caseRow.music_url);
  const changeStage = async (stage: Stage) => { try { await updateCase(caseId, { stage }); load(); } catch (e) { setNotice(e instanceof Error ? e.message : "Could not update stage."); } };
  const search = async () => { try { setWorkspaces(await searchLinkableWorkspaces(linkSearch)); } catch (e) { setNotice(e instanceof Error ? e.message : "Could not search Desk workspaces."); } };
  const link = async () => { if (!selectedWorkspace) return; setLinking(true); setNotice(null); try { await linkCaseWorkspace(caseId, selectedWorkspace.artist_workspace_id, caseRow.desk_workspace_id); setSelectedWorkspace(null); setWorkspaces([]); setLinkSearch(""); setNotice("Desk workspace linked. This case is now marked active."); load(); } catch (e) { setNotice(e instanceof Error ? e.message : "Could not link workspace."); } finally { setLinking(false); } };
  return <section className="page-content"><button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Back to pipeline</button><div className="detail-heading"><div><span className="eyebrow">Case detail</span><h1>{caseRow.display_name}</h1><div className="detail-meta"><span className={`stage-badge stage-${caseRow.stage}`}>{stageLabels[caseRow.stage]}</span><span>Added {formatDate(caseRow.created_at)}</span><span>via {caseRow.source}</span></div></div><select className="stage-select" value={caseRow.stage} onChange={(e) => void changeStage(e.target.value as Stage)}>{stages.map((stage) => <option value={stage} key={stage}>{stageLabels[stage]}</option>)}</select></div>{notice && <div className="notice"><Check size={15} /> {notice}</div>}<div className="detail-layout"><div className="detail-primary"><section className="detail-card contact-card"><div className="section-label">Contact</div><div className="contact-main"><div className="large-avatar">{initials(caseRow.display_name)}</div><div><h2>{caseRow.primary_contact_name || "Unnamed contact"}</h2><p>{caseRow.primary_contact_email || caseRow.primary_contact_handle || "No contact channel"}</p></div></div><div className="contact-grid"><span><small>Preferred channel</small><strong>{caseRow.preferred_channel || "Not set"}</strong></span><span><small>Release timing</small><strong>{caseRow.release_timing}{caseRow.release_date ? ` · ${formatDate(caseRow.release_date)}` : ""}</strong></span><span><small>Music source</small><strong>{musicUrl ? "Private link" : caseRow.music_file_path ? "Uploaded file" : "Missing"}</strong></span></div>{musicUrl && <a className="inline-link" href={musicUrl} target="_blank" rel="noreferrer">Open music link <ArrowUpRight size={14} /></a>}</section><MeetingsCard caseId={caseId} meetings={meetings} onChange={load} /><FollowupsCard caseId={caseId} followups={followups} onChange={load} /><ActivityCard activity={activity} /></div><aside className="detail-secondary"><DeskLinkCard caseRow={caseRow} linkSearch={linkSearch} setLinkSearch={setLinkSearch} search={search} workspaces={workspaces} selectedWorkspace={selectedWorkspace} setSelectedWorkspace={setSelectedWorkspace} link={link} linking={linking} /><div className="desk-note"><ShieldCheck size={16} /><div><strong>One operator identity</strong><p>Ops access is the allow-list. The same active operator identity will unlock the Desk admin surface in PR2.</p></div></div></aside></div></section>;
}

function MeetingsCard({ caseId, meetings, onChange }: { caseId: string; meetings: OpsMeeting[]; onChange: () => void }) {
  const [open, setOpen] = useState(false); const [type, setType] = useState<OpsMeeting["meeting_type"]>("onboarding"); const [date, setDate] = useState(""); const [busy, setBusy] = useState(false); const [editing, setEditing] = useState<string | null>(null); const [transcript, setTranscript] = useState(""); const [outcome, setOutcome] = useState<OpsMeeting["outcome"]>(null);
  const add = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await createMeeting({ ops_case_id: caseId, meeting_type: type, scheduled_at: date ? new Date(date).toISOString() : null }); setOpen(false); setDate(""); onChange(); } finally { setBusy(false); } };
  const saveTranscript = async (meeting: OpsMeeting) => { setBusy(true); try { await updateMeeting(meeting.id, { transcript, outcome, completed_at: new Date().toISOString(), processing_status: "unprocessed", processed_at: null }); setEditing(null); onChange(); } finally { setBusy(false); } };
  return <section className="detail-card"><div className="card-section-head"><div><div className="section-label">Meetings</div><h2>{meetings.length ? `${meetings.length} conversation${meetings.length === 1 ? "" : "s"}` : "No conversations yet"}</h2></div><button className="quiet-button" onClick={() => setOpen(!open)}><Plus size={15} /> Schedule</button></div>{open && <form className="inline-form" onSubmit={add}><select value={type} onChange={(e) => setType(e.target.value as OpsMeeting["meeting_type"])}><option value="onboarding">Onboarding</option><option value="check_in">Check-in</option><option value="monthly_review">Monthly review</option><option value="other">Other</option></select><input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /><button className="primary-button small" disabled={busy}>Save</button></form>}<div className="meeting-stack">{meetings.map((meeting) => <div className="meeting-detail" key={meeting.id}><div className="meeting-detail-top"><div><strong>{meeting.meeting_type.replace(/_/g, " ")}</strong><span>{meeting.scheduled_at ? formatDate(meeting.scheduled_at, true) : "Unscheduled"}</span></div><span className={`processing-badge ${meeting.processing_status}`}>{meeting.processing_status}</span></div>{meeting.transcript ? <p className="transcript-preview">{meeting.transcript}</p> : <span className="missing-transcript"><CircleAlert size={14} /> Transcript missing</span>}{editing === meeting.id ? <div className="transcript-editor"><select value={outcome || ""} onChange={(e) => setOutcome((e.target.value || null) as OpsMeeting["outcome"])}><option value="">Choose outcome</option><option value="ready_to_start">Ready to start</option><option value="needs_follow_up">Needs follow-up</option><option value="not_ready">Not ready</option><option value="inquiry_questions">Inquiry questions</option><option value="not_a_fit">Not a fit</option></select><textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste meeting transcript here…" /><div><button className="quiet-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button small" onClick={() => void saveTranscript(meeting)} disabled={busy}>Save transcript</button></div></div> : <button className="text-button left" onClick={() => { setEditing(meeting.id); setTranscript(meeting.transcript || ""); setOutcome(meeting.outcome || null); }}>{meeting.transcript ? "Edit transcript" : "Paste transcript"}</button>}</div>)}</div></section>;
}

function FollowupsCard({ caseId, followups, onChange }: { caseId: string; followups: OpsFollowup[]; onChange: () => void }) {
  const [open, setOpen] = useState(false); const [kind, setKind] = useState(""); const [due, setDue] = useState(""); const [busy, setBusy] = useState(false);
  const add = async (event: React.FormEvent) => { event.preventDefault(); if (!kind || !due) return; setBusy(true); try { await createFollowup({ ops_case_id: caseId, kind, due_at: new Date(due).toISOString() }); setOpen(false); setKind(""); setDue(""); onChange(); } finally { setBusy(false); } };
  return <section className="detail-card"><div className="card-section-head"><div><div className="section-label">Follow-ups</div><h2>{followups.filter((f) => !f.completed_at).length} open</h2></div><button className="quiet-button" onClick={() => setOpen(!open)}><Plus size={15} /> Add</button></div>{open && <form className="inline-form" onSubmit={add}><input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="e.g. Send pricing" /><input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /><button className="primary-button small" disabled={busy}>Save</button></form>}<div className="followup-stack">{followups.map((followup) => <div className={`followup-row ${followup.completed_at ? "done" : ""}`} key={followup.id}><button className="check-button" onClick={() => !followup.completed_at && void completeFollowup(followup.id).then(onChange)} aria-label={followup.completed_at ? "Completed" : "Mark complete"}>{followup.completed_at ? <Check size={14} /> : null}</button><span><strong>{followup.kind}</strong><small>Due {formatDate(followup.due_at, true)}</small></span></div>)}{!followups.length && <p className="muted-copy">No follow-ups logged.</p>}</div></section>;
}

function ActivityCard({ activity }: { activity: OpsActivity[] }) {
  return <section className="detail-card"><div className="section-label">Audit trail</div><h2>Activity</h2><div className="activity-stack">{activity.slice(0, 8).map((event) => <div className="activity-row" key={event.id}><span className="activity-dot" /><span><strong>{event.event_type.replace(/_/g, " ")}</strong><small>{formatDate(event.created_at, true)}</small></span></div>)}{!activity.length && <p className="muted-copy">Activity appears as the case moves.</p>}</div></section>;
}

function DeskLinkCard({ caseRow, linkSearch, setLinkSearch, search, workspaces, selectedWorkspace, setSelectedWorkspace, link, linking }: { caseRow: OpsCase; linkSearch: string; setLinkSearch: (value: string) => void; search: () => void; workspaces: LinkableWorkspace[]; selectedWorkspace: LinkableWorkspace | null; setSelectedWorkspace: (value: LinkableWorkspace | null) => void; link: () => void; linking: boolean }) {
  return <section className="detail-card desk-link-card"><div className="section-label">Desk handoff</div><h2>{caseRow.desk_workspace_id ? "Workspace linked" : "Link a Desk workspace"}</h2>{caseRow.desk_workspace_id ? <><p className="linked-state"><Check size={15} /> {caseRow.desk_workspace_id}</p><small className="muted-copy">This link is recorded in the Ops audit trail.</small></> : <><p className="muted-copy">Search after the customer finishes Desk activation. Linking is deliberate and updates this case to Active.</p><div className="workspace-search"><input value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Artist, workspace, account…" onKeyDown={(e) => e.key === "Enter" && search()} /><button className="icon-button" onClick={search} aria-label="Search workspaces"><Search size={16} /></button></div><div className="workspace-results">{workspaces.map((workspace) => <button key={workspace.artist_workspace_id} className={`workspace-result ${selectedWorkspace?.artist_workspace_id === workspace.artist_workspace_id ? "selected" : ""}`} onClick={() => setSelectedWorkspace(workspace)}><span><strong>{workspace.workspace_name}</strong><small>{workspace.artist_name || workspace.account_name || "Unnamed artist"} · {workspace.workspace_status}</small></span>{selectedWorkspace?.artist_workspace_id === workspace.artist_workspace_id && <Check size={15} />}</button>)}</div>{selectedWorkspace && <div className="confirm-link"><p>Link <strong>{selectedWorkspace.workspace_name}</strong> to this case?</p><button className="primary-button small" onClick={link} disabled={linking}>{linking ? "Linking…" : "Confirm link"}</button></div>}</>}</section>;
}

function ErrorState({ message }: { message: string }) { return <div className="error-state"><CircleAlert size={19} /><strong>Something needs attention</strong><p>{message}</p></div>; }
