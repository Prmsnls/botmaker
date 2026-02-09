/**
 * HTTP reverse proxy for forwarding requests to bot containers.
 *
 * Modeled after proxy/src/services/upstream.ts but uses http (not https)
 * since bot containers are local.  Streams responses chunk-by-chunk with
 * flush() support for SSE / LLM token streaming.
 */

import http from 'node:http';
import net from 'node:net';
import type { IncomingMessage, ServerResponse } from 'node:http';
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
  gatewayToken?: string,
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

    // Inject gateway token into the URL so users don't need it in the browser
    let upstreamPath = request.raw.url ?? '/';
    if (gatewayToken) {
      const sep = upstreamPath.includes('?') ? '&' : '?';
      upstreamPath = `${upstreamPath}${sep}token=${encodeURIComponent(gatewayToken)}`;
    }

    const options: http.RequestOptions = {
      hostname: proxyHost,
      port: botPort,
      path: upstreamPath,
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

/**
 * Proxy a WebSocket upgrade request to a bot container.
 * Forwards the HTTP upgrade handshake, then pipes the two raw
 * TCP sockets together bidirectionally.
 */
export function proxyWebSocketToBot(
  req: IncomingMessage,
  socket: net.Socket,
  head: Buffer,
  botPort: number,
  proxyHost: string,
  gatewayToken?: string,
): void {
  let upstreamPath = req.url ?? '/';
  if (gatewayToken) {
    const sep = upstreamPath.includes('?') ? '&' : '?';
    upstreamPath = `${upstreamPath}${sep}token=${encodeURIComponent(gatewayToken)}`;
  }

  const upstreamHeaders: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      upstreamHeaders[key] = value;
    }
  }
  upstreamHeaders['host'] = `${proxyHost}:${botPort}`;

  const proxyReq = http.request({
    hostname: proxyHost,
    port: botPort,
    path: upstreamPath,
    method: 'GET',
    headers: upstreamHeaders,
    timeout: REQUEST_TIMEOUT_MS,
  });

  proxyReq.on('upgrade', (_proxyRes, proxySocket, proxyHead) => {
    // Forward the 101 response back to the client
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${_proxyRes.headers['sec-websocket-accept']}\r\n` +
        '\r\n',
    );
    if (proxyHead.length > 0) socket.write(proxyHead);
    if (head.length > 0) proxySocket.write(head);

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);

    proxySocket.on('error', () => socket.destroy());
    socket.on('error', () => proxySocket.destroy());
  });

  proxyReq.on('error', () => socket.destroy());
  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    socket.destroy();
  });

  proxyReq.end();
}
