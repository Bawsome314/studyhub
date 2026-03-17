import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { X, Keyboard } from 'lucide-react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import FloatingToolbar from './FloatingToolbar';
import KeyboardShortcuts from './KeyboardShortcuts';

const LEGAL = {
  terms: {
    title: 'Terms of Service',
    content: `Last updated: January 2025

1. Acceptance of Terms
By using StudyHub, you agree to these terms. If you do not agree, do not use the application.

2. Description of Service
StudyHub is a personal study tool. It is not affiliated with, endorsed by, or officially connected to Western Governors University (WGU) or any other educational institution.

3. User Content
You retain ownership of any content you create (notes, study guides, etc.). By sharing a study guide with the community, you grant other users a non-exclusive license to use that guide for personal study purposes.

4. Community Guides
Community-shared study guides are provided as-is by other users. We do not verify their accuracy or completeness. Use them at your own discretion.

5. No Warranty
StudyHub is provided "as is" without warranties of any kind. We do not guarantee that the service will be uninterrupted, error-free, or that study materials will lead to any particular academic outcome.

6. Limitation of Liability
StudyHub and its creators shall not be liable for any damages arising from the use of this application, including but not limited to academic outcomes, data loss, or interruption of service.

7. Data Storage
Your data is stored locally on your device and optionally synced to cloud services. You are responsible for backing up your data. We are not responsible for data loss.

8. Changes to Terms
We may update these terms at any time. Continued use of StudyHub constitutes acceptance of updated terms.`,
  },
  privacy: {
    title: 'Privacy Policy',
    content: `Last updated: January 2025

1. Information We Collect
- Account information (email) if you sign in via Supabase authentication
- Study data you create (notes, progress, quiz scores) stored locally and optionally synced to the cloud
- Community guides you choose to share publicly

2. How We Use Your Information
- To provide and maintain the study application
- To sync your data across devices (if you opt in)
- To display community-shared study guides to other users

3. Data Storage
- Local data is stored in your browser (localStorage and IndexedDB)
- Cloud-synced data is stored in Supabase (hosted by Supabase Inc.)
- Community guides are stored in a shared database accessible to all users

4. Data Sharing
- We do not sell your personal data
- Study progress, notes, and scores are private to your account
- Only study guides you explicitly share are visible to other users

5. Data Retention
- Local data persists until you clear your browser data or use the app's data management tools
- Cloud data persists until you delete your account or remove it manually

6. Your Rights
You can export, delete, or modify your data at any time through the Settings page.

7. Third-Party Services
- Supabase (authentication and data sync)
- Vercel (hosting)
- Google Fonts (typography)

8. Contact
For privacy concerns, reach out via the project's GitHub repository.`,
  },
  disclaimer: {
    title: 'Disclaimer',
    content: `StudyHub is an independent, open-source study tool built for personal use. It is not affiliated with, endorsed by, sponsored by, or officially connected to Western Governors University (WGU) or any other educational institution.

All course names, codes, and program structures referenced in the application are used for organizational purposes only and belong to their respective institutions.

Study guides — whether generated, imported, or shared by the community — are user-created content and may contain errors, omissions, or outdated information. They should be used as a supplement to, not a replacement for, official course materials.

Academic outcomes are not guaranteed. Use this tool at your own risk and always refer to your institution's official resources for authoritative course content.`,
  },
};

export default function Layout() {
  const location = useLocation();
  const [footerModal, setFooterModal] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const handleKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
      if ((e.key === '?' || e.key === '/') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      <main className="lg:ml-[260px] min-h-screen pb-20 lg:pb-0 flex flex-col">
        <div key={location.pathname} className="max-w-[1150px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 page-enter flex-1">
          <Outlet />
        </div>
        <footer className="max-w-[1150px] w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-4 border-t border-border mt-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-text-muted">
            <p>&copy; {new Date().getFullYear()} StudyHub. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setFooterModal('terms')} className="hover:text-text-secondary transition-colors">Terms of Service</button>
              <button onClick={() => setFooterModal('privacy')} className="hover:text-text-secondary transition-colors">Privacy Policy</button>
              <button onClick={() => setFooterModal('disclaimer')} className="hover:text-text-secondary transition-colors">Disclaimer</button>
              <button onClick={() => setShortcutsOpen(true)} className="hover:text-text-secondary transition-colors hidden lg:inline-flex items-center gap-1"><Keyboard className="w-3 h-3" /> Shortcuts</button>
            </div>
          </div>
        </footer>
      </main>
      <MobileNav />
      <FloatingToolbar />
      <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {footerModal && LEGAL[footerModal] && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50" onClick={() => setFooterModal(null)}>
          <div className="bg-bg-secondary rounded-2xl border border-border p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">{LEGAL[footerModal].title}</h2>
              <button onClick={() => setFooterModal(null)} className="p-1 text-text-muted hover:text-text-primary transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 text-xs text-text-secondary leading-relaxed whitespace-pre-line">
              {LEGAL[footerModal].content}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
