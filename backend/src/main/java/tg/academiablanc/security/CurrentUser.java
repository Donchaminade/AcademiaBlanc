package tg.academiablanc.security;

import tg.academiablanc.domain.Role;

public record CurrentUser(Long userId, Long etablissementId, String email, Role role) {}
