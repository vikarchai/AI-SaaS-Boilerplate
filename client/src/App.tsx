import { Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout.js";
import { AdminPage } from "./pages/AdminPage.js";
import { BillingPage } from "./pages/BillingPage.js";
import { ChatPage } from "./pages/ChatPage.js";
import { HomePage } from "./pages/HomePage.js";
import { SignInPage } from "./pages/SignInPage.js";

export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
