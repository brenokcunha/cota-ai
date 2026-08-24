-- Autocomplete de região (RF-01).
--
-- As sugestões saem da própria base: toda busca grava os estabelecimentos, e
-- cidade+UF deles são exatamente os nomes de região que funcionam na busca
-- seguinte. Não custa API nem lista externa, e melhora conforme o uso — a
-- mesma dinâmica da base própria do PRD §6.3.
--
-- A coluna normalizada existe porque `ILIKE` não ignora acento: sem ela,
-- digitar "sao" não acharia "São Paulo". Preenchida pela aplicação no upsert,
-- que já sabe normalizar (`normalizeSearchKey`).

ALTER TABLE establishments ADD COLUMN IF NOT EXISTS city_normalized TEXT;

CREATE INDEX IF NOT EXISTS establishments_city_normalized_idx
  ON establishments (city_normalized text_pattern_ops);
