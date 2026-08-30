-- ============================================================
-- Esquema de base de datos — Calculadora de Volumen de Impresión
-- TRI OFFICE — Fase 5 (Neon / Postgres)
--
-- DISEÑO DE "UN SOLO REGISTRO":
-- Esta tabla nunca acumula historial. Siempre hay como máximo UNA
-- fila (id = 'current'), que se sobrescribe cada vez que guardas
-- desde la app. Así la nube solo refleja el levantamiento en el que
-- estás trabajando ahora mismo — nunca hay que limpiarla a mano.
--
-- Cómo usar este archivo:
-- 1. Entra a tu proyecto en https://console.neon.tech
-- 2. Abre el "SQL Editor" (editor SQL) del panel izquierdo
-- 3. Pega todo este archivo y ejecútalo (Run)
--
-- Es seguro volver a correr este archivo más de una vez (por ejemplo,
-- si ya habías corrido una versión anterior): usa IF NOT EXISTS en
-- todo, así que nunca borra datos ni duplica columnas.
-- ============================================================

CREATE TABLE IF NOT EXISTS levantamientos (
  id             TEXT PRIMARY KEY,           -- siempre vale 'current' (una sola fila)
  codigo         TEXT DEFAULT '',            -- número de referencia que tú le pones (ej. LEV-20260829-123)
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

-- Por si la tabla ya existía de una versión anterior sin esta columna:
ALTER TABLE levantamientos ADD COLUMN IF NOT EXISTS codigo TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_levantamientos_updated_at ON levantamientos (updated_at DESC);
