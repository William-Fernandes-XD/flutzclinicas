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
@Table(name = "pet_raca", schema = "flutz")
public class PetRaca {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "pet_raca_id")
    private Integer id;

    @Column(nullable = false, length = 80)
    private String descricao;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pet_especie_id", nullable = false)
    private PetEspecie especie;

    public Integer getId() {
        return id;
    }

    public String getDescricao() {
        return descricao;
    }

    public PetEspecie getEspecie() {
        return especie;
    }
}
