package br.com.upvibe.flutz.domain;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AtendimentoStatusRepository extends JpaRepository<AtendimentoStatus, Integer> {
    Optional<AtendimentoStatus> findByDescricaoIgnoreCase(String descricao);
}
