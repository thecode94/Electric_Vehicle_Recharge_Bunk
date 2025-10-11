// src/components/Header.jsx - COMPLETE VERSION WITH ACTIVE STATES & ROUTING FIX
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { useAuth } from "../context/AuthProvider";

// Simple Icons
const BellIcon = ({ hasNotifications, ...props }) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        {hasNotifications && (
            <circle cx="18" cy="6" r="3" fill="#ef4444" stroke="white" strokeWidth="1" />
        )}
    </svg>
);

const MenuIcon = (props) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);

const LogoutIcon = (props) => (
    <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
);

// User Avatar Component
const UserAvatar = ({ user, size = 32 }) => {
    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : user?.email?.[0]?.toUpperCase() || 'A';

    const avatarStyles = {
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        overflow: 'hidden',
        border: '2px solid #e5e7eb',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    const imageStyles = {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
    };

    const defaultStyles = {
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${size * 0.4}px`,
        fontWeight: '600'
    };

    return (
        <div style={avatarStyles} className="user-avatar">
            {user?.avatar ? (
                <img
                    src={user.avatar}
                    alt={user.name || user.email}
                    style={imageStyles}
                />
            ) : (
                <div style={defaultStyles}>
                    {initials}
                </div>
            )}
        </div>
    );
};

export default function Header({ onMenuToggle, showMenuButton, isMobile }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // User role detection
    const role = useMemo(() => {
        if (!user) return null;

        const userRole = user.role ||
            user.customClaims?.role ||
            (user.isOwner ? "owner" : null) ||
            (user.isAdmin ? "admin" : null) ||
            "user";

        return String(userRole).toLowerCase();
    }, [user]);

    const isOwner = user && (role === "owner" || user?.isOwner);
    const isAdmin = user && (role === "admin" || user?.isAdmin);

    // Handle logout
    const handleLogout = async () => {
        try {
            await logout();
            navigate("/", { replace: true });
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // Function to get nav item styles
    const getNavItemStyle = (path, isSpecial = false) => {
        const isActive = location.pathname === path ||
            (path !== '/' && location.pathname.startsWith(path));

        const baseStyle = {
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.3s ease',
            position: 'relative',
            display: 'inline-block'
        };

        if (isSpecial === 'owner') {
            return {
                ...baseStyle,
                color: '#f59e0b',
                background: isActive ? '#fef3c7' : 'transparent',
                fontWeight: '600',
                border: isActive ? '2px solid #f59e0b' : '2px solid transparent',
                transform: isActive ? 'translateY(-1px)' : 'none',
                boxShadow: isActive ? '0 4px 12px rgba(245, 158, 11, 0.3)' : 'none'
            };
        }

        if (isSpecial === 'admin') {
            return {
                ...baseStyle,
                color: '#8b5cf6',
                background: isActive ? '#f3e8ff' : 'transparent',
                fontWeight: '600',
                border: isActive ? '2px solid #8b5cf6' : '2px solid transparent',
                transform: isActive ? 'translateY(-1px)' : 'none',
                boxShadow: isActive ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none'
            };
        }

        // Regular nav item
        return {
            ...baseStyle,
            color: isActive ? '#3b82f6' : '#6b7280',
            background: isActive ? '#eff6ff' : 'transparent',
            fontWeight: isActive ? '600' : '500',
            border: isActive ? '2px solid #3b82f6' : '2px solid transparent',
            transform: isActive ? 'translateY(-1px)' : 'none',
            boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.2)' : 'none'
        };
    };

    // Header styles
    const headerStyles = {
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };

    const containerStyles = {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '12px 24px',
        display: 'grid',
        gridTemplateColumns: showMenuButton ? 'auto auto 1fr auto' : 'auto 1fr auto',
        alignItems: 'center',
        gap: '20px',
        height: '64px'
    };

    const brandStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none',
        color: 'inherit',
        fontWeight: '700',
        fontSize: '20px',
        transition: 'all 0.3s ease'
    };

    const brandIconStyles = {
        fontSize: '24px',
        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
    };

    const brandNameStyles = {
        background: 'linear-gradient(135deg, #1f2937 0%, #3b82f6 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        display: isMobile ? 'none' : 'block'
    };

    const navigationStyles = {
        display: isMobile ? 'none' : 'flex',
        gap: '8px',
        justifySelf: 'center',
        alignItems: 'center'
    };

    const actionsStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
    };

    const profileBtnStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none',
        color: 'inherit',
        padding: '6px 12px',
        borderRadius: '10px',
        transition: 'all 0.3s ease',
        border: '2px solid #e5e7eb',
        background: '#f9fafb',
        minWidth: isMobile ? 'auto' : '120px',
        cursor: 'pointer'
    };

    const profileTextStyles = {
        fontSize: '14px',
        fontWeight: '500',
        color: '#374151',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '80px',
        display: isMobile ? 'none' : 'block'
    };

    const authGroupStyles = {
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
    };

    const loginLinkStyles = {
        textDecoration: 'none',
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: '500',
        color: '#6b7280',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        transition: 'all 0.3s ease',
        background: '#f9fafb'
    };

    const signupLinkStyles = {
        textDecoration: 'none',
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: '600',
        color: 'white',
        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        borderRadius: '8px',
        transition: 'all 0.3s ease',
        border: '2px solid transparent',
        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
    };

    const logoutBtnStyles = {
        background: '#fef2f2',
        border: '2px solid #fecaca',
        borderRadius: '8px',
        padding: '8px',
        color: '#dc2626',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    const notifyBtnStyles = {
        background: '#f9fafb',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        padding: '8px',
        color: '#6b7280',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        textDecoration: 'none',
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    return (
        <header style={headerStyles}>
            <div style={containerStyles}>
                {/* Mobile Menu Button */}
                {showMenuButton && (
                    <button
                        style={{
                            background: 'none',
                            border: '2px solid #e5e7eb',
                            borderRadius: '8px',
                            padding: '8px',
                            color: '#6b7280',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                        }}
                        onClick={onMenuToggle}
                        aria-label="Toggle menu"
                        onMouseOver={(e) => {
                            e.target.style.background = '#f3f4f6';
                            e.target.style.borderColor = '#d1d5db';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.background = 'none';
                            e.target.style.borderColor = '#e5e7eb';
                        }}
                    >
                        <MenuIcon style={{ width: '20px', height: '20px' }} />
                    </button>
                )}

                {/* Brand Logo */}
                <Link
                    to="/"
                    style={brandStyles}
                    onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    <span style={brandIconStyles}>⚡</span>
                    <span style={brandNameStyles}>EV Recharge</span>
                </Link>

                {/* Navigation */}
                <nav style={navigationStyles}>
                    <NavLink to="/" style={getNavItemStyle('/')}>
                        Home
                    </NavLink>
                    <NavLink to="/planner" style={getNavItemStyle('/planner')}>
                        Planner
                    </NavLink>
                    <NavLink to="/search" style={getNavItemStyle('/search')}>
                        Find Stations
                    </NavLink>
                    <NavLink to="/about" style={getNavItemStyle('/about')}>
                        About
                    </NavLink>
                    <NavLink to="/help" style={getNavItemStyle('/help')}>
                        Help
                    </NavLink>

                    {isOwner && (
                        <NavLink to="/owner/dashboard" style={getNavItemStyle('/owner/dashboard', 'owner')}>
                            Owner Portal
                        </NavLink>
                    )}

                    {isAdmin && (
                        <NavLink to="/admin/dashboard" style={getNavItemStyle('/admin/dashboard', 'admin')}>
                            Admin Panel
                        </NavLink>
                    )}
                </nav>

                {/* Right Actions */}
                <div style={actionsStyles}>
                    {user ? (
                        <>
                            <Link
                                to="/notifications"
                                style={notifyBtnStyles}
                                title="Notifications"
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = '#f3f4f6';
                                    e.currentTarget.style.borderColor = '#d1d5db';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                    e.currentTarget.style.transform = 'translateY(0px)';
                                }}
                            >
                                <BellIcon hasNotifications={false} style={{ width: '20px', height: '20px' }} />
                            </Link>

                            <button
                                style={logoutBtnStyles}
                                onClick={handleLogout}
                                title="Logout"
                                aria-label="Logout"
                                onMouseOver={(e) => {
                                    e.target.style.background = '#fee2e2';
                                    e.target.style.borderColor = '#fca5a5';
                                    e.target.style.transform = 'translateY(-2px)';
                                }}
                                onMouseOut={(e) => {
                                    e.target.style.background = '#fef2f2';
                                    e.target.style.borderColor = '#fecaca';
                                    e.target.style.transform = 'translateY(0px)';
                                }}
                            >
                                <LogoutIcon style={{ width: '20px', height: '20px' }} />
                            </button>

                            <Link
                                to="/profile"
                                style={profileBtnStyles}
                                title={`${user.name || user.email} - View Profile`}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = '#f3f4f6';
                                    e.currentTarget.style.borderColor = '#3b82f6';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                    e.currentTarget.style.transform = 'translateY(0px)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <UserAvatar user={user} size={32} />
                                <span style={profileTextStyles}>
                                    {user.name || user.email?.split('@')[0] || 'User'}
                                </span>
                            </Link>
                        </>
                    ) : (
                        <div style={authGroupStyles}>
                            <Link
                                to="/auth/login"
                                style={loginLinkStyles}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = '#f3f4f6';
                                    e.currentTarget.style.borderColor = '#d1d5db';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                    e.currentTarget.style.borderColor = '#e5e7eb';
                                    e.currentTarget.style.transform = 'translateY(0px)';
                                }}
                            >
                                Login
                            </Link>
                            <Link
                                to="/owner/login"
                                style={signupLinkStyles}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0px) scale(1)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
                                }}
                            >
                                Owner Login
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
