import { MarketingHeader } from "@/components/layout/marketing-header";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { AuthProvider } from "@/components/auth-provider";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <MarketingHeader />
      <main className="pt-24 min-h-screen">
        {children}
      </main>
      <PwaInstallBanner />
    </AuthProvider>
  );
}
