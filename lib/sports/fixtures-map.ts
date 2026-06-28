// Bridge from the sports provider's identifiers to ours.
//
// Knockouts: this static fixture-id map is now an OPTIONAL override. The score poller
// (lib/sports/poll.ts) primarily maps a knockout fixture to our match by the two
// teams playing — buildKnockoutPairMatchNos() reads the resolved bracket — so live
// and finished knockout matches map correctly even while this stays empty. Populate
// it (scripts/generate-fixtures-map.ts, re-run once groups resolve) only to pin a
// fixture whose team-pair lookup is ambiguous; an entry here wins over the pair map.
// The winner is derived from the live score plus EXTERNAL_TEAM_CODES.

// provider fixture id (string) -> internal match number (optional knockout override)
export const EXTERNAL_TO_MATCHNO: Record<string, number> = {};

// provider team id (string) -> our 3-letter team code (e.g. "MEX")
export const EXTERNAL_TEAM_CODES: Record<string, string> = {
  "1532": "ALG",
  "26": "ARG",
  "20": "AUS",
  "775": "AUT",
  "1": "BEL",
  "1113": "BIH",
  "6": "BRA",
  "5529": "CAN",
  "1501": "CIV",
  "1508": "COD",
  "8": "COL",
  "1533": "CPV",
  "3": "CRO",
  "5530": "CUW",
  "770": "CZE",
  "2382": "ECU",
  "32": "EGY",
  "10": "ENG",
  "9": "ESP",
  "2": "FRA",
  "25": "GER",
  "1504": "GHA",
  "2386": "HAI",
  "22": "IRN",
  "1567": "IRQ",
  "1548": "JOR",
  "12": "JPN",
  "17": "KOR",
  "23": "KSA",
  "31": "MAR",
  "16": "MEX",
  "1118": "NED",
  "1090": "NOR",
  "4673": "NZL",
  "11": "PAN",
  "2380": "PAR",
  "27": "POR",
  "1569": "QAT",
  "1531": "RSA",
  "1108": "SCO",
  "13": "SEN",
  "15": "SUI",
  "5": "SWE",
  "28": "TUN",
  "777": "TUR",
  "7": "URU",
  "2384": "USA",
  "1568": "UZB",
};
