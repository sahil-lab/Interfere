package dev.interfere.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(SkeletonController.class)
class SkeletonControllerTest {
  @Autowired private MockMvc mvc;
  @MockitoBean private SkeletonService service;

  @Test
  void reportsTheDatabaseBackedContract() throws Exception {
    when(service.check("synthetic-demo"))
        .thenReturn(new SkeletonStatus("Interfere", 1, "synthetic-demo", "ready", false, false));

    mvc.perform(get("/api/skeleton/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.project").value("Interfere"))
        .andExpect(jsonPath("$.phase").value(1))
        .andExpect(jsonPath("$.fixtureId").value("synthetic-demo"))
        .andExpect(jsonPath("$.database").value("ready"))
        .andExpect(jsonPath("$.telemetryEnabled").value(false))
        .andExpect(jsonPath("$.patchAutomationEnabled").value(false));
  }

  @Test
  void validatesASyntheticCheckAndGeneratesItsOwnRequestId() throws Exception {
    when(service.check("synthetic-demo"))
        .thenReturn(new SkeletonStatus("Interfere", 1, "synthetic-demo", "ready", false, false));

    var result =
        mvc.perform(
                post("/api/skeleton/check")
                    .header("X-Request-Id", "untrusted-request-id")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"fixtureId\":\"synthetic-demo\"}"))
            .andExpect(status().isOk())
            .andExpect(header().exists("X-Request-Id"))
            .andExpect(jsonPath("$.database").value("ready"))
            .andReturn();

    assertThat(UUID.fromString(result.getResponse().getHeader("X-Request-Id"))).isNotNull();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{}",
        "{\"fixtureId\":null}",
        "{\"fixtureId\":\"\"}",
        "{\"fixtureId\":\"not-allowed-synthetic-marker\"}",
        "{\"fixtureId\":\"synthetic-demo\",\"extra\":\"not-allowed-synthetic-marker\"}",
        "{",
        "[]"
      })
  void rejectsInvalidRequestsWithoutEchoingInput(String body) throws Exception {
    var result =
        mvc.perform(
                post("/api/skeleton/check").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
            .andExpect(jsonPath("$.status").value(400))
            .andExpect(jsonPath("$.requestId").isString())
            .andExpect(content().string(not(containsString("not-allowed-synthetic-marker"))))
            .andReturn();

    assertThat(result.getResponse().getContentAsString())
        .contains(result.getResponse().getHeader("X-Request-Id"));
    verifyNoInteractions(service);
  }

  @Test
  void rejectsTheWrongContentType() throws Exception {
    mvc.perform(
            post("/api/skeleton/check").contentType(MediaType.TEXT_PLAIN).content("synthetic-demo"))
        .andExpect(status().isUnsupportedMediaType())
        .andExpect(jsonPath("$.status").value(415));
    verifyNoInteractions(service);
  }

  @Test
  void reportsDatabaseUnavailabilityWithoutExceptionDetails() throws Exception {
    when(service.check("synthetic-demo"))
        .thenThrow(new DataAccessResourceFailureException("internal-only-synthetic-marker"));

    mvc.perform(get("/api/skeleton/status"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.status").value(503))
        .andExpect(jsonPath("$.requestId").isString())
        .andExpect(content().string(not(containsString("internal-only-synthetic-marker"))));
  }

  @Test
  void leavesFutureDomainEndpointsUnimplemented() throws Exception {
    mvc.perform(get("/incidents"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.status").value(404));
    verifyNoInteractions(service);
  }
}
