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

  // What the sky looks like at a local hour; drives each card's gradient.
  function skyPhase(hour) {
    if (hour < 5) return "night";
    if (hour < 7) return "dawn";
    if (hour < 10) return "morning";
    if (hour < 17) return "day";
    if (hour < 19) return "golden";
    if (hour < 21) return "dusk";
    return "night";
  }

  // Avatar colors, assigned in people.js order so each friend keeps their color.
  const AVATAR_COLORS = ["#2a78d6", "#d95926", "#12936a", "#b97a00", "#c94a7c", "#1f7a1f", "#6250d6", "#d23b3a", "#0f8a9e"];

  function avatarHtml(person) {
    const initial = Array.from(person.name.trim())[0] || "?";
    return '<span class="avatar" style="--avatar:' + person.color + '" aria-hidden="true">' +
      escapeHtml(initial.toUpperCase()) + "</span>";
  }

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
      '<div class="card-top">' + avatarHtml(person) +
        '<div class="card-name"></div>' +
        '<span class="sky-icon" aria-hidden="true"></span>' +
      "</div>" +
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

      const phase = skyPhase(zonedParts(now, tz).hour);
      el.className = "card phase-" + phase + (isAwake ? "" : " asleep");
      el.querySelector(".sky-icon").innerHTML = phase === "day" || phase === "morning" || phase === "golden" ? ICON_SUN : ICON_MOON;
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

  // ── Overlap chart ──────────────────────────────────────────────────────

  const barsEl = document.getElementById("overlap-bars");
  const axisEl = document.getElementById("overlap-axis");
  const summaryEl = document.getElementById("overlap-summary");
  const detailEl = document.getElementById("overlap-detail");
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
    slots.forEach((slot, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bar" + (slot.count === max && max > 0 ? " best" : "");
      const pct = total ? (slot.count / total) * 100 : 0;
      b.innerHTML = '<span class="bar-count">' + slot.count + '</span><span class="bar-fill" style="height:calc((100% - 16px) * ' + pct / 100 + ')"></span>';
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

    if (!total) {
      summaryEl.textContent = "";
    } else if (max === 0) {
      summaryEl.textContent = "Nobody is awake at the same time in the next 24 hours.";
    } else {
      const from = slots[run.start].time;
      const to = new Date(slots[run.end].time.getTime() + HOUR);
      summaryEl.innerHTML = "Best: <strong>" + max + " of " + total + "</strong> awake, " +
        escapeHtml(fmtShortDay(from, viewerTz)) + " " +
        "<strong>" + escapeHtml(fmtTime(from, viewerTz)) + "–" + escapeHtml(fmtTime(to, viewerTz)) + "</strong> your time" +
        (max < total ? " (no hour has everyone awake)" : "");
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
    const chips = sortedByLocalTime(validPeople, slot.time).map((p) => {
      const isAwake = awakeIds.has(p.id);
      const rel = relDayLabel(dayDiff(slot.time, p.timezone, viewerTz));
      return '<li class="chip' + (isAwake ? "" : " asleep") + '">' +
        '<span class="' + (isAwake ? "is-awake" : "is-asleep") + '">' + (isAwake ? ICON_SUN : ICON_MOON) + "</span>" +
        "<span>" + escapeHtml(p.name) + '</span><span class="t">' + escapeHtml(fmtTime(slot.time, p.timezone)) +
        (rel ? " " + rel.replace("tomorrow", "+1d").replace("yesterday", "−1d") : "") + "</span></li>";
    }).join("");

    detailEl.innerHTML =
      '<div class="detail-head">' +
        '<div class="detail-title">' + escapeHtml(fmtShortDay(slot.time, viewerTz)) + ", " +
          escapeHtml(fmtTime(slot.time, viewerTz)) + ' <span class="muted">your time · ' +
          slot.count + " of " + validPeople.length + " awake</span></div>" +
        '<button type="button" class="btn btn-small" id="use-in-converter">Open in converter</button>' +
      "</div>" +
      '<ul class="chips">' + chips + "</ul>";
    detailEl.querySelector("#use-in-converter").addEventListener("click", () => {
      setConverter("me", slot.time);
      document.getElementById("converter").scrollIntoView({ behavior: "smooth", block: "start" });
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
      renderCards(now);
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
})();
