import { describe, it, expect } from "vitest";
import { computeGroupTables, type GroupResultRow } from "./group-table";
import { provisionalStandings, type GroupTableRow } from "./group-table";

// Group A = ["MEX", "RSA", "KOR", "CZE"]
const m = (homeCode: string, awayCode: string, homeScore: number, awayScore: number): GroupResultRow => ({
  homeCode,
  awayCode,
  homeScore,
  awayScore,
});

const rankOf = (rows: ReturnType<typeof computeGroupTables>["A"], code: string) =>
  rows.find((r) => r.code === code)!;

describe("computeGroupTables", () => {
  it("ranks by points, then GD, then goals scored", () => {
    // MEX 3pts (+1), KOR 3pts (+1) but KOR scored more; RSA/CZE 0 pts.
    const t = computeGroupTables([
      m("MEX", "RSA", 1, 0), // MEX +1, 1 GF
      m("KOR", "CZE", 3, 2), // KOR +1, 3 GF
    ]).A;
    expect(t.map((r) => r.code)).toEqual(["KOR", "MEX", "CZE", "RSA"]);
    expect(rankOf(t, "KOR").rank).toBe(1);
    expect(rankOf(t, "MEX").rank).toBe(2);
    expect(rankOf(t, "KOR").tied).toBe(false);
  });

  it("breaks an overall tie by head-to-head result", () => {
    // MEX & KOR both 1-0 over the others (3pts, +1, 1 GF). Head-to-head: MEX beat KOR.
    const t = computeGroupTables([
      m("MEX", "RSA", 1, 0),
      m("KOR", "CZE", 1, 0),
      m("MEX", "KOR", 1, 0), // H2H decides
    ]).A;
    expect(rankOf(t, "MEX").rank).toBe(1);
    expect(rankOf(t, "KOR").rank).toBe(2);
    expect(rankOf(t, "MEX").tied).toBe(false);
  });

  it("flags all three tied in a head-to-head cycle", () => {
    // MEX>RSA, RSA>KOR, KOR>MEX — each 3pts, GD 0, 1 GF; H2H among them all equal.
    const t = computeGroupTables([
      m("MEX", "RSA", 1, 0),
      m("RSA", "KOR", 1, 0),
      m("KOR", "MEX", 1, 0),
    ]).A;
    expect(rankOf(t, "MEX").tied).toBe(true);
    expect(rankOf(t, "RSA").tied).toBe(true);
    expect(rankOf(t, "KOR").tied).toBe(true);
    expect(rankOf(t, "MEX").rank).toBe(1);
    expect(rankOf(t, "RSA").rank).toBe(1);
    expect(rankOf(t, "KOR").rank).toBe(1);
    // CZE played nothing → behind the cycle at rank 4.
    expect(rankOf(t, "CZE").rank).toBe(4);
  });

  it("ignores invalid pairs and rows missing a score", () => {
    const t = computeGroupTables([
      m("MEX", "BRA", 5, 0), // BRA not in group A → ignored
      { homeCode: "MEX", awayCode: "RSA", homeScore: 1, awayScore: null as unknown as number },
    ]).A;
    // No counted matches → everyone 0/0/0 and tied at rank 1.
    expect(t.every((r) => r.played === 0)).toBe(true);
    expect(t.every((r) => r.tied)).toBe(true);
  });

  it("returns a table for every one of the 12 groups", () => {
    const tables = computeGroupTables([]);
    expect(Object.keys(tables).sort()).toEqual(
      ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"],
    );
  });
});

const tableRow = (over: Partial<GroupTableRow> & { code: string; rank: number }): GroupTableRow => ({
  played: 3,
  w: 0,
  d: 0,
  l: 0,
  gf: 0,
  ga: 0,
  gd: 0,
  pts: 0,
  tied: false,
  form: "",
  ...over,
});

describe("provisionalStandings", () => {
  it("fills unique 1st/2nd and omits tied positions", () => {
    const tables = {
      A: [
        tableRow({ code: "MEX", rank: 1 }),
        tableRow({ code: "RSA", rank: 2 }),
        tableRow({ code: "KOR", rank: 3 }),
        tableRow({ code: "CZE", rank: 4 }),
      ],
      B: [
        // 1st is a 2-way tie -> no 1st AND no 2nd derivable for B.
        tableRow({ code: "CAN", rank: 1, tied: true }),
        tableRow({ code: "BIH", rank: 1, tied: true }),
        tableRow({ code: "QAT", rank: 3 }),
        tableRow({ code: "SUI", rank: 4 }),
      ],
    } as Record<string, GroupTableRow[]>;

    const s = provisionalStandings(tables);
    expect(s.groupFirst.A).toBe("MEX");
    expect(s.groupSecond.A).toBe("RSA");
    expect(s.groupFirst.B).toBeUndefined();
    expect(s.groupSecond.B).toBeUndefined();
  });

  it("selects the best third-place teams by pts then GD then goals", () => {
    const tables = {
      A: [tableRow({ code: "KOR", rank: 3, pts: 4, gd: 2, gf: 5 })],
      B: [tableRow({ code: "QAT", rank: 3, pts: 4, gd: 1, gf: 5 })],
      C: [tableRow({ code: "HAI", rank: 3, pts: 3, gd: 0, gf: 2 })],
    } as Record<string, GroupTableRow[]>;

    const s = provisionalStandings(tables);
    // All 3 fit under the cap of 8; order is best-first.
    expect(s.thirdAdvance).toEqual(["KOR", "QAT", "HAI"]);
  });

  it("drops a tie straddling the 8-team cutoff", () => {
    // 9 third-place teams: ranks 1-7 distinct, then TWO tied on the 8th/9th key.
    const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
    const tables: Record<string, GroupTableRow[]> = {};
    groups.forEach((g, i) => {
      const pts = i < 7 ? 9 - i : 1; // first 7 strictly descending; last two both pts 1
      tables[g] = [tableRow({ code: `T${i}`, rank: 3, pts, gd: 0, gf: 0 })];
    });
    const s = provisionalStandings(tables);
    // 7 clear qualifiers; the 8th slot is contested by two equal teams -> both dropped.
    expect(s.thirdAdvance).toHaveLength(7);
    expect(s.thirdAdvance).toEqual(["T0", "T1", "T2", "T3", "T4", "T5", "T6"]);
  });
});

describe("group-table form", () => {
  const mn = (
    homeCode: string,
    awayCode: string,
    homeScore: number,
    awayScore: number,
    matchNo: number,
  ): GroupResultRow => ({ homeCode, awayCode, homeScore, awayScore, matchNo });

  it("renders each team's W/D/L in match order, not grouped by result", () => {
    // MEX: matchNo 1 loss, 2 win, 3 draw — chronological "LWD" (grouped logic gave "WDL").
    // Rows deliberately out of order to prove sorting is by matchNo.
    const t = computeGroupTables([
      mn("MEX", "KOR", 2, 0, 2), // MEX W (2nd)
      mn("MEX", "CZE", 1, 1, 3), // MEX D (3rd)
      mn("RSA", "MEX", 1, 0, 1), // MEX L (1st, away)
    ]).A;
    expect(rankOf(t, "MEX").form).toBe("LWD");
  });

  it("orders form by real kickoff, not matchNo (a group's pairings aren't chronological)", () => {
    // KOR's group-A matches: matchNo 2 (Jun 19), 4 (Jun 25), 6 (Jun 12). matchNo
    // order would give "LWD"; real kickoff order is m6, m2, m4 → "DLW".
    const t = computeGroupTables([
      mn("MEX", "KOR", 1, 0, 2), // KOR L  — Jun 19
      mn("RSA", "KOR", 0, 1, 4), // KOR W  — Jun 25
      mn("KOR", "CZE", 1, 1, 6), // KOR D  — Jun 12
    ]).A;
    expect(rankOf(t, "KOR").form).toBe("DLW");
  });

  it("covers only played matches and falls back to input order without matchNo", () => {
    const t = computeGroupTables([
      m("MEX", "RSA", 0, 2), // MEX L, RSA W
      m("KOR", "MEX", 3, 1), // MEX L, KOR W
    ]).A;
    expect(rankOf(t, "MEX").form).toBe("LL");
    expect(rankOf(t, "RSA").form).toBe("W");
  });
});
