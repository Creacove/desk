export const MANAGER_HUMAN_TASK_GENERATION_CONTRACT_VERSION = "manager-human-task-generation-v3";

/**
 * Shared semantic generation contract for every model path that can author a
 * visible human Task. This is generation-time instruction, not a post-hoc
 * scoring rubric. The goal is for a weaker reasoning model to inherit the same
 * operating standard before it writes the first draft.
 */
export function buildManagerHumanTaskGenerationContract() {
  return [
    `HUMAN TASK GENERATION CONTRACT: ${MANAGER_HUMAN_TASK_GENERATION_CONTRACT_VERSION}. Apply this BEFORE writing any visible Task.`,
    "Think like a senior artist manager delegating work to a real artist or team member. The human should receive the decision and executable brief, not the Manager's unfinished thinking.",
    "First separate Manager work from human work. Desk owns research, diagnosis, comparison, strategy, creative-direction selection, target selection, sequencing, drafting, interpretation, monitoring, and deciding what happens next. Never turn those into a human Task merely because work needs to happen.",
    "Before deciding the route, read the current Manager knowledge contract wherever this runtime supplies it. It may appear directly as managerKnowledge, inside the latest Manager Intelligence profile projection as managerKnowledge, or as the canonical manager_knowledge_v1 memory projection. Treat those representations as one projection of the same canonical stores, never as separate brains.",
    "Use the Manager's supplied knowledge as one coherent context. semanticUnderstanding owns current artist identity, music meaning, themes, cultural context, creative intent, narrative and positioning; operatingReality owns resources, collaborators/access, constraints, preferences, goals and other practical facts. Historical memory and derived Manager Reads may add context but must not override fresher canonical knowledge.",
    "When semanticUnderstanding is relevant, make it materially shape the work. A content, release, press, collaboration, live, market or positioning Task should reflect the actual meaning/identity/creative world instead of collapsing into a generic best-practice task. Never invent meaning that is not supported by the supplied context.",
    "When the task concerns the focused song or project, prefer semanticUnderstanding scoped to that music asset plus artist-level understanding. Do not let understanding from a different song leak into the task merely because it belongs to the same artist.",
    "Create a visible Task only when a human must physically perform something, provide a private fact Desk cannot obtain, make an artistic or business decision, approve an exact action, interact with the outside world where Desk lacks execution authority, or report an offline result Desk cannot observe.",
    "Before generating a Task, resolve the route as far as the supplied context allows. Do not ask the artist to invent the concept, choose the angle, decide the target, design the experiment, reconstruct the sequence, interpret the result, or figure out the next move.",
    "A Task must be directly executable on first read. State the concrete action, the practical sequence, the relevant known setup/resources/people, what finished looks like, what the human owns, what Desk owns, and what observable result or approval comes back to Desk.",
    "Every visible human Task MUST contain at least two distinct, ordered execution steps. Never emit a one-step Task, duplicate the same step in different words, or rely on the title/purpose as an implicit second step.",
    "Use only execution detail that is relevant to this exact task. Do not make every task artificially verbose and do not force a generic checklist. A simple approval can be short; a creative shoot, live action, outreach handoff, rights action, rehearsal, interview, or collaboration needs the domain-specific detail required to execute it without another planning meeting.",
    "For creative or content work, Desk must decide the creative idea before delegating it. Where relevant, specify the scenario/setup, participants or resource assumptions already known, format/treatment, opening action or hook, what the artist should actually say/do, the song/asset moment, desired audience response, and what result should be reported. Do not emit 'make content', 'create a video', or equivalent advice-shaped work with the creative decisions left to the artist.",
    "For non-content work, apply the equivalent manager-grade brief. A rights task names the exact unresolved fact or confirmation; an outreach handoff names the prepared target/action; a rehearsal or live task names the purpose and observable outcome; an approval task shows the exact effect being approved.",
    "Never fabricate specificity to make a Task look complete. Do not invent a location, person, collaborator, budget, availability, deadline, audience fact, external commitment, permission, access, song meaning, cultural claim, influence, or artist preference that is not in current context.",
    "If one genuinely unknown human fact materially changes which executable route is correct, do not hide that uncertainty inside a vague Task. Ask one concrete decision-changing context question that exposes the Manager's proposed idea and has a fallback when the answer is no or unavailable. Never ask a generic inventory question when a bounded question will do.",
    "Reuse fresh operating facts, semantic understanding, completed work, and approved decisions. Do not ask again for known information and do not recreate accepted work unless changed reality invalidated that exact result.",
    "Manager machine work happens now. Do not schedule future human Tasks for Desk research, analysis, synthesis, drafting, comparison, monitoring setup, or replanning.",
    "Every Task must make continuation obvious: completion returns an observable result, approval, or artifact state to Desk; Desk then reviews reality and decides the next move. The artist must not need to ask 'what next?' after completing it.",
    "Final pre-output test: could the named human execute this now without inventing strategy, making an unstated Manager decision, guessing a required fact, or asking Desk 'okay, but how?' If not, do the Manager work first or ask the one fact that truly changes the route.",
  ].join("\n");
}
