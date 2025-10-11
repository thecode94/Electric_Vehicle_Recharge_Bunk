// src/components/Layout.jsx
import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";
import { useAuth } from "../context/AuthProvider";
import '../styles/layout.css';

export default function Layout({
  withSidebar,
  withOwnerSidebar,
  withAdminSidebar
}) {
  const { user } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );

  // Determine user role
  const role = (user?.role || user?.type || user?.customClaims?.role || "user").toLowerCase();
  const isOwner = role === "owner" || user?.isOwner;
  const isAdmin = role === "admin" || user?.isAdmin;

  // Auto-detect sidebar type based on current route
  const currentPath = location.pathname;
  const isOwnerRoute = currentPath.startsWith('/owner');
  const isAdminRoute = currentPath.startsWith('/admin');
  const isUserDashboard = ['/dashboard', '/planner', '/profile', '/bookings', '/favorites'].some(path =>
    currentPath.startsWith(path)
  );

  // Determine sidebar type
  const getSidebarType = () => {
    if (withAdminSidebar || (isAdminRoute && isAdmin)) return 'admin';
    if (withOwnerSidebar || (isOwnerRoute && isOwner)) return 'owner';
    if (withSidebar || isUserDashboard) return 'user';

    if (isAdmin && isAdminRoute) return 'admin';
    if (isOwner && isOwnerRoute) return 'owner';
    if (user && isUserDashboard) return 'user';

    return null;
  };

  const sidebarType = getSidebarType();
  const showSidebar = sidebarType !== null;
  const showBottomNav = isMobile && showSidebar;

  // Handle window resize
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Menu toggle placeholder (if using a collapsible sidebar later)
  const onMenuToggle = () => {
    // no-op for now; could open a drawer on mobile
  };

  return (
    <div className="layout-container">
      {/* Header - Fixed at top */}
      <header className="layout-header">
        <Header
          isMobile={isMobile}
          showMenuButton={isMobile || !showSidebar ? false : true}
          onMenuToggle={onMenuToggle}
        />
      </header>

      {/* Main Container */}
      <div className={`layout-main ${showSidebar && !isMobile ? 'with-sidebar' : ''} ${sidebarType || ''}`}>
        {/* Desktop Sidebar - Only show on desktop */}
        {showSidebar && !isMobile && (
          <aside className={`layout-sidebar ${sidebarType}`}>
            <Sidebar
              type={sidebarType}
              user={user}
              role={role}
            />
          </aside>
        )}

        {/* Main Content */}
        <main className={`layout-content ${showBottomNav ? 'with-bottom-nav' : ''}`}>
          <div className="layout-content-inner">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {showBottomNav && (
        <nav className="layout-bottom-nav">
          <MobileBottomNav
            type={sidebarType}
            user={user}
            role={role}
            currentPath={currentPath}
          />
        </nav>
      )}

      {/* Footer - Only show on desktop or public pages */}
      {(!isMobile || !showSidebar) && <Footer />}

      {/* Styles */}
      <style jsx>{`
        .layout-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f8fafc;
          position: relative;
        }
        .layout-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #fff;
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        .layout-main {
          flex: 1;
          display: flex;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          padding: 16px;
        }
        .layout-main.with-sidebar {
          gap: 24px;
        }
        .layout-main.admin {
          max-width: 1600px;
        }
        .layout-sidebar {
          width: 260px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 80px;
          height: fit-content;
          max-height: calc(100vh - 120px);
          overflow-y: auto;
          border: 1px solid #e2e8f0;
        }
        .layout-sidebar.admin {
          width: 280px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .layout-sidebar.owner {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
        }
        .layout-content {
          flex: 1;
          min-width: 0;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        .layout-content.with-bottom-nav {
          margin-bottom: 70px;
        }
        .layout-content-inner {
          padding: 24px;
          min-height: calc(100vh - 200px);
        }
        .layout-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 70px;
          background: #fff;
          border-top: 1px solid #e2e8f0;
          box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 8px 16px;
        }
        @media (max-width: 768px) {
          .layout-main {
            padding: 0;
            flex-direction: column;
          }
          .layout-content {
            border-radius: 0;
            box-shadow: none;
            border: none;
          }
          .layout-content-inner {
            padding: 16px;
            min-height: calc(100vh - 140px);
          }
          .layout-content.with-bottom-nav .layout-content-inner {
            min-height: calc(100vh - 210px);
            padding-bottom: 80px;
          }
        }
      `}</style>
    </div>
  );
}
