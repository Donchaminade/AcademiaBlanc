import React, { useState } from 'react';
import { Candidate, Subject, CandidateComputedStats, AppSettings } from '../types';
import { academicYearCaption, establishmentCaption, getBulletinHeaderInfo, ministrySigle } from '../utils/bulletinHeader';
import {
  appreciationFromAverage,
  computeSubjectRank,
  decisionBucket,
  formatSubjectRank,
} from '../utils/bulletinMetrics';
import { printDocument } from '../utils/printDocument';

interface AllBulletinsPrintModalProps {
  candidates: Candidate[];
  subjects: Subject[];
  allStats: Record<string, CandidateComputedStats>;
  settings: AppSettings;
  onClose: () => void;
  selectedSession?: string;
}

export const AllBulletinsPrintModal: React.FC<AllBulletinsPrintModalProps> = ({
  candidates,
  subjects,
  allStats,
  settings,
  onClose,
  selectedSession,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'admis' | 'rattrapage'>('all');
  const sealCaption = establishmentCaption(settings.institutionName);
  const yearCaption = academicYearCaption(settings.academicYear);

  const filteredCandidates = candidates.filter((c) => {
    const stats = allStats[c.id];
    if (filterType === 'admis') return decisionBucket(stats?.decision) === 'admis';
    if (filterType === 'rattrapage') {
      const bucket = decisionBucket(stats?.decision);
      return bucket === 'rattrapage' || bucket === 'ajourne';
    }
    return true;
  });

  const handlePrintAll = () => {
    if (filteredCandidates.length === 0) return;
    printDocument(
      'all-bulletins',
      `Bulletins_${settings.institutionName}_${filteredCandidates.length}`,
    );
  };

  return (
    <div className="batch-print-overlay fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex flex-col items-center">
      {/* Floating Control Toolbar (Hidden in Print) */}
      <div className="w-full bg-[#00236f] text-white px-6 py-4 shadow-xl sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 no-print border-b border-[#90a8ff]/30">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-3xl text-[#90a8ff]">
            print_connect
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold">
                Impression Groupée de Tous les Bulletins Officiels (1 Clic)
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#316bf3] text-[11px] font-bold uppercase tracking-wider">
                {filteredCandidates.length} Bulletins Prêts
              </span>
            </div>
            <p className="text-[12px] text-white/80">
              Établissement : <strong className="text-white">{settings.institutionName}</strong> • Format ISO 216 / A4 avec saut de page automatique
            </p>
          </div>
        </div>

        {/* Filter and Print Action */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter options */}
          <div className="inline-flex items-center bg-[#1e3a8a] rounded-lg p-1 text-[12px] font-medium border border-white/20">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === 'all' ? 'bg-white text-[#00236f] font-bold shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              Tous ({candidates.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('admis')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === 'admis' ? 'bg-white text-[#00236f] font-bold shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              Admis Uniquement
            </button>
            <button
              type="button"
              onClick={() => setFilterType('rattrapage')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === 'rattrapage' ? 'bg-white text-[#00236f] font-bold shadow-xs' : 'text-white/80 hover:text-white'
              }`}
            >
              Rattrapage / Ajournés
            </button>
          </div>

          {/* Big Print Button */}
          <button
            type="button"
            onClick={handlePrintAll}
            disabled={filteredCandidates.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[13px] shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-xl">print</span>
            <span>Télécharger tous les bulletins ({filteredCandidates.length})</span>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-[12px] transition-colors border border-white/20"
          >
            Fermer l'Aperçu
          </button>
        </div>
      </div>

      {/* Printable Area containing each student's A4 bulletin */}
      <div className="w-full max-w-[880px] py-8 px-4 space-y-8 print:p-0 print:m-0 print:space-y-0 print:max-w-none">
        {filteredCandidates.map((candidate, idx) => {
          const stats = allStats[candidate.id];
          const isLast = idx === filteredCandidates.length - 1;
          const headerInfo = getBulletinHeaderInfo(selectedSession || settings.sessionName, candidate.serie);
          const ministryMark = ministrySigle(settings.ministryName);

          return (
            <div
              key={candidate.id}
              className={`bulletin-sheet min-w-[800px] bg-white text-[#131b2e] rounded-xs shadow-xl p-8 sm:p-10 relative border border-[#eaedff] print:border-none print:shadow-none print:m-0 ${
                !isLast ? 'print:break-after-page' : ''
              }`}
              style={{ pageBreakAfter: isLast ? 'auto' : 'always', breakAfter: isLast ? 'auto' : 'page' }}
            >
              {/* Watermark Background Emblem (only if seal uploaded) */}
              {settings.sealUrl && settings.sealUrl.trim() !== '' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none overflow-hidden">
                  <img
                    alt="Armoiries Officielles"
                    className="w-[450px] h-[450px] object-contain"
                    src={settings.sealUrl}
                  />
                </div>
              )}

              {/* Ministère + sigle à gauche, république + devise à droite */}
              <div className="bulletin-header relative z-10 border-b border-[#eaedff]">
                <div className="bulletin-header-left">
                  <p className="bulletin-ministry-name">{settings.ministryName}</p>
                  {ministryMark ? <p className="bulletin-ministry-sigle">{ministryMark}</p> : null}
                </div>

                {/* Central Academic Seal */}
                <div className="bulletin-seal">
                  {settings.sealUrl && settings.sealUrl.trim() !== '' ? (
                    <div className="bulletin-seal-mark w-16 h-16 rounded-full bg-[#f2f3ff] flex items-center justify-center p-1.5 shadow-sm border border-[#eaedff] overflow-hidden">
                      <img
                        alt="Sceau Académique Officiel"
                        className="w-full h-full object-contain"
                        src={settings.sealUrl}
                      />
                    </div>
                  ) : (
                    /* Zone laissée vide pour tampon manuel à l'encre */
                    <div className="bulletin-seal-mark w-16 h-16 rounded-full border border-dashed border-[#b0b7cb] print:border-[#cbd5e1] flex flex-col items-center justify-center p-1 bg-transparent text-center">
                      <span className="text-[8px] text-[#6b7280] uppercase font-semibold leading-tight print:hidden">
                        Cachet
                      </span>
                      <span className="text-[7px] text-[#9ca3af] leading-tight print:hidden">
                        (Manuel)
                      </span>
                    </div>
                  )}
                  <span className="bulletin-seal-caption">{sealCaption}</span>
                </div>

                <div className="bulletin-header-right">
                  <p className="bulletin-republic-name">{settings.countryName}</p>
                  <p className="bulletin-republic-motto">{settings.motto}</p>
                </div>
              </div>

              {/* Bande de l'année académique */}
              <div className="bulletin-ribbon relative z-10 py-1.5 px-3 bg-[#eaedff] rounded border border-[#dce1ff]">
                <span className="bulletin-ribbon-year">{yearCaption}</span>
              </div>

              {/* Institutional Title Badge - Dynamic */}
              <div className="bulletin-title relative z-10 my-3 bg-[#00236f] text-white py-2 px-4 text-center rounded-xs shadow-xs">
                <h1 className="text-[14px] font-bold uppercase tracking-wide">
                  {headerInfo.mainTitle}
                </h1>
                <p className="text-[10.5px] text-[#90a8ff] tracking-wider uppercase font-semibold mt-0.5">
                  {headerInfo.subTitle}
                </p>
              </div>

              {/* Candidate Identity Card */}
              <div className="bulletin-identity relative z-10 bg-[#f2f3ff] rounded-xs p-3.5 mb-3 border border-[#eaedff]">
                <div className="bulletin-identity-grid text-left">
                  <div className="bulletin-identity-name pb-1 border-b border-[#eaedff]">
                    <span className="bulletin-field-label text-[9.5px] text-[#444651] uppercase font-bold tracking-wider">
                      Nom et Prénoms du Candidat
                    </span>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="font-mono text-[12px] font-bold text-[#0051d5] bg-white px-2 py-0.5 rounded border border-[#eaedff] whitespace-nowrap">
                        TABLE {candidate.tableNumber}
                      </span>
                      <span className="text-[16px] text-[#00236f] font-bold tracking-tight">
                        {candidate.fullName}
                      </span>
                    </div>
                  </div>

                  <span className="bulletin-field-label text-[9.5px] text-[#444651] uppercase font-bold tracking-wider">
                    Matricule National
                  </span>
                  <span className="bulletin-field-label text-[9.5px] text-[#444651] uppercase font-bold tracking-wider">
                    Date &amp; Lieu de Naissance
                  </span>
                  <span className="bulletin-field-label text-[9.5px] text-[#444651] uppercase font-bold tracking-wider">
                    Genre / Série
                  </span>

                  <span className="bulletin-field-value font-mono text-[12px] font-bold text-[#131b2e]">
                    {candidate.matricule}
                  </span>
                  <span className="bulletin-field-value text-[12px] text-[#131b2e] font-medium">
                    {candidate.dob} à {candidate.birthPlace}
                  </span>
                  <span className="bulletin-field-value bulletin-field-genre text-[12px] text-[#131b2e] font-medium">
                    {candidate.gender === 'M' ? 'Masculin (M)' : 'Féminin (F)'} • {candidate.serie}
                  </span>

                  <span className="bulletin-field-label bulletin-field-school text-[9.5px] text-[#444651] uppercase font-bold tracking-wider">
                    Établissement d'Origine
                  </span>
                  <span className="bulletin-field-label bulletin-field-center text-[9.5px] text-[#444651] uppercase font-bold tracking-wider">
                    Centre d'Examen
                  </span>

                  <span className="bulletin-field-value bulletin-field-school text-[12px] text-[#131b2e] font-medium">
                    {candidate.originSchool}
                  </span>
                  <span className="bulletin-field-value bulletin-field-center text-[12px] text-[#00236f] font-semibold">
                    {candidate.examCenterName}
                  </span>
                </div>
              </div>

              {/* Dense Score Table */}
              <div className="bulletin-table-wrap relative z-10 overflow-hidden rounded-xs bg-white shadow-xs mb-3 border border-[#eaedff]">
                <table className="bulletin-grades w-full text-left border-collapse text-[11px]">
                  <colgroup>
                    <col className="col-subject" />
                    <col className="col-teacher" />
                    <col className="col-coef" />
                    <col className="col-note" />
                    <col className="col-total" />
                    <col className="col-rank" />
                    <col className="col-appreciation" />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#00236f] text-white text-[11px]">
                      <th className="py-1.5 px-3 font-semibold text-left">Matières &amp; Disciplines</th>
                      <th className="py-1.5 px-2 font-semibold text-left">Enseignant Exam.</th>
                      <th className="py-1.5 px-2 font-semibold text-center">Coef</th>
                      <th className="py-1.5 px-2 font-semibold text-right">Note /20</th>
                      <th className="py-1.5 px-2 font-semibold text-right">Total Coef</th>
                      <th className="py-1.5 px-2 font-semibold text-center">Rang</th>
                      <th className="py-1.5 px-3 font-semibold text-left">Appréciation du professeur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-0 text-[#131b2e]">
                    {subjects.map((subj, sIdx) => {
                      const gradeData = candidate.grades[subj.id];
                      const scoreTotal = gradeData ? (gradeData.score * subj.coef).toFixed(2) : '—';
                      const isEven = sIdx % 2 === 0;
                      const subjectRankValue = computeSubjectRank(candidate.id, subj.id, candidates);
                      const professorAppreciation = appreciationFromAverage(stats?.average ?? 0);

                      return (
                        <tr
                          key={subj.id}
                          className={`${isEven ? 'bg-white' : 'bg-[#f2f3ff]/60'} border-b border-[#eaedff]/60`}
                        >
                          <td className="py-1 px-3 font-semibold text-[#00236f]">
                            {subj.name}
                          </td>
                          <td className="py-1 px-2 text-[#444651]">
                            {subj.teacher}
                          </td>
                          <td className="py-1 px-2 font-mono text-center font-bold">
                            {subj.coef}
                          </td>
                          <td className="py-1 px-2 font-mono text-right font-bold text-[#00236f]">
                            {gradeData ? gradeData.score.toFixed(2) : '—'}
                          </td>
                          <td className="py-1 px-2 font-mono text-right font-bold text-[#131b2e]">
                            {scoreTotal}
                          </td>
                          <td className="py-1 px-2 font-mono text-center font-semibold text-[#0051d5]">
                            {subjectRankValue === null ? '—' : formatSubjectRank(subjectRankValue)}
                          </td>
                          <td className="py-1 px-3 italic text-[#131b2e] leading-tight">
                            {professorAppreciation}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#eaedff] font-semibold text-[#00236f] border-t-2 border-[#00236f]">
                      <td className="py-1.5 px-3 uppercase tracking-wide" colSpan={2}>
                        TOTAL DES PONDÉRATIONS
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[13px] text-center font-bold text-[#00236f]">
                        {stats?.totalCoef || 29}
                      </td>
                      <td className="py-1.5 px-2 text-right italic text-[#444651]">
                        Moyenne :
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[13px] text-right font-bold text-[#0051d5]">
                        {stats?.totalPoints.toFixed(2) || '0.00'}
                      </td>
                      <td className="py-1.5 px-3 text-right uppercase font-semibold text-[#444651]" colSpan={2}>
                        Barème Total : {((stats?.totalCoef || 29) * 20).toFixed(2)} PTS
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Deliberation Decision & Metrics */}
              {stats && (
                <div className="bulletin-summary relative z-10">
                  <div className="bulletin-decision bg-[#f2f3ff] rounded-xs p-3 flex flex-col justify-between border border-[#eaedff]">
                    <div className="flex items-center justify-between pb-1.5">
                      <div>
                        <span className="text-[10px] text-[#444651] uppercase font-semibold block">
                          Décision Officielle du Conseil de Délibération
                        </span>
                        <span className="text-[15px] font-bold text-[#0051d5] flex items-center gap-1.5 mt-0.5">
                          <span className="material-symbols-outlined text-lg">check_circle</span>
                          {stats.decision}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#444651] uppercase font-semibold block">
                          Mention
                        </span>
                        <span className="inline-block px-2.5 py-0.5 rounded bg-[#0051d5] text-white text-[13px] font-bold">
                          {stats.mention}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-2 rounded-xs mt-1 border border-[#eaedff]">
                      <span className="text-[9.5px] text-[#444651] uppercase font-semibold block">
                        Observation Générale du Conseil
                      </span>
                      <p className="text-[11.5px] text-[#131b2e] italic mt-0.5 leading-snug">
                        {candidate.generalObservation}
                      </p>
                    </div>
                  </div>

                  <div className="bulletin-metrics">
                    <div className="bulletin-metric bg-white rounded-xs p-2 text-center border border-[#eaedff] flex flex-col justify-center">
                      <span className="text-[10px] text-[#444651] uppercase font-semibold">Moyenne</span>
                      <span className="text-[22px] text-[#00236f] font-bold leading-none my-0.5">
                        {stats.average.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-[#444651]">/ 20.00</span>
                    </div>

                    <div className="bulletin-metric bg-white rounded-xs p-2 text-center border border-[#eaedff] flex flex-col justify-center">
                      <span className="text-[10px] text-[#444651] uppercase font-semibold">Rang</span>
                      <span className="text-[22px] text-[#0051d5] font-bold leading-none my-0.5">
                        {stats.rank === 1 ? '1er' : `${stats.rank < 10 ? `0${stats.rank}` : stats.rank}e`}
                      </span>
                      <span className="text-[10px] text-[#444651]">sur {stats.totalCandidates}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Signatures Section: Le Titulaire et Le Proviseur */}
              <div className="relative z-10 pt-1 grid grid-cols-2 gap-2 max-w-xl mx-auto text-center">
                {/* Le Titulaire */}
                <div className="bulletin-signature-card flex flex-col items-center justify-between min-h-[60px] bg-[#f2f3ff]/50 px-2 py-1 rounded-xs border border-[#eaedff]">
                  <div>
                    <span className="text-[10px] text-[#444651] uppercase tracking-wider font-bold block leading-tight">
                      {settings.principalTeacherTitle || 'Le Titulaire'}
                    </span>
                    <span className="text-[12px] text-[#131b2e] font-semibold mt-0.5 block leading-tight">
                      {settings.principalTeacherName}
                    </span>
                  </div>
                  <div className="bulletin-signature-stroke w-20 h-5 flex items-center justify-center my-0.5">
                    <svg className="w-full h-full text-[#00236f]" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 160 50">
                      <path d="M10 35 C 30 15, 45 45, 60 25 C 75 5, 80 40, 110 30 C 130 22, 140 10, 150 20 M70 20 L 130 20" />
                    </svg>
                  </div>
                  <span className="text-[9px] text-[#444651] italic leading-tight">Visa certifié</span>
                </div>

                {/* Le Proviseur / Le Directeur / Le Principal */}
                <div className="bulletin-signature-card flex flex-col items-center justify-between min-h-[60px] bg-[#f2f3ff]/50 px-2 py-1 rounded-xs relative border border-[#eaedff]">
                  <div>
                    <span className="text-[10px] text-[#444651] uppercase tracking-wider font-bold block leading-tight">
                      {settings.jurySignerTitle || 'Le Proviseur'}
                    </span>
                    <span className="text-[12px] text-[#00236f] font-bold mt-0.5 block leading-tight">
                      {candidate.digitalSignature?.signer || settings.jurySignerName}
                    </span>
                  </div>
                  <div className="bulletin-signature-stamp relative w-14 h-14 my-0 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-dashed border-[#0051d5]/40 flex items-center justify-center">
                      <div className="bulletin-signature-stamp-inner w-12 h-12 rounded-full border border-[#0051d5]/30 flex flex-col items-center justify-center text-[#0051d5] transform -rotate-12 select-none">
                        <span className="text-[6px] font-bold uppercase text-center leading-none">
                          MEPST • TOGO<br />LOMÉ
                        </span>
                        <span className="text-[6.5px] font-bold uppercase leading-none">
                          CERTIFIÉ
                        </span>
                      </div>
                    </div>
                    <svg className="bulletin-signature-stroke relative z-10 w-14 h-5 text-[#0051d5]" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 140 60">
                      <path d="M15 45 Q 40 5, 70 30 T 120 20 Q 90 55, 60 40" />
                    </svg>
                  </div>
                  <span className="text-[9px] text-[#444651] italic leading-tight">Sceau officiel</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
