package br.com.upvibe.flutz.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "tipo_servico", schema = "flutz")
public class TipoServico {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "tipo_servico_id")
    private Integer id;

    @Column(name = "tipo_servico", nullable = false, length = 80)
    private String nome;

    @Column(length = 40)
    private String icone;

    public Integer getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getIcone() {
        return icone;
    }

    public void setIcone(String icone) {
        this.icone = icone;
    }
}
