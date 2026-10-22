import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar,
  Ticket,
  LayoutDashboard,
  BarChart3,
  Users,
  FolderKanban,
  User,
  LogOut,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from './ui/ConfirmModal';
import Logo from './ui/Logo';

export default function AppShell({ children }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Persist sidebar collapsed state in localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('orgavents_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('orgavents_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Role-specific navigation items per Apple/DEVit minimalist design
  const getNavItems = () => {
    const calendarItem = {
      label: 'Calendar',
      path: '/calendar',
      icon: Calendar,
    };

    const myRsvpsItem = {
      label: 'My RSVPs',
      path: '/my-registrations',
      icon: Ticket,
    };

    const myEventsItem = {
      label: 'My Events',
      path: '/organizer',
      icon: LayoutDashboard,
    };

    const reportsItem = {
      label: 'Reports',
      path: '/reports',
      icon: BarChart3,
    };

    const usersItem = {
      label: 'Users',
      path: '/admin/users',
      icon: Users,
    };

    const allEventsItem = {
      label: 'All Events',
      path: '/admin/events',
      icon: FolderKanban,
    };

    const profileItem = {
      label: 'Profile',
      path: '/profile',
      icon: User,
    };

    if (role === 'admin') {
      return [
        calendarItem,
        myEventsItem,
        reportsItem,
        usersItem,
        allEventsItem,
        profileItem,
      ];
    }

    if (role === 'organizer') {
      return [
        calendarItem,
        myEventsItem,
        reportsItem,
        profileItem,
      ];
    }

    // Default: member
    return [
      calendarItem,
      myRsvpsItem,
      profileItem,
    ];
  };

  const navItems = getNavItems();

  const handleLogoutConfirm = () => {
    logout();
    setShowLogoutModal(false);
    navigate('/login');
  };

  const canCreateEvent = role === 'organizer' || role === 'admin';

  return (
    <div className="min-h-screen bg-[#F5F7F9] text-slate-900 flex flex-col antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[110] focus:px-4 focus:py-2 focus:rounded-xl focus:bg-slate-900 focus:text-white focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      {/* DESKTOP SIDEBAR (md: and up - w-64 expanded vs w-20 collapsed) */}
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-screen bg-white border-r border-slate-100 flex-col justify-between z-50 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20 px-3 py-6' : 'w-64 p-6'
        }`}
      >
        <div className="flex flex-col">
          {/* Header Row: Logo + Brand + Collapse Toggle */}
          <div
            className={`flex items-center ${
              isCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'
            } px-1`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Logo size={36} className="shrink-0" />
              {!isCollapsed && (
                <span className="text-xl font-bold tracking-tight text-slate-900 truncate">
                  OrgaVents
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={toggleSidebar}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors shrink-0"
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Navigation Links: Large, clean pill links with tooltips */}
          <nav className="flex flex-col gap-1.5 mt-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(`${item.path}/`));

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={`group relative flex items-center rounded-xl text-sm font-medium transition-all ${
                    isCollapsed
                      ? 'justify-center w-11 h-11 mx-auto'
                      : 'px-4 py-3 gap-3'
                  } ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-900'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}

                  {/* Crisp hover tooltip pill for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                      {item.label}
                    </div>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: New Event button + Compact User Row */}
        <div className="flex flex-col gap-3">
          {canCreateEvent && (
            <NavLink
              to="/events/new"
              title="New Event"
              className={`group relative rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm flex items-center justify-center shadow-sm transition-all active:scale-[0.99] ${
                isCollapsed ? 'w-11 h-11 mx-auto' : 'w-full h-11 gap-2'
              }`}
            >
              <Plus className={isCollapsed ? 'w-5 h-5' : 'w-4 h-4'} />
              {!isCollapsed && <span>New Event</span>}

              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                  New Event
                </div>
              )}
            </NavLink>
          )}

          {/* User Row */}
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2 pt-2 border-t border-slate-100">
              <NavLink
                to="/profile"
                className="group relative w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold transition-colors"
                title={`${user?.name || 'User'} (${role})`}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                  {user?.name || 'User'} ({role})
                </div>
              </NavLink>

              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="group relative p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                  Sign Out
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
              <NavLink
                to="/profile"
                className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity"
                title="Profile"
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold shrink-0">
                  {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {user?.name || 'Guest'}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 capitalize">
                    {role}
                  </span>
                </div>
              </NavLink>
              <button
                type="button"
                onClick={() => setShowLogoutModal(true)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors ml-1"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MOBILE TOP BAR (< md) */}
      <header className="md:hidden sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="text-base font-bold tracking-tight text-slate-900">OrgaVents</span>
        </div>
        <div className="flex items-center gap-2">
          {canCreateEvent && (
            <NavLink
              to="/events/new"
              className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>New</span>
            </NavLink>
          )}
          <NavLink
            to="/profile"
            className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-semibold"
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
          </NavLink>
        </div>
      </header>

      {/* MAIN CONTENT VIEWPORT */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 w-full outline-none transition-all duration-300 ease-in-out min-h-screen bg-[#F5F7F9] flex flex-col pb-20 md:pb-8 ${
          isCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        {children}
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (< md) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 w-full z-40 bg-white/90 backdrop-blur-md border-t border-slate-100 px-2 h-16 flex items-center justify-around"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(`${item.path}/`));

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-12 rounded-xl transition-all ${
                isActive
                  ? 'text-slate-900 font-semibold'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] mt-1 leading-none">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout Confirmation Dialog */}
      <ConfirmModal
        isOpen={showLogoutModal}
        title="Sign Out"
        message="Are you sure you want to sign out of OrgaVents?"
        confirmText="Sign Out"
        cancelText="Cancel"
        isDestructive={false}
        onConfirm={handleLogoutConfirm}
        onClose={() => setShowLogoutModal(false)}
      />
    </div>
  );
}
