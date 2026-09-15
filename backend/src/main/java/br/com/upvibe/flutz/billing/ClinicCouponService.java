package br.com.upvibe.flutz.billing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.clinic.ClinicService;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class ClinicCouponService {

    private final JdbcTemplate jdbc;
    private final ClinicService clinic;

    public ClinicCouponService(JdbcTemplate jdbc, ClinicService clinic) {
        this.jdbc = jdbc;
        this.clinic = clinic;
    }

    public List<Cupom> listar() {
        exigirAdminClinica();
        Integer empresaId = clinic.empresaAtual().getId();
        return jdbc.query(
                """
                SELECT c.empresa_cupom_id, c.codigo, c.percentual_desconto, c.data_expiracao,
                       s.descricao AS status, c.usos_maximos, c.usos_realizados
                FROM flutz.empresa_cupom c
                JOIN flutz.status s ON s.status_id = c.status_id
                WHERE c.empresa_id = ?
                ORDER BY CASE WHEN LOWER(s.descricao) = 'ativo' THEN 0 ELSE 1 END,
                         c.data_expiracao DESC, c.empresa_cupom_id DESC
                """,
                (rs, i) -> new Cupom(
                        rs.getInt(1),
                        rs.getString(2),
                        rs.getBigDecimal(3),
                        rs.getTimestamp(4).toLocalDateTime().toString(),
                        rs.getString(5),
                        (Integer) rs.getObject(6),
                        rs.getInt(7)
                ),
                empresaId
        );
    }

    @Transactional
    public Cupom criar(NovoCupom req) {
        exigirAdminClinica();
        Integer empresaId = clinic.empresaAtual().getId();
        String codigo = normalizar(req.codigo());
        if (codigo.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o código do cupom");
        }
        BigDecimal percentual = req.percentualDesconto();
        if (percentual == null || percentual.compareTo(BigDecimal.ZERO) < 0 || percentual.compareTo(new BigDecimal("100")) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O desconto deve estar entre 0 e 100");
        }
        LocalDateTime expiracao = parseExpiracao(req.dataExpiracao());
        if (!expiracao.isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A data de expiração precisa ser futura");
        }
        Integer usos = req.usosMaximos();
        if (usos != null && usos < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O limite de usos, se informado, deve ser pelo menos 1");
        }
        AuthPrincipal auth = AuthHolder.current();
        Integer colaboradorId = auth.colaborador() ? auth.atorId() : null;
        try {
            Integer id = jdbc.queryForObject(
                    """
                    INSERT INTO flutz.empresa_cupom
                      (empresa_id, codigo, percentual_desconto, data_expiracao, status_id, usos_maximos, colaborador_criacao_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    RETURNING empresa_cupom_id
                    """,
                    Integer.class,
                    empresaId,
                    codigo,
                    percentual.setScale(2, RoundingMode.HALF_UP),
                    Timestamp.valueOf(expiracao),
                    statusAtivo(),
                    usos,
                    colaboradorId
            );
            return listar().stream().filter(c -> c.id().equals(id)).findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Cupom criado sem retorno"));
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um cupom com este código nesta clínica");
        }
    }

    @Transactional
    public void desativar(Integer id) {
        exigirAdminClinica();
        Integer empresaId = clinic.empresaAtual().getId();
        int n = jdbc.update(
                """
                UPDATE flutz.empresa_cupom
                SET status_id = ?
                WHERE empresa_cupom_id = ? AND empresa_id = ?
                """,
                statusInativo(), id, empresaId
        );
        if (n == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cupom não encontrado");
        }
    }

    public CupomPreview validar(Integer empresaId, String codigo) {
        CupomRow row = exigirValido(empresaId, codigo);
        return new CupomPreview(row.codigo(), row.percentual());
    }

    public CupomRow exigirValido(Integer empresaId, String codigo) {
        String normalizado = normalizar(codigo);
        if (normalizado.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o cupom");
        }
        CupomRow row = jdbc.query(
                """
                SELECT c.empresa_cupom_id, c.codigo, c.percentual_desconto, c.usos_maximos, c.usos_realizados, s.descricao
                FROM flutz.empresa_cupom c
                JOIN flutz.status s ON s.status_id = c.status_id
                WHERE c.empresa_id = ? AND UPPER(c.codigo) = ?
                """,
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    return new CupomRow(
                            rs.getInt(1),
                            rs.getString(2),
                            rs.getBigDecimal(3),
                            (Integer) rs.getObject(4),
                            rs.getInt(5),
                            rs.getString(6)
                    );
                },
                empresaId,
                normalizado
        );
        if (row == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cupom inválido");
        }
        if (!"ativo".equalsIgnoreCase(row.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este cupom não está ativo");
        }
        LocalDateTime expiracao = jdbc.query(
                "SELECT data_expiracao FROM flutz.empresa_cupom WHERE empresa_cupom_id = ?",
                rs -> rs.next() ? rs.getTimestamp(1).toLocalDateTime() : null,
                row.id()
        );
        if (expiracao == null || !expiracao.isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este cupom expirou");
        }
        if (row.usosMaximos() != null && row.usosRealizados() >= row.usosMaximos()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este cupom atingiu o limite de usos");
        }
        return row;
    }

    @Transactional
    public void registrarUso(Integer cupomId) {
        if (cupomId == null) {
            return;
        }
        jdbc.update(
                "UPDATE flutz.empresa_cupom SET usos_realizados = usos_realizados + 1 WHERE empresa_cupom_id = ?",
                cupomId
        );
    }

    private void exigirAdminClinica() {
        AuthPrincipal auth = AuthHolder.current();
        if (!(auth.temPapel("administrador") || auth.adminPlataforma())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da clínica");
        }
        clinic.empresaAtual();
    }

    private Integer statusAtivo() {
        Integer id = jdbc.query(
                "SELECT status_id FROM flutz.status WHERE LOWER(descricao) = 'ativo'",
                rs -> rs.next() ? rs.getInt(1) : null
        );
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Status ativo ausente");
        }
        return id;
    }

    private Integer statusInativo() {
        Integer id = jdbc.query(
                "SELECT status_id FROM flutz.status WHERE LOWER(descricao) IN ('inativo', 'desativado') LIMIT 1",
                rs -> rs.next() ? rs.getInt(1) : null
        );
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Status inativo ausente");
        }
        return id;
    }

    private static String normalizar(String codigo) {
        return codigo == null ? "" : codigo.trim().toUpperCase(Locale.ROOT);
    }

    private static LocalDateTime parseExpiracao(String value) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a data de expiração");
        }
        String raw = value.trim();
        try {
            if (raw.length() == 10) {
                return LocalDateTime.parse(raw + "T23:59:59");
            }
            return LocalDateTime.parse(raw);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data de expiração inválida");
        }
    }

    public record Cupom(
            Integer id, String codigo, BigDecimal percentualDesconto, String dataExpiracao,
            String status, Integer usosMaximos, Integer usosRealizados
    ) {
    }

    public record NovoCupom(String codigo, BigDecimal percentualDesconto, String dataExpiracao, Integer usosMaximos) {
    }

    public record CupomPreview(String codigo, BigDecimal percentualDesconto) {
    }

    public record CupomRow(
            Integer id, String codigo, BigDecimal percentual, Integer usosMaximos, int usosRealizados, String status
    ) {
    }
}
