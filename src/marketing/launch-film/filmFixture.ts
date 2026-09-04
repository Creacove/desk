export const filmFixture = {
  artist: {
    name: "Otmos",
    song: "Odaeshi",
    lifecycle: "Upcoming release",
  },
  goal: "I want to release Odaeshi next month.",
  context: [
    { label: "Song", value: "Odaeshi" },
    { label: "Audience", value: "Afro-alternative · Lagos / London" },
    { label: "Files", value: "Master · artwork · lyrics" },
    { label: "Release state", value: "Unreleased" },
    { label: "Resources", value: "Low-budget organic rollout" },
    { label: "Artist context", value: "Resilience without self-pity" },
  ],
  today: {
    kicker: "Odaeshi is the priority today.",
    title: "Record ‘What couldn’t finish us?’",
    why: "This is the fastest way to test the song’s resilience idea before the release plan gets bigger.",
    action: "Start",
  },
  managerWork: [
    { title: "EPK", meta: "Ready in Files" },
    { title: "Press release", meta: "Draft ready" },
    { title: "Content plan", meta: "3 concepts prepared" },
    { title: "Playlist pitch", meta: "Ready to review" },
  ],
  humanTask: {
    title: "Record ‘What couldn’t finish us?’",
    purpose: "Test whether Odaeshi’s resilience idea makes people stop, answer, and share before release day.",
    managerResponsibility: "Desk chose the concept, hook, setup, edit direction and success signal.",
    userResponsibility: "Film the conversation and post it on TikTok or Reels.",
    steps: [
      "Sit in a parked car with 2 friends. Frame the phone so all three faces fit comfortably.",
      "Open with: ‘What did you think would finish you, but didn’t?’ Keep each answer under 8 seconds.",
      "After the final answer, look into camera and say: ‘That’s Odaeshi.’ Bring the song in immediately after the line.",
      "Use hard cuts only. Caption: ‘Some things were meant to end us. They didn’t.’ End with: ‘What was yours?’",
    ],
    fallback: "No car? Use a quiet room with all three of you close to camera. Keep the same question and ending.",
    completion: "Post it, then paste the public link back into Desk.",
  },
  move: {
    from: "Today",
    to: "Sunday",
    reason: "The car and both friends are only available Sunday.",
    response: "Timing saved. Desk is checking the rest of the plan.",
  },
  replan: {
    previous: "Record the content test today",
    next: "Sunday shoot locked. Prepare the release assets now.",
    note: "No new prompt needed. Desk keeps the current strategy and moves the work around the real constraint.",
  },
  watch: {
    title: "Desk is watching: first content response",
    why: "The post is live. Desk will use reliable response evidence before deciding whether to repeat, change angle, or stop.",
    status: "Response review queued",
  },
  approval: {
    title: "Approve collaborator split confirmations",
    target: "Odaeshi · 3 collaborators",
    details: [
      "Publishing and master totals are 100%",
      "All collaborator emails are present",
      "Desk prepared the exact confirmation messages",
    ],
    action: "Approve & run",
  },
} as const;
