import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AdminTopbar
          userEmail={session.user.email}
          userName={session.user.name}
          onSignOut={signOutAction}
        />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
