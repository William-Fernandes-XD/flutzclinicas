package br.com.upvibe.flutz.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "atendimento", schema = "flutz")
public class Atendimento {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "atendimento_id")
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "empresa_id", nullable = false)
    private Empresa empresa;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pet_id", nullable = false)
    private Pet pet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agendamento_id")
    private Agendamento agendamento;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "empresa_servico_id")
    private EmpresaServico servico;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "atendimento_status_id", nullable = false)
    private AtendimentoStatus status;

    @Column(nullable = false, length = 20)
    private String origem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "colaborador_criacao_id")
    private Colaborador colaboradorCriacao;

    @Column(name = "resumo_cliente", columnDefinition = "text")
    private String resumoCliente;

    @Column(columnDefinition = "text")
    private String detalhes;

    @Column(name = "data_inicio")
    private Instant dataInicio;

    public Integer getId() {
        return id;
    }

    public void setEmpresa(Empresa empresa) {
        this.empresa = empresa;
    }

    public Empresa getEmpresa() {
        return empresa;
    }

    public Cliente getCliente() {
        return cliente;
    }

    public void setCliente(Cliente cliente) {
        this.cliente = cliente;
    }

    public Pet getPet() {
        return pet;
    }

    public void setPet(Pet pet) {
        this.pet = pet;
    }

    public void setAgendamento(Agendamento agendamento) {
        this.agendamento = agendamento;
    }

    public Agendamento getAgendamento() {
        return agendamento;
    }

    public EmpresaServico getServico() {
        return servico;
    }

    public void setServico(EmpresaServico servico) {
        this.servico = servico;
    }

    public AtendimentoStatus getStatus() {
        return status;
    }

    public void setStatus(AtendimentoStatus status) {
        this.status = status;
    }

    public void setOrigem(String origem) {
        this.origem = origem;
    }

    public void setColaboradorCriacao(Colaborador colaboradorCriacao) {
        this.colaboradorCriacao = colaboradorCriacao;
    }

    public Colaborador getColaboradorCriacao() {
        return colaboradorCriacao;
    }

    public String getResumoCliente() {
        return resumoCliente;
    }

    public void setResumoCliente(String resumoCliente) {
        this.resumoCliente = resumoCliente;
    }

    public String getDetalhes() {
        return detalhes;
    }

    public void setDetalhes(String detalhes) {
        this.detalhes = detalhes;
    }

    public Instant getDataInicio() {
        return dataInicio;
    }

    public void setDataInicio(Instant dataInicio) {
        this.dataInicio = dataInicio;
    }
}
