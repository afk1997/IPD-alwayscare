import { TopHeader } from "@/components/layout/top-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { FAB } from "@/components/layout/fab";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopHeader />
      <main className="pb-20 md:pb-4">{children}</main>
      <FAB />
      <BottomNav />
    </>
  );
}
