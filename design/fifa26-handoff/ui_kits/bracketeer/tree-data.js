/* Sample knockout tree data — 16 R32 + 8 R16 + 4 QF + 2 SF + 1 Final + 1 Bronze.
   Mirrors lib/scoring/data.ts match numbering: R32 = 73-88, R16 = 89-96,
   QF = 97-100, SF = 101-102, Bronze = 103, Final = 104. */

function mk(matchNo, home, away, opts = {}) {
  return { matchNo, home, away, ...opts };
}
const T = (code, name) => ({ code, name });

const _R32 = [
  mk(73, T("MEX","Mexico"),       T("SUI","Switzerland"), { status: "final", homeScore: 1, awayScore: 2, winnerCode: "SUI" }),
  mk(74, T("GER","Germany"),      T("KOR","Korea Rep."),  { status: "final", homeScore: 3, awayScore: 1, winnerCode: "GER" }),
  mk(75, T("NED","Netherlands"),  T("MAR","Morocco"),     { status: "final", homeScore: 2, awayScore: 0, winnerCode: "NED" }),
  mk(76, T("BRA","Brazil"),       T("JPN","Japan"),       { status: "final", homeScore: 3, awayScore: 1, winnerCode: "BRA" }),
  mk(77, T("FRA","France"),       T("EGY","Egypt"),       { status: "final", homeScore: 4, awayScore: 0, winnerCode: "FRA" }),
  mk(78, T("CUW","Curaçao"),      T("NOR","Norway"),      { status: "final", homeScore: 0, awayScore: 2, winnerCode: "NOR" }),
  mk(79, T("MEX","Mexico"),       T("CIV","Côte d'Ivoire"),{ status: "final", homeScore: 2, awayScore: 1, winnerCode: "MEX" }),
  mk(80, T("ENG","England"),      T("URU","Uruguay"),     { status: "final", homeScore: 2, awayScore: 2, winnerCode: "ENG" }),
  mk(81, T("USA","USA"),          T("BEL","Belgium"),     { status: "final", homeScore: 1, awayScore: 2, winnerCode: "BEL" }),
  mk(82, T("BEL","Belgium"),      T("ALG","Algeria"),     { status: "final", homeScore: 3, awayScore: 0, winnerCode: "BEL" }),
  mk(83, T("COL","Colombia"),     T("PAN","Panama"),      { status: "final", homeScore: 2, awayScore: 0, winnerCode: "COL" }),
  mk(84, T("ESP","Spain"),        T("AUT","Austria"),     { status: "live",  minute: 67, homeScore: 1, awayScore: 1 }),
  mk(85, T("CAN","Canada"),       T("SEN","Senegal"),     { status: "final", homeScore: 1, awayScore: 0, winnerCode: "CAN" }),
  mk(86, T("ARG","Argentina"),    T("URU","Uruguay"),     { status: "final", homeScore: 2, awayScore: 1, winnerCode: "ARG" }),
  mk(87, T("POR","Portugal"),     T("UZB","Uzbekistan"),  { status: "final", homeScore: 3, awayScore: 0, winnerCode: "POR" }),
  mk(88, T("USA","USA"),          T("NZL","New Zealand"), { status: "final", homeScore: 4, awayScore: 1, winnerCode: "USA" }),
];

const _R16 = [
  mk(89, T("FRA","France"),       T("NOR","Norway"),     { status: "final", homeScore: 3, awayScore: 1, winnerCode: "FRA" }),
  mk(90, T("SUI","Switzerland"),  T("NED","Netherlands"),{ status: "final", homeScore: 0, awayScore: 1, winnerCode: "NED" }),
  mk(91, T("BRA","Brazil"),       T("GER","Germany"),    { status: "live",  minute: 23, homeScore: 1, awayScore: 0 }),
  mk(92, T("MEX","Mexico"),       T("ENG","England"),    { status: "upcoming", kickoff: "Tue Jul 7" }),
  mk(93, T("BEL","Belgium"),      T("ARG","Argentina"),  { status: "upcoming", kickoff: "Wed Jul 8" }),
  mk(94, T("COL","Colombia"),     T("ESP","Spain"),      { status: "upcoming", kickoff: "Wed Jul 8" }),
  mk(95, T("CAN","Canada"),       T("POR","Portugal"),   { status: "upcoming", kickoff: "Thu Jul 9" }),
  mk(96, T("USA","USA"),          T("AUT","Austria"),    { status: "upcoming", kickoff: "Thu Jul 9" }),
];

const _QF = [
  mk(97,  T("FRA","France"),     T("NED","Netherlands"), { status: "upcoming", kickoff: "Sat Jul 11" }),
  mk(98,  T("BRA","Brazil"),     T("MEX","Mexico"),      { status: "upcoming", kickoff: "Sat Jul 11" }),
  mk(99,  T("BEL","Belgium"),    T("ESP","Spain"),       { status: "upcoming", kickoff: "Sun Jul 12" }),
  mk(100, T("POR","Portugal"),   T("USA","USA"),         { status: "upcoming", kickoff: "Sun Jul 12" }),
];

const _SF = [
  mk(101, T("Winner 97","TBD"),  T("Winner 98","TBD"),   { status: "upcoming", kickoff: "Tue Jul 14" }),
  mk(102, T("Winner 99","TBD"),  T("Winner 100","TBD"),  { status: "upcoming", kickoff: "Wed Jul 15" }),
];

const _FINAL = [
  mk(104, T("Winner 101","TBD"), T("Winner 102","TBD"),  { status: "upcoming", kickoff: "Sun Jul 19" }),
];

const _BRONZE = mk(103, T("Loser 101","TBD"), T("Loser 102","TBD"), { status: "upcoming", kickoff: "Sat Jul 18" });

window.DATA = window.DATA || {};
window.DATA.SAMPLE_TREE = {
  rounds: { r32: _R32, r16: _R16, qf: _QF, sf: _SF, final: _FINAL },
  bronze: _BRONZE,
};
