-- Preenche `city_normalized` das linhas que ja existiam quando a coluna foi
-- criada. Sem isso, o autocomplete so enxergaria estabelecimentos coletados
-- depois da migration 002 — a base ficaria invisivel para si mesma.
--
-- `translate` em vez da extensao `unaccent` para nao exigir superusuario no
-- banco: o conjunto de acentos do portugues cabe numa linha, e a normalizacao
-- precisa casar com `normalizeSearchKey` da aplicacao.
UPDATE establishments
   SET city_normalized = lower(
         translate(
           city,
           'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÇáàâãäéèêëíìîïóòôõöúùûüñç',
           'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc'
         )
       )
 WHERE city IS NOT NULL
   AND city_normalized IS NULL;
