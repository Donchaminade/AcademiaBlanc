package tg.academiablanc.api;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/** Corps JSON uniforme pour les erreurs métier : {@code { "status": 403, "message": "Action non autorisée : …" }}. */
@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, Object>> statut(ResponseStatusException ex) {
    String message = ex.getReason() == null ? "Erreur." : ex.getReason();
    return ResponseEntity.status(ex.getStatusCode())
        .body(Map.of("status", ex.getStatusCode().value(), "message", message));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException ex) {
    String message = ex.getBindingResult().getFieldErrors().stream()
        .map(err -> err.getField() + " : " + err.getDefaultMessage())
        .sorted()
        .findFirst()
        .orElse("Données invalides.");
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(Map.of("status", 400, "message", message));
  }
}
