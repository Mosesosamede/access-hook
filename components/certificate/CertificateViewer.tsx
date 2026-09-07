import React, { useState } from 'react';
import { Eye, Loader2, Download, ExternalLink, ShieldCheck, QrCode, FileText } from 'lucide-react';
import { motion } from 'motion/react';

interface CertificateViewerProps {
  pdfUrl: string;
  certificateId: string;
  studentName?: string;
  awardDate?: string;
  courseName?: string;
}

export function CertificateViewer({ 
  pdfUrl, 
  certificateId,
  studentName = "Valued Scholar",
  awardDate,
  courseName = "Workplace Readiness Professional Development"
}: CertificateViewerProps) {
  const [loading, setLoading] = useState(true);

  // Format award date nicely
  const formattedDate = awardDate ? new Date(awardDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }) : new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#1c2624] border border-white/5 rounded-3xl p-4 md:p-6 shadow-xl space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <Eye size={18} className="text-[#dbf0de]" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            Certificate Preview — {certificateId}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-green-400 font-bold uppercase tracking-wide">
          <ShieldCheck size={13} className="text-green-400 animate-pulse" /> CRYPTO-SIGNED & SECURE
        </div>
      </div>

      {/* DESKTOP ONLY: PDF Iframe Renderer */}
      <div className="hidden md:block relative aspect-[1.414/1] w-full bg-black/40 rounded-2xl overflow-hidden border border-white/5">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1c2624]/90 z-10 space-y-3">
            <Loader2 className="w-8 h-8 text-[#dbf0de] animate-spin" />
            <p className="text-xs text-gray-400 font-medium">Loading high-resolution certificate...</p>
          </div>
        )}

        <iframe
          src={`/api/certificates/download?id=${certificateId}&view=true#toolbar=0&navpanes=0`}
          className="w-full h-full border-0"
          onLoad={() => setLoading(false)}
          title={`Certificate Preview: ${certificateId}`}
          referrerPolicy="no-referrer"
        />
      </div>

      {/* MOBILE ONLY: Stunning HTML/CSS Certificate Mockup (avoiding Safari/iOS iframe zoom bug) */}
      <div className="block md:hidden">
        <div className="relative w-full aspect-[1.414/1] bg-[#121a18] rounded-2xl border-2 border-amber-500/30 overflow-hidden p-4 flex flex-col justify-between shadow-2xl">
          {/* Elegant geometric corner accents */}
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-500/50" />
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-500/50" />
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-500/50" />
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-500/50" />

          {/* Secure watermark background */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5 select-none">
            <div className="w-40 h-40 border-8 border-white rounded-full flex items-center justify-center">
              <span className="font-bold text-lg">DELOXE</span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center mt-2 z-10">
            <h5 className="font-mono text-[9px] text-amber-500/70 tracking-[0.2em] uppercase font-bold">
              Deloxe HR Academy
            </h5>
            <h4 className="text-[11px] font-extrabold text-white tracking-widest mt-1 uppercase">
              Certificate of Completion
            </h4>
            <div className="w-12 h-[1px] bg-amber-500/30 mx-auto mt-2" />
          </div>

          {/* Recipient info */}
          <div className="text-center space-y-1.5 z-10 my-auto">
            <p className="text-[8px] font-mono text-gray-500 italic">This is proudly awarded to</p>
            <h3 className="text-sm font-serif font-black italic text-[#DFFF00] tracking-wide capitalize px-2 truncate drop-shadow">
              {studentName}
            </h3>
            <p className="text-[7px] text-gray-400 max-w-[85%] mx-auto leading-normal">
              for successfully completing the final professional assessment and academic curriculum for
            </p>
            <p className="text-[8px] font-extrabold text-white uppercase tracking-wider px-2">
              {courseName}
            </p>
          </div>

          {/* Signatures & Verification */}
          <div className="flex items-end justify-between px-2 pb-1 z-10">
            {/* Verification Code */}
            <div className="flex flex-col text-left space-y-0.5">
              <span className="text-[6px] font-mono text-gray-500 uppercase">Credential ID</span>
              <span className="text-[7px] font-mono font-bold text-gray-300">{certificateId}</span>
            </div>

            {/* Logo/Seal */}
            <div className="flex flex-col items-center justify-center -mb-1">
              <div className="w-8 h-8 rounded-full border border-amber-500/40 bg-amber-500/5 flex items-center justify-center shadow-lg">
                <ShieldCheck size={14} className="text-amber-500" />
              </div>
              <span className="text-[5px] font-mono text-amber-500/80 uppercase font-black tracking-widest mt-0.5">VERIFIED</span>
            </div>

            {/* Award Date */}
            <div className="flex flex-col text-right space-y-0.5">
              <span className="text-[6px] font-mono text-gray-500 uppercase">Issue Date</span>
              <span className="text-[7px] font-mono font-bold text-gray-300">{formattedDate}</span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 text-center mt-2 italic">
          Above is a digital responsive preview. Standard high-resolution PDF preview option is optimized for desktop screens.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 pt-1 border-t border-white/5">
        <p className="text-[11px] text-center sm:text-left">Use the actions below to open or download the high-resolution certificate PDF.</p>
        <div className="flex items-center gap-3">
          <a
            href={`/api/certificates/download?id=${certificateId}&view=true`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-gray-300 hover:text-[#dbf0de] transition-colors"
          >
            <ExternalLink size={13} /> Open full size
          </a>
          <span>|</span>
          <a
            href={`/api/certificates/download?id=${certificateId}`}
            download={`${certificateId}.pdf`}
            className="flex items-center gap-1.5 text-gray-300 hover:text-[#dbf0de] transition-colors"
          >
            <Download size={13} /> Direct Download
          </a>
        </div>
      </div>
    </motion.div>
  );
}

