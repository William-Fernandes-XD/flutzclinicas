-- Ponto nulo operacional: Praça dos Três Poderes, Brasília.
UPDATE flutz.empresa
SET latitude = -15.77972,
    longitude = -47.92972
WHERE latitude IS NULL OR longitude IS NULL;
