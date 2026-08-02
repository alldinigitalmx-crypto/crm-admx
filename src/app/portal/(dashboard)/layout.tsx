import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { PortalTopbar } from "@/components/portal-topbar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "cliente") {
    redirect("/portal/login");
  }

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/portal/login" });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PortalTopbar userName={session.user.name} onSignOut={signOutAction} />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-6">
        {children}
      </div>
    </div>
  );
}
