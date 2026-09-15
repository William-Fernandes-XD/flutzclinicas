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

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
