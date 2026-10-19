package tg.academiablanc.domain;

/** Cycle de vie d'un transfert d'examen blanc : envoyé par le centre, puis accepté, refusé ou annulé. */
public enum StatutTransfert {
  /** Envoyé par le centre, pas encore traité par le destinataire. */
  EN_ATTENTE,
  /** Accepté par le destinataire : une session interne a été créée chez lui. */
  ACCEPTE,
  /** Refusé par le destinataire (motif facultatif) ; le centre peut renvoyer. */
  REFUSE,
  /** Annulé par le centre avant tout traitement. */
  ANNULE
}
