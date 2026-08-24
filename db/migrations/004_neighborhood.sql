-- Bairro do estabelecimento, para o autocomplete (RF-01).
--
-- O IBGE nao publica lista de bairros: a API de localidades so tem municipios,
-- distritos e 646 subdistritos, sem Moema, Ipanema ou Pinheiros. Mas todo
-- endereco que o scraper ja coleta traz o bairro
-- ("Av. Chibaras, 364 - MOEMA, Sao Paulo - SP"), entao a lista se constroi
-- sozinha conforme as buscas acontecem — a mesma dinamica da base propria do
-- PRD 6.3.
ALTER TABLE establishments ADD COLUMN IF NOT EXISTS neighborhood TEXT;
ALTER TABLE establishments ADD COLUMN IF NOT EXISTS neighborhood_normalized TEXT;

CREATE INDEX IF NOT EXISTS establishments_neighborhood_normalized_idx
  ON establishments (neighborhood_normalized text_pattern_ops);
