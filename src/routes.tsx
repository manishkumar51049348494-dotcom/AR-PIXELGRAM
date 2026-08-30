import type { ReactNode } from 'react';
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import RegisterPage from './pages/auth/RegisterPage';
import AccountDeletedPage from './pages/auth/AccountDeletedPage';
import LandingPage from './pages/landing/LandingPage';
import HomePage from './pages/home/HomePage';
import VideosPage from './pages/videos/VideosPage';
import WatchVideoPage from './pages/videos/WatchVideoPage';
import UploadVideoPage from './pages/videos/UploadVideoPage';
import CreatePostPage from './pages/post/CreatePostPage';
import StoriesPage from './pages/stories/StoriesPage';
import ChatListPage from './pages/chat/ChatListPage';
import ChatPage from './pages/chat/ChatPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import ProfilePage from './pages/profile/ProfilePage';
import EditProfilePage from './pages/profile/EditProfilePage';
import SettingsPage from './pages/settings/SettingsPage';
import AccountCenterPage from './pages/settings/AccountCenterPage';
import NotificationSettingsPage from './pages/settings/NotificationSettingsPage';
import ReelsPage from './pages/reels/ReelsPage';
import CreateReelPage from './pages/reels/CreateReelPage';
import SongPage from './pages/music/SongPage';
import PeoplePage from './pages/people/PeoplePage';
import ReportUserPage from './pages/report/ReportUserPage';
import AppealPage from './pages/appeal/AppealPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminContent from './pages/admin/AdminContent';
import AdminVerification from './pages/admin/AdminVerification';
import AdminReports from './pages/admin/AdminReports';
import AdminBroadcast from './pages/admin/AdminBroadcast';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminVisitors from './pages/admin/AdminVisitors';
import AdminLoginPage from './pages/admin/AdminLoginPage';

import FollowListPage from './pages/profile/FollowListPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  // Public routes
  { name: 'Landing', path: '/', element: <LandingPage />, public: true },
  { name: 'Login', path: '/login', element: <LoginPage />, public: true },
  { name: 'Forgot Password', path: '/forgot-password', element: <ForgotPasswordPage />, public: true },
  { name: 'Register', path: '/register', element: <RegisterPage />, public: true },
  { name: 'Admin Login', path: '/admin-login', element: <AdminLoginPage />, public: true },
  { name: 'Appeal', path: '/appeal', element: <AppealPage />, public: true },
  { name: 'Account Deleted', path: '/account-deleted', element: <AccountDeletedPage />, public: true },

  // Main app routes (require auth)
  { name: 'Home', path: '/home', element: <HomePage /> },
  { name: 'Videos', path: '/videos', element: <VideosPage /> },
  { name: 'Watch Video', path: '/videos/:videoId', element: <WatchVideoPage /> },
  { name: 'Upload Video', path: '/upload-video', element: <UploadVideoPage /> },
  { name: 'Create Post', path: '/create', element: <CreatePostPage /> },
  { name: 'Stories', path: '/stories', element: <StoriesPage /> },
  { name: 'Reels', path: '/reels', element: <ReelsPage /> },
  { name: 'Create Reel', path: '/create-reel', element: <CreateReelPage /> },
  { name: 'Song', path: '/song/:trackId', element: <SongPage /> },
  { name: 'People', path: '/people', element: <PeoplePage /> },
  { name: 'Chat', path: '/chat', element: <ChatListPage /> },
  { name: 'Chat Conversation', path: '/chat/:receiverId', element: <ChatPage /> },
  { name: 'Notifications', path: '/notifications', element: <NotificationsPage /> },
  { name: 'Profile', path: '/profile', element: <ProfilePage /> },
  { name: 'User Profile', path: '/profile/:userId', element: <ProfilePage /> },
  { name: 'Edit Profile', path: '/edit-profile', element: <EditProfilePage /> },
  { name: 'Settings', path: '/settings', element: <SettingsPage /> },
  { name: 'Notification Settings', path: '/settings/notifications', element: <NotificationSettingsPage /> },
  { name: 'Account Center', path: '/settings/account-center', element: <AccountCenterPage /> },
  { name: 'Report User', path: '/report-user/:userId', element: <ReportUserPage /> },
  { name: 'Followers', path: '/followers/:userId', element: <FollowListPage /> },
  { name: 'Following', path: '/following/:userId', element: <FollowListPage /> },

  // Admin routes
  { name: 'Admin Dashboard', path: '/admin', element: <AdminDashboard /> },
  { name: 'Admin Users', path: '/admin/users', element: <AdminUsers /> },
  { name: 'Admin Content', path: '/admin/content', element: <AdminContent /> },
  { name: 'Admin Verification', path: '/admin/verification', element: <AdminVerification /> },
  { name: 'Admin Reports', path: '/admin/reports', element: <AdminReports /> },
  { name: 'Admin Broadcast', path: '/admin/broadcast', element: <AdminBroadcast /> },
  { name: 'Admin Analytics', path: '/admin/analytics', element: <AdminAnalytics /> },
  { name: 'Admin Visitors', path: '/admin/visitors', element: <AdminVisitors /> },
];
