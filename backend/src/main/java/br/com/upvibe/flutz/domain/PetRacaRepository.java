package br.com.upvibe.flutz.domain;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PetRacaRepository extends JpaRepository<PetRaca, Integer> {
    List<PetRaca> findByEspecieId(Integer especieId);
}
