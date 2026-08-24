-- Corrige bairros extraidos com hifen a mais pela migration 005.
--
-- Enderecos com numero de loja tem tres segmentos separados por hifen:
--
--   "Av. Navegantes, 955 - Lj 01 - Bento Ferreira, Vitoria - ES"
--
-- A 005 capturava "Lj 01 - Bento Ferreira". O bairro e sempre o ULTIMO
-- segmento, entao o grupo agora recusa hifen — o que faz o casamento comecar
-- no ultimo hifen antes da virgula.
--
-- Reprocessa todas as linhas, nao so as erradas: e idempotente, e assim o
-- resultado no banco passa a ser o mesmo que `neighborhoodFrom` produziria.
UPDATE establishments AS e
   SET neighborhood = trim(extraido.bairro),
       neighborhood_normalized = NULL
  FROM (
    SELECT id,
           (regexp_match(address, '-\s*([^,-]+),\s*[^,]+\s+-\s+[A-Z]{2}'))[1] AS bairro
      FROM establishments
     WHERE address IS NOT NULL
  ) AS extraido
 WHERE e.id = extraido.id
   AND extraido.bairro IS NOT NULL
   AND trim(extraido.bairro) !~ '^[0-9 -]+$'
   AND e.neighborhood IS DISTINCT FROM trim(extraido.bairro);

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
