// ─────────────────────────────────────────────────────────────
//  THE FRIENDS LIST — edit this file to add or remove people.
// ─────────────────────────────────────────────────────────────
//
//  Each person needs:
//    name      what shows on their card. "maria (beyoncé)" shows "beyoncé" as a nickname line.
//    timezone  an IANA timezone name, e.g. "Europe/London"
//              full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
//
//  Optional:
//    place     the label under their name (defaults to the city in the timezone)
//    photo     a profile picture in the photos/ folder, e.g. "photos/liya.jpg"
//              (if the file is missing, their initial shows instead)
//    emoji     shown in their bubble instead of their initial when there's no photo, e.g. "🦢"
//    tag       a tiny label on their card, e.g. "🎶 music girl" or a group joke
//
//  Keep the commas between entries. Order doesn't matter — the site sorts by local time.
//  Lines starting with // are ignored, so you can "hide" someone that way.

const PEOPLE = [
  { name: "liya",                 place: "US (Pacific)",  timezone: "America/Los_Angeles", photo: "photos/liya.jpg" },
  { name: "tori",                 place: "US (Eastern)",  timezone: "America/New_York",    photo: "photos/tori.jpg" },
  { name: "mac",                  place: "US (Eastern)",  timezone: "America/New_York",    photo: "photos/mac.jpg" },
  // { name: "becca",             place: "US",            timezone: "America/Chicago",     photo: "photos/becca.jpg" },  // TODO: which US timezone?
  { name: "andrea",               place: "Mexico",        timezone: "America/Mexico_City", photo: "photos/andrea.jpg" },
  { name: "lu",                   place: "Peru",          timezone: "America/Lima",        photo: "photos/lu.jpg" },
  { name: "gabi",                 place: "Brazil",        timezone: "America/Sao_Paulo",   photo: "photos/gabi.jpg" },
  { name: "bia",                  place: "Brazil",        timezone: "America/Sao_Paulo",   photo: "photos/bia.jpg" },
  { name: "el",                   place: "UK",            timezone: "Europe/London",       photo: "photos/el.jpg" },
  { name: "char",                 place: "France",        timezone: "Europe/Paris",        photo: "photos/char.jpg" },
  { name: "val",                  place: "Colombia",      timezone: "America/Bogota",      photo: "photos/val.jpg" },
  { name: "maria (kidsmanlover)", place: "Austria",       timezone: "Europe/Vienna",       photo: "photos/maria-kidsmanlover.jpg" },
  { name: "maria (beyoncé)",      place: "Netherlands",   timezone: "Europe/Amsterdam",    photo: "photos/maria-beyonce.jpg" },
  { name: "vynn",                 place: "Singapore",     timezone: "Asia/Singapore",      photo: "photos/vynn.jpg" },
  { name: "gretch",               place: "Philippines",   timezone: "Asia/Manila",         photo: "photos/gretch.jpg" },
  { name: "vania",                place: "Australia",     timezone: "Australia/Sydney" },
];
