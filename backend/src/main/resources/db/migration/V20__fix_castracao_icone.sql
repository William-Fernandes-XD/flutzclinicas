-- Corrige ícone de Castração (seed anterior mapeava para cirurgia).
UPDATE flutz.tipo_servico
SET icone = 'castracao'
WHERE lower(tipo_servico) LIKE '%castra%';
