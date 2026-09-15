package br.com.upvibe.flutz.billing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;

import org.springframework.dao.DataAccessException;
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
public class TokenBillingService {

    private final JdbcTemplate jdbc;
    private final ClinicService clinic;

    public TokenBillingService(JdbcTemplate jdbc, ClinicService clinic) {
        this.jdbc = jdbc;
        this.clinic = clinic;
    }

    public PaginaTokens listar(int pagina, int tamanho) {
        exigirAdmin();
        int size = tamanho <= 0 ? 10 : Math.min(tamanho, 10);
        int page = Math.max(pagina, 0);
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM flutz.token", Long.class);
        long count = total == null ? 0 : total;
        List<TokenAdmin> items = jdbc.query(
                """
                SELECT t.token_id, t.codigo_token, t.percentual_desconto, t.data_expiracao,
                       s.descricao AS status, t.usos_maximos_por_empresa
                FROM flutz.token t
                JOIN flutz.status s ON s.status_id = t.status_id
                ORDER BY CASE WHEN LOWER(s.descricao) = 'ativo' THEN 0 ELSE 1 END,
                         t.data_expiracao DESC, t.token_id DESC
                LIMIT ? OFFSET ?
                """,
                (rs, i) -> new TokenAdmin(
                        rs.getInt("token_id"),
                        rs.getString("codigo_token"),
                        rs.getBigDecimal("percentual_desconto"),
                        rs.getTimestamp("data_expiracao").toLocalDateTime().toString(),
                        rs.getString("status"),
                        (Integer) rs.getObject("usos_maximos_por_empresa")
                ),
                size,
                page * size
        );
        int pages = count == 0 ? 1 : (int) Math.ceil(count / (double) size);
        return new PaginaTokens(items, page, size, count, pages);
    }

    @Transactional
    public TokenAdmin criar(NovoToken req) {
        exigirAdmin();
        String codigo = normalizar(req.codigoToken());
        if (codigo.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o código do token");
        }
        BigDecimal percentual = req.percentualDesconto();
        if (percentual == null || percentual.compareTo(BigDecimal.ZERO) < 0 || percentual.compareTo(new BigDecimal("100")) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O desconto deve estar entre 0 e 100");
        }
        LocalDateTime expiracao = parseExpiracao(req.dataExpiracao());
        if (!expiracao.isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A data de expiração precisa ser futura");
        }
        Integer usos = req.usosMaximosPorEmpresa();
        if (usos != null && usos < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O limite de usos, se informado, deve ser pelo menos 1");
        }
        Integer status = statusId("ativo");
        Integer adminId = AuthHolder.current().atorId();
        try {
            Integer id = jdbc.queryForObject(
                    """
                    INSERT INTO flutz.token
                      (codigo_token, percentual_desconto, data_expiracao, status_id, administrador_sistema_id, usos_maximos_por_empresa)
                    VALUES (?, ?, ?, ?, ?, ?)
                    RETURNING token_id
                    """,
                    Integer.class,
                    codigo,
                    percentual.setScale(2, RoundingMode.HALF_UP),
                    Timestamp.valueOf(expiracao),
                    status,
                    adminId,
                    usos
            );
            return new TokenAdmin(id, codigo, percentual.setScale(2, RoundingMode.HALF_UP), expiracao.toString(), "ativo", usos);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe um token com este código");
        }
    }

    @Transactional
    public void desativar(Integer id) {
        exigirAdmin();
        int n = jdbc.update(
                """
                UPDATE flutz.token
                SET status_id = ?
                WHERE token_id = ?
                """,
                statusId("inativo"),
                id
        );
        if (n == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Token não encontrado");
        }
    }

    public Preview validarPublico(String codigo, String codigoPlano) {
        TokenRow token = exigirValido(codigo, null);
        BigDecimal bruto = valorPlano(codigoPlano);
        return preview(token, bruto);
    }

    public Mensalidade mensalidadeClinica() {
        exigirClinicaAdmin();
        Integer empresaId = clinic.empresaAtual().getId();
        garantirFaturaPendente(empresaId);
        return carregarMensalidade(empresaId);
    }

    @Transactional
    public Mensalidade aplicarTokenClinica(String codigo) {
        exigirClinicaAdmin();
        Integer empresaId = clinic.empresaAtual().getId();
        Integer faturaId = garantirFaturaPendente(empresaId);
        aplicarNaFatura(faturaId, empresaId, codigo);
        return carregarMensalidade(empresaId);
    }

    @Transactional
    public void marcarFaturaPaga(Integer faturaId, String provider, String pagamentoId) {
        int n = jdbc.update(
                """
                UPDATE flutz.fatura_assinatura
                SET status_fatura = 'PAGA',
                    data_pagamento = CURRENT_TIMESTAMP,
                    provider = ?,
                    provider_pagamento_id = COALESCE(?, provider_pagamento_id)
                WHERE fatura_assinatura_id = ?
                  AND status_fatura IN ('PENDENTE', 'ATRASADA')
                """,
                provider,
                pagamentoId,
                faturaId
        );
        if (n == 0) {
            return;
        }
        jdbc.update(
                """
                UPDATE flutz.assinatura
                SET status_assinatura = 'ATIVA',
                    data_proximo_vencimento = COALESCE(
                      (SELECT data_vencimento FROM flutz.fatura_assinatura WHERE fatura_assinatura_id = ?),
                      data_proximo_vencimento
                    ) + INTERVAL '1 month'
                WHERE assinatura_id = (
                    SELECT assinatura_id FROM flutz.fatura_assinatura WHERE fatura_assinatura_id = ?
                )
                AND status_assinatura IN ('TRIAL', 'INADIMPLENTE', 'ATIVA')
                """,
                faturaId,
                faturaId
        );
    }

    public Integer faturaIdPorPagamentoProvider(String pagamentoId) {
        return jdbc.query(
                """
                SELECT fatura_assinatura_id
                FROM flutz.fatura_assinatura
                WHERE provider_pagamento_id = ?
                LIMIT 1
                """,
                rs -> rs.next() ? rs.getInt(1) : null,
                pagamentoId
        );
    }

    public Integer faturaIdPorReferencia(String referencia) {
        if (referencia == null || !referencia.startsWith("FLUTZ-FATURA-")) {
            return null;
        }
        try {
            return Integer.parseInt(referencia.substring("FLUTZ-FATURA-".length()));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /**
     * Atualiza faturas vencidas e bloqueia assinaturas após o prazo de tolerância.
     * A data é calculada pelo PostgreSQL no fuso de Brasília.
     */
    @Transactional
    public int processarInadimplencia() {
        jdbc.update(
                """
                UPDATE flutz.fatura_assinatura f
                SET status_fatura = 'ATRASADA'
                FROM flutz.assinatura a
                WHERE a.assinatura_id = f.assinatura_id
                  AND f.status_fatura = 'PENDENTE'
                  AND f.data_vencimento + a.dias_tolerancia
                      < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
                """
        );
        return jdbc.update(
                """
                UPDATE flutz.assinatura a
                SET status_assinatura = 'INADIMPLENTE'
                WHERE a.status_assinatura IN ('TRIAL', 'ATIVA')
                  AND EXISTS (
                    SELECT 1
                    FROM flutz.fatura_assinatura f
                    WHERE f.assinatura_id = a.assinatura_id
                      AND f.status_fatura IN ('PENDENTE', 'ATRASADA')
                      AND f.data_vencimento + a.dias_tolerancia
                          < (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date
                  )
                """
        );
    }

    @Transactional
    public void gravarPagamentoProvider(Integer faturaId, String provider, String pagamentoId) {
        jdbc.update(
                """
                UPDATE flutz.fatura_assinatura
                SET provider = ?, provider_pagamento_id = ?
                WHERE fatura_assinatura_id = ?
                """,
                provider,
                pagamentoId,
                faturaId
        );
    }

    @Transactional
    public void abrirFaturaCadastro(Integer assinaturaId, Integer empresaId, BigDecimal valorBruto, LocalDate vencimento, String codigoToken) {
        LocalDate competencia = (vencimento == null ? LocalDate.now() : vencimento).withDayOfMonth(1);
        TokenRow token = codigoToken == null || codigoToken.isBlank() ? null : exigirValido(codigoToken, empresaId);
        Integer faturaId = inserirFatura(assinaturaId, empresaId, competencia, valorBruto, vencimento, token);
        BigDecimal valor = jdbc.query(
                "SELECT valor FROM flutz.fatura_assinatura WHERE fatura_assinatura_id = ?",
                rs -> rs.next() ? rs.getBigDecimal(1) : null,
                faturaId
        );
        if (valor != null && valor.compareTo(BigDecimal.ZERO) == 0) {
            marcarFaturaPaga(faturaId, "token", null);
        }
    }

    private Integer garantirFaturaPendente(Integer empresaId) {
        Integer existente = jdbc.query(
                """
                SELECT fatura_assinatura_id
                FROM flutz.fatura_assinatura
                WHERE empresa_id = ? AND status_fatura IN ('PENDENTE', 'ATRASADA')
                ORDER BY data_vencimento ASC, fatura_assinatura_id ASC
                LIMIT 1
                """,
                rs -> rs.next() ? rs.getInt(1) : null,
                empresaId
        );
        if (existente != null) {
            return existente;
        }
        var assinatura = jdbc.query(
                """
                SELECT a.assinatura_id, p.valor_mensal, a.data_proximo_vencimento, a.dias_tolerancia
                FROM flutz.assinatura a
                JOIN flutz.plano p ON p.plano_id = a.plano_id
                WHERE a.empresa_id = ? AND a.status_assinatura IN ('TRIAL', 'ATIVA', 'INADIMPLENTE')
                ORDER BY a.assinatura_id DESC
                LIMIT 1
                """,
                rs -> rs.next()
                        ? new AssinaturaResumo(
                                rs.getInt(1),
                                rs.getBigDecimal(2),
                                rs.getDate(3) == null ? LocalDate.now().plusDays(30) : rs.getDate(3).toLocalDate(),
                                rs.getInt(4)
                        )
                        : null,
                empresaId
        );
        if (assinatura == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Esta clínica não tem assinatura");
        }
        LocalDate competencia = competenciaParaNovaFatura(assinatura.id(), assinatura.vencimento());
        return inserirFatura(assinatura.id(), empresaId, competencia, assinatura.valor(), assinatura.vencimento(), null);
    }

    /** Competência da próxima cobrança: mês do vencimento, ou o mês seguinte se aquele já tiver fatura. */
    private LocalDate competenciaParaNovaFatura(Integer assinaturaId, LocalDate vencimento) {
        LocalDate base = (vencimento == null ? LocalDate.now() : vencimento).withDayOfMonth(1);
        for (int i = 0; i < 24; i++) {
            LocalDate competencia = base.plusMonths(i);
            String status = jdbc.query(
                    """
                    SELECT status_fatura
                    FROM flutz.fatura_assinatura
                    WHERE assinatura_id = ? AND competencia = ?
                    """,
                    rs -> rs.next() ? rs.getString(1) : null,
                    assinaturaId,
                    java.sql.Date.valueOf(competencia)
            );
            if (status == null) {
                return competencia;
            }
            if ("PENDENTE".equals(status) || "ATRASADA".equals(status)) {
                return competencia;
            }
        }
        return base.plusMonths(1);
    }

    private Integer inserirFatura(
            Integer assinaturaId,
            Integer empresaId,
            LocalDate competencia,
            BigDecimal valorBruto,
            LocalDate vencimento,
            TokenRow token
    ) {
        BigDecimal bruto = nvl(valorBruto).setScale(2, RoundingMode.HALF_UP);
        BigDecimal valor = token == null ? bruto : liquido(bruto, token.percentual());
        try {
            Integer id = jdbc.queryForObject(
                    """
                    INSERT INTO flutz.fatura_assinatura
                      (assinatura_id, empresa_id, competencia, valor_bruto, token_id, codigo_token_aplicado,
                       percentual_desconto_aplicado, valor, moeda, status_fatura, data_vencimento)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BRL', 'PENDENTE', ?)
                    RETURNING fatura_assinatura_id
                    """,
                    Integer.class,
                    assinaturaId,
                    empresaId,
                    java.sql.Date.valueOf(competencia),
                    bruto,
                    token == null ? null : token.id(),
                    token == null ? null : token.codigo(),
                    token == null ? null : token.percentual(),
                    valor,
                    java.sql.Date.valueOf(vencimento == null ? competencia.plusMonths(1).minusDays(1) : vencimento)
            );
            if (id == null) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível abrir a fatura");
            }
            return id;
        } catch (DataAccessException ex) {
            if (mensagem(ex).contains("limite de usos")) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Este token já foi usado o máximo de vezes nesta clínica");
            }
            if (!(ex instanceof DataIntegrityViolationException)) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Não foi possível abrir a fatura");
            }
            Integer aberta = jdbc.query(
                    """
                    SELECT fatura_assinatura_id
                    FROM flutz.fatura_assinatura
                    WHERE assinatura_id = ? AND competencia = ?
                      AND status_fatura IN ('PENDENTE', 'ATRASADA')
                    """,
                    rs -> rs.next() ? rs.getInt(1) : null,
                    assinaturaId,
                    java.sql.Date.valueOf(competencia)
            );
            if (aberta != null) {
                return aberta;
            }
            LocalDate outra = competenciaParaNovaFatura(assinaturaId, vencimento);
            if (outra.equals(competencia)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe fatura desta competência");
            }
            return inserirFatura(assinaturaId, empresaId, outra, valorBruto, vencimento == null ? outra.plusMonths(1).minusDays(1) : vencimento, token);
        }
    }

    private void aplicarNaFatura(Integer faturaId, Integer empresaId, String codigo) {
        TokenRow token = exigirValido(codigo, empresaId);
        var fatura = jdbc.query(
                """
                SELECT valor_bruto, status_fatura, token_id
                FROM flutz.fatura_assinatura
                WHERE fatura_assinatura_id = ? AND empresa_id = ?
                """,
                rs -> rs.next()
                        ? new FaturaResumo(rs.getBigDecimal(1), rs.getString(2), (Integer) rs.getObject(3))
                        : null,
                faturaId,
                empresaId
        );
        if (fatura == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fatura não encontrada");
        }
        if (!"PENDENTE".equals(fatura.status()) && !"ATRASADA".equals(fatura.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Só é possível aplicar token em fatura em aberto");
        }
        BigDecimal valor = liquido(fatura.bruto(), token.percentual());
        try {
            jdbc.update(
                    """
                    UPDATE flutz.fatura_assinatura
                    SET token_id = ?, codigo_token_aplicado = ?, percentual_desconto_aplicado = ?, valor = ?
                    WHERE fatura_assinatura_id = ?
                    """,
                    token.id(),
                    token.codigo(),
                    token.percentual(),
                    valor,
                    faturaId
            );
        } catch (DataAccessException ex) {
            if (mensagem(ex).contains("limite de usos")) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Este token já foi usado o máximo de vezes nesta clínica");
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Não foi possível aplicar este token");
        }
    }

    private Mensalidade carregarMensalidade(Integer empresaId) {
        Mensalidade base = jdbc.query(
                """
                SELECT p.nome AS plano, p.codigo AS codigo_plano, p.valor_mensal, a.status_assinatura,
                       a.data_proximo_vencimento, a.dias_tolerancia,
                       f.fatura_assinatura_id, f.valor_bruto, f.valor, f.status_fatura,
                       f.codigo_token_aplicado, f.percentual_desconto_aplicado, f.data_vencimento,
                       f.competencia
                FROM flutz.assinatura a
                JOIN flutz.plano p ON p.plano_id = a.plano_id
                LEFT JOIN flutz.fatura_assinatura f ON f.assinatura_id = a.assinatura_id
                  AND f.status_fatura IN ('PENDENTE', 'ATRASADA')
                WHERE a.empresa_id = ?
                ORDER BY a.assinatura_id DESC, f.fatura_assinatura_id ASC
                LIMIT 1
                """,
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Esta clínica não tem assinatura");
                    }
                    LocalDate proximo = rs.getDate("data_proximo_vencimento") == null
                            ? null
                            : rs.getDate("data_proximo_vencimento").toLocalDate();
                    int tolerancia = rs.getInt("dias_tolerancia");
                    LocalDate vencimentoFatura = rs.getDate("data_vencimento") == null
                            ? null
                            : rs.getDate("data_vencimento").toLocalDate();
                    LocalDate referenciaPrazo = vencimentoFatura != null ? vencimentoFatura : proximo;
                    LocalDate limite = referenciaPrazo == null ? null : referenciaPrazo.plusDays(tolerancia);
                    BigDecimal valorMensal = rs.getBigDecimal("valor_mensal");
                    BigDecimal valorFatura = rs.getBigDecimal("valor");
                    return new Mensalidade(
                            rs.getString("plano"),
                            rs.getString("codigo_plano"),
                            valorMensal,
                            rs.getString("status_assinatura"),
                            proximo == null ? null : proximo.toString(),
                            tolerancia,
                            limite == null ? null : limite.toString(),
                            (Integer) rs.getObject("fatura_assinatura_id"),
                            rs.getBigDecimal("valor_bruto"),
                            valorFatura,
                            valorFatura != null ? valorFatura : valorMensal,
                            rs.getString("status_fatura"),
                            rs.getString("codigo_token_aplicado"),
                            rs.getBigDecimal("percentual_desconto_aplicado"),
                            vencimentoFatura == null ? null : vencimentoFatura.toString(),
                            rs.getDate("competencia") == null ? null : rs.getDate("competencia").toLocalDate().toString(),
                            null,
                            List.of()
                    );
                },
                empresaId
        );
        List<PagamentoHistorico> historico = jdbc.query(
                """
                SELECT fatura_assinatura_id, data_pagamento, valor, provider, provider_pagamento_id
                FROM flutz.fatura_assinatura
                WHERE empresa_id = ? AND status_fatura = 'PAGA' AND data_pagamento IS NOT NULL
                ORDER BY data_pagamento DESC, fatura_assinatura_id DESC
                LIMIT 12
                """,
                (rs, i) -> {
                    String provider = rs.getString("provider");
                    return new PagamentoHistorico(
                            rs.getInt("fatura_assinatura_id"),
                            rs.getTimestamp("data_pagamento").toLocalDateTime().toLocalDate().toString(),
                            rs.getBigDecimal("valor"),
                            metodoPagamento(provider),
                            provider,
                            rs.getString("provider_pagamento_id")
                    );
                },
                empresaId
        );
        PagamentoHistorico ultimo = historico.isEmpty() ? null : historico.get(0);
        return new Mensalidade(
                base.plano(),
                base.codigoPlano(),
                base.valorMensal(),
                base.statusAssinatura(),
                base.proximoVencimento(),
                base.diasTolerancia(),
                base.dataLimiteAcesso(),
                base.faturaId(),
                base.valorBruto(),
                base.valor(),
                base.valorAPagar(),
                base.statusFatura(),
                base.codigoTokenAplicado(),
                base.percentualDescontoAplicado(),
                base.vencimentoFatura(),
                base.competencia(),
                ultimo,
                historico
        );
    }

    private static String metodoPagamento(String provider) {
        if (provider == null || provider.isBlank()) {
            return "Outro";
        }
        String p = provider.trim().toLowerCase(Locale.ROOT);
        if (p.contains("pix")) {
            return "Pix";
        }
        if (p.contains("card") || p.contains("cartao") || p.contains("credit")) {
            return "Cartão de crédito";
        }
        if (p.contains("token")) {
            return "Token";
        }
        if (p.contains("mercadopago")) {
            return "Mercado Pago";
        }
        return provider;
    }

    private TokenRow exigirValido(String codigo, Integer empresaId) {
        String valor = normalizar(codigo);
        if (valor.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o token");
        }
        TokenRow token = jdbc.query(
                """
                SELECT t.token_id, t.codigo_token, t.percentual_desconto, t.data_expiracao,
                       s.descricao AS status, t.usos_maximos_por_empresa
                FROM flutz.token t
                JOIN flutz.status s ON s.status_id = t.status_id
                WHERE UPPER(t.codigo_token) = ?
                """,
                rs -> rs.next()
                        ? new TokenRow(
                                rs.getInt("token_id"),
                                rs.getString("codigo_token"),
                                rs.getBigDecimal("percentual_desconto"),
                                rs.getTimestamp("data_expiracao").toLocalDateTime(),
                                rs.getString("status"),
                                (Integer) rs.getObject("usos_maximos_por_empresa")
                        )
                        : null,
                valor
        );
        if (token == null || !"ativo".equalsIgnoreCase(token.status()) || !token.expiracao().isAfter(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Token inválido ou expirado");
        }
        if (empresaId != null && token.usosMaximos() != null) {
            Long usos = jdbc.queryForObject(
                    """
                    SELECT COUNT(*) FROM flutz.fatura_assinatura
                    WHERE empresa_id = ? AND token_id = ? AND status_fatura <> 'CANCELADA'
                    """,
                    Long.class,
                    empresaId,
                    token.id()
            );
            if (usos != null && usos >= token.usosMaximos()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Este token já foi usado o máximo de vezes nesta clínica");
            }
        }
        return token;
    }

    private BigDecimal valorPlano(String codigoPlano) {
        String codigo = codigoPlano == null ? "" : codigoPlano.trim().toUpperCase(Locale.ROOT);
        BigDecimal valor = jdbc.query(
                "SELECT valor_mensal FROM flutz.plano WHERE UPPER(codigo) = ? AND ativo = TRUE",
                rs -> rs.next() ? rs.getBigDecimal(1) : null,
                codigo
        );
        if (valor == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plano inválido");
        }
        return valor;
    }

    private Preview preview(TokenRow token, BigDecimal bruto) {
        BigDecimal base = nvl(bruto).setScale(2, RoundingMode.HALF_UP);
        return new Preview(token.codigo(), token.percentual(), base, liquido(base, token.percentual()));
    }

    private static BigDecimal liquido(BigDecimal bruto, BigDecimal percentual) {
        BigDecimal desconto = nvl(bruto).multiply(nvl(percentual)).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        return nvl(bruto).subtract(desconto).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private static String normalizar(String codigo) {
        return codigo == null ? "" : codigo.trim().toUpperCase(Locale.ROOT).replace(" ", "");
    }

    private static LocalDateTime parseExpiracao(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a data de expiração");
        }
        try {
            if (raw.length() <= 10) {
                return LocalDate.parse(raw.substring(0, 10)).atTime(LocalTime.of(23, 59, 59));
            }
            return LocalDateTime.parse(raw);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Data de expiração inválida");
        }
    }

    private Integer statusId(String descricao) {
        Integer id = jdbc.queryForObject(
                "SELECT status_id FROM flutz.status WHERE LOWER(descricao) = ?",
                Integer.class,
                descricao.toLowerCase(Locale.ROOT)
        );
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Status cadastral ausente");
        }
        return id;
    }

    private void exigirAdmin() {
        if (!AuthHolder.current().adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da plataforma");
        }
    }

    private void exigirClinicaAdmin() {
        AuthPrincipal auth = AuthHolder.current();
        if (!(auth.temPapel("administrador") || auth.adminPlataforma())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da clínica");
        }
        clinic.empresaAtual();
    }

    private static BigDecimal nvl(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String mensagem(DataAccessException ex) {
        Throwable cause = ex.getMostSpecificCause();
        return cause == null || cause.getMessage() == null ? "" : cause.getMessage();
    }

    public record NovoToken(String codigoToken, BigDecimal percentualDesconto, String dataExpiracao, Integer usosMaximosPorEmpresa) {
    }

    public record TokenAdmin(Integer id, String codigoToken, BigDecimal percentualDesconto, String dataExpiracao, String status, Integer usosMaximosPorEmpresa) {
    }

    public record PaginaTokens(List<TokenAdmin> items, int page, int size, long total, int totalPages) {
    }

    public record Preview(String codigo, BigDecimal percentualDesconto, BigDecimal valorBruto, BigDecimal valor) {
    }

    public record PagamentoHistorico(
            Integer faturaId,
            String data,
            BigDecimal valor,
            String metodo,
            String provider,
            String providerPagamentoId
    ) {
    }

    public record Mensalidade(
            String plano,
            String codigoPlano,
            BigDecimal valorMensal,
            String statusAssinatura,
            String proximoVencimento,
            int diasTolerancia,
            String dataLimiteAcesso,
            Integer faturaId,
            BigDecimal valorBruto,
            BigDecimal valor,
            BigDecimal valorAPagar,
            String statusFatura,
            String codigoTokenAplicado,
            BigDecimal percentualDescontoAplicado,
            String vencimentoFatura,
            String competencia,
            PagamentoHistorico ultimoPagamento,
            List<PagamentoHistorico> historico
    ) {
    }

    private record TokenRow(Integer id, String codigo, BigDecimal percentual, LocalDateTime expiracao, String status, Integer usosMaximos) {
    }

    private record AssinaturaResumo(Integer id, BigDecimal valor, LocalDate vencimento, int diasTolerancia) {
    }

    private record FaturaResumo(BigDecimal bruto, String status, Integer tokenId) {
    }
}
