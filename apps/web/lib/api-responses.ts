import { type ApiErrorCode, createApiErrorBody } from "@price-monitor/shared/api-errors";
import { NextResponse } from "next/server";

export function apiErrorResponse(
  errorCode: ApiErrorCode,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(createApiErrorBody(errorCode, extra), { status });
}
