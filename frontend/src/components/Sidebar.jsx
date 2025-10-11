// src/components/Sidebar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { useState } from "react";

// Icon Components (Simple SVG)
const Icons = {
    Dashboard: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
    ),

    Home: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
    ),

    Search: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
    ),

    Map: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
        </svg>
    ),

    User: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
    ),

    Calendar: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
    ),

    Building: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15l-.75 18h-13.5L4.5 3zM9 9h6m-6 3h6m-6 3h6" />
        </svg>
    ),

    Wallet: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
        </svg>
    ),

    Chart: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
    ),

    Plus: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    ),

    Heart: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
    ),

    Settings: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
    ),

    Help: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
    ),

    Info: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
    ),

    ChevronDown: (props) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
    )
};

/**
 * Enhanced Sidebar Component with Icons and Better UX
 * Supports user, owner, and admin roles with proper theming
 */
export default function Sidebar({ type, user: propUser, role: propRole, isMobile, onClose }) {
    const { user: contextUser } = useAuth();
    const location = useLocation();
    const [collapsedGroups, setCollapsedGroups] = useState({});

    // Use props if provided (from Layout), otherwise use context
    const user = propUser || contextUser;
    const role = propRole || (user?.role || user?.type || user?.customClaims?.role || "user").toLowerCase();
    const sidebarType = type || (role === "admin" ? "admin" : role === "owner" ? "owner" : "user");

    const groups = buildGroups(sidebarType, role);

    // Toggle group collapse
    const toggleGroup = (groupTitle) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [groupTitle]: !prev[groupTitle]
        }));
    };

    // Get sidebar theme
    const getSidebarTheme = () => {
        switch (sidebarType) {
            case 'admin':
                return {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#ffffff',
                    headerBg: 'rgba(255, 255, 255, 0.1)',
                    linkHover: 'rgba(255, 255, 255, 0.1)',
                    linkActive: 'rgba(255, 255, 255, 0.2)'
                };
            case 'owner':
                return {
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: '#ffffff',
                    headerBg: 'rgba(255, 255, 255, 0.1)',
                    linkHover: 'rgba(255, 255, 255, 0.1)',
                    linkActive: 'rgba(255, 255, 255, 0.2)'
                };
            default:
                return {
                    background: '#ffffff',
                    color: '#374151',
                    headerBg: '#f8fafc',
                    linkHover: '#f3f4f6',
                    linkActive: '#eff6ff'
                };
        }
    };

    const theme = getSidebarTheme();

    return (
        <aside className="sidebar" style={{ background: theme.background, color: theme.color }}>
            {/* Sidebar Header */}
            <div className="sidebar-header" style={{ background: theme.headerBg }}>
                <div className="sidebar-title">
                    {sidebarType === "admin" && "Admin Panel"}
                    {sidebarType === "owner" && "Owner Portal"}
                    {sidebarType === "user" && "Dashboard"}
                </div>

                {isMobile && (
                    <button className="sidebar-close" onClick={onClose}>
                        <Icons.ChevronDown style={{ width: 20, height: 20, transform: 'rotate(90deg)' }} />
                    </button>
                )}
            </div>

            {/* User Info */}
            {user && (
                <div className="sidebar-user-info" style={{ background: theme.headerBg }}>
                    <div className="user-avatar-small">
                        {user.name ? user.name[0].toUpperCase() : user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="user-details">
                        <div className="user-name">{user.name || 'User'}</div>
                        <div className="user-role">{role}</div>
                    </div>
                </div>
            )}

            {/* Navigation Groups */}
            <div className="sidebar-nav">
                {groups.map((group) => (
                    <div key={group.title} className="nav-group">
                        <button
                            className="nav-group-header"
                            onClick={() => toggleGroup(group.title)}
                            style={{ color: theme.color }}
                        >
                            <span className="nav-group-title">{group.title}</span>
                            <Icons.ChevronDown
                                style={{
                                    width: 16,
                                    height: 16,
                                    transform: collapsedGroups[group.title] ? 'rotate(-90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease'
                                }}
                            />
                        </button>

                        {!collapsedGroups[group.title] && (
                            <nav className="nav-group-items">
                                {group.items.map((item) => (
                                    <SideLink
                                        key={item.to}
                                        to={item.to}
                                        label={item.label}
                                        icon={item.icon}
                                        theme={theme}
                                        isMobile={isMobile}
                                        onClose={onClose}
                                        badge={item.badge}
                                    />
                                ))}
                            </nav>
                        )}
                    </div>
                ))}
            </div>

            {/* Sidebar Footer */}
            <div className="sidebar-footer" style={{ borderTop: `1px solid ${theme.color}20` }}>
                <div className="version-info">
                    EV Recharge v1.0
                </div>
            </div>

            {/* Styles */}
            <style jsx>{`
                .sidebar {
                    width: 260px;
                    min-width: 220px;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    overflow: hidden;
                }
                
                .sidebar-header {
                    padding: 16px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                
                .sidebar-title {
                    font-weight: 700;
                    font-size: 16px;
                    opacity: 0.9;
                }
                
                .sidebar-close {
                    background: none;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    opacity: 0.7;
                    transition: opacity 0.2s ease;
                }
                
                .sidebar-close:hover {
                    opacity: 1;
                }
                
                .sidebar-user-info {
                    padding: 12px 16px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                }
                
                .user-avatar-small {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 12px;
                }
                
                .user-details {
                    flex: 1;
                    min-width: 0;
                }
                
                .user-name {
                    font-weight: 600;
                    font-size: 14px;
                    opacity: 0.9;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                .user-role {
                    font-size: 11px;
                    opacity: 0.7;
                    text-transform: capitalize;
                    margin-top: 2px;
                }
                
                .sidebar-nav {
                    flex: 1;
                    overflow-y: auto;
                    padding: 8px 0;
                }
                
                .nav-group {
                    margin-bottom: 4px;
                }
                
                .nav-group-header {
                    width: 100%;
                    background: none;
                    border: none;
                    padding: 8px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                    opacity: 0.7;
                    transition: opacity 0.2s ease;
                    font-family: inherit;
                }
                
                .nav-group-header:hover {
                    opacity: 1;
                }
                
                .nav-group-title {
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                
                .nav-group-items {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    padding: 0 8px;
                }
                
                .sidebar-footer {
                    padding: 16px;
                    margin-top: auto;
                }
                
                .version-info {
                    font-size: 11px;
                    opacity: 0.5;
                    text-align: center;
                }
                
                /* Mobile specific styles */
                @media (max-width: 768px) {
                    .sidebar {
                        width: 100%;
                        max-width: 280px;
                    }
                }
            `}</style>
        </aside>
    );
}

function SideLink({ to, label, icon, theme, isMobile, onClose, badge }) {
    const location = useLocation();
    const isActive = location.pathname === to ||
        (to !== '/' && location.pathname.startsWith(to));

    const IconComponent = Icons[icon];

    const handleClick = () => {
        if (isMobile && onClose) {
            onClose();
        }
    };

    return (
        <NavLink
            to={to}
            onClick={handleClick}
            className="sidebar-link"
            style={({ isActive: active }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'inherit',
                fontSize: '14px',
                fontWeight: active ? '600' : '500',
                background: active ? theme.linkActive : 'transparent',
                opacity: active ? 1 : 0.8,
                transition: 'all 0.2s ease',
                position: 'relative'
            })}
        >
            {IconComponent && (
                <IconComponent style={{ width: 18, height: 18, flexShrink: 0 }} />
            )}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
            </span>
            {badge && (
                <span style={{
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '600',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    minWidth: '16px',
                    textAlign: 'center'
                }}>
                    {badge}
                </span>
            )}

            <style jsx>{`
                .sidebar-link:hover {
                    background: ${theme.linkHover} !important;
                    opacity: 1 !important;
                    transform: translateX(2px);
                }
            `}</style>
        </NavLink>
    );
}

function buildGroups(sidebarType, role) {
    if (sidebarType === "admin") {
        return [
            {
                title: "Overview",
                items: [
                    { to: "/admin/dashboard", label: "Dashboard", icon: "Dashboard" },
                    { to: "/admin/analytics", label: "Analytics", icon: "Chart" }
                ]
            },
            {
                title: "Management",
                items: [
                    { to: "/admin/users", label: "Users", icon: "User" },
                    { to: "/admin/stations", label: "Stations", icon: "Building" },
                    { to: "/admin/bookings", label: "Bookings", icon: "Calendar" },
                ]
            },

        ];
    }

    if (sidebarType === "owner") {
        return [
            {
                title: "Overview",
                items: [
                    { to: "/owner/dashboard", label: "Dashboard", icon: "Dashboard" },
                    { to: "/owner/finance", label: "finance", icon: "finance" },
                ]
            },
            {
                title: "Stations",
                items: [
                    { to: "/owner/stations", label: "My Stations", icon: "Building" },

                ]
            },

            {
                title: "Account",
                items: [
                    { to: "/profile", label: "Profile", icon: "User" },
                ]
            }
        ];
    }

    // Default user sidebar
    return [
        {
            title: "Navigation",
            items: [

                { to: "/planner", label: "Trip Planner", icon: "Map" },
                { to: "/stations", label: "Find Stations", icon: "Search" },
            ]
        },
        {
            title: "Account",
            items: [
                { to: "/bookings", label: "My Bookings", icon: "Calendar" },
                { to: "/favorites", label: "Favorites", icon: "Heart" },
                { to: "/profile", label: "Profile", icon: "User" },
            ]
        },
        {
            title: "Support",
            items: [
                { to: "/help", label: "Help & Support", icon: "Help" },
                { to: "/about", label: "About", icon: "Info" },
            ]
        }
    ];
}
