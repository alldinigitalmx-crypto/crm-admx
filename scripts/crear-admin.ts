import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const rl = readline.createInterface({ input, output });

  const nombre = await rl.question("Nombre: ");
  const email = await rl.question("Correo (con este inicias sesión): ");
  const password = await rl.question("Contraseña: ");
  rl.close();

  const passwordHash = await bcrypt.hash(password, 10);

  const usuario = await prisma.usuario.create({
    data: { nombre, email, passwordHash, rol: "Admin" },
  });

  console.log(`\n✅ Admin creado: ${usuario.email} (id ${usuario.id})`);
}

main()
  .catch((e) => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });