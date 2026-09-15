-- =============================================================================
-- Flutz — Modelo físico de referência (SaaS para clínicas veterinárias)
-- Compatível com MySQL Workbench / MySQL 8.0+
-- Charset: utf8mb4
-- Engine: InnoDB
--
-- Este script representa o NOVO modelo físico consolidado.
-- Não contém dados fictícios.
-- =============================================================================

SET @OLD_UNIQUE_CHECKS = @@UNIQUE_CHECKS, UNIQUE_CHECKS = 0;
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS = 0;
SET @OLD_SQL_MODE = @@SQL_MODE, SQL_MODE = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE SCHEMA IF NOT EXISTS `flutz`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `flutz`;

-- -----------------------------------------------------------------------------
-- 1. Catálogos globais (sem tenant)
-- -----------------------------------------------------------------------------

CREATE TABLE `status` (
  `status_id` INT NOT NULL AUTO_INCREMENT,
  `descricao` VARCHAR(80) NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`status_id`),
  UNIQUE INDEX `uk_status_descricao` (`descricao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo de status cadastral (ativo, inativo, pendente, bloqueado, inadimplente).';

CREATE TABLE `imagem_posicao` (
  `imagem_posicao_id` INT NOT NULL AUTO_INCREMENT,
  `posicao` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`imagem_posicao_id`),
  UNIQUE INDEX `uk_imagem_posicao_posicao` (`posicao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Posição da imagem de fundo da hero (centro, topo, etc.).';

CREATE TABLE `tipo_redesocial` (
  `tipo_redesocial_id` INT NOT NULL AUTO_INCREMENT,
  `descricao` VARCHAR(80) NOT NULL,
  `icone_url` VARCHAR(500) NULL,
  PRIMARY KEY (`tipo_redesocial_id`),
  UNIQUE INDEX `uk_tipo_redesocial_descricao` (`descricao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo global de redes sociais (Instagram, Facebook, TikTok, YouTube, etc.).';

CREATE TABLE `tipo_servico` (
  `tipo_servico_id` INT NOT NULL AUTO_INCREMENT,
  `tipo_servico` VARCHAR(80) NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`tipo_servico_id`),
  UNIQUE INDEX `uk_tipo_servico_nome` (`tipo_servico`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo global de tipos de serviço. A oferta da clínica fica em empresa_servico.';

CREATE TABLE `especialidade` (
  `especialidade_id` INT NOT NULL AUTO_INCREMENT,
  `descricao` VARCHAR(80) NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`especialidade_id`),
  UNIQUE INDEX `uk_especialidade_descricao` (`descricao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo global de especialidades veterinárias.';

CREATE TABLE `role` (
  `role_id` INT NOT NULL AUTO_INCREMENT,
  `descricao` VARCHAR(80) NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  UNIQUE INDEX `uk_role_descricao` (`descricao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Autorização do colaborador (administrador, veterinário, recepção, etc.). Cliente não usa role.';

CREATE TABLE `pet_especie` (
  `pet_especie_id` INT NOT NULL AUTO_INCREMENT,
  `descricao` VARCHAR(80) NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pet_especie_id`),
  UNIQUE INDEX `uk_pet_especie_descricao` (`descricao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo global de espécies.';

CREATE TABLE `pet_raca` (
  `pet_raca_id` INT NOT NULL AUTO_INCREMENT,
  `descricao` VARCHAR(80) NOT NULL,
  `pet_especie_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pet_raca_id`),
  INDEX `idx_pet_raca_especie` (`pet_especie_id`),
  UNIQUE INDEX `uk_pet_raca_especie_descricao` (`pet_especie_id`, `descricao`),
  CONSTRAINT `fk_pet_raca_especie`
    FOREIGN KEY (`pet_especie_id`)
    REFERENCES `pet_especie` (`pet_especie_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo global de raças, sempre vinculadas a uma espécie.';

CREATE TABLE `doenca` (
  `doenca_id` INT NOT NULL AUTO_INCREMENT,
  `nome_doenca` VARCHAR(150) NOT NULL,
  `nome_cientifico` VARCHAR(150) NULL,
  `descricao` TEXT NULL,
  `agente_causador` VARCHAR(150) NULL,
  `tipo` VARCHAR(80) NULL,
  `forma_transmissao` TEXT NULL,
  `periodo_incubacao` VARCHAR(80) NULL,
  `sintomas` TEXT NULL,
  `gravidade` VARCHAR(80) NULL,
  `tratamento` TEXT NULL,
  `prevencao` TEXT NULL,
  `contagiosa` TINYINT(1) NOT NULL DEFAULT 0,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`doenca_id`),
  UNIQUE INDEX `uk_doenca_nome` (`nome_doenca`),
  CONSTRAINT `chk_doenca_contagiosa`
    CHECK (`contagiosa` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo global de doenças.';

CREATE TABLE `vacina` (
  `vacina_id` INT NOT NULL AUTO_INCREMENT,
  `nome_vacina` VARCHAR(150) NOT NULL,
  `descricao` TEXT NULL,
  `fabricante` VARCHAR(150) NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`vacina_id`),
  UNIQUE INDEX `uk_vacina_nome` (`nome_vacina`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo global de vacinas.';

CREATE TABLE `vacina_doenca` (
  `vacina_doenca_id` INT NOT NULL AUTO_INCREMENT,
  `vacina_id` INT NOT NULL,
  `doenca_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`vacina_doenca_id`),
  UNIQUE INDEX `uk_vacina_doenca` (`vacina_id`, `doenca_id`),
  INDEX `idx_vacina_doenca_doenca` (`doenca_id`),
  CONSTRAINT `fk_vacina_doenca_vacina`
    FOREIGN KEY (`vacina_id`)
    REFERENCES `vacina` (`vacina_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_vacina_doenca_doenca`
    FOREIGN KEY (`doenca_id`)
    REFERENCES `doenca` (`doenca_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='N:N — doenças prevenidas por cada vacina.';

CREATE TABLE `atendimento_status` (
  `atendimento_status_id` INT NOT NULL AUTO_INCREMENT,
  `descricao` VARCHAR(80) NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`atendimento_status_id`),
  UNIQUE INDEX `uk_atendimento_status_descricao` (`descricao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Status operacional do atendimento clínico.';

CREATE TABLE `agendamento_status` (
  `agendamento_status_id` INT NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(30) NOT NULL COMMENT 'Ex.: SOLICITADO, CONFIRMADO, CANCELADO, FALTOU.',
  `descricao` VARCHAR(80) NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`agendamento_status_id`),
  UNIQUE INDEX `uk_agendamento_status_codigo` (`codigo`),
  UNIQUE INDEX `uk_agendamento_status_descricao` (`descricao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Status operacional do agendamento. CANCELADO e FALTOU não bloqueiam horário.';

CREATE TABLE `chat_motivo` (
  `chat_motivo_id` INT NOT NULL AUTO_INCREMENT,
  `descricao` VARCHAR(80) NOT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_motivo_id`),
  UNIQUE INDEX `uk_chat_motivo_descricao` (`descricao`),
  INDEX `idx_chat_motivo_status` (`status_id`),
  CONSTRAINT `fk_chat_motivo_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo de motivos de abertura de chat. Não referencia um chat específico.';

CREATE TABLE `plano` (
  `plano_id` INT NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(30) NOT NULL,
  `nome` VARCHAR(80) NOT NULL,
  `descricao` TEXT NULL,
  `valor_mensal` DECIMAL(10,2) NOT NULL,
  `moeda` CHAR(3) NOT NULL DEFAULT 'BRL',
  `limite_colaboradores` INT NULL COMMENT 'NULL = ilimitado',
  `limite_clientes` INT NULL COMMENT 'NULL = ilimitado',
  `permite_pagina_publica` TINYINT(1) NOT NULL DEFAULT 1,
  `permite_doacoes` TINYINT(1) NOT NULL DEFAULT 0,
  `permite_pagamentos` TINYINT(1) NOT NULL DEFAULT 0,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`plano_id`),
  UNIQUE INDEX `uk_plano_codigo` (`codigo`),
  CONSTRAINT `chk_plano_valor`
    CHECK (`valor_mensal` >= 0),
  CONSTRAINT `chk_plano_flags`
    CHECK (
      `permite_pagina_publica` IN (0, 1)
      AND `permite_doacoes` IN (0, 1)
      AND `permite_pagamentos` IN (0, 1)
      AND `ativo` IN (0, 1)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Catálogo de planos do SaaS (BASICO, PROFISSIONAL, PREMIUM).';

CREATE TABLE `administrador_sistema` (
  `administrador_sistema_id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(150) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `senha_hash` VARCHAR(255) NOT NULL COMMENT 'Hash da senha. Login: e-mail + senha.',
  `status_id` INT NOT NULL,
  `anonimizado_em` DATETIME NULL COMMENT 'Preenchido quando o titular é anonimizado (LGPD).',
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`administrador_sistema_id`),
  UNIQUE INDEX `uk_administrador_sistema_email` (`email`),
  INDEX `idx_administrador_sistema_status` (`status_id`),
  CONSTRAINT `fk_administrador_sistema_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Administrador de todo o SaaS. Sem empresa_id. Não usa role de colaborador.';

CREATE TABLE `token` (
  `token_id` INT NOT NULL AUTO_INCREMENT,
  `codigo_token` VARCHAR(80) NOT NULL,
  `percentual_desconto` DECIMAL(5,2) NOT NULL COMMENT 'Percentual 0–100. DECIMAL evita erro de FLOAT em cálculo de desconto.',
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data_expiracao` DATETIME NOT NULL,
  `status_id` INT NOT NULL,
  `administrador_sistema_id` INT NOT NULL COMMENT 'Quem criou o cupom.',
  `usos_maximos_por_empresa` INT NULL COMMENT 'NULL = ilimitado na clínica. 1 = uma fatura (ex.: primeira mensalidade).',
  PRIMARY KEY (`token_id`),
  UNIQUE INDEX `uk_token_codigo` (`codigo_token`),
  INDEX `idx_token_status` (`status_id`),
  INDEX `idx_token_expiracao` (`data_expiracao`),
  INDEX `idx_token_administrador` (`administrador_sistema_id`),
  CONSTRAINT `chk_token_percentual`
    CHECK (`percentual_desconto` >= 0 AND `percentual_desconto` <= 100),
  CONSTRAINT `chk_token_expiracao`
    CHECK (`data_expiracao` > `data_criacao`),
  CONSTRAINT `chk_token_usos_maximos`
    CHECK (`usos_maximos_por_empresa` IS NULL OR `usos_maximos_por_empresa` >= 1),
  CONSTRAINT `fk_token_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_token_administrador_sistema`
    FOREIGN KEY (`administrador_sistema_id`)
    REFERENCES `administrador_sistema` (`administrador_sistema_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cupom de desconto da plataforma (mensalidade). Só administrador_sistema cria.';

-- -----------------------------------------------------------------------------
-- 2. Tenant
-- -----------------------------------------------------------------------------

CREATE TABLE `empresa` (
  `empresa_id` INT NOT NULL AUTO_INCREMENT,
  `nome_empresa` VARCHAR(150) NOT NULL,
  `razao_social` VARCHAR(150) NULL,
  `cnpj` VARCHAR(18) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `telefone` VARCHAR(20) NULL,
  `logo_url` VARCHAR(500) NULL,
  `identificador_url` VARCHAR(80) NOT NULL,
  `descricao_empresa` TEXT NULL COMMENT 'Conteúdo da seção Sobre a clínica',
  `logradouro` VARCHAR(150) NULL,
  `numero` VARCHAR(20) NULL,
  `complemento` VARCHAR(80) NULL,
  `bairro` VARCHAR(80) NULL,
  `cidade` VARCHAR(80) NULL,
  `uf` CHAR(2) NULL,
  `cep` VARCHAR(9) NULL,
  `localizacao_googlemaps_url` TEXT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empresa_id`),
  UNIQUE INDEX `uk_empresa_cnpj` (`cnpj`),
  UNIQUE INDEX `uk_empresa_identificador_url` (`identificador_url`),
  INDEX `idx_empresa_status` (`status_id`),
  INDEX `idx_empresa_cidade_uf` (`uf`, `cidade`),
  CONSTRAINT `fk_empresa_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Clínica/tenant. Endereço e texto institucional ficam aqui (não duplicar na página).';

-- -----------------------------------------------------------------------------
-- 3. Página pública — configuração de seções e conteúdo próprio
-- -----------------------------------------------------------------------------

CREATE TABLE `pagina_secao` (
  `pagina_secao_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `tipo_secao` VARCHAR(30) NOT NULL,
  `ordem` INT NOT NULL,
  `visivel` TINYINT(1) NOT NULL DEFAULT 1,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pagina_secao_id`),
  UNIQUE INDEX `uk_pagina_secao_empresa_tipo` (`empresa_id`, `tipo_secao`),
  INDEX `idx_pagina_secao_empresa_ordem` (`empresa_id`, `ordem`),
  CONSTRAINT `chk_pagina_secao_tipo`
    CHECK (`tipo_secao` IN (
      'HERO',
      'SOBRE',
      'SERVICOS',
      'ESPECIALIDADE',
      'EQUIPE',
      'AVALIACOES',
      'GALERIA',
      'LOCALIZACAO',
      'CONTATO',
      'DOACOES'
    )),
  CONSTRAINT `chk_pagina_secao_ordem`
    CHECK (`ordem` >= 1),
  CONSTRAINT `chk_pagina_secao_visivel`
    CHECK (`visivel` IN (0, 1)),
  CONSTRAINT `fk_pagina_secao_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ordem e visibilidade das seções da página pública. Uma linha por tipo e empresa.';

CREATE TABLE `hero_section` (
  `hero_section_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `titulo` VARCHAR(150) NOT NULL,
  `subtitulo` VARCHAR(255) NULL,
  `texto_resumo` TEXT NULL,
  `imagem_fundo_url` VARCHAR(500) NULL,
  `imagem_posicao_id` INT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`hero_section_id`),
  UNIQUE INDEX `uk_hero_section_empresa` (`empresa_id`),
  INDEX `idx_hero_section_posicao` (`imagem_posicao_id`),
  CONSTRAINT `fk_hero_section_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_hero_section_imagem_posicao`
    FOREIGN KEY (`imagem_posicao_id`)
    REFERENCES `imagem_posicao` (`imagem_posicao_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Conteúdo da Hero. Cardinalidade EMPRESA 1:1 HERO_SECTION.';

CREATE TABLE `hero_section_topico` (
  `hero_section_topico_id` INT NOT NULL AUTO_INCREMENT,
  `hero_section_id` INT NOT NULL,
  `titulo_topico` VARCHAR(150) NOT NULL,
  `texto_topico` TEXT NULL,
  `icone_url` VARCHAR(500) NULL,
  `ordem` INT NOT NULL DEFAULT 1,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`hero_section_topico_id`),
  INDEX `idx_hero_topico_hero_ordem` (`hero_section_id`, `ordem`),
  CONSTRAINT `chk_hero_topico_ordem`
    CHECK (`ordem` >= 1),
  CONSTRAINT `fk_hero_section_topico_hero`
    FOREIGN KEY (`hero_section_id`)
    REFERENCES `hero_section` (`hero_section_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tópicos/destaques da Hero. Tenant indireto via hero_section.empresa_id.';

CREATE TABLE `avaliacao_cliente` (
  `avaliacao_cliente_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `cliente_id` INT NULL,
  `pet_id` INT NULL,
  `nome_cliente` VARCHAR(150) NOT NULL,
  `nome_pet` VARCHAR(80) NULL,
  `texto` TEXT NOT NULL,
  `nota` DECIMAL(2,1) NOT NULL,
  `imagem_url` VARCHAR(500) NULL,
  `visivel` TINYINT(1) NOT NULL DEFAULT 0,
  `autorizado_publicacao` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Tutor autorizou publicar nome/texto/foto na página.',
  `data_autorizacao` DATETIME NULL,
  `data_avaliacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`avaliacao_cliente_id`),
  INDEX `idx_avaliacao_empresa_visivel` (`empresa_id`, `visivel`, `data_avaliacao`),
  INDEX `idx_avaliacao_cliente` (`cliente_id`),
  INDEX `idx_avaliacao_pet` (`pet_id`),
  INDEX `idx_avaliacao_status` (`status_id`),
  CONSTRAINT `chk_avaliacao_nota`
    CHECK (`nota` >= 0 AND `nota` <= 5),
  CONSTRAINT `chk_avaliacao_visivel`
    CHECK (`visivel` IN (0, 1)),
  CONSTRAINT `chk_avaliacao_autorizado`
    CHECK (`autorizado_publicacao` IN (0, 1)),
  CONSTRAINT `chk_avaliacao_publicacao`
    CHECK (
      (`autorizado_publicacao` = 0 AND (`visivel` = 0))
      OR (
        `autorizado_publicacao` = 1
        AND `data_autorizacao` IS NOT NULL
      )
    ),
  CONSTRAINT `fk_avaliacao_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_avaliacao_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Depoimentos da página. cliente_id/pet_id opcionais (depoimento pode ser apenas textual).';

CREATE TABLE `galeria_imagem` (
  `galeria_imagem_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `imagem_url` VARCHAR(500) NOT NULL,
  `texto_alternativo` VARCHAR(255) NULL,
  `ordem` INT NOT NULL DEFAULT 1,
  `visivel` TINYINT(1) NOT NULL DEFAULT 1,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`galeria_imagem_id`),
  INDEX `idx_galeria_empresa_ordem` (`empresa_id`, `ordem`),
  INDEX `idx_galeria_status` (`status_id`),
  CONSTRAINT `chk_galeria_ordem`
    CHECK (`ordem` >= 1),
  CONSTRAINT `chk_galeria_visivel`
    CHECK (`visivel` IN (0, 1)),
  CONSTRAINT `fk_galeria_imagem_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_galeria_imagem_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Imagens da galeria pública da clínica. Substitui galeria_carrouseul.';

CREATE TABLE `rede_social` (
  `rede_social_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `tipo_redesocial_id` INT NOT NULL,
  `nome_exibicao` VARCHAR(80) NULL,
  `url` VARCHAR(500) NOT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`rede_social_id`),
  UNIQUE INDEX `uk_rede_social_empresa_tipo` (`empresa_id`, `tipo_redesocial_id`),
  INDEX `idx_rede_social_tipo` (`tipo_redesocial_id`),
  INDEX `idx_rede_social_status` (`status_id`),
  CONSTRAINT `fk_rede_social_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_rede_social_tipo`
    FOREIGN KEY (`tipo_redesocial_id`)
    REFERENCES `tipo_redesocial` (`tipo_redesocial_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_rede_social_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='URLs de redes sociais da empresa. Uma linha por tipo e empresa.';

-- -----------------------------------------------------------------------------
-- 4. Pessoas: cliente (global) e colaborador (por empresa)
-- -----------------------------------------------------------------------------

CREATE TABLE `cliente` (
  `cliente_id` INT NOT NULL AUTO_INCREMENT,
  `nome_cliente` VARCHAR(150) NOT NULL,
  `cpf` VARCHAR(14) NOT NULL,
  `senha_hash` VARCHAR(255) NOT NULL COMMENT 'Hash da senha (nunca texto puro). Login: CPF + senha.',
  `telefone` VARCHAR(20) NULL,
  `email` VARCHAR(255) NULL,
  `permitir_notificacoes` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Se 0, nenhum canal pode notificar este tutor.',
  `status_id` INT NOT NULL,
  `anonimizado_em` DATETIME NULL COMMENT 'Preenchido quando o titular é anonimizado (LGPD). Login deixa de ser possível.',
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`cliente_id`),
  UNIQUE INDEX `uk_cliente_cpf` (`cpf`),
  INDEX `idx_cliente_status` (`status_id`),
  INDEX `idx_cliente_email` (`email`),
  CONSTRAINT `chk_cliente_permitir_notificacoes`
    CHECK (`permitir_notificacoes` IN (0, 1)),
  CONSTRAINT `fk_cliente_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tutor. Login com CPF + senha. Pessoa global; o vínculo com clínicas é empresa_cliente.';

CREATE TABLE `empresa_cliente` (
  `empresa_cliente_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `cliente_id` INT NOT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empresa_cliente_id`),
  UNIQUE INDEX `uk_empresa_cliente` (`empresa_id`, `cliente_id`),
  INDEX `idx_empresa_cliente_cliente` (`cliente_id`),
  INDEX `idx_empresa_cliente_status` (`status_id`),
  CONSTRAINT `fk_empresa_cliente_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_cliente_cliente`
    FOREIGN KEY (`cliente_id`)
    REFERENCES `cliente` (`cliente_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_cliente_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='N:N — um tutor pode ser cliente de várias clínicas.';

CREATE TABLE `colaborador` (
  `colaborador_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `nome_colaborador` VARCHAR(150) NOT NULL,
  `cpf` VARCHAR(14) NOT NULL,
  `email` VARCHAR(255) NOT NULL COMMENT 'Identificador de login do colaborador.',
  `senha_hash` VARCHAR(255) NOT NULL COMMENT 'Hash da senha (nunca texto puro). Login: e-mail + senha.',
  `telefone` VARCHAR(20) NULL,
  `cargo` VARCHAR(80) NULL,
  `funcao` TEXT NULL,
  `descricao` TEXT NULL,
  `imagem_url` VARCHAR(500) NULL,
  `exibir_pagina` TINYINT(1) NOT NULL DEFAULT 0,
  `data_autorizacao_pagina` DATETIME NULL COMMENT 'Quando o colaborador autorizou aparecer na página pública.',
  `ordem_pagina` INT NULL,
  `status_id` INT NOT NULL,
  `anonimizado_em` DATETIME NULL COMMENT 'Preenchido quando o titular é anonimizado (LGPD).',
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`colaborador_id`),
  UNIQUE INDEX `uk_colaborador_empresa_cpf` (`empresa_id`, `cpf`),
  UNIQUE INDEX `uk_colaborador_email` (`email`),
  INDEX `idx_colaborador_empresa_pagina` (`empresa_id`, `exibir_pagina`, `ordem_pagina`),
  INDEX `idx_colaborador_status` (`status_id`),
  CONSTRAINT `chk_colaborador_exibir_pagina`
    CHECK (`exibir_pagina` IN (0, 1)),
  CONSTRAINT `chk_colaborador_autorizacao_pagina`
    CHECK (
      (`exibir_pagina` = 0)
      OR (`exibir_pagina` = 1 AND `data_autorizacao_pagina` IS NOT NULL)
    ),
  CONSTRAINT `fk_colaborador_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_colaborador_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Equipe da clínica. Login com e-mail + senha. Autorização via colaborador_role. exibir_pagina = equipe pública.';

CREATE TABLE `colaborador_horario` (
  `colaborador_horario_id` INT NOT NULL AUTO_INCREMENT,
  `colaborador_id` INT NOT NULL,
  `dia_semana` TINYINT NOT NULL COMMENT '1=segunda ... 7=domingo (ISO).',
  `hora_inicio` TIME NOT NULL,
  `hora_fim` TIME NOT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`colaborador_horario_id`),
  INDEX `idx_colaborador_horario_dia` (`colaborador_id`, `dia_semana`),
  INDEX `idx_colaborador_horario_status` (`status_id`),
  CONSTRAINT `chk_colaborador_horario_dia`
    CHECK (`dia_semana` BETWEEN 1 AND 7),
  CONSTRAINT `chk_colaborador_horario_periodo`
    CHECK (`hora_fim` > `hora_inicio`),
  CONSTRAINT `fk_colaborador_horario_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_colaborador_horario_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Grade semanal em que o profissional atende. Slots livres = grade menos agendamentos.';

DELIMITER $$

CREATE TRIGGER `trg_colaborador_horario_sem_sobrepor_bi`
BEFORE INSERT ON `colaborador_horario`
FOR EACH ROW
BEGIN
  IF EXISTS (
    SELECT 1
    FROM `colaborador_horario` `h`
    WHERE `h`.`colaborador_id` = NEW.`colaborador_id`
      AND `h`.`dia_semana` = NEW.`dia_semana`
      AND NEW.`hora_inicio` < `h`.`hora_fim`
      AND NEW.`hora_fim` > `h`.`hora_inicio`
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Colaborador ja possui faixa de horario sobreposta neste dia.';
  END IF;
END$$

CREATE TRIGGER `trg_colaborador_horario_sem_sobrepor_bu`
BEFORE UPDATE ON `colaborador_horario`
FOR EACH ROW
BEGIN
  IF EXISTS (
    SELECT 1
    FROM `colaborador_horario` `h`
    WHERE `h`.`colaborador_id` = NEW.`colaborador_id`
      AND `h`.`dia_semana` = NEW.`dia_semana`
      AND `h`.`colaborador_horario_id` <> NEW.`colaborador_horario_id`
      AND NEW.`hora_inicio` < `h`.`hora_fim`
      AND NEW.`hora_fim` > `h`.`hora_inicio`
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Colaborador ja possui faixa de horario sobreposta neste dia.';
  END IF;
END$$

DELIMITER ;

CREATE TABLE `colaborador_role` (
  `colaborador_role_id` INT NOT NULL AUTO_INCREMENT,
  `colaborador_id` INT NOT NULL,
  `role_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`colaborador_role_id`),
  UNIQUE INDEX `uk_colaborador_role` (`colaborador_id`, `role_id`),
  INDEX `idx_colaborador_role_role` (`role_id`),
  CONSTRAINT `fk_colaborador_role_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_colaborador_role_role`
    FOREIGN KEY (`role_id`)
    REFERENCES `role` (`role_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='N:N — papéis de um colaborador.';

-- -----------------------------------------------------------------------------
-- 5. Oferta da clínica: especialidades, serviços, catálogos habilitados
-- -----------------------------------------------------------------------------

CREATE TABLE `empresa_especialidade` (
  `empresa_especialidade_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `especialidade_id` INT NOT NULL,
  `descricao` TEXT NULL,
  `imagem_url` VARCHAR(500) NULL,
  `ordem` INT NOT NULL DEFAULT 1,
  `visivel_pagina` TINYINT(1) NOT NULL DEFAULT 1,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empresa_especialidade_id`),
  UNIQUE INDEX `uk_empresa_especialidade` (`empresa_id`, `especialidade_id`),
  INDEX `idx_empresa_especialidade_catalogo` (`especialidade_id`),
  INDEX `idx_empresa_especialidade_pagina` (`empresa_id`, `visivel_pagina`, `ordem`),
  INDEX `idx_empresa_especialidade_status` (`status_id`),
  CONSTRAINT `chk_empresa_especialidade_visivel`
    CHECK (`visivel_pagina` IN (0, 1)),
  CONSTRAINT `fk_empresa_especialidade_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_especialidade_especialidade`
    FOREIGN KEY (`especialidade_id`)
    REFERENCES `especialidade` (`especialidade_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_especialidade_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='N:N — especialidades oferecidas pela clínica, com texto/imagem próprios.';

CREATE TABLE `colaborador_especialidade` (
  `colaborador_especialidade_id` INT NOT NULL AUTO_INCREMENT,
  `colaborador_id` INT NOT NULL,
  `empresa_especialidade_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`colaborador_especialidade_id`),
  UNIQUE INDEX `uk_colaborador_especialidade` (`colaborador_id`, `empresa_especialidade_id`),
  INDEX `idx_colaborador_especialidade_esp` (`empresa_especialidade_id`),
  CONSTRAINT `fk_colaborador_especialidade_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_colaborador_especialidade_empresa_esp`
    FOREIGN KEY (`empresa_especialidade_id`)
    REFERENCES `empresa_especialidade` (`empresa_especialidade_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='N:N — colaborador só se associa a especialidades já oferecidas pela própria empresa.';

CREATE TABLE `empresa_servico` (
  `empresa_servico_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `tipo_servico_id` INT NOT NULL,
  `nome_exibicao` VARCHAR(150) NULL,
  `descricao` TEXT NULL,
  `imagem_url` VARCHAR(500) NULL,
  `preco` DECIMAL(10,2) NULL,
  `duracao_minutos` INT NULL,
  `ordem` INT NOT NULL DEFAULT 1,
  `visivel_pagina` TINYINT(1) NOT NULL DEFAULT 1,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empresa_servico_id`),
  UNIQUE INDEX `uk_empresa_servico` (`empresa_id`, `tipo_servico_id`),
  INDEX `idx_empresa_servico_tipo` (`tipo_servico_id`),
  INDEX `idx_empresa_servico_pagina` (`empresa_id`, `visivel_pagina`, `ordem`),
  INDEX `idx_empresa_servico_status` (`status_id`),
  CONSTRAINT `chk_empresa_servico_preco`
    CHECK (`preco` IS NULL OR `preco` >= 0),
  CONSTRAINT `chk_empresa_servico_duracao`
    CHECK (`duracao_minutos` IS NULL OR `duracao_minutos` > 0),
  CONSTRAINT `chk_empresa_servico_visivel`
    CHECK (`visivel_pagina` IN (0, 1)),
  CONSTRAINT `fk_empresa_servico_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_servico_tipo`
    FOREIGN KEY (`tipo_servico_id`)
    REFERENCES `tipo_servico` (`tipo_servico_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_servico_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Oferta N:N: tipo global + customização/preço/duração por empresa.';

CREATE TABLE `empresa_vacina` (
  `empresa_vacina_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `vacina_id` INT NOT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empresa_vacina_id`),
  UNIQUE INDEX `uk_empresa_vacina` (`empresa_id`, `vacina_id`),
  INDEX `idx_empresa_vacina_vacina` (`vacina_id`),
  INDEX `idx_empresa_vacina_status` (`status_id`),
  CONSTRAINT `fk_empresa_vacina_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_vacina_vacina`
    FOREIGN KEY (`vacina_id`)
    REFERENCES `vacina` (`vacina_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_vacina_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Vacinas habilitadas para uso pela clínica.';

CREATE TABLE `empresa_doenca` (
  `empresa_doenca_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `doenca_id` INT NOT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empresa_doenca_id`),
  UNIQUE INDEX `uk_empresa_doenca` (`empresa_id`, `doenca_id`),
  INDEX `idx_empresa_doenca_doenca` (`doenca_id`),
  INDEX `idx_empresa_doenca_status` (`status_id`),
  CONSTRAINT `fk_empresa_doenca_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_doenca_doenca`
    FOREIGN KEY (`doenca_id`)
    REFERENCES `doenca` (`doenca_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_doenca_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Doenças habilitadas no prontuário da clínica.';

CREATE TABLE `empresa_pet_especie` (
  `empresa_pet_especie_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `pet_especie_id` INT NOT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empresa_pet_especie_id`),
  UNIQUE INDEX `uk_empresa_pet_especie` (`empresa_id`, `pet_especie_id`),
  INDEX `idx_empresa_pet_especie_especie` (`pet_especie_id`),
  INDEX `idx_empresa_pet_especie_status` (`status_id`),
  CONSTRAINT `fk_empresa_pet_especie_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_pet_especie_especie`
    FOREIGN KEY (`pet_especie_id`)
    REFERENCES `pet_especie` (`pet_especie_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_pet_especie_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Espécies atendidas pela clínica.';

CREATE TABLE `empresa_pet_raca` (
  `empresa_pet_raca_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `pet_raca_id` INT NOT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`empresa_pet_raca_id`),
  UNIQUE INDEX `uk_empresa_pet_raca` (`empresa_id`, `pet_raca_id`),
  INDEX `idx_empresa_pet_raca_raca` (`pet_raca_id`),
  INDEX `idx_empresa_pet_raca_status` (`status_id`),
  CONSTRAINT `fk_empresa_pet_raca_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_pet_raca_raca`
    FOREIGN KEY (`pet_raca_id`)
    REFERENCES `pet_raca` (`pet_raca_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_empresa_pet_raca_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Raças utilizadas pela clínica.';

-- -----------------------------------------------------------------------------
-- 6. Pets e prontuário
-- -----------------------------------------------------------------------------

CREATE TABLE `pet` (
  `pet_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `cliente_id` INT NOT NULL,
  `pet_especie_id` INT NOT NULL,
  `pet_raca_id` INT NULL,
  `nome_pet` VARCHAR(80) NOT NULL,
  `sexo` CHAR(1) NOT NULL,
  `data_aniversario` DATE NULL,
  `peso` DECIMAL(6,2) NULL,
  `numero_microchip` VARCHAR(45) NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pet_id`),
  INDEX `idx_pet_empresa_cliente` (`empresa_id`, `cliente_id`),
  INDEX `idx_pet_cliente` (`cliente_id`),
  INDEX `idx_pet_especie` (`pet_especie_id`),
  INDEX `idx_pet_raca` (`pet_raca_id`),
  INDEX `idx_pet_status` (`status_id`),
  UNIQUE INDEX `uk_pet_empresa_microchip` (`empresa_id`, `numero_microchip`),
  CONSTRAINT `chk_pet_sexo`
    CHECK (`sexo` IN ('M', 'F', 'I')),
  CONSTRAINT `chk_pet_peso`
    CHECK (`peso` IS NULL OR `peso` > 0),
  CONSTRAINT `fk_pet_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pet_cliente`
    FOREIGN KEY (`cliente_id`)
    REFERENCES `cliente` (`cliente_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pet_especie`
    FOREIGN KEY (`pet_especie_id`)
    REFERENCES `pet_especie` (`pet_especie_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pet_raca`
    FOREIGN KEY (`pet_raca_id`)
    REFERENCES `pet_raca` (`pet_raca_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pet_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Pet cadastrado na clínica. empresa_id é obrigatório para isolamento de tenant.';

CREATE TABLE `colaborador_pet` (
  `colaborador_pet_id` INT NOT NULL AUTO_INCREMENT,
  `colaborador_id` INT NOT NULL,
  `pet_id` INT NOT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`colaborador_pet_id`),
  UNIQUE INDEX `uk_colaborador_pet` (`colaborador_id`, `pet_id`),
  INDEX `idx_colaborador_pet_pet` (`pet_id`),
  INDEX `idx_colaborador_pet_status` (`status_id`),
  CONSTRAINT `fk_colaborador_pet_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_colaborador_pet_pet`
    FOREIGN KEY (`pet_id`)
    REFERENCES `pet` (`pet_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_colaborador_pet_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Veterinário(s) de referência do pet. Antes: colaborador_tutor_pet.';

CREATE TABLE `historico_vacinacao` (
  `historico_vacinacao_id` INT NOT NULL AUTO_INCREMENT,
  `pet_id` INT NOT NULL,
  `vacina_id` INT NOT NULL,
  `colaborador_id` INT NULL,
  `atendimento_id` INT NULL COMMENT 'NULL = registro só de prontuário (importação/legado).',
  `data_aplicacao` DATE NOT NULL,
  `data_proxima_dose` DATE NULL,
  `lote` VARCHAR(80) NULL,
  `observacoes` TEXT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`historico_vacinacao_id`),
  INDEX `idx_historico_vacinacao_pet_data` (`pet_id`, `data_aplicacao`),
  INDEX `idx_historico_vacinacao_vacina` (`vacina_id`),
  INDEX `idx_historico_vacinacao_colaborador` (`colaborador_id`),
  INDEX `idx_historico_vacinacao_atendimento` (`atendimento_id`),
  CONSTRAINT `chk_historico_vacinacao_datas`
    CHECK (`data_proxima_dose` IS NULL OR `data_proxima_dose` >= `data_aplicacao`),
  CONSTRAINT `fk_historico_vacinacao_pet`
    FOREIGN KEY (`pet_id`)
    REFERENCES `pet` (`pet_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_historico_vacinacao_vacina`
    FOREIGN KEY (`vacina_id`)
    REFERENCES `vacina` (`vacina_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_historico_vacinacao_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Aplicações de vacina. Tenant via pet.empresa_id. atendimento_id amarra à visita quando houver.';

CREATE TABLE `historico_doenca` (
  `historico_doenca_id` INT NOT NULL AUTO_INCREMENT,
  `pet_id` INT NOT NULL,
  `doenca_id` INT NOT NULL,
  `colaborador_id` INT NULL,
  `atendimento_id` INT NULL COMMENT 'NULL = registro só de prontuário (importação/legado).',
  `data_diagnostico` DATE NOT NULL,
  `data_cura` DATE NULL,
  `observacoes` TEXT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`historico_doenca_id`),
  INDEX `idx_historico_doenca_pet_data` (`pet_id`, `data_diagnostico`),
  INDEX `idx_historico_doenca_doenca` (`doenca_id`),
  INDEX `idx_historico_doenca_colaborador` (`colaborador_id`),
  INDEX `idx_historico_doenca_atendimento` (`atendimento_id`),
  CONSTRAINT `chk_historico_doenca_datas`
    CHECK (`data_cura` IS NULL OR `data_cura` >= `data_diagnostico`),
  CONSTRAINT `fk_historico_doenca_pet`
    FOREIGN KEY (`pet_id`)
    REFERENCES `pet` (`pet_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_historico_doenca_doenca`
    FOREIGN KEY (`doenca_id`)
    REFERENCES `doenca` (`doenca_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_historico_doenca_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ocorrências de doença no pet. Tenant via pet.empresa_id. atendimento_id amarra à visita quando houver.';

CREATE TABLE `notificacao_vacina` (
  `notificacao_vacina_id` INT NOT NULL AUTO_INCREMENT,
  `historico_vacinacao_id` INT NOT NULL,
  `empresa_id` INT NOT NULL,
  `cliente_id` INT NOT NULL,
  `canal` VARCHAR(20) NOT NULL,
  `status_envio` VARCHAR(30) NOT NULL,
  `data_proxima_dose_ref` DATE NULL COMMENT 'Foto da data avisada.',
  `detalhe_erro` VARCHAR(255) NULL,
  `data_envio` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Instante da tentativa de envio.',
  PRIMARY KEY (`notificacao_vacina_id`),
  INDEX `idx_notificacao_vacina_historico` (`historico_vacinacao_id`, `data_envio`),
  INDEX `idx_notificacao_vacina_empresa_data` (`empresa_id`, `data_envio`),
  INDEX `idx_notificacao_vacina_cliente` (`cliente_id`),
  CONSTRAINT `chk_notificacao_vacina_canal`
    CHECK (`canal` IN ('WHATSAPP', 'EMAIL', 'SMS')),
  CONSTRAINT `chk_notificacao_vacina_status`
    CHECK (`status_envio` IN ('ENVIADA', 'FALHOU', 'IGNORADA')),
  CONSTRAINT `fk_notificacao_vacina_historico`
    FOREIGN KEY (`historico_vacinacao_id`)
    REFERENCES `historico_vacinacao` (`historico_vacinacao_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_notificacao_vacina_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_notificacao_vacina_cliente`
    FOREIGN KEY (`cliente_id`)
    REFERENCES `cliente` (`cliente_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tentativas de aviso de vencimento de vacina. Evita reenvio cego.';

-- FKs opcionais de avaliacao_cliente para cliente/pet (criadas após pet)
ALTER TABLE `avaliacao_cliente`
  ADD CONSTRAINT `fk_avaliacao_cliente`
    FOREIGN KEY (`cliente_id`)
    REFERENCES `cliente` (`cliente_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_avaliacao_pet`
    FOREIGN KEY (`pet_id`)
    REFERENCES `pet` (`pet_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 7. Agenda e atendimento
-- -----------------------------------------------------------------------------

CREATE TABLE `agendamento` (
  `agendamento_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `cliente_id` INT NOT NULL,
  `pet_id` INT NOT NULL,
  `colaborador_id` INT NULL,
  `empresa_servico_id` INT NULL,
  `agendamento_status_id` INT NOT NULL,
  `origem` VARCHAR(20) NOT NULL COMMENT 'CLIENTE = tutor no app; COLABORADOR = clínica marcou.',
  `colaborador_criacao_id` INT NULL COMMENT 'Preenchido só quando origem = COLABORADOR.',
  `data_hora_inicio` DATETIME NOT NULL,
  `data_hora_fim` DATETIME NULL,
  `observacoes` TEXT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`agendamento_id`),
  INDEX `idx_agendamento_empresa_inicio` (`empresa_id`, `data_hora_inicio`),
  INDEX `idx_agendamento_cliente` (`cliente_id`),
  INDEX `idx_agendamento_pet` (`pet_id`),
  INDEX `idx_agendamento_colaborador_inicio` (`colaborador_id`, `data_hora_inicio`),
  INDEX `idx_agendamento_servico` (`empresa_servico_id`),
  INDEX `idx_agendamento_status` (`agendamento_status_id`),
  INDEX `idx_agendamento_origem` (`empresa_id`, `origem`),
  INDEX `idx_agendamento_criacao` (`colaborador_criacao_id`),
  CONSTRAINT `chk_agendamento_periodo`
    CHECK (`data_hora_fim` IS NULL OR `data_hora_fim` >= `data_hora_inicio`),
  CONSTRAINT `chk_agendamento_fim_quando_profissional`
    CHECK (`colaborador_id` IS NULL OR `data_hora_fim` IS NOT NULL),
  CONSTRAINT `chk_agendamento_origem`
    CHECK (
      (`origem` = 'CLIENTE' AND `colaborador_criacao_id` IS NULL)
      OR (`origem` = 'COLABORADOR' AND `colaborador_criacao_id` IS NOT NULL)
    ),
  CONSTRAINT `fk_agendamento_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_agendamento_cliente`
    FOREIGN KEY (`cliente_id`)
    REFERENCES `cliente` (`cliente_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_agendamento_pet`
    FOREIGN KEY (`pet_id`)
    REFERENCES `pet` (`pet_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_agendamento_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_agendamento_colaborador_criacao`
    FOREIGN KEY (`colaborador_criacao_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_agendamento_servico`
    FOREIGN KEY (`empresa_servico_id`)
    REFERENCES `empresa_servico` (`empresa_servico_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_agendamento_status`
    FOREIGN KEY (`agendamento_status_id`)
    REFERENCES `agendamento_status` (`agendamento_status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Compromisso futuro. origem diz se o tutor ou a clínica marcou.';

DELIMITER $$

CREATE TRIGGER `trg_agendamento_sem_conflito_bi`
BEFORE INSERT ON `agendamento`
FOR EACH ROW
BEGIN
  IF NEW.`colaborador_id` IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM `agendamento` `a`
      INNER JOIN `agendamento_status` `s`
        ON `s`.`agendamento_status_id` = `a`.`agendamento_status_id`
      WHERE `a`.`colaborador_id` = NEW.`colaborador_id`
        AND (`s`.`codigo` IS NULL OR `s`.`codigo` NOT IN ('CANCELADO', 'FALTOU'))
        AND NEW.`data_hora_inicio` < `a`.`data_hora_fim`
        AND NEW.`data_hora_fim` > `a`.`data_hora_inicio`
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Colaborador ja possui agendamento neste horario.';
    END IF;
  END IF;
END$$

CREATE TRIGGER `trg_agendamento_sem_conflito_bu`
BEFORE UPDATE ON `agendamento`
FOR EACH ROW
BEGIN
  IF NEW.`colaborador_id` IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM `agendamento` `a`
      INNER JOIN `agendamento_status` `s`
        ON `s`.`agendamento_status_id` = `a`.`agendamento_status_id`
      WHERE `a`.`colaborador_id` = NEW.`colaborador_id`
        AND `a`.`agendamento_id` <> NEW.`agendamento_id`
        AND (`s`.`codigo` IS NULL OR `s`.`codigo` NOT IN ('CANCELADO', 'FALTOU'))
        AND NEW.`data_hora_inicio` < `a`.`data_hora_fim`
        AND NEW.`data_hora_fim` > `a`.`data_hora_inicio`
    ) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Colaborador ja possui agendamento neste horario.';
    END IF;
  END IF;
END$$

DELIMITER ;

CREATE TABLE `atendimento` (
  `atendimento_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `cliente_id` INT NOT NULL,
  `pet_id` INT NOT NULL,
  `agendamento_id` INT NULL,
  `empresa_servico_id` INT NULL COMMENT 'Serviço realizado no ato (pode diferir do agendado).',
  `atendimento_status_id` INT NOT NULL,
  `origem` VARCHAR(20) NOT NULL COMMENT 'CLIENTE ou COLABORADOR. Walk-in da recepção = COLABORADOR.',
  `colaborador_criacao_id` INT NULL COMMENT 'Quem abriu a visita quando origem = COLABORADOR.',
  `resumo_cliente` TEXT NULL COMMENT 'Relato do tutor (queixa/objetivo). Ele preenche e acompanha.',
  `detalhes` TEXT NULL COMMENT 'Nota clínica interna do colaborador. O tutor não vê.',
  `data_inicio` DATETIME NULL,
  `data_fim` DATETIME NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`atendimento_id`),
  UNIQUE INDEX `uk_atendimento_agendamento` (`agendamento_id`),
  INDEX `idx_atendimento_empresa_inicio` (`empresa_id`, `data_inicio`),
  INDEX `idx_atendimento_cliente` (`cliente_id`),
  INDEX `idx_atendimento_pet` (`pet_id`),
  INDEX `idx_atendimento_servico` (`empresa_servico_id`),
  INDEX `idx_atendimento_status` (`atendimento_status_id`),
  INDEX `idx_atendimento_origem` (`empresa_id`, `origem`),
  INDEX `idx_atendimento_criacao` (`colaborador_criacao_id`),
  CONSTRAINT `chk_atendimento_periodo`
    CHECK (`data_fim` IS NULL OR `data_inicio` IS NULL OR `data_fim` >= `data_inicio`),
  CONSTRAINT `chk_atendimento_origem`
    CHECK (
      (`origem` = 'CLIENTE' AND `colaborador_criacao_id` IS NULL)
      OR (`origem` = 'COLABORADOR' AND `colaborador_criacao_id` IS NOT NULL)
    ),
  CONSTRAINT `fk_atendimento_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_atendimento_cliente`
    FOREIGN KEY (`cliente_id`)
    REFERENCES `cliente` (`cliente_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_atendimento_pet`
    FOREIGN KEY (`pet_id`)
    REFERENCES `pet` (`pet_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_atendimento_agendamento`
    FOREIGN KEY (`agendamento_id`)
    REFERENCES `agendamento` (`agendamento_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_atendimento_servico`
    FOREIGN KEY (`empresa_servico_id`)
    REFERENCES `empresa_servico` (`empresa_servico_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_atendimento_colaborador_criacao`
    FOREIGN KEY (`colaborador_criacao_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_atendimento_status`
    FOREIGN KEY (`atendimento_status_id`)
    REFERENCES `atendimento_status` (`atendimento_status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ato clínico realizado. 0..1 com agendamento. Serviço e vacinas da visita ligam aqui.';

ALTER TABLE `historico_vacinacao`
  ADD CONSTRAINT `fk_historico_vacinacao_atendimento`
    FOREIGN KEY (`atendimento_id`)
    REFERENCES `atendimento` (`atendimento_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE `historico_doenca`
  ADD CONSTRAINT `fk_historico_doenca_atendimento`
    FOREIGN KEY (`atendimento_id`)
    REFERENCES `atendimento` (`atendimento_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

CREATE TABLE `atendimento_colaborador` (
  `atendimento_colaborador_id` INT NOT NULL AUTO_INCREMENT,
  `atendimento_id` INT NOT NULL,
  `colaborador_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`atendimento_colaborador_id`),
  UNIQUE INDEX `uk_atendimento_colaborador` (`atendimento_id`, `colaborador_id`),
  INDEX `idx_atendimento_colaborador_colab` (`colaborador_id`),
  CONSTRAINT `fk_atendimento_colaborador_atendimento`
    FOREIGN KEY (`atendimento_id`)
    REFERENCES `atendimento` (`atendimento_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_atendimento_colaborador_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='N:N — profissionais envolvidos no atendimento.';

CREATE TABLE `atendimento_andamento` (
  `atendimento_andamento_id` INT NOT NULL AUTO_INCREMENT,
  `atendimento_id` INT NOT NULL,
  `colaborador_id` INT NOT NULL,
  `detalhes_colaborador` TEXT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`atendimento_andamento_id`),
  INDEX `idx_andamento_atendimento` (`atendimento_id`, `data_criacao`),
  INDEX `idx_andamento_colaborador` (`colaborador_id`),
  CONSTRAINT `fk_atendimento_andamento_atendimento`
    FOREIGN KEY (`atendimento_id`)
    REFERENCES `atendimento` (`atendimento_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_atendimento_andamento_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Linha do tempo do atendimento. FK atendimento_id era omissa/ambígua no modelo antigo.';

-- -----------------------------------------------------------------------------
-- 8. Doações
-- -----------------------------------------------------------------------------

CREATE TABLE `doacao` (
  `doacao_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `titulo` VARCHAR(150) NOT NULL,
  `texto` TEXT NULL,
  `meta_valor` DECIMAL(10,2) NULL,
  `data_inicio` DATE NULL,
  `data_fim` DATE NULL,
  `imagem_principal_url` VARCHAR(500) NULL,
  `ordem` INT NOT NULL DEFAULT 1,
  `visivel_pagina` TINYINT(1) NOT NULL DEFAULT 1,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`doacao_id`),
  INDEX `idx_doacao_empresa_status` (`empresa_id`, `status_id`),
  INDEX `idx_doacao_empresa_ordem` (`empresa_id`, `visivel_pagina`, `ordem`),
  CONSTRAINT `chk_doacao_datas`
    CHECK (`data_fim` IS NULL OR `data_inicio` IS NULL OR `data_fim` >= `data_inicio`),
  CONSTRAINT `chk_doacao_meta`
    CHECK (`meta_valor` IS NULL OR `meta_valor` >= 0),
  CONSTRAINT `chk_doacao_visivel`
    CHECK (`visivel_pagina` IN (0, 1)),
  CONSTRAINT `fk_doacao_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_doacao_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Campanha de doação da clínica. Valor arrecadado = soma de pagamentos PAGO.';

CREATE TABLE `galeria_doacao` (
  `galeria_doacao_id` INT NOT NULL AUTO_INCREMENT,
  `doacao_id` INT NOT NULL,
  `imagem_url` VARCHAR(500) NOT NULL,
  `texto_alternativo` VARCHAR(255) NULL,
  `ordem` INT NOT NULL DEFAULT 1,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`galeria_doacao_id`),
  INDEX `idx_galeria_doacao_doacao_ordem` (`doacao_id`, `ordem`),
  CONSTRAINT `chk_galeria_doacao_ordem`
    CHECK (`ordem` >= 1),
  CONSTRAINT `fk_galeria_doacao_doacao`
    FOREIGN KEY (`doacao_id`)
    REFERENCES `doacao` (`doacao_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Imagens da campanha. Tenant via doacao.empresa_id.';

-- -----------------------------------------------------------------------------
-- 9. Pagamentos da clínica (receita da empresa)
-- -----------------------------------------------------------------------------

CREATE TABLE `conta_pagamento` (
  `conta_pagamento_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `provider` VARCHAR(40) NOT NULL,
  `account_id` VARCHAR(120) NOT NULL,
  `status_conta` VARCHAR(20) NOT NULL,
  `connected_at` DATETIME NULL,
  `disconnected_at` DATETIME NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`conta_pagamento_id`),
  UNIQUE INDEX `uk_conta_pagamento_provider_account` (`provider`, `account_id`),
  INDEX `idx_conta_pagamento_empresa_status` (`empresa_id`, `status_conta`),
  CONSTRAINT `chk_conta_pagamento_status`
    CHECK (`status_conta` IN ('PENDENTE', 'CONECTADA', 'DESCONECTADA', 'REJEITADA')),
  CONSTRAINT `fk_conta_pagamento_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Conta conectada no provedor. 1:N para permitir troca de provider sem perder histórico.';

CREATE TABLE `pagamento` (
  `pagamento_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `conta_pagamento_id` INT NULL,
  `cliente_id` INT NULL,
  `tipo_origem` VARCHAR(20) NOT NULL,
  `agendamento_id` INT NULL,
  `atendimento_id` INT NULL,
  `empresa_servico_id` INT NULL,
  `doacao_id` INT NULL,
  `valor` DECIMAL(10,2) NOT NULL,
  `moeda` CHAR(3) NOT NULL DEFAULT 'BRL',
  `status_pagamento` VARCHAR(20) NOT NULL,
  `provider` VARCHAR(40) NULL,
  `provider_pagamento_id` VARCHAR(120) NULL,
  `metodo` VARCHAR(40) NULL,
  `pago_em` DATETIME NULL,
  `descricao` VARCHAR(255) NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`pagamento_id`),
  UNIQUE INDEX `uk_pagamento_provider_ref` (`provider`, `provider_pagamento_id`),
  INDEX `idx_pagamento_empresa_status` (`empresa_id`, `status_pagamento`),
  INDEX `idx_pagamento_cliente` (`cliente_id`),
  INDEX `idx_pagamento_conta` (`conta_pagamento_id`),
  INDEX `idx_pagamento_agendamento` (`agendamento_id`),
  INDEX `idx_pagamento_atendimento` (`atendimento_id`),
  INDEX `idx_pagamento_servico` (`empresa_servico_id`),
  INDEX `idx_pagamento_doacao` (`doacao_id`),
  CONSTRAINT `chk_pagamento_valor`
    CHECK (`valor` > 0),
  CONSTRAINT `chk_pagamento_tipo`
    CHECK (`tipo_origem` IN ('ATENDIMENTO', 'SERVICO', 'DOACAO', 'AGENDAMENTO', 'OUTRO')),
  CONSTRAINT `chk_pagamento_status`
    CHECK (`status_pagamento` IN ('PENDENTE', 'PAGO', 'CANCELADO', 'ESTORNADO', 'FALHOU')),
  CONSTRAINT `chk_pagamento_origem_fk`
    CHECK (
      (`tipo_origem` = 'ATENDIMENTO' AND `atendimento_id` IS NOT NULL)
      OR (`tipo_origem` = 'SERVICO' AND `empresa_servico_id` IS NOT NULL)
      OR (`tipo_origem` = 'DOACAO' AND `doacao_id` IS NOT NULL)
      OR (`tipo_origem` = 'AGENDAMENTO' AND `agendamento_id` IS NOT NULL)
      OR (`tipo_origem` = 'OUTRO')
    ),
  CONSTRAINT `fk_pagamento_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pagamento_conta`
    FOREIGN KEY (`conta_pagamento_id`)
    REFERENCES `conta_pagamento` (`conta_pagamento_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pagamento_cliente`
    FOREIGN KEY (`cliente_id`)
    REFERENCES `cliente` (`cliente_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pagamento_agendamento`
    FOREIGN KEY (`agendamento_id`)
    REFERENCES `agendamento` (`agendamento_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pagamento_atendimento`
    FOREIGN KEY (`atendimento_id`)
    REFERENCES `atendimento` (`atendimento_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pagamento_servico`
    FOREIGN KEY (`empresa_servico_id`)
    REFERENCES `empresa_servico` (`empresa_servico_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_pagamento_doacao`
    FOREIGN KEY (`doacao_id`)
    REFERENCES `doacao` (`doacao_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Livro único de recebimentos da clínica (consulta, serviço, doação). Não inclui mensalidade do SaaS.';

-- -----------------------------------------------------------------------------
-- 10. Assinatura / mensalidade (receita da plataforma)
-- A conta recebedora da plataforma fica no .env, não neste modelo.
-- -----------------------------------------------------------------------------

CREATE TABLE `assinatura` (
  `assinatura_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `plano_id` INT NOT NULL,
  `status_assinatura` VARCHAR(20) NOT NULL,
  `data_inicio` DATE NOT NULL,
  `data_fim` DATE NULL,
  `data_proximo_vencimento` DATE NULL,
  `dias_tolerancia` INT NOT NULL DEFAULT 3,
  `data_cancelamento` DATETIME NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`assinatura_id`),
  INDEX `idx_assinatura_empresa_status` (`empresa_id`, `status_assinatura`),
  INDEX `idx_assinatura_plano` (`plano_id`),
  INDEX `idx_assinatura_vencimento` (`status_assinatura`, `data_proximo_vencimento`),
  CONSTRAINT `chk_assinatura_status`
    CHECK (`status_assinatura` IN ('TRIAL', 'ATIVA', 'INADIMPLENTE', 'SUSPENSA', 'CANCELADA')),
  CONSTRAINT `chk_assinatura_tolerancia`
    CHECK (`dias_tolerancia` >= 0),
  CONSTRAINT `chk_assinatura_periodo`
    CHECK (`data_fim` IS NULL OR `data_fim` >= `data_inicio`),
  CONSTRAINT `fk_assinatura_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_assinatura_plano`
    FOREIGN KEY (`plano_id`)
    REFERENCES `plano` (`plano_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Assinatura da clínica ao SaaS. Histórico 1:N; a vigente é a de status ATIVA/TRIAL.';

CREATE TABLE `fatura_assinatura` (
  `fatura_assinatura_id` INT NOT NULL AUTO_INCREMENT,
  `assinatura_id` INT NOT NULL,
  `empresa_id` INT NOT NULL,
  `competencia` DATE NOT NULL COMMENT 'Primeiro dia do mês de referência',
  `valor_bruto` DECIMAL(10,2) NOT NULL COMMENT 'Preço do plano antes do cupom.',
  `token_id` INT NULL COMMENT 'NULL = fatura sem desconto.',
  `codigo_token_aplicado` VARCHAR(80) NULL COMMENT 'Foto do código no momento do uso.',
  `percentual_desconto_aplicado` DECIMAL(5,2) NULL COMMENT 'Foto do percentual no momento do uso.',
  `valor` DECIMAL(10,2) NOT NULL COMMENT 'Valor líquido cobrado (após desconto, se houver).',
  `moeda` CHAR(3) NOT NULL DEFAULT 'BRL',
  `status_fatura` VARCHAR(20) NOT NULL,
  `data_vencimento` DATE NOT NULL,
  `data_pagamento` DATETIME NULL,
  `provider` VARCHAR(40) NULL,
  `provider_fatura_id` VARCHAR(120) NULL,
  `provider_pagamento_id` VARCHAR(120) NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`fatura_assinatura_id`),
  UNIQUE INDEX `uk_fatura_assinatura_competencia` (`assinatura_id`, `competencia`),
  INDEX `idx_fatura_empresa` (`empresa_id`),
  INDEX `idx_fatura_token` (`token_id`),
  INDEX `idx_fatura_status_vencimento` (`status_fatura`, `data_vencimento`),
  INDEX `idx_fatura_provider_ref` (`provider`, `provider_fatura_id`),
  CONSTRAINT `chk_fatura_status`
    CHECK (`status_fatura` IN ('PENDENTE', 'PAGA', 'ATRASADA', 'CANCELADA')),
  CONSTRAINT `chk_fatura_valor_bruto`
    CHECK (`valor_bruto` >= 0),
  CONSTRAINT `chk_fatura_valor`
    CHECK (`valor` >= 0 AND `valor` <= `valor_bruto`),
  CONSTRAINT `chk_fatura_token_auditoria`
    CHECK (
      (
        `token_id` IS NULL
        AND `codigo_token_aplicado` IS NULL
        AND `percentual_desconto_aplicado` IS NULL
      )
      OR (
        `token_id` IS NOT NULL
        AND `codigo_token_aplicado` IS NOT NULL
        AND `percentual_desconto_aplicado` IS NOT NULL
        AND `percentual_desconto_aplicado` >= 0
        AND `percentual_desconto_aplicado` <= 100
      )
    ),
  CONSTRAINT `fk_fatura_assinatura`
    FOREIGN KEY (`assinatura_id`)
    REFERENCES `assinatura` (`assinatura_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_fatura_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_fatura_token`
    FOREIGN KEY (`token_id`)
    REFERENCES `token` (`token_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Fatura mensal da clínica. token_id NULL = sem cupom. Snapshots auditam o desconto aplicado.';

DELIMITER $$

CREATE TRIGGER `trg_fatura_token_limite_bi`
BEFORE INSERT ON `fatura_assinatura`
FOR EACH ROW
BEGIN
  DECLARE v_limite INT;
  DECLARE v_usos INT;

  IF NEW.`token_id` IS NOT NULL THEN
    SELECT `usos_maximos_por_empresa`
      INTO v_limite
      FROM `token`
      WHERE `token_id` = NEW.`token_id`;

    IF v_limite IS NOT NULL THEN
      SELECT COUNT(*)
        INTO v_usos
        FROM `fatura_assinatura`
        WHERE `empresa_id` = NEW.`empresa_id`
          AND `token_id` = NEW.`token_id`
          AND `status_fatura` <> 'CANCELADA';

      IF v_usos >= v_limite THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Token ja atingiu o limite de usos desta empresa.';
      END IF;
    END IF;
  END IF;
END$$

CREATE TRIGGER `trg_fatura_token_limite_bu`
BEFORE UPDATE ON `fatura_assinatura`
FOR EACH ROW
BEGIN
  DECLARE v_limite INT;
  DECLARE v_usos INT;

  IF NEW.`token_id` IS NOT NULL THEN
    SELECT `usos_maximos_por_empresa`
      INTO v_limite
      FROM `token`
      WHERE `token_id` = NEW.`token_id`;

    IF v_limite IS NOT NULL THEN
      SELECT COUNT(*)
        INTO v_usos
        FROM `fatura_assinatura`
        WHERE `empresa_id` = NEW.`empresa_id`
          AND `token_id` = NEW.`token_id`
          AND `status_fatura` <> 'CANCELADA'
          AND `fatura_assinatura_id` <> NEW.`fatura_assinatura_id`;

      IF v_usos >= v_limite THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Token ja atingiu o limite de usos desta empresa.';
      END IF;
    END IF;
  END IF;
END$$

DELIMITER ;

-- -----------------------------------------------------------------------------
-- 11. Chat
-- -----------------------------------------------------------------------------

CREATE TABLE `chat` (
  `chat_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NOT NULL,
  `cliente_id` INT NOT NULL,
  `pet_id` INT NULL COMMENT 'NULL = conversa geral com a clínica, sem animal.',
  `agendamento_id` INT NULL,
  `atendimento_id` INT NULL,
  `chat_motivo_id` INT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ultima_atualizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_id`),
  INDEX `idx_chat_empresa_status` (`empresa_id`, `status_id`),
  INDEX `idx_chat_cliente` (`cliente_id`),
  INDEX `idx_chat_pet` (`pet_id`),
  INDEX `idx_chat_agendamento` (`agendamento_id`),
  INDEX `idx_chat_atendimento` (`atendimento_id`),
  INDEX `idx_chat_motivo` (`chat_motivo_id`),
  CONSTRAINT `fk_chat_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_cliente`
    FOREIGN KEY (`cliente_id`)
    REFERENCES `cliente` (`cliente_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_pet`
    FOREIGN KEY (`pet_id`)
    REFERENCES `pet` (`pet_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_agendamento`
    FOREIGN KEY (`agendamento_id`)
    REFERENCES `agendamento` (`agendamento_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_atendimento`
    FOREIGN KEY (`atendimento_id`)
    REFERENCES `atendimento` (`atendimento_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_motivo`
    FOREIGN KEY (`chat_motivo_id`)
    REFERENCES `chat_motivo` (`chat_motivo_id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Chat do tutor com a clínica. pet_id 0..1: NULL = pergunta geral.';

CREATE TABLE `chat_mensagem` (
  `chat_mensagem_id` INT NOT NULL AUTO_INCREMENT,
  `chat_id` INT NOT NULL,
  `remetente_tipo` VARCHAR(20) NOT NULL,
  `remetente_id` INT NOT NULL,
  `mensagem` TEXT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_mensagem_id`),
  INDEX `idx_chat_mensagem_chat` (`chat_id`, `data_criacao`),
  CONSTRAINT `chk_chat_mensagem_remetente`
    CHECK (`remetente_tipo` IN ('CLIENTE', 'COLABORADOR')),
  CONSTRAINT `fk_chat_mensagem_chat`
    FOREIGN KEY (`chat_id`)
    REFERENCES `chat` (`chat_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Mensagens do chat. Substitui o flag cliente TINYINT + coluna chatcol.';

CREATE TABLE `chat_colaborador_responsavel` (
  `chat_colaborador_responsavel_id` INT NOT NULL AUTO_INCREMENT,
  `chat_id` INT NOT NULL,
  `colaborador_id` INT NOT NULL,
  `status_id` INT NOT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_colaborador_responsavel_id`),
  UNIQUE INDEX `uk_chat_colaborador_responsavel` (`chat_id`, `colaborador_id`),
  INDEX `idx_chat_resp_colaborador` (`colaborador_id`),
  INDEX `idx_chat_resp_status` (`status_id`),
  CONSTRAINT `fk_chat_resp_chat`
    FOREIGN KEY (`chat_id`)
    REFERENCES `chat` (`chat_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_resp_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_resp_status`
    FOREIGN KEY (`status_id`)
    REFERENCES `status` (`status_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Colaboradores responsáveis pelo chat.';

CREATE TABLE `chat_finalizacao` (
  `chat_finalizacao_id` INT NOT NULL AUTO_INCREMENT,
  `chat_id` INT NOT NULL,
  `colaborador_id` INT NOT NULL,
  `observacoes` TEXT NULL,
  `data_finalizacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_finalizacao_id`),
  UNIQUE INDEX `uk_chat_finalizacao_chat` (`chat_id`),
  INDEX `idx_chat_finalizacao_colaborador` (`colaborador_id`),
  CONSTRAINT `fk_chat_finalizacao_chat`
    FOREIGN KEY (`chat_id`)
    REFERENCES `chat` (`chat_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_finalizacao_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Encerramento do chat. 1:1 com chat. Removido chat_cliente_id redundante.';

CREATE TABLE `chat_avaliacao_colaborador` (
  `chat_avaliacao_colaborador_id` INT NOT NULL AUTO_INCREMENT,
  `chat_id` INT NOT NULL,
  `cliente_id` INT NOT NULL,
  `colaborador_id` INT NOT NULL,
  `nota` DECIMAL(2,1) NOT NULL,
  `sugestao` TEXT NULL,
  `data_criacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`chat_avaliacao_colaborador_id`),
  UNIQUE INDEX `uk_chat_avaliacao` (`chat_id`, `colaborador_id`),
  INDEX `idx_chat_avaliacao_cliente` (`cliente_id`),
  INDEX `idx_chat_avaliacao_colaborador` (`colaborador_id`),
  CONSTRAINT `chk_chat_avaliacao_nota`
    CHECK (`nota` >= 0 AND `nota` <= 5),
  CONSTRAINT `fk_chat_avaliacao_chat`
    FOREIGN KEY (`chat_id`)
    REFERENCES `chat` (`chat_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_avaliacao_cliente`
    FOREIGN KEY (`cliente_id`)
    REFERENCES `cliente` (`cliente_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT `fk_chat_avaliacao_colaborador`
    FOREIGN KEY (`colaborador_id`)
    REFERENCES `colaborador` (`colaborador_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Avaliação do atendimento via chat. chat_id era ausente no modelo antigo.';

-- -----------------------------------------------------------------------------
-- 12. LGPD e auditoria. Não gravar senha_hash nem segredo de gateway no JSON.
-- EXCLUSAO de titular no SaaS = anonimização (RESTRICT impede apagar fatos).
-- -----------------------------------------------------------------------------

CREATE TABLE `solicitacao_titular` (
  `solicitacao_titular_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NULL COMMENT 'NULL = pedido à plataforma (cadastro global do tutor).',
  `titular_tipo` VARCHAR(30) NOT NULL,
  `titular_id` INT NOT NULL,
  `tipo_solicitacao` VARCHAR(40) NOT NULL,
  `status_solicitacao` VARCHAR(20) NOT NULL,
  `detalhamento` TEXT NULL,
  `motivo_negativa` TEXT NULL,
  `data_solicitacao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `data_conclusao` DATETIME NULL,
  PRIMARY KEY (`solicitacao_titular_id`),
  INDEX `idx_solicitacao_titular_empresa` (`empresa_id`, `status_solicitacao`),
  INDEX `idx_solicitacao_titular_pessoa` (`titular_tipo`, `titular_id`, `data_solicitacao`),
  CONSTRAINT `chk_solicitacao_titular_tipo_pessoa`
    CHECK (`titular_tipo` IN ('CLIENTE', 'COLABORADOR', 'ADMINISTRADOR_SISTEMA')),
  CONSTRAINT `chk_solicitacao_titular_tipo`
    CHECK (`tipo_solicitacao` IN (
      'ACESSO',
      'CORRECAO',
      'ANONIMIZACAO',
      'EXCLUSAO',
      'PORTABILIDADE',
      'REVOGACAO_CONSENTIMENTO'
    )),
  CONSTRAINT `chk_solicitacao_titular_status`
    CHECK (`status_solicitacao` IN ('ABERTA', 'EM_ANDAMENTO', 'CONCLUIDA', 'NEGADA')),
  CONSTRAINT `chk_solicitacao_titular_conclusao`
    CHECK (
      (`status_solicitacao` IN ('ABERTA', 'EM_ANDAMENTO') AND `data_conclusao` IS NULL)
      OR (`status_solicitacao` IN ('CONCLUIDA', 'NEGADA') AND `data_conclusao` IS NOT NULL)
    ),
  CONSTRAINT `fk_solicitacao_titular_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Pedido LGPD do titular. EXCLUSAO é atendida por anonimização, não por DELETE físico.';

CREATE TABLE `auditoria_acao` (
  `auditoria_acao_id` INT NOT NULL AUTO_INCREMENT,
  `empresa_id` INT NULL COMMENT 'NULL quando a ação é do administrador do SaaS sem tenant.',
  `ator_tipo` VARCHAR(30) NOT NULL,
  `ator_id` INT NOT NULL COMMENT 'ID em cliente, colaborador ou administrador_sistema, conforme ator_tipo.',
  `pagina` VARCHAR(255) NULL,
  `botao` VARCHAR(120) NULL,
  `detalhamento` TEXT NOT NULL COMMENT 'O que o usuário fez na tela (página, botão, intenção).',
  `endereco_ip` VARCHAR(45) NULL,
  `user_agent` VARCHAR(500) NULL,
  `data_acao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Instante em que a ação foi realizada.',
  `anonimizado_em` DATETIME NULL COMMENT 'Único UPDATE permitido: redigir IP/UA/detalhe identificável.',
  PRIMARY KEY (`auditoria_acao_id`),
  INDEX `idx_auditoria_acao_empresa_data` (`empresa_id`, `data_acao`),
  INDEX `idx_auditoria_acao_ator_data` (`ator_tipo`, `ator_id`, `data_acao`),
  CONSTRAINT `chk_auditoria_acao_ator`
    CHECK (`ator_tipo` IN ('CLIENTE', 'COLABORADOR', 'ADMINISTRADOR_SISTEMA')),
  CONSTRAINT `fk_auditoria_acao_empresa`
    FOREIGN KEY (`empresa_id`)
    REFERENCES `empresa` (`empresa_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Clique/ação de tela. DELETE proibido. UPDATE só para anonimizar.';

CREATE TABLE `auditoria_dado` (
  `auditoria_dado_id` INT NOT NULL AUTO_INCREMENT,
  `auditoria_acao_id` INT NULL COMMENT 'NULL = alteração sem clique (job, script, SQL direto).',
  `operacao` VARCHAR(10) NOT NULL,
  `tabela` VARCHAR(64) NOT NULL,
  `registro_id` INT NOT NULL,
  `dados_anteriores` JSON NULL COMMENT 'Estado antes. NULL em INSERT. Após anonimizar: JSON redigido.',
  `dados_novos` JSON NULL COMMENT 'Estado depois. NULL em DELETE. Após anonimizar: JSON redigido.',
  `data_acao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Instante do INSERT/UPDATE/DELETE.',
  `anonimizado_em` DATETIME NULL,
  PRIMARY KEY (`auditoria_dado_id`),
  INDEX `idx_auditoria_dado_acao` (`auditoria_acao_id`),
  INDEX `idx_auditoria_dado_tabela_registro` (`tabela`, `registro_id`),
  INDEX `idx_auditoria_dado_operacao_data` (`operacao`, `data_acao`),
  CONSTRAINT `chk_auditoria_dado_operacao`
    CHECK (`operacao` IN ('INSERT', 'UPDATE', 'DELETE')),
  CONSTRAINT `chk_auditoria_dado_json`
    CHECK (
      (`operacao` = 'INSERT' AND `dados_anteriores` IS NULL AND `dados_novos` IS NOT NULL)
      OR (`operacao` = 'DELETE' AND `dados_anteriores` IS NOT NULL AND `dados_novos` IS NULL)
      OR (`operacao` = 'UPDATE' AND `dados_anteriores` IS NOT NULL AND `dados_novos` IS NOT NULL)
    ),
  CONSTRAINT `fk_auditoria_dado_acao`
    FOREIGN KEY (`auditoria_acao_id`)
    REFERENCES `auditoria_acao` (`auditoria_acao_id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='DML da ação. DELETE proibido. UPDATE só para redigir JSON na anonimização.';

DELIMITER $$

CREATE TRIGGER `trg_auditoria_acao_bloquear_update`
BEFORE UPDATE ON `auditoria_acao`
FOR EACH ROW
BEGIN
  IF OLD.`anonimizado_em` IS NOT NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'auditoria_acao ja anonimizada: UPDATE proibido.';
  END IF;
  IF NEW.`anonimizado_em` IS NULL
     OR NEW.`auditoria_acao_id` <> OLD.`auditoria_acao_id`
     OR NOT (NEW.`empresa_id` <=> OLD.`empresa_id`)
     OR NEW.`ator_tipo` <> OLD.`ator_tipo`
     OR NEW.`ator_id` <> OLD.`ator_id`
     OR NOT (NEW.`pagina` <=> OLD.`pagina`)
     OR NOT (NEW.`botao` <=> OLD.`botao`)
     OR NEW.`data_acao` <> OLD.`data_acao`
     OR NEW.`endereco_ip` IS NOT NULL
     OR NEW.`user_agent` IS NOT NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'auditoria_acao: UPDATE so para anonimizar (limpar IP/UA e marcar anonimizado_em).';
  END IF;
END$$

CREATE TRIGGER `trg_auditoria_acao_bloquear_delete`
BEFORE DELETE ON `auditoria_acao`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'auditoria_acao: DELETE proibido. Use anonimização.';
END$$

CREATE TRIGGER `trg_auditoria_dado_bloquear_update`
BEFORE UPDATE ON `auditoria_dado`
FOR EACH ROW
BEGIN
  IF OLD.`anonimizado_em` IS NOT NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'auditoria_dado ja anonimizada: UPDATE proibido.';
  END IF;
  IF NEW.`anonimizado_em` IS NULL
     OR NEW.`auditoria_dado_id` <> OLD.`auditoria_dado_id`
     OR NOT (NEW.`auditoria_acao_id` <=> OLD.`auditoria_acao_id`)
     OR NEW.`operacao` <> OLD.`operacao`
     OR NEW.`tabela` <> OLD.`tabela`
     OR NEW.`registro_id` <> OLD.`registro_id`
     OR NEW.`data_acao` <> OLD.`data_acao` THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'auditoria_dado: UPDATE so para redigir JSON e marcar anonimizado_em.';
  END IF;
END$$

CREATE TRIGGER `trg_auditoria_dado_bloquear_delete`
BEFORE DELETE ON `auditoria_dado`
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'auditoria_dado: DELETE proibido. Use anonimização.';
END$$

DELIMITER ;

SET SQL_MODE = @OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS = @OLD_UNIQUE_CHECKS;
