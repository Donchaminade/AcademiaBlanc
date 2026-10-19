import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { Candidate, Subject, CandidateComputedStats, AppSettings } from '../types';
import { composerEnteteBulletin } from '../utils/bulletinEntete';
import { academicYearCaption, establishmentCaption, ministryMark } from '../utils/bulletinHeader';
import {
  camaradesDeClasse,
  extremesMatiereAffiches,
  formatMinMax,
  formatSubjectRank,
  rangMatiereAffiche,
} from '../utils/bulletinMetrics';
import { appreciationAffichee } from '../utils/appreciation';
import { coefDuCandidat } from '../utils/coefficients';
import { printDocument } from '../utils/printDocument';
import { subjectsFor } from '../utils/programme';
import { TITRE_TITULAIRE, aUnTitulaire, nomTitulaireAffiche } from '../utils/titulaire';
import { titreChefDepuisSettings } from '../utils/titreChef';
import { etablissementOrigineAffiche, groupeDeClassement } from '../utils/sessionMode';
import { BulletinFooter } from './BulletinFooter';
import { BulletinSignatureZone } from './BulletinSignatureZone';
import { LigneCentreExamen, SignaturesInter } from './BulletinInterBlocs';

interface BulletinViewProps {
  candidates: Candidate[];
  selectedCandidate: Candidate;
  onSelectCandidate: (candidate: Candidate) => void;
  subjects: Subject[];
  computedStats: CandidateComputedStats;
  onOpenSignature: () => void;
  onOpenSms: () => void;
  onDownloadPdf: () => void;
  onPrintAll?: () => void;
  /** Faux sans le droit BULLETINS:IMPRIMER : les boutons d’impression et de téléchargement sont masqués. */
  canPrint?: boolean;
  settings: AppSettings;
  selectedSession?: string;
  /** Libellé long du type d'examen de la session active (référentiel de la plateforme) ; absent en démonstration. */
  examTypeLong?: string;
  /**
   * Session inter-établissements : relevé sans logo, cachet ni pied de page de l'établissement, ligne
   * « Centre d'examen », signatures du président du jury et du chef du centre, rang par niveau / série.
   */
  sessionInter?: boolean;
  /** Nom du centre d'examen (établissement hôte) en session inter-établissements. */
  centreExamen?: string;
  /**
   * Session issue d'un transfert : nom du centre d'examen émetteur. Le relevé garde la charte de
   * l'établissement, mais le rang et les extrêmes sont ceux de l'examen commun (bandeau à l'écran).
   */
  transfertCentre?: string;
}

/** Largeur minimale de la feuille A4 virtuelle à l'écran (`min-w-[800px]`). */
const FEUILLE_LARGEUR_PX = 800;

export const BulletinView: React.FC<BulletinViewProps> = ({
  candidates,
  selectedCandidate,
  onSelectCandidate,
  subjects,
  computedStats,
  onOpenSignature,
  onOpenSms,
  onDownloadPdf,
  onPrintAll,
  canPrint = true,
  settings,
  selectedSession,
  examTypeLong,
  sessionInter = false,
  centreExamen = '',
  transfertCentre = '',
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  // Session issue d'un transfert : rang, effectif et extrêmes figés de l'examen commun du centre.
  const examenCommun = Boolean(selectedCandidate.examenCommun);
  // Écrans étroits : la feuille (800 px) est réduite pour tenir dans la largeur disponible ; sa hauteur
  // réelle est mesurée pour que le conteneur n'occupe que la place de la feuille réduite.
  const canvasRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [ajustement, setAjustement] = useState<{ scale: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const sheet = sheetRef.current;
    if (!canvas || !sheet || typeof ResizeObserver === 'undefined') return undefined;
    const mesurer = () => {
      const disponible = canvas.clientWidth - 2 * 16; // px-4
      const largeurFeuille = FEUILLE_LARGEUR_PX;
      if (disponible >= largeurFeuille) {
        setAjustement(null);
        return;
      }
      const scale = Math.max(0.3, disponible / largeurFeuille);
      setAjustement({ scale, height: sheet.offsetHeight * scale });
    };
    const observer = new ResizeObserver(mesurer);
    observer.observe(canvas);
    observer.observe(sheet);
    mesurer();
    return () => observer.disconnect();
  }, []);
  const ministryMarkLabel = ministryMark(settings);
  const regionalAuthority = (settings.regionalAuthority || '').trim();
  const sealCaption = establishmentCaption(settings.institutionName);
  const yearCaption = academicYearCaption(settings.academicYear);
  // Inter-établissements : aucun sceau ni filigrane de l'établissement hôte sur le relevé.
  const afficherSceau = !sessionInter && Boolean(settings.sealUrl && settings.sealUrl.trim() !== '');
  const porteeLibelle = examenCommun ? 'à l’examen commun' : sessionInter ? 'du groupe' : 'de la classe';
  // Chef d'établissement : « Le Directeur » pour une classe de collège, « Le Proviseur » au lycée, sauf titre saisi dans le profil.
  const titreChef = titreChefDepuisSettings(settings, [selectedCandidate]);

  // Bandeau : type d'examen et intitulé de la session, puis série (lycée) ou niveau (collège) et année scolaire.
  const entete = useMemo(() => composerEnteteBulletin({
    typeExamenLibelle: examTypeLong ?? settings.examType,
    sessionNom: selectedSession || settings.sessionName,
    anneeScolaire: settings.academicYear,
    niveau: selectedCandidate.niveau,
    classeNom: selectedCandidate.classeNom,
    serieCode: selectedCandidate.serie,
    serieLibelle: selectedCandidate.serieLibelle,
  }), [examTypeLong, settings.examType, selectedSession, settings.sessionName, settings.academicYear, selectedCandidate]);

  const currentIndex = candidates.findIndex((c) => c.id === selectedCandidate.id);
  // Base des notes min / max par matière : la classe (même session) ; en inter-établissements, le groupe
  // niveau / série de toute la session (toutes classes du centre confondues).
  const camarades = useMemo(
    () => (sessionInter ? groupeDeClassement(selectedCandidate, candidates, true) : camaradesDeClasse(selectedCandidate, candidates)),
    [selectedCandidate, candidates, sessionInter],
  );
  // Rang par matière : toute la session en interne (inchangé), le groupe niveau / série en inter.
  const cohorteRangMatiere = sessionInter ? camarades : candidates;
  const fmtMoyenne = (value: number | null) => (value == null ? '—' : value.toFixed(2));

  const handlePrev = () => {
    if (currentIndex > 0) {
      onSelectCandidate(candidates[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < candidates.length - 1) {
      onSelectCandidate(candidates[currentIndex + 1]);
    }
  };

  const handlePrint = () => {
    printDocument(
      'single-bulletin',
      `Bulletin_${selectedCandidate.tableNumber}_${selectedCandidate.fullName}`,
    );
  };

  return (
    <div className="flex flex-col w-full">
      {/* Command Toolbar / PDF Preview Header */}
      <div className="w-full bg-white px-3 py-2.5 md:px-6 md:py-3.5 shadow-sm sticky top-14 lg:top-16 z-30 flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between gap-2.5 md:gap-4 border-b border-[#eaedff] no-print">
        {/* Student Selector & Pagination */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="inline-flex items-center bg-[#f2f3ff] rounded p-0.5 border border-[#eaedff] shrink-0">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              aria-label="Candidat précédent"
              className="p-2 md:p-1.5 rounded hover:bg-white text-[#444651] hover:text-[#131b2e] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Candidat précédent (Touche Gauche)"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
            </button>
            <span className="font-mono text-[11px] px-2 text-[#00236f] font-semibold whitespace-nowrap">
              {selectedCandidate.tableNumber} / {computedStats.totalCandidates}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex >= candidates.length - 1}
              aria-label="Candidat suivant"
              className="p-2 md:p-1.5 rounded hover:bg-white text-[#444651] hover:text-[#131b2e] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Candidat suivant (Touche Droite)"
            >
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>

          <div className="relative flex-1 min-w-0 md:flex-none md:min-w-[290px]">
            <select
              value={selectedCandidate.id}
              onChange={(e) => {
                const target = candidates.find((c) => c.id === e.target.value);
                if (target) onSelectCandidate(target);
              }}
              className="w-full appearance-none bg-[#f2f3ff] text-[#131b2e] text-[12px] py-2 px-3 pr-8 rounded outline-none cursor-pointer focus:bg-white focus:shadow-xs transition-all font-medium border border-[#eaedff]"
            >
              {candidates.map((cand) => (
                <option key={cand.id} value={cand.id}>
                  {cand.tableNumber} - {cand.fullName}{cand.serie ? ` (${cand.serie.replace(/.* - /, '')})` : ''}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-[#444651] text-base">
              unfold_more
            </span>
          </div>

          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#eaedff] text-[#0051d5] text-[11px] font-semibold">
            <span className="material-symbols-outlined text-sm">verified</span>
            <span>Relevé Certifié ISO 216</span>
          </span>
        </div>

        {/* Action Buttons & Zoom — sur mobile : rangée défilante horizontalement, boutons ≥ 40 px */}
        <div className="toolbar-actions flex items-center gap-2 overflow-x-auto md:overflow-visible md:flex-wrap -mx-3 px-3 md:mx-0 md:px-0 pb-0.5 [scrollbar-width:none] [&>*]:shrink-0">
          {/* Zoom controls */}
          <div className="hidden lg:flex items-center bg-[#f2f3ff] rounded p-1 gap-1 text-[#444651] font-mono text-[11px] border border-[#eaedff]">
            <button
              type="button"
              onClick={() => setZoomLevel(0.85)}
              className={`px-2 py-1 rounded transition-colors ${
                zoomLevel === 0.85 ? 'bg-white text-[#00236f] font-bold shadow-xs' : 'hover:bg-white'
              }`}
              title="Réduire zoom (85%)"
            >
              85%
            </button>
            <span className="text-[#c5c5d3]">/</span>
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className={`px-2 py-1 rounded transition-colors ${
                zoomLevel === 1 ? 'bg-white text-[#00236f] font-bold shadow-xs' : 'hover:bg-white'
              }`}
              title="Taille réelle (100%)"
            >
              100%
            </button>
            <span className="text-[#c5c5d3]">/</span>
            <button
              type="button"
              onClick={() => setZoomLevel(1.15)}
              className={`px-2 py-1 rounded transition-colors ${
                zoomLevel === 1.15 ? 'bg-white text-[#00236f] font-bold shadow-xs' : 'hover:bg-white'
              }`}
              title="Agrandir zoom (115%)"
            >
              115%
            </button>
          </div>

          {/* Imprimer le bulletin actuel */}
          {canPrint && (
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#eaedff] hover:bg-[#dce1ff] text-[#131b2e] text-[12px] transition-colors shadow-xs font-medium"
              title="Imprimer ce bulletin individuel"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Ce bulletin</span>
            </button>
          )}

          {/* Imprimer TOUS les bulletins en 1 clic */}
          {canPrint && onPrintAll && (
            <button
              type="button"
              onClick={onPrintAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#0051d5] hover:bg-[#003cb3] text-white text-[12px] transition-all shadow-md active:scale-95 font-bold"
              title="Ouvrir l'aperçu puis télécharger tous les bulletins en PDF"
            >
              <span className="material-symbols-outlined text-base">print_connect</span>
              <span>Télécharger tous les bulletins ({candidates.length})</span>
            </button>
          )}

          {/* Signer numériquement */}
          <button
            type="button"
            onClick={onOpenSignature}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#eaedff] hover:bg-[#dce1ff] text-[#131b2e] text-[12px] transition-colors shadow-xs font-medium"
          >
            <span className="material-symbols-outlined text-base text-[#0051d5]">draw</span>
            <span>Signer numériquement</span>
          </button>

          {/* SMS / Mail */}
          <button
            type="button"
            onClick={onOpenSms}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#eaedff] hover:bg-[#dce1ff] text-[#131b2e] text-[12px] transition-colors shadow-xs font-medium"
          >
            <span className="material-symbols-outlined text-base">send_to_mobile</span>
            <span>SMS • Mail Parents</span>
          </button>

          {/* Download PDF */}
          {canPrint && (
            <button
              type="button"
              onClick={onDownloadPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#00236f] text-white text-[12px] hover:bg-[#1e3a8a] transition-all shadow-md active:scale-95 font-semibold"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span>Télécharger PDF A4</span>
            </button>
          )}
        </div>
      </div>

      {transfertCentre && (
        <div
          className="no-print bg-[#fff3e0] border-b border-[#ffcc80] px-4 py-2 text-[12px] text-[#8a4b00] flex items-center gap-2"
          role="status"
          data-testid="bandeau-session-transfert"
        >
          <span className="material-symbols-outlined text-base">move_to_inbox</span>
          <span>
            <strong>Session issue d’un transfert — centre : {transfertCentre}.</strong>{' '}
            Le rang, l’effectif et les extrêmes sont ceux de l’examen commun ; les notes ne se modifient pas ici.
          </span>
        </div>
      )}

      {/* Sheet Canvas Wrapper (A4 Center View) */}
      <div
        ref={canvasRef}
        className="bulletin-canvas w-full bg-[#d2d9f4] py-4 md:py-8 px-4 flex justify-center items-start overflow-x-auto min-h-[calc(100dvh-8rem)]"
      >
        {/* Virtual ISO 216 / A4 Canvas: 210mm x 297mm.
            Écran étroit : feuille réduite (transform) dans un conteneur à la taille de la feuille réduite ;
            à l'impression le conteneur reprend `auto` et la feuille sa taille réelle (transform: none). */}
        <div
          className="bulletin-scale-wrap"
          style={ajustement ? { width: FEUILLE_LARGEUR_PX * ajustement.scale, height: ajustement.height } : undefined}
        >
        <div
          id="bulletinSheet"
          ref={sheetRef}
          style={ajustement
            ? { transform: `scale(${ajustement.scale})`, transformOrigin: 'top left', width: FEUILLE_LARGEUR_PX }
            : { transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
          className="bulletin-sheet w-full max-w-[860px] min-w-[800px] bg-white text-[#131b2e] rounded-xs shadow-xl p-8 sm:p-10 relative transition-transform duration-200 border border-[#eaedff]"
        >
          {/* Watermark Background Emblem (only if seal uploaded; never in inter-établissements) */}
          {afficherSceau && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none overflow-hidden">
              <img
                alt="Armoiries Officielles"
                className="w-[480px] h-[480px] object-contain"
                src={settings.sealUrl}
              />
            </div>
          )}

          {/* Ministère + sigle à gauche, république + devise à droite */}
          <div className="bulletin-header relative z-10">
            <div className="bulletin-header-left">
              <p className="bulletin-ministry-name">{settings.ministryName}</p>
              {ministryMarkLabel ? <p className="bulletin-ministry-sigle">{ministryMarkLabel}</p> : null}
              {regionalAuthority ? <p className="bulletin-ministry-sigle">{regionalAuthority}</p> : null}
            </div>

            {/* Central Academic Seal — remplacé par la ligne « Centre d'examen » en inter-établissements */}
            {sessionInter ? <div className="bulletin-seal" aria-hidden="true" /> : (
            <div className="bulletin-seal">
              {afficherSceau ? (
                <div className="bulletin-seal-mark w-20 h-20 rounded-full bg-[#f2f3ff] flex items-center justify-center p-1.5 shadow-sm border border-[#eaedff] overflow-hidden">
                  <img
                    alt="Sceau Académique Officiel"
                    className="w-full h-full object-contain"
                    src={settings.sealUrl}
                  />
                </div>
              ) : (
                /* Zone laissée vide pour tampon physique manuel à l'encre */
                <div className="bulletin-seal-mark w-20 h-20 rounded-full border border-dashed border-[#b0b7cb] print:border-[#cbd5e1] flex flex-col items-center justify-center p-1 bg-transparent text-center">
                  <span className="text-[9px] text-[#6b7280] uppercase font-semibold leading-tight print:hidden">
                    Emplacement Sceau
                  </span>
                  <span className="text-[8px] text-[#9ca3af] leading-tight print:hidden">
                    (Cachet manuel)
                  </span>
                </div>
              )}
              <span className="bulletin-seal-caption">{sealCaption}</span>
            </div>
            )}

            <div className="bulletin-header-right">
              <p className="bulletin-republic-name">{settings.countryName}</p>
              <p className="bulletin-republic-motto">{settings.motto}</p>
            </div>
          </div>

          {sessionInter && <LigneCentreExamen centreExamen={centreExamen} />}

          {/* Bande de l'année académique */}
          <div className="bulletin-ribbon relative z-10 py-1.5 px-3 bg-[#eaedff] rounded border border-[#dce1ff]">
            <span className="bulletin-ribbon-year">{yearCaption}</span>
          </div>

          {/* Bandeau : type d'examen et intitulé de la session (base), série ou niveau de la classe, année scolaire */}
          <div className="bulletin-title relative z-10 mb-4 bg-[#00236f] text-white py-2.5 px-4 text-center rounded-xs shadow-xs">
            <h1 className="text-[15px] font-bold uppercase tracking-wide line-clamp-2" title={entete.ligne1}>
              {entete.ligne1}
            </h1>
            {entete.ligne2 && (
              <p className="text-[11px] text-[#90a8ff] tracking-wider font-semibold mt-0.5 truncate" title={entete.ligne2}>
                {entete.ligne2}
              </p>
            )}
          </div>

          {/* Candidate Identity Card */}
          <div className="bulletin-identity relative z-10 bg-[#f2f3ff] rounded-xs p-4 mb-4 border border-[#eaedff]">
            <div className="bulletin-identity-grid text-left">
              <div className="bulletin-identity-name pb-1.5 border-b border-[#eaedff]">
                <span className="bulletin-field-label text-[10px] text-[#444651] uppercase font-bold tracking-wider">
                  Nom et Prénoms du Candidat
                </span>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="font-mono text-[12px] font-bold text-[#0051d5] bg-white px-2.5 py-0.5 rounded border border-[#eaedff] whitespace-nowrap">
                    TABLE {selectedCandidate.tableNumber}
                  </span>
                  <span className="text-[17px] text-[#00236f] font-bold tracking-tight">
                    {selectedCandidate.fullName}
                  </span>
                </div>
              </div>

              <span className="bulletin-field-label text-[10px] text-[#444651] uppercase font-bold tracking-wider">
                Matricule National
              </span>
              <span className="bulletin-field-label text-[10px] text-[#444651] uppercase font-bold tracking-wider">
                Date &amp; Lieu de Naissance
              </span>
              <span className="bulletin-field-label text-[10px] text-[#444651] uppercase font-bold tracking-wider">
                Genre / Série
              </span>

              <span className="bulletin-field-value font-mono text-[13px] font-bold text-[#131b2e]">
                {selectedCandidate.matricule}
              </span>
              <span className="bulletin-field-value text-[13px] text-[#131b2e] font-medium">
                {selectedCandidate.dob} à {selectedCandidate.birthPlace}
              </span>
              <span className="bulletin-field-value bulletin-field-genre text-[13px] text-[#131b2e] font-medium">
                {selectedCandidate.gender === 'M' ? 'Masculin (M)' : 'Féminin (F)'}{selectedCandidate.serie ? ` • ${selectedCandidate.serie}` : ''}
              </span>

              <span className="bulletin-field-label bulletin-field-school text-[10px] text-[#444651] uppercase font-bold tracking-wider">
                Établissement d'Origine
              </span>
              <span className="bulletin-field-label bulletin-field-center text-[10px] text-[#444651] uppercase font-bold tracking-wider">
                Centre d'Examen
              </span>

              <span className="bulletin-field-value bulletin-field-school text-[13px] text-[#131b2e] font-medium" data-testid="bulletin-origine">
                {sessionInter ? etablissementOrigineAffiche(selectedCandidate, centreExamen) : selectedCandidate.originSchool}
              </span>
              <span className="bulletin-field-value bulletin-field-center text-[13px] text-[#00236f] font-semibold">
                {selectedCandidate.examCenterName}
              </span>
            </div>
          </div>

          {/* Official Dense Score Table */}
          <div className="bulletin-table-wrap relative z-10 overflow-hidden rounded-xs bg-white shadow-xs mb-4 border border-[#eaedff]">
            <table className="bulletin-grades w-full text-left border-collapse">
              <colgroup>
                <col className="col-subject" />
                <col className="col-teacher" />
                <col className="col-note" />
                <col className="col-coef" />
                <col className="col-total" />
                <col className="col-rank" />
                <col className="col-minmax" />
                <col className="col-appreciation" />
              </colgroup>
              <thead>
                <tr className="bg-[#00236f] text-white text-[12px]">
                  <th className="py-2 px-3 font-semibold text-left">Matières &amp; Disciplines</th>
                  <th className="py-2 px-2 font-semibold text-left">Enseignant Exam.</th>
                  <th className="py-2 px-2 font-semibold text-right">Note /20</th>
                  <th className="py-2 px-2 font-semibold text-center">Coef</th>
                  <th className="py-2 px-2 font-semibold text-right">Total Coef</th>
                  <th className="py-2 px-2 font-semibold text-center">Rang</th>
                  <th className="py-2 px-2 font-semibold text-center">{examenCommun ? 'Min / Max examen' : sessionInter ? 'Min / Max groupe' : 'Min / Max classe'}</th>
                  <th className="py-2 px-3 font-semibold text-left">Appréciation du professeur</th>
                </tr>
              </thead>
              <tbody className="divide-y-0 text-[#131b2e]">
                {subjectsFor(selectedCandidate, subjects).map((subj, idx) => {
                  const gradeData = selectedCandidate.grades[subj.id];
                  const coef = coefDuCandidat(selectedCandidate, subj);
                  const scoreTotal = gradeData ? (gradeData.score * coef).toFixed(2) : '—';
                  const isEven = idx % 2 === 0;
                  const subjectRankValue = rangMatiereAffiche(selectedCandidate, subj.id, cohorteRangMatiere);
                  const subjectRank = subjectRankValue === null ? '—' : formatSubjectRank(subjectRankValue);
                  const minMaxClasse = formatMinMax(extremesMatiereAffiches(selectedCandidate, subj.id, camarades));
                  const professorAppreciation = appreciationAffichee(gradeData);

                  return (
                    <tr
                      key={subj.id}
                      className={`${isEven ? 'bg-white' : 'bg-[#f2f3ff]/60'} hover:bg-[#eaedff]/50 transition-colors border-b border-[#eaedff]/70`}
                    >
                      <td className="py-1.5 px-3 text-[13px] font-semibold text-[#00236f]">
                        {subj.name}
                      </td>
                      <td className="py-1.5 px-2 text-[12px] text-[#444651]">
                        {subj.teacher}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[13px] text-right font-bold text-[#00236f]">
                        {gradeData ? gradeData.score.toFixed(2) : '—'}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[13px] text-center font-bold">
                        {coef}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[13px] text-right font-bold text-[#131b2e]">
                        {scoreTotal}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[11px] text-center font-semibold text-[#0051d5]">
                        {subjectRank}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[11px] text-center text-[#444651] whitespace-nowrap">
                        {minMaxClasse}
                      </td>
                      <td className="py-1.5 px-3 text-[12px] italic text-[#131b2e] leading-tight">
                        {professorAppreciation}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals Footer */}
              <tfoot>
                <tr className="bg-[#eaedff] font-semibold text-[#00236f] border-t-2 border-[#00236f]">
                  <td className="py-2.5 px-3 text-[13px] uppercase tracking-wide" colSpan={2}>
                    TOTAL DES PONDÉRATIONS
                  </td>
                  <td className="py-2.5 px-2 text-right text-[12px] text-[#444651] italic">
                    Total :
                  </td>
                  <td className="py-2.5 px-2 font-mono text-[15px] text-center font-bold text-[#00236f]">
                    {computedStats.totalCoef}
                  </td>
                  <td className="py-2.5 px-0 font-mono text-[15px] font-bold text-[#0051d5]" colSpan={4}>
                    <span className="bulletin-weighted-total">
                      {computedStats.totalPoints.toFixed(2)}
                    </span>
                    <span className="bulletin-weighted-max text-[11px] font-semibold text-[#444651]">
                      sur {computedStats.pointsMax.toFixed(2)} pts (20 × {computedStats.totalCoefProgramme})
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deliberation Decision & Statistical Synthesis (Bento Grid) */}
          <div className="bulletin-summary relative z-10">
            {/* Main Decision Card */}
            <div className="bulletin-decision bg-[#f2f3ff] rounded-xs p-2 flex flex-col justify-between shadow-xs border border-[#eaedff]">
              <div className="bulletin-decision-head flex items-center justify-between pb-1">
                <div>
                  <span className="text-[11px] text-[#444651] uppercase font-semibold block">
                    Décision Officielle du Conseil de Délibération
                  </span>
                  <span
                    className={`text-[15px] font-bold flex items-center gap-1.5 mt-0.5 ${
                      computedStats.decision === 'ADMIS'
                        ? 'text-emerald-700'
                        : computedStats.decision === 'AJOURNÉ'
                        ? 'text-[#ba1a1a]'
                        : 'text-[#444651]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      {computedStats.decision === 'ADMIS' ? 'check_circle' : computedStats.decision === 'AJOURNÉ' ? 'cancel' : 'pending'}
                    </span>
                    {computedStats.decision ?? 'Non classé — aucune note saisie'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#444651] uppercase font-semibold block">
                    Mention Obtenue
                  </span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-white text-[13px] font-bold tracking-wider shadow-xs ${
                      computedStats.mention === 'AJOURNÉ' ? 'bg-[#ba1a1a]' : computedStats.mention ? 'bg-[#0051d5]' : 'bg-[#444651]'
                    }`}
                  >
                    {computedStats.mention ?? '—'}
                  </span>
                </div>
              </div>

              <div className="bulletin-observation bg-white px-2.5 py-1.5 rounded-xs mt-1 border border-[#eaedff]">
                <span className="text-[11px] text-[#444651] uppercase font-semibold block">
                  Observation Générale du Conseil d'Établissement
                </span>
                <p className="text-[13px] text-[#131b2e] font-medium italic mt-0.5 leading-snug">
                  {selectedCandidate.generalObservation}
                </p>
              </div>
            </div>

            {/* Metrics Summary Mini Cards */}
            <div className="bulletin-metrics">
              <div className="bulletin-metric bg-white rounded-xs px-2 py-1.5 text-center shadow-xs flex flex-col justify-center border border-[#eaedff]">
                <span className="text-[11px] text-[#444651] uppercase font-semibold">
                  Moyenne Générale
                </span>
                <span className="font-sans text-[22px] text-[#00236f] font-bold my-0 leading-none">
                  {computedStats.average.toFixed(2)}
                </span>
                <span className="font-mono text-[11px] text-[#444651] whitespace-nowrap">
                  / 20 • {examenCommun ? 'examen' : sessionInter ? 'groupe' : 'classe'} {fmtMoyenne(computedStats.classAverage)}
                </span>
              </div>

              <div className="bulletin-metric bg-white rounded-xs px-2 py-1.5 text-center shadow-xs flex flex-col justify-center border border-[#eaedff]" data-testid="bulletin-rang">
                <span className="text-[11px] text-[#444651] uppercase font-semibold">
                  {examenCommun ? 'Rang à l’examen commun' : 'Rang de Promotion'}
                </span>
                <span className="font-sans text-[22px] text-[#0051d5] font-bold my-0 leading-none">
                  {computedStats.rank === 1 ? (
                    <span className="text-amber-600">1<span className="text-[13px]">er</span></span>
                  ) : (
                    <>
                      {computedStats.rank < 10 ? `0${computedStats.rank}` : computedStats.rank}
                      <span className="text-[12px]">e</span>
                    </>
                  )}
                </span>
                <span className="font-mono text-[11px] text-[#444651]">
                  sur {computedStats.totalCandidates} candidats
                </span>
              </div>

              <div className="bulletin-metric bg-white rounded-xs px-2 py-1.5 text-center shadow-xs flex flex-col justify-center border border-[#eaedff]">
                <span className="text-[11px] text-[#444651] uppercase font-semibold">
                  Moyenne la plus forte
                </span>
                <span className="font-sans text-[18px] text-[#00236f] font-bold my-0 leading-none">
                  {fmtMoyenne(computedStats.classHighestAverage)}
                </span>
                <span className="font-mono text-[11px] text-[#444651]">{porteeLibelle}</span>
              </div>

              <div className="bulletin-metric bg-white rounded-xs px-2 py-1.5 text-center shadow-xs flex flex-col justify-center border border-[#eaedff]">
                <span className="text-[11px] text-[#444651] uppercase font-semibold">
                  Moyenne la plus faible
                </span>
                <span className="font-sans text-[18px] text-[#ba1a1a] font-bold my-0 leading-none">
                  {fmtMoyenne(computedStats.classLowestAverage)}
                </span>
                <span className="font-mono text-[11px] text-[#444651]">{porteeLibelle}</span>
              </div>
            </div>
          </div>

          {/* Signatures : président du jury et chef du centre en inter-établissements ; titulaire et chef d'établissement sinon */}
          {sessionInter ? <SignaturesInter chefCentre={settings.jurySignerName} /> : (
          <div className="bulletin-signatures relative z-10 pt-1 grid grid-cols-2 gap-2 max-w-2xl mx-auto text-center">
            {/* Signature 1: Le Titulaire — l'enseignant affecté à la classe de l'élève, sinon ligne à compléter */}
            <div className="bulletin-signature-card flex flex-col items-center justify-between min-h-[52px] bg-[#f2f3ff]/50 px-2 py-1 rounded-xs border border-[#eaedff]">
              <div>
                <span className="text-[11px] text-[#444651] uppercase tracking-wider font-bold block leading-tight">
                  {TITRE_TITULAIRE}
                </span>
                <span
                  className={`text-[13px] font-semibold mt-0.5 block leading-tight ${aUnTitulaire(selectedCandidate) ? 'text-[#131b2e]' : 'text-[#757682]'}`}
                  data-testid="bulletin-titulaire"
                  title={aUnTitulaire(selectedCandidate) ? 'Titulaire de la classe (Administration › Classes)' : 'Aucun titulaire affecté à la classe : nom à compléter à la main'}
                >
                  {nomTitulaireAffiche(selectedCandidate)}
                </span>
              </div>

              {/* Signature téléversée ou espace laissé vide pour la signature à la main */}
              <BulletinSignatureZone
                signatureUrl={settings.signatureTitulaireUrl}
                signatureAlt={`Signature — ${TITRE_TITULAIRE}`}
                className="h-12"
              />
              <span className="text-[10px] text-[#444651] italic leading-tight">
                Visa du titulaire
              </span>
            </div>

            {/* Signature 2 : le chef d'établissement — Le Directeur (collège) / Le Proviseur (lycée), ou le titre saisi dans le profil */}
            <div className="bulletin-signature-card flex flex-col items-center justify-between min-h-[52px] bg-[#f2f3ff]/50 px-2 py-1 rounded-xs relative border border-[#eaedff]">
              <div>
                <span className="text-[11px] text-[#444651] uppercase tracking-wider font-bold block leading-tight" data-testid="bulletin-titre-chef">
                  {titreChef}
                </span>
                <span className="text-[13px] text-[#00236f] font-bold mt-0.5 block leading-tight">
                  {selectedCandidate.digitalSignature?.signer || settings.jurySignerName}
                </span>
              </div>

              {/* Cachet et signature téléversés ; sinon espace laissé vide pour le cachet humide */}
              <BulletinSignatureZone
                stampUrl={settings.sceauUrl}
                signatureUrl={settings.signatureProviseurUrl}
                stampAlt={`Cachet — ${settings.institutionName}`}
                signatureAlt={`Signature — ${titreChef}`}
                className="h-12"
              />
              <span className="text-[10px] text-[#444651] italic leading-tight">
                Sceau officiel de l'établissement
              </span>
            </div>
          </div>
          )}

          {/* Visa des parents : avis et observations laissés à la main quand l'élève rapporte le relevé */}
          <div className="bulletin-visa-parents relative z-10 max-w-2xl mx-auto mt-2 bg-[#f2f3ff]/50 px-3 py-2 rounded-xs border border-[#eaedff]">
            <div className="bulletin-visa-head flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-[#444651] uppercase tracking-wider font-bold leading-tight">
                Visa des parents / tuteur
              </span>
              <span className="text-[10px] text-[#444651] italic leading-tight">
                Avis et observations
              </span>
            </div>
            <div className="bulletin-visa-lines mt-1" aria-hidden="true">
              <div className="bulletin-visa-line" />
              <div className="bulletin-visa-line" />
              <div className="bulletin-visa-line" />
            </div>
            <div className="bulletin-visa-fields grid grid-cols-3 gap-3 mt-1.5 text-[10px] text-[#444651]">
              <span className="bulletin-visa-field">Nom et prénom :</span>
              <span className="bulletin-visa-field">Date :</span>
              <span className="bulletin-visa-field">Signature :</span>
            </div>
          </div>

          {/* Dernier élément de la page : filet doré puis « NOM DE L'ÉTABLISSEMENT • Devise » (jamais en inter-établissements) */}
          {!sessionInter && <BulletinFooter institutionName={settings.institutionName} institutionMotto={settings.institutionMotto} />}
        </div>
        </div>
      </div>
    </div>
  );
};
