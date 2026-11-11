package dev.interfere.api;

public record SkeletonStatus(
    String project,
    int phase,
    String fixtureId,
    String database,
    boolean telemetryEnabled,
    boolean patchAutomationEnabled) {}
