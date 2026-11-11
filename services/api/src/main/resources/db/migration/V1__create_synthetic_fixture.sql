CREATE TABLE skeleton_fixtures (
    fixture_id VARCHAR(64) PRIMARY KEY,
    CONSTRAINT synthetic_fixture_only CHECK (fixture_id = 'synthetic-demo')
);

INSERT INTO skeleton_fixtures (fixture_id) VALUES ('synthetic-demo');
