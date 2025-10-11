// src/routes/AppRoutes.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import Layout from "../components/Layout";
import Spinner from "../components/Spinner";

// Guard
import ProtectedRoute from "./ProtectedRoute";

// Lazy load pages
const Home = lazy(() => import("../pages/Home"));
const About = lazy(() => import("../pages/About"));
const Help = lazy(() => import("../pages/Help"));
const NotFound = lazy(() => import("../pages/NotFound"));
const PrivacyPolicy = lazy(() => import("../pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("../pages/TermsOfService"));

// Auth pages
const Login = lazy(() => import("../features/auth/pages/Login"));
const Register = lazy(() => import("../features/auth/pages/Register"));
const ForgotPassword = lazy(() => import("../features/auth/pages/ForgotPassword"));

// User pages
const Planner = lazy(() => import("../features/stations/pages/Planner"));
const Search = lazy(() => import("../features/stations/pages/Search"));
const StationDetails = lazy(() => import("../features/stations/pages/StationDetails"));
const Favorites = lazy(() => import("../features/stations/pages/Favorites"));
const Profile = lazy(() => import("../features/profile/pages/Profile"));
const Bookings = lazy(() => import("../features/bookings/pages/Bookings"));
const BookingDetails = lazy(() => import("../features/bookings/pages/BookingDetails"));
// NOTE: your PaymentHistory file is under 'features/payments/pages', not 'payment'
const PaymentHistory = lazy(() => import("../features/payments/pages/PaymentHistory"));
const Notifications = lazy(() => import("../features/notifications/pages/Notifications"));
const BookSlot = lazy(() => import("../features/bookings/pages/BookSlot"));
const Booking = lazy(() => import("../features/bookings/pages/Booking")); // optional legacy route page

// Owner pages
const OwnerDashboard = lazy(() => import("../features/owner/pages/OwnerDashboard"));
const OwnerStations = lazy(() => import("../features/owner/pages/OwnerStations"));
const OwnerFinance = lazy(() => import("../features/owner/pages/OwnerFinance"));
const StationForm = lazy(() => import("../features/owner/pages/StationForm"));
const OwnerLogin = lazy(() => import("../features/owner/pages/OwnerLogin"));
const OwnerRegister = lazy(() => import("../features/owner/pages/OwnerRegister"));
const OwnerAnalytics = lazy(() => import("../features/owner/pages/OwnerAnalytics"));

// Admin pages
const AdminDashboard = lazy(() => import("../features/admin/pages/AdminDashboard"));
const AdminStations = lazy(() => import("../features/admin/pages/AdminStations"));
const AdminUsers = lazy(() => import("../features/admin/pages/AdminUsers"));
const AdminFinance = lazy(() => import("../features/admin/pages/AdminFinance"));
const AdminAnalytics = lazy(() => import("../features/admin/pages/AdminAnalytics"));
const AdminSettings = lazy(() => import("../features/admin/pages/AdminSettings"));
const AdminBookings = lazy(() => import("../features/admin/pages/AdminBookings"));


// Payment pages
const Checkout = lazy(() => import("../features/payments/pages/Checkout"));
const PaySuccess = lazy(() => import("../features/bookings/pages/PaySuccess"));
const PayFailed = lazy(() => import("../features/bookings/pages/PayFailed"));
const PaymentRouter = lazy(() => import("../features/payments/pages/PaymentRouter"));


const SuspenseBoundary = ({ children }) => (
    <Suspense fallback={<Spinner />}>{children}</Suspense>
);

export default function AppRoutes() {
    return (
        <SuspenseBoundary>
            <Routes>
                {/* PUBLIC */}
                <Route element={<Layout />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/privacy" element={<PrivacyPolicy />} />
                    <Route path="/terms" element={<TermsOfService />} />

                    {/* Public discovery */}
                    <Route path="/stations" element={<Search />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/stations/:stationId" element={<StationDetails />} />

                    {/* Redirect old auth paths */}
                    <Route path="/login" element={<Navigate to="/auth/login" replace />} />
                    <Route path="/register" element={<Navigate to="/auth/register" replace />} />
                </Route>

                {/* AUTH (no sidebar) */}
                <Route element={<Layout />}>
                    <Route path="/auth/login" element={<Login />} />
                    <Route path="/auth/register" element={<Register />} />
                    <Route path="/auth/forgot-password" element={<ForgotPassword />} />

                    {/* Owner auth */}
                    <Route path="/owner/login" element={<OwnerLogin />} />
                    <Route path="/owner/register" element={<OwnerRegister />} />
                </Route>

                {/* USER (protected, with sidebar) */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<Layout withSidebar />}>
                        {/* <Route path="/dashboard" element={<Dashboard />} /> */}
                        <Route path="/planner" element={<Planner />} />
                        <Route path="/favorites" element={<Favorites />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/bookings" element={<Bookings />} />
                        <Route path="/bookings/:bookingId" element={<BookingDetails />} />
                        <Route path="/payments" element={<PaymentHistory />} />
                        <Route path="/notifications" element={<Notifications />} />
                    </Route>
                </Route>

                {/* BOOKINGS & PAYMENTS (protected, no sidebar) */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<Layout />}>
                        {/* Booking forms */}
                        <Route path="/stations/:id/book" element={<BookSlot />} />
                        <Route path="/booking/:id" element={<Booking />} /> {/* legacy/simpler page if you use it */}

                        {/* Legacy query routes -> redirect to /checkout/:bookingId */}
                        <Route path="/payment" element={<PaymentRouter />} />
                        <Route path="/pay" element={<PaymentRouter />} />

                        {/* Payment flow */}
                        <Route path="/checkout/:bookingId" element={<Checkout />} />
                        <Route path="/pay/success" element={<PaySuccess />} />
                        <Route path="/pay/failed" element={<PayFailed />} />
                    </Route>
                </Route>

                {/* OWNER (protected, owner sidebar) */}
                <Route element={<ProtectedRoute allowedRoles={['owner']} />}>
                    <Route element={<Layout withOwnerSidebar />}>
                        <Route path="/owner" element={<Navigate to="/owner/dashboard" replace />} />
                        <Route path="/owner/dashboard" element={<OwnerDashboard />} />
                        <Route path="/owner/stations" element={<OwnerStations />} />
                        <Route path="/owner/stations/create" element={<StationForm />} />
                        <Route path="/owner/stations/:stationId/edit" element={<StationForm />} />
                        <Route path="/owner/finance" element={<OwnerFinance />} />
                        <Route path="/owner/analytics" element={<OwnerAnalytics />} />
                        <Route path="/owner/profile" element={<Profile />} />
                    </Route>
                </Route>

                {/* ADMIN (protected, admin sidebar) */}
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                    <Route element={<Layout withAdminSidebar />}>
                        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="/admin/dashboard" element={<AdminDashboard />} />
                        <Route path="/admin/stations" element={<AdminStations />} />
                        <Route path="/admin/users" element={<AdminUsers />} />
                        <Route path="/admin/bookings" element={<AdminBookings />} />
                        <Route path="/admin/finance" element={<AdminFinance />} />
                        <Route path="/admin/analytics" element={<AdminAnalytics />} />
                        <Route path="/admin/settings" element={<AdminSettings />} />
                    </Route>
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </SuspenseBoundary>
    );
}
