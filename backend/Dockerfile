FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

COPY pom.xml .
COPY src ./src

RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd --system flutz \
    && useradd --system --gid flutz --no-create-home --shell /usr/sbin/nologin flutz

COPY --from=build /workspace/target/flutz.jar /app/app.jar

RUN mkdir -p /app/uploads && chown flutz:flutz /app/uploads

USER flutz

EXPOSE 8080

# ExitOnOutOfMemoryError: se a JVM ficar sem heap, ela sai em vez de ficar zumbi.
# O container sobe de novo sozinho (restart no compose). SIGKILL do sistema
# operacional não passa por aqui — por isso não há linha no log da aplicação.
ENTRYPOINT ["java", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-XX:+HeapDumpOnOutOfMemoryError", \
  "-XX:HeapDumpPath=/tmp", \
  "-XX:ErrorFile=/tmp/hs_err_flutz.log", \
  "-Xms256m", \
  "-Xmx512m", \
  "-jar", "/app/app.jar"]
