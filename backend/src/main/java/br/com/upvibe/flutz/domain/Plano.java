package br.com.upvibe.flutz.domain;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "plano", schema = "flutz")
public class Plano {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "plano_id")
    private Integer id;

    @Column(nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(nullable = false, length = 80)
    private String nome;

    @Column(columnDefinition = "text")
    private String descricao;

    @Column(name = "valor_mensal", nullable = false, precision = 10, scale = 2)
    private BigDecimal valorMensal;

    @Column(nullable = false, length = 3)
    private String moeda;

    @Column(name = "limite_colaboradores")
    private Integer limiteColaboradores;

    @Column(name = "limite_clientes")
    private Integer limiteClientes;

    @Column(name = "permite_pagina_publica", nullable = false)
    private boolean permitePaginaPublica;

    @Column(name = "permite_doacoes", nullable = false)
    private boolean permiteDoacoes;

    @Column(name = "permite_pagamentos", nullable = false)
    private boolean permitePagamentos;

    @Column(nullable = false)
    private boolean ativo;

    public Integer getId() {
        return id;
    }

    public String getCodigo() {
        return codigo;
    }

    public String getNome() {
        return nome;
    }

    public String getDescricao() {
        return descricao;
    }

    public BigDecimal getValorMensal() {
        return valorMensal;
    }

    public String getMoeda() {
        return moeda;
    }

    public boolean isPermitePaginaPublica() {
        return permitePaginaPublica;
    }

    public boolean isPermiteDoacoes() {
        return permiteDoacoes;
    }

    public boolean isPermitePagamentos() {
        return permitePagamentos;
    }

    public boolean isAtivo() {
        return ativo;
    }
}
