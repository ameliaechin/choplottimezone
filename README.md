# choplot time

A tiny timezone dashboard for the group chat. It shows everyone's local time, who's awake, the best overlap times for the next 24 hours, and a time converter.

It's plain HTML, CSS, and JavaScript with no build step, so it runs on GitHub Pages as-is.

## Adding or removing friends

Everything lives in **`people.js`**. Each friend is one line:

```js
{ name: "liya", place: "Los Angeles", timezone: "America/Los_Angeles" },
```

- **name**: what shows on their card.
- **timezone**: an [IANA timezone name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) (the "TZ identifier" column). Pick the city nearest to them that's in the same timezone, e.g. `America/New_York` for North Carolina.
- **place** *(optional)*: the label under their name. If you leave it out, the city from the timezone is used.

To **add** someone, copy a line, change it, and keep the comma at the end. To **remove** someone, delete their line. Order doesn't matter, because the site sorts everyone by local time.

If a timezone is misspelled, that person's card turns red and says "Unknown timezone", and the rest of the site keeps working.

Countries with more than one timezone: Brazil is set to `America/Sao_Paulo` (Brasília time). If a friend is somewhere else, use their nearest zone, e.g. `America/Manaus`.

## Other tweaks

- **Awake hours** (8am–11pm) are set at the top of `app.js` (`AWAKE_FROM` / `AWAKE_UNTIL`).
- **Site title** is in `index.html` (`<title>` and `<h1>`).

## Preview locally

Open `index.html` in a browser. No server is needed.
