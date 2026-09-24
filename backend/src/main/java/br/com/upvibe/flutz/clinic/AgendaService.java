package br.com.upvibe.flutz.clinic;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.Time;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.com.upvibe.flutz.domain.Empresa;
import br.com.upvibe.flutz.domain.EmpresaRepository;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

@Service
public class AgendaService {

    private static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");
    private static final int SLOT_PADRAO = 30;
    private static final Set<String> CANCELA_TUTOR = Set.of(
            "SOLICITADO", "CONFIRMADO", "AGUARDANDO_CLIENTE", "AGUARDANDO_PAGAMENTO"
    );

    private final JdbcTemplate jdbc;
    private final ClinicService clinic;
    private final EmpresaRepository empresas;
    private final ClinicOpsService ops;
    private final NotificationService notifications;

    public AgendaService(
            JdbcTemplate jdbc,
            ClinicService clinic,
            EmpresaRepository empresas,
            ClinicOpsService ops,
            NotificationService notifications
    ) {
        this.jdbc = jdbc;
        this.clinic = clinic;
        this.empresas = empresas;
        this.ops = ops;
        this.notifications = notifications;
    }

    @Transactional
    public Localizacao salvarLocalizacaoTutor(Localizacao req) {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor informa a localização para distância");
        }
        validarCoord(req.latitude(), req.longitude());
        jdbc.update(
                """
                UPDATE flutz.cliente
                SET latitude = ?, longitude = ?, localizacao_atualizada_em = CURRENT_TIMESTAMP
                WHERE cliente_id = ?
                """,
                req.latitude(), req.longitude(), auth.atorId()
        );
        return req;
    }

    public Localizacao localizacaoTutor() {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor");
        }
        return jdbc.query(
                "SELECT latitude, longitude FROM flutz.cliente WHERE cliente_id = ?",
                rs -> rs.next() ? new Localizacao(rs.getObject("latitude", BigDecimal.class), rs.getObject("longitude", BigDecimal.class)) : new Localizacao(null, null),
                auth.atorId()
        );
    }

    public List<ClinicaAgenda> clinicas(BigDecimal lat, BigDecimal lng) {
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor");
        }
        Localizacao salva = localizacaoTutor();
        BigDecimal useLat = lat != null ? lat : salva.latitude();
        BigDecimal useLng = lng != null ? lng : salva.longitude();
        Instant agora = Instant.now();
        return jdbc.query(
                """
                SELECT e.empresa_id, e.nome_empresa, e.identificador_url, e.logo_url,
                       e.logradouro, e.numero, e.bairro, e.cidade, e.uf, e.descricao_empresa,
                       e.latitude, e.longitude
                FROM flutz.empresa e
                JOIN flutz.status s ON s.status_id = e.status_id
                WHERE LOWER(s.descricao) = 'ativo'
                ORDER BY e.nome_empresa
                """,
                (rs, i) -> {
                    BigDecimal cLat = br.com.upvibe.flutz.geo.Brasilia.latOrDefault(rs.getObject("latitude", BigDecimal.class));
                    BigDecimal cLng = br.com.upvibe.flutz.geo.Brasilia.lngOrDefault(rs.getObject("longitude", BigDecimal.class));
                    Integer id = rs.getInt("empresa_id");
                    return new ClinicaAgenda(
                            id,
                            rs.getString("nome_empresa"),
                            rs.getString("identificador_url"),
                            rs.getString("logo_url"),
                            endereco(rs.getString("logradouro"), rs.getString("numero"), rs.getString("bairro"), rs.getString("cidade"), rs.getString("uf")),
                            rs.getString("cidade"),
                            rs.getString("uf"),
                            rs.getString("descricao_empresa"),
                            distanciaKm(useLat, useLng, cLat, cLng),
                            abertaAgora(id, agora),
                            servicosNomes(id),
                            especialidadesNomes(id),
                            mediaAvaliacoes(id),
                            totalAvaliacoes(id),
                            horariosLivresHoje(id)
                    );
                }
        );
    }

    public Disponibilidade disponibilidade(Integer empresaId, LocalDate de, LocalDate ate) {
        if (empresaId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a clínica");
        }
        LocalDate inicio = de == null ? LocalDate.now(ZONA) : de;
        LocalDate fim = ate == null ? inicio.plusDays(13) : ate;
        if (fim.isBefore(inicio) || fim.isAfter(inicio.plusDays(62))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Período inválido");
        }
        List<DiaAgenda> dias = new ArrayList<>();
        for (LocalDate dia = inicio; !dia.isAfter(fim); dia = dia.plusDays(1)) {
            dias.add(montarDia(empresaId, dia));
        }
        return new Disponibilidade(empresaId, dias);
    }

    @Transactional
    public Solicitacao criar(NovaSolicitacao req) {
        AuthPrincipal auth = AuthHolder.current();
        Empresa empresa = auth.tutor()
                ? empresas.findById(req.empresaId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Clínica inválida"))
                : clinic.empresaAtual();
        if (auth.tutor()) {
            garantirVinculo(empresa.getId(), auth.atorId());
        }
        Integer clienteId = auth.tutor() ? auth.atorId() : req.clienteId();
        if (clienteId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o tutor");
        }
        validarPet(req.petId(), clienteId, empresa.getId(), req.tipo(), req.empresaVacinaId());
        String tipo = req.tipo() == null ? "ATENDIMENTO" : req.tipo().toUpperCase(Locale.ROOT);
        Integer vacinaId = "VACINACAO".equals(tipo) ? req.empresaVacinaId() : null;
        Integer servicoId = "ATENDIMENTO".equals(tipo) ? req.empresaServicoId() : null;
        Instant inicio = req.dataHoraInicio();
        int minutos = duracaoMinutos(servicoId);
        Instant fim = req.dataHoraFim() != null ? req.dataHoraFim() : inicio.plusSeconds(minutos * 60L);
        if (fim.isBefore(inicio) || fim.equals(inicio)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Horário inválido");
        }
        if ("VACINACAO".equals(tipo)) {
            if (vacinaId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a vacina");
            }
            if (!vacinaDisponivel(empresa.getId(), vacinaId, req.petId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Esta vacina não está disponível para o pet");
            }
        } else if (servicoId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o serviço");
        }
        BigDecimal valorServico = exigirPrecoAgendamento(tipo, servicoId, vacinaId, empresa.getId());
        if (!slotLivre(empresa.getId(), inicio, fim, null)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este horário não está disponível");
        }
        Integer statusId = statusId("SOLICITADO");
        String origem = auth.tutor() ? "CLIENTE" : "COLABORADOR";
        Integer criacao = auth.tutor() ? null : auth.atorId();
        Integer id = jdbc.queryForObject(
                """
                INSERT INTO flutz.agendamento (
                    empresa_id, cliente_id, pet_id, colaborador_id, empresa_servico_id, agendamento_status_id,
                    origem, colaborador_criacao_id, data_hora_inicio, data_hora_fim, observacoes,
                    tipo, empresa_vacina_id, valor_servico, valor_desconto, valor_cobrado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                RETURNING agendamento_id
                """,
                Integer.class,
                empresa.getId(), clienteId, req.petId(), req.colaboradorId(), servicoId, statusId,
                origem, criacao, Timestamp.from(inicio), Timestamp.from(fim), blank(req.observacoes()),
                tipo, vacinaId, valorServico, valorServico
        );
        registrarEvento(id, empresa.getId(), auth, null, statusId, null);
        if (auth.tutor()) {
            String tipoLabel = "VACINACAO".equals(tipo) ? "vacinação" : "atendimento";
            ops.garantirChatAposAgendamento(
                    empresa.getId(),
                    clienteId,
                    req.petId(),
                    id,
                    "Conversa aberta automaticamente após o agendamento de " + tipoLabel
                            + ". Você já pode enviar mensagens para a clínica."
            );
        }
        Solicitacao criada = detalhe(id);
        if (auth.tutor()) {
            notifications.notificarSolicitacaoAgenda(criada);
        }
        return criada;
    }

    public List<Solicitacao> listar(String status, String tipo, LocalDate de, LocalDate ate) {
        AuthPrincipal auth = AuthHolder.current();
        StringBuilder sql = new StringBuilder(baseSelect());
        List<Object> args = new ArrayList<>();
        if (auth.tutor()) {
            sql.append(" WHERE g.cliente_id = ? ");
            args.add(auth.atorId());
        } else {
            sql.append(" WHERE g.empresa_id = ? ");
            args.add(clinic.empresaAtual().getId());
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND st.codigo = ? ");
            args.add(status.toUpperCase(Locale.ROOT));
        }
        if (tipo != null && !tipo.isBlank()) {
            sql.append(" AND g.tipo = ? ");
            args.add(tipo.toUpperCase(Locale.ROOT));
        }
        if (de != null) {
            sql.append(" AND g.data_hora_inicio >= ? ");
            args.add(Timestamp.valueOf(de.atStartOfDay()));
        }
        if (ate != null) {
            sql.append(" AND g.data_hora_inicio < ? ");
            args.add(Timestamp.valueOf(ate.plusDays(1).atStartOfDay()));
        }
        sql.append(" ORDER BY g.data_hora_inicio ");
        return jdbc.query(sql.toString(), (rs, i) -> mapSolicitacao(rs), args.toArray());
    }

    public Solicitacao detalhe(Integer id) {
        AuthPrincipal auth = AuthHolder.current();
        Solicitacao item = jdbc.query(baseSelect() + " WHERE g.agendamento_id = ?", rs -> rs.next() ? mapSolicitacao(rs) : null, id);
        if (item == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Agendamento não encontrado");
        }
        if (auth.tutor() && !item.clienteId().equals(auth.atorId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Agendamento de outro tutor");
        }
        if (!auth.tutor()) {
            auth.exigirEmpresa(item.empresaId());
        }
        return item;
    }

    @Transactional
    public Solicitacao confirmar(Integer id, ConfirmarReq req) {
        Solicitacao atual = exigirClinica(id);
        exigirCodigo(atual, "SOLICITADO");
        aplicarProfissional(id, atual, req, "AGUARDANDO_PAGAMENTO", "Aprovado — aguardando pagamento do tutor");
        return detalhe(id);
    }

    @Transactional
    public Solicitacao reatribuir(Integer id, ConfirmarReq req) {
        Solicitacao atual = exigirClinica(id);
        exigirCodigo(atual, "CONFIRMADO", "SOLICITADO", "AGUARDANDO_PAGAMENTO");
        if ("SOLICITADO".equals(atual.statusCodigo())) {
            aplicarProfissional(id, atual, req, "AGUARDANDO_PAGAMENTO", "Aprovado — aguardando pagamento do tutor");
        } else {
            aplicarProfissional(id, atual, req, atual.statusCodigo(), "Profissional ou término atualizados");
        }
        return detalhe(id);
    }

    private void aplicarProfissional(Integer id, Solicitacao atual, ConfirmarReq req, String statusDestino, String evento) {
        if (req == null || req.colaboradorId() == null || req.dataHoraFim() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o profissional e o horário de término");
        }
        Instant inicio = Instant.parse(atual.inicio());
        Instant fim = req.dataHoraFim();
        if (!fim.isAfter(inicio)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "O término precisa ser depois do início");
        }
        exigirColaboradorDaClinica(atual.empresaId(), req.colaboradorId());
        if (!profissionalLivre(req.colaboradorId(), inicio, fim, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este profissional não está livre neste intervalo");
        }
        Integer novo = statusId(statusDestino);
        jdbc.update(
                """
                UPDATE flutz.agendamento
                SET agendamento_status_id = ?, colaborador_id = ?, data_hora_fim = ?
                WHERE agendamento_id = ?
                """,
                novo, req.colaboradorId(), Timestamp.from(fim), id
        );
        registrarEvento(id, atual.empresaId(), AuthHolder.current(), statusId(atual.statusCodigo()), novo, evento);
        Solicitacao atualizada = detalhe(id);
        if ("AGUARDANDO_PAGAMENTO".equals(atualizada.statusCodigo()) && !"AGUARDANDO_PAGAMENTO".equals(atual.statusCodigo())) {
            notifications.notificarAguardandoPagamento(atualizada);
        } else if ("CONFIRMADO".equals(atualizada.statusCodigo()) && !"CONFIRMADO".equals(atual.statusCodigo())) {
            notifications.notificarConfirmacaoAgenda(atualizada);
        }
    }

    @Transactional
    public Solicitacao recusar(Integer id, MotivoReq req) {
        Solicitacao atual = exigirClinica(id);
        exigirCodigo(atual, "SOLICITADO", "AGUARDANDO_CLIENTE");
        return mudar(id, atual, "RECUSADO", req == null ? null : req.motivo());
    }

    @Transactional
    public Solicitacao cancelar(Integer id, MotivoReq req) {
        AuthPrincipal auth = AuthHolder.current();
        Solicitacao atual = detalhe(id);
        if (auth.tutor()) {
            exigirCodigo(atual, CANCELA_TUTOR.toArray(String[]::new));
            Instant inicio = Instant.parse(atual.inicio());
            Integer minutos = jdbc.query(
                    "SELECT cancelamento_antecedencia_minutos FROM flutz.empresa WHERE empresa_id = ?",
                    rs -> rs.next() ? (Integer) rs.getObject(1) : null,
                    atual.empresaId()
            );
            if (minutos != null && Instant.now().plusSeconds(minutos * 60L).isAfter(inicio)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fora do prazo de cancelamento. Fale com a clínica.");
            }
            return mudar(id, atual, "CANCELADO_CLIENTE", req == null ? null : req.motivo());
        }
        exigirCodigo(atual, "SOLICITADO", "CONFIRMADO", "AGUARDANDO_CLIENTE", "AGUARDANDO_PAGAMENTO");
        return mudar(id, atual, "CANCELADO_CLINICA", req == null ? null : req.motivo());
    }

    @Transactional
    public Solicitacao propor(Integer id, PropostaReq req) {
        Solicitacao atual = exigirClinica(id);
        exigirCodigo(atual, "SOLICITADO", "CONFIRMADO", "AGUARDANDO_PAGAMENTO");
        if (req == null || req.dataHoraInicio() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe o novo horário");
        }
        Instant fim = req.dataHoraFim() != null ? req.dataHoraFim() : req.dataHoraInicio().plusSeconds(SLOT_PADRAO * 60L);
        if (!slotLivre(atual.empresaId(), req.dataHoraInicio(), fim, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "O horário proposto não está disponível");
        }
        Integer novo = statusId("AGUARDANDO_CLIENTE");
        jdbc.update(
                """
                UPDATE flutz.agendamento
                SET agendamento_status_id = ?, motivo_status = ?, data_hora_proposta_inicio = ?, data_hora_proposta_fim = ?
                WHERE agendamento_id = ?
                """,
                novo, blank(req.motivo()), Timestamp.from(req.dataHoraInicio()), Timestamp.from(fim), id
        );
        registrarEvento(id, atual.empresaId(), AuthHolder.current(), statusId(atual.statusCodigo()), novo, req.motivo());
        Solicitacao proposta = detalhe(id);
        notifications.notificarPropostaAgenda(proposta);
        return proposta;
    }

    @Transactional
    public Solicitacao aceitarProposta(Integer id) {
        Solicitacao atual = detalhe(id);
        AuthPrincipal auth = AuthHolder.current();
        if (!auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor aceita a proposta");
        }
        exigirCodigo(atual, "AGUARDANDO_CLIENTE");
        if (atual.propostaInicio() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Não há horário proposto");
        }
        Instant ini = Instant.parse(atual.propostaInicio());
        Instant fim = atual.propostaFim() == null ? ini.plusSeconds(SLOT_PADRAO * 60L) : Instant.parse(atual.propostaFim());
        if (!slotLivre(atual.empresaId(), ini, fim, id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "O horário proposto não está mais livre");
        }
        // Volta ao status de antes da proposta (SOLICITADO / AGUARDANDO_PAGAMENTO / CONFIRMADO).
        String destino = statusAntesDaProposta(id);
        Integer novo = statusId(destino);
        jdbc.update(
                """
                UPDATE flutz.agendamento
                SET agendamento_status_id = ?, data_hora_inicio = ?, data_hora_fim = ?,
                    data_hora_proposta_inicio = NULL, data_hora_proposta_fim = NULL
                WHERE agendamento_id = ?
                """,
                novo, Timestamp.from(ini), Timestamp.from(fim), id
        );
        registrarEvento(id, atual.empresaId(), auth, statusId(atual.statusCodigo()), novo, "Tutor aceitou o novo horário");
        Solicitacao aceita = detalhe(id);
        if ("CONFIRMADO".equals(destino)) {
            notifications.notificarConfirmacaoAgenda(aceita);
        } else if ("AGUARDANDO_PAGAMENTO".equals(destino)) {
            notifications.notificarAguardandoPagamento(aceita);
        } else {
            notifications.notificarSolicitacaoAgenda(aceita);
        }
        return aceita;
    }

    private String statusAntesDaProposta(Integer agendamentoId) {
        Integer aguardandoCliente = statusId("AGUARDANDO_CLIENTE");
        String anterior = jdbc.query(
                """
                SELECT s.codigo
                FROM flutz.agendamento_evento e
                JOIN flutz.agendamento_status s ON s.agendamento_status_id = e.status_anterior_id
                WHERE e.agendamento_id = ? AND e.status_novo_id = ?
                ORDER BY e.agendamento_evento_id DESC
                LIMIT 1
                """,
                rs -> rs.next() ? rs.getString(1) : null,
                agendamentoId,
                aguardandoCliente
        );
        if ("CONFIRMADO".equals(anterior) || "AGUARDANDO_PAGAMENTO".equals(anterior) || "SOLICITADO".equals(anterior)) {
            return anterior;
        }
        return "SOLICITADO";
    }

    @Transactional
    public Solicitacao marcarConfirmadoAposPagamento(Integer id) {
        Solicitacao atual = detalheInterno(id);
        if ("CONFIRMADO".equals(atual.statusCodigo()) || "CONCLUIDO".equals(atual.statusCodigo())) {
            return atual;
        }
        if (!"AGUARDANDO_PAGAMENTO".equals(atual.statusCodigo())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pagamento só confirma agendamento aguardando pagamento");
        }
        Integer novo = statusId("CONFIRMADO");
        jdbc.update(
                "UPDATE flutz.agendamento SET agendamento_status_id = ? WHERE agendamento_id = ?",
                novo, id
        );
        AuthPrincipal auth = AuthHolder.optional();
        String atorTipo = auth != null ? auth.tipo().name() : "CLIENTE";
        Integer atorId = auth != null ? auth.atorId() : atual.clienteId();
        jdbc.update(
                """
                INSERT INTO flutz.agendamento_evento (agendamento_id, empresa_id, ator_tipo, ator_id, status_anterior_id, status_novo_id, motivo)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                id, atual.empresaId(), atorTipo, atorId, statusId(atual.statusCodigo()), novo, "Pagamento confirmado"
        );
        Solicitacao confirmada = detalheInterno(id);
        notifications.notificarConfirmacaoAgenda(confirmada);
        return confirmada;
    }

    @Transactional
    public Solicitacao concluir(Integer id) {
        Solicitacao atual = exigirClinica(id);
        exigirCodigo(atual, "CONFIRMADO");
        return mudar(id, atual, "CONCLUIDO", "Atendimento concluído");
    }

    /** Uso interno (pagamento/webhook) sem revalidar papel além da existência. */
    public Solicitacao detalheInterno(Integer id) {
        Solicitacao item = jdbc.query(baseSelect() + " WHERE g.agendamento_id = ?", rs -> rs.next() ? mapSolicitacao(rs) : null, id);
        if (item == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Agendamento não encontrado");
        }
        return item;
    }

    @Transactional
    public Solicitacao recusarProposta(Integer id, MotivoReq req) {
        Solicitacao atual = detalhe(id);
        if (!AuthHolder.current().tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente o tutor recusa a proposta");
        }
        exigirCodigo(atual, "AGUARDANDO_CLIENTE");
        Integer novo = statusId("SOLICITADO");
        jdbc.update(
                """
                UPDATE flutz.agendamento
                SET agendamento_status_id = ?, data_hora_proposta_inicio = NULL, data_hora_proposta_fim = NULL, motivo_status = ?
                WHERE agendamento_id = ?
                """,
                novo, blank(req == null ? null : req.motivo()), id
        );
        registrarEvento(id, atual.empresaId(), AuthHolder.current(), statusId(atual.statusCodigo()), novo, req == null ? null : req.motivo());
        return detalhe(id);
    }

    public List<Faixa> expediente() {
        Integer empresaId = clinic.empresaAtual().getId();
        exigirGestao();
        return jdbc.query(
                "SELECT empresa_expediente_id, dia_semana, hora_inicio, hora_fim FROM flutz.empresa_expediente WHERE empresa_id = ? ORDER BY dia_semana, hora_inicio",
                (rs, i) -> new Faixa(rs.getInt(1), rs.getInt(2), rs.getTime(3).toLocalTime().toString(), rs.getTime(4).toLocalTime().toString()),
                empresaId
        );
    }

    @Transactional
    public List<Faixa> salvarExpediente(List<Faixa> faixas) {
        Integer empresaId = clinic.empresaAtual().getId();
        exigirGestao();
        jdbc.update("DELETE FROM flutz.empresa_expediente WHERE empresa_id = ?", empresaId);
        Integer status = statusAtivo();
        if (faixas != null) {
            for (Faixa faixa : faixas) {
                jdbc.update(
                        "INSERT INTO flutz.empresa_expediente (empresa_id, dia_semana, hora_inicio, hora_fim, status_id) VALUES (?, ?, ?, ?, ?)",
                        empresaId, faixa.diaSemana(), Time.valueOf(LocalTime.parse(faixa.inicio())), Time.valueOf(LocalTime.parse(faixa.fim())), status
                );
            }
        }
        return expediente();
    }

    public List<Feriado> feriados() {
        Integer empresaId = clinic.empresaAtual().getId();
        exigirGestao();
        return jdbc.query(
                "SELECT empresa_feriado_id, data, nome, atende, hora_inicio, hora_fim FROM flutz.empresa_feriado WHERE empresa_id = ? ORDER BY data",
                (rs, i) -> new Feriado(
                        rs.getInt(1),
                        rs.getDate(2).toLocalDate().toString(),
                        rs.getString(3),
                        rs.getBoolean(4),
                        rs.getTime(5) == null ? null : rs.getTime(5).toLocalTime().toString(),
                        rs.getTime(6) == null ? null : rs.getTime(6).toLocalTime().toString()
                ),
                empresaId
        );
    }

    @Transactional
    public Feriado criarFeriado(Feriado req) {
        Integer empresaId = clinic.empresaAtual().getId();
        exigirGestao();
        Integer id = jdbc.queryForObject(
                """
                INSERT INTO flutz.empresa_feriado (empresa_id, data, nome, atende, hora_inicio, hora_fim)
                VALUES (?, ?, ?, ?, ?, ?)
                RETURNING empresa_feriado_id
                """,
                Integer.class,
                empresaId,
                Date.valueOf(LocalDate.parse(req.data())),
                req.nome(),
                req.atende(),
                req.atende() ? Time.valueOf(LocalTime.parse(req.inicio())) : null,
                req.atende() ? Time.valueOf(LocalTime.parse(req.fim())) : null
        );
        return new Feriado(id, req.data(), req.nome(), req.atende(), req.inicio(), req.fim());
    }

    @Transactional
    public void excluirFeriado(Integer id) {
        Integer empresaId = clinic.empresaAtual().getId();
        exigirGestao();
        int n = jdbc.update("DELETE FROM flutz.empresa_feriado WHERE empresa_feriado_id = ? AND empresa_id = ?", id, empresaId);
        if (n == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Feriado não encontrado");
        }
    }

    public List<Bloqueio> bloqueios() {
        Integer empresaId = clinic.empresaAtual().getId();
        exigirGestao();
        return jdbc.query(
                "SELECT empresa_bloqueio_id, data_hora_inicio, data_hora_fim, motivo FROM flutz.empresa_bloqueio WHERE empresa_id = ? ORDER BY data_hora_inicio",
                (rs, i) -> new Bloqueio(rs.getInt(1), rs.getTimestamp(2).toInstant().toString(), rs.getTimestamp(3).toInstant().toString(), rs.getString(4)),
                empresaId
        );
    }

    @Transactional
    public Bloqueio criarBloqueio(Bloqueio req) {
        Integer empresaId = clinic.empresaAtual().getId();
        exigirGestao();
        Integer id = jdbc.queryForObject(
                "INSERT INTO flutz.empresa_bloqueio (empresa_id, data_hora_inicio, data_hora_fim, motivo) VALUES (?, ?, ?, ?) RETURNING empresa_bloqueio_id",
                Integer.class,
                empresaId,
                Timestamp.from(Instant.parse(req.inicio())),
                Timestamp.from(Instant.parse(req.fim())),
                req.motivo()
        );
        return new Bloqueio(id, req.inicio(), req.fim(), req.motivo());
    }

    @Transactional
    public void excluirBloqueio(Integer id) {
        Integer empresaId = clinic.empresaAtual().getId();
        exigirGestao();
        int n = jdbc.update("DELETE FROM flutz.empresa_bloqueio WHERE empresa_bloqueio_id = ? AND empresa_id = ?", id, empresaId);
        if (n == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Bloqueio não encontrado");
        }
    }

    @Transactional
    public void salvarNota(NotaDia req) {
        Integer empresaId = clinic.empresaAtual().getId();
        exigirGestao();
        jdbc.update(
                """
                INSERT INTO flutz.empresa_agenda_nota (empresa_id, data, texto)
                VALUES (?, ?, ?)
                ON CONFLICT (empresa_id, data) DO UPDATE SET texto = EXCLUDED.texto
                """,
                empresaId, Date.valueOf(LocalDate.parse(req.data())), req.texto()
        );
    }

    @Transactional
    public CoordenadasClinica salvarCoordenadas(Localizacao req) {
        exigirGestao();
        validarCoord(req.latitude(), req.longitude());
        Integer empresaId = clinic.empresaAtual().getId();
        jdbc.update("UPDATE flutz.empresa SET latitude = ?, longitude = ? WHERE empresa_id = ?", req.latitude(), req.longitude(), empresaId);
        return new CoordenadasClinica(req.latitude(), req.longitude());
    }

    public List<PetAgenda> petsClinica(Integer empresaId) {
        AuthPrincipal auth = AuthHolder.current();
        Integer id = empresaId;
        if (!auth.tutor()) {
            id = clinic.empresaAtual().getId();
        }
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe a clínica");
        }
        if (auth.tutor()) {
            return jdbc.query(
                    """
                    SELECT p.pet_id, p.nome_pet, e.descricao, p.foto_url, r.descricao AS raca,
                           p.sexo, p.data_aniversario
                    FROM flutz.pet p
                    JOIN flutz.pet_especie e ON e.pet_especie_id = p.pet_especie_id
                    JOIN flutz.status s ON s.status_id = p.status_id
                    LEFT JOIN flutz.pet_raca r ON r.pet_raca_id = p.pet_raca_id
                    WHERE p.cliente_id = ? AND LOWER(s.descricao) = 'ativo'
                    ORDER BY p.nome_pet
                    """,
                    (rs, i) -> mapPetAgenda(rs),
                    auth.atorId()
            );
        }
        return jdbc.query(
                """
                SELECT p.pet_id, p.nome_pet, e.descricao, p.foto_url, r.descricao AS raca,
                       p.sexo, p.data_aniversario
                FROM flutz.pet p
                JOIN flutz.pet_especie e ON e.pet_especie_id = p.pet_especie_id
                JOIN flutz.status s ON s.status_id = p.status_id
                LEFT JOIN flutz.pet_raca r ON r.pet_raca_id = p.pet_raca_id
                WHERE p.pet_id IN (
                    SELECT g.pet_id FROM flutz.agendamento g WHERE g.empresa_id = ?
                    UNION
                    SELECT a.pet_id FROM flutz.atendimento a WHERE a.empresa_id = ?
                )
                  AND LOWER(s.descricao) = 'ativo'
                ORDER BY p.nome_pet
                """,
                (rs, i) -> mapPetAgenda(rs),
                id, id
        );
    }

    private static PetAgenda mapPetAgenda(java.sql.ResultSet rs) throws java.sql.SQLException {
        Date nasc = rs.getDate("data_aniversario");
        return new PetAgenda(
                rs.getInt("pet_id"),
                rs.getString("nome_pet"),
                rs.getString("descricao"),
                rs.getString("foto_url"),
                rs.getString("raca"),
                rs.getString("sexo"),
                nasc != null ? nasc.toLocalDate().toString() : null
        );
    }

    public List<ServicoAgenda> servicosAgenda(Integer empresaId) {
        Integer id = empresaId != null ? empresaId : clinic.empresaAtual().getId();
        return jdbc.query(
                """
                SELECT es.empresa_servico_id, COALESCE(es.nome_exibicao, t.tipo_servico), es.duracao_minutos, es.preco
                FROM flutz.empresa_servico es
                JOIN flutz.tipo_servico t ON t.tipo_servico_id = es.tipo_servico_id
                JOIN flutz.status s ON s.status_id = es.status_id
                WHERE es.empresa_id = ? AND es.visivel_pagina = TRUE AND LOWER(s.descricao) = 'ativo'
                  AND es.preco IS NOT NULL
                ORDER BY es.ordem
                """,
                (rs, i) -> new ServicoAgenda(
                        rs.getInt(1),
                        rs.getString(2),
                        (Integer) rs.getObject(3),
                        rs.getBigDecimal(4)
                ),
                id
        );
    }

    public AgendaConfig config() {
        exigirGestao();
        Integer empresaId = clinic.empresaAtual().getId();
        return jdbc.query(
                "SELECT latitude, longitude, cancelamento_antecedencia_minutos FROM flutz.empresa WHERE empresa_id = ?",
                rs -> rs.next()
                        ? new AgendaConfig(
                                rs.getObject("latitude", BigDecimal.class),
                                rs.getObject("longitude", BigDecimal.class),
                                (Integer) rs.getObject("cancelamento_antecedencia_minutos")
                        )
                        : new AgendaConfig(null, null, null),
                empresaId
        );
    }

    @Transactional
    public AgendaConfig salvarConfig(AgendaConfig req) {
        exigirGestao();
        Integer empresaId = clinic.empresaAtual().getId();
        if (req.latitude() != null || req.longitude() != null) {
            validarCoord(req.latitude(), req.longitude());
        }
        if (req.cancelamentoAntecedenciaMinutos() != null && req.cancelamentoAntecedenciaMinutos() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Antecedência inválida");
        }
        jdbc.update(
                "UPDATE flutz.empresa SET latitude = ?, longitude = ?, cancelamento_antecedencia_minutos = ? WHERE empresa_id = ?",
                req.latitude(), req.longitude(), req.cancelamentoAntecedenciaMinutos(), empresaId
        );
        return config();
    }

    public List<Faixa> horariosColaborador(Integer colaboradorId) {
        exigirGestao();
        exigirColaboradorDaClinica(clinic.empresaAtual().getId(), colaboradorId);
        return jdbc.query(
                """
                SELECT colaborador_horario_id, dia_semana, hora_inicio, hora_fim
                FROM flutz.colaborador_horario
                WHERE colaborador_id = ?
                ORDER BY dia_semana, hora_inicio
                """,
                (rs, i) -> new Faixa(rs.getInt(1), rs.getInt(2), rs.getTime(3).toLocalTime().toString(), rs.getTime(4).toLocalTime().toString()),
                colaboradorId
        );
    }

    @Transactional
    public List<Faixa> salvarHorarios(Integer colaboradorId, List<Faixa> faixas) {
        exigirGestao();
        exigirColaboradorDaClinica(clinic.empresaAtual().getId(), colaboradorId);
        jdbc.update("DELETE FROM flutz.colaborador_horario WHERE colaborador_id = ?", colaboradorId);
        Integer status = statusAtivo();
        if (faixas != null) {
            for (Faixa faixa : faixas) {
                jdbc.update(
                        "INSERT INTO flutz.colaborador_horario (colaborador_id, dia_semana, hora_inicio, hora_fim, status_id) VALUES (?, ?, ?, ?, ?)",
                        colaboradorId,
                        faixa.diaSemana(),
                        Time.valueOf(faixa.inicio().length() == 5 ? faixa.inicio() + ":00" : faixa.inicio()),
                        Time.valueOf(faixa.fim().length() == 5 ? faixa.fim() + ":00" : faixa.fim()),
                        status
                );
            }
        }
        return horariosColaborador(colaboradorId);
    }

    public List<VacinaOferta> vacinasAgenda(Integer empresaId) {
        Integer id = empresaId != null ? empresaId : clinic.empresaAtual().getId();
        oferecerVacinasDoCatalogo(id);
        return jdbc.query(
                """
                SELECT ev.empresa_vacina_id, v.nome_vacina, v.descricao, v.fabricante,
                       ev.visivel_agendamento, ev.idade_minima_meses, ev.idade_maxima_meses, ev.intervalo_doses_dias, ev.observacoes,
                       ev.preco
                FROM flutz.empresa_vacina ev
                JOIN flutz.vacina v ON v.vacina_id = ev.vacina_id
                JOIN flutz.status s ON s.status_id = ev.status_id
                WHERE ev.empresa_id = ? AND LOWER(s.descricao) = 'ativo' AND ev.visivel_agendamento = TRUE
                  AND ev.preco IS NOT NULL
                ORDER BY v.nome_vacina
                """,
                (rs, i) -> new VacinaOferta(
                        rs.getInt(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getBoolean(5), (Integer) rs.getObject(6), (Integer) rs.getObject(7),
                        (Integer) rs.getObject(8), rs.getString(9), rs.getBigDecimal(10)
                ),
                id
        );
    }

    /** Lista todas as vacinas da clínica (com ou sem preço) para o admin definir valores. */
    public List<VacinaOferta> vacinasGestao() {
        exigirGestao();
        Integer id = clinic.empresaAtual().getId();
        oferecerVacinasDoCatalogo(id);
        return jdbc.query(
                """
                SELECT ev.empresa_vacina_id, v.nome_vacina, v.descricao, v.fabricante,
                       ev.visivel_agendamento, ev.idade_minima_meses, ev.idade_maxima_meses, ev.intervalo_doses_dias, ev.observacoes,
                       ev.preco
                FROM flutz.empresa_vacina ev
                JOIN flutz.vacina v ON v.vacina_id = ev.vacina_id
                JOIN flutz.status s ON s.status_id = ev.status_id
                WHERE ev.empresa_id = ? AND LOWER(s.descricao) = 'ativo'
                ORDER BY v.nome_vacina
                """,
                (rs, i) -> new VacinaOferta(
                        rs.getInt(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getBoolean(5), (Integer) rs.getObject(6), (Integer) rs.getObject(7),
                        (Integer) rs.getObject(8), rs.getString(9), rs.getBigDecimal(10)
                ),
                id
        );
    }

    @Transactional
    public VacinaOferta salvarPrecoVacina(Integer empresaVacinaId, BigDecimal preco) {
        exigirGestao();
        Integer empresaId = clinic.empresaAtual().getId();
        if (preco == null || preco.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe um preço válido para a vacina");
        }
        int n = jdbc.update(
                "UPDATE flutz.empresa_vacina SET preco = ? WHERE empresa_vacina_id = ? AND empresa_id = ?",
                preco.setScale(2, RoundingMode.HALF_UP), empresaVacinaId, empresaId
        );
        if (n == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Vacina não encontrada nesta clínica");
        }
        return vacinasGestao().stream()
                .filter(v -> v.id().equals(empresaVacinaId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Vacina não encontrada"));
    }

    private DiaAgenda montarDia(Integer empresaId, LocalDate dia) {
        FeriadoRow feriado = feriado(empresaId, dia);
        String nota = nota(empresaId, dia);
        if (feriado != null && !feriado.atende) {
            return new DiaAgenda(dia.toString(), "FERIADO", feriado.nome, List.of(), nota);
        }
        List<ProfissionalJanela> grade = feriado != null && feriado.atende
                ? profissionaisNoHorario(empresaId, dia, feriado.inicio, feriado.fim)
                : profissionaisDoDia(empresaId, dia);
        if (grade.isEmpty()) {
            return new DiaAgenda(dia.toString(), "SEM_EXPEDIENTE", feriado == null ? null : feriado.nome, List.of(), nota);
        }
        LocalTime abre = grade.stream().map(p -> p.inicio).min(LocalTime::compareTo).orElse(LocalTime.MIN);
        LocalTime fecha = grade.stream().map(p -> p.fim).max(LocalTime::compareTo).orElse(LocalTime.MAX);
        List<Janela> janelas = cortarBloqueios(empresaId, dia, List.of(new Janela(abre, fecha)));
        List<Ocupacao> ocupados = ocupacoesEquipe(empresaId, dia);
        List<Slot> livres = new ArrayList<>();
        for (Janela janela : janelas) {
            LocalDateTime cursor = dia.atTime(janela.inicio);
            LocalDateTime limite = dia.atTime(janela.fim);
            while (!cursor.plusMinutes(SLOT_PADRAO).isAfter(limite)) {
                Instant ini = cursor.atZone(ZONA).toInstant();
                Instant fim = cursor.plusMinutes(SLOT_PADRAO).atZone(ZONA).toInstant();
                int vagas = vagasLivres(grade, ocupados, ini, fim, null);
                if (vagas > 0 && fim.isAfter(Instant.now())) {
                    livres.add(new Slot(ini.toString(), fim.toString(), "LIVRE", vagas));
                }
                cursor = cursor.plusMinutes(SLOT_PADRAO);
            }
        }
        String estado;
        if (livres.isEmpty() && ocupados.isEmpty()) {
            estado = "BLOQUEADO";
        } else if (livres.isEmpty()) {
            estado = "LOTADO";
        } else if (ocupados.isEmpty()) {
            estado = "DISPONIVEL";
        } else {
            estado = "PARCIAL";
        }
        return new DiaAgenda(dia.toString(), estado, feriado == null ? null : feriado.nome, livres, nota);
    }

    private List<ProfissionalJanela> profissionaisDoDia(Integer empresaId, LocalDate dia) {
        int iso = iso(dia);
        List<Janela> clinica = jdbc.query(
                """
                SELECT hora_inicio, hora_fim FROM flutz.empresa_expediente
                WHERE empresa_id = ? AND dia_semana = ?
                ORDER BY hora_inicio
                """,
                (rs, i) -> new Janela(rs.getTime(1).toLocalTime(), rs.getTime(2).toLocalTime()),
                empresaId, iso
        );
        List<ProfissionalJanela> equipe = jdbc.query(
                """
                SELECT c.colaborador_id, h.hora_inicio, h.hora_fim
                FROM flutz.colaborador_horario h
                JOIN flutz.colaborador c ON c.colaborador_id = h.colaborador_id
                JOIN flutz.status sh ON sh.status_id = h.status_id
                JOIN flutz.status sc ON sc.status_id = c.status_id
                WHERE c.empresa_id = ? AND h.dia_semana = ?
                  AND LOWER(sh.descricao) = 'ativo' AND LOWER(sc.descricao) = 'ativo'
                """,
                (rs, i) -> new ProfissionalJanela(rs.getInt(1), rs.getTime(2).toLocalTime(), rs.getTime(3).toLocalTime()),
                empresaId, iso
        );
        if (clinica.isEmpty()) {
            return equipe;
        }
        if (equipe.isEmpty()) {
            List<Integer> ativos = jdbc.query(
                    """
                    SELECT c.colaborador_id
                    FROM flutz.colaborador c
                    JOIN flutz.status s ON s.status_id = c.status_id
                    WHERE c.empresa_id = ? AND LOWER(s.descricao) = 'ativo'
                    """,
                    (rs, i) -> rs.getInt(1),
                    empresaId
            );
            List<ProfissionalJanela> fallback = new ArrayList<>();
            for (Integer id : ativos) {
                for (Janela faixa : clinica) {
                    fallback.add(new ProfissionalJanela(id, faixa.inicio, faixa.fim));
                }
            }
            return fallback;
        }
        List<ProfissionalJanela> recorte = new ArrayList<>();
        for (ProfissionalJanela p : equipe) {
            for (Janela faixa : clinica) {
                LocalTime ini = p.inicio.isAfter(faixa.inicio) ? p.inicio : faixa.inicio;
                LocalTime fim = p.fim.isBefore(faixa.fim) ? p.fim : faixa.fim;
                if (ini.isBefore(fim)) {
                    recorte.add(new ProfissionalJanela(p.colaboradorId, ini, fim));
                }
            }
        }
        return recorte;
    }

    private List<ProfissionalJanela> profissionaisNoHorario(Integer empresaId, LocalDate dia, LocalTime inicio, LocalTime fim) {
        List<ProfissionalJanela> base = profissionaisDoDia(empresaId, dia);
        if (base.isEmpty()) {
            return jdbc.query(
                    """
                    SELECT c.colaborador_id, CAST(? AS time), CAST(? AS time)
                    FROM flutz.colaborador c
                    JOIN flutz.status s ON s.status_id = c.status_id
                    WHERE c.empresa_id = ? AND LOWER(s.descricao) = 'ativo'
                    """,
                    (rs, i) -> new ProfissionalJanela(rs.getInt(1), inicio, fim),
                    Time.valueOf(inicio), Time.valueOf(fim), empresaId
                );
        }
        List<ProfissionalJanela> recorte = new ArrayList<>();
        for (ProfissionalJanela p : base) {
            LocalTime ini = p.inicio.isAfter(inicio) ? p.inicio : inicio;
            LocalTime end = p.fim.isBefore(fim) ? p.fim : fim;
            if (ini.isBefore(end)) {
                recorte.add(new ProfissionalJanela(p.colaboradorId, ini, end));
            }
        }
        return recorte;
    }

    private List<Janela> cortarBloqueios(Integer empresaId, LocalDate dia, List<Janela> janelas) {
        Instant diaIni = dia.atStartOfDay(ZONA).toInstant();
        Instant diaFim = dia.plusDays(1).atStartOfDay(ZONA).toInstant();
        List<Janela> bloqueios = jdbc.query(
                """
                SELECT data_hora_inicio, data_hora_fim FROM flutz.empresa_bloqueio
                WHERE empresa_id = ? AND data_hora_inicio < ? AND data_hora_fim > ?
                """,
                (rs, i) -> new Janela(
                        LocalDateTime.ofInstant(rs.getTimestamp(1).toInstant(), ZONA).toLocalTime(),
                        LocalDateTime.ofInstant(rs.getTimestamp(2).toInstant(), ZONA).toLocalTime()
                ),
                empresaId, Timestamp.from(diaFim), Timestamp.from(diaIni)
        );
        List<Janela> resultado = new ArrayList<>(janelas);
        for (Janela bloq : bloqueios) {
            List<Janela> next = new ArrayList<>();
            for (Janela janela : resultado) {
                if (bloq.fim.compareTo(janela.inicio) <= 0 || bloq.inicio.compareTo(janela.fim) >= 0) {
                    next.add(janela);
                    continue;
                }
                if (janela.inicio.isBefore(bloq.inicio)) {
                    next.add(new Janela(janela.inicio, bloq.inicio));
                }
                if (bloq.fim.isBefore(janela.fim)) {
                    next.add(new Janela(bloq.fim, janela.fim));
                }
            }
            resultado = next;
        }
        return resultado;
    }

    private List<Ocupacao> ocupacoesEquipe(Integer empresaId, LocalDate dia) {
        Instant ini = dia.atStartOfDay(ZONA).toInstant();
        Instant fim = dia.plusDays(1).atStartOfDay(ZONA).toInstant();
        return jdbc.query(
                """
                SELECT g.agendamento_id, g.colaborador_id, g.data_hora_inicio, COALESCE(g.data_hora_fim, g.data_hora_inicio + INTERVAL '30 minutes')
                FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                WHERE g.empresa_id = ? AND g.colaborador_id IS NOT NULL
                  AND g.data_hora_inicio < ? AND COALESCE(g.data_hora_fim, g.data_hora_inicio) > ?
                  AND st.codigo IN ('CONFIRMADO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_PAGAMENTO')
                """,
                (rs, i) -> new Ocupacao(rs.getInt(1), rs.getInt(2), rs.getTimestamp(3).toInstant(), rs.getTimestamp(4).toInstant()),
                empresaId, Timestamp.from(fim), Timestamp.from(ini)
        );
    }

    private int vagasLivres(List<ProfissionalJanela> grade, List<Ocupacao> ocupados, Instant ini, Instant fim, Integer ignorarId) {
        Set<Integer> livres = new HashSet<>();
        LocalTime tIni = LocalDateTime.ofInstant(ini, ZONA).toLocalTime();
        LocalTime tFim = LocalDateTime.ofInstant(fim, ZONA).toLocalTime();
        for (ProfissionalJanela p : grade) {
            if (!p.inicio.isAfter(tIni) && !p.fim.isBefore(tFim)) {
                livres.add(p.colaboradorId);
            }
        }
        for (Ocupacao o : ocupados) {
            if (ignorarId != null && ignorarId.equals(o.agendamentoId)) {
                continue;
            }
            if (ini.isBefore(o.fim) && fim.isAfter(o.inicio)) {
                livres.remove(o.colaboradorId);
            }
        }
        return livres.size();
    }

    private boolean slotLivre(Integer empresaId, Instant inicio, Instant fim, Integer ignorarId) {
        LocalDate dia = LocalDateTime.ofInstant(inicio, ZONA).toLocalDate();
        DiaAgenda montado = montarDia(empresaId, dia);
        if ("FERIADO".equals(montado.estado()) || "SEM_EXPEDIENTE".equals(montado.estado()) || "BLOQUEADO".equals(montado.estado())) {
            return false;
        }
        boolean encaixa = montado.slots().stream().anyMatch(s -> {
            Instant slotIni = Instant.parse(s.inicio());
            Instant slotFim = Instant.parse(s.fim());
            return "LIVRE".equals(s.estado())
                    && !slotIni.isAfter(inicio)
                    && !slotFim.isBefore(fim)
                    && (s.vagas() == null || s.vagas() > 0);
        });
        // Proposta/aceite: se o próprio agendamento ocupa o horário, ainda pode aceitar.
        return (encaixa || ignorarId != null) && alguemLivre(empresaId, inicio, fim, ignorarId);
    }

    private boolean alguemLivre(Integer empresaId, Instant inicio, Instant fim, Integer ignorarId) {
        LocalDate dia = LocalDateTime.ofInstant(inicio, ZONA).toLocalDate();
        List<ProfissionalJanela> grade = profissionaisDoDia(empresaId, dia);
        List<Ocupacao> ocupados = ocupacoesEquipe(empresaId, dia);
        return vagasLivres(grade, ocupados, inicio, fim, ignorarId) > 0;
    }

    private boolean profissionalLivre(Integer colaboradorId, Instant inicio, Instant fim, Integer ignorarId) {
        LocalDate dia = LocalDateTime.ofInstant(inicio, ZONA).toLocalDate();
        LocalTime tIni = LocalDateTime.ofInstant(inicio, ZONA).toLocalTime();
        LocalTime tFim = LocalDateTime.ofInstant(fim, ZONA).toLocalTime();
        Time iniSql = Time.valueOf(tIni);
        Time fimSql = Time.valueOf(tFim.equals(LocalTime.MIDNIGHT) ? LocalTime.of(23, 59, 59) : tFim);
        int diaIso = iso(dia);
        Long naGrade = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM flutz.colaborador_horario h
                JOIN flutz.status s ON s.status_id = h.status_id
                WHERE h.colaborador_id = ? AND h.dia_semana = ? AND LOWER(s.descricao) = 'ativo'
                  AND h.hora_inicio <= ? AND h.hora_fim >= ?
                """,
                Long.class, colaboradorId, diaIso, iniSql, fimSql
        );
        if (naGrade == null || naGrade == 0) {
            Long temGradePropria = jdbc.queryForObject(
                    """
                    SELECT COUNT(*) FROM flutz.colaborador_horario h
                    JOIN flutz.status s ON s.status_id = h.status_id
                    WHERE h.colaborador_id = ? AND LOWER(s.descricao) = 'ativo'
                    """,
                    Long.class, colaboradorId
            );
            if (temGradePropria != null && temGradePropria > 0) {
                return false;
            }
            Integer empresaId = jdbc.query(
                    "SELECT empresa_id FROM flutz.colaborador WHERE colaborador_id = ?",
                    rs -> rs.next() ? rs.getInt(1) : null,
                    colaboradorId
            );
            if (empresaId == null) {
                return false;
            }
            Long noExpediente = jdbc.queryForObject(
                    """
                    SELECT COUNT(*) FROM flutz.empresa_expediente
                    WHERE empresa_id = ? AND dia_semana = ?
                      AND hora_inicio <= ? AND hora_fim >= ?
                    """,
                    Long.class, empresaId, diaIso, iniSql, fimSql
            );
            if (noExpediente == null || noExpediente == 0) {
                return false;
            }
        }
        Long n = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM flutz.agendamento g
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                WHERE g.colaborador_id = ?
                  AND st.codigo IN ('CONFIRMADO', 'AGUARDANDO_CLIENTE', 'AGUARDANDO_PAGAMENTO')
                  AND g.data_hora_fim IS NOT NULL
                  AND ? < g.data_hora_fim AND ? > g.data_hora_inicio
                  AND g.agendamento_id <> ?
                """,
                Long.class, colaboradorId, Timestamp.from(inicio), Timestamp.from(fim), ignorarId == null ? -1 : ignorarId
        );
        return n != null && n == 0;
    }

    private void exigirColaboradorDaClinica(Integer empresaId, Integer colaboradorId) {
        Long n = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM flutz.colaborador c
                JOIN flutz.status s ON s.status_id = c.status_id
                WHERE c.colaborador_id = ? AND c.empresa_id = ? AND LOWER(s.descricao) = 'ativo'
                """,
                Long.class, colaboradorId, empresaId
        );
        if (n == null || n == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profissional inválido nesta clínica");
        }
    }

    private int iso(LocalDate dia) {
        return dia.getDayOfWeek() == DayOfWeek.SUNDAY ? 7 : dia.getDayOfWeek().getValue();
    }

    private boolean abertaAgora(Integer empresaId, Instant agora) {
        LocalDate dia = LocalDateTime.ofInstant(agora, ZONA).toLocalDate();
        DiaAgenda montado = montarDia(empresaId, dia);
        if ("FERIADO".equals(montado.estado()) || "SEM_EXPEDIENTE".equals(montado.estado())) {
            return false;
        }
        LocalTime agoraLocal = LocalDateTime.ofInstant(agora, ZONA).toLocalTime();
        return profissionaisDoDia(empresaId, dia).stream().anyMatch(p ->
                !p.inicio.isAfter(agoraLocal) && p.fim.isAfter(agoraLocal)
        );
    }

    private void garantirVinculo(Integer empresaId, Integer clienteId) {
        Long existe = jdbc.queryForObject(
                "SELECT COUNT(*) FROM flutz.empresa_cliente WHERE empresa_id = ? AND cliente_id = ?",
                Long.class, empresaId, clienteId
        );
        if (existe != null && existe > 0) {
            return;
        }
        jdbc.update(
                "INSERT INTO flutz.empresa_cliente (empresa_id, cliente_id, status_id) VALUES (?, ?, ?)",
                empresaId, clienteId, statusAtivo()
        );
    }

    private void validarPet(Integer petId, Integer clienteId, Integer empresaId, String tipo, Integer vacinaId) {
        var pet = jdbc.query(
                """
                SELECT p.pet_id, p.cliente_id, p.pet_especie_id, s.descricao
                FROM flutz.pet p
                JOIN flutz.status s ON s.status_id = p.status_id
                WHERE p.pet_id = ?
                """,
                rs -> rs.next() ? new int[] {rs.getInt(1), rs.getInt(2), rs.getInt(3), "ativo".equalsIgnoreCase(rs.getString(4)) ? 1 : 0} : null,
                petId
        );
        if (pet == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pet não encontrado");
        }
        if (pet[1] != clienteId) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Este pet não pertence ao tutor");
        }
        if (pet[3] != 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pet inativo");
        }
        if (tipo != null && "VACINACAO".equalsIgnoreCase(tipo) && vacinaId != null && !vacinaCompativel(vacinaId, pet[2])) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vacina incompatível com a espécie do pet");
        }
    }

    private boolean vacinaDisponivel(Integer empresaId, Integer empresaVacinaId, Integer petId) {
        Long n = jdbc.queryForObject(
                """
                SELECT COUNT(*) FROM flutz.empresa_vacina ev
                JOIN flutz.status s ON s.status_id = ev.status_id
                WHERE ev.empresa_vacina_id = ? AND ev.empresa_id = ? AND ev.visivel_agendamento = TRUE AND LOWER(s.descricao) = 'ativo'
                """,
                Long.class, empresaVacinaId, empresaId
        );
        if (n == null || n == 0) {
            return false;
        }
        Integer especie = jdbc.queryForObject("SELECT pet_especie_id FROM flutz.pet WHERE pet_id = ?", Integer.class, petId);
        return vacinaCompativel(empresaVacinaId, especie);
    }

    private boolean vacinaCompativel(Integer empresaVacinaId, Integer especieId) {
        Long restricoes = jdbc.queryForObject(
                "SELECT COUNT(*) FROM flutz.empresa_vacina_especie WHERE empresa_vacina_id = ?",
                Long.class, empresaVacinaId
        );
        if (restricoes == null || restricoes == 0) {
            return true;
        }
        Long ok = jdbc.queryForObject(
                "SELECT COUNT(*) FROM flutz.empresa_vacina_especie WHERE empresa_vacina_id = ? AND pet_especie_id = ?",
                Long.class, empresaVacinaId, especieId
        );
        return ok != null && ok > 0;
    }

    private Solicitacao mudar(Integer id, Solicitacao atual, String codigo, String motivo) {
        Integer novo = statusId(codigo);
        jdbc.update(
                "UPDATE flutz.agendamento SET agendamento_status_id = ?, motivo_status = ? WHERE agendamento_id = ?",
                novo, blank(motivo), id
        );
        registrarEvento(id, atual.empresaId(), AuthHolder.current(), statusId(atual.statusCodigo()), novo, motivo);
        Solicitacao atualizada = detalhe(id);
        if ("CANCELADO_CLIENTE".equals(codigo)) {
            notifications.notificarCancelamentoAgenda(atualizada, true);
        } else if ("CANCELADO_CLINICA".equals(codigo)) {
            notifications.notificarCancelamentoAgenda(atualizada, false);
        } else if ("RECUSADO".equals(codigo)) {
            notifications.notificarRecusaAgenda(atualizada);
        }
        return atualizada;
    }

    private void registrarEvento(Integer agendamentoId, Integer empresaId, AuthPrincipal auth, Integer anterior, Integer novo, String motivo) {
        jdbc.update(
                """
                INSERT INTO flutz.agendamento_evento (agendamento_id, empresa_id, ator_tipo, ator_id, status_anterior_id, status_novo_id, motivo)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                agendamentoId, empresaId, auth.tipo().name(), auth.atorId(), anterior, novo, blank(motivo)
        );
    }

    private Solicitacao exigirClinica(Integer id) {
        Solicitacao atual = detalhe(id);
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Ação da clínica");
        }
        return atual;
    }

    private void exigirCodigo(Solicitacao atual, String... codigos) {
        for (String codigo : codigos) {
            if (codigo.equals(atual.statusCodigo())) {
                return;
            }
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status atual não permite esta ação");
    }

    private void exigirGestao() {
        AuthPrincipal auth = AuthHolder.current();
        if (auth.tutor()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Somente a clínica");
        }
        if (auth.colaborador() && !auth.temPapel("administrador") && !auth.temPapel("veterinario")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sem permissão de agenda");
        }
    }

    private FeriadoRow feriado(Integer empresaId, LocalDate dia) {
        return jdbc.query(
                "SELECT nome, atende, hora_inicio, hora_fim FROM flutz.empresa_feriado WHERE empresa_id = ? AND data = ?",
                rs -> rs.next()
                        ? new FeriadoRow(
                                rs.getString(1),
                                rs.getBoolean(2),
                                rs.getTime(3) == null ? null : rs.getTime(3).toLocalTime(),
                                rs.getTime(4) == null ? null : rs.getTime(4).toLocalTime()
                        )
                        : null,
                empresaId, Date.valueOf(dia)
        );
    }

    private String nota(Integer empresaId, LocalDate dia) {
        return jdbc.query(
                "SELECT texto FROM flutz.empresa_agenda_nota WHERE empresa_id = ? AND data = ?",
                rs -> rs.next() ? rs.getString(1) : null,
                empresaId, Date.valueOf(dia)
        );
    }

    private List<String> servicosNomes(Integer empresaId) {
        return jdbc.query(
                """
                SELECT COALESCE(es.nome_exibicao, t.tipo_servico)
                FROM flutz.empresa_servico es
                JOIN flutz.tipo_servico t ON t.tipo_servico_id = es.tipo_servico_id
                JOIN flutz.status s ON s.status_id = es.status_id
                WHERE es.empresa_id = ? AND es.visivel_pagina = TRUE AND LOWER(s.descricao) = 'ativo'
                ORDER BY es.ordem
                LIMIT 6
                """,
                (rs, i) -> rs.getString(1),
                empresaId
        );
    }

    private List<String> especialidadesNomes(Integer empresaId) {
        return jdbc.query(
                """
                SELECT e.descricao
                FROM flutz.empresa_especialidade ee
                JOIN flutz.especialidade e ON e.especialidade_id = ee.especialidade_id
                WHERE ee.empresa_id = ?
                ORDER BY ee.ordem, e.descricao
                LIMIT 8
                """,
                (rs, i) -> rs.getString(1),
                empresaId
        );
    }

    private BigDecimal mediaAvaliacoes(Integer empresaId) {
        return jdbc.query(
                "SELECT ROUND(AVG(nota), 1) FROM flutz.avaliacao WHERE empresa_id = ?",
                rs -> rs.next() ? rs.getBigDecimal(1) : null,
                empresaId
        );
    }

    private int totalAvaliacoes(Integer empresaId) {
        Long n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM flutz.avaliacao WHERE empresa_id = ?",
                Long.class,
                empresaId
        );
        return n == null ? 0 : n.intValue();
    }

    private List<String> horariosLivresHoje(Integer empresaId) {
        DiaAgenda dia = montarDia(empresaId, LocalDate.now(ZONA));
        return dia.slots().stream()
                .filter(slot -> "LIVRE".equals(slot.estado()))
                .limit(6)
                .map(slot -> {
                    Instant ini = Instant.parse(slot.inicio());
                    return LocalDateTime.ofInstant(ini, ZONA).toLocalTime().toString().substring(0, 5);
                })
                .toList();
    }

    private String baseSelect() {
        return """
                SELECT g.agendamento_id, g.empresa_id, e.nome_empresa, g.cliente_id, c.nome_cliente,
                       g.pet_id, p.nome_pet, p.foto_url AS pet_foto_url, es_pet.descricao AS especie,
                       g.tipo, st.codigo, st.descricao, g.data_hora_inicio, g.data_hora_fim,
                       g.observacoes, g.motivo_status, g.data_hora_proposta_inicio, g.data_hora_proposta_fim,
                       COALESCE(es.nome_exibicao, ts.tipo_servico) AS servico, v.nome_vacina,
                       g.colaborador_id, col.nome_colaborador, g.empresa_servico_id,
                       g.valor_servico, g.valor_desconto, g.valor_cobrado, cup.codigo AS codigo_cupom
                FROM flutz.agendamento g
                JOIN flutz.empresa e ON e.empresa_id = g.empresa_id
                JOIN flutz.cliente c ON c.cliente_id = g.cliente_id
                JOIN flutz.pet p ON p.pet_id = g.pet_id
                JOIN flutz.pet_especie es_pet ON es_pet.pet_especie_id = p.pet_especie_id
                JOIN flutz.agendamento_status st ON st.agendamento_status_id = g.agendamento_status_id
                LEFT JOIN flutz.empresa_servico es ON es.empresa_servico_id = g.empresa_servico_id
                LEFT JOIN flutz.tipo_servico ts ON ts.tipo_servico_id = es.tipo_servico_id
                LEFT JOIN flutz.empresa_vacina ev ON ev.empresa_vacina_id = g.empresa_vacina_id
                LEFT JOIN flutz.vacina v ON v.vacina_id = ev.vacina_id
                LEFT JOIN flutz.colaborador col ON col.colaborador_id = g.colaborador_id
                LEFT JOIN flutz.empresa_cupom cup ON cup.empresa_cupom_id = g.empresa_cupom_id
                """;
    }

    private Solicitacao mapSolicitacao(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp ini = rs.getTimestamp("data_hora_inicio");
        Timestamp fim = rs.getTimestamp("data_hora_fim");
        Timestamp pIni = rs.getTimestamp("data_hora_proposta_inicio");
        Timestamp pFim = rs.getTimestamp("data_hora_proposta_fim");
        return new Solicitacao(
                rs.getInt("agendamento_id"),
                rs.getInt("empresa_id"),
                rs.getString("nome_empresa"),
                rs.getInt("cliente_id"),
                rs.getString("nome_cliente"),
                rs.getInt("pet_id"),
                rs.getString("nome_pet"),
                rs.getString("especie"),
                rs.getString("pet_foto_url"),
                rs.getString("tipo"),
                rs.getString("codigo"),
                rs.getString("descricao"),
                rs.getString("servico"),
                rs.getString("nome_vacina"),
                (Integer) rs.getObject("colaborador_id"),
                rs.getString("nome_colaborador"),
                ini.toInstant().toString(),
                fim == null ? null : fim.toInstant().toString(),
                rs.getString("observacoes"),
                rs.getString("motivo_status"),
                pIni == null ? null : pIni.toInstant().toString(),
                pFim == null ? null : pFim.toInstant().toString(),
                (Integer) rs.getObject("empresa_servico_id"),
                rs.getBigDecimal("valor_servico"),
                rs.getBigDecimal("valor_desconto"),
                rs.getBigDecimal("valor_cobrado"),
                rs.getString("codigo_cupom")
        );
    }

    private BigDecimal exigirPrecoAgendamento(String tipo, Integer servicoId, Integer vacinaId, Integer empresaId) {
        if ("VACINACAO".equals(tipo)) {
            BigDecimal preco = jdbc.query(
                    "SELECT preco FROM flutz.empresa_vacina WHERE empresa_vacina_id = ? AND empresa_id = ?",
                    rs -> rs.next() ? rs.getBigDecimal(1) : null,
                    vacinaId, empresaId
            );
            if (preco == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Defina o preço desta vacina antes de agendar");
            }
            return preco.setScale(2, RoundingMode.HALF_UP);
        }
        BigDecimal preco = jdbc.query(
                "SELECT preco FROM flutz.empresa_servico WHERE empresa_servico_id = ? AND empresa_id = ?",
                rs -> rs.next() ? rs.getBigDecimal(1) : null,
                servicoId, empresaId
        );
        if (preco == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Defina o preço deste serviço antes de agendar");
        }
        return preco.setScale(2, RoundingMode.HALF_UP);
    }

    private Integer statusId(String codigo) {
        Integer id = jdbc.query(
                "SELECT agendamento_status_id FROM flutz.agendamento_status WHERE codigo = ?",
                rs -> rs.next() ? rs.getInt(1) : null,
                codigo
        );
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Status de agenda ausente: " + codigo);
        }
        return id;
    }

    private int duracaoMinutos(Integer empresaServicoId) {
        if (empresaServicoId == null) {
            return SLOT_PADRAO;
        }
        Integer minutos = jdbc.query(
                "SELECT duracao_minutos FROM flutz.empresa_servico WHERE empresa_servico_id = ?",
                rs -> rs.next() ? (Integer) rs.getObject(1) : null,
                empresaServicoId
        );
        return minutos == null || minutos <= 0 ? SLOT_PADRAO : minutos;
    }

    private void oferecerVacinasDoCatalogo(Integer empresaId) {
        Integer status = statusAtivo();
        if (empresaId == null || status == null) {
            return;
        }
        jdbc.update(
                """
                INSERT INTO flutz.empresa_vacina (empresa_id, vacina_id, status_id, visivel_agendamento)
                SELECT ?, v.vacina_id, ?, TRUE
                FROM flutz.vacina v
                WHERE v.empresa_id = ?
                  AND NOT EXISTS (
                    SELECT 1 FROM flutz.empresa_vacina ev
                    WHERE ev.empresa_id = ? AND ev.vacina_id = v.vacina_id
                  )
                """,
                empresaId, status, empresaId, empresaId
        );
    }

    private Integer statusAtivo() {
        return jdbc.query(
                "SELECT status_id FROM flutz.status WHERE LOWER(descricao) = 'ativo'",
                rs -> rs.next() ? rs.getInt(1) : null
        );
    }

    private static void validarCoord(BigDecimal lat, BigDecimal lng) {
        if (lat == null || lng == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe latitude e longitude");
        }
        if (lat.abs().compareTo(BigDecimal.valueOf(90)) > 0 || lng.abs().compareTo(BigDecimal.valueOf(180)) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordenada inválida");
        }
    }

    private static BigDecimal distanciaKm(BigDecimal lat1, BigDecimal lng1, BigDecimal lat2, BigDecimal lng2) {
        if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
            return null;
        }
        double r = 6371;
        double dLat = Math.toRadians(lat2.doubleValue() - lat1.doubleValue());
        double dLng = Math.toRadians(lng2.doubleValue() - lng1.doubleValue());
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1.doubleValue())) * Math.cos(Math.toRadians(lat2.doubleValue()))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return BigDecimal.valueOf(r * c).setScale(1, RoundingMode.HALF_UP);
    }

    private static String endereco(String logradouro, String numero, String bairro, String cidade, String uf) {
        List<String> partes = new ArrayList<>();
        if (logradouro != null) {
            partes.add(numero == null ? logradouro : logradouro + ", " + numero);
        }
        if (bairro != null) {
            partes.add(bairro);
        }
        if (cidade != null) {
            partes.add(uf == null ? cidade : cidade + " - " + uf);
        }
        return String.join(", ", partes);
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private record Janela(LocalTime inicio, LocalTime fim) {
    }

    private record ProfissionalJanela(Integer colaboradorId, LocalTime inicio, LocalTime fim) {
    }

    private record Ocupacao(Integer agendamentoId, Integer colaboradorId, Instant inicio, Instant fim) {
    }

    private record FeriadoRow(String nome, boolean atende, LocalTime inicio, LocalTime fim) {
    }

    public record Localizacao(BigDecimal latitude, BigDecimal longitude) {
    }

    public record CoordenadasClinica(BigDecimal latitude, BigDecimal longitude) {
    }

    public record ClinicaAgenda(
            Integer id, String nome, String slug, String logoUrl, String endereco, String cidade, String uf,
            String sobre, BigDecimal distanciaKm, boolean aberta, List<String> servicos,
            List<String> especialidades, BigDecimal notaMedia, Integer totalAvaliacoes, List<String> horariosHoje
    ) {
    }

    public record Disponibilidade(Integer empresaId, List<DiaAgenda> dias) {
    }

    public record DiaAgenda(String data, String estado, String feriado, List<Slot> slots, String nota) {
    }

    public record Slot(String inicio, String fim, String estado, Integer vagas) {
    }

    public record NovaSolicitacao(
            Integer empresaId, Integer clienteId, Integer petId, Integer colaboradorId,
            String tipo, Integer empresaServicoId, Integer empresaVacinaId,
            Instant dataHoraInicio, Instant dataHoraFim, String observacoes
    ) {
    }

    public record Solicitacao(
            Integer id, Integer empresaId, String clinica, Integer clienteId, String tutor,
            Integer petId, String pet, String especie, String fotoUrl, String tipo, String statusCodigo, String status,
            String servico, String vacina, Integer colaboradorId, String colaborador,
            String inicio, String fim, String observacoes,
            String motivoStatus, String propostaInicio, String propostaFim,
            Integer empresaServicoId, BigDecimal valorServico, BigDecimal valorDesconto, BigDecimal valorCobrado,
            String codigoCupom
    ) {
    }

    public record ConfirmarReq(Integer colaboradorId, Instant dataHoraFim) {
    }

    public record MotivoReq(String motivo) {
    }

    public record PropostaReq(Instant dataHoraInicio, Instant dataHoraFim, String motivo) {
    }

    public record Faixa(Integer id, Integer diaSemana, String inicio, String fim) {
    }

    public record Feriado(Integer id, String data, String nome, boolean atende, String inicio, String fim) {
    }

    public record Bloqueio(Integer id, String inicio, String fim, String motivo) {
    }

    public record NotaDia(String data, String texto) {
    }

    public record VacinaOferta(
            Integer id, String nome, String descricao, String fabricante, boolean visivelAgendamento,
            Integer idadeMinimaMeses, Integer idadeMaximaMeses, Integer intervaloDosesDias, String observacoes,
            BigDecimal preco
    ) {
    }

    public record PetAgenda(
            Integer id, String nome, String especie, String fotoUrl, String raca, String sexo, String nascimento
    ) {
    }

    public record ServicoAgenda(Integer id, String nome, Integer duracaoMinutos, BigDecimal preco) {
    }

    public record AgendaConfig(BigDecimal latitude, BigDecimal longitude, Integer cancelamentoAntecedenciaMinutos) {
    }
}
