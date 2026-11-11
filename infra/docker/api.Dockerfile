FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --chown=10001:10001 services/api/target/interfere-api.jar application.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/application.jar"]
