package dev.interfere.api;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestLogFilter extends OncePerRequestFilter {
  public static final String REQUEST_ID = "interfere.requestId";
  private static final Logger LOG = LoggerFactory.getLogger(RequestLogFilter.class);

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String requestId = UUID.randomUUID().toString();
    request.setAttribute(REQUEST_ID, requestId);
    response.setHeader("X-Request-Id", requestId);
    long started = System.nanoTime();
    try {
      chain.doFilter(request, response);
    } finally {
      LOG.atInfo()
          .addKeyValue("requestId", requestId)
          .addKeyValue("method", request.getMethod())
          .addKeyValue("status", response.getStatus())
          .addKeyValue("durationMs", (System.nanoTime() - started) / 1_000_000)
          .log("HTTP request completed");
    }
  }
}
