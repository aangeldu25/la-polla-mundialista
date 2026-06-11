import { AuthGuard } from "@/components/auth/AuthGuard";
import { Navbar } from "@/components/layout/Navbar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Footer } from "@/components/layout/Footer";
import { WelcomeTutorial } from "@/components/tutorial/WelcomeTutorial";
import { ActivePollaProvider } from "@/components/polla/ActivePollaProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ActivePollaProvider>
        <Navbar />
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
        <MobileTabBar />
        <WelcomeTutorial />
      </ActivePollaProvider>
    </AuthGuard>
  );
}
