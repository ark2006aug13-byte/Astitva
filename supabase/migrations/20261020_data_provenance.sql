-- Migration: Add data provenance and ingestion method tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ingestion_method text DEFAULT 'unknown';
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS method text DEFAULT 'tinyfish_live';
ALTER TABLE ingestion_runs ADD COLUMN IF NOT EXISTS error text;
