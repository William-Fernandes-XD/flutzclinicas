package br.com.upvibe.flutz.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmpresaServicoRepository extends JpaRepository<EmpresaServico, Integer> {

    @Query("""
            SELECT s FROM EmpresaServico s
            JOIN FETCH s.tipoServico
            LEFT JOIN FETCH s.status
            WHERE s.empresa.id = :empresaId
            ORDER BY s.ordem ASC
            """)
    List<EmpresaServico> findByEmpresaIdOrderByOrdemAsc(@Param("empresaId") Integer empresaId);

    Optional<EmpresaServico> findByIdAndEmpresaId(Integer id, Integer empresaId);
}
