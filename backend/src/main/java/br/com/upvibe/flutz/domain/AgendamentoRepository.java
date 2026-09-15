package br.com.upvibe.flutz.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AgendamentoRepository extends JpaRepository<Agendamento, Integer> {
    List<Agendamento> findByEmpresaIdOrderByDataHoraInicioDesc(Integer empresaId);

    List<Agendamento> findByEmpresaIdAndClienteIdOrderByDataHoraInicioDesc(Integer empresaId, Integer clienteId);

    Optional<Agendamento> findByIdAndEmpresaId(Integer id, Integer empresaId);
}
