import { NextResponse } from "next/server";

// Uniform JSON envelope for all route handlers.
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export function apiOk<T>(
  data: T,
  init?: { status?: number; meta?: Record<string, unknown> },
): NextResponse {
  const body: ApiResponse<T> = { success: true, data, meta: init?.meta };
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

export function apiError(error: string, status = 400): NextResponse {
  const body: ApiResponse<never> = { success: false, error };
  return NextResponse.json(body, { status });
}
