import { prisma } from "@/lib/prisma";
import { auth, signOut } from "@/auth";

export default async function ClientesPage() {
  const session = await auth();
  const clientes = await prisma.cliente.findMany({
    orderBy: { creadoEn: "desc" },
  });

  return (
    <main className="min-h-screen p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        {session?.user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="border rounded px-3 py-1">Cerrar sesión</button>
            </form>
          </div>
        )}
      </div>

      {clientes.length === 0 ? (
        <p className="text-gray-500">
          Aún no hay clientes. Agrega uno desde Prisma Studio y recarga esta página.
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Nombre</th>
              <th className="py-2 pr-4">Etiqueta</th>
              <th className="py-2 pr-4">País</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Captación</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="py-2 pr-4">{c.nombre}</td>
                <td className="py-2 pr-4">{c.etiqueta ?? "—"}</td>
                <td className="py-2 pr-4">{c.pais ?? "—"}</td>
                <td className="py-2 pr-4">{c.email ?? "—"}</td>
                <td className="py-2 pr-4">{c.medioCaptacion ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}