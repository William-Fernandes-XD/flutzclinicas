package br.com.upvibe.flutz.security;

import java.util.List;

public record AuthPrincipal(
        AtorTipo tipo,
        Integer atorId,
        Integer empresaId,
        String nome,
        String identificador,
        List<String> papeis
) {
    public boolean adminPlataforma() {
        return tipo == AtorTipo.ADMINISTRADOR_SISTEMA;
    }

    public boolean colaborador() {
        return tipo == AtorTipo.COLABORADOR;
    }

    public boolean tutor() {
        return tipo == AtorTipo.CLIENTE;
    }

    public boolean temPapel(String papel) {
        return papeis.stream().anyMatch(atual -> atual.equalsIgnoreCase(papel));
    }

    public void exigirEmpresa(Integer empresaIdAlvo) {
        if (adminPlataforma()) {
            return;
        }
        if (empresaId == null || empresaIdAlvo == null || !empresaId.equals(empresaIdAlvo)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.FORBIDDEN,
                    "Recurso de outra clínica"
            );
        }
    }
}
