package br.com.upvibe.flutz.domain;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AssinaturaRepository extends JpaRepository<Assinatura, Integer> {

    Optional<Assinatura> findFirstByEmpresaIdOrderByIdDesc(Integer empresaId);
}
