// Pure copy builders for push notifications — maps a knockout match number to a
// human round label and assembles the alert title/body. No env or DB, so it's
// unit-tested directly. Match numbering: R32 73–88, R16 89–96, QF 97–100,
// SF 101–102, bronze 103, final 104 (see CLAUDE.md).

export function knockoutRoundLabel(matchNo: number): string {
  if (matchNo >= 73 && matchNo <= 88) return "Round of 32";
  if (matchNo >= 89 && matchNo <= 96) return "Round of 16";
  if (matchNo >= 97 && matchNo <= 100) return "Quarter-final";
  if (matchNo === 101 || matchNo === 102) return "Semi-final";
  if (matchNo === 103) return "Third-place play-off";
  if (matchNo === 104) return "Final";
  return "Knockout";
}

export interface PushCopy {
  title: string;
  body: string;
}

// The notification fired when a knockout result is recorded. The final gets its
// own celebratory copy; every other round nudges players back to the leaderboard.
export function knockoutResultPush(matchNo: number, winnerName: string): PushCopy {
  if (matchNo === 104) {
    return {
      title: "🏆 We have a champion!",
      body: `${winnerName} win the World Cup — see the final standings.`,
    };
  }
  return {
    title: `⚽ ${knockoutRoundLabel(matchNo)} result`,
    body: `${winnerName} advance. See how your bracket's holding up.`,
  };
}
