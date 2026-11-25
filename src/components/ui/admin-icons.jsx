// Small line-icon set for the admin panel (no extra dependency).
const PATHS = {
  home: (<><path d="M3.5 11 12 4l8.5 7" /><path d="M6 9.6V20h12V9.6" /><path d="M10 20v-5.2h4V20" /></>),
  reels: (<><rect x="3.5" y="3.5" width="17" height="17" rx="4.6" /><path d="M10 8.7v6.6l5.5-3.3z" /></>),
  user: (<><circle cx="12" cy="8" r="3.7" /><path d="M4.8 20c.8-3.8 3.7-5.7 7.2-5.7s6.4 1.9 7.2 5.7" /></>),
  mail: (<><rect x="3" y="5.5" width="18" height="13" rx="2.6" /><path d="m4 8 8 5.5L20 8" /></>),
  gear: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>),
  bell: (<><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.6 2H4.4z" /><path d="M10 21h4" /></>),
  down: <path d="m6 9 6 6 6-6" />,
  right: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  plusCircle: (<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
  pencil: (<><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m14.5 7.5 3 3" /></>),
  trash: (<><path d="M4 7h16M9 7V4.5h6V7" /><path d="m6.5 7 1 13h9l1-13M10 11v5M14 11v5" /></>),
  pin: (<><path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>),
  whatsapp: (<><path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8z" /><path d="M9.2 8.9c.3 2.4 2.5 4.6 4.9 4.9l1.2-1.2-1.7-1-.9.6a4.6 4.6 0 0 1-1.8-1.8l.6-.9-1-1.7z" /></>),
  camera: (<><rect x="3" y="7" width="18" height="13" rx="3" /><circle cx="12" cy="13.5" r="3.6" /><path d="M8.5 7 10 4.5h4L15.5 7" /></>),
  upload: <path d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14" />,
  save: (<><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>),
  image: (<><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 4 3.5 3-2.5 4.5 4" /></>),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  external: <path d="M7 17 17 7M9 7h8v8" />,
  logout: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />,
  copy: (<><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" /></>),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: (<><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.4M12 17v.1" /></>),
  dashboard: (<><rect x="3.5" y="3.5" width="7.5" height="9" rx="2" /><rect x="13" y="3.5" width="7.5" height="5.5" rx="2" /><rect x="13" y="11" width="7.5" height="9.5" rx="2" /><rect x="3.5" y="14.5" width="7.5" height="6" rx="2" /></>),
  shield: (<><path d="M12 3 4.5 6v5.6c0 4.4 3.1 7.8 7.5 9.4 4.4-1.6 7.5-5 7.5-9.4V6z" /><path d="m8.8 12.2 2.3 2.3 4.2-4.4" /></>),
  download: <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />,
  key: (<><circle cx="8" cy="15" r="3.6" /><path d="m10.6 12.4 8-8M15.5 7.5l2.4 2.4M13.4 9.6l1.8 1.8" /></>),
  refresh: (<><path d="M19.5 12a7.5 7.5 0 1 1-2.3-5.4" /><path d="M19.5 4.5v4h-4" /></>),
  pulse: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
  eye: (<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>),
};

export default function AIcon({ name, size = 20, className = '', fill = 'none' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export const PlayDot = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8.6 6v12l9.6-6z" /></svg>
);
