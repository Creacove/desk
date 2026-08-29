import { describe, expect, it } from "vitest";
import { parseAdaptivePlanOutput } from "../supabase/functions/_shared/openaiAdaptivePlanCompiler";

const validation = {
  allowedDeadlines: [],
  allowedAvailability: [],
  allowedFactScopes: ["artist", "mission:mission-1"],
};

describe("Manager human Task quality", () => {
  it("rejects generic create-content work before it can reach a Mission", () => {
    const output = replanWithTask({
      title: "Create content",
      purpose: "Make something for the song so we have a post to put out this week.",
      steps: [
        "Make a video for the song.",
        "Edit the video when finished.",
        "Post it on TikTok when ready.",
      ],
      completionExpectation: "The content is posted on social media.",
      managerResponsibility: "Desk will review the post after it goes live.",
      userResponsibility: "The artist needs to make and publish the content.",
      riskIfLate: "The campaign may lose some momentum if this is late.",
    });

    expect(() => parseAdaptivePlanOutput(output, validation)).toThrow(/too generic|vague execution step|execution context/i);
  });

  it("accepts an Odaeshi-quality executable content Task", () => {
    const output = replanWithTask({
      title: "Shoot Odaeshi resilience conversation in a parked car",
      purpose: "Turn Odaeshi's resilience meaning into a human story viewers can immediately recognise and respond to.",
      steps: [
        "Park the car somewhere quiet and frame Otmos with two friends on a phone in vertical 9:16.",
        "Open with the on-screen question ‘What couldn’t finish us?’ and let each friend answer one thing they survived.",
        "After the final answer, Otmos says ‘That’s Odaeshi,’ then bring in the chorus and cut to the three of them reacting.",
        "Keep the edit under 40 seconds, add readable subtitles, and end with a caption asking viewers what they came back from.",
        "Post to TikTok or Reels and send Desk the public link so it can review comments, saves, shares, and the next move.",
      ],
      completionExpectation: "A public TikTok or Reel link is sent to Desk with the finished 40-second-or-shorter video live.",
      managerResponsibility: "Desk reviews the public result, compares the response with the creative hypothesis, and decides the next Task.",
      userResponsibility: "Otmos records the conversation with two friends, completes the edit, publishes it, and returns the public post link.",
      riskIfLate: "Delaying the first story-led post reduces the time Desk has to learn which Odaeshi creative territory deserves repetition.",
    });

    expect(parseAdaptivePlanOutput(output, validation).tasks[0]).toMatchObject({
      title: "Shoot Odaeshi resilience conversation in a parked car",
      estimatedMinutes: 40,
    });
  });

  it("rejects content Tasks that have words but still omit the execution context", () => {
    const output = replanWithTask({
      title: "Record Odaeshi launch video for TikTok",
      purpose: "Use a short video to introduce the song and give the audience a launch message they can react to before release.",
      steps: [
        "Record a polished video explaining that Odaeshi is coming soon and keep the delivery energetic throughout.",
        "Make sure the message is clear and use good pacing so people understand that the song matters.",
        "Post the finished video on TikTok and keep an eye on how the audience responds after it is live.",
      ],
      completionExpectation: "The finished launch video is live on TikTok and ready for Desk to review after posting.",
      managerResponsibility: "Desk reviews the result after posting and decides whether the creative direction should continue.",
      userResponsibility: "Otmos records the launch message, finishes the video, and publishes the approved version on TikTok.",
      riskIfLate: "A late launch video leaves less time to learn from audience response before the release campaign advances.",
    });

    expect(() => parseAdaptivePlanOutput(output, validation)).toThrow(/missing execution context/i);
  });

  it("allows concrete non-content human work", () => {
    const output = replanWithTask({
      title: "Attend the booked radio interview with prepared talking points",
      purpose: "Use the confirmed interview to explain Odaeshi's resilience story clearly and create a reusable media proof point.",
      steps: [
        "Arrive at the station 20 minutes before the booked interview and check in with the producer handling the segment.",
        "Keep the Odaeshi story focused on resilience and collective strength, using the three talking points Desk prepared for the conversation.",
        "After the interview, ask the producer for the broadcast or replay link and send it to Desk with any audience feedback you noticed.",
      ],
      completionExpectation: "Desk receives the replay or broadcast link plus a short result note confirming how the interview went.",
      managerResponsibility: "Desk prepares the talking points beforehand, reviews the interview result, and decides how to reuse the strongest angle.",
      userResponsibility: "The artist attends the confirmed interview, delivers the prepared story, and sends Desk the replay link afterward.",
      riskIfLate: "Missing or arriving late to the confirmed slot risks losing the media opportunity and weakening the current release sequence.",
    });

    expect(parseAdaptivePlanOutput(output, validation).tasks).toHaveLength(1);
  });
});

function replanWithTask(task: Partial<Record<string, unknown>>) {
  return {
    decision: "replan",
    reason: "The current route needs replacement human work.",
    whatChanged: "The next human action changed.",
    missionRecommendation: "Run the concrete replacement Task and review the result.",
    planSummary: "One executable human Task before the next decision gate.",
    strategyState: {
      objective: "Make Odaeshi a cultural anthem representing strength and collective unity.",
      strategicThesis: "Lead with lived resilience stories rather than generic song promotion.",
      desiredAudienceBehavior: "People should recognise themselves in the story and respond with their own resilience moments.",
      creativePillars: ["We still stand", "Tough skin stories"],
      culturalMeaning: ["Igbo resilience", "Collective strength"],
      constraints: [],
      scopedBudget: "₦0 for this Task",
      availableResources: ["Phone", "Two friends", "Parked car"],
      horizon: "This week",
      successIndicators: ["Meaningful comments", "Saves", "Shares"],
      rejectedDirections: [],
      guardrails: ["Do not turn resilience into empty motivational copy"],
      updatedBecause: "The next human action needs to be executable.",
    },
    questions: [],
    checkpoints: [{
      key: "creative_response",
      title: "Review creative response",
      question: "Did this creative territory produce enough meaningful response to repeat?",
      decisionRule: "Repeat only if the response supports the resilience-story hypothesis.",
      managerRead: "Desk will review the returned result.",
      nextAction: "Choose repeat, change, or stop.",
      watchedSignals: ["comments", "saves", "shares"],
    }],
    tasks: [{
      title: "Execute the next human action",
      checkpointKey: "creative_response",
      ownerRole: "Artist",
      workMode: "artist_action",
      purpose: "Complete the next concrete action so Desk has a real result to manage from.",
      steps: [
        "Follow the prepared execution brief exactly as written for this Task.",
        "Complete the physical or social action that only the artist can perform.",
        "Return the requested result to Desk so the Manager can review reality.",
      ],
      completionMode: "result_note",
      completionExpectation: "Desk receives the requested real-world result and can make the next management decision from it.",
      managerResponsibility: "Desk prepares the route, reviews the result, and decides what happens next without asking the artist to plan it.",
      userResponsibility: "The artist performs the specified human action and returns the exact result Desk requested for review.",
      riskIfLate: "Delay reduces the time available for Desk to learn from the result and adapt the active Mission while it still matters.",
      availableFrom: "",
      deadline: "",
      estimatedMinutes: 40,
      ...task,
    }],
    permissionRequests: [],
  };
}
