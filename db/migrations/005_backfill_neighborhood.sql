-- Preenche `neighborhood` das linhas coletadas antes da migration 004.
--
-- O regex espelha `neighborhoodFrom` em scraper/parse.ts: bairro e o trecho
-- entre um hifen e a virgula que antecede o par "Cidade - UF".
--
--   "Av. Chibaras, 364 - Moema, Sao Paulo - SP, 04076-001"  -> Moema
--   "R. Joaquim Gama - Paraty, RJ, 23970-000"               -> nenhum
--
-- O segundo caso e endereco sem numero: o que parece bairro ali e a cidade, e
-- por isso a exigencia do par "Cidade - UF" logo depois da virgula.
UPDATE establishments AS e
   SET neighborhood = trim(extraido.bairro)
  FROM (
    SELECT id,
           (regexp_match(address, '-\s*([^,]+),\s*[^,]+\s+-\s+[A-Z]{2}'))[1] AS bairro
      FROM establishments
     WHERE address IS NOT NULL
  ) AS extraido
 WHERE e.id = extraido.id
   AND e.neighborhood IS NULL
   AND extraido.bairro IS NOT NULL
   -- Numero ou CEP que caiu na posicao do bairro nao e bairro.
   AND trim(extraido.bairro) !~ '^[0-9 -]+$';

UPDATE establishments
   SET neighborhood_normalized = lower(
         translate(
           neighborhood,
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇáàâãäéèêëíìîïóòôõöúùûüñç',
           'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc'
         )
       )
 WHERE neighborhood IS NOT NULL
   AND neighborhood_normalized IS NULL;
