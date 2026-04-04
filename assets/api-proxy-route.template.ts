// src/app/api/[[...path]]/route.ts
//
// Runtime API proxy — reads INTERNAL_API_BASE_URL at request time, not build time.
// This replaces Next.js rewrites which bake env vars into the Docker image.
// Compatible with Next.js 16 route handlers and Turbopack.
//
// Usage in docker-compose.yml:
//   environment:
//     INTERNAL_API_BASE_URL: http://api:8080
//
// Keep next.config.ts as:
//   import type { NextConfig } from "next";
//   const config: NextConfig = { output: "standalone" };
//   export default config;

import { NextRequest, NextResponse } from "next/server";

const API_BASE = () =>
  process.env.INTERNAL_API_BASE_URL || "http://localhost:8080";

async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/^\/api/, "");
  const search = req.nextUrl.search;
  const target = `${API_BASE()}${path}${search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const init: RequestInit & { duplex?: string } = {
    method: req.method,
    headers,
  };

  // Forward body for non-GET/HEAD requests
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half"; // required for streaming request bodies
  }

  const upstream = await fetch(target, init);

  // Pass through the response (including SSE streams)
  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
