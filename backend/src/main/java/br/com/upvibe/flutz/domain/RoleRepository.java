package br.com.upvibe.flutz.domain;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, Integer> {

    Optional<Role> findByDescricaoIgnoreCase(String descricao);
}
