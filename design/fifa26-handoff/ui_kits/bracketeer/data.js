// Minimal slice of the WC2026 data used by the UI kit. Real source of truth
// lives in bracketeer/lib/scoring/data.ts — we mirror just enough here to
// drive the visual recreation.

const FLAG = {
  MEX:"🇲🇽", RSA:"🇿🇦", KOR:"🇰🇷", CZE:"🇨🇿",
  CAN:"🇨🇦", BIH:"🇧🇦", QAT:"🇶🇦", SUI:"🇨🇭",
  BRA:"🇧🇷", MAR:"🇲🇦", HAI:"🇭🇹", SCO:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  USA:"🇺🇸", PAR:"🇵🇾", AUS:"🇦🇺", TUR:"🇹🇷",
  GER:"🇩🇪", CUW:"🇨🇼", CIV:"🇨🇮", ECU:"🇪🇨",
  NED:"🇳🇱", JPN:"🇯🇵", SWE:"🇸🇪", TUN:"🇹🇳",
  BEL:"🇧🇪", EGY:"🇪🇬", IRN:"🇮🇷", NZL:"🇳🇿",
  ESP:"🇪🇸", CPV:"🇨🇻", KSA:"🇸🇦", URU:"🇺🇾",
  FRA:"🇫🇷", SEN:"🇸🇳", IRQ:"🇮🇶", NOR:"🇳🇴",
  ARG:"🇦🇷", ALG:"🇩🇿", AUT:"🇦🇹", JOR:"🇯🇴",
  POR:"🇵🇹", COD:"🇨🇩", UZB:"🇺🇿", COL:"🇨🇴",
  ENG:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", CRO:"🇭🇷", GHA:"🇬🇭", PAN:"🇵🇦",
};

const TEAMS = {
  MEX:"Mexico", RSA:"South Africa", KOR:"Korea Rep.", CZE:"Czechia",
  CAN:"Canada", BIH:"Bosnia", QAT:"Qatar", SUI:"Switzerland",
  BRA:"Brazil", MAR:"Morocco", HAI:"Haiti", SCO:"Scotland",
  USA:"USA", PAR:"Paraguay", AUS:"Australia", TUR:"Türkiye",
  GER:"Germany", CUW:"Curaçao", CIV:"Côte d'Ivoire", ECU:"Ecuador",
  NED:"Netherlands", JPN:"Japan", SWE:"Sweden", TUN:"Tunisia",
  BEL:"Belgium", EGY:"Egypt", IRN:"IR Iran", NZL:"New Zealand",
  ESP:"Spain", CPV:"Cabo Verde", KSA:"Saudi Arabia", URU:"Uruguay",
  FRA:"France", SEN:"Senegal", IRQ:"Iraq", NOR:"Norway",
  ARG:"Argentina", ALG:"Algeria", AUT:"Austria", JOR:"Jordan",
  POR:"Portugal", COD:"Congo DR", UZB:"Uzbekistan", COL:"Colombia",
  ENG:"England", CRO:"Croatia", GHA:"Ghana", PAN:"Panama",
};

const GROUPS = {
  A: ["MEX","RSA","KOR","CZE"],
  B: ["CAN","BIH","QAT","SUI"],
  C: ["BRA","MAR","HAI","SCO"],
  D: ["USA","PAR","AUS","TUR"],
  E: ["GER","CUW","CIV","ECU"],
  F: ["NED","JPN","SWE","TUN"],
  G: ["BEL","EGY","IRN","NZL"],
  H: ["ESP","CPV","KSA","URU"],
  I: ["FRA","SEN","IRQ","NOR"],
  J: ["ARG","ALG","AUT","JOR"],
  K: ["POR","COD","UZB","COL"],
  L: ["ENG","CRO","GHA","PAN"],
};

const team = (code) => ({ code, name: TEAMS[code], flag: FLAG[code] });

const SAMPLE_LEADERBOARD = [
  { entryId: "1", rank: 1, label: "Dom", initials: "DM", avatarColor: "city-houston", total: 84, projected: 3, isLeader: true,
    breakdown: [{label:"Groups",value:36},{label:"R32",value:12},{label:"R16",value:16},{label:"QF",value:9},{label:"SF",value:8},{label:"Awards",value:3}] },
  { entryId: "2", rank: 2, label: "Sam Williams", initials: "SW", avatarColor: "city-philadelphia", total: 81, isYou: true,
    breakdown: [{label:"Groups",value:34},{label:"R32",value:11},{label:"R16",value:14},{label:"QF",value:12},{label:"SF",value:8},{label:"Awards",value:2}] },
  { entryId: "3", rank: 3, label: "Mara", initials: "MR", avatarColor: "city-guadalajara", total: 78,
    breakdown: [{label:"Groups",value:33},{label:"R32",value:10},{label:"R16",value:14},{label:"QF",value:9},{label:"SF",value:8},{label:"Awards",value:4}] },
  { entryId: "4", rank: 4, label: "Tyler", initials: "TY", avatarColor: "city-toronto", total: 72,
    breakdown: [{label:"Groups",value:31},{label:"R32",value:9},{label:"R16",value:12},{label:"QF",value:9},{label:"SF",value:8},{label:"Awards",value:3}] },
  { entryId: "5", rank: 5, label: "Priya", initials: "PR", avatarColor: "city-atlanta", total: 69,
    breakdown: [{label:"Groups",value:30},{label:"R32",value:8},{label:"R16",value:12},{label:"QF",value:9},{label:"SF",value:8},{label:"Awards",value:2}] },
  { entryId: "6", rank: 6, label: "Kai", initials: "KA", avatarColor: "city-los-angeles", total: 64,
    breakdown: [{label:"Groups",value:28},{label:"R32",value:9},{label:"R16",value:10},{label:"QF",value:9},{label:"SF",value:6},{label:"Awards",value:2}] },
  { entryId: "7", rank: 7, label: "Jess", initials: "JE", avatarColor: "city-vancouver", total: 61,
    breakdown: [{label:"Groups",value:27},{label:"R32",value:8},{label:"R16",value:10},{label:"QF",value:8},{label:"SF",value:6},{label:"Awards",value:2}] },
  { entryId: "8", rank: 8, label: "Marco", initials: "MA", avatarColor: "city-monterrey", total: 58,
    breakdown: [{label:"Groups",value:26},{label:"R32",value:7},{label:"R16",value:9}] },
];

const SAMPLE_MATCHES = {
  live: [
    { matchNo: 73, round: "R32", kickoff: "Sat Jun 27 · 15:00 ET", status: "live", minute: 67, accent: "city-philadelphia",
      home: team("BRA"), away: team("CRO"), home_score: 2, away_score: 1, pickedCode: "BRA" },
    { matchNo: 75, round: "R32", kickoff: "Sun Jun 28 · 12:00 ET", status: "upcoming", accent: "city-houston",
      home: team("NED"), away: team("MAR"), pickedCode: "NED" },
  ],
  final: [
    { matchNo: 89, round: "R16", kickoff: "Sat Jul 4 · 19:00 ET", status: "final", accent: "city-los-angeles",
      home: team("FRA"), away: team("SEN"), home_score: 3, away_score: 1, winnerCode: "FRA", pickedCode: "FRA", pointsEarned: 2 },
    { matchNo: 90, round: "R16", kickoff: "Sat Jul 4 · 15:00 ET", status: "final", accent: "city-los-angeles",
      home: team("ARG"), away: team("URU"), home_score: 1, away_score: 2, winnerCode: "URU", pickedCode: "ARG", pointsEarned: 0 },
  ],
};

const SAMPLE_GROUPS = [
  { group: "A", first: "Mexico", second: "Czechia" },
  { group: "B", first: "Switzerland", second: "Canada" },
  { group: "C", first: "Brazil", second: "Morocco" },
  { group: "D", first: "USA", second: "Türkiye" },
  { group: "E", first: "Germany", second: "Ecuador" },
  { group: "F", first: "Netherlands", second: "Japan" },
  { group: "G", first: "Belgium", second: "IR Iran" },
  { group: "H", first: "Spain", second: "Uruguay" },
  { group: "I", first: "France", second: "Norway" },
  { group: "J", first: "Argentina", second: "Austria" },
  { group: "K", first: "Portugal", second: "Colombia" },
  { group: "L", first: "England", second: "Croatia" },
];

const SAMPLE_THIRDS = ["KOR","SCO","CIV","EGY","SEN","CPV","UZB","GHA"];

const SAMPLE_MESSAGES = [
  { id: "m1", body: "kane goal — that's +3", userId: "u2", authorName: "Sam", authorColor: "city-philadelphia", createdAt: "2026-06-27T18:14:00Z" },
  { id: "m2", body: "neuer save…", userId: "u3", authorName: "Mara", authorColor: "city-guadalajara", createdAt: "2026-06-27T18:14:20Z" },
  { id: "m3", body: "cope. brazil's been chasing this all match.", userId: "u1", authorName: "you", createdAt: "2026-06-27T18:14:32Z", mine: true },
  { id: "m4", body: "wait who picked CRO 😅", userId: "u4", authorName: "Tyler", authorColor: "city-toronto", createdAt: "2026-06-27T18:15:01Z" },
  { id: "m5", body: "🙋", userId: "u1", authorName: "you", createdAt: "2026-06-27T18:15:08Z", mine: true },
];

// A small slate of group-stage matches to drive the picks wizard.
const PICK_QUEUE = [
  { matchNo: 1,  group: "A", kickoff: "Thu Jun 11 · 20:00 ET", home: team("MEX"), away: team("KOR") },
  { matchNo: 2,  group: "A", kickoff: "Fri Jun 12 · 12:00 ET", home: team("RSA"), away: team("CZE") },
  { matchNo: 3,  group: "B", kickoff: "Fri Jun 12 · 16:00 ET", home: team("CAN"), away: team("QAT") },
  { matchNo: 4,  group: "B", kickoff: "Fri Jun 12 · 20:00 ET", home: team("BIH"), away: team("SUI") },
  { matchNo: 5,  group: "C", kickoff: "Sat Jun 13 · 12:00 ET", home: team("BRA"), away: team("HAI") },
  { matchNo: 6,  group: "C", kickoff: "Sat Jun 13 · 16:00 ET", home: team("MAR"), away: team("SCO") },
  { matchNo: 7,  group: "D", kickoff: "Sat Jun 13 · 20:00 ET", home: team("USA"), away: team("AUS") },
  { matchNo: 8,  group: "D", kickoff: "Sun Jun 14 · 12:00 ET", home: team("PAR"), away: team("TUR") },
];

window.DATA = {
  FLAG, TEAMS, GROUPS, team,
  SAMPLE_LEADERBOARD, SAMPLE_MATCHES, SAMPLE_GROUPS, SAMPLE_THIRDS,
  SAMPLE_MESSAGES, PICK_QUEUE,
};
