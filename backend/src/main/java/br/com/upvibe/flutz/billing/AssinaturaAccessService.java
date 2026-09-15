package br.com.upvibe.flutz.billing;

import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class AssinaturaAccessService {

    private static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");
    private final JdbcTemplate jdbc;

    public AssinaturaAccessService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean clinicaPodeOperar(Integer empresaId) {
        if (empresaId == null) {
            return true;
        }
        Acesso acesso = carregar(empresaId);
        return acesso == null || acesso.podeOperar();
    }

    public Acesso acesso(Integer empresaId) {
        Acesso acesso = carregar(empresaId);
        return acesso == null ? new Acesso("SEM_ASSINATURA", null, true) : acesso;
    }

    private Acesso carregar(Integer empresaId) {
        return jdbc.query(
                """
                SELECT a.status_assinatura, f.data_vencimento,
                       COALESCE(f.data_vencimento, a.data_proximo_vencimento) + a.dias_tolerancia AS data_limite
                FROM flutz.assinatura a
                LEFT JOIN LATERAL (
                    SELECT data_vencimento
                    FROM flutz.fatura_assinatura
                    WHERE assinatura_id = a.assinatura_id
                      AND status_fatura IN ('PENDENTE', 'ATRASADA')
                    ORDER BY data_vencimento ASC
                    LIMIT 1
                ) f ON TRUE
                WHERE a.empresa_id = ?
                ORDER BY a.assinatura_id DESC
                LIMIT 1
                """,
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    LocalDate limite = rs.getDate("data_limite") == null
                            ? null
                            : rs.getDate("data_limite").toLocalDate();
                    String status = rs.getString("status_assinatura");
                    boolean prazoAberto = rs.getDate("data_vencimento") == null
                            || limite == null
                            || !LocalDate.now(ZONA).isAfter(limite);
                    boolean podeOperar = ("TRIAL".equals(status) || "ATIVA".equals(status)) && prazoAberto;
                    return new Acesso(status, limite, podeOperar);
                },
                empresaId
        );
    }

    public record Acesso(String statusAssinatura, LocalDate dataLimiteAcesso, boolean podeOperar) {
    }
}
