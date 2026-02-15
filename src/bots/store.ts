/**
 * Bot Store
 *
 * CRUD operations for bots using SQLite database.
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/index.js';
import type { Bot, BotStatus } from '../types/bot.js';


export interface CreateBotInput {
  name: string;
  hostname: string;
  ai_provider: string;
  model: string;
  channel_type: string;
  port: number;
  gateway_token: string;
  tags?: string[];
  is_akash_deployment?: boolean;
  akash_dseq?: string;
  akash_provider?: string;
  akash_lease_status?: string;
  akash_manifest?: string;
}

export interface UpdateBotInput {
  name?: string;
  hostname?: string;
  ai_provider?: string;
  model?: string;
  channel_type?: string;
  container_id?: string | null;
  port?: number | null;
  gateway_token?: string | null;
  tags?: string[] | null;
  status?: BotStatus;
  is_akash_deployment?: boolean;
  akash_dseq?: string | null;
  akash_provider?: string | null;
  akash_lease_status?: string | null;
  akash_manifest?: string | null;
  akash_uri?: string | null;
}

/**
 * Create a new bot.
 *
 * @param input - Bot creation data
 * @returns The created bot
 */
export function createBot(input: CreateBotInput): Bot {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuidv4();
  const tagsJson = input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null;

  const stmt = db.prepare(`
    INSERT INTO bots (
      id, name, hostname, ai_provider, model, channel_type, port, gateway_token, tags, status,
      is_akash_deployment, akash_dseq, akash_provider, akash_lease_status, akash_manifest, akash_uri,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id, input.name, input.hostname, input.ai_provider, input.model, input.channel_type,
    input.port, input.gateway_token, tagsJson, 'created',
    input.is_akash_deployment ? 1 : 0,
    input.akash_dseq || null,
    input.akash_provider || null,
    input.akash_lease_status || null,
    input.akash_manifest || null,
    null, // akash_uri initially null
    now, now
  );

  return {
    id,
    name: input.name,
    hostname: input.hostname,
    ai_provider: input.ai_provider,
    model: input.model,
    channel_type: input.channel_type,
    container_id: null,
    port: input.port,
    gateway_token: input.gateway_token,
    tags: tagsJson,
    status: 'created',
    is_akash_deployment: !!input.is_akash_deployment,
    akash_dseq: input.akash_dseq || null,
    akash_provider: input.akash_provider || null,
    akash_lease_status: input.akash_lease_status || null,
    akash_manifest: input.akash_manifest || null,
    akash_uri: null,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Get a bot by ID.
 *
 * @param id - Bot UUID
 * @returns The bot or null if not found
 */
export function getBot(id: string): Bot | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM bots WHERE id = ?');
  const row = stmt.get(id) as any; // Type assertion needed due to better-sqlite3 types

  if (!row) return null;

  return {
    ...row,
    is_akash_deployment: Boolean(row.is_akash_deployment), // Convert integer to boolean
  };
}

/**
 * Get a bot by name.
 *
 * @param name - Bot name
 * @returns The bot or null if not found
 */
export function getBotByName(name: string): Bot | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM bots WHERE name = ?');
  const row = stmt.get(name) as any;

  if (!row) return null;

  return {
    ...row,
    is_akash_deployment: Boolean(row.is_akash_deployment),
  };
}

/**
 * Get a bot by hostname.
 *
 * @param hostname - Bot hostname (DNS-compatible identifier)
 * @returns The bot or null if not found
 */
export function getBotByHostname(hostname: string): Bot | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM bots WHERE hostname = ?');
  const row = stmt.get(hostname) as any;

  if (!row) return null;

  return {
    ...row,
    is_akash_deployment: Boolean(row.is_akash_deployment),
  };
}

/**
 * List all bots.
 *
 * @returns Array of all bots
 */
export function listBots(): Bot[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM bots ORDER BY created_at DESC');
  const rows = stmt.all() as any[];

  return rows.map(row => ({
    ...row,
    is_akash_deployment: Boolean(row.is_akash_deployment),
  }));
}

/**
 * Update a bot.
 *
 * @param id - Bot UUID
 * @param input - Fields to update
 * @returns The updated bot or null if not found
 */
export function updateBot(id: string, input: UpdateBotInput): Bot | null {
  const db = getDb();
  const now = new Date().toISOString();

  // Build dynamic UPDATE query
  const updates: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [now];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.hostname !== undefined) {
    updates.push('hostname = ?');
    values.push(input.hostname);
  }
  if (input.ai_provider !== undefined) {
    updates.push('ai_provider = ?');
    values.push(input.ai_provider);
  }
  if (input.model !== undefined) {
    updates.push('model = ?');
    values.push(input.model);
  }
  if (input.channel_type !== undefined) {
    updates.push('channel_type = ?');
    values.push(input.channel_type);
  }
  if (input.container_id !== undefined) {
    updates.push('container_id = ?');
    values.push(input.container_id);
  }
  if (input.port !== undefined) {
    updates.push('port = ?');
    values.push(input.port);
  }
  if (input.gateway_token !== undefined) {
    updates.push('gateway_token = ?');
    values.push(input.gateway_token);
  }
  if (input.tags !== undefined) {
    updates.push('tags = ?');
    values.push(input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    values.push(input.status);
  }

  // Akash fields
  if (input.is_akash_deployment !== undefined) {
    updates.push('is_akash_deployment = ?');
    values.push(input.is_akash_deployment ? 1 : 0);
  }
  if (input.akash_dseq !== undefined) {
    updates.push('akash_dseq = ?');
    values.push(input.akash_dseq);
  }
  if (input.akash_provider !== undefined) {
    updates.push('akash_provider = ?');
    values.push(input.akash_provider);
  }
  if (input.akash_lease_status !== undefined) {
    updates.push('akash_lease_status = ?');
    values.push(input.akash_lease_status);
  }
  if (input.akash_manifest !== undefined) {
    updates.push('akash_manifest = ?');
    values.push(input.akash_manifest);
  }
  if (input.akash_uri !== undefined) {
    updates.push('akash_uri = ?');
    values.push(input.akash_uri);
  }

  values.push(id);

  const stmt = db.prepare(`UPDATE bots SET ${updates.join(', ')} WHERE id = ?`);
  const result = stmt.run(...values);

  if (result.changes === 0) {
    return null;
  }

  return getBot(id);
}

/**
 * Delete a bot.
 *
 * @param id - Bot UUID
 * @returns true if deleted, false if not found
 */
export function deleteBot(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM bots WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Get the next available port for a bot container.
 * Finds the lowest available port by detecting gaps in used ports.
 *
 * @param startPort - Starting port number
 * @returns Next available port
 */
export function getNextBotPort(startPort: number): number {
  const db = getDb();

  // Get all used ports in ascending order
  const stmt = db.prepare('SELECT port FROM bots WHERE port IS NOT NULL ORDER BY port');
  const rows = stmt.all() as { port: number }[];

  // Find first gap starting from startPort
  let port = startPort;
  for (const row of rows) {
    if (row.port > port) break; // Found gap
    if (row.port === port) port = row.port + 1;
  }

  return port;
}
