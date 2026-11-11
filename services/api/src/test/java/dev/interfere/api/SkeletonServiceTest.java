package dev.interfere.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

class SkeletonServiceTest {
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final SkeletonService service = new SkeletonService(jdbc);
  private static final String QUERY =
      "SELECT fixture_id FROM skeleton_fixtures WHERE fixture_id = ?";

  @Test
  void readsTheParameterizedFixtureAndKeepsCapabilitiesDisabled() {
    when(jdbc.queryForObject(QUERY, String.class, "synthetic-demo")).thenReturn("synthetic-demo");

    assertThat(service.check("synthetic-demo"))
        .isEqualTo(new SkeletonStatus("Interfere", 1, "synthetic-demo", "ready", false, false));
    verify(jdbc).queryForObject(QUERY, String.class, "synthetic-demo");
  }

  @Test
  void propagatesDatabaseFailureInsteadOfInventingSuccess() {
    when(jdbc.queryForObject(QUERY, String.class, "synthetic-demo"))
        .thenThrow(new DataAccessResourceFailureException("unavailable"));

    assertThatThrownBy(() -> service.check("synthetic-demo"))
        .isInstanceOf(DataAccessResourceFailureException.class);
  }

  @Test
  void rejectsUnexpectedDatabaseResults() {
    when(jdbc.queryForObject(QUERY, String.class, "synthetic-demo")).thenReturn(null);

    assertThatThrownBy(() -> service.check("synthetic-demo"))
        .isInstanceOf(DataRetrievalFailureException.class);
  }
}
