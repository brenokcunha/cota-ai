-- Schema inicial do cota-ai (PRD §6.5).
--
-- Duas diferenças em relação ao PRD, ambas deliberadas:
--
-- 1. `establishments.whatsapp` é texto de três estados, não o booleano
--    `has_whatsapp` do documento. O próprio PRD (§8, risco 3) manda "marcar
--    como incerto em vez de prometer", e um booleano não sabe dizer "não sei".
--
-- 2. `search_cache` guarda `place_id` e não o id interno. O place_id sobrevive
--    a uma recoleta; o id interno mudaria se a linha fosse recriada.

CREATE TABLE IF NOT EXISTS establishments (
  id            BIGSERIAL PRIMARY KEY,
  place_id      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  category      TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  phone_e164    TEXT,
  whatsapp      TEXT NOT NULL DEFAULT 'unknown'
                CHECK (whatsapp IN ('likely', 'unlikely', 'unknown')),
  rating        REAL,
  reviews_count INTEGER,
  source        TEXT NOT NULL,
  scraped_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Buscas por região são o caminho quente da fase 2 (SEO programático).
CREATE INDEX IF NOT EXISTS establishments_city_category_idx
  ON establishments (city, category);

-- Uma linha por par categoria+região normalizado; a recoleta sobrescreve.
CREATE TABLE IF NOT EXISTS search_cache (
  id                  BIGSERIAL PRIMARY KEY,
  category_normalized TEXT NOT NULL,
  region_normalized   TEXT NOT NULL,
  result_place_ids    TEXT[] NOT NULL,
  partial             BOOLEAN NOT NULL DEFAULT FALSE,
  -- Quantos resultados foram PEDIDOS nessa coleta. Sem isso nao da para saber
  -- se 5 linhas em cache sao "a regiao so tem 5" ou "so pediram 5" — e uma
  -- busca por 20 serviria 5 achando que esta completa.
  requested_limit     INTEGER NOT NULL DEFAULT 0,
  scraped_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  UNIQUE (category_normalized, region_normalized)
);

CREATE INDEX IF NOT EXISTS search_cache_expires_at_idx ON search_cache (expires_at);

-- Cotação anônima: sem login, a chave de volta é o share_token (PRD §5.1, RF-08).
CREATE TABLE IF NOT EXISTS quotes (
  id               BIGSERIAL PRIMARY KEY,
  share_token      TEXT NOT NULL UNIQUE,
  category         TEXT NOT NULL,
  region           TEXT NOT NULL,
  message_template TEXT NOT NULL DEFAULT '',
  variables_json   JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- `position` preserva a ordem que o usuário viu na tela: o disparo sequencial
-- (RF-06) percorre a lista nessa ordem, e retomar em outro aparelho tem que
-- continuar de onde parou, não de uma ordem qualquer do banco.
CREATE TABLE IF NOT EXISTS quote_targets (
  id               BIGSERIAL PRIMARY KEY,
  quote_id         BIGINT NOT NULL REFERENCES quotes (id) ON DELETE CASCADE,
  establishment_id BIGINT NOT NULL REFERENCES establishments (id),
  position         INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sent', 'skipped')),
  sent_at          TIMESTAMPTZ,
  UNIQUE (quote_id, establishment_id)
);

CREATE INDEX IF NOT EXISTS quote_targets_quote_id_idx ON quote_targets (quote_id, position);
