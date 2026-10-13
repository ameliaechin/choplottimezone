(function () {
  "use strict";

  // Awake hours, in each person's local time: from 8:00 up to (not including) 23:00.
  const AWAKE_FROM = 8;
  const AWAKE_UNTIL = 23;

  const HOUR = 3600000;
  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const ICON_MOON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z"/></svg>';

  // ── Timezone helpers (all built on Intl, so DST is automatic) ──────────

  const formatterCache = new Map();
  function formatter(timeZone, options, locale) {
    const key = timeZone + "|" + (locale || "") + "|" + JSON.stringify(options);
    let f = formatterCache.get(key);
    if (!f) {
      f = new Intl.DateTimeFormat(locale, Object.assign({ timeZone: timeZone }, options));
      formatterCache.set(key, f);
    }
    return f;
  }

  function isValidTimeZone(tz) {
    try {
      formatter(tz, { hour: "numeric" });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Wall-clock fields for an instant in a timezone.
  function zonedParts(date, tz) {
    const f = formatter(tz, {
      year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric",
      hourCycle: "h23",
    }, "en-US");
    const p = {};
    for (const part of f.formatToParts(date)) p[part.type] = part.value;
    return {
      year: +p.year, month: +p.month, day: +p.day,
      hour: +p.hour % 24, minute: +p.minute, second: +p.second,
    };
  }

  // Minutes the timezone is ahead of UTC at that instant (e.g. -420 for PDT).
  function offsetMinutes(date, tz) {
    const p = zonedParts(date, tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const whole = Math.floor(date.getTime() / 1000) * 1000;
    return Math.round((asUtc - whole) / 60000);
  }

  // The instant when the wall clock in `tz` reads the given date and time.
  function zonedToInstant(year, month, day, hour, minute, tz) {
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    const off1 = offsetMinutes(new Date(guess), tz);
    let t = guess - off1 * 60000;
    const off2 = offsetMinutes(new Date(t), tz);
    if (off2 !== off1) {
      t = guess - off2 * 60000;
      // In a spring-forward gap (e.g. 2:30am that never happens), jump ahead past it.
      const p = zonedParts(new Date(t), tz);
      if (p.hour !== hour || p.minute !== minute) t = guess - Math.min(off1, off2) * 60000;
    }
    return new Date(t);
  }

  // Calendar-day difference between two timezones at an instant (-1, 0, +1).
  function dayDiff(date, tz, relativeToTz) {
    const a = zonedParts(date, tz);
    const b = zonedParts(date, relativeToTz);
    return Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / 86400000);
  }

  function isAwakeAt(date, tz) {
    const h = zonedParts(date, tz).hour;
    return h >= AWAKE_FROM && h < AWAKE_UNTIL;
  }

  const fmtTime = (d, tz) => formatter(tz, { hour: "numeric", minute: "2-digit" }).format(d);
  const fmtHour = (d, tz) => formatter(tz, { hour: "numeric" }).format(d);
  const fmtWeekday = (d, tz) => formatter(tz, { weekday: "long" }).format(d);
  const fmtShortDay = (d, tz) => formatter(tz, { weekday: "short", month: "short", day: "numeric" }).format(d);

  function tzAbbrev(date, tz) {
    const part = formatter(tz, { timeZoneName: "short" })
      .formatToParts(date).find((p) => p.type === "timeZoneName");
    return part ? part.value : "";
  }

  function cityFromTz(tz) {
    return tz.split("/").pop().replace(/_/g, " ");
  }

  function relDayLabel(diff) {
    if (diff === 0) return "";
    if (diff === 1) return "tomorrow";
    if (diff === -1) return "yesterday";
    return (diff > 0 ? "+" : "") + diff + " days";
  }

  function offsetLabel(minutes) {
    if (minutes === 0) return "same as you";
    const sign = minutes > 0 ? "+" : "−";
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return sign + h + (m ? ":" + String(m).padStart(2, "0") : "") + "h";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function localMinute(date, tz) {
    const p = zonedParts(date, tz);
    return p.hour * 60 + p.minute;
  }

  // ── Sky colors ─────────────────────────────────────────────────────────
  // The sky at each local minute of the day, blended smoothly between these
  // keyframes: [minute of day, top-of-sky color, horizon color].
  const SKY = [
    [0,    "#0f1433", "#232a5c"],
    [270,  "#141a40", "#2a2f66"], // 4:30 still night
    [345,  "#2c2f6e", "#a3587a"], // 5:45 first light
    [405,  "#6a7fc4", "#ffb38a"], // 6:45 sunrise
    [480,  "#a9d1ff", "#ffe6cc"], // 8:00 morning
    [720,  "#9fd0ff", "#e6f4ff"], // noon
    [960,  "#b3d8ff", "#fff0d6"], // 4pm
    [1065, "#ffd39b", "#ffad94"], // 5:45 golden hour
    [1140, "#7a4f9a", "#f08a6e"], // 7pm sunset
    [1200, "#3a3075", "#a9506f"], // 8pm dusk
    [1290, "#18204a", "#2c2f63"], // 9:30 night
    [1440, "#0f1433", "#232a5c"],
  ];
  const DARK_MIX = "#0b0d1e"; // dark mode deepens every sky toward this
  const INK_DARK = "#13203a";

  // Colors blend in OKLab so sunrise goes peach → gold instead of through gray.
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const toLinear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const fromLinear = (c) => {
    const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };
  function hexToOklab(hex) {
    const [r, g, b] = hexToRgb(hex).map(toLinear);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ];
  }
  function oklabToHex([L, a, b]) {
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map(fromLinear);
    return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  function mix(hexA, hexB, t) {
    const a = hexToOklab(hexA);
    const b = hexToOklab(hexB);
    return oklabToHex(a.map((v, i) => v + (b[i] - v) * t));
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const skyCache = new Map();
  // { top, bottom, mid, lightText, stars, clouds, sunUp } for a local minute of day.
  function skyAt(minute, dark) {
    minute = ((Math.round(minute) % 1440) + 1440) % 1440;
    const key = minute + (dark ? "d" : "l");
    if (skyCache.has(key)) return skyCache.get(key);
    let i = 0;
    while (SKY[i + 1][0] <= minute) i++;
    const [m0, top0, bot0] = SKY[i];
    const [m1, top1, bot1] = SKY[i + 1];
    const t = (minute - m0) / (m1 - m0);
    let top = mix(top0, top1, t);
    let bottom = mix(bot0, bot1, t);
    const dayLum = (luminance(top) + luminance(bottom)) / 2; // how bright the real sky is
    if (dark) {
      top = mix(top, DARK_MIX, 0.45);
      bottom = mix(bottom, DARK_MIX, 0.45);
    }
    // Pick the ink that stays most readable against both ends of the gradient.
    const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const lumTop = luminance(top);
    const lumBottom = luminance(bottom);
    const inkLum = luminance(INK_DARK);
    const whiteWorst = Math.min(contrast(1, lumTop), contrast(1, lumBottom));
    const inkWorst = Math.min(contrast(inkLum, lumTop), contrast(inkLum, lumBottom));
    const sky = {
      top: top,
      bottom: bottom,
      mid: mix(top, bottom, 0.5),
      lightText: whiteWorst >= inkWorst,
      stars: Math.max(0, Math.min(1, (0.16 - dayLum) / 0.1)),
      clouds: Math.max(0, Math.min(1, (dayLum - 0.4) / 0.15)),
      sunUp: minute >= 360 && minute < 1080,
    };
    skyCache.set(key, sky);
    return sky;
  }

  function applySky(el, sky) {
    el.style.setProperty("--card-bg", "linear-gradient(160deg, " + sky.top + " 0%, " + sky.bottom + " 100%)");
    el.style.setProperty("--card-fg", sky.lightText ? "#fff" : INK_DARK);
    el.style.setProperty("--card-fg-2", sky.lightText ? "rgba(255,255,255,0.78)" : "rgba(19,32,58,0.7)");
    el.style.setProperty("--card-pill", sky.lightText ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.55)");
    el.style.setProperty("--stars", sky.stars.toFixed(2));
    el.style.setProperty("--clouds", sky.clouds.toFixed(2));
  }

  function isDarkTheme() {
    const t = document.documentElement.dataset.theme;
    if (t === "dark") return true;
    if (t === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  // A little arc with the sun (6am–6pm) or moon (6pm–6am) at its spot in the sky.
  function arcSvg(minute) {
    const sunUp = minute >= 360 && minute < 1080;
    const t = sunUp ? (minute - 360) / 720 : (((minute - 1080) + 1440) % 1440) / 720;
    const angle = Math.PI * (1 - t);
    const x = (22 + 17 * Math.cos(angle)).toFixed(1);
    const y = (21 - 17 * Math.sin(angle)).toFixed(1);
    const body = sunUp
      ? '<circle cx="' + x + '" cy="' + y + '" r="6" fill="#ffc93c" opacity="0.35"/><circle cx="' + x + '" cy="' + y + '" r="3.6" fill="#ffc93c"/>'
      : '<path d="M' + x + " " + (y - 4.2).toFixed(1) + " A4.2 4.2 0 1 0 " + x + " " + (+y + 4.2).toFixed(1) +
        " A2.6 4.2 0 1 1 " + x + " " + (y - 4.2).toFixed(1) + 'Z" fill="#ffe8a3"/>';
    return '<svg viewBox="0 0 44 24" aria-hidden="true">' +
      '<path d="M5 21 A17 17 0 0 1 39 21" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2.5" opacity="0.45"/>' +
      '<line x1="2" y1="21.5" x2="42" y2="21.5" stroke="currentColor" stroke-width="1.2" opacity="0.35"/>' +
      body + "</svg>";
  }

  // Avatar colors, assigned in people.js order so each friend keeps their color.
  const AVATAR_COLORS = ["#2a78d6", "#d95926", "#12936a", "#b97a00", "#c94a7c", "#1f7a1f", "#6250d6", "#d23b3a", "#0f8a9e"];

  // Photo if there is one; otherwise their emoji or first initial on their color.
  // A photo that fails to load is removed, revealing the initial underneath.
  function avatarHtml(person, extraClass) {
    const face = person.emoji || (Array.from(person.name.trim())[0] || "?").toUpperCase();
    return '<span class="avatar' + (person.emoji ? " has-emoji" : "") + (extraClass ? " " + extraClass : "") +
      '" style="--avatar:' + person.color + '" aria-hidden="true">' + escapeHtml(face) +
      (person.photo ? '<img src="' + escapeHtml(person.photo) + '" alt="" loading="lazy" decoding="async">' : "") +
      "</span>";
  }
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img && img.tagName === "IMG" && img.parentElement && img.parentElement.classList.contains("avatar")) img.remove();
  }, true);

  // ── Load people ────────────────────────────────────────────────────────

  const rawPeople = typeof PEOPLE !== "undefined" && Array.isArray(PEOPLE) ? PEOPLE : [];
  const people = rawPeople
    .filter((p) => p && p.name)
    .map((p, i) => ({
      id: i,
      name: String(p.name),
      timezone: String(p.timezone || ""),
      place: p.place ? String(p.place) : (p.timezone ? cityFromTz(String(p.timezone)) : ""),
      valid: isValidTimeZone(String(p.timezone || "")),
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
      emoji: p.emoji ? String(p.emoji) : "",
      photo: p.photo ? String(p.photo) : "",
      tag: p.tag ? String(p.tag) : "",
    }));
  const validPeople = people.filter((p) => p.valid);

  // Earliest wall clock first (i.e. by UTC offset), then by name.
  function sortedByLocalTime(list, date) {
    return list.slice().sort((a, b) => {
      if (!a.valid || !b.valid) return a.valid ? -1 : b.valid ? 1 : 0;
      return offsetMinutes(date, a.timezone) - offsetMinutes(date, b.timezone) ||
        a.name.localeCompare(b.name);
    });
  }

  // ── Header ─────────────────────────────────────────────────────────────

  const youLine = document.getElementById("you-line");
  function renderHeader(now) {
    youLine.innerHTML = "Your time: <strong>" + escapeHtml(fmtTime(now, viewerTz)) + "</strong> · " +
      escapeHtml(fmtWeekday(now, viewerTz)) + " · " + escapeHtml(cityFromTz(viewerTz));
  }

  // ── Cards ──────────────────────────────────────────────────────────────

  const cardsEl = document.getElementById("cards");
  const awakeCountEl = document.getElementById("awake-count");
  const cardEls = new Map();

  function buildCard(person) {
    const el = document.createElement("article");
    el.className = "card";
    el.innerHTML =
      '<span class="sky-fx" aria-hidden="true"><span class="stars"></span><span class="clouds"></span></span>' +
      '<div class="card-top">' + avatarHtml(person) +
        '<div class="card-name"></div>' +
        '<span class="sky-arc" aria-hidden="true"></span>' +
      "</div>" +
      (person.tag ? '<div class="card-tag"></div>' : "") +
      '<div class="card-place"></div>' +
      '<div class="card-time"></div>' +
      '<div class="card-day"></div>' +
      '<div class="card-foot"><span class="status"></span><span class="card-offset"></span></div>';
    // "maria (beyoncé)" → "maria" with "beyoncé" as a smaller nickname line
    const nick = /^(.*?)\s*\((.+)\)\s*$/.exec(person.name);
    el.querySelector(".card-name").innerHTML = nick
      ? escapeHtml(nick[1]) + '<span class="nick">' + escapeHtml(nick[2]) + "</span>"
      : escapeHtml(person.name);
    el.querySelector(".card-place").textContent = person.place;
    if (person.tag) el.querySelector(".card-tag").textContent = person.tag;
    if (!person.valid) {
      el.classList.add("error");
      el.querySelector(".card-time").textContent = "Unknown timezone";
      el.querySelector(".card-day").textContent = '"' + person.timezone + '" — check people.js';
      el.querySelector(".card-foot").remove();
    }
    return el;
  }

  function renderCards(now) {
    let awake = 0;
    const dark = isDarkTheme();
    for (const person of sortedByLocalTime(people, now)) {
      let el = cardEls.get(person.id);
      if (!el) {
        el = buildCard(person);
        cardEls.set(person.id, el);
      }
      cardsEl.appendChild(el); // appending in order also re-sorts existing cards
      if (!person.valid) continue;

      const tz = person.timezone;
      const isAwake = isAwakeAt(now, tz);
      if (isAwake) awake++;
      const rel = relDayLabel(dayDiff(now, tz, viewerTz));

      const minute = localMinute(now, tz);
      const sky = skyAt(minute, dark);
      applySky(el, sky);
      el.classList.toggle("asleep", !isAwake);
      el.querySelector(".sky-arc").innerHTML = arcSvg(minute);
      el.querySelector(".card-place").textContent = person.place + " · " + tzAbbrev(now, tz);
      el.querySelector(".card-time").textContent = fmtTime(now, tz);
      el.querySelector(".card-day").innerHTML = escapeHtml(fmtWeekday(now, tz)) +
        (rel ? ' <span class="rel">(' + rel + ")</span>" : "");
      const status = el.querySelector(".status");
      status.className = "status " + (isAwake ? "is-awake" : "is-asleep");
      status.textContent = isAwake ? "awake" : "asleep";
      el.querySelector(".card-offset").textContent =
        offsetLabel(offsetMinutes(now, tz) - offsetMinutes(now, viewerTz));
      el.setAttribute("aria-label", person.name + ", " + person.place + ": " + fmtTime(now, tz) + " " +
        fmtWeekday(now, tz) + ", " + (isAwake ? "awake" : "asleep"));
    }
    awakeCountEl.textContent = validPeople.length
      ? awake + " of " + validPeople.length + " awake"
      : "No one yet — add friends in people.js";
  }

  // ── World strip: everyone placed along one day, midnight to midnight ───

  const bandEl = document.getElementById("world-band");
  const ticksEl = document.getElementById("world-ticks");
  const smallStrip = () => window.matchMedia("(max-width: 520px)").matches;

  function hourLabel(h) {
    return fmtHour(new Date(Date.UTC(2020, 0, 1, h)), "UTC").replace(/\s?([AP])M/i, (m, x) => x.toLowerCase());
  }

  function renderWorld(now) {
    const dark = isDarkTheme();
    const stops = [];
    for (let m = 0; m <= 1440; m += 30) stops.push(skyAt(m, dark).mid + " " + (m / 14.4).toFixed(2) + "%");
    bandEl.style.background = "linear-gradient(90deg, " + stops.join(", ") + ")";

    // Stack people who'd overlap into lanes so every avatar stays visible.
    const AVATAR_PX = smallStrip() ? 24 : 30;
    const LANE_PX = AVATAR_PX + 4;
    const width = bandEl.clientWidth || 340;
    const gapPct = ((AVATAR_PX * 0.85) / width) * 100; // a little overlap is fine
    const placed = validPeople
      .map((p) => ({ person: p, minute: localMinute(now, p.timezone) }))
      .sort((a, b) => a.minute - b.minute || a.person.name.localeCompare(b.person.name));
    const laneEnds = [];
    for (const item of placed) {
      item.pct = (item.minute / 1440) * 100;
      let lane = laneEnds.findIndex((end) => item.pct - end >= gapPct);
      if (lane < 0) { lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = item.pct;
      item.lane = lane;
    }
    const lanes = Math.max(2, laneEnds.length);
    bandEl.style.height = lanes * LANE_PX + 16 + "px";

    const youPct = (localMinute(now, viewerTz) / 1440) * 100;
    bandEl.innerHTML =
      '<span class="world-you" style="left:' + youPct.toFixed(2) + '%"><span>you</span></span>' +
      placed.map((item) => {
        const p = item.person;
        const label = p.name + ": " + fmtTime(now, p.timezone) + " " + fmtWeekday(now, p.timezone);
        return '<button type="button" class="world-dot" data-id="' + p.id + '" title="' + escapeHtml(label) + '" aria-label="' + escapeHtml(label) + '" ' +
          'style="left:clamp(' + (AVATAR_PX / 2 + 2) + "px, " + item.pct.toFixed(2) + "%, calc(100% - " + (AVATAR_PX / 2 + 2) + 'px));top:' + (8 + item.lane * LANE_PX) + 'px">' +
          avatarHtml(p) + "</button>";
      }).join("");

    if (!ticksEl.childElementCount) {
      ticksEl.innerHTML = [0, 6, 12, 18, 24].map((h) =>
        '<span style="left:' + (h / 24) * 100 + '%">' + escapeHtml(hourLabel(h % 24)) + "</span>").join("");
    }
  }

  bandEl.addEventListener("click", (e) => {
    const dot = e.target.closest(".world-dot");
    if (!dot) return;
    const card = cardEls.get(+dot.dataset.id);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.remove("flash");
    void card.offsetWidth; // restart the animation if tapped twice
    card.classList.add("flash");
  });

  // Page glow takes on the colors of your own sky right now.
  function renderGlow(now) {
    const dark = isDarkTheme();
    const sky = skyAt(localMinute(now, viewerTz), false);
    const alpha = dark ? 0.16 : 0.34;
    const toRgba = (hex, a) => "rgba(" + hexToRgb(hex).join(", ") + ", " + a + ")";
    document.body.style.setProperty("--glow-1", toRgba(sky.bottom, alpha));
    document.body.style.setProperty("--glow-2", toRgba(sky.top, alpha * 0.9));
  }

  // ── Time scrubber: drag to see everyone later today ────────────────────

  const scrubEl = document.getElementById("scrub");
  const scrubText = document.getElementById("scrub-text");
  const scrubReset = document.getElementById("scrub-reset");
  const nowHeading = document.getElementById("now-heading");
  const SCRUB_STEP = 15 * 60000;

  function scrubOffset() {
    return (+scrubEl.value || 0) * SCRUB_STEP;
  }

  function viewTime() {
    return new Date(Date.now() + scrubOffset());
  }

  function renderScrubLabel(t) {
    const mins = scrubOffset() / 60000;
    if (!mins) {
      scrubText.textContent = "Drag to look ahead";
      nowHeading.textContent = "Right now";
      scrubReset.hidden = true;
      return;
    }
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const ahead = (h ? h + "h" : "") + (h && m ? " " : "") + (m ? m + "m" : "");
    scrubText.innerHTML = "<strong>+" + ahead + "</strong> · " + escapeHtml(fmtShortDay(t, viewerTz)) + ", " +
      escapeHtml(fmtTime(t, viewerTz)) + " your time";
    nowHeading.textContent = "In " + ahead;
    scrubReset.hidden = false;
  }

  function renderScrubbed() {
    const t = viewTime();
    renderScrubLabel(t);
    renderCards(t);
    renderWorld(t);
    renderGlow(t);
  }

  scrubEl.addEventListener("input", renderScrubbed);
  scrubReset.addEventListener("click", () => {
    scrubEl.value = 0;
    renderScrubbed();
  });

  // ── Overlap chart ──────────────────────────────────────────────────────

  const barsEl = document.getElementById("overlap-bars");
  const axisEl = document.getElementById("overlap-axis");
  const summaryEl = document.getElementById("overlap-summary");
  const detailEl = document.getElementById("overlap-detail");
  const bestBandEl = document.getElementById("best-band");
  let slots = [];
  let selectedSlot = null; // start time (ms) of the selected hour, kept across refreshes

  function computeSlots(now) {
    const start = new Date(now);
    start.setMinutes(0, 0, 0); // top of the current hour, in the viewer's time
    const out = [];
    for (let i = 0; i < 24; i++) {
      const t = new Date(start.getTime() + i * HOUR);
      const awake = validPeople.filter((p) => isAwakeAt(t, p.timezone));
      out.push({ time: t, awake: awake, count: awake.length });
    }
    return out;
  }

  // Longest consecutive run of hours that hit the max count.
  function bestRun(list) {
    const max = Math.max(0, ...list.map((s) => s.count));
    let best = null;
    let i = 0;
    while (i < list.length) {
      if (list[i].count === max) {
        let j = i;
        while (j + 1 < list.length && list[j + 1].count === max) j++;
        if (!best || j - i > best.end - best.start) best = { start: i, end: j };
        i = j + 1;
      } else {
        i++;
      }
    }
    return { max: max, run: best };
  }

  function renderOverlap(now) {
    slots = computeSlots(now);
    const total = validPeople.length;
    const { max, run } = bestRun(slots);

    barsEl.innerHTML = "";
    axisEl.innerHTML = "";
    const dark = isDarkTheme();
    slots.forEach((slot, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bar" + (slot.count === max && max > 0 ? " best" : "");
      const pct = total ? (slot.count / total) * 100 : 0;
      // Each bar wears the sky (in your timezone) at the middle of its hour.
      const sky = skyAt(localMinute(slot.time, viewerTz) + 30, dark);
      b.innerHTML = '<span class="bar-count">' + slot.count + '</span><span class="bar-fill" style="height:calc((100% - 18px) * ' + pct / 100 +
        ");background:linear-gradient(180deg, " + sky.top + ", " + sky.bottom + ')"></span>';
      b.setAttribute("aria-label", fmtShortDay(slot.time, viewerTz) + " " + fmtTime(slot.time, viewerTz) +
        ": " + slot.count + " of " + total + " awake");
      b.dataset.index = i;
      b.addEventListener("click", () => selectSlot(i));
      b.addEventListener("mouseenter", () => { if (window.matchMedia("(hover: hover)").matches) selectSlot(i); });
      barsEl.appendChild(b);

      const label = document.createElement("span");
      if (i === 0) label.textContent = "now";
      else if (i % 3 === 0) label.textContent = fmtHour(slot.time, viewerTz).replace(/\s?([AP])M/i, (m, x) => x.toLowerCase());
      axisEl.appendChild(label);
    });

    // One soft band behind the longest best stretch.
    if (run && max > 0) {
      bestBandEl.hidden = false;
      bestBandEl.style.left = "calc(" + run.start + " * (100% + 2px) / 24)";
      bestBandEl.style.width = "calc(" + (run.end - run.start + 1) + " * (100% + 2px) / 24 - 2px)";
    } else {
      bestBandEl.hidden = true;
    }

    if (!total) {
      summaryEl.textContent = "";
    } else if (max === 0) {
      summaryEl.textContent = "Nobody is awake at the same time in the next 24 hours.";
    } else {
      const from = slots[run.start].time;
      const to = new Date(slots[run.end].time.getTime() + HOUR);
      summaryEl.innerHTML = "Best: <strong>" + max + " of " + total + "</strong> awake, " +
        escapeHtml(fmtShortDay(from, viewerTz)) + " " +
        "<strong>" + escapeHtml(fmtTime(from, viewerTz)) + "–" + escapeHtml(fmtTime(to, viewerTz)) + "</strong> your time";
    }

    // Keep the selected hour if it's still in the window; otherwise default to the best hour.
    let idx = selectedSlot === null ? -1 : slots.findIndex((s) => s.time.getTime() === selectedSlot);
    if (idx < 0) idx = run ? run.start : 0;
    if (slots.length) selectSlot(idx);
  }

  function selectSlot(i) {
    const slot = slots[i];
    if (!slot) return;
    selectedSlot = slot.time.getTime();
    barsEl.querySelectorAll(".bar").forEach((b, j) => {
      b.classList.toggle("selected", j === i);
      b.setAttribute("aria-pressed", j === i ? "true" : "false");
    });

    const awakeIds = new Set(slot.awake.map((p) => p.id));
    const ordered = sortedByLocalTime(validPeople, slot.time);
    const chips = ordered.map((p) => {
      const isAwake = awakeIds.has(p.id);
      const rel = relDayLabel(dayDiff(slot.time, p.timezone, viewerTz));
      return '<li class="chip' + (isAwake ? "" : " asleep") + '">' +
        '<span class="' + (isAwake ? "is-awake" : "is-asleep") + '">' + (isAwake ? ICON_SUN : ICON_MOON) + "</span>" +
        "<span>" + escapeHtml(p.name) + '</span><span class="t">' + escapeHtml(fmtTime(slot.time, p.timezone)) +
        (rel ? " " + rel.replace("tomorrow", "+1d").replace("yesterday", "−1d") : "") + "</span></li>";
    }).join("");
    const stack = ordered.filter((p) => awakeIds.has(p.id)).map((p) => avatarHtml(p)).join("");

    detailEl.innerHTML =
      '<div class="detail-head">' +
        '<div class="detail-title">' + escapeHtml(fmtShortDay(slot.time, viewerTz)) + ", " +
          escapeHtml(fmtTime(slot.time, viewerTz)) + ' <span class="muted">your time</span></div>' +
        '<button type="button" class="btn btn-small" id="use-in-converter">Open in converter</button>' +
      "</div>" +
      '<div class="stack-row">' +
        (stack ? '<span class="stack">' + stack + "</span>" : "") +
        '<span class="stack-count"><strong>' + slot.count + "</strong> of " + validPeople.length + " awake</span>" +
      "</div>" +
      '<ul class="chips">' + chips + "</ul>";
    detailEl.querySelector("#use-in-converter").addEventListener("click", () => {
      setConverter("me", slot.time);
      openConverter();
    });
  }

  // ── Converter ──────────────────────────────────────────────────────────

  const convPerson = document.getElementById("conv-person");
  const convDate = document.getElementById("conv-date");
  const convTime = document.getElementById("conv-time");
  const convNote = document.getElementById("conv-note");
  const convResults = document.getElementById("conv-results");
  const convCopy = document.getElementById("conv-copy");
  let lastConversion = null;

  function sourceTz(value) {
    if (value === "me") return viewerTz;
    const p = people.find((x) => String(x.id) === value);
    return p ? p.timezone : viewerTz;
  }

  function buildConverterOptions() {
    const opts = ['<option value="me">You (' + escapeHtml(cityFromTz(viewerTz)) + ")</option>"];
    for (const p of validPeople) {
      opts.push('<option value="' + p.id + '">' + escapeHtml(p.name) + " (" + escapeHtml(p.place) + ")</option>");
    }
    convPerson.innerHTML = opts.join("");
  }

  const pad = (n) => String(n).padStart(2, "0");

  // Fill the inputs with the wall-clock time of `instant` in the chosen person's timezone.
  function setConverter(personValue, instant) {
    convPerson.value = personValue;
    const p = zonedParts(instant, sourceTz(personValue));
    convDate.value = p.year + "-" + pad(p.month) + "-" + pad(p.day);
    convTime.value = pad(p.hour) + ":" + pad(p.minute);
    renderConversion();
  }

  function renderConversion() {
    const tz = sourceTz(convPerson.value);
    const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(convDate.value);
    const tm = /^(\d{2}):(\d{2})/.exec(convTime.value);
    convResults.innerHTML = "";
    lastConversion = null;
    if (!dm || !tm) {
      convNote.textContent = "Pick a date and time.";
      return;
    }
    const [y, mo, d, h, mi] = [+dm[1], +dm[2], +dm[3], +tm[1], +tm[2]];
    const instant = zonedToInstant(y, mo, d, h, mi, tz);

    // Spring-forward gaps (e.g. 2:30am on DST day) don't exist on the clock.
    const check = zonedParts(instant, tz);
    convNote.textContent = (check.hour !== h || check.minute !== mi)
      ? "That time is skipped by daylight saving in " + cityFromTz(tz) + ", so it's shown as " + fmtTime(instant, tz) + "."
      : "";

    const srcValue = convPerson.value;
    const rows = sortedByLocalTime(validPeople, instant).map((p) => ({
      person: p,
      isSource: String(p.id) === srcValue,
      time: fmtTime(instant, p.timezone),
      day: fmtShortDay(instant, p.timezone),
      awake: isAwakeAt(instant, p.timezone),
    }));
    convResults.innerHTML = rows.map((r) =>
      '<li class="conv-row' + (r.awake ? "" : " asleep") + (r.isSource ? " source" : "") + '">' +
        '<span class="conv-who">' + avatarHtml(r.person) + "<span>" + escapeHtml(r.person.name) +
          '<span class="place">' + escapeHtml(r.person.place) + (r.awake ? "" : " · asleep") + "</span></span></span>" +
        '<span class="conv-when"><span class="time">' + escapeHtml(r.time) + '</span><span class="day">' + escapeHtml(r.day) + "</span></span>" +
      "</li>"
    ).join("");
    lastConversion = rows;
  }

  async function copyConversion() {
    if (!lastConversion || !lastConversion.length) return;
    const text = lastConversion
      .map((r) => r.person.name + ": " + r.time + " " + r.day + (r.awake ? "" : " 😴"))
      .join("\n");
    const original = "Copy for the chat";
    try {
      await navigator.clipboard.writeText(text);
      convCopy.textContent = "Copied!";
    } catch (e) {
      window.prompt("Copy this:", text);
    }
    setTimeout(() => { convCopy.textContent = original; }, 1500);
  }

  // The converter lives in a pop-up so it stays off the main page.
  const convDialog = document.getElementById("converter");
  function openConverter() {
    if (typeof convDialog.showModal === "function") convDialog.showModal();
    else convDialog.setAttribute("open", "");
  }
  function closeConverter() {
    if (typeof convDialog.close === "function") convDialog.close();
    else convDialog.removeAttribute("open");
  }
  document.getElementById("open-converter").addEventListener("click", () => {
    setConverter(convPerson.value, new Date());
    openConverter();
  });
  document.getElementById("conv-close").addEventListener("click", closeConverter);
  // Tapping the dimmed area outside the sheet closes it.
  convDialog.addEventListener("click", (e) => { if (e.target === convDialog) closeConverter(); });

  convPerson.addEventListener("change", renderConversion);
  convDate.addEventListener("input", renderConversion);
  convTime.addEventListener("input", renderConversion);
  document.getElementById("conv-now").addEventListener("click", () => setConverter(convPerson.value, new Date()));
  convCopy.addEventListener("click", copyConversion);

  // ── Theme toggle (auto / light / dark) ─────────────────────────────────

  const themeButtons = document.querySelectorAll("[data-theme-choice]");

  function showThemeChoice(choice) {
    themeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeChoice === choice)));
  }

  function setTheme(choice) {
    const root = document.documentElement;
    if (choice === "light" || choice === "dark") root.dataset.theme = choice;
    else delete root.dataset.theme;
    try {
      if (choice === "light" || choice === "dark") localStorage.setItem("theme", choice);
      else localStorage.removeItem("theme");
    } catch (e) { /* private mode etc. — the choice just won't be remembered */ }
    showThemeChoice(choice);
  }

  themeButtons.forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeChoice)));
  showThemeChoice(document.documentElement.dataset.theme || "auto");

  // ── Live updates ───────────────────────────────────────────────────────

  let lastMinute = null;
  let lastHour = null;
  function tick(force) {
    const now = new Date();
    const minuteKey = Math.floor(now.getTime() / 60000);
    if (force || minuteKey !== lastMinute) {
      lastMinute = minuteKey;
      renderHeader(now);
      renderScrubbed(); // cards, world strip, and glow follow the scrubber (or now)
    }
    const hourKey = new Date(now).setMinutes(0, 0, 0);
    if (force || hourKey !== lastHour) {
      lastHour = hourKey;
      renderOverlap(now);
    }
  }

  buildConverterOptions();
  setConverter("me", new Date());
  tick(true);
  setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(true); });

  // Sky colors differ between light and dark, so redraw when either changes.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => tick(true));
  themeButtons.forEach((b) => b.addEventListener("click", () => tick(true)));

  // The world strip packs avatars by pixel width, so re-pack after resizing.
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderWorld(viewTime()), 150);
  });
})();
