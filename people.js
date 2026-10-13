// ─────────────────────────────────────────────────────────────
//  THE FRIENDS LIST — edit this file to add or remove people.
// ─────────────────────────────────────────────────────────────
//
//  Each person needs:
//    name      what shows on their card
//    timezone  an IANA timezone name, e.g. "Europe/London"
//              full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
//
//  Optional:
//    place     the label under their name (defaults to the city in the timezone)
//
//  Keep the commas between entries. Order doesn't matter — the site sorts by local time.
//  Lines starting with // are ignored, so you can "hide" someone that way.

const PEOPLE = [
  { name: "liya",                 place: "US (Pacific)",  timezone: "America/Los_Angeles" },
  { name: "tori",                 place: "US (Eastern)",  timezone: "America/New_York" },
  { name: "mac",                  place: "US (Eastern)",  timezone: "America/New_York" },
  // { name: "becca",             place: "US",            timezone: "America/Chicago" },  // TODO: which US timezone?
  { name: "andrea",               place: "Mexico",        timezone: "America/Mexico_City" },
  { name: "lu",                   place: "Peru",          timezone: "America/Lima" },
  { name: "gabi",                 place: "Brazil",        timezone: "America/Sao_Paulo" },
  { name: "bia",                  place: "Brazil",        timezone: "America/Sao_Paulo" },
  { name: "el",                   place: "UK",            timezone: "Europe/London" },
  { name: "char",                 place: "France",        timezone: "Europe/Paris" },
  { name: "val",                  place: "Colombia",      timezone: "America/Bogota" },
  { name: "maria (kidsmanlover)", place: "Austria",       timezone: "Europe/Vienna" },
  { name: "maria (beyoncé)",      place: "Netherlands",   timezone: "Europe/Amsterdam" },
  { name: "vynn",                 place: "Singapore",     timezone: "Asia/Singapore" },
  { name: "gretch",               place: "Philippines",   timezone: "Asia/Manila" },
  { name: "vania",                place: "Australia",     timezone: "Australia/Sydney" },
];
