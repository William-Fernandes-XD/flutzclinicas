package br.com.upvibe.flutz.auth;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.billing.TokenBillingService;
import br.com.upvibe.flutz.config.AppProperties;
import br.com.upvibe.flutz.domain.AdministradorSistema;
import br.com.upvibe.flutz.domain.AdministradorSistemaRepository;
import br.com.upvibe.flutz.domain.Assinatura;
import br.com.upvibe.flutz.domain.AssinaturaRepository;
import br.com.upvibe.flutz.domain.Cliente;
import br.com.upvibe.flutz.domain.ClienteRepository;
import br.com.upvibe.flutz.domain.Colaborador;
import br.com.upvibe.flutz.domain.ColaboradorRepository;
import br.com.upvibe.flutz.domain.ColaboradorRole;
import br.com.upvibe.flutz.domain.ColaboradorRoleRepository;
import br.com.upvibe.flutz.domain.Empresa;
import br.com.upvibe.flutz.domain.EmpresaRepository;
import br.com.upvibe.flutz.domain.Plano;
import br.com.upvibe.flutz.domain.PlanoRepository;
import br.com.upvibe.flutz.domain.Role;
import br.com.upvibe.flutz.domain.RoleRepository;
import br.com.upvibe.flutz.domain.Status;
import br.com.upvibe.flutz.domain.StatusRepository;
import br.com.upvibe.flutz.exception.RetryLaterException;
import br.com.upvibe.flutz.security.AtorTipo;
import br.com.upvibe.flutz.security.AuthPrincipal;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;

@Service
public class AuthService {

    private static final String LOGIN_FALHOU = "Não foi possível entrar. Verifique os dados.";
    private static final Pattern CPF = Pattern.compile("^\\d{11}$");

    private final AdministradorSistemaRepository administradores;
    private final ColaboradorRepository colaboradores;
    private final ColaboradorRoleRepository colaboradorRoles;
    private final ClienteRepository clientes;
    private final EmpresaRepository empresas;
    private final AssinaturaRepository assinaturas;
    private final PlanoRepository planos;
    private final StatusRepository statuses;
    private final RoleRepository roles;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;
    private final AppProperties properties;
    private final TokenBillingService billing;
    private final EntityManager entityManager;

    public AuthService(
            AdministradorSistemaRepository administradores,
            ColaboradorRepository colaboradores,
            ColaboradorRoleRepository colaboradorRoles,
            ClienteRepository clientes,
            EmpresaRepository empresas,
            AssinaturaRepository assinaturas,
            PlanoRepository planos,
            StatusRepository statuses,
            RoleRepository roles,
            PasswordEncoder passwords,
            JdbcTemplate jdbc,
            AppProperties properties,
            TokenBillingService billing,
            EntityManager entityManager
    ) {
        this.administradores = administradores;
        this.colaboradores = colaboradores;
        this.colaboradorRoles = colaboradorRoles;
        this.clientes = clientes;
        this.empresas = empresas;
        this.assinaturas = assinaturas;
        this.planos = planos;
        this.statuses = statuses;
        this.roles = roles;
        this.passwords = passwords;
        this.jdbc = jdbc;
        this.properties = properties;
        this.billing = billing;
        this.entityManager = entityManager;
    }

    public AuthPrincipal login(String identificador, String senha, HttpServletRequest request) {
        String chave = lockKey(identificador, request);
        assertUnlocked(chave);

        String raw = identificador == null ? "" : identificador.trim();
        String digits = raw.replaceAll("\\D", "");
        AuthPrincipal principal = null;

        if (CPF.matcher(digits).matches()) {
            principal = loginCliente(digits, senha);
        } else {
            principal = loginAdmin(raw, senha);
            if (principal == null) {
                principal = loginColaborador(raw, senha);
            }
        }

        if (principal == null) {
            long espera = 0;
            try {
                espera = registrarFalha(chave);
            } catch (Exception ignored) {
                /* o bloqueio de login não pode esconder a senha inválida */
            }
            if (espera > 0) {
                throw new RetryLaterException(HttpStatus.UNAUTHORIZED, LOGIN_FALHOU, espera);
            }
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, LOGIN_FALHOU);
        }

        try {
            limparFalha(chave);
        } catch (Exception ignored) {
            /* sessão válida mesmo se o registro de tentativa falhar */
        }
        return principal;
    }

    @Transactional
    public AuthPrincipal cadastrarClinica(CadastroClinicaRequest req) {
        if (req.nomeEmpresa() == null || req.nomeEmpresa().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome da clínica");
        }
        if (req.emailClinica() == null || req.emailClinica().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o e-mail da clínica");
        }
        if (req.nomeResponsavel() == null || req.nomeResponsavel().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome do responsável");
        }
        if (req.emailResponsavel() == null || req.emailResponsavel().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o e-mail de acesso");
        }
        Status ativo = statusAtivo();
        String cnpj = onlyDigits(req.cnpj());
        if (cnpj.length() != 14) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CNPJ inválido");
        }
        String cpf = onlyDigits(req.cpfResponsavel());
        if (cpf.length() != 11) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CPF do responsável inválido");
        }
        if (req.senha() == null || req.senha().length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A senha precisa ter pelo menos 8 caracteres");
        }
        if (empresas.existsByCnpj(cnpj)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe clínica com este CNPJ");
        }
        if (colaboradores.existsByEmailIgnoreCase(req.emailResponsavel())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este e-mail já está em uso");
        }

        Plano plano;
        String codigoInformado = req.codigoPlano() == null ? "" : req.codigoPlano().trim();
        if (codigoInformado.isBlank()
                || "BASICO".equalsIgnoreCase(codigoInformado)
                || "PROFISSIONAL".equalsIgnoreCase(codigoInformado)
                || "PREMIUM".equalsIgnoreCase(codigoInformado)) {
            plano = planos.findByCodigoIgnoreCase("FLUTZ")
                    .or(() -> planos.findByAtivoTrueOrderByValorMensalAsc().stream().findFirst())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plano inválido"));
        } else {
            plano = planos.findByCodigoIgnoreCase(codigoInformado)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plano inválido"));
        }
        if (!plano.isAtivo()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Plano indisponível");
        }

        String slug = uniqueSlug(req.nomeEmpresa());

        Empresa empresa = new Empresa();
        empresa.setNomeEmpresa(req.nomeEmpresa().trim());
        empresa.setRazaoSocial(blankToNull(req.razaoSocial()));
        empresa.setCnpj(cnpj);
        empresa.setEmail(req.emailClinica().trim());
        empresa.setTelefone(blankToNull(req.telefone()));
        empresa.setIdentificadorUrl(slug);
        empresa.setDescricaoEmpresa(blankToNull(req.descricao()));
        empresa.setCidade(blankToNull(req.cidade()));
        empresa.setUf(normalizarUf(req.uf()));
        empresa.setStatus(ativo);
        empresa.setLatitude(br.com.upvibe.flutz.geo.Brasilia.LAT);
        empresa.setLongitude(br.com.upvibe.flutz.geo.Brasilia.LNG);
        empresas.save(empresa);

        Colaborador dono = new Colaborador();
        dono.setEmpresa(empresa);
        dono.setNomeColaborador(req.nomeResponsavel().trim());
        dono.setCpf(cpf);
        dono.setEmail(req.emailResponsavel().trim().toLowerCase(Locale.ROOT));
        dono.setSenhaHash(passwords.encode(req.senha()));
        dono.setTelefone(blankToNull(req.telefoneResponsavel()));
        dono.setCargo("Responsável");
        dono.setExibirPagina(false);
        dono.setStatus(ativo);
        colaboradores.save(dono);

        Role adminRole = roles.findByDescricaoIgnoreCase("administrador")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Papel administrador ausente"));
        ColaboradorRole vinculo = new ColaboradorRole();
        vinculo.setColaborador(dono);
        vinculo.setRole(adminRole);
        colaboradorRoles.save(vinculo);

        Assinatura assinatura = new Assinatura();
        assinatura.setEmpresa(empresa);
        assinatura.setPlano(plano);
        assinatura.setStatusAssinatura("TRIAL");
        assinatura.setDataInicio(LocalDate.now());
        assinatura.setDataProximoVencimento(LocalDate.now().plusDays(14));
        assinaturas.save(assinatura);
        entityManager.flush();
        criarSecoesPadrao(empresa.getId(), plano.isPermiteDoacoes());
        billing.abrirFaturaCadastro(
                assinatura.getId(),
                empresa.getId(),
                plano.getValorMensal(),
                LocalDate.now().plusDays(14),
                req.codigoToken()
        );

        return toColaboradorPrincipal(dono);
    }

    @Transactional
    public AuthPrincipal cadastrarTutor(CadastroTutorRequest req) {
        Status ativo = statusAtivo();
        String cpf = onlyDigits(req.cpf());
        if (cpf.length() != 11) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CPF inválido");
        }
        if (req.nome() == null || req.nome().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome");
        }
        if (req.senha() == null || req.senha().length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A senha precisa ter pelo menos 8 caracteres");
        }

        Cliente existente = clientes.findByCpf(cpf).orElse(null);
        if (existente != null) {
            if (existente.isCadastroCompleto()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Já existe cadastro com este CPF. Entre com CPF e senha."
                );
            }
            // Claim do histórico walk-in
            existente.setNomeCliente(req.nome().trim());
            existente.setSenhaHash(passwords.encode(req.senha()));
            existente.setCadastroCompleto(true);
            if (blankToNull(req.email()) != null) {
                existente.setEmail(blankToNull(req.email()));
            }
            if (blankToNull(req.telefone()) != null) {
                existente.setTelefone(blankToNull(req.telefone()));
            }
            existente.setStatus(ativo);
            clientes.save(existente);
            return new AuthPrincipal(
                    AtorTipo.CLIENTE,
                    existente.getId(),
                    null,
                    existente.getNomeCliente(),
                    existente.getCpf(),
                    List.of("tutor")
            );
        }

        Cliente cliente = new Cliente();
        cliente.setNomeCliente(req.nome().trim());
        cliente.setCpf(cpf);
        cliente.setSenhaHash(passwords.encode(req.senha()));
        cliente.setCadastroCompleto(true);
        cliente.setEmail(blankToNull(req.email()));
        cliente.setTelefone(blankToNull(req.telefone()));
        cliente.setPermitirNotificacoes(true);
        cliente.setStatus(ativo);
        clientes.save(cliente);

        return new AuthPrincipal(
                AtorTipo.CLIENTE,
                cliente.getId(),
                null,
                cliente.getNomeCliente(),
                cliente.getCpf(),
                List.of("tutor")
        );
    }

    public HistoricoWalkIn historicoWalkInPorCpf(String cpfBruto) {
        String cpf = onlyDigits(cpfBruto);
        if (cpf.length() != 11) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CPF inválido");
        }
        return clientes.findByCpf(cpf)
                .filter(c -> !c.isCadastroCompleto())
                .map(c -> {
                    Integer id = c.getId();
                    long pets = count("SELECT COUNT(*) FROM flutz.pet WHERE cliente_id = ?", id);
                    long atendimentos = count("SELECT COUNT(*) FROM flutz.atendimento WHERE cliente_id = ?", id);
                    long vacinas = count(
                            """
                            SELECT COUNT(*) FROM flutz.historico_vacinacao h
                            JOIN flutz.pet p ON p.pet_id = h.pet_id
                            WHERE p.cliente_id = ?
                            """,
                            id
                    );
                    return new HistoricoWalkIn(true, pets, atendimentos, vacinas);
                })
                .orElse(new HistoricoWalkIn(false, 0, 0, 0));
    }

    private long count(String sql, Object... args) {
        Long n = jdbc.queryForObject(sql, Long.class, args);
        return n == null ? 0 : n;
    }

    private void criarSecoesPadrao(Integer empresaId, boolean permiteDoacoes) {
        String[] tipos = {
                "HERO", "SOBRE", "SERVICOS", "ESPECIALIDADE", "EQUIPE",
                "AVALIACOES", "GALERIA", "LOCALIZACAO", "CONTATO", "DOACOES"
        };
        for (int i = 0; i < tipos.length; i++) {
            boolean visivel = !"DOACOES".equals(tipos[i]) || permiteDoacoes;
            jdbc.update(
                    """
                    INSERT INTO flutz.pagina_secao (empresa_id, tipo_secao, ordem, visivel)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT (empresa_id, tipo_secao) DO NOTHING
                    """,
                    empresaId,
                    tipos[i],
                    i + 1,
                    visivel
            );
        }
    }

    public AuthPrincipal me(AuthPrincipal current) {
        return current;
    }

    private AuthPrincipal loginAdmin(String email, String senha) {
        return administradores.findByEmailIgnoreCase(email)
                .filter(AdministradorSistema::ativo)
                .filter(admin -> passwords.matches(senha, admin.getSenhaHash()))
                .map(admin -> new AuthPrincipal(
                        AtorTipo.ADMINISTRADOR_SISTEMA,
                        admin.getId(),
                        null,
                        admin.getNome(),
                        admin.getEmail(),
                        List.of("plataforma")
                ))
                .orElse(null);
    }

    private AuthPrincipal loginColaborador(String email, String senha) {
        return colaboradores.findByEmailIgnoreCase(email)
                .filter(Colaborador::ativo)
                .filter(colaborador -> passwords.matches(senha, colaborador.getSenhaHash()))
                .map(this::toColaboradorPrincipal)
                .orElse(null);
    }

    private AuthPrincipal loginCliente(String cpf, String senha) {
        return clientes.findByCpf(cpf)
                .filter(Cliente::ativo)
                .filter(Cliente::isCadastroCompleto)
                .filter(cliente -> cliente.getSenhaHash() != null && !cliente.getSenhaHash().isBlank())
                .filter(cliente -> passwords.matches(senha, cliente.getSenhaHash()))
                .map(cliente -> new AuthPrincipal(
                        AtorTipo.CLIENTE,
                        cliente.getId(),
                        null,
                        cliente.getNomeCliente(),
                        cliente.getCpf(),
                        List.of("tutor")
                ))
                .orElse(null);
    }

    private AuthPrincipal toColaboradorPrincipal(Colaborador colaborador) {
        List<String> papeis = colaboradorRoles.findByColaboradorId(colaborador.getId()).stream()
                .map(item -> item.getRole().getDescricao())
                .toList();
        return new AuthPrincipal(
                AtorTipo.COLABORADOR,
                colaborador.getId(),
                colaborador.getEmpresa().getId(),
                colaborador.getNomeColaborador(),
                colaborador.getEmail(),
                papeis
        );
    }

    private void assertUnlocked(String chave) {
        int increment = lockIncrement();
        if (increment <= 0) {
            return;
        }
        Instant now = Instant.now();
        List<Instant> bloqueios = jdbc.query(
                "SELECT bloqueado_ate FROM flutz.tentativa_login WHERE chave = ?",
                (rs, rowNum) -> rs.getTimestamp("bloqueado_ate") == null
                        ? null
                        : rs.getTimestamp("bloqueado_ate").toInstant(),
                chave
        );
        Instant ate = bloqueios.stream().filter(item -> item != null && item.isAfter(now)).findFirst().orElse(null);
        if (ate != null) {
            long segundos = Math.max(1, Duration.between(now, ate).getSeconds());
            throw new RetryLaterException(HttpStatus.TOO_MANY_REQUESTS, waitMessage(segundos), segundos);
        }
    }

    private long registrarFalha(String chave) {
        int increment = lockIncrement();
        if (increment <= 0) {
            return 0;
        }
        Integer falhas = jdbc.queryForObject(
                """
                INSERT INTO flutz.tentativa_login (chave, falhas, bloqueado_ate, ultima_falha)
                VALUES (?, 1, CURRENT_TIMESTAMP + make_interval(secs => ?), CURRENT_TIMESTAMP)
                ON CONFLICT (chave) DO UPDATE
                SET falhas = flutz.tentativa_login.falhas + 1,
                    bloqueado_ate = CURRENT_TIMESTAMP + make_interval(secs => (flutz.tentativa_login.falhas + 1) * ?),
                    ultima_falha = CURRENT_TIMESTAMP
                RETURNING falhas
                """,
                Integer.class,
                chave,
                increment,
                increment
        );
        int count = falhas == null ? 1 : falhas;
        return (long) count * increment;
    }

    private int lockIncrement() {
        Integer increment = properties.security() == null ? null : properties.security().loginLockIncrementSeconds();
        return increment == null ? 5 : increment;
    }

    static String waitMessage(long seconds) {
        if (seconds <= 1) {
            return "Aguarde 1 segundo para a próxima tentativa.";
        }
        return "Aguarde " + seconds + " segundos para a próxima tentativa.";
    }

    private void limparFalha(String chave) {
        jdbc.update("DELETE FROM flutz.tentativa_login WHERE chave = ?", chave);
    }

    private String lockKey(String identificador, HttpServletRequest request) {
        String ip = request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
        return (identificador == null ? "" : identificador.trim().toLowerCase(Locale.ROOT)) + "|" + ip;
    }

    private Status statusAtivo() {
        return statuses.findByDescricaoIgnoreCase("ativo")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Status ativo ausente"));
    }

    private String uniqueSlug(String nome) {
        String base = nome == null ? "clinica" : nome.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (base.isBlank()) {
            base = "clinica";
        }
        String slug = base;
        int i = 2;
        while (empresas.existsByIdentificadorUrl(slug)) {
            slug = base + "-" + i++;
        }
        return slug.length() > 80 ? slug.substring(0, 80) : slug;
    }

    private static String normalizarUf(String uf) {
        if (uf == null || uf.isBlank()) {
            return null;
        }
        String letters = uf.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z]", "");
        if (letters.length() == 2) {
            return letters;
        }
        throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Informe a UF com 2 letras, por exemplo DF ou SP."
        );
    }

    private static String onlyDigits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record CadastroTutorRequest(
            String nome,
            String cpf,
            String email,
            String telefone,
            String senha
    ) {
    }

    public record HistoricoWalkIn(
            boolean temHistorico,
            long qtdPets,
            long qtdAtendimentos,
            long qtdVacinas
    ) {
    }

    public record CadastroClinicaRequest(
            String nomeEmpresa,
            String razaoSocial,
            String cnpj,
            String emailClinica,
            String telefone,
            String cidade,
            String uf,
            String descricao,
            String codigoPlano,
            String nomeResponsavel,
            String cpfResponsavel,
            String emailResponsavel,
            String telefoneResponsavel,
            String senha,
            String codigoToken
    ) {
    }
}
