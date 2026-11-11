package dev.interfere.api;

import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
  private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(DataAccessException.class)
  public ResponseEntity<Object> databaseUnavailable(DataAccessException error, WebRequest request) {
    LOG.atWarn()
        .addKeyValue("requestId", requestId(request))
        .addKeyValue("errorType", error.getClass().getSimpleName())
        .log("Synthetic database check failed");
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(
            problem(
                HttpStatus.SERVICE_UNAVAILABLE,
                "The synthetic database check is unavailable.",
                request));
  }

  @Override
  protected ResponseEntity<Object> handleExceptionInternal(
      Exception error,
      @Nullable Object body,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    String detail =
        switch (status.value()) {
          case 400 -> "Use a JSON object containing only fixtureId set to synthetic-demo.";
          case 404 -> "This endpoint is not implemented.";
          case 405 -> "This HTTP method is not supported.";
          case 415 -> "Use the application/json content type.";
          default -> "The request could not be processed.";
        };
    return super.handleExceptionInternal(
        error, problem(status, detail, request), headers, status, request);
  }

  private ProblemDetail problem(HttpStatusCode status, String detail, WebRequest request) {
    String requestId = requestId(request);
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
    problem.setInstance(URI.create("urn:interfere:request:" + requestId));
    problem.setProperty("requestId", requestId);
    return problem;
  }

  private String requestId(WebRequest request) {
    return (String)
        request.getAttribute(RequestLogFilter.REQUEST_ID, RequestAttributes.SCOPE_REQUEST);
  }
}
