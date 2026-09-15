package br.com.upvibe.flutz.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PlanoRepository extends JpaRepository<Plano, Integer> {

    List<Plano> findByAtivoTrueOrderByValorMensalAsc();

    Optional<Plano> findByCodigoIgnoreCase(String codigo);
}
