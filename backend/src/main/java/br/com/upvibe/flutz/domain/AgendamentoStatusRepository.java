package br.com.upvibe.flutz.domain;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AgendamentoStatusRepository extends JpaRepository<AgendamentoStatus, Integer> {
    Optional<AgendamentoStatus> findByCodigoIgnoreCase(String codigo);
}
