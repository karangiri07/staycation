// Turns the plain-text "Description" typed in the admin into the sections shown in the gallery.
// Nothing here needs a database change: the admin just writes headings and bullet lines.
//
//   Intro paragraph...
//
//   Highlights            -> chips over the photo
//   • Family Friendly
//
//   Our packages          -> package cards (optional [photo 5] picks the gallery photo for the card)
//   • Wooden Glass Cottage: for 2 to 7 people [photo 3]
//
//   Also available        -> icon row          (also accepts: Facilities, Amenities, Stay)
//   • Dining hall (with food)
//
//   Things to do          -> icon grid         (also accepts: Activities)
//   • Boating & kayaking
//
//   Any paragraph after the sections -> highlighted note, e.g. "Overnight stays are welcome."
//
// A description without these headings is shown as plain text, so older properties keep working.

const BULLET = /^\s*(?:[•·●▪‣◦*\-–—])\s*/;
const isBullet = (line) => BULLET.test(line);
const stripBullet = (line) => line.replace(BULLET, '').trim();

const SECTION_KEYS = {
  highlights: 'highlights',
  highlight: 'highlights',
  'our packages': 'packages',
  packages: 'packages',
  package: 'packages',
  'also available': 'also',
  facilities: 'also',
  amenities: 'also',
  stay: 'also',
  'things to do': 'todo',
  activities: 'todo',
  'what to do': 'todo',
};

const cleanHeading = (line) => line.trim().replace(/[:：]\s*$/, '');

// "Toy train (Sanjivani Express)" -> { label: "Toy train", sub: "Sanjivani Express" }
function splitLabel(text) {
  const match = text.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return match && match[1] ? { label: match[1].trim(), sub: match[2].trim() } : { label: text.trim(), sub: '' };
}

// "for 2 to 7 people" -> "2 – 7 people", "for a group of 15 people" -> "Group of 15"
export function peopleLabel(detail) {
  const text = (detail || '').trim();
  if (!text) return '';
  let m = text.match(/(\d+)\s*(?:to|-|–|—)\s*(\d+)/i);
  if (m) return `${m[1]} – ${m[2]} people`;
  m = text.match(/group\s+of\s+(\d+)/i);
  if (m) return `Group of ${m[1]}`;
  m = text.match(/(\d+)\s*(?:people|persons?|guests?|pax|members?)/i);
  if (m) return `${m[1]} people`;
  const plain = text.replace(/^for\s+/i, '');
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

function parsePackage(raw, imageCount) {
  let text = raw;
  let photo = null;
  const tag = text.match(/\[\s*photo\s*(\d+)\s*\]/i);
  if (tag) {
    const n = Number(tag[1]);
    if (n >= 1 && n <= imageCount) photo = n - 1;
    text = text.replace(tag[0], '').trim();
  }
  const cut = text.indexOf(':');
  const name = (cut === -1 ? text : text.slice(0, cut)).trim();
  const detail = cut === -1 ? '' : text.slice(cut + 1).trim();
  return { name, detail, who: peopleLabel(detail), photo };
}

export function parseStay(description, imageCount = 0) {
  const out = { structured: false, intro: [], highlights: [], packages: [], also: [], todo: [], extra: [], notes: [], plain: (description || '').trim() };
  const lines = (description || '').replace(/\r/g, '').split('\n');
  let section = null; // { kind, title, items }
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join('\n').trim();
    paragraph = [];
    if (!text) return;
    (out.structured ? out.notes : out.intro).push(text);
  };
  const closeSection = () => {
    if (!section) return;
    const { kind, title, items } = section;
    if (kind === 'highlights') out.highlights.push(...items);
    else if (kind === 'packages') out.packages.push(...items.map((item) => parsePackage(item, imageCount)));
    else if (kind === 'also') out.also.push(...items.map(splitLabel));
    else if (kind === 'todo') out.todo.push(...items.map(splitLabel));
    else out.extra.push({ title, items });
    section = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const text = line.trim();
    if (!text) { if (!section) flushParagraph(); else if (section.items.length) closeSection(); continue; } // a blank line ends a bullet list

    if (isBullet(line)) {
      if (!section) {
        // Bullets after a blank line with no heading: keep them as a plain list inside the intro/notes.
        paragraph.push(`• ${stripBullet(line)}`);
      } else {
        section.items.push(stripBullet(line));
      }
      continue;
    }

    // A non-bullet line followed by a bullet line is a heading.
    const next = lines.slice(i + 1).find((l) => l.trim());
    const nextIsBullet = next !== undefined && isBullet(next);
    const key = SECTION_KEYS[cleanHeading(text).toLowerCase()];
    if (key && nextIsBullet) {
      flushParagraph(); closeSection();
      out.structured = true;
      section = { kind: key, title: cleanHeading(text), items: [] };
    } else if (nextIsBullet && text.length <= 40 && !paragraph.length) {
      flushParagraph(); closeSection();
      out.structured = true;
      section = { kind: 'extra', title: cleanHeading(text), items: [] };
    } else {
      closeSection();
      paragraph.push(text);
    }
  }
  closeSection();
  flushParagraph();
  return out;
}

// ---------- prices ----------
const digits = (value) => Number(String(value || '').replace(/[^\d.]/g, '')) || 0;
export const money = (value) => {
  const text = String(value || '').trim();
  return /^\d/.test(text) ? `₹${text}` : text;
};

// The offer only shows when the crossed-out price really is higher than the current price.
export function offerInfo(price, original) {
  const now = digits(price);
  const was = digits(original);
  if (!original || !now || was <= now) return null;
  return { was: money(original), now: money(price), save: `₹${(was - now).toLocaleString('en-IN')}` };
}

// ---------- icons ----------
const ICON_RULES = [
  [/bridge|walkway/, 'bridge'],
  [/hammock/, 'hammock'],
  [/\brain\b/, 'rain'],
  [/pool|swim/, 'pool'],
  [/boat|kayak|paddle|pedal/, 'boat'],
  [/train/, 'train'],
  [/cycl|bike/, 'bike'],
  [/gam|carrom|ludo|indoor|board/, 'gamepad'],
  [/tent|camp/, 'tent'],
  [/dining|food|meal|restaurant|kitchen|breakfast/, 'cutlery'],
  [/washroom|toilet|restroom|bathroom/, 'people'],
  [/bonfire|campfire|fire/, 'flame'],
  [/parking|car\b/, 'car'],
  [/wifi|wi-fi/, 'wifi'],
  [/cottage|room|dormitor|villa|house/, 'home'],
  [/family|friends|group|kids|children/, 'users'],
  [/lake|water|river|sea|beach|view/, 'waves'],
  [/overnight|night|sleep/, 'bed'],
  [/farm|nature|green|lawn|garden|open|tree|outdoor/, 'leaf'],
];
export function iconFor(label) {
  const text = (label || '').toLowerCase();
  const hit = ICON_RULES.find(([pattern]) => pattern.test(text));
  return hit ? hit[1] : 'sparkle';
}
