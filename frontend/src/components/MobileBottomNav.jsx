// src/components/MobileBottomNav.jsx
import { Link, useLocation } from "react-router-dom";
import {
    HomeIcon,
    MapPinIcon,
    UserIcon,
    BookmarkIcon,
    CalendarIcon,
    ChartBarIcon,
    BuildingOfficeIcon,
    CogIcon,
    WalletIcon
} from "@heroicons/react/24/outline";
import {
    HomeIcon as HomeIconSolid,
    MapPinIcon as MapPinIconSolid,
    UserIcon as UserIconSolid,
    BookmarkIcon as BookmarkIconSolid,
    CalendarIcon as CalendarIconSolid,
    ChartBarIcon as ChartBarIconSolid,
    BuildingOfficeIcon as BuildingOfficeIconSolid,
    CogIcon as CogIconSolid,
    WalletIcon as WalletIconSolid
} from "@heroicons/react/24/solid";

export default function MobileBottomNav({ type, user, role, currentPath }) {
    const location = useLocation();

    // Get navigation items based on user type
    const getNavItems = () => {
        switch (type) {
            case 'admin':
                return [
                    {
                        label: 'Dashboard',
                        path: '/admin/dashboard',
                        icon: HomeIcon,
                        iconSolid: HomeIconSolid
                    },
                    {
                        label: 'Stations',
                        path: '/admin/stations',
                        icon: BuildingOfficeIcon,
                        iconSolid: BuildingOfficeIconSolid
                    },
                    {
                        label: 'Finance',
                        path: '/admin/finance',
                        icon: WalletIcon,
                        iconSolid: WalletIconSolid
                    },
                    {
                        label: 'Analytics',
                        path: '/admin/analytics',
                        icon: ChartBarIcon,
                        iconSolid: ChartBarIconSolid
                    },
                    {
                        label: 'Settings',
                        path: '/admin/settings',
                        icon: CogIcon,
                        iconSolid: CogIconSolid
                    }
                ];

            case 'owner':
                return [
                    {
                        label: 'Dashboard',
                        path: '/owner/dashboard',
                        icon: HomeIcon,
                        iconSolid: HomeIconSolid
                    },
                    {
                        label: 'Stations',
                        path: '/owner/stations',
                        icon: BuildingOfficeIcon,
                        iconSolid: BuildingOfficeIconSolid
                    },
                    {
                        label: 'Finance',
                        path: '/owner/finance',
                        icon: WalletIcon,
                        iconSolid: WalletIconSolid
                    },
                    {
                        label: 'Analytics',
                        path: '/owner/analytics',
                        icon: ChartBarIcon,
                        iconSolid: ChartBarIconSolid
                    },
                    {
                        label: 'Profile',
                        path: '/owner/profile',
                        icon: UserIcon,
                        iconSolid: UserIconSolid
                    }
                ];

            case 'user':
            default:
                return [
                    {
                        label: 'Home',
                        path: '/dashboard',
                        icon: HomeIcon,
                        iconSolid: HomeIconSolid
                    },
                    {
                        label: 'Planner',
                        path: '/planner',
                        icon: MapPinIcon,
                        iconSolid: MapPinIconSolid
                    },
                    {
                        label: 'Bookings',
                        path: '/bookings',
                        icon: CalendarIcon,
                        iconSolid: CalendarIconSolid
                    },
                    {
                        label: 'Favorites',
                        path: '/favorites',
                        icon: BookmarkIcon,
                        iconSolid: BookmarkIconSolid
                    },
                    {
                        label: 'Profile',
                        path: '/profile',
                        icon: UserIcon,
                        iconSolid: UserIconSolid
                    }
                ];
        }
    };

    const navItems = getNavItems();

    return (
        <>
            {navItems.map((item) => {
                const isActive = location.pathname === item.path ||
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                const Icon = isActive ? item.iconSolid : item.icon;

                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            color: isActive ? '#3b82f6' : '#6b7280',
                            backgroundColor: isActive ? '#eff6ff' : 'transparent',
                            transition: 'all 0.2s ease',
                            minWidth: '60px',
                            fontSize: '12px',
                            fontWeight: isActive ? '600' : '400'
                        }}
                    >
                        <Icon style={{ width: '24px', height: '24px', marginBottom: '4px' }} />
                        <span>{item.label}</span>
                    </Link>
                );
            })}
        </>
    );
}
