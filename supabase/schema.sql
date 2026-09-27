-- Schema for INE Product Price Tracker

-- 1. Catalog Products (paged snapshot for cold-start search)
CREATE TABLE IF NOT EXISTS catalog_products (
  id INTEGER PRIMARY KEY,
  slug TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  sku TEXT,
  description TEXT,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_products_name_lower ON catalog_products (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_catalog_products_brand_lower ON catalog_products (LOWER(brand));
CREATE INDEX IF NOT EXISTS idx_catalog_products_category ON catalog_products (category);

-- 2. Tracked Products
CREATE TABLE IF NOT EXISTS tracked_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_product_id INTEGER NOT NULL,
  slug TEXT,
  product_name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  option_id TEXT NOT NULL,
  option_axis TEXT NOT NULL,
  option_label TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_store_product_option UNIQUE (store_product_id, option_id)
);

CREATE INDEX IF NOT EXISTS idx_tracked_products_active ON tracked_products (active);

-- 3. Scrape Runs
CREATE TABLE IF NOT EXISTS scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'manual', 'on_track')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  total_products INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  retried_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_status_started ON scrape_runs (status, started_at DESC);

-- 4. Scrape Attempts
CREATE TABLE IF NOT EXISTS scrape_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES scrape_runs(id) ON DELETE SET NULL,
  tracked_product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'retried', 'failed')),
  tries_count INTEGER NOT NULL DEFAULT 1,
  price NUMERIC,
  currency TEXT,
  stock_status TEXT,
  stock_qty INTEGER,
  error_code TEXT,
  error_detail TEXT,
  duration_ms INTEGER NOT NULL,
  manifest_revision INTEGER,
  CONSTRAINT honesty_check CHECK (
    (outcome = 'failed' AND price IS NULL AND stock_status IS NULL) OR
    (outcome IN ('success', 'retried') AND price IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_scrape_attempts_tracked_product ON scrape_attempts (tracked_product_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_attempts_run_id ON scrape_attempts (run_id);
CREATE INDEX IF NOT EXISTS idx_scrape_attempts_finished_at ON scrape_attempts (finished_at DESC);

-- Seed Tracked Products (3 active items for unattended runs)
INSERT INTO tracked_products (store_product_id, slug, product_name, brand, category, option_id, option_axis, option_label, active)
VALUES
  (2692, 'veloria-smart-panel-duo', 'Veloria Smart Panel Duo', 'Veloria', 'Lighting', 'o2', 'Tone', 'Neutral white', true),
  (2818, 'veloria-handheld-console-zen', 'Veloria Handheld Console Zen', 'Veloria', 'Gaming', 'o1', 'Edition', 'Standard', true),
  (2287, 'orbisk-bookshelf-core', 'Orbisk Bookshelf Core', 'Orbisk', 'Office', 'o1', 'Finish', 'Oak', true)
ON CONFLICT (store_product_id, option_id) DO NOTHING;
