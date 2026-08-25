"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requiereAdmin } from "@/lib/alcance";
import type { TipoCuenta } from "@/generated/prisma/client";

export type CuentaFormState = { error?: string } | undefined;
export type RetiroFormState = { error?: string } | undefined;

async function currentUserId() {
  const session = await auth();
  const id = session?.user?.id;
  return id ? Number(id) : null;
}

function parseCuentaForm(formData: FormData) {
  const alias = String(formData.get("alias") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "Banco") as TipoCuenta;
  const banco = String(formData.get("banco") ?? "").trim() || null;
  const numeroCuenta = String(formData.get("numeroCuenta") ?? "").trim() || null;
  const clabe = String(formData.get("clabe") ?? "").trim() || null;
  const swift = String(formData.get("swift") ?? "").trim() || null;
  const saldoInicialRaw = String(formData.get("saldoInicial") ?? "0");
  const activa = formData.get("activa") === "on";
  const notas = String(formData.get("notas") ?? "").trim() || null;

  return { alias, tipo, banco, numeroCuenta, clabe, swift, saldoInicialRaw, activa, notas };
}

function validateCuentaForm(data: ReturnType<typeof parseCuentaForm>) {
  if (!data.alias) return "El alias es obligatorio.";
  if (data.saldoInicialRaw && Number.isNaN(Number(data.saldoInicialRaw))) {
    return "El saldo inicial debe ser un número.";
  }
  return null;
}

export async function crearCuenta(
  _prevState: CuentaFormState,
  formData: FormData
): Promise<CuentaFormState> {
  if (!(await requiereAdmin())) {
    return { error: "No tienes permiso para crear cuentas." };
  }

  const data = parseCuentaForm(formData);
  const error = validateCuentaForm(data);
  if (error) return { error };

  await prisma.cuenta.create({
    data: {
      alias: data.alias,
      tipo: data.tipo,
      banco: data.banco,
      numeroCuenta: data.numeroCuenta,
      clabe: data.clabe,
      swift: data.swift,
      saldoInicial: data.saldoInicialRaw || 0,
      activa: data.activa,
      notas: data.notas,
    },
  });

  revalidatePath("/admin/cuentas");
  return undefined;
}

export async function actualizarCuenta(
  id: number,
  _prevState: CuentaFormState,
  formData: FormData
): Promise<CuentaFormState> {
  if (!(await requiereAdmin())) {
    return { error: "No tienes permiso para editar cuentas." };
  }

  const data = parseCuentaForm(formData);
  const error = validateCuentaForm(data);
  if (error) return { error };

  await prisma.cuenta.update({
    where: { id },
    data: {
      alias: data.alias,
      tipo: data.tipo,
      banco: data.banco,
      numeroCuenta: data.numeroCuenta,
      clabe: data.clabe,
      swift: data.swift,
      saldoInicial: data.saldoInicialRaw || 0,
      activa: data.activa,
      notas: data.notas,
    },
  });

  revalidatePath("/admin/cuentas");
  revalidatePath("/admin/pagos");
  revalidatePath("/admin/gastos");
  return undefined;
}

export async function crearRetiro(
  cuentaId: number,
  _prevState: RetiroFormState,
  formData: FormData
): Promise<RetiroFormState> {
  if (!(await requiereAdmin())) {
    return { error: "No tienes permiso para registrar retiros." };
  }

  const fechaRaw = String(formData.get("fecha") ?? "");
  const montoRaw = String(formData.get("monto") ?? "");
  const comentario = String(formData.get("comentario") ?? "").trim() || null;

  if (!montoRaw || Number.isNaN(Number(montoRaw)) || Number(montoRaw) <= 0) {
    return { error: "El monto debe ser un número mayor a cero." };
  }

  const userId = await currentUserId();

  await prisma.retiro.create({
    data: {
      cuentaId,
      fecha: fechaRaw ? new Date(fechaRaw) : new Date(),
      monto: montoRaw,
      comentario,
      creadoPorId: userId,
    },
  });

  revalidatePath("/admin/cuentas");
  return undefined;
}

export async function eliminarRetiro(id: number) {
  if (!(await requiereAdmin())) return;

  await prisma.retiro.delete({ where: { id } });
  revalidatePath("/admin/cuentas");
}
