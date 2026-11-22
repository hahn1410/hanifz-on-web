import { groupByDay, monthsToShow, buildMonth } from "./calendar.js";
import { createWatched } from "./watched.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOWS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LABEL = { youtube: "YouTube", short: "Short", tiktok: "TikTok" };

const watched = createWatched();
const touch = window.matchMedia("(hover: none)");

const malaysiaToday = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function videoCell(day) {
  const [main, ...more] = day.videos;
  const cell = el("div", { class: "day has" });
  const refresh = () => cell.classList.toggle("watched", watched.has(main.id));

  const link = el("a", {
    class: "main", href: main.url, target: "_blank", rel: "noopener",
    "aria-label": `${day.date}: ${main.title || LABEL[main.platform]} (${LABEL[main.platform]})`,
    onclick: (e) => {
      // On touch screens the first tap shows the title; the second opens the video.
      if (touch.matches && !cell.classList.contains("revealed")) {
        e.preventDefault();
        document.querySelectorAll(".day.revealed").forEach((d) => d.classList.remove("revealed"));
        cell.classList.add("revealed");
        return;
      }
      watched.mark(main.id);
      refresh();
    },
  }, el("img", { src: main.thumb, alt: "", loading: "lazy", decoding: "async" }));

  cell.append(
    link,
    el("span", { class: "num" }, String(day.n)),
    el("span", { class: "title" }, main.title || ""),
    el("span", { class: `tag ${main.platform}` }, LABEL[main.platform]),
  );

  if (more.length) {
    const badges = el("div", { class: "badges" });
    for (const v of more) {
      const text = v.platform === main.platform ? "+1" : `+ ${LABEL[v.platform]}`;
      badges.append(el("a", {
        class: `badge ${v.platform}`, href: v.url, target: "_blank", rel: "noopener",
        title: v.title || LABEL[v.platform], "aria-label": `Also on ${day.date}: ${v.title || LABEL[v.platform]}`,
        onclick: () => watched.mark(v.id),
      }, text));
    }
    cell.append(badges);
  }

  cell.append(el("button", {
    class: "tick", type: "button", title: "Mark as watched", "aria-label": "Mark as watched",
    onclick: (e) => {
      e.stopPropagation();
      const on = watched.toggle(main.id);
      e.currentTarget.setAttribute("aria-pressed", String(on));
      refresh();
    },
  }, "✓"));

  refresh();
  return cell;
}

function monthSection(year, month, byDay, today, first) {
  const { leading, days } = buildMonth(year, month, byDay, today, first);
  const grid = el("div", { class: "grid" });
  for (const d of DOWS) {
    grid.append(el("div", { class: "dow" }, el("span", { class: "long-name" }, d), el("span", { class: "short-name" }, d.slice(0, 3))));
  }
  for (let i = 0; i < leading; i++) grid.append(el("div", { class: "day blank" }));
  for (const day of days) {
    if (day.state === "video") grid.append(videoCell(day));
    else {
      const cls = day.state === "none" ? "day miss" : "day";
      const label = day.state === "none" ? `${day.date}: no vlog` : null;
      grid.append(el("div", label ? { class: cls, "aria-label": label } : { class: cls }, el("span", { class: "num" }, String(day.n))));
    }
  }
  const tail = (7 - ((leading + days.length) % 7)) % 7;
  for (let i = 0; i < tail; i++) grid.append(el("div", { class: "day blank" }));

  return el("section", { class: "month", id: `m-${year}-${month + 1}` },
    el("div", { class: "year" }, String(year)),
    el("h3", {}, MONTHS[month]),
    grid);
}

async function main() {
  document.getElementById("year").textContent = new Date().getFullYear();
  const root = document.getElementById("months");
  let videos;
  try {
    const res = await fetch("data/videos.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    videos = await res.json();
    if (!Array.isArray(videos)) throw new Error("bad data");
  } catch {
    root.replaceChildren(el("p", { class: "error" }, "The archive couldn’t load — please refresh the page."));
    return;
  }

  const valid = videos.filter((v) => v && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && v.url && v.thumb);
  const today = malaysiaToday();
  const byDay = groupByDay(valid);
  const first = valid.reduce((min, v) => (v.date < min ? v.date : min), today);

  const firstDate = new Date(`${first}T00:00:00Z`);
  document.getElementById("stats").textContent =
    `${valid.length} videos · ${MONTHS[firstDate.getUTCMonth()]} ${firstDate.getUTCFullYear()} – today`;

  root.replaceChildren(...monthsToShow(valid, today).map(({ year, month }) => monthSection(year, month, byDay, today, first)));
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".day.revealed")) document.querySelectorAll(".day.revealed").forEach((d) => d.classList.remove("revealed"));
});

main();
