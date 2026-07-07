import { motion } from 'motion/react';
import { Globe, Download, Clipboard, Bell, Database, Shield } from 'lucide-react';

interface Permission {
  id: string;
  icon: typeof Globe;
  title: string;
  why: string;
  note: string;
}

const PERMISSIONS: Permission[] = [
  {
    id: 'page-access',
    icon: Globe,
    title: 'Page access',
    why: 'Notch reads page content when you click capture. It only accesses the active tab at the moment you trigger a capture.',
    note: 'No background reading. No data sent to Notch servers.',
  },
  {
    id: 'downloads',
    icon: Download,
    title: 'Downloads',
    why: 'Used when you export your knowledge base or save PDFs. Downloads only happen on explicit export actions.',
    note: 'No automatic downloads. User-initiated only.',
  },
  {
    id: 'clipboard',
    icon: Clipboard,
    title: 'Clipboard',
    why: 'Lets you paste URLs or text into Notch for quick capture. Only read when you paste.',
    note: 'No clipboard monitoring. Read only on paste.',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications',
    why: 'Alerts you when long-running captures complete so you can return to your work.',
    note: 'Status notifications only. No marketing or ads.',
  },
  {
    id: 'storage',
    icon: Database,
    title: 'Storage',
    why: 'All captures, notes, and settings are saved in your browser local storage. Your data stays on your device.',
    note: 'Local-first. No cloud sync unless you configure a provider.',
  },
];

export function PermissionCard() {
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center max-w-md">
        <h2 className="text-[26px] font-bold text-ink mb-2 tracking-[-0.02em]">
          Privacy & permissions
        </h2>
        <p className="text-[14px] text-ink-muted">
          Notch is built with privacy first. Every permission has a purpose.
        </p>
      </div>

      <div className="w-full max-w-md space-y-2.5">
        {PERMISSIONS.map((perm, index) => {
          const Icon = perm.icon;
          return (
            <motion.div
              key={perm.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl border border-hairline bg-card p-4"
            >
              <div className="flex gap-3.5">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center">
                  <Icon size={17} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-semibold text-ink mb-0.5">{perm.title}</h3>
                  <p className="text-[12px] text-ink-muted leading-relaxed mb-1.5">{perm.why}</p>
                  <div className="flex items-start gap-1.5">
                    <Shield size={11} className="shrink-0 mt-0.5 text-success" />
                    <p className="text-[11px] text-success/80">{perm.note}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10"
      >
        <Shield size={13} className="text-primary" />
        <span className="text-[12px] text-ink-muted">
          Open source &middot; Encrypted &middot; Local-first
        </span>
      </motion.div>
    </div>
  );
}
