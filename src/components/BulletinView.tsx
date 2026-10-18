import React, { useState, useMemo } from 'react';
import { Candidate, Subject, CandidateComputedStats, AppSettings } from '../types';
import { getBulletinHeaderInfo } from '../utils/bulletinHeader';
import { appreciationFromAverage, computeSubjectRank, formatSubjectRank } from '../utils/bulletinMetrics';
import { printDocument } from '../utils/printDocument';

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
  settings: AppSettings;
  selectedSession?: string;
}

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
  settings,
  selectedSession,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const headerInfo = useMemo(() => {
    return getBulletinHeaderInfo(
      selectedSession || settings.sessionName,
      selectedCandidate.serie
    );
  }, [selectedSession, settings.sessionName, selectedCandidate.serie]);

  const currentIndex = candidates.findIndex((c) => c.id === selectedCandidate.id);

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
      <div className="w-full bg-white px-6 py-3.5 shadow-sm sticky top-16 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-[#eaedff] no-print">
        {/* Student Selector & Pagination */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center bg-[#f2f3ff] rounded p-0.5 border border-[#eaedff]">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              className="p-1.5 rounded hover:bg-white text-[#444651] hover:text-[#131b2e] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Candidat précédent (Touche Gauche)"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
            </button>
            <span className="font-mono text-[11px] px-2 text-[#00236f] font-semibold">
              {selectedCandidate.tableNumber} / {computedStats.totalCandidates}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex >= candidates.length - 1}
              className="p-1.5 rounded hover:bg-white text-[#444651] hover:text-[#131b2e] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title="Candidat suivant (Touche Droite)"
            >
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>

          <div className="relative min-w-[290px]">
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
                  {cand.tableNumber} - {cand.fullName} ({cand.serie.replace(/.* - /, '')})
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-2.5 pointer-events-none text-[#444651] text-base">
              unfold_more
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#eaedff] text-[#0051d5] text-[11px] font-semibold">
            <span className="material-symbols-outlined text-sm">verified</span>
            <span>Relevé Certifié ISO 216</span>
          </span>
        </div>

        {/* Action Buttons & Zoom */}
        <div className="flex items-center gap-2 flex-wrap">
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
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#eaedff] hover:bg-[#dce1ff] text-[#131b2e] text-[12px] transition-colors shadow-xs font-medium"
            title="Imprimer ce bulletin individuel"
          >
            <span className="material-symbols-outlined text-base">print</span>
            <span>Ce bulletin</span>
          </button>

          {/* Imprimer TOUS les bulletins en 1 clic */}
          {onPrintAll && (
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
          <button
            type="button"
            onClick={onDownloadPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#00236f] text-white text-[12px] hover:bg-[#1e3a8a] transition-all shadow-md active:scale-95 font-semibold"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>Télécharger PDF A4</span>
          </button>
        </div>
      </div>

      {/* Sheet Canvas Wrapper (A4 Center View) */}
      <div className="w-full bg-[#d2d9f4] py-8 px-4 flex justify-center items-start overflow-x-auto min-h-[calc(100vh-8rem)]">
        {/* Virtual ISO 216 / A4 Canvas: 210mm x 297mm */}
        <div
          id="bulletinSheet"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
          className="bulletin-sheet w-full max-w-[860px] bg-white text-[#131b2e] rounded-xs shadow-xl p-8 sm:p-10 relative transition-transform duration-200 border border-[#eaedff]"
        >
          {/* Watermark Background Emblem (only if seal uploaded) */}
          {settings.sealUrl && settings.sealUrl.trim() !== '' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none overflow-hidden">
              <img
                alt="Armoiries Officielles"
                className="w-[480px] h-[480px] object-contain"
                src={settings.sealUrl}
              />
            </div>
          )}

          {/* Bilateral Official Header */}
          <div className="relative z-10 flex items-start justify-between gap-4 pb-4">
            {/* Republic / Left Banner */}
            <div className="flex-1 text-center sm:text-left space-y-0.5">
              <p className="text-[11px] uppercase tracking-widest text-[#00236f] font-bold">
                {settings.countryName}
              </p>
              <p className="text-[12px] italic text-[#444651] font-medium">
                {settings.motto}
              </p>
              <div className="w-12 h-0.5 bg-[#0051d5] my-1 sm:mx-0 mx-auto"></div>
              <p className="text-[14px] text-[#00236f] font-bold leading-tight uppercase">
                {settings.ministryName}
              </p>
            </div>

            {/* Central Academic Seal */}
            <div className="flex flex-col items-center justify-center px-2 shrink-0">
              {settings.sealUrl && settings.sealUrl.trim() !== '' ? (
                <div className="w-20 h-20 rounded-full bg-[#f2f3ff] flex items-center justify-center p-1.5 shadow-sm border border-[#eaedff] overflow-hidden">
                  <img
                    alt="Sceau Académique Officiel"
                    className="w-full h-full object-contain"
                    src={settings.sealUrl}
                  />
                </div>
              ) : (
                /* Zone laissée vide pour tampon physique manuel à l'encre */
                <div className="w-20 h-20 rounded-full border border-dashed border-[#b0b7cb] print:border-[#cbd5e1] flex flex-col items-center justify-center p-1 bg-transparent text-center">
                  <span className="text-[9px] text-[#6b7280] uppercase font-semibold leading-tight print:hidden">
                    Emplacement Sceau
                  </span>
                  <span className="text-[8px] text-[#9ca3af] leading-tight print:hidden">
                    (Cachet manuel)
                  </span>
                </div>
              )}
              <span className="font-mono text-[10px] text-[#444651] mt-1 tracking-wider uppercase font-semibold">
                SCEAU DU JURY
              </span>
            </div>

            {/* Academic Year / Right Banner */}
            <div className="flex-1 text-center sm:text-right space-y-0.5">
              <p className="text-[11px] uppercase tracking-widest text-[#444651]">
                {selectedSession || settings.sessionName}
              </p>
              <p className="text-[15px] text-[#00236f] font-bold">
                {settings.academicYear}
              </p>
              <div className="w-12 h-0.5 bg-[#0051d5] my-1 sm:ml-auto mx-auto"></div>
              <p className="text-[11px] uppercase font-semibold text-[#131b2e]">
                {headerInfo.examBadge}
              </p>
              <p className="text-[12px] text-[#444651]">
                {selectedCandidate.examCenter}
              </p>
              <p className="font-mono text-[11px] text-[#0051d5] font-semibold">
                BORDEREAU N° {selectedCandidate.matricule}
              </p>
            </div>
          </div>

          {/* Establishment Ribbon */}
          <div className="relative z-10 mt-2 mb-3 py-1.5 px-3 bg-[#eaedff] rounded text-center border border-[#dce1ff] flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-[#00236f] uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-[#0051d5]">school</span>
              <span>ÉTABLISSEMENT : {settings.institutionName.toUpperCase()}</span>
            </span>
            <span className="text-[11px] font-semibold text-[#0051d5]">
              Centre d'Examen : {selectedCandidate.examCenterName}
            </span>
          </div>

          {/* Institutional Title Badge - Dynamic according to exam session (BEPC, BAC, etc.) */}
          <div className="relative z-10 mb-4 bg-[#00236f] text-white py-2.5 px-4 text-center rounded-xs shadow-xs">
            <h1 className="text-[15px] font-bold uppercase tracking-wide">
              {headerInfo.mainTitle}
            </h1>
            <p className="text-[11px] text-[#90a8ff] tracking-wider uppercase font-semibold mt-0.5">
              {headerInfo.subTitle}
            </p>
          </div>

          {/* Candidate Identity Card */}
          <div className="relative z-10 bg-[#f2f3ff] rounded-xs p-4 mb-4 border border-[#eaedff]">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-left">
              <div className="sm:col-span-2 md:col-span-3 pb-1.5 border-b border-[#eaedff]">
                <span className="text-[10px] text-[#444651] uppercase font-bold tracking-wider block">
                  Nom et Prénoms du Candidat
                </span>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="font-mono text-[12px] font-bold text-[#0051d5] bg-white px-2.5 py-0.5 rounded border border-[#eaedff]">
                    TABLE {selectedCandidate.tableNumber}
                  </span>
                  <span className="text-[17px] text-[#00236f] font-bold tracking-tight">
                    {selectedCandidate.fullName}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-[#444651] uppercase font-bold tracking-wider block">
                  Matricule National
                </span>
                <span className="font-mono text-[13px] font-bold text-[#131b2e] block mt-0.5">
                  {selectedCandidate.matricule}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#444651] uppercase font-bold tracking-wider block">
                  Date &amp; Lieu de Naissance
                </span>
                <span className="text-[13px] text-[#131b2e] font-medium block mt-0.5">
                  {selectedCandidate.dob} à {selectedCandidate.birthPlace}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#444651] uppercase font-bold tracking-wider block">
                  Genre / Série
                </span>
                <span className="text-[13px] text-[#131b2e] font-medium block mt-0.5">
                  {selectedCandidate.gender === 'M' ? 'Masculin (M)' : 'Féminin (F)'} • {selectedCandidate.serie}
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[10px] text-[#444651] uppercase font-bold tracking-wider block">
                  Établissement d'Origine
                </span>
                <span className="text-[13px] text-[#131b2e] font-medium block mt-0.5">
                  {selectedCandidate.originSchool}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-[#444651] uppercase font-bold tracking-wider block">
                  Centre d'Examen
                </span>
                <span className="text-[13px] text-[#00236f] font-semibold block mt-0.5">
                  {selectedCandidate.examCenterName}
                </span>
              </div>
            </div>
          </div>

          {/* Official Dense Score Table */}
          <div className="relative z-10 overflow-hidden rounded-xs bg-white shadow-xs mb-4 border border-[#eaedff]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#00236f] text-white text-[12px]">
                  <th className="py-2 px-3 font-semibold text-left">Matières &amp; Disciplines</th>
                  <th className="py-2 px-2 font-semibold text-left">Enseignant Exam.</th>
                  <th className="py-2 px-2 font-semibold text-center">Coef</th>
                  <th className="py-2 px-2 font-semibold text-right">Note /20</th>
                  <th className="py-2 px-2 font-semibold text-right">Total Coef</th>
                  <th className="py-2 px-2 font-semibold text-center">Rang</th>
                  <th className="py-2 px-3 font-semibold text-left">Appréciation du professeur</th>
                </tr>
              </thead>
              <tbody className="divide-y-0 text-[#131b2e]">
                {subjects.map((subj, idx) => {
                  const gradeData = selectedCandidate.grades[subj.id];
                  const scoreTotal = gradeData ? (gradeData.score * subj.coef).toFixed(2) : '—';
                  const isEven = idx % 2 === 0;
                  const subjectRankValue = computeSubjectRank(selectedCandidate.id, subj.id, candidates);
                  const subjectRank = subjectRankValue === null ? '—' : formatSubjectRank(subjectRankValue);
                  const professorAppreciation = appreciationFromAverage(computedStats.average);

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
                      <td className="py-1.5 px-2 font-mono text-[13px] text-center font-bold">
                        {subj.coef}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[13px] text-right font-bold text-[#00236f]">
                        {gradeData ? gradeData.score.toFixed(2) : '—'}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[13px] text-right font-bold text-[#131b2e]">
                        {scoreTotal}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[11px] text-center font-semibold text-[#0051d5]">
                        {subjectRank}
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
                  <td className="py-2.5 px-2 font-mono text-[15px] text-center font-bold text-[#00236f]">
                    {computedStats.totalCoef}
                  </td>
                  <td className="py-2.5 px-2 text-right text-[12px] text-[#444651] italic">
                    Moyenne pondérée:
                  </td>
                  <td className="py-2.5 px-2 font-mono text-[15px] text-right font-bold text-[#0051d5]">
                    {computedStats.totalPoints.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[11px] text-[#444651] uppercase font-semibold" colSpan={2}>
                    Barème Total Éligibilité : {(computedStats.totalCoef * 20).toFixed(2)} PTS
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Deliberation Decision & Statistical Synthesis (Bento Grid) */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
            {/* Main Decision Card */}
            <div className="md:col-span-8 bg-[#f2f3ff] rounded-xs p-3.5 flex flex-col justify-between shadow-xs border border-[#eaedff]">
              <div className="flex items-center justify-between pb-2">
                <div>
                  <span className="text-[11px] text-[#444651] uppercase font-semibold block">
                    Décision Officielle du Conseil de Délibération
                  </span>
                  <span className="text-[17px] font-bold text-[#0051d5] flex items-center gap-2 mt-0.5">
                    <span className="material-symbols-outlined text-xl">check_circle</span>
                    {computedStats.decision}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-[#444651] uppercase font-semibold block">
                    Mention Obtenue
                  </span>
                  <span className="inline-block px-3 py-1 rounded bg-[#0051d5] text-white text-[15px] font-bold tracking-wider shadow-xs">
                    {computedStats.mention}
                  </span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xs mt-2 border border-[#eaedff]">
                <span className="text-[11px] text-[#444651] uppercase font-semibold block">
                  Observation Générale du Conseil d'Établissement
                </span>
                <p className="text-[13px] text-[#131b2e] font-medium italic mt-0.5 leading-snug">
                  {selectedCandidate.generalObservation}
                </p>
              </div>
            </div>

            {/* Metrics Summary Mini Cards */}
            <div className="md:col-span-4 grid grid-cols-2 gap-2">
              <div className="bg-white rounded-xs p-3 text-center shadow-xs flex flex-col justify-center border border-[#eaedff]">
                <span className="text-[11px] text-[#444651] uppercase font-semibold">
                  Moyenne Générale
                </span>
                <span className="font-sans text-[28px] text-[#00236f] font-bold my-0.5 leading-none">
                  {computedStats.average.toFixed(2)}
                </span>
                <span className="font-mono text-[11px] text-[#444651]">sur 20.00</span>
              </div>

              <div className="bg-white rounded-xs p-3 text-center shadow-xs flex flex-col justify-center border border-[#eaedff]">
                <span className="text-[11px] text-[#444651] uppercase font-semibold">
                  Rang de Promotion
                </span>
                <span className="font-sans text-[28px] text-[#0051d5] font-bold my-0.5 leading-none">
                  {computedStats.rank === 1 ? (
                    <span className="text-amber-600">1<span className="text-[16px]">er</span></span>
                  ) : (
                    <>
                      {computedStats.rank < 10 ? `0${computedStats.rank}` : computedStats.rank}
                      <span className="text-[15px]">e</span>
                    </>
                  )}
                </span>
                <span className="font-mono text-[11px] text-[#444651]">
                  sur {computedStats.totalCandidates} candidats
                </span>
              </div>
            </div>
          </div>

          {/* Signatures & Endorsement Section: Le Titulaire et Le Proviseur */}
          <div className="relative z-10 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto text-center">
            {/* Signature 1: Le Titulaire */}
            <div className="bulletin-signature-card flex flex-col items-center justify-between min-h-[72px] bg-[#f2f3ff]/50 px-2.5 py-1.5 rounded-xs border border-[#eaedff]">
              <div>
                <span className="text-[11px] text-[#444651] uppercase tracking-wider font-bold block leading-tight">
                  {settings.principalTeacherTitle || 'Le Titulaire'}
                </span>
                <span className="text-[13px] text-[#131b2e] font-semibold mt-0.5 block leading-tight">
                  {settings.principalTeacherName}
                </span>
              </div>

              {/* Vector Signature Artifact */}
              <div className="bulletin-signature-stroke w-24 h-6 flex items-center justify-center my-0.5">
                <svg
                  className="w-full h-full text-[#00236f]"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                  viewBox="0 0 160 50"
                >
                  <path d="M10 35 C 30 15, 45 45, 60 25 C 75 5, 80 40, 110 30 C 130 22, 140 10, 150 20 M70 20 L 130 20" />
                </svg>
              </div>
              <span className="text-[10px] text-[#444651] italic leading-tight">
                Visa apposé le 15/05/2025
              </span>
            </div>

            {/* Signature 2: Le Proviseur / Le Directeur / Le Principal (configurable) */}
            <div className="bulletin-signature-card flex flex-col items-center justify-between min-h-[72px] bg-[#f2f3ff]/50 px-2.5 py-1.5 rounded-xs relative border border-[#eaedff]">
              <div>
                <span className="text-[11px] text-[#444651] uppercase tracking-wider font-bold block leading-tight">
                  {settings.jurySignerTitle || 'Le Proviseur'}
                </span>
                <span className="text-[13px] text-[#00236f] font-bold mt-0.5 block leading-tight">
                  {selectedCandidate.digitalSignature?.signer || settings.jurySignerName}
                </span>
              </div>

              {/* Official Stamp / Cachet Humide Virtuel */}
              <div className="bulletin-signature-stamp relative w-16 h-16 my-0.5 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#0051d5]/40 flex items-center justify-center">
                  <div className="bulletin-signature-stamp-inner w-[3.25rem] h-[3.25rem] rounded-full border border-[#0051d5]/30 flex flex-col items-center justify-center overflow-hidden text-[#0051d5] transform -rotate-12 select-none">
                    <span className="w-full min-w-0 px-px text-[4px] font-bold uppercase tracking-tight text-center leading-none">
                      {settings.countryName.includes('TOGO') ? (
                        <>
                          MEPST • TOGO<br />
                          LOMÉ
                        </>
                      ) : (
                        <>
                          MINISTÈRE<br />
                          ÉDUCATION<br />
                          YAMOUSSOUKRO
                        </>
                      )}
                    </span>
                    <span className="material-symbols-outlined text-[10px]! leading-none my-0 text-[#0051d5]">
                      verified
                    </span>
                    <span className="w-full min-w-0 px-px text-[4px] font-bold uppercase tracking-tight text-center leading-none">
                      CERTIFIÉ<br />
                      CONFORME
                    </span>
                  </div>
                </div>

                {/* Dynamic ink signature */}
                <svg
                  className="bulletin-signature-stroke relative z-10 w-16 h-6 text-[#0051d5]"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                  viewBox="0 0 140 60"
                >
                  <path d="M15 45 Q 40 5, 70 30 T 120 20 Q 90 55, 60 40" />
                </svg>
              </div>
              <span className="text-[10px] text-[#444651] italic leading-tight">
                Sceau officiel de l'établissement
              </span>
            </div>
          </div>

          {/* Legal Warning Footer Note */}
          <div className="relative z-10 mt-6 pt-3 text-center space-y-0.5 border-t border-[#eaedff]">
            <p className="text-[10px] text-[#444651] tracking-wider uppercase font-semibold">
              Ce relevé d'examen blanc a valeur d'entraînement officiel sous le contrôle académique régional • Tout faux ou falsification expose à des sanctions disciplinaires et pénales.
            </p>
            <p className="font-mono text-[10px] text-[#757682]">
              Système National AcademiaBlanc • Généré en local PWA sans transmission non-chiffrée • Page 1 / 1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
