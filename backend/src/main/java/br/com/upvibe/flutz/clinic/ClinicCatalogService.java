package br.com.upvibe.flutz.clinic;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class ClinicCatalogService {

    private static final Set<String> ICONES_ESPECIE = Set.of(
            "cao", "gato", "ave", "peixe", "coelho", "tartaruga", "hamster", "rato", "camundongo",
            "cavalo", "porco", "vaca", "cabra", "ovelha", "cobra", "lagarto", "sapo", "inseto",
            "molusco", "furão", "ouriço", "minhoca", "ovo", "outro"
    );

    private static final Set<String> ICONES_SERVICO = Set.of(
            "consulta", "retorno", "vacinacao", "cirurgia", "emergencia", "exame", "banho",
            "internacao", "ultrassom", "raiox", "castracao", "checkup", "microchip", "curativo",
            "medicacao", "laboratorio", "odontologia", "dermatologia", "cardiologia", "oftalmologia",
            "fisioterapia", "hotel", "domicilio", "nutricao", "acupuntura", "comportamento",
            "geriatria", "neonatal", "preventivo", "geral"
    );

    private final JdbcTemplate jdbc;
    private final ClinicService clinic;

    public ClinicCatalogService(JdbcTemplate jdbc, ClinicService clinic) {
        this.jdbc = jdbc;
        this.clinic = clinic;
    }

    public List<Item> listar(String tipo, Integer empresaIdFiltro) {
        return listar(tipo, empresaIdFiltro, true);
    }

    public List<Item> listar(String tipo, Integer empresaIdFiltro, boolean somenteAtivos) {
        Integer empresaId = resolverEmpresa(empresaIdFiltro);
        return switch (normalizar(tipo)) {
            case "especies" -> {
                String sql = """
                    SELECT pet_especie_id AS id, descricao AS nome, icone,
                           COALESCE(ativo, TRUE) AS ativo,
                           (empresa_id IS NOT NULL AND empresa_id = ?) AS da_clinica
                    FROM flutz.pet_especie
                    WHERE (empresa_id IS NULL OR empresa_id = ?)
                    """;
                if (somenteAtivos) {
                    sql += " AND COALESCE(ativo, TRUE) = TRUE ";
                }
                sql += " ORDER BY descricao ";
                yield queryEspecie(sql, empresaId, empresaId);
            }
            case "racas" -> query(
                    """
                    SELECT r.pet_raca_id AS id, e.descricao || ' · ' || r.descricao AS nome,
                           (r.empresa_id IS NOT NULL AND r.empresa_id = ?) AS da_clinica
                    FROM flutz.pet_raca r
                    JOIN flutz.pet_especie e ON e.pet_especie_id = r.pet_especie_id
                    WHERE (r.empresa_id IS NULL OR r.empresa_id = ?)
                      AND (e.empresa_id IS NULL OR e.empresa_id = ?)
                      AND COALESCE(e.ativo, TRUE) = TRUE
                    ORDER BY e.descricao, r.descricao
                    """,
                    empresaId, empresaId, empresaId
            );
            case "vacinas" -> query(
                    """
                    SELECT vacina_id AS id, nome_vacina AS nome,
                           (empresa_id IS NOT NULL AND empresa_id = ?) AS da_clinica
                    FROM flutz.vacina
                    WHERE empresa_id IS NULL OR empresa_id = ?
                    ORDER BY nome_vacina
                    """,
                    empresaId, empresaId
            );
            case "doencas" -> query(
                    """
                    SELECT doenca_id AS id, nome_doenca AS nome,
                           (empresa_id IS NOT NULL AND empresa_id = ?) AS da_clinica
                    FROM flutz.doenca
                    WHERE empresa_id IS NULL OR empresa_id = ?
                    ORDER BY nome_doenca
                    """,
                    empresaId, empresaId
            );
            case "especialidades" -> query(
                    """
                    SELECT especialidade_id AS id, descricao AS nome,
                           (empresa_id IS NOT NULL AND empresa_id = ?) AS da_clinica
                    FROM flutz.especialidade
                    WHERE empresa_id IS NULL OR empresa_id = ?
                    ORDER BY descricao
                    """,
                    empresaId, empresaId
            );
            case "tipos-servico" -> queryComIcone(
                    """
                    SELECT tipo_servico_id AS id, tipo_servico AS nome, icone,
                           (empresa_id IS NOT NULL AND empresa_id = ?) AS da_clinica
                    FROM flutz.tipo_servico
                    WHERE empresa_id IS NULL OR empresa_id = ?
                    ORDER BY tipo_servico
                    """,
                    empresaId, empresaId
            );
            case "papeis" -> jdbc.query(
                    """
                    SELECT role_id AS id, descricao AS nome
                    FROM flutz.role
                    ORDER BY
                      CASE LOWER(descricao)
                        WHEN 'administrador' THEN 1
                        WHEN 'veterinario' THEN 2
                        WHEN 'recepcao' THEN 3
                        ELSE 9
                      END,
                      descricao
                    """,
                    (rs, i) -> new Item(rs.getInt("id"), rs.getString("nome"), false, null, true)
            );
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Catálogo inválido");
        };
    }

    public List<Item> listarGestao(String tipo, Integer empresaIdFiltro) {
        if ("especies".equals(normalizar(tipo))) {
            return listar(tipo, empresaIdFiltro, false);
        }
        return listar(tipo, empresaIdFiltro, true);
    }

    public List<Item> motivosChat() {
        AuthHolder.current();
        return jdbc.query(
                "SELECT chat_motivo_id AS id, descricao AS nome FROM flutz.chat_motivo ORDER BY descricao",
                (rs, i) -> new Item(rs.getInt("id"), rs.getString("nome"), false, null, true)
        );
    }

    public List<Item> racasPorEspecie(Integer especieId, Integer empresaIdFiltro) {
        Integer empresaId = resolverEmpresa(empresaIdFiltro);
        if (especieId == null) {
            return listar("racas", empresaId);
        }
        return query(
                """
                SELECT r.pet_raca_id AS id, r.descricao AS nome,
                       (r.empresa_id IS NOT NULL AND r.empresa_id = ?) AS da_clinica
                FROM flutz.pet_raca r
                WHERE r.pet_especie_id = ?
                  AND (r.empresa_id IS NULL OR r.empresa_id = ?)
                ORDER BY r.descricao
                """,
                empresaId, especieId, empresaId
        );
    }

    @Transactional
    public Item criar(String tipo, String nome, Integer especieId, String icone) {
        AuthPrincipal auth = AuthHolder.current();
        exigirAdminClinica(auth, "cadastra");
        Integer empresaId = clinic.empresaAtual().getId();
        if (nome == null || nome.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome");
        }
        String valor = nome.trim();
        String tipoNorm = normalizar(tipo);
        String iconeNorm = switch (tipoNorm) {
            case "especies" -> normalizarIconeEspecie(icone);
            case "tipos-servico" -> normalizarIconeServico(icone);
            default -> null;
        };
        try {
            Integer id = switch (tipoNorm) {
                case "especies" -> jdbc.queryForObject(
                        """
                        INSERT INTO flutz.pet_especie (descricao, empresa_id, icone, ativo)
                        VALUES (?, ?, ?, TRUE) RETURNING pet_especie_id
                        """,
                        Integer.class, valor, empresaId, iconeNorm
                );
                case "racas" -> {
                    if (especieId == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a espécie");
                    }
                    yield jdbc.queryForObject(
                            """
                            INSERT INTO flutz.pet_raca (descricao, pet_especie_id, empresa_id)
                            VALUES (?, ?, ?) RETURNING pet_raca_id
                            """,
                            Integer.class, valor, especieId, empresaId
                    );
                }
                case "vacinas" -> {
                    Integer vacinaId = jdbc.queryForObject(
                            "INSERT INTO flutz.vacina (nome_vacina, empresa_id) VALUES (?, ?) RETURNING vacina_id",
                            Integer.class, valor, empresaId
                    );
                    oferecerVacinaNaAgenda(empresaId, vacinaId);
                    yield vacinaId;
                }
                case "doencas" -> jdbc.queryForObject(
                        "INSERT INTO flutz.doenca (nome_doenca, empresa_id) VALUES (?, ?) RETURNING doenca_id",
                        Integer.class, valor, empresaId
                );
                case "especialidades" -> {
                    Integer especialidadeId = jdbc.queryForObject(
                            "INSERT INTO flutz.especialidade (descricao, empresa_id) VALUES (?, ?) RETURNING especialidade_id",
                            Integer.class, valor, empresaId
                    );
                    oferecerEspecialidadeNaClinica(empresaId, especialidadeId);
                    yield especialidadeId;
                }
                case "tipos-servico" -> jdbc.queryForObject(
                        """
                        INSERT INTO flutz.tipo_servico (tipo_servico, empresa_id, icone)
                        VALUES (?, ?, ?) RETURNING tipo_servico_id
                        """,
                        Integer.class, valor, empresaId, iconeNorm
                );
                default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Catálogo inválido");
            };
            return new Item(id, valor, true, iconeNorm, true);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um item com esse nome nesta clínica");
        }
    }

    @Transactional
    public Item atualizar(String tipo, Integer id, String nome, String icone) {
        AuthPrincipal auth = AuthHolder.current();
        exigirAdminClinica(auth, "edita");
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o item");
        }
        if (nome == null || nome.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome");
        }
        Integer empresaId = clinic.empresaAtual().getId();
        String valor = nome.trim();
        String tipoNorm = normalizar(tipo);
        try {
            int updated = switch (tipoNorm) {
                case "especies" -> jdbc.update(
                        """
                        UPDATE flutz.pet_especie
                        SET descricao = ?, icone = ?
                        WHERE pet_especie_id = ? AND empresa_id = ?
                        """,
                        valor, normalizarIconeEspecie(icone), id, empresaId
                );
                case "racas" -> jdbc.update(
                        "UPDATE flutz.pet_raca SET descricao = ? WHERE pet_raca_id = ? AND empresa_id = ?",
                        valor, id, empresaId
                );
                case "vacinas" -> jdbc.update(
                        "UPDATE flutz.vacina SET nome_vacina = ? WHERE vacina_id = ? AND empresa_id = ?",
                        valor, id, empresaId
                );
                case "doencas" -> jdbc.update(
                        "UPDATE flutz.doenca SET nome_doenca = ? WHERE doenca_id = ? AND empresa_id = ?",
                        valor, id, empresaId
                );
                case "especialidades" -> jdbc.update(
                        "UPDATE flutz.especialidade SET descricao = ? WHERE especialidade_id = ? AND empresa_id = ?",
                        valor, id, empresaId
                );
                case "tipos-servico" -> jdbc.update(
                        """
                        UPDATE flutz.tipo_servico
                        SET tipo_servico = ?, icone = ?
                        WHERE tipo_servico_id = ? AND empresa_id = ?
                        """,
                        valor, normalizarIconeServico(icone), id, empresaId
                );
                default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Catálogo inválido");
            };
            if (updated == 0) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Só é possível editar o que esta clínica cadastrou.");
            }
            if ("especies".equals(tipoNorm) || "tipos-servico".equals(tipoNorm)) {
                String iconeOut = "especies".equals(tipoNorm)
                        ? normalizarIconeEspecie(icone)
                        : normalizarIconeServico(icone);
                return new Item(id, valor, true, iconeOut, true);
            }
            return new Item(id, valor, true, null, true);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um item com esse nome nesta clínica");
        }
    }

    @Transactional
    public Item definirAtivo(String tipo, Integer id, boolean ativo) {
        AuthPrincipal auth = AuthHolder.current();
        exigirAdminClinica(auth, "altera");
        if (!"especies".equals(normalizar(tipo))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Desativação disponível apenas para espécies");
        }
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o item");
        }
        Integer empresaId = clinic.empresaAtual().getId();
        int updated = jdbc.update(
                "UPDATE flutz.pet_especie SET ativo = ? WHERE pet_especie_id = ? AND empresa_id = ?",
                ativo, id, empresaId
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Só é possível alterar o que esta clínica cadastrou.");
        }
        return jdbc.query(
                """
                SELECT pet_especie_id AS id, descricao AS nome, icone, ativo,
                       TRUE AS da_clinica
                FROM flutz.pet_especie
                WHERE pet_especie_id = ?
                """,
                (rs, i) -> new Item(
                        rs.getInt("id"),
                        rs.getString("nome"),
                        true,
                        rs.getString("icone"),
                        rs.getBoolean("ativo")
                ),
                id
        ).stream().findFirst().orElseThrow();
    }

    @Transactional
    public void remover(String tipo, Integer id) {
        AuthPrincipal auth = AuthHolder.current();
        exigirAdminClinica(auth, "remove");
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o item");
        }
        Integer empresaId = clinic.empresaAtual().getId();
        int removed;
        try {
            removed = switch (normalizar(tipo)) {
                case "especies" -> jdbc.update(
                        "DELETE FROM flutz.pet_especie WHERE pet_especie_id = ? AND empresa_id = ?",
                        id, empresaId
                );
                case "racas" -> jdbc.update(
                        "DELETE FROM flutz.pet_raca WHERE pet_raca_id = ? AND empresa_id = ?",
                        id, empresaId
                );
                case "vacinas" -> {
                    removerOfertaVacina(empresaId, id);
                    yield jdbc.update(
                            "DELETE FROM flutz.vacina WHERE vacina_id = ? AND empresa_id = ?",
                            id, empresaId
                    );
                }
                case "doencas" -> jdbc.update(
                        "DELETE FROM flutz.doenca WHERE doenca_id = ? AND empresa_id = ?",
                        id, empresaId
                );
                case "especialidades" -> {
                    removerOfertaEspecialidade(empresaId, id);
                    yield jdbc.update(
                            "DELETE FROM flutz.especialidade WHERE especialidade_id = ? AND empresa_id = ?",
                            id, empresaId
                    );
                }
                case "tipos-servico" -> jdbc.update(
                        "DELETE FROM flutz.tipo_servico WHERE tipo_servico_id = ? AND empresa_id = ?",
                        id, empresaId
                );
                default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Catálogo inválido");
            };
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            if ("especies".equals(normalizar(tipo))) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Esta espécie está em uso. Desative-a para ocultá-la sem perder o histórico."
                );
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este item está em uso e não pode ser removido.");
        }
        if (removed == 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Só é possível remover o que esta clínica cadastrou.");
        }
    }

    private void oferecerVacinaNaAgenda(Integer empresaId, Integer vacinaId) {
        if (empresaId == null || vacinaId == null) {
            return;
        }
        jdbc.update(
                """
                INSERT INTO flutz.empresa_vacina (empresa_id, vacina_id, status_id, visivel_agendamento)
                SELECT ?, ?, status_id, TRUE
                FROM flutz.status
                WHERE LOWER(descricao) = 'ativo'
                  AND NOT EXISTS (
                    SELECT 1 FROM flutz.empresa_vacina ev
                    WHERE ev.empresa_id = ? AND ev.vacina_id = ?
                  )
                """,
                empresaId, vacinaId, empresaId, vacinaId
        );
    }

    private void oferecerEspecialidadeNaClinica(Integer empresaId, Integer especialidadeId) {
        if (empresaId == null || especialidadeId == null) {
            return;
        }
        Integer ordem = jdbc.query(
                "SELECT COALESCE(MAX(ordem), 0) + 1 FROM flutz.empresa_especialidade WHERE empresa_id = ?",
                rs -> rs.next() ? rs.getInt(1) : 1,
                empresaId
        );
        jdbc.update(
                """
                INSERT INTO flutz.empresa_especialidade (empresa_id, especialidade_id, ordem, visivel_pagina, status_id)
                SELECT ?, ?, ?, TRUE, status_id
                FROM flutz.status
                WHERE LOWER(descricao) = 'ativo'
                  AND NOT EXISTS (
                    SELECT 1 FROM flutz.empresa_especialidade ee
                    WHERE ee.empresa_id = ? AND ee.especialidade_id = ?
                  )
                """,
                empresaId, especialidadeId, ordem == null ? 1 : ordem, empresaId, especialidadeId
        );
    }

    private void removerOfertaEspecialidade(Integer empresaId, Integer especialidadeId) {
        jdbc.update(
                "DELETE FROM flutz.empresa_especialidade WHERE empresa_id = ? AND especialidade_id = ?",
                empresaId, especialidadeId
        );
    }

    private void removerOfertaVacina(Integer empresaId, Integer vacinaId) {
        jdbc.update(
                """
                DELETE FROM flutz.empresa_vacina_especie eve
                USING flutz.empresa_vacina ev
                WHERE eve.empresa_vacina_id = ev.empresa_vacina_id
                  AND ev.empresa_id = ?
                  AND ev.vacina_id = ?
                """,
                empresaId, vacinaId
        );
        jdbc.update(
                "DELETE FROM flutz.empresa_vacina WHERE empresa_id = ? AND vacina_id = ?",
                empresaId, vacinaId
        );
    }

    private Integer resolverEmpresa(Integer empresaIdFiltro) {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            return empresaIdFiltro;
        }
        if (auth.empresaId() == null && auth.adminPlataforma()) {
            return empresaIdFiltro;
        }
        return clinic.empresaAtual().getId();
    }

    private void exigirAdminClinica(AuthPrincipal auth, String acao) {
        if (auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a clínica " + acao + " este catálogo");
        }
        if (!(auth.temPapel("administrador") || auth.adminPlataforma())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da clínica " + acao + " o catálogo");
        }
    }

    private String normalizarIconeEspecie(String icone) {
        if (icone == null || icone.isBlank()) {
            return "outro";
        }
        String value = icone.trim().toLowerCase(Locale.ROOT);
        if ("furao".equals(value)) {
            value = "furão";
        }
        if ("ourico".equals(value)) {
            value = "ouriço";
        }
        if (!ICONES_ESPECIE.contains(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ícone de espécie inválido");
        }
        return value;
    }

    private String normalizarIconeServico(String icone) {
        if (icone == null || icone.isBlank()) {
            return "geral";
        }
        String value = icone.trim().toLowerCase(Locale.ROOT)
                .replace("raio-x", "raiox")
                .replace("raio_x", "raiox");
        if (!ICONES_SERVICO.contains(value)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ícone de serviço inválido");
        }
        return value;
    }

    private List<Item> query(String sql, Object... args) {
        return jdbc.query(
                sql,
                (rs, i) -> new Item(rs.getInt("id"), rs.getString("nome"), rs.getBoolean("da_clinica"), null, true),
                args
        );
    }

    private List<Item> queryEspecie(String sql, Object... args) {
        return jdbc.query(
                sql,
                (rs, i) -> new Item(
                        rs.getInt("id"),
                        rs.getString("nome"),
                        rs.getBoolean("da_clinica"),
                        rs.getString("icone"),
                        rs.getBoolean("ativo")
                ),
                args
        );
    }

    private List<Item> queryComIcone(String sql, Object... args) {
        return jdbc.query(
                sql,
                (rs, i) -> new Item(
                        rs.getInt("id"),
                        rs.getString("nome"),
                        rs.getBoolean("da_clinica"),
                        rs.getString("icone"),
                        true
                ),
                args
        );
    }

    private static String normalizar(String tipo) {
        return tipo == null ? "" : tipo.trim().toLowerCase(Locale.ROOT);
    }

    public record Item(Integer id, String nome, boolean daClinica, String icone, Boolean ativo) {
    }
}
