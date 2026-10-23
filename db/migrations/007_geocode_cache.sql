-- Cache de geocodificacao: nome de regiao -> coordenada.
--
-- Serve para o mapa ja mostrar a regiao que a pessoa digitou, antes de buscar.
--
-- E cache permanente de proposito. A coordenada de Caraiva nao muda, e o
-- provedor publico do Nominatim limita a 1 requisicao por segundo: sem cache,
-- cada tecla digitada viraria uma chamada e o servico nos bloquearia — com
-- razao. Assim e uma chamada por regiao distinta, para sempre.
--
-- `found = false` tambem e gravado: repetir uma busca que nao achou nada custa
-- o mesmo que uma que achou.
CREATE TABLE IF NOT EXISTS geocode_cache (
  query_normalized TEXT PRIMARY KEY,
  found            BOOLEAN NOT NULL,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  label            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
