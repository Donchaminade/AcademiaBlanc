import React, { useState } from 'react';
import { Candidate, Subject, CandidateComputedStats, AppSettings } from '../types';
import { PROMO_AVERAGES } from '../data/mockData';
import { getBulletinHeaderInfo } from '../utils/bulletinHeader';
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

          return (
            <div
              key={candidate.id}
              className={`bulletin-sheet bg-white text-[#131b2e] rounded-xs shadow-xl p-8 sm:p-10 relative border border-[#eaedff] print:border-none print:shadow-none print:m-0 ${
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

              {/* Bilateral Official Header */}
              <div className="relative z-10 flex items-start justify-between gap-4 pb-3 border-b border-[#eaedff]">
                {/* Republic / Left Banner */}
                <div className="flex-1 text-left space-y-0.5">
                  <p className="text-[11px] uppercase tracking-widest text-[#00236f] font-bold">
                    {settings.countryName}
                  </p>
                  <p className="text-[12px] italic text-[#444651] font-medium">
                    {settings.motto}
                  </p>
                  <div className="w-12 h-0.5 bg-[#0051d5] my-1"></div>
                  <p className="text-[13px] text-[#00236f] font-bold leading-tight uppercase">
                    {settings.ministryName}
                  </p>
                </div>

                {/* Central Academic Seal */}
                <div className="flex flex-col items-center justify-center px-2 shrink-0">
                  {settings.sealUrl && settings.sealUrl.trim() !== '' ? (
                    <div className="w-16 h-16 rounded-full bg-[#f2f3ff] flex items-center justify-center p-1.5 shadow-sm border border-[#eaedff] overflow-hidden">
                      <img
                        alt="Sceau Académique Officiel"
                        className="w-full h-full object-contain"
                        src={settings.sealUrl}
                      />
                    </div>
                  ) : (
                    /* Zone laissée vide pour tampon manuel à l'encre */
                    <div className="w-16 h-16 rounded-full border border-dashed border-[#b0b7cb] print:border-[#cbd5e1] flex flex-col items-center justify-center p-1 bg-transparent text-center">
                      <span className="text-[8px] text-[#6b7280] uppercase font-semibold leading-tight print:hidden">
                        Cachet
                      </span>
                      <span className="text-[7px] text-[#9ca3af] leading-tight print:hidden">
                        (Manuel)
                      </span>
                    </div>
                  )}
                  <span className="font-mono text-[9px] text-[#444651] mt-0.5 tracking-wider uppercase font-semibold">
                    SCEAU DU JURY
                  </span>
                </div>

                {/* Academic Year / Right Banner */}
                <div className="flex-1 text-right space-y-0.5">
                  <p className="text-[11px] uppercase tracking-widest text-[#444651]">
                    {selectedSession || settings.sessionName}
                  </p>
                  <p className="text-[14px] text-[#00236f] font-bold">
                    {settings.academicYear}
                  </p>
                  <div className="w-12 h-0.5 bg-[#0051d5] my-1 ml-auto"></div>
                  <p className="text-[11px] uppercase font-semibold text-[#131b2e]">
                    {headerInfo.examBadge}
                  </p>
                  <p className="font-mono text-[11px] text-[#0051d5] font-semibold">
                    TABLE N° {candidate.tableNumber} • BORDEREAU {candidate.matricule}
                  </p>
                </div>
              </div>

              {/* Establishment Name Highlight Banner */}
              <div className="relative z-10 mt-3 py-1.5 px-3 bg-[#eaedff] rounded text-center border border-[#dce1ff] flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#00236f] uppercase tracking-wider">
                  ÉTABLISSEMENT : {settings.institutionName.toUpperCase()}
                </span>
                <span className="text-[11px] font-semibold text-[#0051d5]">
                  Centre d'Examen : {candidate.examCenterName}
                </span>
              </div>

              {/* Institutional Title Badge - Dynamic */}
              <div className="relative z-10 my-3 bg-[#00236f] text-white py-2 px-4 text-center rounded-xs shadow-xs">
                <h1 className="text-[14px] font-bold uppercase tracking-wide">
                  {headerInfo.mainTitle}
                </h1>
                <p className="text-[10.5px] text-[#90a8ff] tracking-wider uppercase font-semibold mt-0.5">
                  {headerInfo.subTitle}
                </p>
              </div>

              {/* Candidate Identity Card */}
              <div className="relative z-10 bg-[#f2f3ff] rounded-xs p-3.5 mb-3 border border-[#eaedff]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-left">
                  <div className="sm:col-span-3 pb-1 border-b border-[#eaedff]">
                    <span className="text-[9.5px] text-[#444651] uppercase font-bold tracking-wider block">
                      Nom et Prénoms du Candidat
                    </span>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="font-mono text-[12px] font-bold text-[#0051d5] bg-white px-2 py-0.5 rounded border border-[#eaedff]">
                        TABLE {candidate.tableNumber}
                      </span>
                      <span className="text-[16px] text-[#00236f] font-bold tracking-tight">
                        {candidate.fullName}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9.5px] text-[#444651] uppercase font-bold tracking-wider block">
                      Matricule National
                    </span>
                    <span className="font-mono text-[12px] font-bold text-[#131b2e] block">
                      {candidate.matricule}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9.5px] text-[#444651] uppercase font-bold tracking-wider block">
                      Date &amp; Lieu de Naissance
                    </span>
                    <span className="text-[12px] text-[#131b2e] font-medium block">
                      {candidate.dob} à {candidate.birthPlace}
                    </span>
                  </div>

                  <div>
                    <span className="text-[9.5px] text-[#444651] uppercase font-bold tracking-wider block">
                      Genre / Série
                    </span>
                    <span className="text-[12px] text-[#131b2e] font-medium block">
                      {candidate.gender === 'M' ? 'Masculin (M)' : 'Féminin (F)'} • {candidate.serie}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dense Score Table */}
              <div className="relative z-10 overflow-hidden rounded-xs bg-white shadow-xs mb-3 border border-[#eaedff]">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#00236f] text-white text-[11px]">
                      <th className="py-1.5 px-3 font-semibold text-left">Matières &amp; Disciplines</th>
                      <th className="py-1.5 px-2 font-semibold text-left">Enseignant Exam.</th>
                      <th className="py-1.5 px-2 font-semibold text-center">Coef</th>
                      <th className="py-1.5 px-2 font-semibold text-right">Note /20</th>
                      <th className="py-1.5 px-2 font-semibold text-right">Total Coef</th>
                      <th className="py-1.5 px-2 font-semibold text-right">Moy. Promo</th>
                      <th className="py-1.5 px-2 font-semibold text-center">Rang</th>
                      <th className="py-1.5 px-3 font-semibold text-left">Appréciation du professeur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-0 text-[#131b2e]">
                    {subjects.map((subj, sIdx) => {
                      const gradeData = candidate.grades[subj.id];
                      const scoreTotal = gradeData ? (gradeData.score * subj.coef).toFixed(2) : '—';
                      const promoInfo = PROMO_AVERAGES[subj.id] || { avg: 10.0, rankRatio: '138' };
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
                          <td className="py-1 px-2 font-mono text-right text-[#444651]">
                            {promoInfo.avg.toFixed(2)}
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
                      <td className="py-1.5 px-3 text-right uppercase font-semibold text-[#444651]" colSpan={3}>
                        Barème Total : {((stats?.totalCoef || 29) * 20).toFixed(2)} PTS
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Deliberation Decision & Metrics */}
              {stats && (
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-2.5 mb-3">
                  <div className="md:col-span-8 bg-[#f2f3ff] rounded-xs p-3 flex flex-col justify-between border border-[#eaedff]">
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

                  <div className="md:col-span-4 grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-xs p-2 text-center border border-[#eaedff] flex flex-col justify-center">
                      <span className="text-[10px] text-[#444651] uppercase font-semibold">Moyenne</span>
                      <span className="text-[22px] text-[#00236f] font-bold leading-none my-0.5">
                        {stats.average.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-[#444651]">/ 20.00</span>
                    </div>

                    <div className="bg-white rounded-xs p-2 text-center border border-[#eaedff] flex flex-col justify-center">
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
              <div className="relative z-10 pt-2 grid grid-cols-2 gap-4 max-w-xl mx-auto text-center">
                {/* Le Titulaire */}
                <div className="flex flex-col items-center justify-between min-h-[105px] bg-[#f2f3ff]/50 p-2.5 rounded-xs border border-[#eaedff]">
                  <div>
                    <span className="text-[10px] text-[#444651] uppercase tracking-wider font-bold block">
                      {settings.principalTeacherTitle || 'Le Titulaire'}
                    </span>
                    <span className="text-[12px] text-[#131b2e] font-semibold mt-0.5 block">
                      {settings.principalTeacherName}
                    </span>
                  </div>
                  <div className="w-24 h-8 flex items-center justify-center my-1">
                    <svg className="w-full h-full text-[#00236f]" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 160 50">
                      <path d="M10 35 C 30 15, 45 45, 60 25 C 75 5, 80 40, 110 30 C 130 22, 140 10, 150 20 M70 20 L 130 20" />
                    </svg>
                  </div>
                  <span className="text-[9px] text-[#444651] italic">Visa certifié</span>
                </div>

                {/* Le Proviseur / Le Directeur / Le Principal */}
                <div className="flex flex-col items-center justify-between min-h-[105px] bg-[#f2f3ff]/50 p-2.5 rounded-xs relative border border-[#eaedff]">
                  <div>
                    <span className="text-[10px] text-[#444651] uppercase tracking-wider font-bold block">
                      {settings.jurySignerTitle || 'Le Proviseur'}
                    </span>
                    <span className="text-[12px] text-[#00236f] font-bold mt-0.5 block">
                      {candidate.digitalSignature?.signer || settings.jurySignerName}
                    </span>
                  </div>
                  <div className="relative w-20 h-16 my-0.5 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-dashed border-[#0051d5]/40 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full border border-[#0051d5]/30 flex flex-col items-center justify-center text-[#0051d5] transform -rotate-12 select-none">
                        <span className="text-[6.5px] font-bold uppercase text-center leading-tight">
                          MEPST • TOGO<br />LOMÉ
                        </span>
                        <span className="text-[7px] font-bold uppercase">
                          CERTIFIÉ
                        </span>
                      </div>
                    </div>
                    <svg className="relative z-10 w-20 h-8 text-[#0051d5]" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 140 60">
                      <path d="M15 45 Q 40 5, 70 30 T 120 20 Q 90 55, 60 40" />
                    </svg>
                  </div>
                  <span className="text-[9px] text-[#444651] italic">Sceau officiel</span>
                </div>
              </div>

              {/* Legal Note */}
              <div className="relative z-10 mt-3 pt-2 text-center border-t border-[#eaedff]">
                <p className="font-mono text-[9px] text-[#757682]">
                  Système AcademiaBlanc • Établissement : {settings.institutionName} • Candidat {idx + 1} / {filteredCandidates.length}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
