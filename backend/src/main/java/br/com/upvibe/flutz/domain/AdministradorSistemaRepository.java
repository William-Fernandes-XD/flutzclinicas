package br.com.upvibe.flutz.domain;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdministradorSistemaRepository extends JpaRepository<AdministradorSistema, Integer> {

    @Query("SELECT a FROM AdministradorSistema a JOIN FETCH a.status WHERE LOWER(a.email) = LOWER(:email)")
    Optional<AdministradorSistema> findByEmailIgnoreCase(@Param("email") String email);
}
