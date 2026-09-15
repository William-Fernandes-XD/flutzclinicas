package br.com.upvibe.flutz.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ColaboradorRepository extends JpaRepository<Colaborador, Integer> {

    @Query("SELECT c FROM Colaborador c JOIN FETCH c.status JOIN FETCH c.empresa WHERE LOWER(c.email) = LOWER(:email)")
    Optional<Colaborador> findByEmailIgnoreCase(@Param("email") String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmpresaIdAndCpf(Integer empresaId, String cpf);

    List<Colaborador> findByEmpresaIdOrderByNomeColaboradorAsc(Integer empresaId);
}
