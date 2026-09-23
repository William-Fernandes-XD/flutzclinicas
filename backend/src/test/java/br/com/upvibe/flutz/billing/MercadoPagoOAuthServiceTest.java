package br.com.upvibe.flutz.billing;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;

import br.com.upvibe.flutz.clinic.ClinicService;
import br.com.upvibe.flutz.config.AppProperties;
import br.com.upvibe.flutz.domain.Empresa;
import br.com.upvibe.flutz.security.AtorTipo;
import br.com.upvibe.flutz.security.AuthHolder;
import br.com.upvibe.flutz.security.AuthPrincipal;

class MercadoPagoOAuthServiceTest {

    private JdbcTemplate jdbc;
    private ClinicService clinic;
    private AppProperties properties;
    private MercadoPagoOAuthService oauth;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        clinic = mock(ClinicService.class);
        properties = props("client-id-test", "client-secret-test",
                "http://localhost:8080/api/public/mercadopago/oauth/callback");
        oauth = new MercadoPagoOAuthService(jdbc, clinic, properties, new ObjectMapper());
    }

    @AfterEach
    void tearDown() {
        AuthHolder.clear();
    }

    @Test
    void oauthConfiguredWhenClientCredentialsPresent() {
        assertTrue(properties.mercadoPagoOAuthConfigured());
    }

    @Test
    void oauthNotConfiguredWithoutClientId() {
        assertFalse(props("", "secret", "http://localhost/cb").mercadoPagoOAuthConfigured());
    }

    @Test
    void iniciarConexaoGeraUrlComState() {
        autenticarAdmin(5, 10);
        Empresa empresa = mock(Empresa.class);
        when(empresa.getId()).thenReturn(5);
        when(clinic.empresaAtual()).thenReturn(empresa);
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any())).thenReturn(1);

        MercadoPagoOAuthService.ConnectStart start = oauth.iniciarConexao();

        assertTrue(start.authorizationUrl().startsWith("https://auth.mercadopago.com/authorization"));
        assertTrue(start.authorizationUrl().contains("client_id=client-id-test"));
        assertTrue(start.authorizationUrl().contains("response_type=code"));
        assertTrue(start.authorizationUrl().contains("state="));
        assertTrue(start.authorizationUrl().contains("platform_id=mp"));
        assertFalse(start.authorizationUrl().contains("code_challenge="));
        assertEquals(
                "http://localhost:8080/api/public/mercadopago/oauth/callback",
                start.redirectUri()
        );
        verify(jdbc).update(anyString(), any(), eq(5), eq(10), any(Timestamp.class), any(), anyString());
    }

    @Test
    void iniciarConexaoComPkceQuandoHabilitado() {
        properties = props("client-id-test", "client-secret-test",
                "http://localhost:8080/api/public/mercadopago/oauth/callback", true);
        oauth = new MercadoPagoOAuthService(jdbc, clinic, properties, new ObjectMapper());
        autenticarAdmin(5, 10);
        Empresa empresa = mock(Empresa.class);
        when(empresa.getId()).thenReturn(5);
        when(clinic.empresaAtual()).thenReturn(empresa);
        when(jdbc.update(anyString(), any(), any(), any(), any(), any(), any())).thenReturn(1);

        MercadoPagoOAuthService.ConnectStart start = oauth.iniciarConexao();

        assertTrue(start.authorizationUrl().contains("code_challenge="));
        assertTrue(start.authorizationUrl().contains("code_challenge_method=S256"));
        verify(jdbc).update(anyString(), any(), eq(5), eq(10), any(Timestamp.class), anyString(), anyString());
    }

    @Test
    void iniciarConexaoNegadoSemAdmin() {
        AuthHolder.set(new AuthPrincipal(
                AtorTipo.COLABORADOR, 10, 5, "Recepcionista", "cpf", List.of("recepcionista")
        ));
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, oauth::iniciarConexao);
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void callbackVazioEIgnoradoSemErroNaTela() {
        MercadoPagoOAuthService.CallbackResult result =
                oauth.processarCallback(null, null, null, null);
        assertTrue(result.skipRedirect());
        assertEquals(null, result.redirectUrl());
    }

    @Test
    void callbackComErroCanceladoRedirecionaComMensagem() {
        MercadoPagoOAuthService.CallbackResult result =
                oauth.processarCallback(null, null, "access_denied", "user denied");
        assertTrue(result.redirectUrl().contains("/app/financeiro"));
        assertTrue(result.redirectUrl().contains("mp=erro"));
        assertTrue(result.redirectUrl().toLowerCase().contains("cancelada")
                || result.redirectUrl().toLowerCase().contains("autoriza"));
    }

    @Test
    void callbackStateInvalidoRedirecionaErro() {
        when(jdbc.query(anyString(), ArgumentMatchers.<ResultSetExtractor<Object>>any(), any()))
                .thenReturn(null);
        MercadoPagoOAuthService.CallbackResult result =
                oauth.processarCallback("code-abc", "state-invalido", null, null);
        assertTrue(result.redirectUrl().contains("mp=erro"));
    }

    @Test
    void clinicaSemConexaoLancaErroAmigavel() {
        when(jdbc.query(anyString(), ArgumentMatchers.<ResultSetExtractor<Object>>any(), eq(99)))
                .thenReturn(null);
        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class,
                () -> oauth.exigirCredenciaisValidas(99)
        );
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("mercado pago"));
    }

    @Test
    void desconectarNaoApagaHistoricoDePagamentos() {
        autenticarAdmin(5, 10);
        Empresa empresa = mock(Empresa.class);
        when(empresa.getId()).thenReturn(5);
        when(clinic.empresaAtual()).thenReturn(empresa);
        when(jdbc.update(anyString(), eq(5))).thenReturn(1);
        when(jdbc.query(anyString(), ArgumentMatchers.<ResultSetExtractor<Object>>any(), eq(5)))
                .thenReturn(ClinicPaymentAccountService.ContaView.vazia(true));

        ClinicPaymentAccountService contas = new ClinicPaymentAccountService(jdbc, clinic, oauth);
        ClinicPaymentAccountService.ContaView view = contas.desconectar();

        assertFalse(view.conectada());
        verify(jdbc).update(anyString(), eq(5));
    }

    private void autenticarAdmin(int empresaId, int atorId) {
        AuthHolder.set(new AuthPrincipal(
                AtorTipo.COLABORADOR, atorId, empresaId, "Admin", "cpf", List.of("administrador")
        ));
    }

    private static AppProperties props(String clientId, String clientSecret, String redirect) {
        return props(clientId, clientSecret, redirect, false);
    }

    private static AppProperties props(String clientId, String clientSecret, String redirect, boolean pkce) {
        return new AppProperties(
                new AppProperties.App("Flutz", "test", "http://localhost:8080", "http://localhost:5173"),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new AppProperties.Mercadopago(
                        "TEST-pk", "TEST-at", "whsec", clientId, clientSecret, redirect, pkce, null
                )
        );
    }
}
