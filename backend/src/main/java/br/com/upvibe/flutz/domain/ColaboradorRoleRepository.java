package br.com.upvibe.flutz.domain;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ColaboradorRoleRepository extends JpaRepository<ColaboradorRole, Integer> {

    @Query("SELECT cr FROM ColaboradorRole cr JOIN FETCH cr.role WHERE cr.colaborador.id = :colaboradorId")
    List<ColaboradorRole> findByColaboradorId(@Param("colaboradorId") Integer colaboradorId);
}
