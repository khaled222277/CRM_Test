import type { SVGProps } from "react";

/*
 * A small hand-rolled icon set.
 *
 * Only ~10 glyphs are needed, all on a 24px grid with a 1.6 stroke so they sit
 * evenly against the type. Not worth an icon-library dependency for this.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="3" width="7.5" height="8.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
    <rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.5" />
    <rect x="3" y="14.5" width="7.5" height="6.5" rx="1.5" />
  </Icon>
);

export const IconPipeline = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 5h16M6.5 12h11M10 19h4" />
  </Icon>
);

export const IconContacts = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const IconTasks = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 6.5 6 8.5l3-3.5" />
    <path d="M4 17.5 6 19.5l3-3.5" />
    <path d="M13 7h7M13 18h7" />
  </Icon>
);

export const IconCall = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5.5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.7 1.5A16 16 0 0 1 4 6.2 1.5 1.5 0 0 1 5.5 4Z" />
  </Icon>
);

export const IconEmail = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </Icon>
);

export const IconMeeting = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M8 3v4M16 3v4" />
  </Icon>
);

export const IconNote = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4M9 12h6M9 16h4" />
  </Icon>
);

export const IconMoney = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4v16" />
    <path d="M15.5 8.2A3 3 0 0 0 12.8 7h-1.4a2.4 2.4 0 0 0 0 4.8h1.2a2.4 2.4 0 0 1 0 4.8h-1.6a3 3 0 0 1-2.7-1.3" />
  </Icon>
);

export const IconClock = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 1.8" />
  </Icon>
);

export const IconTrend = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 16.5 9.5 11l3.5 3.5L20 8" />
    <path d="M15.5 8H20v4.5" />
  </Icon>
);

export const IconMenu = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const IconClose = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);

export const IconLogout = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
    <path d="M10 12h10m0 0-3-3m3 3-3 3" />
  </Icon>
);

export const IconInbox = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 13.5h4l1.5 2.5h6l1.5-2.5h4" />
    <path d="M5.5 5h13l2 8.5v3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-3z" />
  </Icon>
);

export const IconCalendarClock = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h6" />
    <path d="M3 10h17M8 3v4M16 3v4" />
    <circle cx="17.5" cy="16.5" r="4" />
    <path d="M17.5 14.8v1.9l1.3.8" />
  </Icon>
);

export const ACTIVITY_ICONS = {
  call: IconCall,
  email: IconEmail,
  meeting: IconMeeting,
  note: IconNote,
} as const;
