package br.com.upvibe.flutz.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI flutzOpenApi(AppProperties properties) {
        String title = properties.app() != null && AppProperties.hasText(properties.app().name())
                ? properties.app().name()
                : "Flutz";

        return new OpenAPI()
                .info(new Info()
                        .title(title + " API")
                        .version("0.1.0")
                        .description("API do SaaS veterinário Flutz. Phase 1: esqueleto sem regras de negócio."));
    }
}
