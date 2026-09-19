-- Hero: cor de fundo e flags de imagem (fundo / lateral)
ALTER TABLE flutz.hero_section
  ADD COLUMN IF NOT EXISTS cor_fundo VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS usar_imagem_fundo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mostrar_imagem_lateral BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN flutz.hero_section.cor_fundo IS
  'Cor de fundo da hero (ex.: #f6f0ff). Null = padrão do tema.';
COMMENT ON COLUMN flutz.hero_section.usar_imagem_fundo IS
  'Se true, aplica imagem_fundo_url como background-image da seção.';
COMMENT ON COLUMN flutz.hero_section.mostrar_imagem_lateral IS
  'Se true, exibe a imagem à direita dos textos da hero.';
