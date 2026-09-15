package br.com.upvibe.flutz.clinic;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class ProfileService {

    private static final int TUTOR_PASTA = 0;

    private final JdbcTemplate jdbc;
    private final ClinicService clinic;
    private final ClinicMediaService media;
    private final PasswordEncoder passwords;

    public ProfileService(JdbcTemplate jdbc, ClinicService clinic, ClinicMediaService media, PasswordEncoder passwords) {
        this.jdbc = jdbc;
        this.clinic = clinic;
        this.media = media;
        this.passwords = passwords;
    }

    public Perfil atual() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            return jdbc.query(
                    """
                    SELECT nome_cliente, email, telefone, foto_url, permitir_notificacoes
                    FROM flutz.cliente WHERE cliente_id = ?
                    """,
                    rs -> {
                        if (!rs.next()) {
                            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Perfil não encontrado");
                        }
                        return new Perfil(
                                "tutor",
                                auth.atorId(),
                                rs.getString("nome_cliente"),
                                rs.getString("email"),
                                rs.getString("telefone"),
                                rs.getString("foto_url"),
                                rs.getBoolean("permitir_notificacoes"),
                                null, null, null, null, null, null
                        );
                    },
                    auth.atorId()
            );
        }
        if (auth.colaborador() || (auth.adminPlataforma() && auth.empresaId() != null)) {
            Integer empresaId = clinic.empresaAtual().getId();
            Perfil pessoa = auth.colaborador() ? colaborador(auth.atorId()) : null;
            ClinicaResumo clinica = clinica(empresaId);
            if (pessoa == null) {
                return new Perfil(
                        "clinica", auth.atorId(), auth.nome(), auth.identificador(), null, clinica.logoUrl(),
                        null, clinica.nome(), clinica.email(), clinica.telefone(), clinica.cidade(), clinica.uf(), clinica.logoUrl()
                );
            }
            return new Perfil(
                    "colaborador",
                    pessoa.atorId(),
                    pessoa.nome(),
                    pessoa.email(),
                    pessoa.telefone(),
                    pessoa.fotoUrl(),
                    pessoa.permitirNotificacoes(),
                    clinica.nome(),
                    clinica.email(),
                    clinica.telefone(),
                    clinica.cidade(),
                    clinica.uf(),
                    clinica.logoUrl()
            );
        }
        return new Perfil("plataforma", auth.atorId(), auth.nome(), auth.identificador(), null, null, null, null, null, null, null, null, null);
    }

    @Transactional
    public Perfil salvar(Atualizacao req) {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            if (req.nome() == null || req.nome().isBlank()) {
                if (req.permitirNotificacoes() == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome");
                }
                jdbc.update(
                        "UPDATE flutz.cliente SET permitir_notificacoes = ? WHERE cliente_id = ?",
                        req.permitirNotificacoes(),
                        auth.atorId()
                );
                return atual();
            }
            jdbc.update(
                    """
                    UPDATE flutz.cliente
                    SET nome_cliente = ?, email = ?, telefone = ?, permitir_notificacoes = COALESCE(?, permitir_notificacoes)
                    WHERE cliente_id = ?
                    """,
                    req.nome().trim(), blank(req.email()), blank(req.telefone()), req.permitirNotificacoes(), auth.atorId()
            );
            if (req.senha() != null && !req.senha().isBlank()) {
                exigirSenha(req.senha());
                jdbc.update("UPDATE flutz.cliente SET senha_hash = ? WHERE cliente_id = ?", passwords.encode(req.senha()), auth.atorId());
            }
            return atual();
        }
        if (auth.colaborador()) {
            if (req.nome() == null || req.nome().isBlank()) {
                if (req.permitirNotificacoes() == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome");
                }
                jdbc.update(
                        "UPDATE flutz.colaborador SET permitir_notificacoes = ? WHERE colaborador_id = ?",
                        req.permitirNotificacoes(),
                        auth.atorId()
                );
            } else {
                jdbc.update(
                        """
                        UPDATE flutz.colaborador
                        SET nome_colaborador = ?,
                            telefone = ?,
                            permitir_notificacoes = COALESCE(?, permitir_notificacoes)
                        WHERE colaborador_id = ?
                        """,
                        req.nome().trim(), blank(req.telefone()), req.permitirNotificacoes(), auth.atorId()
                );
                if (req.senha() != null && !req.senha().isBlank()) {
                    exigirSenha(req.senha());
                    jdbc.update("UPDATE flutz.colaborador SET senha_hash = ? WHERE colaborador_id = ?", passwords.encode(req.senha()), auth.atorId());
                }
            }
        }
        if (atualizaClinica(auth, req)) {
            Integer empresaId = clinic.empresaAtual().getId();
            jdbc.update(
                    """
                    UPDATE flutz.empresa
                    SET nome_empresa = COALESCE(?, nome_empresa),
                        email = COALESCE(?, email),
                        telefone = ?,
                        cidade = ?,
                        uf = ?
                    WHERE empresa_id = ?
                    """,
                    blank(req.nomeClinica()), blank(req.emailClinica()), blank(req.telefoneClinica()),
                    blank(req.cidade()), blank(req.uf()), empresaId
            );
        }
        return atual();
    }

    @Transactional
    public void salvarPet(Integer petId, PetAtualizacao req) {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor edita o perfil do pet");
        }
        Integer dono = jdbc.query(
                "SELECT cliente_id FROM flutz.pet WHERE pet_id = ?",
                rs -> rs.next() ? rs.getInt(1) : null,
                petId
        );
        if (dono == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pet não encontrado");
        }
        if (!dono.equals(auth.atorId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este pet não é seu");
        }
        if (req.nome() == null || req.nome().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome do pet");
        }
        var atual = jdbc.query(
                "SELECT pet_especie_id, pet_raca_id, sexo, data_aniversario, peso FROM flutz.pet WHERE pet_id = ?",
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    return new Object[] {
                            rs.getInt("pet_especie_id"),
                            (Integer) rs.getObject("pet_raca_id"),
                            rs.getString("sexo"),
                            rs.getDate("data_aniversario") == null ? null : rs.getDate("data_aniversario").toLocalDate(),
                            rs.getBigDecimal("peso")
                    };
                },
                petId
        );
        if (atual == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pet não encontrado");
        }

        String sexo;
        if (req.sexo() == null || req.sexo().isBlank()) {
            sexo = atual[2] == null ? "I" : String.valueOf(atual[2]);
        } else {
            sexo = req.sexo().trim().toUpperCase(Locale.ROOT);
        }
        if (!sexo.equals("M") && !sexo.equals("F") && !sexo.equals("I")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sexo inválido");
        }

        Integer especieId = (Integer) atual[0];
        Integer racaId = (Integer) atual[1];
        LocalDate nascimento = (LocalDate) atual[3];
        BigDecimal peso = (BigDecimal) atual[4];

        if (req.especieId() != null) {
            especieId = req.especieId();
            Long especieOk = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM flutz.pet_especie WHERE pet_especie_id = ?",
                    Long.class,
                    especieId
            );
            if (especieOk == null || especieOk == 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Espécie inválida");
            }
            racaId = req.racaId();
            if (req.dataAniversario() == null || req.dataAniversario().isBlank()) {
                nascimento = null;
            } else {
                nascimento = LocalDate.parse(req.dataAniversario().trim());
            }
            peso = req.peso();
        } else if (req.racaId() != null) {
            racaId = req.racaId();
        }

        if (racaId != null) {
            Integer especieDaRaca = jdbc.query(
                    "SELECT pet_especie_id FROM flutz.pet_raca WHERE pet_raca_id = ?",
                    rs -> rs.next() ? rs.getInt(1) : null,
                    racaId
            );
            if (especieDaRaca == null || !especieDaRaca.equals(especieId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Raça inválida para esta espécie");
            }
        }
        if (peso != null && peso.signum() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Peso inválido");
        }

        jdbc.update(
                """
                UPDATE flutz.pet
                SET nome_pet = ?,
                    sexo = ?,
                    pet_especie_id = ?,
                    pet_raca_id = ?,
                    data_aniversario = ?,
                    peso = ?
                WHERE pet_id = ?
                """,
                req.nome().trim(),
                sexo,
                especieId,
                racaId,
                nascimento,
                peso,
                petId
        );
    }

    public ClinicMediaService.ArquivoSalvo foto(
            String alvo,
            Integer petId,
            Integer colaboradorId,
            Integer clienteId,
            MultipartFile arquivo
    ) {
        AuthPrincipal auth = AuthHolder.current();
        String tipo = alvo == null ? "" : alvo.trim().toLowerCase();
        if ("tutor".equals(tipo)) {
            Integer id = resolverClienteFoto(auth, clienteId);
            ClinicMediaService.ArquivoSalvo salvo = media.gravar(TUTOR_PASTA, "perfil", arquivo);
            jdbc.update("UPDATE flutz.cliente SET foto_url = ? WHERE cliente_id = ?", salvo.url(), id);
            return salvo;
        }
        if ("pet".equals(tipo)) {
            if (!auth.tutor() || petId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o pet");
            }
            Integer dono = jdbc.query(
                    "SELECT cliente_id FROM flutz.pet WHERE pet_id = ? AND cliente_id = ?",
                    rs -> rs.next() ? rs.getInt(1) : null,
                    petId, auth.atorId()
            );
            if (dono == null) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este pet não é seu");
            }
            ClinicMediaService.ArquivoSalvo salvo = media.gravar(TUTOR_PASTA, "perfil", arquivo);
            jdbc.update("UPDATE flutz.pet SET foto_url = ? WHERE pet_id = ?", salvo.url(), petId);
            return salvo;
        }
        if ("colaborador".equals(tipo)) {
            Integer id = resolverColaboradorFoto(auth, colaboradorId);
            ClinicMediaService.ArquivoSalvo salvo = media.gravar(clinic.empresaAtual().getId(), "perfil", arquivo);
            jdbc.update("UPDATE flutz.colaborador SET imagem_url = ? WHERE colaborador_id = ?", salvo.url(), id);
            return salvo;
        }
        if ("clinica".equals(tipo)) {
            if (!adminDaClinica(auth)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da clínica altera a logo");
            }
            ClinicMediaService.ArquivoSalvo salvo = media.gravar(clinic.empresaAtual().getId(), "logo", arquivo);
            jdbc.update("UPDATE flutz.empresa SET logo_url = ? WHERE empresa_id = ?", salvo.url(), clinic.empresaAtual().getId());
            return salvo;
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Alvo de foto inválido");
    }

    private Integer resolverClienteFoto(AuthPrincipal auth, Integer clienteId) {
        if (auth.tutor()) {
            return auth.atorId();
        }
        if (!adminDaClinica(auth) || clienteId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor ou a clínica vinculada altera esta foto");
        }
        Integer empresaId = clinic.empresaAtual().getId();
        Integer encontrado = jdbc.query(
                "SELECT cliente_id FROM flutz.empresa_cliente WHERE empresa_id = ? AND cliente_id = ?",
                rs -> rs.next() ? rs.getInt(1) : null,
                empresaId,
                clienteId
        );
        if (encontrado == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este tutor não está nesta clínica");
        }
        return encontrado;
    }

    private Integer resolverColaboradorFoto(AuthPrincipal auth, Integer colaboradorId) {
        if (auth.colaborador() && (colaboradorId == null || colaboradorId.equals(auth.atorId()))) {
            return auth.atorId();
        }
        if (!adminDaClinica(auth) || colaboradorId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o colaborador ou o administrador da clínica altera esta foto");
        }
        Integer empresaId = clinic.empresaAtual().getId();
        Integer encontrado = jdbc.query(
                "SELECT colaborador_id FROM flutz.colaborador WHERE colaborador_id = ? AND empresa_id = ?",
                rs -> rs.next() ? rs.getInt(1) : null,
                colaboradorId,
                empresaId
        );
        if (encontrado == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este colaborador não está nesta clínica");
        }
        return encontrado;
    }

    private static boolean atualizaClinica(AuthPrincipal auth, Atualizacao req) {
        boolean pode = (auth.colaborador() && auth.temPapel("administrador"))
                || (auth.adminPlataforma() && auth.empresaId() != null);
        if (!pode) {
            return false;
        }
        return req.nomeClinica() != null
                || req.emailClinica() != null
                || req.telefoneClinica() != null
                || req.cidade() != null
                || req.uf() != null;
    }

    private boolean adminDaClinica(AuthPrincipal auth) {
        return (auth.colaborador() && auth.temPapel("administrador"))
                || (auth.adminPlataforma() && auth.empresaId() != null);
    }

    private Perfil colaborador(Integer id) {
        return jdbc.query(
                "SELECT colaborador_id, nome_colaborador, email, telefone, imagem_url, permitir_notificacoes FROM flutz.colaborador WHERE colaborador_id = ?",
                rs -> {
                    if (!rs.next()) {
                        return null;
                    }
                    return new Perfil(
                            "colaborador",
                            rs.getInt("colaborador_id"),
                            rs.getString("nome_colaborador"),
                            rs.getString("email"),
                            rs.getString("telefone"),
                            rs.getString("imagem_url"),
                            rs.getBoolean("permitir_notificacoes"),
                            null, null, null, null, null, null
                    );
                },
                id
        );
    }

    private ClinicaResumo clinica(Integer empresaId) {
        return jdbc.query(
                "SELECT nome_empresa, email, telefone, cidade, uf, logo_url FROM flutz.empresa WHERE empresa_id = ?",
                rs -> {
                    if (!rs.next()) {
                        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Clínica não encontrada");
                    }
                    return new ClinicaResumo(
                            rs.getString("nome_empresa"),
                            rs.getString("email"),
                            rs.getString("telefone"),
                            rs.getString("cidade"),
                            rs.getString("uf"),
                            rs.getString("logo_url")
                    );
                },
                empresaId
        );
    }

    private static void exigirSenha(String senha) {
        if (senha.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A senha precisa ter pelo menos 8 caracteres");
        }
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record Perfil(
            String tipo,
            Integer atorId,
            String nome,
            String email,
            String telefone,
            String fotoUrl,
            Boolean permitirNotificacoes,
            String nomeClinica,
            String emailClinica,
            String telefoneClinica,
            String cidade,
            String uf,
            String logoUrl
    ) {
    }

    public record Atualizacao(
            String nome,
            String email,
            String telefone,
            String senha,
            Boolean permitirNotificacoes,
            String nomeClinica,
            String emailClinica,
            String telefoneClinica,
            String cidade,
            String uf
    ) {
    }

    public record PetAtualizacao(
            String nome,
            String sexo,
            Integer especieId,
            Integer racaId,
            String dataAniversario,
            BigDecimal peso
    ) {
    }

    private record ClinicaResumo(String nome, String email, String telefone, String cidade, String uf, String logoUrl) {
    }
}
