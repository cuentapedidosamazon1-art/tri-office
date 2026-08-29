-- ============================================================
-- Esquema de base de datos — Calculadora de Volumen de Impresión
-- TRI OFFICE — Fase 5 (Neon / Postgres)
--
-- Cómo usar este archivo:
-- 1. Entra a tu proyecto en https://console.neon.tech
-- 2. Abre el "SQL Editor" (editor SQL) del panel izquierdo
-- 3. Pega todo este archivo y ejecútalo (Run) UNA sola vez
-- ============================================================

CREATE TABLE IF NOT EXISTS levantamientos (
  id             TEXT PRIMARY KEY,           -- usa el código autogenerado (ej. LEV-20260829-123)
  cliente        TEXT NOT NULL,
  tecnico        TEXT DEFAULT '',
  fecha          DATE,
  observaciones  TEXT DEFAULT '',
  thresholds     JSONB DEFAULT '{"low":1000,"high":2000}'::jsonb,
  departamentos  JSONB NOT NULL DEFAULT '[]'::jsonb,
  equipos        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para listar rápido por fecha de última modificación
CREATE INDEX IF NOT EXISTS idx_levantamientos_updated_at ON levantamientos (updated_at DESC);

-- Índice para buscar por nombre de cliente
CREATE INDEX IF NOT EXISTS idx_levantamientos_cliente ON levantamientos (cliente);
