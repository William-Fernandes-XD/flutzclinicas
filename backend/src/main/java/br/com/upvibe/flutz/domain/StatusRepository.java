package br.com.upvibe.flutz.domain;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface StatusRepository extends JpaRepository<Status, Integer> {

    Optional<Status> findByDescricaoIgnoreCase(String descricao);
}
