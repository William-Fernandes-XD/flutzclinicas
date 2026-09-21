package br.com.upvibe.flutz.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PetRepository extends JpaRepository<Pet, Integer> {
    List<Pet> findByClienteIdOrderByNomePetAsc(Integer clienteId);

    @Query(value = """
            SELECT p.* FROM flutz.pet p
            WHERE p.pet_id IN (
                SELECT g.pet_id FROM flutz.agendamento g WHERE g.empresa_id = :empresaId
                UNION
                SELECT a.pet_id FROM flutz.atendimento a WHERE a.empresa_id = :empresaId
                UNION
                SELECT p2.pet_id FROM flutz.pet p2
                JOIN flutz.empresa_cliente ec ON ec.cliente_id = p2.cliente_id
                WHERE ec.empresa_id = :empresaId
            )
            ORDER BY p.nome_pet
            """, nativeQuery = true)
    List<Pet> findVisiveisNaClinica(@Param("empresaId") Integer empresaId);
}
