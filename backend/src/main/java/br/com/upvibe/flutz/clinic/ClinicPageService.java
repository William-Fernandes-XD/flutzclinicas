package br.com.upvibe.flutz.clinic;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.domain.Empresa;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class ClinicPageService {

    private static final List<String> TIPOS = List.of(
            "HERO", "SOBRE", "SERVICOS", "ESPECIALIDADE", "EQUIPE",
            "AVALIACOES", "GALERIA", "LOCALIZACAO", "CONTATO", "DOACOES"
    );

    private final JdbcTemplate jdbc;
    private final ClinicService clinic;

    public ClinicPageService(JdbcTemplate jdbc, ClinicService clinic) {
        this.jdbc = jdbc;
        this.clinic = clinic;
    }

    public Editor carregar() {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        garantirSecoes(empresa.getId(), permiteDoacoes(empresa.getId()));
        return montar(empresa.getId(), true);
    }

    public PublicaClinica publica(String slug) {
        Integer empresaId = jdbc.query(
                "SELECT empresa_id FROM flutz.empresa WHERE LOWER(identificador_url) = LOWER(?)",
                rs -> rs.next() ? rs.getInt(1) : null,
                slug
        );
        if (empresaId == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Clínica não encontrada");
        }
        return toPublica(montar(empresaId, false));
    }

    @Transactional
    public void salvarLayout(List<Secao> secoes) {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        if (secoes == null || secoes.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe as seções");
        }
        boolean doacoes = permiteDoacoes(empresa.getId());
        for (Secao secao : secoes) {
            String tipo = secao.tipo() == null ? "" : secao.tipo().toUpperCase(Locale.ROOT);
            if (!TIPOS.contains(tipo)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Seção inválida");
            }
            boolean visivel = secao.visivel() && (!"DOACOES".equals(tipo) || doacoes);
            int ordem = secao.ordem() < 1 ? 1 : secao.ordem();
            jdbc.update(
                    """
                    INSERT INTO flutz.pagina_secao (empresa_id, tipo_secao, ordem, visivel)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (empresa_id, tipo_secao)
                    DO UPDATE SET visivel = EXCLUDED.visivel, ordem = EXCLUDED.ordem
                    """,
                    empresa.getId(), tipo, ordem, visivel
            );
        }
    }

    @Transactional
    public void salvarHero(HeroReq req) {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        if (req == null || req.titulo() == null || req.titulo().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o título da hero");
        }
        jdbc.update(
                """
                INSERT INTO flutz.hero_section (
                    empresa_id, titulo, subtitulo, texto_resumo, imagem_fundo_url, imagem_posicao_id,
                    cor_fundo, usar_imagem_fundo, mostrar_imagem_lateral
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (empresa_id)
                DO UPDATE SET
                    titulo = EXCLUDED.titulo,
                    subtitulo = EXCLUDED.subtitulo,
                    texto_resumo = EXCLUDED.texto_resumo,
                    imagem_fundo_url = COALESCE(EXCLUDED.imagem_fundo_url, hero_section.imagem_fundo_url),
                    imagem_posicao_id = COALESCE(EXCLUDED.imagem_posicao_id, hero_section.imagem_posicao_id),
                    cor_fundo = EXCLUDED.cor_fundo,
                    usar_imagem_fundo = EXCLUDED.usar_imagem_fundo,
                    mostrar_imagem_lateral = EXCLUDED.mostrar_imagem_lateral
                """,
                empresa.getId(),
                req.titulo().trim(),
                blank(req.subtitulo()),
                blank(req.texto()),
                blank(req.imagemFundoUrl()),
                req.imagemPosicaoId(),
                blank(req.corFundo()),
                req.usarImagemFundo() != null && req.usarImagemFundo(),
                req.mostrarImagemLateral() == null || req.mostrarImagemLateral()
        );
        Integer heroId = jdbc.queryForObject(
                "SELECT hero_section_id FROM flutz.hero_section WHERE empresa_id = ?",
                Integer.class,
                empresa.getId()
        );
        if (req.topicos() != null) {
            jdbc.update("DELETE FROM flutz.hero_section_topico WHERE hero_section_id = ?", heroId);
            int ordem = 1;
            for (TopicoReq topico : req.topicos()) {
                if (topico.titulo() == null || topico.titulo().isBlank()) {
                    continue;
                }
                jdbc.update(
                        """
                        INSERT INTO flutz.hero_section_topico (hero_section_id, titulo_topico, texto_topico, icone_url, ordem)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        heroId,
                        topico.titulo().trim(),
                        blank(topico.texto()),
                        blank(topico.iconeUrl()),
                        ordem++
                );
            }
        }
    }

    @Transactional
    public void salvarEndereco(Endereco req) {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        String uf = blank(req.uf());
        if (uf != null && uf.length() != 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "UF deve ter 2 letras");
        }
        if ((req.latitude() == null) != (req.longitude() == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe latitude e longitude juntas");
        }
        if (req.latitude() != null) {
            if (req.latitude().abs().compareTo(BigDecimal.valueOf(90)) > 0
                    || req.longitude().abs().compareTo(BigDecimal.valueOf(180)) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordenada inválida");
            }
        }
        jdbc.update(
                """
                UPDATE flutz.empresa
                SET logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, uf = ?, cep = ?, localizacao_googlemaps_url = ?, latitude = ?, longitude = ?
                WHERE empresa_id = ?
                """,
                blank(req.logradouro()),
                blank(req.numero()),
                blank(req.complemento()),
                blank(req.bairro()),
                blank(req.cidade()),
                uf == null ? null : uf.toUpperCase(Locale.ROOT),
                blank(req.cep()),
                blank(req.mapsUrl()),
                req.latitude(),
                req.longitude(),
                empresa.getId()
        );
    }

    @Transactional
    public void salvarContato(ContatoReq req) {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        if (req.email() == null || req.email().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O e-mail da clínica é obrigatório");
        }
        jdbc.update(
                "UPDATE flutz.empresa SET email = ?, telefone = ? WHERE empresa_id = ?",
                req.email().trim(),
                blank(req.telefone()),
                empresa.getId()
        );
        Integer status = statusAtivo();
        Set<Integer> vistos = new java.util.HashSet<>();
        for (RedeReq rede : req.redes() == null ? List.<RedeReq>of() : req.redes()) {
            if (rede.tipoId() == null || rede.url() == null || rede.url().isBlank()) {
                continue;
            }
            vistos.add(rede.tipoId());
            jdbc.update(
                    """
                    INSERT INTO flutz.rede_social (empresa_id, tipo_redesocial_id, nome_exibicao, url, status_id)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT (empresa_id, tipo_redesocial_id)
                    DO UPDATE SET nome_exibicao = EXCLUDED.nome_exibicao, url = EXCLUDED.url
                    """,
                    empresa.getId(),
                    rede.tipoId(),
                    blank(rede.nome()),
                    rede.url().trim(),
                    status
            );
        }
        List<Integer> atuais = jdbc.query(
                "SELECT tipo_redesocial_id FROM flutz.rede_social WHERE empresa_id = ?",
                (rs, i) -> rs.getInt(1),
                empresa.getId()
        );
        for (Integer tipoId : atuais) {
            if (!vistos.contains(tipoId)) {
                jdbc.update("DELETE FROM flutz.rede_social WHERE empresa_id = ? AND tipo_redesocial_id = ?", empresa.getId(), tipoId);
            }
        }
    }

    @Transactional
    public void salvarVisibilidade(Visibilidade req) {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        String tipo = req.tipo() == null ? "" : req.tipo().toUpperCase(Locale.ROOT);
        switch (tipo) {
            case "SERVICO" -> jdbc.update(
                    "UPDATE flutz.empresa_servico SET visivel_pagina = ? WHERE empresa_servico_id = ? AND empresa_id = ?",
                    req.visivel(), req.id(), empresa.getId()
            );
            case "ESPECIALIDADE" -> jdbc.update(
                    "UPDATE flutz.empresa_especialidade SET visivel_pagina = ? WHERE empresa_especialidade_id = ? AND empresa_id = ?",
                    req.visivel(), req.id(), empresa.getId()
            );
            case "EQUIPE" -> {
                if (req.visivel()) {
                    jdbc.update(
                            """
                            UPDATE flutz.colaborador
                            SET exibir_pagina = TRUE,
                                data_autorizacao_pagina = COALESCE(data_autorizacao_pagina, CURRENT_TIMESTAMP),
                                ordem_pagina = COALESCE(?, ordem_pagina)
                            WHERE colaborador_id = ? AND empresa_id = ?
                            """,
                            req.ordem(), req.id(), empresa.getId()
                    );
                } else {
                    jdbc.update(
                            "UPDATE flutz.colaborador SET exibir_pagina = FALSE WHERE colaborador_id = ? AND empresa_id = ?",
                            req.id(), empresa.getId()
                    );
                }
            }
            case "AVALIACAO" -> {
                if (req.visivel()) {
                    int ok = jdbc.update(
                            """
                            UPDATE flutz.avaliacao_cliente
                            SET visivel = TRUE
                            WHERE avaliacao_cliente_id = ? AND empresa_id = ?
                              AND autorizado_publicacao = TRUE AND data_autorizacao IS NOT NULL
                            """,
                            req.id(), empresa.getId()
                    );
                    if (ok == 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Só avaliações autorizadas pelo tutor podem ficar visíveis");
                    }
                } else {
                    jdbc.update(
                            "UPDATE flutz.avaliacao_cliente SET visivel = FALSE WHERE avaliacao_cliente_id = ? AND empresa_id = ?",
                            req.id(), empresa.getId()
                    );
                }
            }
            case "GALERIA" -> jdbc.update(
                    """
                    UPDATE flutz.galeria_imagem
                    SET visivel = ?, texto_alternativo = COALESCE(?, texto_alternativo), ordem = COALESCE(?, ordem)
                    WHERE galeria_imagem_id = ? AND empresa_id = ?
                    """,
                    req.visivel(), blank(req.texto()), req.ordem(), req.id(), empresa.getId()
            );
            case "DOACAO" -> {
                if (!permiteDoacoes(empresa.getId())) {
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "O plano atual não permite doações");
                }
                jdbc.update(
                        "UPDATE flutz.doacao SET visivel_pagina = ? WHERE doacao_id = ? AND empresa_id = ?",
                        req.visivel(), req.id(), empresa.getId()
                );
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de item inválido");
        }
    }

    @Transactional
    public Item criarDoacao(NovaDoacao req) {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        if (!permiteDoacoes(empresa.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "O plano atual não permite doações");
        }
        if (req.titulo() == null || req.titulo().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o título da campanha");
        }
        Integer status = statusAtivo();
        Integer ordem = jdbc.queryForObject(
                "SELECT COALESCE(MAX(ordem), 0) + 1 FROM flutz.doacao WHERE empresa_id = ?",
                Integer.class,
                empresa.getId()
        );
        Integer id = jdbc.queryForObject(
                """
                INSERT INTO flutz.doacao (empresa_id, titulo, texto, meta_valor, data_inicio, data_fim, ordem, visivel_pagina, status_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)
                RETURNING doacao_id
                """,
                Integer.class,
                empresa.getId(),
                req.titulo().trim(),
                blank(req.texto()),
                req.metaValor(),
                parseDate(req.dataInicio()),
                parseDate(req.dataFim()),
                ordem == null ? 1 : ordem,
                status
        );
        return new Item(id, req.titulo().trim());
    }

    private Editor montar(Integer empresaId, boolean gestao) {
        List<Secao> secoes = jdbc.query(
                "SELECT tipo_secao, ordem, visivel FROM flutz.pagina_secao WHERE empresa_id = ? ORDER BY ordem, tipo_secao",
                (rs, i) -> new Secao(rs.getString("tipo_secao"), rs.getInt("ordem"), rs.getBoolean("visivel")),
                empresaId
        );
        Identidade identidade = jdbc.query(
                """
                SELECT nome_empresa, identificador_url, logo_url, descricao_empresa, email, telefone, empresa_id
                FROM flutz.empresa WHERE empresa_id = ?
                """,
                rs -> rs.next()
                        ? new Identidade(
                                rs.getInt("empresa_id"),
                                rs.getString("nome_empresa"),
                                rs.getString("identificador_url"),
                                rs.getString("logo_url"),
                                rs.getString("descricao_empresa"),
                                rs.getString("email"),
                                rs.getString("telefone")
                        )
                        : null,
                empresaId
        );
        Endereco endereco = jdbc.query(
                """
                SELECT logradouro, numero, complemento, bairro, cidade, uf, cep, localizacao_googlemaps_url, latitude, longitude
                FROM flutz.empresa WHERE empresa_id = ?
                """,
                rs -> rs.next()
                        ? new Endereco(
                                rs.getString("logradouro"),
                                rs.getString("numero"),
                                rs.getString("complemento"),
                                rs.getString("bairro"),
                                rs.getString("cidade"),
                                rs.getString("uf"),
                                rs.getString("cep"),
                                rs.getString("localizacao_googlemaps_url"),
                                rs.getObject("latitude", BigDecimal.class),
                                rs.getObject("longitude", BigDecimal.class)
                        )
                        : new Endereco(null, null, null, null, null, null, null, null, null, null),
                empresaId
        );
        Hero hero = jdbc.query(
                """
                SELECT h.hero_section_id, h.titulo, h.subtitulo, h.texto_resumo, h.imagem_fundo_url,
                       h.imagem_posicao_id, p.posicao,
                       h.cor_fundo, h.usar_imagem_fundo, h.mostrar_imagem_lateral
                FROM flutz.hero_section h
                LEFT JOIN flutz.imagem_posicao p ON p.imagem_posicao_id = h.imagem_posicao_id
                WHERE h.empresa_id = ?
                """,
                rs -> rs.next()
                        ? new Hero(
                                rs.getString("titulo"),
                                rs.getString("subtitulo"),
                                rs.getString("texto_resumo"),
                                rs.getString("imagem_fundo_url"),
                                (Integer) rs.getObject("imagem_posicao_id"),
                                rs.getString("posicao"),
                                rs.getString("cor_fundo"),
                                rs.getBoolean("usar_imagem_fundo"),
                                rs.getBoolean("mostrar_imagem_lateral"),
                                topicos(rs.getInt("hero_section_id"))
                        )
                        : null,
                empresaId
        );
        List<ItemVisivel> servicos = jdbc.query(
                """
                SELECT es.empresa_servico_id, COALESCE(NULLIF(es.nome_exibicao, ''), ts.tipo_servico),
                       es.preco, es.visivel_pagina, es.descricao, ts.icone
                FROM flutz.empresa_servico es
                JOIN flutz.tipo_servico ts ON ts.tipo_servico_id = es.tipo_servico_id
                WHERE es.empresa_id = ?
                ORDER BY es.ordem
                """,
                (rs, i) -> new ItemVisivel(
                        rs.getInt(1), rs.getString(2), rs.getBigDecimal(3), rs.getBoolean(4), null,
                        rs.getString(5), null, null, rs.getString(6)
                ),
                empresaId
        );
        List<Item> vacinas = jdbc.query(
                """
                SELECT ev.empresa_vacina_id, v.nome_vacina
                FROM flutz.empresa_vacina ev
                JOIN flutz.vacina v ON v.vacina_id = ev.vacina_id
                JOIN flutz.status s ON s.status_id = ev.status_id
                WHERE ev.empresa_id = ? AND LOWER(s.descricao) = 'ativo'
                ORDER BY v.nome_vacina
                """,
                (rs, i) -> new Item(rs.getInt(1), rs.getString(2)),
                empresaId
        );
        List<ItemVisivel> especialidades = jdbc.query(
                """
                SELECT ee.empresa_especialidade_id, e.descricao, NULL, ee.visivel_pagina
                FROM flutz.empresa_especialidade ee
                JOIN flutz.especialidade e ON e.especialidade_id = ee.especialidade_id
                WHERE ee.empresa_id = ?
                ORDER BY ee.ordem, e.descricao
                """,
                (rs, i) -> new ItemVisivel(rs.getInt(1), rs.getString(2), null, rs.getBoolean(4), null, null, null, null, null),
                empresaId
        );
        List<ItemVisivel> equipe = jdbc.query(
                """
                SELECT colaborador_id, nome_colaborador, exibir_pagina,
                       CASE WHEN data_autorizacao_pagina IS NULL THEN FALSE ELSE TRUE END,
                       cargo, imagem_url
                FROM flutz.colaborador
                WHERE empresa_id = ?
                ORDER BY ordem_pagina NULLS LAST, nome_colaborador
                """,
                (rs, i) -> new ItemVisivel(
                        rs.getInt(1), rs.getString(2), null, rs.getBoolean(3), rs.getBoolean(4),
                        null, rs.getString(5), rs.getString(6), null
                ),
                empresaId
        );
        List<Avaliacao> avaliacoes = jdbc.query(
                """
                SELECT avaliacao_cliente_id, nome_cliente, nome_pet, texto, nota, visivel, autorizado_publicacao
                FROM flutz.avaliacao_cliente
                WHERE empresa_id = ?
                ORDER BY data_avaliacao DESC
                """,
                (rs, i) -> new Avaliacao(
                        rs.getInt(1),
                        rs.getString(2),
                        rs.getString(3),
                        rs.getString(4),
                        rs.getBigDecimal(5),
                        rs.getBoolean(6),
                        rs.getBoolean(7)
                ),
                empresaId
        );
        List<GaleriaItem> galeria = jdbc.query(
                """
                SELECT galeria_imagem_id, imagem_url, texto_alternativo, ordem, visivel
                FROM flutz.galeria_imagem
                WHERE empresa_id = ?
                ORDER BY ordem
                """,
                (rs, i) -> new GaleriaItem(rs.getInt(1), rs.getString(2), rs.getString(3), rs.getInt(4), rs.getBoolean(5)),
                empresaId
        );
        List<Doacao> doacoes = jdbc.query(
                """
                SELECT doacao_id, titulo, texto, meta_valor, data_inicio, data_fim, visivel_pagina
                FROM flutz.doacao
                WHERE empresa_id = ?
                ORDER BY ordem
                """,
                (rs, i) -> new Doacao(
                        rs.getInt(1),
                        rs.getString(2),
                        rs.getString(3),
                        rs.getBigDecimal(4),
                        rs.getObject(5) == null ? null : rs.getDate(5).toLocalDate().toString(),
                        rs.getObject(6) == null ? null : rs.getDate(6).toLocalDate().toString(),
                        rs.getBoolean(7)
                ),
                empresaId
        );
        List<Rede> redes = jdbc.query(
                """
                SELECT r.tipo_redesocial_id, COALESCE(r.nome_exibicao, t.descricao), r.url
                FROM flutz.rede_social r
                JOIN flutz.tipo_redesocial t ON t.tipo_redesocial_id = r.tipo_redesocial_id
                WHERE r.empresa_id = ?
                """,
                (rs, i) -> new Rede(rs.getInt(1), rs.getString(2), rs.getString(3)),
                empresaId
        );
        List<Item> posicoes = gestao ? jdbc.query(
                "SELECT imagem_posicao_id, posicao FROM flutz.imagem_posicao ORDER BY imagem_posicao_id",
                (rs, i) -> new Item(rs.getInt(1), rs.getString(2))
        ) : List.of();
        List<Item> tiposRede = gestao ? jdbc.query(
                "SELECT tipo_redesocial_id, descricao FROM flutz.tipo_redesocial ORDER BY descricao",
                (rs, i) -> new Item(rs.getInt(1), rs.getString(2))
        ) : List.of();
        return new Editor(
                secoes,
                identidade,
                endereco,
                hero,
                servicos,
                especialidades,
                equipe,
                gestao ? avaliacoes : avaliacoes.stream().filter(item -> item.visivel() && item.autorizado()).toList(),
                gestao ? galeria : galeria.stream().filter(GaleriaItem::visivel).toList(),
                gestao ? doacoes : doacoes.stream().filter(Doacao::visivelPagina).toList(),
                redes,
                posicoes,
                tiposRede,
                permiteDoacoes(empresaId),
                vacinas
        );
    }

    private List<Topico> topicos(Integer heroId) {
        return jdbc.query(
                """
                SELECT hero_section_topico_id, titulo_topico, texto_topico, icone_url, ordem
                FROM flutz.hero_section_topico
                WHERE hero_section_id = ?
                ORDER BY ordem
                """,
                (rs, i) -> new Topico(rs.getInt(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5)),
                heroId
        );
    }

    private PublicaClinica toPublica(Editor editor) {
        return new PublicaClinica(
                editor.identidade(),
                editor.endereco(),
                editor.secoes(),
                editor.hero(),
                editor.servicos().stream()
                        .filter(ItemVisivel::visivel)
                        .filter(item -> !isServicoVacinacao(item))
                        .toList(),
                editor.equipe().stream()
                        .filter(item -> item.visivel() && Boolean.TRUE.equals(item.autorizado()))
                        .map(item -> new MembroPublico(item.nome(), item.cargo(), item.fotoUrl()))
                        .toList(),
                editor.especialidades().stream().filter(ItemVisivel::visivel).map(ItemVisivel::nome).toList(),
                editor.avaliacoes(),
                editor.galeria(),
                editor.redes(),
                editor.doacoes(),
                editor.vacinas()
        );
    }

    /** Serviços puramente de vacinação ficam fora da grade pública — vão no card/modal de vacinas. */
    private static boolean isServicoVacinacao(ItemVisivel item) {
        String icone = item.icone() == null ? "" : item.icone().toLowerCase(Locale.ROOT);
        String nome = item.nome() == null ? "" : item.nome().toLowerCase(Locale.ROOT);
        return "vacinacao".equals(icone)
                || nome.contains("vacin")
                || nome.contains("imuniz");
    }

    private void garantirSecoes(Integer empresaId, boolean doacoes) {
        for (int i = 0; i < TIPOS.size(); i++) {
            boolean visivel = !"DOACOES".equals(TIPOS.get(i)) || doacoes;
            jdbc.update(
                    """
                    INSERT INTO flutz.pagina_secao (empresa_id, tipo_secao, ordem, visivel)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (empresa_id, tipo_secao) DO NOTHING
                    """,
                    empresaId, TIPOS.get(i), i + 1, visivel
            );
        }
    }

    private boolean permiteDoacoes(Integer empresaId) {
        Boolean ok = jdbc.query(
                """
                SELECT p.permite_doacoes
                FROM flutz.assinatura a
                JOIN flutz.plano p ON p.plano_id = a.plano_id
                WHERE a.empresa_id = ?
                ORDER BY a.assinatura_id DESC
                LIMIT 1
                """,
                rs -> rs.next() ? rs.getBoolean(1) : Boolean.FALSE,
                empresaId
        );
        return Boolean.TRUE.equals(ok);
    }

    private Integer statusAtivo() {
        return jdbc.queryForObject(
                "SELECT status_id FROM flutz.status WHERE LOWER(descricao) = 'ativo'",
                Integer.class
        );
    }

    private void exigirGestao() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.adminPlataforma() || (auth.colaborador() && auth.temPapel("administrador"))) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a administração da clínica");
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static LocalDate parseDate(String value) {
        return value == null || value.isBlank() ? null : LocalDate.parse(value);
    }

    public record Secao(String tipo, int ordem, boolean visivel) {
    }

    public record Topico(Integer id, String titulo, String texto, String iconeUrl, int ordem) {
    }

    public record TopicoReq(String titulo, String texto, String iconeUrl) {
    }

    public record Hero(
            String titulo,
            String subtitulo,
            String texto,
            String imagemFundoUrl,
            Integer imagemPosicaoId,
            String posicao,
            String corFundo,
            boolean usarImagemFundo,
            boolean mostrarImagemLateral,
            List<Topico> topicos
    ) {
    }

    public record HeroReq(
            String titulo,
            String subtitulo,
            String texto,
            String imagemFundoUrl,
            Integer imagemPosicaoId,
            String corFundo,
            Boolean usarImagemFundo,
            Boolean mostrarImagemLateral,
            List<TopicoReq> topicos
    ) {
    }

    public record Identidade(Integer id, String nome, String slug, String logoUrl, String sobre, String email, String telefone) {
    }

    public record Endereco(
            String logradouro, String numero, String complemento, String bairro,
            String cidade, String uf, String cep, String mapsUrl,
            BigDecimal latitude, BigDecimal longitude
    ) {
    }

    public record ContatoReq(String email, String telefone, List<RedeReq> redes) {
    }

    public record RedeReq(Integer tipoId, String nome, String url) {
    }

    public record Rede(Integer tipoId, String nome, String url) {
    }

    public record Item(Integer id, String nome) {
    }

    public record ItemVisivel(
            Integer id,
            String nome,
            BigDecimal preco,
            boolean visivel,
            Boolean autorizado,
            String texto,
            String cargo,
            String fotoUrl,
            String icone
    ) {
    }

    public record MembroPublico(String nome, String cargo, String fotoUrl) {
    }

    public record Avaliacao(Integer id, String tutor, String pet, String texto, BigDecimal nota, boolean visivel, boolean autorizado) {
    }

    public record GaleriaItem(Integer id, String url, String alt, int ordem, boolean visivel) {
    }

    public record Doacao(Integer id, String titulo, String texto, BigDecimal metaValor, String dataInicio, String dataFim, boolean visivelPagina) {
    }

    public record NovaDoacao(String titulo, String texto, BigDecimal metaValor, String dataInicio, String dataFim) {
    }

    public record Visibilidade(String tipo, Integer id, boolean visivel, Integer ordem, String texto) {
    }

    public record Editor(
            List<Secao> secoes,
            Identidade identidade,
            Endereco endereco,
            Hero hero,
            List<ItemVisivel> servicos,
            List<ItemVisivel> especialidades,
            List<ItemVisivel> equipe,
            List<Avaliacao> avaliacoes,
            List<GaleriaItem> galeria,
            List<Doacao> doacoes,
            List<Rede> redes,
            List<Item> posicoes,
            List<Item> tiposRede,
            boolean permiteDoacoes,
            List<Item> vacinas
    ) {
    }

    public record PublicaClinica(
            Identidade clinica,
            Endereco endereco,
            List<Secao> secoes,
            Hero hero,
            List<ItemVisivel> servicos,
            List<MembroPublico> equipe,
            List<String> especialidades,
            List<Avaliacao> avaliacoes,
            List<GaleriaItem> galeria,
            List<Rede> redes,
            List<Doacao> doacoes,
            List<Item> vacinas
    ) {
    }
}
