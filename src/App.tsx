import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { RouteGuard } from "@/components/common/RouteGuard";
import { CallProvider } from "@/contexts/CallContext";
import { CallOverlay, IncomingCallModal } from "@/components/call/CallOverlay";
import { routes } from "./routes";
import { useVisitTracker } from "@/hooks/useVisitTracker";
import { YouTubePlayerProvider } from "@/contexts/YouTubePlayerContext";

const VisitTracker: React.FC = () => {
  useVisitTracker();
  return null;
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <Router>
        <AuthProvider>
          <CallProvider>
            <VisitTracker />
            <YouTubePlayerProvider>
              <RouteGuard>
                <Routes>
                  {routes.map((route, index) => (
                    <Route
                      key={index}
                      path={route.path}
                      element={route.element}
                    />
                  ))}
                  <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
              </RouteGuard>
            </YouTubePlayerProvider>
            <IncomingCallModal />
            <CallOverlay />
          </CallProvider>
        </AuthProvider>
        <Toaster />
      </Router>
    </LanguageProvider>
  );
};

export default App;
