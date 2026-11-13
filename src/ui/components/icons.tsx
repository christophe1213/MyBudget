import type { ReactNode } from 'react'

function Icon({ children, className = 'size-6' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  )
}

type P = { className?: string }
export const HomeIcon = (p: P) => <Icon {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></Icon>
export const PlusIcon = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Icon>
export const PieIcon = (p: P) => <Icon {...p}><path d="M12 3v9h9" /><path d="M20.5 15A9 9 0 1 1 9 3.5" /></Icon>
export const ReportIcon = (p: P) => <Icon {...p}><path d="M5 20V10M12 20V4M19 20v-7" /></Icon>
export const SettingsIcon = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></Icon>
export const TrashIcon = (p: P) => <Icon {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></Icon>
export const ChevronIcon = (p: P) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
export const DownloadIcon = (p: P) => <Icon {...p}><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></Icon>
export const UploadIcon = (p: P) => <Icon {...p}><path d="M12 16V5M7 9l5-5 5 5M5 20h14" /></Icon>
export const CheckIcon = (p: P) => <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
export const WalletIcon = (p: P) => <Icon {...p}><path d="M4 7a2 2 0 0 1 2-2h12v4" /><rect x="3" y="8" width="18" height="12" rx="2" /><circle cx="16.5" cy="14" r="1" /></Icon>
export const CloseIcon = (p: P) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
