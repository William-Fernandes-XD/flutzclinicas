package br.com.upvibe.flutz;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

import br.com.upvibe.flutz.config.AppProperties;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableConfigurationProperties(AppProperties.class)
@EnableScheduling
public class FlutzApplication {

    private static final Logger log = LoggerFactory.getLogger(FlutzApplication.class);

    public static void main(String[] args) {
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> log.error(
                "Exceção não tratada na thread {} — a API continua",
                thread.getName(),
                error
        ));
        Runtime.getRuntime().addShutdownHook(new Thread(
                () -> log.error("Flutz está encerrando. Se essa linha não aparecer no log e o processo sumir, o sistema operacional matou a JVM (memória ou parada do container)."),
                "flutz-shutdown"
        ));
        SpringApplication.run(FlutzApplication.class, args);
    }
}
