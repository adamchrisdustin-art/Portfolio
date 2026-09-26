/** Full state name (as CMS writes it, any case) -> two-letter code, for the 50 states and DC. Territories are left out. */
const NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  "district of columbia": "DC", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT",
  vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

/** Two-letter code for a state name, or null for territories, totals and anything unrecognized. */
export function stateCode(name: string | null | undefined): string | null {
  return NAMES[(name ?? "").trim().replace(/\s+/g, " ").toLowerCase()] ?? null;
}

/** The 50 states and DC as two-letter codes, for filtering sources that also report territories. */
export const STATE_CODES: ReadonlySet<string> = new Set(Object.values(NAMES));
