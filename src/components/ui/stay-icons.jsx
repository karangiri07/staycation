// Small line icons used by the property gallery. All draw on a 24x24 grid and take their colour from the text colour.
const PATHS = {
  pool: (<><path d="M8 14V6.5a2 2 0 0 1 4 0" /><path d="M15 14V6.5a2 2 0 0 1 4 0" /><path d="M8 9.5h7" /><path d="M2.5 17.5c1.6 0 1.6-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2" /><path d="M2.5 21c1.6 0 1.6-1.2 3.2-1.2s1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2 1.6-1.2 3.2-1.2 1.6 1.2 3.2 1.2" /></>),
  rain: (<><path d="M7.5 15.5a4 4 0 0 1-.4-7.98A5.5 5.5 0 0 1 17.7 8.3a3.6 3.6 0 0 1-.7 7.2z" /><path d="M8.5 18.5l-1 2.5M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5" /></>),
  boat: (<><path d="M3 15.5h18l-2.6 4.5H5.6z" /><path d="M12 15V4" /><path d="M12 5l6 8.5h-6" /><path d="M12 8l-4 5.5h4" /></>),
  train: (<><rect x="5" y="3.5" width="14" height="12.5" rx="3" /><path d="M5 10.5h14" /><circle cx="9" cy="13.2" r=".9" fill="currentColor" stroke="none" /><circle cx="15" cy="13.2" r=".9" fill="currentColor" stroke="none" /><path d="M8.5 16l-2 4.5M15.5 16l2 4.5M7 20.5h10" /></>),
  bike: (<><circle cx="6" cy="16" r="3.6" /><circle cx="18" cy="16" r="3.6" /><path d="M6 16l3.8-7.5h5.2l3 7.5" /><path d="M9.8 8.5L12.4 16l2.6-7.5" /><path d="M8.6 6h2.6" /></>),
  bridge: (<><path d="M2 18h20" /><path d="M4 18V8M20 18V8" /><path d="M4 8c4 5 12 5 16 0" /><path d="M8 13.2V18M12 14.4V18M16 13.2V18" /></>),
  gamepad: (<><rect x="2.5" y="7" width="19" height="10.5" rx="5.2" /><path d="M7.6 10.2v4.2M5.5 12.3h4.2" /><circle cx="15.6" cy="11.3" r=".95" fill="currentColor" stroke="none" /><circle cx="18" cy="13.4" r=".95" fill="currentColor" stroke="none" /></>),
  hammock: (<><path d="M3 5v14M21 5v14" /><path d="M3 8.5c3.2 8 14.8 8 18 0" /><path d="M7 15.8l-2 3.2M17 15.8l2 3.2" /></>),
  leaf: (<><path d="M5 19.5C5 11 10 5 19.5 4.5 19.5 14 13.5 19.5 5 19.5z" /><path d="M5 19.5c3-5.5 6.5-8.6 11-10.5" /></>),
  tent: (<><path d="M2.5 20.5L12 4l9.5 16.5z" /><path d="M9.8 20.5L12 15.5l2.2 5" /><path d="M12 4v3" /></>),
  cutlery: (<><path d="M6 3v6.5a2.2 2.2 0 0 0 4.4 0V3" /><path d="M8.2 3v18" /><path d="M17.5 21V3c-2.3 1.4-3.5 4.2-3.5 7.2V13h3.5" /></>),
  people: (<><circle cx="7.4" cy="5" r="2" /><path d="M4.4 21v-6H3.3l1.3-5.2a1.8 1.8 0 0 1 1.7-1.3h2.2a1.8 1.8 0 0 1 1.7 1.3L11.5 15h-1.1v6z" /><circle cx="16.6" cy="5" r="2" /><path d="M13.7 21v-6h-1l1.4-5.2a1.8 1.8 0 0 1 1.7-1.3h1.6a1.8 1.8 0 0 1 1.7 1.3L20.5 15h-1.2v6z" /></>),
  flame: (<><path d="M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.2-2.1-5-3.3-7.3-.5 1.3-1.4 2.3-2.5 2.8.2-2.6-.9-5.2-3.2-7.3.2 3.5-3.5 6-3.5 11.3C6 18.4 8.1 21 12 21z" /></>),
  car: (<><path d="M4 16.5V12l2-5h12l2 5v4.5z" /><path d="M4 12h16" /><circle cx="7.5" cy="16.5" r="1.6" /><circle cx="16.5" cy="16.5" r="1.6" /></>),
  wifi: (<><path d="M2.8 9.2a13 13 0 0 1 18.4 0M5.9 12.4a8.6 8.6 0 0 1 12.2 0M9 15.5a4.2 4.2 0 0 1 6 0" /><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" /></>),
  home: (<><path d="M3 11.2L12 4l9 7.2" /><path d="M5.5 9.8V20h13V9.8" /><path d="M10 20v-5.5h4V20" /></>),
  users: (<><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.3" /><path d="M16.2 14.2c2.9.3 4.8 2.6 4.8 5.8" /></>),
  waves: (<><path d="M2.5 8.5c1.6 0 1.6-1.4 3.2-1.4s1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4" /><path d="M2.5 13.5c1.6 0 1.6-1.4 3.2-1.4s1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4" /><path d="M2.5 18.5c1.6 0 1.6-1.4 3.2-1.4s1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4" /></>),
  bed: (<><path d="M3 19V6" /><path d="M3 15h18v4" /><path d="M21 15v-2.5A2.5 2.5 0 0 0 18.5 10H11v5" /><circle cx="7" cy="11.5" r="1.8" /></>),
  sparkle: (<><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" /><path d="M19 17v4M17 19h4" /></>),
  pin: (<><path d="M12 21s7-6 7-11.2a7 7 0 0 0-14 0C5 15 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.5" /></>),
  share: (<><circle cx="18" cy="5.5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="18.5" r="2.6" /><path d="M8.3 10.7l7.4-4M8.3 13.3l7.4 4" /></>),
  expand: (<><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>),
  shrink: (<><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></>),
  whatsapp: (<><path d="M3.2 20.8l1.5-4.6A8.9 8.9 0 1 1 8 19.5z" /><path d="M9.1 8.4c-.4.6-.5 1.6.3 2.9 1 1.7 2.5 3 4.2 3.5.9.3 1.7 0 2.1-.7l.3-.6-1.9-1-.8.8c-1-.4-2.1-1.4-2.5-2.5l.8-.8-.9-1.9z" /></>),
  check: (<><path d="M5 12.5l4.5 4.5L19 7.5" /></>),
};

export default function Icon({ name, className = '', strokeWidth = 1.8 }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] || PATHS.sparkle}
    </svg>
  );
}
