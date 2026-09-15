package br.com.upvibe.flutz.billing;

import java.sql.Timestamp;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.clinic.ClinicService;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class ClinicPaymentAccountService {

    private final JdbcTemplate jdbc;
    private final ClinicService clinic;
    private final MercadoPagoService mercadoPago;

    public ClinicPaymentAccountService(JdbcTemplate jdbc, ClinicService clinic, MercadoPagoService mercadoPago) {
        this.jdbc = jdbc;
        this.clinic = clinic;
        this.mercadoPago = mercadoPago;
    }

    public ContaView atual() {
        exigirAdminClinica();
        Integer empresaId = clinic.empresaAtual().getId();
        ContaView conta = buscarConectada(empresaId);
        if (conta != null) {
            return conta;
        }
        return jdbc.query(
                """
                SELECT conta_pagamento_id, provider, account_id, status_conta, public_key, nome_exibicao, connected_at
                FROM flutz.conta_pagamento
                WHERE empresa_id = ?
                ORDER BY conta_pagamento_id DESC
                LIMIT 1
                """,
                rs -> rs.next() ? mapView(rs) : ContaView.vazia(),
                empresaId
        );
    }

    @Transactional
    public ContaView salvar(SalvarConta req) {
        exigirAdminClinica();
        Integer empresaId = clinic.empresaAtual().getId();
        String publicKey = limpar(req.publicKey());
        String accessToken = limpar(req.accessToken());
        String nome = blank(req.nomeExibicao());
        mercadoPago.validarCredenciaisClinica(publicKey, accessToken);
        String accountId = "mp-" + empresaId + "-" + Integer.toHexString(publicKey.hashCode());
        jdbc.update(
                """
                UPDATE flutz.conta_pagamento
                SET status_conta = 'DESCONECTADA', disconnected_at = CURRENT_TIMESTAMP
                WHERE empresa_id = ? AND status_conta = 'CONECTADA'
                """,
                empresaId
        );
        Integer existente = jdbc.query(
                """
                SELECT conta_pagamento_id FROM flutz.conta_pagamento
                WHERE empresa_id = ? AND provider = 'mercadopago'
                ORDER BY conta_pagamento_id DESC LIMIT 1
                """,
                rs -> rs.next() ? rs.getInt(1) : null,
                empresaId
        );
        if (existente != null) {
            jdbc.update(
                    """
                    UPDATE flutz.conta_pagamento
                    SET account_id = ?, public_key = ?, access_token = ?, nome_exibicao = ?,
                        status_conta = 'CONECTADA', connected_at = CURRENT_TIMESTAMP, disconnected_at = NULL
                    WHERE conta_pagamento_id = ?
                    """,
                    accountId, publicKey, accessToken, nome, existente
            );
        } else {
            jdbc.update(
                    """
                    INSERT INTO flutz.conta_pagamento
                      (empresa_id, provider, account_id, status_conta, public_key, access_token, nome_exibicao, connected_at)
                    VALUES (?, 'mercadopago', ?, 'CONECTADA', ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    empresaId, accountId, publicKey, accessToken, nome
            );
        }
        return atual();
    }

    @Transactional
    public ContaView desconectar() {
        exigirAdminClinica();
        Integer empresaId = clinic.empresaAtual().getId();
        jdbc.update(
                """
                UPDATE flutz.conta_pagamento
                SET status_conta = 'DESCONECTADA', disconnected_at = CURRENT_TIMESTAMP, access_token = NULL
                WHERE empresa_id = ? AND status_conta = 'CONECTADA'
                """,
                empresaId
        );
        return atual();
    }

    public ContaCredenciais exigirCredenciais(Integer empresaId) {
        ContaCredenciais conta = jdbc.query(
                """
                SELECT conta_pagamento_id, public_key, access_token
                FROM flutz.conta_pagamento
                WHERE empresa_id = ? AND status_conta = 'CONECTADA' AND provider = 'mercadopago'
                ORDER BY conta_pagamento_id DESC
                LIMIT 1
                """,
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    return new ContaCredenciais(
                            rs.getInt(1),
                            rs.getString(2),
                            rs.getString(3)
                    );
                },
                empresaId
        );
        if (conta == null || conta.publicKey() == null || conta.publicKey().isBlank()
                || conta.accessToken() == null || conta.accessToken().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "A clínica ainda não configurou a conta de recebimento. Peça para cadastrar o Mercado Pago em Financeiro."
            );
        }
        return conta;
    }

    public ContaView buscarConectada(Integer empresaId) {
        return jdbc.query(
                """
                SELECT conta_pagamento_id, provider, account_id, status_conta, public_key, nome_exibicao, connected_at
                FROM flutz.conta_pagamento
                WHERE empresa_id = ? AND status_conta = 'CONECTADA'
                ORDER BY conta_pagamento_id DESC
                LIMIT 1
                """,
                rs -> rs.next() ? mapView(rs) : null,
                empresaId
        );
    }

    private ContaView mapView(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp connected = rs.getTimestamp("connected_at");
        String publicKey = rs.getString("public_key");
        return new ContaView(
                rs.getInt("conta_pagamento_id"),
                rs.getString("provider"),
                rs.getString("account_id"),
                rs.getString("status_conta"),
                publicKey,
                mascarar(publicKey),
                rs.getString("nome_exibicao"),
                connected == null ? null : connected.toInstant().toString(),
                "CONECTADA".equalsIgnoreCase(rs.getString("status_conta"))
        );
    }

    private void exigirAdminClinica() {
        AuthPrincipal auth = AuthHolder.current();
        if (!(auth.temPapel("administrador") || auth.adminPlataforma())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da clínica");
        }
        clinic.empresaAtual();
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String limpar(String value) {
        if (value == null) {
            return null;
        }
        String limpo = value.replaceAll("\\s+", "").trim();
        return limpo.isEmpty() ? null : limpo;
    }

    private static String mascarar(String key) {
        if (key == null || key.length() < 8) {
            return key;
        }
        return key.substring(0, 6) + "…" + key.substring(key.length() - 4);
    }

    public record ContaView(
            Integer id,
            String provider,
            String accountId,
            String status,
            String publicKey,
            String publicKeyMascarada,
            String nomeExibicao,
            String conectadaEm,
            boolean conectada
    ) {
        static ContaView vazia() {
            return new ContaView(null, "mercadopago", null, "PENDENTE", null, null, null, null, false);
        }
    }

    public record ContaCredenciais(Integer id, String publicKey, String accessToken) {
    }

    public record SalvarConta(String publicKey, String accessToken, String nomeExibicao) {
    }

    public record RecebimentoResumo(Integer id, String descricao, java.math.BigDecimal valor, String status, String metodo, String pagoEm) {
    }

    public List<RecebimentoResumo> extrato() {
        exigirAdminClinica();
        Integer empresaId = clinic.empresaAtual().getId();
        return jdbc.query(
                """
                SELECT pagamento_id, descricao, valor, status_pagamento, metodo, pago_em
                FROM flutz.pagamento
                WHERE empresa_id = ?
                ORDER BY pagamento_id DESC
                LIMIT 100
                """,
                (rs, i) -> new RecebimentoResumo(
                        rs.getInt(1),
                        rs.getString(2),
                        rs.getBigDecimal(3),
                        rs.getString(4),
                        rs.getString(5),
                        rs.getTimestamp(6) == null ? null : rs.getTimestamp(6).toInstant().toString()
                ),
                empresaId
        );
    }
}
