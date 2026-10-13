# choplot time

A tiny timezone dashboard for the group chat. It shows everyone's local time, who's awake, the best overlap times for the next 24 hours, and a time converter.

It's plain HTML, CSS, and JavaScript with no build step, so it runs on GitHub Pages as-is.

## Adding or removing friends

Everything lives in **`people.js`**. Each friend is one line:

```js
{ name: "liya", place: "Los Angeles", timezone: "America/Los_Angeles" },
```

- **name**: what shows on their card. Anything in parentheses, like `"maria (beyoncé)"`, shows as a smaller nickname under the name, which helps tell two people with the same name apart.
- **timezone**: an [IANA timezone name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) (the "TZ identifier" column). Pick the city nearest to them that's in the same timezone, e.g. `America/New_York` for North Carolina.
- **place** *(optional)*: the label under their name. If you leave it out, the city from the timezone is used.
- **photo** *(optional)*: a profile picture in the `photos/` folder, e.g. `"photos/liya.jpg"`. If the file is missing, their initial shows instead.
- **emoji** *(optional)*: shown in their bubble instead of their initial when there's no photo, e.g. `"🦢"`.
- **tag** *(optional)*: a tiny label on their card, such as a group joke, e.g. `"🎶 music girl"`.

To **add** someone, copy a line, change it, and keep the comma at the end. To **remove** someone, delete their line. Order doesn't matter, because the site sorts everyone by local time.

If a timezone is misspelled, that person's card turns red and says "Unknown timezone", and the rest of the site keeps working.

Countries with more than one timezone use these defaults, so change them if they're wrong:
- Brazil: `America/Sao_Paulo`
- Mexico: `America/Mexico_City`
- Australia: `Australia/Sydney` (others include `Australia/Melbourne`, `Australia/Brisbane` and `Australia/Perth`)

**becca** is in the list but commented out (the line starts with `//`) until we know her US timezone. Once you know it, delete the `//` and set her timezone to `America/New_York`, `America/Chicago`, `America/Denver` or `America/Los_Angeles`.

## Link preview and icons

- `og-image.png` is the picture that shows when the link is pasted into a chat.
- `favicon.svg` and `apple-touch-icon.png` are the browser tab icon and the iPhone home-screen icon.
- Chat apps cache link previews, so a changed image can take a while to show up.

## Other tweaks

- **Awake hours** (8am–11pm) are set at the top of `app.js` (`AWAKE_FROM` / `AWAKE_UNTIL`).
- **Site title** is in `index.html` (`<title>` and `<h1>`).

## Updating the code

GitHub Pages lets browsers keep old copies of files for up to 10 minutes. If you change `app.js` or `styles.css`, bump the version number in all three places so everyone gets matching new files:
- the `app-version` tag in `index.html`
- the `?v=` on the file links at the top and bottom of `index.html`
- `APP_VERSION` at the top of `app.js`

Editing `people.js` doesn't need this. At worst, someone sees the old list for a few minutes.

## Preview locally

Open `index.html` in a browser. No server is needed.
