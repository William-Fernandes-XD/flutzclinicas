ALTER TABLE flutz.pet
  ALTER COLUMN empresa_id DROP NOT NULL;

COMMENT ON TABLE flutz.pet IS
  'Pet do tutor. A clínica vê o animal pelo agendamento ou pelo atendimento, não por cadastro na empresa.';

COMMENT ON COLUMN flutz.pet.empresa_id IS
  'Legado. Novos pets ficam sem clínica. Isolamento operacional é agendamento/atendimento.';
