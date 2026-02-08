/**
 * HTTP reverse proxy for forwarding requests to bot containers.
 *
 * Modeled after proxy/src/services/upstream.ts but uses http (not https)
 * since bot containers are local.  Streams responses chunk-by-chunk with
 * flush() support for SSE / LLM token streaming.
 */

import http from 'node:http';
import type { ServerResponse } from 'node:http';
import type { FastifyRequest, FastifyReply } from 'fastify';

interface FlushableResponse extends ServerResponse {
  flush?: () => void;
}

const REQUEST_TIMEOUT_MS = 120_000;

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
]);

export async function proxyToBot(
  request: FastifyRequest,
  reply: FastifyReply,
  botPort: number,
  proxyHost: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Build upstream headers — filter hop-by-hop, add forwarding info
    const upstreamHeaders: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(request.raw.headers)) {
      if (value !== undefined && !HOP_BY_HOP.has(key.toLowerCase())) {
        upstreamHeaders[key] = value;
      }
    }
    upstreamHeaders['host'] = `${proxyHost}:${botPort}`;
    upstreamHeaders['x-forwarded-for'] = request.ip;
    upstreamHeaders['x-forwarded-host'] = request.headers.host ?? '';
    upstreamHeaders['x-forwarded-proto'] = 'https';

    const options: http.RequestOptions = {
      hostname: proxyHost,
      port: botPort,
      path: request.raw.url,
      method: request.raw.method,
      headers: upstreamHeaders,
      timeout: REQUEST_TIMEOUT_MS,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      const statusCode = proxyRes.statusCode ?? 502;

      // Forward response headers (filter hop-by-hop)
      const responseHeaders: Record<string, string | string[]> = {};
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        const lk = key.toLowerCase();
        if (value && !HOP_BY_HOP.has(lk) && lk !== 'content-length') {
          responseHeaders[key] = value;
        }
      }

      // SSE: ensure streaming-friendly headers
      const contentType = proxyRes.headers['content-type'];
      if (contentType?.includes('text/event-stream')) {
        responseHeaders['cache-control'] = 'no-cache';
        responseHeaders['connection'] = 'keep-alive';
      }

      reply.raw.writeHead(statusCode, responseHeaders);

      proxyRes.on('data', (chunk: Buffer) => {
        reply.raw.write(chunk);
        const raw = reply.raw as FlushableResponse;
        if (typeof raw.flush === 'function') {
          raw.flush();
        }
      });

      proxyRes.on('end', () => {
        reply.raw.end();
        resolve();
      });

      proxyRes.on('error', (err) => {
        reply.raw.end();
        reject(err);
      });
    });

    proxyReq.on('error', (err) => {
      reject(err);
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      reject(new Error(`Bot proxy request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });

    // Pipe the raw incoming body straight to the upstream request (zero-copy).
    // Works because we intercept in onRequest before Fastify parses the body.
    request.raw.pipe(proxyReq);
  });
}
