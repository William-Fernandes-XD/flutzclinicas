package br.com.upvibe.flutz.clinic;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.domain.Empresa;
import br.com.upvibe.flutz.domain.EmpresaClienteRepository;
import br.com.upvibe.flutz.domain.EmpresaRepository;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class ClinicOpsService {

    private final JdbcTemplate jdbc;
    private final EmpresaRepository empresas;
    private final EmpresaClienteRepository vinculos;
    private final ClinicService clinic;
    private final ClinicMediaService media;
    private final NotificationService notifications;

    public ClinicOpsService(
            JdbcTemplate jdbc,
            EmpresaRepository empresas,
            EmpresaClienteRepository vinculos,
            ClinicService clinic,
            ClinicMediaService media,
            NotificationService notifications
    ) {
        this.jdbc = jdbc;
        this.empresas = empresas;
        this.vinculos = vinculos;
        this.clinic = clinic;
        this.media = media;
        this.notifications = notifications;
    }

    public AuthPrincipal aplicarContexto(Integer empresaId) {
        AuthPrincipal atual = AuthHolder.current();
        if (empresaId == null) {
            if (atual.colaborador()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O colaborador permanece na própria clínica");
            }
            return new AuthPrincipal(atual.tipo(), atual.atorId(), null, atual.nome(), atual.identificador(), atual.papeis());
        }
        Empresa empresa = empresas.findById(empresaId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Clínica não encontrada"));
        if (atual.adminPlataforma()) {
            return new AuthPrincipal(atual.tipo(), atual.atorId(), empresa.getId(), atual.nome(), atual.identificador(), atual.papeis());
        }
        if (atual.tutor()) {
            if (!vinculos.existsByEmpresaIdAndClienteId(empresa.getId(), atual.atorId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem vínculo com esta clínica");
            }
            return new AuthPrincipal(atual.tipo(), atual.atorId(), empresa.getId(), atual.nome(), atual.identificador(), atual.papeis());
        }
        if (atual.colaborador() && !empresa.getId().equals(atual.empresaId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Colaborador não troca de clínica");
        }
        return atual;
    }

    public ClinicaContexto contextoAtual() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.empresaId() == null) {
            return null;
        }
        return branding(auth.empresaId());
    }

    public ClinicaContexto branding(Integer empresaId) {
        return jdbc.query(
                """
                SELECT empresa_id, nome_empresa, identificador_url, logo_url, cidade, uf, descricao_empresa, email, telefone
                FROM flutz.empresa WHERE empresa_id = ?
                """,
                rs -> rs.next()
                        ? new ClinicaContexto(
                        rs.getInt("empresa_id"),
                        rs.getString("nome_empresa"),
                        rs.getString("identificador_url"),
                        rs.getString("logo_url"),
                        rs.getString("cidade"),
                        rs.getString("uf"),
                        rs.getString("descricao_empresa"),
                        rs.getString("email"),
                        rs.getString("telefone")
                )
                        : null,
                empresaId
        );
    }

    public List<ClinicaTutor> clinicasTutor() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor");
        }
        return jdbc.query(
                """
                SELECT e.empresa_id, e.nome_empresa, e.identificador_url, e.logo_url, e.cidade, e.uf,
                       (SELECT COUNT(*) FROM (
                            SELECT a.pet_id FROM flutz.atendimento a
                             WHERE a.empresa_id = e.empresa_id AND a.cliente_id = ?
                            UNION
                            SELECT g.pet_id FROM flutz.agendamento g
                             WHERE g.empresa_id = e.empresa_id AND g.cliente_id = ?
                        ) pets_clinica) AS pets,
                       (SELECT COUNT(*) FROM flutz.atendimento a WHERE a.empresa_id = e.empresa_id AND a.cliente_id = ?) AS atendimentos,
                       (SELECT MAX(a.data_inicio) FROM flutz.atendimento a WHERE a.empresa_id = e.empresa_id AND a.cliente_id = ?) AS ultimo,
                       (SELECT MIN(g.data_hora_inicio) FROM flutz.agendamento g
                         JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                        WHERE g.empresa_id = e.empresa_id AND g.cliente_id = ?
                          AND st.codigo IN ('SOLICITADO', 'CONFIRMADO')
                          AND g.data_hora_inicio >= CURRENT_TIMESTAMP) AS proximo
                FROM flutz.empresa_cliente ec
                JOIN flutz.empresa e ON e.empresa_id = ec.empresa_id
                WHERE ec.cliente_id = ?
                ORDER BY e.nome_empresa
                """,
                (rs, i) -> new ClinicaTutor(
                        rs.getInt("empresa_id"),
                        rs.getString("nome_empresa"),
                        rs.getString("identificador_url"),
                        rs.getString("logo_url"),
                        rs.getString("cidade"),
                        rs.getString("uf"),
                        rs.getLong("pets"),
                        rs.getLong("atendimentos"),
                        rs.getTimestamp("ultimo") == null ? null : rs.getTimestamp("ultimo").toInstant().toString(),
                        rs.getTimestamp("proximo") == null ? null : rs.getTimestamp("proximo").toInstant().toString()
                ),
                auth.atorId(), auth.atorId(), auth.atorId(), auth.atorId(), auth.atorId(), auth.atorId()
        );
    }

    private void exigirEquipe() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Área da equipe da clínica");
        }
    }

    private boolean clinicaVePet(Integer empresaId, Integer petId, Integer clienteId) {
        Long n = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM (
                    SELECT 1 FROM flutz.agendamento WHERE empresa_id = ? AND pet_id = ?
                    UNION ALL
                    SELECT 1 FROM flutz.atendimento WHERE empresa_id = ? AND pet_id = ?
                    UNION ALL
                    SELECT 1 FROM flutz.empresa_cliente WHERE empresa_id = ? AND cliente_id = ?
                ) x
                """,
                Long.class,
                empresaId, petId, empresaId, petId, empresaId, clienteId
        );
        return n != null && n > 0;
    }

    public IndicadoresClinica indicadores() {
        exigirEquipe();
        Empresa empresa = clinic.empresaAtual();
        Integer id = empresa.getId();
        return new IndicadoresClinica(
                count("SELECT COUNT(*) FROM flutz.atendimento WHERE empresa_id = ? AND data_inicio::date = CURRENT_DATE", id),
                count("SELECT COUNT(*) FROM flutz.atendimento a JOIN flutz.atendimento_status s ON s.atendimento_status_id = a.atendimento_status_id WHERE a.empresa_id = ? AND LOWER(s.descricao) = 'em andamento'", id),
                count("SELECT COUNT(*) FROM flutz.atendimento a JOIN flutz.atendimento_status s ON s.atendimento_status_id = a.atendimento_status_id WHERE a.empresa_id = ? AND LOWER(s.descricao) = 'concluido' AND a.data_inicio::date = CURRENT_DATE", id),
                count("SELECT COUNT(*) FROM flutz.agendamento WHERE empresa_id = ? AND data_hora_inicio::date = CURRENT_DATE", id),
                count("SELECT COUNT(*) FROM flutz.agendamento WHERE empresa_id = ? AND data_hora_inicio::date = CURRENT_DATE + 1", id),
                count("SELECT COUNT(*) FROM flutz.agendamento g JOIN flutz.agendamento_status s ON s.agendamento_status_id = g.agendamento_status_id WHERE g.empresa_id = ? AND s.codigo = 'SOLICITADO'", id),
                count("""
                        SELECT COUNT(DISTINCT pet_id) FROM (
                            SELECT pet_id FROM flutz.agendamento WHERE empresa_id = ?
                            UNION
                            SELECT pet_id FROM flutz.atendimento WHERE empresa_id = ?
                        ) x
                        """, id, id),
                count("SELECT COUNT(*) FROM flutz.empresa_cliente WHERE empresa_id = ?", id),
                count("""
                        SELECT COUNT(*) FROM flutz.historico_vacinacao h
                        WHERE h.pet_id IN (
                            SELECT pet_id FROM flutz.agendamento WHERE empresa_id = ?
                            UNION
                            SELECT pet_id FROM flutz.atendimento WHERE empresa_id = ?
                        )
                        """, id, id),
                count("""
                        SELECT COUNT(*) FROM flutz.historico_vacinacao h
                        WHERE h.data_proxima_dose BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
                          AND h.pet_id IN (
                            SELECT pet_id FROM flutz.agendamento WHERE empresa_id = ?
                            UNION
                            SELECT pet_id FROM flutz.atendimento WHERE empresa_id = ?
                        )
                        """, id, id),
                count("""
                        SELECT COUNT(*) FROM flutz.historico_vacinacao h
                        WHERE h.data_proxima_dose < CURRENT_DATE
                          AND h.pet_id IN (
                            SELECT pet_id FROM flutz.agendamento WHERE empresa_id = ?
                            UNION
                            SELECT pet_id FROM flutz.atendimento WHERE empresa_id = ?
                        )
                        """, id, id),
                jdbc.query(
                        """
                        SELECT a.data_inicio::date::text AS rotulo, COUNT(*) AS valor
                        FROM flutz.atendimento a
                        WHERE a.empresa_id = ? AND a.data_inicio::date >= CURRENT_DATE - 14
                        GROUP BY 1 ORDER BY 1
                        """,
                        (rs, i) -> new Ponto(rs.getString("rotulo"), BigDecimal.valueOf(rs.getLong("valor"))),
                        id
                ),
                jdbc.query(
                        """
                        SELECT COALESCE(m.descricao, 'Sem motivo') AS rotulo, COUNT(*) AS valor
                        FROM flutz.chat c
                        LEFT JOIN flutz.chat_motivo m ON m.chat_motivo_id = c.chat_motivo_id
                        WHERE c.empresa_id = ?
                        GROUP BY 1 ORDER BY 2 DESC
                        """,
                        (rs, i) -> new Ponto(rs.getString("rotulo"), BigDecimal.valueOf(rs.getLong("valor"))),
                        id
                ),
                jdbc.query(
                        """
                        SELECT CASE WHEN f.chat_finalizacao_id IS NULL THEN 'Aberto' ELSE 'Encerrado' END AS rotulo,
                               COUNT(*) AS valor
                        FROM flutz.chat c
                        LEFT JOIN flutz.chat_finalizacao f ON f.chat_id = c.chat_id
                        WHERE c.empresa_id = ?
                        GROUP BY 1
                        """,
                        (rs, i) -> new Ponto(rs.getString("rotulo"), BigDecimal.valueOf(rs.getLong("valor"))),
                        id
                ),
                jdbc.query(
                        """
                        SELECT col.nome_colaborador AS rotulo, ROUND(AVG(a.nota), 2) AS valor
                        FROM flutz.chat_avaliacao_colaborador a
                        JOIN flutz.colaborador col ON col.colaborador_id = a.colaborador_id
                        WHERE col.empresa_id = ?
                        GROUP BY col.nome_colaborador
                        ORDER BY valor DESC
                        """,
                        (rs, i) -> new Ponto(rs.getString("rotulo"), rs.getBigDecimal("valor")),
                        id
                )
        );
    }

    public PaginaConsultaPets consultarPets(String nome, String cpfBruto, Integer page, Integer size) {
        AuthPrincipal auth = AuthHolder.current();
        String nomeFiltro = nome == null ? "" : nome.trim();
        String cpf = digits(cpfBruto);
        boolean temNome = !nomeFiltro.isEmpty();
        boolean temCpf = !cpf.isEmpty();
        if (temCpf && cpf.length() != 11) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um CPF válido");
        }
        if (!auth.tutor() && !auth.adminPlataforma() && !(auth.colaborador() && auth.temPapel("administrador"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador consulta pets");
        }

        boolean clinicaListaPadrao = !auth.tutor() && !temNome && !temCpf;
        int pagina = page == null || page < 0 ? 0 : page;
        int tamanho = size == null || size < 1 ? (clinicaListaPadrao ? 10 : 100) : Math.min(size, 100);

        StringBuilder fromWhere = new StringBuilder(
                """
                FROM flutz.pet p
                JOIN flutz.pet_especie es ON es.pet_especie_id = p.pet_especie_id
                LEFT JOIN flutz.pet_raca r ON r.pet_raca_id = p.pet_raca_id
                JOIN flutz.cliente c ON c.cliente_id = p.cliente_id
                WHERE 1=1
                """
        );
        List<Object> args = new ArrayList<>();
        if (auth.tutor()) {
            fromWhere.append(" AND p.cliente_id = ?");
            args.add(auth.atorId());
        } else if (!(auth.adminPlataforma() && auth.empresaId() == null)) {
            if (temCpf) {
                fromWhere.append(" AND regexp_replace(c.cpf, '\\D', '', 'g') = ?");
                args.add(cpf);
            } else {
                Integer empresaId = clinic.empresaAtual().getId();
                if (clinicaListaPadrao) {
                    fromWhere.append(
                            """
                             AND (
                               EXISTS (SELECT 1 FROM flutz.agendamento g WHERE g.empresa_id = ? AND g.pet_id = p.pet_id)
                               OR EXISTS (SELECT 1 FROM flutz.atendimento a WHERE a.empresa_id = ? AND a.pet_id = p.pet_id)
                             )
                            """
                    );
                    args.add(empresaId);
                    args.add(empresaId);
                } else {
                    fromWhere.append(
                            """
                             AND (
                               EXISTS (SELECT 1 FROM flutz.agendamento g WHERE g.empresa_id = ? AND g.pet_id = p.pet_id)
                               OR EXISTS (SELECT 1 FROM flutz.atendimento a WHERE a.empresa_id = ? AND a.pet_id = p.pet_id)
                               OR EXISTS (SELECT 1 FROM flutz.empresa_cliente ec WHERE ec.empresa_id = ? AND ec.cliente_id = p.cliente_id)
                             )
                            """
                    );
                    args.add(empresaId);
                    args.add(empresaId);
                    args.add(empresaId);
                }
            }
        }
        if (temNome) {
            fromWhere.append(" AND LOWER(p.nome_pet) LIKE ?");
            args.add("%" + nomeFiltro.toLowerCase(Locale.ROOT) + "%");
        }
        if (temCpf && (auth.tutor() || (auth.adminPlataforma() && auth.empresaId() == null))) {
            fromWhere.append(" AND regexp_replace(c.cpf, '\\D', '', 'g') = ?");
            args.add(cpf);
        }

        Long total = jdbc.queryForObject(
                "SELECT COUNT(*) " + fromWhere,
                Long.class,
                args.toArray()
        );
        long count = total == null ? 0 : total;

        String select = """
                SELECT p.pet_id, p.nome_pet, p.foto_url, p.sexo, p.data_aniversario,
                       es.descricao AS especie, r.descricao AS raca,
                       c.nome_cliente, c.email,
                       CASE
                         WHEN NOT EXISTS (
                           SELECT 1 FROM flutz.historico_vacinacao h WHERE h.pet_id = p.pet_id
                         ) THEN 'SEM_REGISTRO'
                         WHEN EXISTS (
                           SELECT 1 FROM flutz.historico_vacinacao h
                           WHERE h.pet_id = p.pet_id
                             AND h.data_proxima_dose IS NOT NULL
                             AND h.data_proxima_dose < CURRENT_DATE
                         ) THEN 'ATRASADA'
                         ELSE 'EM_DIA'
                       END AS vacinas_status
                """;
        String sql = select + fromWhere + " ORDER BY p.nome_pet LIMIT ? OFFSET ?";
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(tamanho);
        pageArgs.add(pagina * tamanho);

        List<ConsultaPet> items = jdbc.query(
                sql,
                (rs, i) -> new ConsultaPet(
                        rs.getInt("pet_id"),
                        rs.getString("nome_pet"),
                        rs.getString("foto_url"),
                        rs.getString("sexo"),
                        rs.getString("especie"),
                        rs.getString("raca"),
                        rs.getDate("data_aniversario") == null ? null : rs.getDate("data_aniversario").toLocalDate().toString(),
                        rs.getString("nome_cliente"),
                        rs.getString("email"),
                        rs.getString("vacinas_status")
                ),
                pageArgs.toArray()
        );
        int totalPages = count == 0 ? 1 : (int) Math.ceil(count / (double) tamanho);
        return new PaginaConsultaPets(items, pagina, tamanho, count, totalPages);
    }

    public PetDetalhe pet(Integer petId) {
        AuthPrincipal auth = AuthHolder.current();
        PetDetalhe base = jdbc.query(
                """
                SELECT p.pet_id, p.nome_pet, p.sexo, p.data_aniversario, p.peso, p.foto_url,
                       p.pet_especie_id, es.descricao AS especie,
                       p.pet_raca_id, ra.descricao AS raca,
                       c.cliente_id, c.nome_cliente, p.empresa_id, c.email, c.telefone, c.cpf
                FROM flutz.pet p
                JOIN flutz.pet_especie es ON es.pet_especie_id = p.pet_especie_id
                LEFT JOIN flutz.pet_raca ra ON ra.pet_raca_id = p.pet_raca_id
                JOIN flutz.cliente c ON c.cliente_id = p.cliente_id
                WHERE p.pet_id = ?
                """,
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    return new PetDetalhe(
                            rs.getInt("pet_id"),
                            rs.getString("nome_pet"),
                            rs.getString("sexo"),
                            rs.getDate("data_aniversario") == null ? null : rs.getDate("data_aniversario").toLocalDate().toString(),
                            rs.getBigDecimal("peso"),
                            rs.getInt("pet_especie_id"),
                            rs.getString("especie"),
                            (Integer) rs.getObject("pet_raca_id"),
                            rs.getString("raca"),
                            rs.getInt("cliente_id"),
                            rs.getString("nome_cliente"),
                            (Integer) rs.getObject("empresa_id"),
                            rs.getString("foto_url"),
                            rs.getString("email"),
                            rs.getString("telefone"),
                            rs.getString("cpf"),
                            List.of(), List.of(), List.of()
                    );
                },
                petId
        );
        if (base == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pet não encontrado");
        }
        if (auth.tutor() && !base.clienteId().equals(auth.atorId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este pet não é seu");
        }
        if (!auth.tutor() && !auth.adminPlataforma()) {
            Empresa empresa = clinic.empresaAtual();
            boolean adminClinica = auth.colaborador() && auth.temPapel("administrador");
            if (empresa == null || (!adminClinica && !clinicaVePet(empresa.getId(), base.id(), base.clienteId()))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Pet sem atendimento ou agenda nesta clínica");
            }
        }
        return new PetDetalhe(
                base.id(), base.nome(), base.sexo(), base.nascimento(), base.peso(),
                base.especieId(), base.especie(), base.racaId(), base.raca(),
                base.clienteId(), base.tutor(), base.empresaId(),
                base.fotoUrl(), base.tutorEmail(), base.tutorTelefone(), base.tutorCpf(),
                vacinacoes(base.id()),
                doencas(base.id()),
                jdbc.query(
                        """
                        SELECT a.atendimento_id, a.data_inicio, s.descricao, a.resumo_cliente
                        FROM flutz.atendimento a
                        JOIN flutz.atendimento_status s ON s.atendimento_status_id = a.atendimento_status_id
                        WHERE a.pet_id = ?
                        ORDER BY a.atendimento_id DESC
                        """,
                        (rs, i) -> new Linha(
                                rs.getInt("atendimento_id"),
                                rs.getTimestamp("data_inicio") == null ? null : rs.getTimestamp("data_inicio").toInstant().toString(),
                                rs.getString("descricao"),
                                rs.getString("resumo_cliente")
                        ),
                        base.id()
                )
        );
    }

    public List<VacinaLinha> vacinacoesClinica() {
        exigirEquipe();
        Empresa empresa = clinic.empresaAtual();
        return jdbc.query(
                """
                SELECT h.historico_vacinacao_id, p.pet_id, p.nome_pet, p.foto_url, p.sexo,
                       es.descricao AS especie, r.descricao AS raca,
                       v.nome_vacina, h.data_aplicacao, h.data_proxima_dose, h.lote
                FROM flutz.historico_vacinacao h
                JOIN flutz.pet p ON p.pet_id = h.pet_id
                JOIN flutz.pet_especie es ON es.pet_especie_id = p.pet_especie_id
                LEFT JOIN flutz.pet_raca r ON r.pet_raca_id = p.pet_raca_id
                JOIN flutz.vacina v ON v.vacina_id = h.vacina_id
                WHERE p.pet_id IN (
                    SELECT pet_id FROM flutz.agendamento WHERE empresa_id = ?
                    UNION
                    SELECT pet_id FROM flutz.atendimento WHERE empresa_id = ?
                )
                ORDER BY COALESCE(h.data_proxima_dose, h.data_aplicacao) DESC
                """,
                (rs, i) -> mapVacinaLinha(rs),
                empresa.getId(), empresa.getId()
        );
    }

    public List<VacinaLinha> vacinacoesTutor() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor");
        }
        return jdbc.query(
                """
                SELECT h.historico_vacinacao_id, p.pet_id, p.nome_pet, p.foto_url, p.sexo,
                       es.descricao AS especie, r.descricao AS raca,
                       v.nome_vacina, h.data_aplicacao, h.data_proxima_dose, h.lote
                FROM flutz.historico_vacinacao h
                JOIN flutz.pet p ON p.pet_id = h.pet_id
                JOIN flutz.pet_especie es ON es.pet_especie_id = p.pet_especie_id
                LEFT JOIN flutz.pet_raca r ON r.pet_raca_id = p.pet_raca_id
                JOIN flutz.vacina v ON v.vacina_id = h.vacina_id
                WHERE p.cliente_id = ?
                ORDER BY COALESCE(h.data_proxima_dose, h.data_aplicacao) DESC
                """,
                (rs, i) -> mapVacinaLinha(rs),
                auth.atorId()
        );
    }

    @Transactional
    public VacinaLinha registrarVacina(NovaVacina req) {
        Empresa empresa = clinic.empresaAtual();
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a equipe registra vacinação");
        }
        Integer clienteId = jdbc.query(
                "SELECT cliente_id FROM flutz.pet WHERE pet_id = ?",
                rs -> rs.next() ? rs.getInt(1) : null,
                req.petId()
        );
        if (clienteId == null || !clinicaVePet(empresa.getId(), req.petId(), clienteId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pet não encontrado");
        }
        Integer id = jdbc.queryForObject(
                """
                INSERT INTO flutz.historico_vacinacao (pet_id, vacina_id, colaborador_id, data_aplicacao, data_proxima_dose, lote, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING historico_vacinacao_id
                """,
                Integer.class,
                req.petId(),
                req.vacinaId(),
                auth.colaborador() ? auth.atorId() : null,
                LocalDate.parse(req.dataAplicacao()),
                req.dataProximaDose() == null || req.dataProximaDose().isBlank() ? null : LocalDate.parse(req.dataProximaDose()),
                blank(req.lote()),
                blank(req.observacoes())
        );
        return vacinacoesClinica().stream().filter(item -> item.id().equals(id)).findFirst()
                .orElseThrow();
    }

    public List<Item> especialidades() {
        Empresa empresa = clinic.empresaAtual();
        return jdbc.query(
                """
                SELECT ee.empresa_especialidade_id AS id, e.descricao AS nome
                FROM flutz.empresa_especialidade ee
                JOIN flutz.especialidade e ON e.especialidade_id = ee.especialidade_id
                WHERE ee.empresa_id = ?
                ORDER BY ee.ordem, e.descricao
                """,
                (rs, i) -> new Item(rs.getInt("id"), rs.getString("nome")),
                empresa.getId()
        );
    }

    private void exigirGestao() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.adminPlataforma() || (auth.colaborador() && auth.temPapel("administrador"))) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a administração da clínica");
    }

    @Transactional
    public Item oferecerEspecialidade(Integer especialidadeId) {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        Integer status = jdbc.queryForObject(
                "SELECT status_id FROM flutz.status WHERE LOWER(descricao) = 'ativo'",
                Integer.class
        );
        try {
            Integer id = jdbc.queryForObject(
                    """
                    INSERT INTO flutz.empresa_especialidade (empresa_id, especialidade_id, ordem, visivel_pagina, status_id)
                    VALUES (?, ?, 1, TRUE, ?)
                    RETURNING empresa_especialidade_id
                    """,
                    Integer.class,
                    empresa.getId(), especialidadeId, status
            );
            String nome = jdbc.queryForObject(
                    "SELECT descricao FROM flutz.especialidade WHERE especialidade_id = ?",
                    String.class,
                    especialidadeId
            );
            return new Item(id, nome);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Especialidade já oferecida");
        }
    }

    public PaginaConfig pagina() {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        return paginaDaEmpresa(empresa.getId());
    }

    public PaginaConfig paginaDaEmpresa(Integer empresaId) {
        List<Secao> secoes = jdbc.query(
                "SELECT tipo_secao, ordem, visivel FROM flutz.pagina_secao WHERE empresa_id = ? ORDER BY ordem",
                (rs, i) -> new Secao(rs.getString("tipo_secao"), rs.getInt("ordem"), rs.getBoolean("visivel")),
                empresaId
        );
        Hero hero = jdbc.query(
                "SELECT titulo, subtitulo, texto_resumo, imagem_fundo_url FROM flutz.hero_section WHERE empresa_id = ?",
                rs -> rs.next()
                        ? new Hero(
                                rs.getString("titulo"),
                                rs.getString("subtitulo"),
                                rs.getString("texto_resumo"),
                                rs.getString("imagem_fundo_url")
                        )
                        : null,
                empresaId
        );
        List<String> galeria = jdbc.query(
                "SELECT imagem_url FROM flutz.galeria_imagem WHERE empresa_id = ? AND visivel = TRUE ORDER BY ordem",
                (rs, i) -> rs.getString(1),
                empresaId
        );
        return new PaginaConfig(secoes, hero, galeria);
    }

    @Transactional
    public void salvarSecao(String tipo, boolean visivel, Integer ordem) {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        jdbc.update(
                """
                INSERT INTO flutz.pagina_secao (empresa_id, tipo_secao, ordem, visivel)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (empresa_id, tipo_secao)
                DO UPDATE SET visivel = EXCLUDED.visivel, ordem = EXCLUDED.ordem
                """,
                empresa.getId(), tipo.toUpperCase(Locale.ROOT), ordem == null ? 1 : ordem, visivel
        );
    }

    @Transactional
    public void salvarHero(Hero req) {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        jdbc.update(
                """
                INSERT INTO flutz.hero_section (empresa_id, titulo, subtitulo, texto_resumo, imagem_fundo_url)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (empresa_id)
                DO UPDATE SET
                    titulo = EXCLUDED.titulo,
                    subtitulo = EXCLUDED.subtitulo,
                    texto_resumo = EXCLUDED.texto_resumo,
                    imagem_fundo_url = COALESCE(EXCLUDED.imagem_fundo_url, hero_section.imagem_fundo_url)
                """,
                empresa.getId(),
                req.titulo(),
                blank(req.subtitulo()),
                blank(req.texto()),
                blank(req.imagemFundoUrl())
        );
    }

    @Transactional
    public void salvarIdentidade(Identidade req) {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        jdbc.update(
                """
                UPDATE flutz.empresa
                SET descricao_empresa = ?,
                    logo_url = COALESCE(?, logo_url)
                WHERE empresa_id = ?
                """,
                blank(req.sobre()),
                blank(req.logoUrl()),
                empresa.getId()
        );
    }

    @Transactional
    public ClinicMediaService.ArquivoSalvo salvarArquivo(String destino, MultipartFile arquivo) {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        ClinicMediaService.ArquivoSalvo salvo = media.gravar(empresa.getId(), destino, arquivo);
        if ("logo".equals(salvo.destino())) {
            jdbc.update("UPDATE flutz.empresa SET logo_url = ? WHERE empresa_id = ?", salvo.url(), empresa.getId());
        } else if ("hero".equals(salvo.destino())) {
            jdbc.update(
                    """
                    INSERT INTO flutz.hero_section (empresa_id, titulo, imagem_fundo_url)
                    VALUES (?, ?, ?)
                    ON CONFLICT (empresa_id)
                    DO UPDATE SET imagem_fundo_url = EXCLUDED.imagem_fundo_url
                    """,
                    empresa.getId(),
                    empresa.getNomeEmpresa(),
                    salvo.url()
            );
        } else if ("galeria".equals(salvo.destino())) {
            Integer status = jdbc.queryForObject(
                    "SELECT status_id FROM flutz.status WHERE LOWER(descricao) = 'ativo'",
                    Integer.class
            );
            Integer ordem = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(ordem), 0) + 1 FROM flutz.galeria_imagem WHERE empresa_id = ?",
                    Integer.class,
                    empresa.getId()
            );
            jdbc.update(
                    """
                    INSERT INTO flutz.galeria_imagem (empresa_id, imagem_url, texto_alternativo, ordem, visivel, status_id)
                    VALUES (?, ?, ?, ?, TRUE, ?)
                    """,
                    empresa.getId(),
                    salvo.url(),
                    arquivo.getOriginalFilename(),
                    ordem == null ? 1 : ordem,
                    status
            );
        }
        return salvo;
    }

    public List<Avaliacao> avaliacoes() {
        exigirGestao();
        Empresa empresa = clinic.empresaAtual();
        return jdbc.query(
                """
                SELECT ac.avaliacao_cliente_id, ac.nome_cliente, ac.nome_pet, ac.texto, ac.nota,
                       ac.visivel, ac.autorizado_publicacao, ac.data_avaliacao,
                       c.email AS tutor_email, c.foto_url AS tutor_foto,
                       p.foto_url AS pet_foto, p.data_aniversario, r.descricao AS raca,
                       CASE
                         WHEN av.historico_vacinacao_id IS NOT NULL THEN 'Vacinação'
                         ELSE COALESCE(NULLIF(es.nome_exibicao, ''), ts.tipo_servico)
                       END AS servico,
                       CASE
                         WHEN av.historico_vacinacao_id IS NOT NULL THEN 'vacinacao'
                         ELSE ts.icone
                       END AS servico_icone
                FROM flutz.avaliacao_cliente ac
                LEFT JOIN flutz.cliente c ON c.cliente_id = ac.cliente_id
                LEFT JOIN flutz.pet p ON p.pet_id = ac.pet_id
                LEFT JOIN flutz.pet_raca r ON r.pet_raca_id = p.pet_raca_id
                LEFT JOIN flutz.avaliacao av
                  ON av.empresa_id = ac.empresa_id
                 AND av.cliente_id = ac.cliente_id
                LEFT JOIN flutz.atendimento at ON at.atendimento_id = av.atendimento_id
                LEFT JOIN flutz.empresa_servico es ON es.empresa_servico_id = at.empresa_servico_id
                LEFT JOIN flutz.tipo_servico ts ON ts.tipo_servico_id = es.tipo_servico_id
                WHERE ac.empresa_id = ?
                ORDER BY ac.data_avaliacao DESC, ac.avaliacao_cliente_id DESC
                """,
                (rs, i) -> new Avaliacao(
                        rs.getInt("avaliacao_cliente_id"),
                        rs.getString("nome_cliente"),
                        rs.getString("nome_pet"),
                        rs.getString("texto"),
                        rs.getBigDecimal("nota"),
                        rs.getBoolean("visivel"),
                        rs.getBoolean("autorizado_publicacao"),
                        rs.getTimestamp("data_avaliacao") == null
                                ? null
                                : rs.getTimestamp("data_avaliacao").toLocalDateTime().toString(),
                        rs.getString("tutor_email"),
                        rs.getString("tutor_foto"),
                        rs.getString("pet_foto"),
                        rs.getString("raca"),
                        idadeAnos(rs.getDate("data_aniversario") == null
                                ? null
                                : rs.getDate("data_aniversario").toLocalDate()),
                        rs.getString("servico"),
                        rs.getString("servico_icone")
                ),
                empresa.getId()
        );
    }

    private static Integer idadeAnos(LocalDate nascimento) {
        if (nascimento == null) {
            return null;
        }
        return Period.between(nascimento, LocalDate.now()).getYears();
    }

    public List<ChatResumo> chats() {
        exigirEquipe();
        Empresa empresa = clinic.empresaAtual();
        return jdbc.query(
                """
                SELECT c.chat_id, cl.nome_cliente, cl.foto_url AS tutor_foto_url, p.nome_pet, m.descricao AS motivo,
                       CASE WHEN f.chat_finalizacao_id IS NULL THEN 'aberto' ELSE 'encerrado' END AS status,
                       c.data_criacao,
                       (
                         SELECT msg.mensagem
                         FROM flutz.chat_mensagem msg
                         WHERE msg.chat_id = c.chat_id
                         ORDER BY msg.data_criacao DESC
                         LIMIT 1
                       ) AS preview,
                       (
                         SELECT msg.remetente_tipo
                         FROM flutz.chat_mensagem msg
                         WHERE msg.chat_id = c.chat_id
                         ORDER BY msg.data_criacao DESC
                         LIMIT 1
                       ) AS ultimo_remetente,
                       COALESCE(
                         (
                           SELECT MAX(msg.data_criacao)
                           FROM flutz.chat_mensagem msg
                           WHERE msg.chat_id = c.chat_id
                         ),
                         c.data_criacao
                       ) AS ultima_atividade
                FROM flutz.chat c
                JOIN flutz.cliente cl ON cl.cliente_id = c.cliente_id
                LEFT JOIN flutz.pet p ON p.pet_id = c.pet_id
                LEFT JOIN flutz.chat_motivo m ON m.chat_motivo_id = c.chat_motivo_id
                LEFT JOIN flutz.chat_finalizacao f ON f.chat_id = c.chat_id
                WHERE c.empresa_id = ?
                  AND c.chat_id = (
                    SELECT c2.chat_id
                    FROM flutz.chat c2
                    LEFT JOIN flutz.chat_finalizacao f2 ON f2.chat_id = c2.chat_id
                    WHERE c2.empresa_id = c.empresa_id AND c2.cliente_id = c.cliente_id
                    ORDER BY CASE WHEN f2.chat_finalizacao_id IS NULL THEN 0 ELSE 1 END, c2.chat_id DESC
                    LIMIT 1
                  )
                ORDER BY ultima_atividade DESC NULLS LAST, c.chat_id DESC
                """,
                (rs, i) -> mapChatResumoLista(rs),
                empresa.getId()
        );
    }

    public List<TutorConversa> conversasTutor() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor");
        }
        Integer clienteId = auth.atorId();
        // Uma linha por contato (clínica) com chat já aberto.
        return jdbc.query(
                """
                SELECT e.empresa_id, e.nome_empresa, e.logo_url,
                       c.chat_id,
                       CASE WHEN f.chat_finalizacao_id IS NULL THEN 'aberto' ELSE 'encerrado' END AS status,
                       (
                         SELECT m.mensagem
                         FROM flutz.chat_mensagem m
                         WHERE m.chat_id = c.chat_id
                         ORDER BY m.data_criacao DESC
                         LIMIT 1
                       ) AS preview,
                       COALESCE(
                         (
                           SELECT MAX(m.data_criacao)
                           FROM flutz.chat_mensagem m
                           WHERE m.chat_id = c.chat_id
                         ),
                         c.data_criacao
                       ) AS ultima_atividade
                FROM flutz.chat c
                JOIN flutz.empresa e ON e.empresa_id = c.empresa_id
                LEFT JOIN flutz.chat_finalizacao f ON f.chat_id = c.chat_id
                WHERE c.cliente_id = ?
                  AND c.chat_id = (
                    SELECT c2.chat_id
                    FROM flutz.chat c2
                    LEFT JOIN flutz.chat_finalizacao f2 ON f2.chat_id = c2.chat_id
                    WHERE c2.empresa_id = c.empresa_id AND c2.cliente_id = c.cliente_id
                    ORDER BY CASE WHEN f2.chat_finalizacao_id IS NULL THEN 0 ELSE 1 END, c2.chat_id DESC
                    LIMIT 1
                  )
                ORDER BY ultima_atividade DESC NULLS LAST, e.nome_empresa
                """,
                (rs, i) -> {
                    Timestamp ultima = rs.getTimestamp("ultima_atividade");
                    return new TutorConversa(
                            rs.getInt("empresa_id"),
                            rs.getString("nome_empresa"),
                            rs.getString("logo_url"),
                            rs.getInt("chat_id"),
                            rs.getString("status"),
                            rs.getString("preview"),
                            ultima == null ? null : ultima.toInstant().toString()
                    );
                },
                clienteId
        );
    }

    public ChatDetalhe chat(Integer id) {
        AuthPrincipal auth = AuthHolder.current();
        ChatResumo resumo;
        if (auth.tutor()) {
            resumo = resumoChatTutor(id, auth.atorId());
        } else {
            Empresa empresa = clinic.empresaAtual();
            Integer empresaChat = jdbc.queryForObject("SELECT empresa_id FROM flutz.chat WHERE chat_id = ?", Integer.class, id);
            if (empresaChat == null || !empresaChat.equals(empresa.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chat de outra clínica");
            }
            resumo = resumoChat(id, empresa.getId());
        }
        List<Mensagem> mensagens = listarMensagens(id);
        return new ChatDetalhe(resumo, mensagens);
    }

    @Transactional
    public TutorConversa abrirConversaTutor(Integer empresaId) {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor");
        }
        if (empresaId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a clínica");
        }
        if (!empresas.existsById(empresaId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Clínica não encontrada");
        }
        Integer existente = jdbc.query(
                """
                SELECT c.chat_id
                FROM flutz.chat c
                WHERE c.empresa_id = ? AND c.cliente_id = ?
                ORDER BY c.chat_id DESC
                LIMIT 1
                """,
                rs -> rs.next() ? rs.getInt("chat_id") : null,
                empresaId,
                auth.atorId()
        );
        Integer chatId = garantirChat(empresaId, auth.atorId(), null, null);
        if (existente == null) {
            jdbc.update(
                    """
                    INSERT INTO flutz.chat_mensagem (chat_id, remetente_tipo, remetente_id, mensagem)
                    VALUES (?, 'SISTEMA', NULL, ?)
                    """,
                    chatId,
                    "Você iniciou a conversa com a clínica. Pode enviar sua mensagem."
            );
        }
        return conversasTutor().stream()
                .filter(item -> item.empresaId().equals(empresaId))
                .findFirst()
                .orElseGet(() -> {
                    var empresa = empresas.findById(empresaId).orElseThrow();
                    return new TutorConversa(
                            empresaId,
                            empresa.getNomeEmpresa(),
                            empresa.getLogoUrl(),
                            chatId,
                            "aberto",
                            null,
                            Instant.now().toString()
                    );
                });
    }

    @Transactional
    public void garantirChatAposAgendamento(
            Integer empresaId,
            Integer clienteId,
            Integer petId,
            Integer agendamentoId,
            String textoSistema
    ) {
        Integer chatId = garantirChat(empresaId, clienteId, petId, agendamentoId);
        if (textoSistema != null && !textoSistema.isBlank()) {
            jdbc.update(
                    """
                    INSERT INTO flutz.chat_mensagem (chat_id, remetente_tipo, remetente_id, mensagem)
                    VALUES (?, 'SISTEMA', NULL, ?)
                    """,
                    chatId,
                    textoSistema.trim()
            );
        }
    }

    private Integer garantirChat(
            Integer empresaId,
            Integer clienteId,
            Integer petId,
            Integer agendamentoId
    ) {
        if (!vinculos.existsByEmpresaIdAndClienteId(empresaId, clienteId)) {
            Integer statusVinculo = jdbc.queryForObject(
                    "SELECT status_id FROM flutz.status WHERE LOWER(descricao) = 'ativo'",
                    Integer.class
            );
            jdbc.update(
                    """
                    INSERT INTO flutz.empresa_cliente (empresa_id, cliente_id, status_id)
                    VALUES (?, ?, ?)
                    ON CONFLICT (empresa_id, cliente_id) DO NOTHING
                    """,
                    empresaId, clienteId, statusVinculo
            );
        }
        Integer existente = jdbc.query(
                """
                SELECT c.chat_id
                FROM flutz.chat c
                LEFT JOIN flutz.chat_finalizacao f ON f.chat_id = c.chat_id
                WHERE c.empresa_id = ? AND c.cliente_id = ?
                ORDER BY CASE WHEN f.chat_finalizacao_id IS NULL THEN 0 ELSE 1 END, c.chat_id DESC
                LIMIT 1
                """,
                rs -> rs.next() ? rs.getInt("chat_id") : null,
                empresaId,
                clienteId
        );
        if (existente != null) {
            jdbc.update("DELETE FROM flutz.chat_finalizacao WHERE chat_id = ?", existente);
            if (agendamentoId != null) {
                jdbc.update(
                        "UPDATE flutz.chat SET agendamento_id = COALESCE(agendamento_id, ?) WHERE chat_id = ?",
                        agendamentoId,
                        existente
                );
            }
            if (petId != null) {
                jdbc.update(
                        "UPDATE flutz.chat SET pet_id = COALESCE(pet_id, ?) WHERE chat_id = ?",
                        petId,
                        existente
                );
            }
            return existente;
        }
        Integer status = jdbc.queryForObject(
                "SELECT status_id FROM flutz.status WHERE LOWER(descricao) = 'ativo'",
                Integer.class
        );
        return jdbc.queryForObject(
                """
                INSERT INTO flutz.chat (empresa_id, cliente_id, pet_id, agendamento_id, status_id)
                VALUES (?, ?, ?, ?, ?)
                RETURNING chat_id
                """,
                Integer.class,
                empresaId, clienteId, petId, agendamentoId, status
        );
    }

    @Transactional
    public Mensagem enviarMensagem(Integer chatId, String texto) {
        AuthPrincipal auth = AuthHolder.current();
        if (texto == null || texto.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mensagem vazia");
        }
        Integer empresaChat = jdbc.queryForObject("SELECT empresa_id FROM flutz.chat WHERE chat_id = ?", Integer.class, chatId);
        if (empresaChat == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat não encontrado");
        }
        if (auth.tutor()) {
            Integer cliente = jdbc.queryForObject("SELECT cliente_id FROM flutz.chat WHERE chat_id = ?", Integer.class, chatId);
            if (cliente == null || !cliente.equals(auth.atorId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chat de outro tutor");
            }
        } else {
            Empresa empresa = clinic.empresaAtual();
            if (!empresaChat.equals(empresa.getId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Chat de outra clínica");
            }
        }
        // Reabre automaticamente se estiver encerrado e alguém enviar mensagem.
        jdbc.update("DELETE FROM flutz.chat_finalizacao WHERE chat_id = ?", chatId);
        String tipo = auth.tutor() ? "CLIENTE" : "COLABORADOR";
        String remetenteNome = doisPrimeirosNomes(auth.nome());
        String remetenteFoto = auth.tutor()
                ? jdbc.query(
                        "SELECT foto_url FROM flutz.cliente WHERE cliente_id = ?",
                        rs -> rs.next() ? rs.getString("foto_url") : null,
                        auth.atorId()
                )
                : jdbc.query(
                        "SELECT imagem_url FROM flutz.colaborador WHERE colaborador_id = ?",
                        rs -> rs.next() ? rs.getString("imagem_url") : null,
                        auth.atorId()
                );
        Mensagem mensagem = jdbc.queryForObject(
                """
                INSERT INTO flutz.chat_mensagem (chat_id, remetente_tipo, remetente_id, mensagem)
                VALUES (?, ?, ?, ?)
                RETURNING chat_mensagem_id, remetente_tipo, mensagem, data_criacao
                """,
                (rs, i) -> new Mensagem(
                        rs.getInt("chat_mensagem_id"),
                        rs.getString("remetente_tipo"),
                        remetenteNome,
                        remetenteFoto,
                        rs.getString("mensagem"),
                        rs.getTimestamp("data_criacao").toInstant().toString()
                ),
                chatId, tipo, auth.atorId(), texto.trim()
        );
        Integer clienteId = jdbc.queryForObject("SELECT cliente_id FROM flutz.chat WHERE chat_id = ?", Integer.class, chatId);
        notifications.notificarChat(chatId, empresaChat, clienteId, tipo, texto.trim());
        return mensagem;
    }

    @Transactional
    public void encerrarChat(Integer chatId, String observacoes) {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a equipe encerra o chat");
        }
        Empresa empresa = clinic.empresaAtual();
        Integer empresaChat = jdbc.queryForObject("SELECT empresa_id FROM flutz.chat WHERE chat_id = ?", Integer.class, chatId);
        if (empresaChat == null || !empresaChat.equals(empresa.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat não encontrado");
        }
        Integer colaboradorId = auth.colaborador() ? auth.atorId() : jdbc.queryForObject(
                "SELECT colaborador_id FROM flutz.colaborador WHERE empresa_id = ? ORDER BY colaborador_id LIMIT 1",
                Integer.class,
                empresa.getId()
        );
        jdbc.update(
                """
                INSERT INTO flutz.chat_finalizacao (chat_id, colaborador_id, observacoes)
                VALUES (?, ?, ?)
                ON CONFLICT (chat_id) DO NOTHING
                """,
                chatId, colaboradorId, blank(observacoes)
        );
    }

    @Transactional
    public ChatResumo abrirChat(NovoChat req) {
        AuthPrincipal auth = AuthHolder.current();
        Empresa empresa = clinic.empresaAtual();
        Integer clienteId = auth.tutor() ? auth.atorId() : req.clienteId();
        if (clienteId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o tutor");
        }
        if (!vinculos.existsByEmpresaIdAndClienteId(empresa.getId(), clienteId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tutor sem vínculo");
        }
        Integer id = garantirChat(empresa.getId(), clienteId, req.petId(), null);
        if (req.motivoId() != null) {
            jdbc.update(
                    "UPDATE flutz.chat SET chat_motivo_id = COALESCE(chat_motivo_id, ?) WHERE chat_id = ?",
                    req.motivoId(),
                    id
            );
        }
        return resumoChat(id, empresa.getId());
    }

    private List<Mensagem> listarMensagens(Integer chatId) {
        return jdbc.query(
                """
                SELECT m.chat_mensagem_id, m.remetente_tipo, m.mensagem, m.data_criacao,
                       CASE m.remetente_tipo
                         WHEN 'CLIENTE' THEN cl.nome_cliente
                         WHEN 'COLABORADOR' THEN co.nome_colaborador
                         ELSE NULL
                       END AS remetente_nome,
                       CASE m.remetente_tipo
                         WHEN 'CLIENTE' THEN cl.foto_url
                         WHEN 'COLABORADOR' THEN co.imagem_url
                         ELSE NULL
                       END AS remetente_foto
                FROM flutz.chat_mensagem m
                LEFT JOIN flutz.cliente cl
                  ON m.remetente_tipo = 'CLIENTE' AND cl.cliente_id = m.remetente_id
                LEFT JOIN flutz.colaborador co
                  ON m.remetente_tipo = 'COLABORADOR' AND co.colaborador_id = m.remetente_id
                WHERE m.chat_id = ?
                ORDER BY m.data_criacao
                """,
                (rs, i) -> new Mensagem(
                        rs.getInt("chat_mensagem_id"),
                        rs.getString("remetente_tipo"),
                        doisPrimeirosNomes(rs.getString("remetente_nome")),
                        rs.getString("remetente_foto"),
                        rs.getString("mensagem"),
                        rs.getTimestamp("data_criacao").toInstant().toString()
                ),
                chatId
        );
    }

    private ChatResumo resumoChatTutor(Integer chatId, Integer clienteId) {
        return jdbc.query(
                """
                SELECT c.chat_id, e.nome_empresa AS nome_cliente, e.logo_url AS tutor_foto_url, p.nome_pet, m.descricao AS motivo,
                       CASE WHEN f.chat_finalizacao_id IS NULL THEN 'aberto' ELSE 'encerrado' END AS status,
                       c.data_criacao
                FROM flutz.chat c
                JOIN flutz.empresa e ON e.empresa_id = c.empresa_id
                LEFT JOIN flutz.pet p ON p.pet_id = c.pet_id
                LEFT JOIN flutz.chat_motivo m ON m.chat_motivo_id = c.chat_motivo_id
                LEFT JOIN flutz.chat_finalizacao f ON f.chat_id = c.chat_id
                WHERE c.chat_id = ? AND c.cliente_id = ?
                """,
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat não encontrado");
                    }
                    return mapChatResumo(rs);
                },
                chatId,
                clienteId
        );
    }

    private ChatResumo resumoChat(Integer chatId, Integer empresaId) {
        return jdbc.query(
                """
                SELECT c.chat_id, cl.nome_cliente, cl.foto_url AS tutor_foto_url, p.nome_pet, m.descricao AS motivo,
                       CASE WHEN f.chat_finalizacao_id IS NULL THEN 'aberto' ELSE 'encerrado' END AS status,
                       c.data_criacao
                FROM flutz.chat c
                JOIN flutz.cliente cl ON cl.cliente_id = c.cliente_id
                LEFT JOIN flutz.pet p ON p.pet_id = c.pet_id
                LEFT JOIN flutz.chat_motivo m ON m.chat_motivo_id = c.chat_motivo_id
                LEFT JOIN flutz.chat_finalizacao f ON f.chat_id = c.chat_id
                WHERE c.chat_id = ? AND c.empresa_id = ?
                """,
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Chat não encontrado");
                    }
                    return mapChatResumo(rs);
                },
                chatId,
                empresaId
        );
    }

    private static ChatResumo mapChatResumo(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new ChatResumo(
                rs.getInt("chat_id"),
                rs.getString("nome_cliente"),
                rs.getString("tutor_foto_url"),
                rs.getString("nome_pet"),
                rs.getString("motivo"),
                rs.getString("status"),
                rs.getTimestamp("data_criacao").toInstant().toString(),
                null,
                null,
                null
        );
    }

    private static ChatResumo mapChatResumoLista(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp ultima = rs.getTimestamp("ultima_atividade");
        return new ChatResumo(
                rs.getInt("chat_id"),
                rs.getString("nome_cliente"),
                rs.getString("tutor_foto_url"),
                rs.getString("nome_pet"),
                rs.getString("motivo"),
                rs.getString("status"),
                rs.getTimestamp("data_criacao").toInstant().toString(),
                rs.getString("preview"),
                ultima == null ? null : ultima.toInstant().toString(),
                rs.getString("ultimo_remetente")
        );
    }

    public PublicaClinica paginaPublica(String slug) {
        ClinicaContexto clinica = jdbc.query(
                """
                SELECT empresa_id, nome_empresa, identificador_url, logo_url, cidade, uf, descricao_empresa, email, telefone
                FROM flutz.empresa WHERE LOWER(identificador_url) = LOWER(?)
                """,
                rs -> rs.next()
                        ? new ClinicaContexto(
                        rs.getInt("empresa_id"),
                        rs.getString("nome_empresa"),
                        rs.getString("identificador_url"),
                        rs.getString("logo_url"),
                        rs.getString("cidade"),
                        rs.getString("uf"),
                        rs.getString("descricao_empresa"),
                        rs.getString("email"),
                        rs.getString("telefone")
                )
                        : null,
                slug
        );
        if (clinica == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Clínica não encontrada");
        }
        PaginaConfig config = paginaDaEmpresa(clinica.id());
        List<String> servicos = jdbc.query(
                """
                SELECT COALESCE(NULLIF(es.nome_exibicao, ''), ts.tipo_servico)
                FROM flutz.empresa_servico es
                JOIN flutz.tipo_servico ts ON ts.tipo_servico_id = es.tipo_servico_id
                WHERE es.empresa_id = ? AND es.visivel_pagina = TRUE
                ORDER BY es.ordem
                """,
                (rs, i) -> rs.getString(1),
                clinica.id()
        );
        List<String> equipe = jdbc.query(
                """
                SELECT nome_colaborador FROM flutz.colaborador
                WHERE empresa_id = ? AND exibir_pagina = TRUE AND data_autorizacao_pagina IS NOT NULL
                ORDER BY ordem_pagina NULLS LAST, nome_colaborador
                """,
                (rs, i) -> rs.getString(1),
                clinica.id()
        );
        List<String> especialidades = jdbc.query(
                """
                SELECT e.descricao
                FROM flutz.empresa_especialidade ee
                JOIN flutz.especialidade e ON e.especialidade_id = ee.especialidade_id
                WHERE ee.empresa_id = ? AND ee.visivel_pagina = TRUE
                ORDER BY ee.ordem
                """,
                (rs, i) -> rs.getString(1),
                clinica.id()
        );
        List<Avaliacao> avaliacoes = jdbc.query(
                """
                SELECT avaliacao_cliente_id, nome_cliente, nome_pet, texto, nota, visivel, autorizado_publicacao
                FROM flutz.avaliacao_cliente
                WHERE empresa_id = ? AND visivel = TRUE AND autorizado_publicacao = TRUE
                ORDER BY data_avaliacao DESC
                """,
                (rs, i) -> new Avaliacao(
                        rs.getInt("avaliacao_cliente_id"),
                        rs.getString("nome_cliente"),
                        rs.getString("nome_pet"),
                        rs.getString("texto"),
                        rs.getBigDecimal("nota"),
                        true,
                        true,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null,
                        null
                ),
                clinica.id()
        );
        List<String> galeria = jdbc.query(
                "SELECT imagem_url FROM flutz.galeria_imagem WHERE empresa_id = ? AND visivel = TRUE ORDER BY ordem",
                (rs, i) -> rs.getString(1),
                clinica.id()
        );
        List<Rede> redes = jdbc.query(
                """
                SELECT COALESCE(r.nome_exibicao, t.descricao) AS nome, r.url
                FROM flutz.rede_social r
                JOIN flutz.tipo_redesocial t ON t.tipo_redesocial_id = r.tipo_redesocial_id
                WHERE r.empresa_id = ?
                """,
                (rs, i) -> new Rede(rs.getString("nome"), rs.getString("url")),
                clinica.id()
        );
        return new PublicaClinica(clinica, config, servicos, equipe, especialidades, avaliacoes, galeria, redes);
    }

    private List<VacinaLinha> vacinacoes(Integer petId) {
        return jdbc.query(
                """
                SELECT h.historico_vacinacao_id, p.pet_id, p.nome_pet, p.foto_url, p.sexo,
                       es.descricao AS especie, r.descricao AS raca,
                       v.nome_vacina, h.data_aplicacao, h.data_proxima_dose, h.lote
                FROM flutz.historico_vacinacao h
                JOIN flutz.pet p ON p.pet_id = h.pet_id
                JOIN flutz.pet_especie es ON es.pet_especie_id = p.pet_especie_id
                LEFT JOIN flutz.pet_raca r ON r.pet_raca_id = p.pet_raca_id
                JOIN flutz.vacina v ON v.vacina_id = h.vacina_id
                WHERE h.pet_id = ?
                ORDER BY h.data_aplicacao DESC
                """,
                (rs, i) -> mapVacinaLinha(rs),
                petId
        );
    }

    private VacinaLinha mapVacinaLinha(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new VacinaLinha(
                rs.getInt("historico_vacinacao_id"),
                rs.getInt("pet_id"),
                rs.getString("nome_pet"),
                rs.getString("foto_url"),
                rs.getString("sexo"),
                rs.getString("especie"),
                rs.getString("raca"),
                rs.getString("nome_vacina"),
                rs.getDate("data_aplicacao").toLocalDate().toString(),
                rs.getDate("data_proxima_dose") == null ? null : rs.getDate("data_proxima_dose").toLocalDate().toString(),
                rs.getString("lote")
        );
    }

    private List<Linha> doencas(Integer petId) {
        return jdbc.query(
                """
                SELECT h.historico_doenca_id, h.data_diagnostico::text, d.nome_doenca, h.observacoes
                FROM flutz.historico_doenca h
                JOIN flutz.doenca d ON d.doenca_id = h.doenca_id
                WHERE h.pet_id = ?
                ORDER BY h.data_diagnostico DESC
                """,
                (rs, i) -> new Linha(rs.getInt("historico_doenca_id"), rs.getString(2), rs.getString(3), rs.getString(4)),
                petId
        );
    }

    private long count(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * Exibe o primeiro nome + o próximo nome significativo (ignora partículas:
     * da, de, do, das, dos, e, di…).
     * Ex.: "Yan da Silva" → "Yan Silva"; "Maria Clara Souza" → "Maria Clara".
     */
    private static String doisPrimeirosNomes(String nomeCompleto) {
        if (nomeCompleto == null || nomeCompleto.isBlank()) {
            return null;
        }
        String[] partes = nomeCompleto.trim().split("\\s+");
        if (partes.length == 1) {
            return partes[0];
        }
        String primeiro = partes[0];
        for (int i = 1; i < partes.length; i++) {
            if (!particulaNome(partes[i])) {
                return primeiro + " " + partes[i];
            }
        }
        return primeiro;
    }

    private static boolean particulaNome(String parte) {
        String p = parte == null ? "" : parte.toLowerCase(java.util.Locale.ROOT);
        return p.equals("da") || p.equals("de") || p.equals("do") || p.equals("das")
                || p.equals("dos") || p.equals("e") || p.equals("di") || p.equals("du")
                || p.equals("del") || p.equals("della") || p.equals("van") || p.equals("von");
    }

    public record ClinicaContexto(
            Integer id, String nome, String slug, String logoUrl, String cidade, String uf,
            String sobre, String email, String telefone
    ) {
    }

    public record ClinicaTutor(
            Integer id, String nome, String slug, String logoUrl, String cidade, String uf,
            long pets, long atendimentos, String ultimoAtendimento, String proximoAgendamento
    ) {
    }

    public record IndicadoresClinica(
            long atendimentosHoje,
            long emAndamento,
            long finalizadosHoje,
            long agendaHoje,
            long agendaAmanha,
            long agendaPendentes,
            long pets,
            long tutores,
            long vacinasAplicadas,
            long vacinasProximas,
            long vacinasAtrasadas,
            List<Ponto> atendimentosPorDia,
            List<Ponto> motivosAbertura,
            List<Ponto> encerramento,
            List<Ponto> avaliacoes
    ) {
    }

    public record Ponto(String rotulo, BigDecimal valor) {
    }

    private static String digits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    public record ConsultaPet(
            Integer id,
            String nome,
            String fotoUrl,
            String sexo,
            String especie,
            String raca,
            String nascimento,
            String tutor,
            String tutorEmail,
            String vacinasStatus
    ) {
    }

    public record PaginaConsultaPets(
            List<ConsultaPet> items,
            int page,
            int size,
            long total,
            int totalPages
    ) {
    }

    public record PetDetalhe(
            Integer id,
            String nome,
            String sexo,
            String nascimento,
            BigDecimal peso,
            Integer especieId,
            String especie,
            Integer racaId,
            String raca,
            Integer clienteId,
            String tutor,
            Integer empresaId,
            String fotoUrl,
            String tutorEmail,
            String tutorTelefone,
            String tutorCpf,
            List<VacinaLinha> vacinacoes,
            List<Linha> doencas,
            List<Linha> atendimentos
    ) {
    }

    public record VacinaLinha(
            Integer id,
            Integer petId,
            String pet,
            String fotoUrl,
            String sexo,
            String especie,
            String raca,
            String vacina,
            String aplicacao,
            String proxima,
            String lote
    ) {
    }

    public record NovaVacina(Integer petId, Integer vacinaId, String dataAplicacao, String dataProximaDose, String lote, String observacoes) {
    }

    public record Linha(Integer id, String quando, String titulo, String detalhe) {
    }

    public record Item(Integer id, String nome) {
    }

    public record Secao(String tipo, int ordem, boolean visivel) {
    }

    public record Hero(String titulo, String subtitulo, String texto, String imagemFundoUrl) {
    }

    public record Identidade(String logoUrl, String sobre) {
    }

    public record PaginaConfig(List<Secao> secoes, Hero hero, List<String> galeria) {
    }

    public record Avaliacao(
            Integer id,
            String tutor,
            String pet,
            String texto,
            BigDecimal nota,
            boolean visivel,
            boolean autorizado,
            String data,
            String email,
            String tutorFotoUrl,
            String petFotoUrl,
            String raca,
            Integer idadeAnos,
            String servico,
            String servicoIcone
    ) {
    }

    public record ChatResumo(
            Integer id,
            String tutor,
            String fotoUrl,
            String pet,
            String motivo,
            String status,
            String criadoEm,
            String preview,
            String ultimaAtividade,
            String ultimoRemetente
    ) {
    }

    public record TutorConversa(
            Integer empresaId,
            String clinica,
            String logoUrl,
            Integer chatId,
            String status,
            String preview,
            String ultimaAtividade
    ) {
    }

    public record ChatDetalhe(ChatResumo chat, List<Mensagem> mensagens) {
    }

    public record Mensagem(
            Integer id,
            String remetente,
            String remetenteNome,
            String remetenteFoto,
            String texto,
            String quando
    ) {
    }

    public record NovoChat(Integer clienteId, Integer petId, Integer motivoId) {
    }

    public record AbrirConversaTutor(Integer empresaId) {
    }

    public record Rede(String nome, String url) {
    }

    public record PublicaClinica(
            ClinicaContexto clinica,
            PaginaConfig pagina,
            List<String> servicos,
            List<String> equipe,
            List<String> especialidades,
            List<Avaliacao> avaliacoes,
            List<String> galeria,
            List<Rede> redes
    ) {
    }
}
