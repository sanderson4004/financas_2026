-- =========================================================================
-- 11_cores_categoria_metodo.sql — Cor customizável por categoria e método
--
-- Cada categoria e cada método de pagamento pode ter uma cor (hex) própria,
-- cadastrável em Cadastros. O frontend usa essa cor pra contornar o "pill"
-- de categoria/método em todas as telas (Fluxo, Crédito, Painel, Custos
-- Variáveis), com o texto sempre branco.
-- =========================================================================

alter table categorias add column cor text;
alter table metodos_pagamento add column cor text;

comment on column categorias.cor is 'Cor hexadecimal (#RRGGBB) escolhida pelo usuário para essa categoria, usada para contornar o "pill" da categoria nas telas. Nula = usa a cor neutra padrão.';
comment on column metodos_pagamento.cor is 'Cor hexadecimal (#RRGGBB) escolhida pelo usuário para esse método de pagamento, usada para contornar o "pill" do método nas telas. Nula = usa a cor neutra padrão.';
