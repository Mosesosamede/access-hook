import React from 'react';
import { Award, Download, ExternalLink, Calendar, ShieldCheck, FileText } from 'lucide-react';
import { motion } from 'motion/react';

interface CertificateCardProps {
  certificateId: string;
  studentName: string;
  courseName: string;
  awardDate: string;
  pdfUrl: string;
}

export function CertificateCard({
  certificateId,
  studentName,
  courseName,
  awardDate,
  pdfUrl,
}: CertificateCardProps) {
  const formattedDate = new Date(awardDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-[#26312f] border border-[#dbf0de]/10 hover:border-[#dbf0de]/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden group transition-all"
    >
      {/* Decorative gradient corners */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-[#dbf0de]/5 blur-3xl rounded-full group-hover:bg-[#dbf0de]/10 transition-colors"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-green-500/5 blur-2xl rounded-full"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-4 flex-1">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-[#dbf0de]/10 border border-[#dbf0de]/20 text-[#dbf0de] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            <Award className="w-3.5 h-3.5" /> Official Certification
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xl md:text-2xl font-extrabold text-white leading-tight">
              {courseName}
            </h3>
            <p className="text-gray-400 text-sm font-medium">
              Recipient: <span className="text-[#dbf0de] font-semibold">{studentName}</span>
            </p>
          </div>

          {/* Meta Details */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-400 pt-2 border-t border-white/5">
            <span className="flex items-center gap-1.5 font-mono text-gray-300">
              <span className="text-gray-500 font-sans">Certificate ID:</span> {certificateId}
            </span>
            <span className="flex items-center gap-1.5 text-gray-300">
              <Calendar size={13} className="text-gray-500" />
              <span className="text-gray-500">Awarded:</span> {formattedDate}
            </span>
            <span className="flex items-center gap-1 text-green-400 font-bold uppercase text-[10px]">
              <ShieldCheck size={13} /> SECURE REGISTRY VERIFIED
            </span>
          </div>
        </div>

        {/* Dynamic Interactive Action Buttons */}
        <div className="flex flex-col sm:flex-row md:flex-col gap-3 min-w-[200px] justify-end">
          {/* View certificate opens in a new tab */}
          <a
            href={`/api/certificates/download?id=${certificateId}&view=true`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-[0.98]"
          >
            <ExternalLink size={14} /> View Certificate
          </a>

          {/* Download certificate links directly to our secure proxy downloader */}
          <a
            href={`/api/certificates/download?id=${certificateId}`}
            download={`${certificateId}.pdf`}
            className="px-5 py-3 bg-[#dbf0de] hover:bg-[#cbe2ce] text-[#1a2321] rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(219,240,222,0.15)] hover:shadow-[0_4px_20px_rgba(219,240,222,0.25)] active:scale-[0.98]"
          >
            <Download size={14} /> Download Certificate
          </a>
        </div>
      </div>
    </motion.div>
  );
}
