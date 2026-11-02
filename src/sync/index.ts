// Picks the backend: Supabase when env vars are set, otherwise Demo Mode.
import type { Backend } from './backend';
import { localBackend } from './localBackend';
import { createSupabaseBackend } from './supabaseBackend';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const backend: Backend = url && anon ? createSupabaseBackend(url, anon) : localBackend;
export const isDemoMode = backend.kind === 'local';
export type { Backend, ConnectionStatus } from './backend';
