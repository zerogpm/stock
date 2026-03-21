import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  LineChart,
  BarChart3,
  DollarSign,
  Newspaper,
  Brain,
  Star,
  X,
  Sun,
  Moon,
  Menu,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SECTION_ICONS = {
  'section-search': Search,
  'section-chart': LineChart,
  'section-metrics': BarChart3,
  'section-dividends': DollarSign,
  'section-news': Newspaper,
  'section-analysis': Brain,
};

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  visibleSections,
  activeSection,
  onNavigate,
  watchlist,
  currentSymbol,
  onWatchlistSelect,
  onWatchlistRemove,
  theme,
  toggleTheme,
  onStartTour,
}) {
  const isExpanded = !collapsed;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-screen z-50 flex flex-col
          border-r border-sidebar-border bg-sidebar text-sidebar-foreground
          transition-all duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
          ${collapsed ? 'md:w-14' : 'md:w-56'}
          w-56
        `}
      >
        {/* Toggle / close */}
        <div className="flex items-center justify-between h-14 px-3 border-b border-sidebar-border shrink-0">
          {isExpanded && (
            <span className="text-sm font-semibold truncate">Dashboard</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex size-8 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onToggle}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden size-8 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onMobileClose}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Section navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className={`mb-1 px-2 ${collapsed ? 'hidden' : ''}`}>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sections
            </span>
          </div>
          <ul className="space-y-0.5">
            {visibleSections.map(({ id, label }) => {
              const Icon = SECTION_ICONS[id];
              const isActive = activeSection === id;
              return (
                <li key={id}>
                  <button
                    onClick={() => {
                      onNavigate(id);
                      onMobileClose();
                    }}
                    className={`
                      flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm font-medium
                      transition-colors duration-150
                      ${isActive
                        ? 'bg-violet-600 text-white'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                      }
                      ${collapsed ? 'justify-center md:px-0' : ''}
                    `}
                    title={collapsed ? label : undefined}
                  >
                    {Icon && <Icon className="size-4 shrink-0" />}
                    {!collapsed && <span className="truncate">{label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Watchlist */}
          {watchlist.length > 0 && (
            <>
              <div className={`mt-5 mb-1 px-2 ${collapsed ? 'hidden' : ''}`}>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Watchlist
                </span>
              </div>
              {collapsed && (
                <div className="mt-5 mb-1 flex justify-center">
                  <Star className="size-4 text-muted-foreground" />
                </div>
              )}
              <ul className="space-y-0.5">
                {watchlist.map((sym) => {
                  const isCurrent = sym === currentSymbol?.toUpperCase();
                  return (
                    <li key={sym}>
                      <button
                        onClick={() => {
                          onWatchlistSelect(sym);
                          onMobileClose();
                        }}
                        className={`
                          flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-sm
                          transition-colors duration-150
                          ${isCurrent
                            ? 'bg-sidebar-accent font-semibold'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent'
                          }
                          ${collapsed ? 'justify-center md:px-0' : ''}
                        `}
                        title={collapsed ? sym : undefined}
                      >
                        <span className={`font-mono text-xs ${collapsed ? '' : ''}`}>
                          {collapsed ? sym.slice(0, 2) : sym}
                        </span>
                        {!collapsed && (
                          <span
                            role="button"
                            tabIndex={0}
                            className="ml-auto p-0.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              onWatchlistRemove(sym);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation();
                                onWatchlistRemove(sym);
                              }
                            }}
                          >
                            <X className="size-3" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>

        {/* Walk Me Through + Theme toggle at bottom */}
        <div className="shrink-0 border-t border-sidebar-border px-2 py-2 space-y-1">
          {onStartTour && (
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'sm'}
              className={`text-sidebar-foreground hover:bg-sidebar-accent ${collapsed ? 'w-full' : 'w-full justify-start gap-2'}`}
              onClick={() => {
                onStartTour();
                onMobileClose();
              }}
              title={collapsed ? 'Walk Me Through' : undefined}
            >
              <HelpCircle className="size-4" />
              {!collapsed && <span className="text-sm">Walk Me Through</span>}
            </Button>
          )}
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            className={`text-sidebar-foreground hover:bg-sidebar-accent ${collapsed ? 'w-full' : 'w-full justify-start gap-2'}`}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {!collapsed && (
              <span className="text-sm">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            )}
          </Button>
        </div>
      </aside>
    </>
  );
}

/** Hamburger button for mobile — render in the main content area */
export function SidebarMobileToggle({ onClick }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden size-9"
      onClick={onClick}
      aria-label="Open menu"
    >
      <Menu className="size-5" />
    </Button>
  );
}
