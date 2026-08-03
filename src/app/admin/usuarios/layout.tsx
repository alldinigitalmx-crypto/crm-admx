import { redirect } from "next/navigation";

import { currentUsuario } from "@/lib/current-usuario";

export default async function UsuariosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await currentUsuario();

  if (usuario?.rol !== "Admin") {
    redirect("/admin");
  }

  return <>{children}</>;
}
