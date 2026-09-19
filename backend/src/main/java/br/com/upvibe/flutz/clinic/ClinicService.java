package br.com.upvibe.flutz.clinic;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.domain.Agendamento;
import br.com.upvibe.flutz.domain.AgendamentoRepository;
import br.com.upvibe.flutz.domain.AgendamentoStatusRepository;
import br.com.upvibe.flutz.domain.AssinaturaRepository;
import br.com.upvibe.flutz.domain.Atendimento;
import br.com.upvibe.flutz.domain.AtendimentoRepository;
import br.com.upvibe.flutz.domain.AtendimentoStatusRepository;
import br.com.upvibe.flutz.domain.Cliente;
import br.com.upvibe.flutz.domain.ClienteRepository;
import br.com.upvibe.flutz.domain.Colaborador;
import br.com.upvibe.flutz.domain.ColaboradorRepository;
import br.com.upvibe.flutz.domain.ColaboradorRole;
import br.com.upvibe.flutz.domain.ColaboradorRoleRepository;
import br.com.upvibe.flutz.domain.Empresa;
import br.com.upvibe.flutz.domain.EmpresaCliente;
import br.com.upvibe.flutz.domain.EmpresaClienteRepository;
import br.com.upvibe.flutz.domain.EmpresaRepository;
import br.com.upvibe.flutz.domain.EmpresaServico;
import br.com.upvibe.flutz.domain.EmpresaServicoRepository;
import br.com.upvibe.flutz.domain.Pet;
import br.com.upvibe.flutz.domain.PetEspecieRepository;
import br.com.upvibe.flutz.domain.PetRacaRepository;
import br.com.upvibe.flutz.domain.PetRepository;
import br.com.upvibe.flutz.domain.Role;
import br.com.upvibe.flutz.domain.RoleRepository;
import br.com.upvibe.flutz.domain.Status;
import br.com.upvibe.flutz.domain.StatusRepository;
import br.com.upvibe.flutz.domain.TipoServicoRepository;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
@Transactional
public class ClinicService {

    private final EmpresaRepository empresas;
    private final ClienteRepository clientes;
    private final EmpresaClienteRepository empresaClientes;
    private final PetRepository pets;
    private final PetEspecieRepository especies;
    private final PetRacaRepository racas;
    private final ColaboradorRepository colaboradores;
    private final EmpresaServicoRepository servicos;
    private final TipoServicoRepository tiposServico;
    private final AgendamentoRepository agendamentos;
    private final AgendamentoStatusRepository agendamentoStatuses;
    private final AtendimentoRepository atendimentos;
    private final AtendimentoStatusRepository atendimentoStatuses;
    private final AssinaturaRepository assinaturas;
    private final StatusRepository statuses;
    private final RoleRepository roles;
    private final ColaboradorRoleRepository colaboradorRoles;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;

    public ClinicService(
            EmpresaRepository empresas,
            ClienteRepository clientes,
            EmpresaClienteRepository empresaClientes,
            PetRepository pets,
            PetEspecieRepository especies,
            PetRacaRepository racas,
            ColaboradorRepository colaboradores,
            EmpresaServicoRepository servicos,
            TipoServicoRepository tiposServico,
            AgendamentoRepository agendamentos,
            AgendamentoStatusRepository agendamentoStatuses,
            AtendimentoRepository atendimentos,
            AtendimentoStatusRepository atendimentoStatuses,
            AssinaturaRepository assinaturas,
            StatusRepository statuses,
            RoleRepository roles,
            ColaboradorRoleRepository colaboradorRoles,
            PasswordEncoder passwords,
            JdbcTemplate jdbc
    ) {
        this.empresas = empresas;
        this.clientes = clientes;
        this.empresaClientes = empresaClientes;
        this.pets = pets;
        this.especies = especies;
        this.racas = racas;
        this.colaboradores = colaboradores;
        this.servicos = servicos;
        this.tiposServico = tiposServico;
        this.agendamentos = agendamentos;
        this.agendamentoStatuses = agendamentoStatuses;
        this.atendimentos = atendimentos;
        this.atendimentoStatuses = atendimentoStatuses;
        this.assinaturas = assinaturas;
        this.statuses = statuses;
        this.roles = roles;
        this.colaboradorRoles = colaboradorRoles;
        this.passwords = passwords;
        this.jdbc = jdbc;
    }

    public Empresa empresaAtual() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.empresaId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem clínica no contexto");
        }
        return empresas.findById(auth.empresaId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Clínica não encontrada"));
    }

    public DashboardResponse painel() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            long vinculos = empresaClientes.findByClienteId(auth.atorId()).size();
            return new DashboardResponse("Tutor", auth.nome(), vinculos, 0, 0, 0, null, null);
        }
        if (auth.adminPlataforma() && auth.empresaId() == null) {
            return new DashboardResponse("Plataforma", auth.nome(), empresas.count(), 0, 0, 0, null, null);
        }
        Empresa empresa = empresaAtual();
        String plano = assinaturas.findFirstByEmpresaIdOrderByIdDesc(empresa.getId())
                .map(item -> item.getPlano().getNome() + " · " + item.getStatusAssinatura())
                .orElse("Sem assinatura");
        return new DashboardResponse(
                empresa.getNomeEmpresa(),
                auth.nome(),
                empresaClientes.findByEmpresaId(empresa.getId()).size(),
                pets.findVisiveisNaClinica(empresa.getId()).size(),
                agendamentos.findByEmpresaIdOrderByDataHoraInicioDesc(empresa.getId()).size(),
                atendimentos.findByEmpresaIdOrderByIdDesc(empresa.getId()).size(),
                plano,
                empresa.getIdentificadorUrl()
        );
    }

    public List<TutorResponse> tutores() {
        Empresa empresa = empresaAtual();
        Map<Integer, UltimoAtendimento> ultimos = carregarUltimosAtendimentos(empresa.getId());
        return empresaClientes.findByEmpresaId(empresa.getId()).stream()
                .map(vinculo -> {
                    Cliente cliente = vinculo.getCliente();
                    UltimoAtendimento ultimo = ultimos.get(cliente.getId());
                    boolean ativo = vinculo.getStatus() == null
                            || "ativo".equalsIgnoreCase(vinculo.getStatus().getDescricao());
                    return TutorResponse.from(
                            cliente,
                            ativo,
                            vinculo.getDataCriacao() == null ? null : vinculo.getDataCriacao().toString(),
                            ultimo == null ? null : ultimo.data(),
                            ultimo == null ? null : ultimo.servico()
                    );
                })
                .toList();
    }

    private Map<Integer, UltimoAtendimento> carregarUltimosAtendimentos(Integer empresaId) {
        List<UltimoAtendimento> rows = jdbc.query(
                """
                SELECT DISTINCT ON (a.cliente_id)
                       a.cliente_id,
                       a.data_hora_inicio,
                       COALESCE(NULLIF(es.nome_exibicao, ''), ts.tipo_servico, 'Atendimento') AS servico
                FROM flutz.agendamento a
                LEFT JOIN flutz.empresa_servico es ON es.empresa_servico_id = a.empresa_servico_id
                LEFT JOIN flutz.tipo_servico ts ON ts.tipo_servico_id = es.tipo_servico_id
                WHERE a.empresa_id = ?
                ORDER BY a.cliente_id, a.data_hora_inicio DESC
                """,
                (rs, i) -> new UltimoAtendimento(
                        rs.getInt("cliente_id"),
                        rs.getTimestamp("data_hora_inicio").toInstant().toString(),
                        rs.getString("servico")
                ),
                empresaId
        );
        Map<Integer, UltimoAtendimento> map = new HashMap<>();
        for (UltimoAtendimento row : rows) {
            map.put(row.clienteId(), row);
        }
        return map;
    }

    @Transactional
    public TutorPetsResponse buscarTutorPorCpf(String cpfBruto) {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a clínica consulta tutor por CPF");
        }
        String cpf = digits(cpfBruto);
        if (cpf.length() != 11) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um CPF válido");
        }
        Cliente cliente = clientes.findByCpf(cpf)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Nenhum tutor com este CPF"));
        Empresa empresa = empresaAtual();
        vincularTutor(empresa, cliente);
        List<PetResponse> animais = pets.findByClienteIdOrderByNomePetAsc(cliente.getId()).stream()
                .map(PetResponse::from)
                .toList();
        return new TutorPetsResponse(TutorResponse.from(cliente), animais);
    }

    @Transactional
    public TutorResponse criarTutor(NovoTutorRequest req) {
        Empresa empresa = empresaAtual();
        Status ativo = ativo();
        String cpf = digits(req.cpf());
        if (cpf.length() != 11) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CPF inválido");
        }
        Cliente cliente = clientes.findByCpf(cpf).orElseGet(() -> {
            if (req.senha() == null || req.senha().length() < 8) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe uma senha de pelo menos 8 caracteres para o tutor");
            }
            Cliente novo = new Cliente();
            novo.setNomeCliente(req.nome().trim());
            novo.setCpf(cpf);
            novo.setSenhaHash(passwords.encode(req.senha()));
            novo.setEmail(blank(req.email()));
            novo.setTelefone(blank(req.telefone()));
            novo.setPermitirNotificacoes(true);
            novo.setStatus(ativo);
            return clientes.save(novo);
        });
        if (empresaClientes.existsByEmpresaIdAndClienteId(empresa.getId(), cliente.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tutor já vinculado a esta clínica");
        }
        EmpresaCliente vinculo = new EmpresaCliente();
        vinculo.setEmpresa(empresa);
        vinculo.setCliente(cliente);
        vinculo.setStatus(ativo);
        empresaClientes.save(vinculo);
        return TutorResponse.from(cliente);
    }

    public List<PetResponse> listarPets() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            return pets.findByClienteIdOrderByNomePetAsc(auth.atorId()).stream().map(PetResponse::from).toList();
        }
        return pets.findVisiveisNaClinica(empresaAtual().getId()).stream().map(PetResponse::from).toList();
    }

    @Transactional
    public PetResponse criarPet(NovoPetRequest req) {
        AuthPrincipal auth = AuthHolder.current();
        if (req.nome() == null || req.nome().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o nome do pet");
        }
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "O pet é cadastrado pelo tutor, não pela clínica");
        }
        Cliente cliente = clientes.findById(auth.atorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tutor não encontrado"));
        Pet pet = new Pet();
        pet.setCliente(cliente);
        pet.setEspecie(especies.findById(req.especieId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Espécie inválida")));
        if (req.racaId() != null) {
            pet.setRaca(racas.findById(req.racaId()).orElse(null));
        }
        pet.setNomePet(req.nome().trim());
        pet.setSexo(req.sexo() == null ? "I" : req.sexo().toUpperCase(Locale.ROOT));
        pet.setPeso(req.peso());
        if (req.dataAniversario() != null && !req.dataAniversario().isBlank()) {
            pet.setDataAniversario(LocalDate.parse(req.dataAniversario()));
        }
        pet.setStatus(ativo());
        return PetResponse.from(pets.save(pet));
    }

    public List<ServicoResponse> servicos() {
        return servicos.findByEmpresaIdOrderByOrdemAsc(empresaAtual().getId()).stream().map(ServicoResponse::from).toList();
    }

    @Transactional
    public ServicoResponse criarServico(NovoServicoRequest req) {
        EmpresaServico servico = new EmpresaServico();
        servico.setEmpresa(empresaAtual());
        servico.setTipoServico(tiposServico.findById(req.tipoServicoId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de serviço inválido")));
        servico.setNomeExibicao(blank(req.nomeExibicao()));
        servico.setDescricao(blank(req.descricao()));
        if (req.preco() == null || req.preco().compareTo(java.math.BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o preço do serviço");
        }
        servico.setPreco(req.preco());
        servico.setDuracaoMinutos(req.duracaoMinutos());
        servico.setVisivelPagina(req.visivelPagina() == null || req.visivelPagina());
        servico.setStatus(ativo());
        try {
            return ServicoResponse.from(servicos.save(servico));
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Já existe um serviço com esse nome para este tipo nesta clínica"
            );
        }
    }

    @Transactional
    public void removerServico(Integer id) {
        exigirAdminClinica("remove serviços");
        EmpresaServico servico = buscarServicoDaClinica(id);
        if (servicoEmUso(servico.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Não é possível excluir esse serviço, pois já temos atendimentos atrelados a ele."
            );
        }
        try {
            servicos.delete(servico);
            servicos.flush();
        } catch (Exception ex) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Não é possível excluir esse serviço, pois já temos atendimentos atrelados a ele."
            );
        }
    }

    @Transactional
    public ServicoResponse desativarServico(Integer id) {
        exigirAdminClinica("desativa serviços");
        EmpresaServico servico = buscarServicoDaClinica(id);
        servico.setStatus(inativo());
        servico.setVisivelPagina(false);
        return ServicoResponse.from(servicos.save(servico));
    }

    @Transactional
    public ServicoResponse reativarServico(Integer id) {
        exigirAdminClinica("reativa serviços");
        EmpresaServico servico = buscarServicoDaClinica(id);
        servico.setStatus(ativo());
        return ServicoResponse.from(servicos.save(servico));
    }

    private EmpresaServico buscarServicoDaClinica(Integer id) {
        Integer empresaId = empresaAtual().getId();
        EmpresaServico servico = servicos.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Serviço não encontrado"));
        if (servico.getEmpresa() == null || !empresaId.equals(servico.getEmpresa().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Serviço de outra clínica");
        }
        return servico;
    }

    private boolean servicoEmUso(Integer empresaServicoId) {
        Long n = jdbc.queryForObject(
                """
                SELECT (
                  (SELECT COUNT(*) FROM flutz.agendamento WHERE empresa_servico_id = ?)
                  + (SELECT COUNT(*) FROM flutz.atendimento WHERE empresa_servico_id = ?)
                  + (SELECT COUNT(*) FROM flutz.pagamento WHERE empresa_servico_id = ?)
                )
                """,
                Long.class,
                empresaServicoId, empresaServicoId, empresaServicoId
        );
        return n != null && n > 0;
    }

    private void exigirAdminClinica(String acao) {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a clínica " + acao);
        }
        if (!(auth.temPapel("administrador") || auth.adminPlataforma())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da clínica " + acao);
        }
    }

    public List<ColaboradorResponse> equipe() {
        return colaboradores.findByEmpresaIdOrderByNomeColaboradorAsc(empresaAtual().getId()).stream()
                .map(item -> {
                    String papeis = colaboradorRoles.findByColaboradorId(item.getId()).stream()
                            .map(vinculo -> vinculo.getRole().getDescricao())
                            .filter(nome -> nome != null && !nome.isBlank())
                            .collect(java.util.stream.Collectors.joining(", "));
                    return new ColaboradorResponse(
                            item.getId(),
                            item.getNomeColaborador(),
                            item.getEmail(),
                            item.getCargo(),
                            item.getImagemUrl(),
                            papeis.isBlank() ? null : papeis,
                            item.isExibirPagina()
                    );
                })
                .toList();
    }

    public ColaboradorResponse criarColaborador(NovoColaboradorRequest req) {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.adminPlataforma() && (!auth.colaborador() || !auth.temPapel("administrador"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da clínica cadastra equipe");
        }
        Empresa empresa = empresaAtual();
        String cpf = digits(req.cpf());
        if (cpf.length() != 11) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CPF inválido");
        }
        if (req.senha() == null || req.senha().length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A senha precisa ter pelo menos 8 caracteres");
        }
        if (colaboradores.existsByEmailIgnoreCase(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este e-mail já está em uso");
        }
        if (colaboradores.existsByEmpresaIdAndCpf(empresa.getId(), cpf)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Já existe colaborador com este CPF nesta clínica");
        }
        Role papel = roles.findByDescricaoIgnoreCase(req.papel() == null ? "" : req.papel())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Papel inválido"));

        Colaborador item = new Colaborador();
        item.setEmpresa(empresa);
        item.setNomeColaborador(req.nome().trim());
        item.setCpf(cpf);
        item.setEmail(req.email().trim().toLowerCase(Locale.ROOT));
        item.setSenhaHash(passwords.encode(req.senha()));
        item.setTelefone(blank(req.telefone()));
        item.setCargo(blank(req.cargo()));
        item.setExibirPagina(false);
        item.setStatus(ativo());
        colaboradores.save(item);

        ColaboradorRole vinculo = new ColaboradorRole();
        vinculo.setColaborador(item);
        vinculo.setRole(papel);
        colaboradorRoles.save(vinculo);
        return ColaboradorResponse.from(item);
    }

    public List<AgendamentoResponse> agenda() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            return empresaClientes.findByClienteId(auth.atorId()).stream()
                    .flatMap(vinculo -> agendamentos.findByEmpresaIdAndClienteIdOrderByDataHoraInicioDesc(vinculo.getEmpresa().getId(), auth.atorId()).stream())
                    .map(AgendamentoResponse::from)
                    .toList();
        }
        return agendamentos.findByEmpresaIdOrderByDataHoraInicioDesc(empresaAtual().getId()).stream()
                .map(AgendamentoResponse::from)
                .toList();
    }

    @Transactional
    public AgendamentoResponse criarAgendamento(NovoAgendamentoRequest req) {
        AuthPrincipal auth = AuthHolder.current();
        Empresa empresa = auth.tutor()
                ? empresas.findById(req.empresaId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Clínica inválida"))
                : empresaAtual();
        if (auth.tutor()) {
            if (!empresaClientes.existsByEmpresaIdAndClienteId(empresa.getId(), auth.atorId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem vínculo com esta clínica");
            }
        }
        Cliente cliente = auth.tutor()
                ? clientes.findById(auth.atorId()).orElseThrow()
                : clientes.findById(req.clienteId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tutor não encontrado"));
        Pet pet = exigirPetDoTutor(req.petId(), cliente.getId());
        if (!auth.tutor()) {
            vincularTutor(empresa, cliente);
        }

        Agendamento item = new Agendamento();
        item.setEmpresa(empresa);
        item.setCliente(cliente);
        item.setPet(pet);
        if (req.colaboradorId() != null) {
            Colaborador colaborador = colaboradores.findById(req.colaboradorId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Colaborador inválido"));
            item.setColaborador(colaborador);
        }
        if (req.servicoId() != null) {
            item.setServico(servicos.findByIdAndEmpresaId(req.servicoId(), empresa.getId()).orElse(null));
        }
        item.setStatus(agendamentoStatuses.findByCodigoIgnoreCase("SOLICITADO")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Status de agenda ausente")));
        if (auth.tutor()) {
            item.setOrigem("CLIENTE");
        } else {
            item.setOrigem("COLABORADOR");
            item.setColaboradorCriacao(colaboradores.findById(auth.atorId()).orElseThrow());
        }
        item.setDataHoraInicio(req.dataHoraInicio());
        item.setDataHoraFim(req.dataHoraFim() == null ? req.dataHoraInicio().plusSeconds(1800) : req.dataHoraFim());
        item.setObservacoes(blank(req.observacoes()));
        return AgendamentoResponse.from(agendamentos.save(item));
    }

    public List<AtendimentoResponse> listarAtendimentos() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            return atendimentos.findAll().stream()
                    .filter(item -> item.getCliente().getId().equals(auth.atorId()))
                    .map(item -> AtendimentoResponse.from(item, false))
                    .toList();
        }
        return atendimentos.findByEmpresaIdOrderByIdDesc(empresaAtual().getId()).stream()
                .map(item -> AtendimentoResponse.from(item, true))
                .toList();
    }

    @Transactional
    public AtendimentoResponse abrirAtendimento(NovoAtendimentoRequest req) {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.colaborador() && !auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a equipe da clínica abre atendimento");
        }
        Empresa empresa = empresaAtual();
        Pet pet = exigirPetNaClinica(req.petId(), empresa.getId());
        Atendimento item = new Atendimento();
        item.setEmpresa(empresa);
        item.setCliente(pet.getCliente());
        item.setPet(pet);
        if (req.agendamentoId() != null) {
            item.setAgendamento(agendamentos.findByIdAndEmpresaId(req.agendamentoId(), empresa.getId()).orElse(null));
        }
        if (req.servicoId() != null) {
            item.setServico(servicos.findByIdAndEmpresaId(req.servicoId(), empresa.getId()).orElse(null));
        }
        item.setStatus(atendimentoStatuses.findByDescricaoIgnoreCase("em andamento")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Status de atendimento ausente")));
        item.setOrigem("COLABORADOR");
        item.setColaboradorCriacao(auth.colaborador()
                ? colaboradores.findById(auth.atorId()).orElseThrow()
                : colaboradores.findByEmpresaIdOrderByNomeColaboradorAsc(empresa.getId()).stream()
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "A clínica precisa de um colaborador para registrar o atendimento")));
        item.setResumoCliente(blank(req.resumoCliente()));
        item.setDetalhes(blank(req.detalhes()));
        item.setDataInicio(Instant.now());
        return AtendimentoResponse.from(atendimentos.save(item), true);
    }

    @Transactional
    public AtendimentoResponse concluirAtendimento(Integer id) {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.colaborador() && !auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a equipe conclui atendimento");
        }
        Empresa empresa = empresaAtual();
        Atendimento item = atendimentos.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Atendimento não encontrado"));
        if (!item.getEmpresa().getId().equals(empresa.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Atendimento de outra clínica");
        }
        String atual = item.getStatus().getDescricao().toLowerCase(Locale.ROOT);
        if ("concluido".equals(atual) || "cancelado".equals(atual)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este atendimento já está encerrado");
        }
        item.setStatus(atendimentoStatuses.findByDescricaoIgnoreCase("concluido")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Status de atendimento ausente")));
        return AtendimentoResponse.from(atendimentos.save(item), true);
    }

    public List<AdminClinicaResponse> clinicasAdmin() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.adminPlataforma()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o administrador da plataforma");
        }
        return empresas.findAll().stream()
                .map(empresa -> new AdminClinicaResponse(
                        empresa.getId(),
                        empresa.getNomeEmpresa(),
                        empresa.getCnpj(),
                        empresa.getEmail(),
                        empresa.getIdentificadorUrl(),
                        empresa.getStatus().getDescricao()
                ))
                .toList();
    }

    public record AdminClinicaResponse(Integer id, String nome, String cnpj, String email, String slug, String status) {
    }

    private Pet exigirPetDoTutor(Integer petId, Integer clienteId) {
        Pet pet = pets.findById(petId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pet não encontrado"));
        if (!pet.getCliente().getId().equals(clienteId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pet não pertence a este tutor");
        }
        return pet;
    }

    private Pet exigirPetNaClinica(Integer petId, Integer empresaId) {
        Pet pet = pets.findById(petId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pet não encontrado"));
        if (!empresaClientes.existsByEmpresaIdAndClienteId(empresaId, pet.getCliente().getId())) {
            vincularTutor(empresaAtual(), pet.getCliente());
        }
        return pet;
    }

    private void vincularTutor(Empresa empresa, Cliente cliente) {
        if (empresaClientes.existsByEmpresaIdAndClienteId(empresa.getId(), cliente.getId())) {
            return;
        }
        EmpresaCliente vinculo = new EmpresaCliente();
        vinculo.setEmpresa(empresa);
        vinculo.setCliente(cliente);
        vinculo.setStatus(ativo());
        empresaClientes.save(vinculo);
    }

    private Status ativo() {
        return statuses.findByDescricaoIgnoreCase("ativo")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Status ativo ausente"));
    }

    private Status inativo() {
        return statuses.findByDescricaoIgnoreCase("inativo")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Status inativo ausente"));
    }

    private static String digits(String value) {
        return value == null ? "" : value.replaceAll("\\D", "");
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record DashboardResponse(
            String titulo,
            String usuario,
            long tutores,
            long pets,
            long agendamentos,
            long atendimentos,
            String plano,
            String slug
    ) {
    }

    public record TutorPetsResponse(TutorResponse tutor, List<PetResponse> pets) {
    }

    public record TutorResponse(
            Integer id,
            String nome,
            String cpf,
            String email,
            String telefone,
            String fotoUrl,
            boolean ativo,
            String vinculadoEm,
            String ultimoAtendimentoEm,
            String ultimoAtendimentoServico
    ) {
        static TutorResponse from(Cliente cliente) {
            return from(cliente, true, null, null, null);
        }

        static TutorResponse from(
                Cliente cliente,
                boolean ativo,
                String vinculadoEm,
                String ultimoAtendimentoEm,
                String ultimoAtendimentoServico
        ) {
            return new TutorResponse(
                    cliente.getId(),
                    cliente.getNomeCliente(),
                    cliente.getCpf(),
                    cliente.getEmail(),
                    cliente.getTelefone(),
                    cliente.getFotoUrl(),
                    ativo,
                    vinculadoEm,
                    ultimoAtendimentoEm,
                    ultimoAtendimentoServico
            );
        }
    }

    private record UltimoAtendimento(Integer clienteId, String data, String servico) {
    }

    public record NovoTutorRequest(String nome, String cpf, String email, String telefone, String senha) {
    }

    public record PetResponse(
            Integer id,
            String nome,
            String sexo,
            String especie,
            String raca,
            Integer clienteId,
            String tutor,
            Integer empresaId,
            String clinica,
            String fotoUrl,
            java.math.BigDecimal peso,
            String nascimento
    ) {
        static PetResponse from(Pet pet) {
            return new PetResponse(
                    pet.getId(),
                    pet.getNomePet(),
                    pet.getSexo(),
                    pet.getEspecie().getDescricao(),
                    pet.getRaca() == null ? null : pet.getRaca().getDescricao(),
                    pet.getCliente().getId(),
                    pet.getCliente().getNomeCliente(),
                    pet.getEmpresa() == null ? null : pet.getEmpresa().getId(),
                    pet.getEmpresa() == null ? null : pet.getEmpresa().getNomeEmpresa(),
                    pet.getFotoUrl(),
                    pet.getPeso(),
                    pet.getDataAniversario() == null ? null : pet.getDataAniversario().toString()
            );
        }
    }

    public record NovoPetRequest(
            Integer clienteId,
            Integer empresaId,
            Integer especieId,
            Integer racaId,
            String nome,
            String sexo,
            BigDecimal peso,
            String dataAniversario
    ) {
    }

    public record ServicoResponse(
            Integer id,
            String nome,
            BigDecimal preco,
            boolean visivelPagina,
            boolean ativo,
            String icone,
            String tipoNome
    ) {
        static ServicoResponse from(EmpresaServico servico) {
            boolean ativo = servico.getStatus() != null
                    && "ativo".equalsIgnoreCase(servico.getStatus().getDescricao());
            var tipo = servico.getTipoServico();
            String icone = tipo != null ? tipo.getIcone() : null;
            String tipoNome = tipo != null ? tipo.getNome() : null;
            return new ServicoResponse(
                    servico.getId(),
                    servico.nomePublico(),
                    servico.getPreco(),
                    servico.isVisivelPagina(),
                    ativo,
                    icone,
                    tipoNome
            );
        }
    }

    public record NovoServicoRequest(Integer tipoServicoId, String nomeExibicao, String descricao, BigDecimal preco, Integer duracaoMinutos, Boolean visivelPagina) {
    }

    public record ColaboradorResponse(
            Integer id,
            String nome,
            String email,
            String cargo,
            String fotoUrl,
            String papel,
            boolean exibirPagina
    ) {
        static ColaboradorResponse from(Colaborador item) {
            return new ColaboradorResponse(
                    item.getId(),
                    item.getNomeColaborador(),
                    item.getEmail(),
                    item.getCargo(),
                    item.getImagemUrl(),
                    null,
                    item.isExibirPagina()
            );
        }
    }

    public record NovoColaboradorRequest(
            String nome,
            String cpf,
            String email,
            String telefone,
            String senha,
            String cargo,
            String papel
    ) {
    }

    public record AgendamentoResponse(
            Integer id,
            String inicio,
            String fim,
            String status,
            String statusCodigo,
            Integer petId,
            String pet,
            String especie,
            String tutor,
            String origem,
            String fotoUrl,
            Integer colaboradorId,
            String colaborador
    ) {
        static AgendamentoResponse from(Agendamento item) {
            return new AgendamentoResponse(
                    item.getId(),
                    item.getDataHoraInicio().toString(),
                    item.getDataHoraFim() == null ? null : item.getDataHoraFim().toString(),
                    item.getStatus().getDescricao(),
                    item.getStatus().getCodigo(),
                    item.getPet().getId(),
                    item.getPet().getNomePet(),
                    item.getPet().getEspecie() == null ? null : item.getPet().getEspecie().getDescricao(),
                    item.getCliente().getNomeCliente(),
                    item.getOrigem(),
                    item.getPet().getFotoUrl(),
                    item.getColaborador() == null ? null : item.getColaborador().getId(),
                    item.getColaborador() == null ? null : item.getColaborador().getNomeColaborador()
            );
        }
    }

    public record NovoAgendamentoRequest(
            Integer empresaId,
            Integer clienteId,
            Integer petId,
            Integer colaboradorId,
            Integer servicoId,
            Instant dataHoraInicio,
            Instant dataHoraFim,
            String observacoes
    ) {
    }

    public record AtendimentoResponse(
            Integer id,
            Integer petId,
            String pet,
            String especie,
            String tutor,
            String status,
            String resumo,
            String detalhes,
            String fotoUrl,
            String clinica,
            String veterinario,
            String dataInicio,
            Integer agendamentoId
    ) {
        static AtendimentoResponse from(Atendimento item, boolean interno) {
            return new AtendimentoResponse(
                    item.getId(),
                    item.getPet().getId(),
                    item.getPet().getNomePet(),
                    item.getPet().getEspecie() == null ? null : item.getPet().getEspecie().getDescricao(),
                    item.getCliente().getNomeCliente(),
                    item.getStatus().getDescricao(),
                    item.getResumoCliente(),
                    interno ? item.getDetalhes() : null,
                    item.getPet().getFotoUrl(),
                    item.getEmpresa() == null ? null : item.getEmpresa().getNomeEmpresa(),
                    item.getColaboradorCriacao() == null ? null : item.getColaboradorCriacao().getNomeColaborador(),
                    item.getDataInicio() == null ? null : item.getDataInicio().toString(),
                    item.getAgendamento() == null ? null : item.getAgendamento().getId()
            );
        }
    }

    public record NovoAtendimentoRequest(Integer petId, Integer agendamentoId, Integer servicoId, String resumoCliente, String detalhes) {
    }
}
