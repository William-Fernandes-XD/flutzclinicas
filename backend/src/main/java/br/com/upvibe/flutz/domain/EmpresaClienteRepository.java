package br.com.upvibe.flutz.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmpresaClienteRepository extends JpaRepository<EmpresaCliente, Integer> {

    Optional<EmpresaCliente> findByEmpresaIdAndClienteId(Integer empresaId, Integer clienteId);

    @Query("""
            SELECT ec FROM EmpresaCliente ec
            JOIN FETCH ec.cliente
            JOIN FETCH ec.status
            WHERE ec.empresa.id = :empresaId
            """)
    List<EmpresaCliente> findByEmpresaId(@Param("empresaId") Integer empresaId);

    List<EmpresaCliente> findByClienteId(Integer clienteId);

    boolean existsByEmpresaIdAndClienteId(Integer empresaId, Integer clienteId);
}
