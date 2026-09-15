package br.com.upvibe.flutz.domain;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EmpresaRepository extends JpaRepository<Empresa, Integer> {

    boolean existsByCnpj(String cnpj);

    boolean existsByIdentificadorUrl(String identificadorUrl);

    Optional<Empresa> findByIdentificadorUrlIgnoreCase(String identificadorUrl);
}
