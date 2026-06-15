export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  AUTH_SECRET: string;
}

export interface LinkRow {
  code: string;
  target_url: string;
  title: string | null;
  created_at: number;
  click_count: number;
  expires_at: number | null;
  disabled: number;
  user_id: number | null;
}
