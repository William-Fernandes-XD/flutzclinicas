package br.com.upvibe.flutz.domain;

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
@Table(name = "cliente", schema = "flutz")
public class Cliente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cliente_id")
    private Integer id;

    @Column(name = "nome_cliente", nullable = false, length = 150)
    private String nomeCliente;

    @Column(nullable = false, unique = true, length = 14)
    private String cpf;

    @Column(name = "senha_hash")
    private String senhaHash;

    @Column(length = 20)
    private String telefone;

    private String email;

    @Column(name = "foto_url", length = 500)
    private String fotoUrl;

    @Column(name = "permitir_notificacoes", nullable = false)
    private boolean permitirNotificacoes = true;

    @Column(name = "cadastro_completo", nullable = false)
    private boolean cadastroCompleto = true;

    @Column(name = "criado_por_empresa_id")
    private Integer criadoPorEmpresaId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "status_id", nullable = false)
    private Status status;

    @Column(name = "anonimizado_em")
    private java.time.Instant anonimizadoEm;

    public Integer getId() {
        return id;
    }

    public String getNomeCliente() {
        return nomeCliente;
    }

    public void setNomeCliente(String nomeCliente) {
        this.nomeCliente = nomeCliente;
    }

    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

    public String getSenhaHash() {
        return senhaHash;
    }

    public void setSenhaHash(String senhaHash) {
        this.senhaHash = senhaHash;
    }

    public String getTelefone() {
        return telefone;
    }

    public void setTelefone(String telefone) {
        this.telefone = telefone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFotoUrl() {
        return fotoUrl;
    }

    public void setFotoUrl(String fotoUrl) {
        this.fotoUrl = fotoUrl;
    }

    public void setPermitirNotificacoes(boolean permitirNotificacoes) {
        this.permitirNotificacoes = permitirNotificacoes;
    }

    public boolean isCadastroCompleto() {
        return cadastroCompleto;
    }

    public void setCadastroCompleto(boolean cadastroCompleto) {
        this.cadastroCompleto = cadastroCompleto;
    }

    public Integer getCriadoPorEmpresaId() {
        return criadoPorEmpresaId;
    }

    public void setCriadoPorEmpresaId(Integer criadoPorEmpresaId) {
        this.criadoPorEmpresaId = criadoPorEmpresaId;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public boolean ativo() {
        return anonimizadoEm == null && status != null && "ativo".equalsIgnoreCase(status.getDescricao());
    }
}
