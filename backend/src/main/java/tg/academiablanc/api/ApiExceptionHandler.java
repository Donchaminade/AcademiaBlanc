package tg.academiablanc.api;

import java.sql.SQLException;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Transforme toutes les erreurs de l'API en réponses JSON {@code { "message": "..." }} en français,
 * sans passer par le dispatch {@code /error} du conteneur de servlets.
 *
 * <p>Sans cette classe, une erreur levée par un contrôleur (404, 409, 400…) était re-dispatchée
 * vers {@code /error}, URL que Spring Security refusait (jeton non rejoué sur ce dispatch) : le
 * client recevait systématiquement un <strong>403 au corps vide</strong>, quelle que soit la cause réelle.
 */
@RestControllerAdvice
public class ApiExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  public static final String MESSAGE_NON_AUTORISE = "Action non autorisée";
  public static final String MESSAGE_AUTH_REQUISE = "Authentification requise.";
  public static final String MESSAGE_INTEGRITE = "Suppression impossible : des données y sont encore rattachées.";
  public static final String MESSAGE_DOUBLON = "Cette donnée existe déjà : un enregistrement identique est présent.";

  /** État SQL standard d'une violation de clé étrangère. */
  private static final String SQLSTATE_CLE_ETRANGERE = "23503";
  /** État SQL standard d'une violation de contrainte d'unicité. */
  private static final String SQLSTATE_UNICITE = "23505";

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, String>> statut(ResponseStatusException ex) {
    String message = ex.getReason() != null && !ex.getReason().isBlank() ? ex.getReason() : messageParDefaut(ex.getStatusCode());
    return corps(ex.getStatusCode(), message);
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<Map<String, String>> integrite(DataIntegrityViolationException ex) {
    String sqlState = sqlState(ex);
    String message = SQLSTATE_UNICITE.equals(sqlState) ? MESSAGE_DOUBLON : MESSAGE_INTEGRITE;
    return corps(HttpStatus.CONFLICT, message);
  }

  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<Map<String, String>> refuse(AccessDeniedException ex) {
    return corps(HttpStatus.FORBIDDEN, MESSAGE_NON_AUTORISE);
  }

  @ExceptionHandler(AuthenticationException.class)
  public ResponseEntity<Map<String, String>> nonAuthentifie(AuthenticationException ex) {
    return corps(HttpStatus.UNAUTHORIZED, MESSAGE_AUTH_REQUISE);
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<Map<String, String>> invalide(MethodArgumentNotValidException ex) {
    String details = ex.getBindingResult().getFieldErrors().stream()
        .map(err -> err.getField() + " : " + (err.getDefaultMessage() == null ? "valeur invalide" : err.getDefaultMessage()))
        .sorted()
        .collect(Collectors.joining(" ; "));
    return corps(HttpStatus.BAD_REQUEST, details.isEmpty() ? "Données invalides." : "Données invalides (" + details + ").");
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<Map<String, String>> illisible(HttpMessageNotReadableException ex) {
    return corps(HttpStatus.BAD_REQUEST, "Requête illisible : vérifiez le format des données envoyées.");
  }

  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<Map<String, String>> introuvable(NoResourceFoundException ex) {
    return corps(HttpStatus.NOT_FOUND, "Élément introuvable.");
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, String>> inattendue(Exception ex) {
    log.error("Erreur inattendue sur l'API", ex);
    return corps(HttpStatus.INTERNAL_SERVER_ERROR, "Erreur du serveur.");
  }

  static String messageParDefaut(HttpStatusCode statut) {
    if (statut.equals(HttpStatus.UNAUTHORIZED)) return MESSAGE_AUTH_REQUISE;
    if (statut.equals(HttpStatus.FORBIDDEN)) return MESSAGE_NON_AUTORISE;
    if (statut.equals(HttpStatus.NOT_FOUND)) return "Élément introuvable.";
    if (statut.equals(HttpStatus.CONFLICT)) return MESSAGE_INTEGRITE;
    if (statut.is4xxClientError()) return "Requête invalide.";
    return "Erreur du serveur.";
  }

  private static String sqlState(Throwable ex) {
    Throwable cause = ex;
    while (cause != null) {
      if (cause instanceof SQLException sql && sql.getSQLState() != null) return sql.getSQLState();
      if (cause.getCause() == cause) break;
      cause = cause.getCause();
    }
    return SQLSTATE_CLE_ETRANGERE;
  }

  private static ResponseEntity<Map<String, String>> corps(HttpStatusCode statut, String message) {
    return ResponseEntity.status(statut).contentType(MediaType.APPLICATION_JSON).body(Map.of("message", message));
  }
}
