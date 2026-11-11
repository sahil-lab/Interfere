package dev.interfere.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/skeleton")
public class SkeletonController {
  private final SkeletonService service;

  public SkeletonController(SkeletonService service) {
    this.service = service;
  }

  @GetMapping("/status")
  public SkeletonStatus status() {
    return service.check("synthetic-demo");
  }

  @PostMapping("/check")
  public SkeletonStatus check(@Valid @RequestBody CheckRequest request) {
    return service.check(request.fixtureId());
  }

  public record CheckRequest(
      @NotBlank @Size(max = 64) @Pattern(regexp = "synthetic-demo") String fixtureId) {}
}
