package dev.interfere.api;

import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class SkeletonService {
  private final JdbcTemplate jdbc;

  public SkeletonService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public SkeletonStatus check(String fixtureId) {
    String storedId =
        jdbc.queryForObject(
            "SELECT fixture_id FROM skeleton_fixtures WHERE fixture_id = ?",
            String.class,
            fixtureId);
    if (!fixtureId.equals(storedId)) {
      throw new DataRetrievalFailureException("Expected synthetic fixture is unavailable");
    }
    return new SkeletonStatus("Interfere", 1, storedId, "ready", false, false);
  }
}
