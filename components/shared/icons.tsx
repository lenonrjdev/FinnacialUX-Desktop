import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DashboardIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 13h6V4H4v9Z"/><path d="M14 20h6v-9h-6v9Z"/><path d="M4 20h6v-3H4v3Z"/><path d="M14 7h6V4h-6v3Z"/></svg>;
}

export function TransactionsIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M5 7h14M5 12h14M5 17h9"/><path d="m16 15 3 2-3 2"/></svg>;
}

export function AccountsIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 8h16v11H4V8Z"/><path d="M7 8V5h10v3M8 12h8M8 15h5"/></svg>;
}

export function CreditCardIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></svg>;
}

export function BillsIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>;
}

export function IncomeIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 18h16"/><path d="M12 4v10"/><path d="m8 10 4 4 4-4"/></svg>;
}

export function CalendarIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>;
}

export function BudgetIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c-.7-1-1.7-1.5-3-1.5-1.7 0-3 1-3 2.3 0 3.4 6 1.4 6 4.2 0 1.4-1.3 2.5-3 2.5-1.4 0-2.6-.6-3.3-1.7"/></svg>;
}

export function TargetIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m15 9 5-5M17 4h3v3"/></svg>;
}

export function DebtIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 7h16v10H4V7Z"/><path d="M8 12h8M12 9v6"/><path d="M7 4h10M7 20h10"/></svg>;
}

export function SubscriptionIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M6 4h12v16H6V4Z"/><path d="M9 8h6M9 12h6M9 16h4"/><path d="M3 8V3h5M21 16v5h-5"/></svg>;
}

export function ReportsIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>;
}

export function SettingsIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
}

export function PlusIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 5v14M5 12h14"/></svg>;
}

export function UserIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
}

export function WalletIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M5 7h13a2 2 0 0 1 2 2v8H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10"/><path d="M16 11h4v4h-4a2 2 0 1 1 0-4Z"/></svg>;
}

export function MoonIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M20 15.2A8 8 0 1 1 8.8 4 6.5 6.5 0 0 0 20 15.2Z"/></svg>;
}

export function SunIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>;
}

export function MenuIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
}

export function CheckIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m5 12 4 4L19 6"/></svg>;
}

export function ArrowDownIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m7 9 5 5 5-5"/></svg>;
}

export function ArrowUpIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M7 17 17 7M9 7h8v8"/></svg>;
}

export function MoreIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="5" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r=".8" fill="currentColor" stroke="none"/></svg>;
}

export function ShoppingBagIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>;
}

export function SearchIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>;
}

export function DownloadIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>;
}

export function CloseIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m6 6 12 12M18 6 6 18"/></svg>;
}

export function ArrowRightLeftIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M7 7h13"/><path d="m16 3 4 4-4 4"/><path d="M17 17H4"/><path d="m8 21-4-4 4-4"/></svg>;
}

export function CopyIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>;
}

export function TrashIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>;
}

export function BankIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m3 9 9-5 9 5"/><path d="M5 10h14M6 10v7M10 10v7M14 10v7M18 10v7M4 17h16M3 20h18"/></svg>;
}

export function SavingsIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M5 11a7 7 0 0 1 13.6-2.2L21 10v5l-2.3.8A7 7 0 0 1 12 20H8a3 3 0 0 1-3-3v-1H3v-4h2v-1Z"/><path d="M15 7.5h.01M8 20v2M17 19v3M8 10h4"/></svg>;
}

export function InvestmentIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 20V10M10 20V14M16 20V6M22 20H2"/><path d="m5 7 5-3 5 2 5-4"/></svg>;
}

export function ChevronLeftIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m15 18-6-6 6-6"/></svg>;
}

export function ChevronRightIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m9 18 6-6-6-6"/></svg>;
}

export function CardChipIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5v14M16 5v14M4 10h16M4 14h16"/></svg>;
}

export function ClockIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
}

export function LockIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
}

export function ReceiptIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>;
}

export function TagIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m3 12 9 9 9-9-9-9H3v9Z"/><circle cx="8" cy="8" r="1"/></svg>;
}

export function ShieldIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 3 5 6v5c0 4.8 2.8 8.1 7 10 4.2-1.9 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
}

export function PlaneIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M22 2 9.6 14.4"/><path d="m22 2-8 20-4.4-7.6L2 10l20-8Z"/></svg>;
}

export function HomeIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>;
}

export function BookIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23V5.5Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5A3.5 3.5 0 0 1 20 23V5.5Z"/></svg>;
}

export function UploadIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 21V7"/><path d="m7 12 5-5 5 5"/><path d="M5 3h14"/></svg>;
}

export function DatabaseIcon(props: IconProps) {
  return <svg {...base} {...props}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>;
}

export function FileIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>;
}

export function MagicWandIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m4 20 10-10"/><path d="m12 8 4 4"/><path d="M18 3v4M16 5h4M6 4v3M4.5 5.5h3M19 15v3M17.5 16.5h3"/></svg>;
}

export function WarningIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17h.01"/></svg>;
}

export function EditIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13 7 4 4"/></svg>;
}

export function UsersIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

export function UserPlusIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8" cy="7" r="4"/><path d="M19 8v6M16 11h6"/></svg>;
}

export function EyeIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
}

export function MailIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>;
}

export function LogOutIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></svg>;
}

export function KeyIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M17 4h3v3M14 7l3 3"/></svg>;
}

export function GoogleIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M21 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.1a4.4 4.4 0 0 1-1.9 2.9v2.5h3.1c1.8-1.7 2.7-4.1 2.7-7.2Z"/><path d="M12 21c2.6 0 4.8-.9 6.3-2.3l-3.1-2.5c-.9.6-2 1-3.2 1-2.5 0-4.7-1.7-5.4-4H3.4v2.6A9.5 9.5 0 0 0 12 21Z"/><path d="M6.6 13.2a5.7 5.7 0 0 1 0-3.6V7H3.4A9.5 9.5 0 0 0 3.4 16l3.2-2.8Z"/><path d="M12 5.8c1.4 0 2.7.5 3.7 1.4l2.8-2.8A9.4 9.4 0 0 0 3.4 7l3.2 2.6c.7-2.3 2.9-3.8 5.4-3.8Z"/></svg>;
}

export function WorkspaceIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M8 9h13M12 13h5M12 16h3"/></svg>;
}

export function SaveIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M5 3h11l3 3v15H5V3Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/></svg>;
}

export function InfoIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>;
}

export function BellIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
}

export function MonitorIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}

export function DesktopIcon(props: IconProps) {
  return <MonitorIcon {...props} />;
}

export function MobileIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>;
}

export function TabletIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/></svg>;
}

export function HistoryIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>;
}

export function ArchiveIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 7h16v13H4V7Z"/><path d="M3 3h18v4H3V3ZM9 11h6"/></svg>;
}

export function PaletteIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 3a9 9 0 0 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h3a6 6 0 0 0 0-12h-3Z"/><circle cx="7.5" cy="9" r=".8" fill="currentColor" stroke="none"/><circle cx="10" cy="6.5" r=".8" fill="currentColor" stroke="none"/><circle cx="14" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg>;
}

export function EyeOffIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 4.2A11.4 11.4 0 0 1 12 4c6.5 0 10 8 10 8a17.7 17.7 0 0 1-2.2 3.4M6.2 6.2C3.6 8 2 12 2 12s3.5 8 10 8a10.8 10.8 0 0 0 4.1-.8"/></svg>;
}

export function FileCheckIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h5M9 15l2 2 4-4"/></svg>;
}

export function RefreshIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 8A7 7 0 0 1 18.5 6L20 8M4 16l1.5 2A7 7 0 0 0 18 16"/></svg>;
}
