import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ mobileOpen = false, setMobileOpen = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const path = location.pathname;

  const handleLogout = (e) => {
    e.preventDefault();
    logout();
    navigate('/');
  };

  const navItems = [
    { name: 'Chat', icon: 'chat', path: '/chat' },
    { name: 'Memory', icon: 'database', path: '/vault' },
    { name: 'Analytics', icon: 'monitoring', path: '/analytics' },
    { name: 'Settings', icon: 'settings', path: '/settings' },
  ];

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside 
        id="mobile-menu" 
        className={`fixed left-0 top-0 h-full w-64 flex flex-col p-md z-50 bg-surface-container-low/95 backdrop-blur-2xl border-r border-white/5 shadow-2xl transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between mb-xl px-sm">
          <div className="flex items-center gap-md cursor-pointer" onClick={() => { handleNavClick(); navigate('/'); }}>
            <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-on-primary-container">memory</span>
            </div>
            <div>
              <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-primary leading-none">Hindsight</h1>
              <p className="font-label-mono text-label-mono text-outline opacity-70">AI Ops Manager</p>
            </div>
          </div>
          <button 
            className="md:hidden text-outline hover:text-on-surface p-1"
            onClick={() => setMobileOpen(false)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 space-y-sm">
          {navItems.map((item) => {
            const isActive = path === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={handleNavClick}
                className={`flex items-center gap-md px-md py-sm rounded-lg font-label-mono text-label-mono transition-all ${
                  isActive
                    ? 'text-primary-fixed-dim bg-primary/10 translate-x-1 font-bold'
                    : 'text-outline hover:bg-white/5 hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
          <a
            href="#"
            onClick={(e) => { handleNavClick(); handleLogout(e); }}
            className="flex items-center gap-md px-md py-sm text-outline hover:bg-white/5 hover:text-on-error rounded-lg font-label-mono text-label-mono transition-all mt-4"
          >
            <span className="material-symbols-outlined">logout</span>
            Logout
          </a>
        </nav>

        <div className="mt-auto space-y-sm">
          <div className="p-sm bg-surface-container-high/40 rounded-lg border border-white/5 mb-md">
            <p className="font-label-mono text-[10px] text-outline uppercase tracking-widest mb-xs">Active Instance</p>
            <div className="flex items-center justify-between">
              <span className="font-label-mono text-label-mono text-secondary">Gemini 2.5 Flash</span>
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            </div>
          </div>
          <button
            onClick={() => { handleNavClick(); navigate('/chat'); }}
            className="w-full mt-sm py-sm bg-primary text-on-primary font-label-mono text-label-mono rounded-lg active:scale-95 transition-transform font-bold shadow-md shadow-primary/20"
          >
            New Session
          </button>
        </div>
      </aside>
    </>
  );
}
