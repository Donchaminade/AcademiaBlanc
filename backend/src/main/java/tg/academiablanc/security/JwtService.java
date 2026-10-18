package tg.academiablanc.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tg.academiablanc.domain.Role;
import tg.academiablanc.domain.Utilisateur;

@Service
public class JwtService {
  private final SecretKey key;
  private final long expirationHours;

  public JwtService(
      @Value("${app.jwt.secret}") String secret,
      @Value("${app.jwt.expiration-hours:12}") long expirationHours
  ) {
    if (secret == null || secret.length() < 32) {
      throw new IllegalStateException("JWT_SECRET doit contenir au moins 32 caractères.");
    }
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.expirationHours = expirationHours;
  }

  public String create(Utilisateur user) {
    Instant now = Instant.now();
    return Jwts.builder()
        .subject(user.getEmail())
        .claim("uid", user.getId())
        .claim("eid", user.getEtablissementId())
        .claim("role", user.getRole().name())
        .issuedAt(Date.from(now))
        .expiration(Date.from(now.plusSeconds(expirationHours * 3600)))
        .signWith(key)
        .compact();
  }

  public CurrentUser parse(String token) {
    Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    return new CurrentUser(
        claims.get("uid", Number.class).longValue(),
        claims.get("eid", Number.class).longValue(),
        claims.getSubject(),
        Role.valueOf(claims.get("role", String.class))
    );
  }
}
