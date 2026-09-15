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
@Table(name = "colaborador", schema = "flutz")
public class Colaborador {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "colaborador_id")
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "empresa_id", nullable = false)
    private Empresa empresa;

    @Column(name = "nome_colaborador", nullable = false, length = 150)
    private String nomeColaborador;

    @Column(nullable = false, length = 14)
    private String cpf;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "senha_hash", nullable = false)
    private String senhaHash;

    @Column(length = 20)
    private String telefone;

    @Column(length = 80)
    private String cargo;

    @Column(name = "exibir_pagina", nullable = false)
    private boolean exibirPagina;

    @Column(name = "imagem_url", length = 500)
    private String imagemUrl;

    @Column(name = "permitir_notificacoes", nullable = false)
    private boolean permitirNotificacoes = true;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "status_id", nullable = false)
    private Status status;

    @Column(name = "anonimizado_em")
    private java.time.Instant anonimizadoEm;

    public Integer getId() {
        return id;
    }

    public Empresa getEmpresa() {
        return empresa;
    }

    public void setEmpresa(Empresa empresa) {
        this.empresa = empresa;
    }

    public String getNomeColaborador() {
        return nomeColaborador;
    }

    public void setNomeColaborador(String nomeColaborador) {
        this.nomeColaborador = nomeColaborador;
    }

    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getSenhaHash() {
        return senhaHash;
    }

    public void setSenhaHash(String senhaHash) {
        this.senhaHash = senhaHash;
    }

    public void setTelefone(String telefone) {
        this.telefone = telefone;
    }

    public String getCargo() {
        return cargo;
    }

    public void setCargo(String cargo) {
        this.cargo = cargo;
    }

    public boolean isExibirPagina() {
        return exibirPagina;
    }

    public void setExibirPagina(boolean exibirPagina) {
        this.exibirPagina = exibirPagina;
    }

    public String getImagemUrl() {
        return imagemUrl;
    }

    public void setImagemUrl(String imagemUrl) {
        this.imagemUrl = imagemUrl;
    }

    public boolean isPermitirNotificacoes() {
        return permitirNotificacoes;
    }

    public void setPermitirNotificacoes(boolean permitirNotificacoes) {
        this.permitirNotificacoes = permitirNotificacoes;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public Status getStatus() {
        return status;
    }

    public boolean ativo() {
        return anonimizadoEm == null && status != null && "ativo".equalsIgnoreCase(status.getDescricao());
    }
}
