package br.com.upvibe.flutz.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AtendimentoRepository extends JpaRepository<Atendimento, Integer> {
    List<Atendimento> findByEmpresaIdOrderByIdDesc(Integer empresaId);

    Optional<Atendimento> findByIdAndEmpresaId(Integer id, Integer empresaId);
}
