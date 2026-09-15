package br.com.upvibe.flutz.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ClienteRepository extends JpaRepository<Cliente, Integer> {

    @Query("SELECT c FROM Cliente c JOIN FETCH c.status WHERE c.cpf = :cpf")
    Optional<Cliente> findByCpf(@Param("cpf") String cpf);

    @Query("SELECT c FROM Cliente c JOIN FETCH c.status WHERE LOWER(c.email) = LOWER(:email)")
    List<Cliente> findByEmailIgnoreCase(@Param("email") String email);

    boolean existsByCpf(String cpf);
}
