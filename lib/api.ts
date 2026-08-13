import { NextResponse } from "next/server";
import { ZodError } from "zod";
export const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 });
export const unauthorized = () => NextResponse.json({ error: "Sign in required" }, { status: 401 });
export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: error.flatten() }, { status: 400 });
  console.error(error); return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
