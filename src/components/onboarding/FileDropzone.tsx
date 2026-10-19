'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw, Trash2, FileCheck } from 'lucide-react';

interface FileDropzoneProps {
  onFileUploaded: (data: { resumeUrl: string; fileName: string; skills: string[]; text?: string }) => void;
  currentResumeUrl?: string | null;
  currentFileName?: string | null;
  onRemove?: () => void;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileUploaded,
  currentResumeUrl,
  currentFileName,
  onRemove,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    // Validate file type
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    const isExtValid = /\.(pdf|docx|doc)$/i.test(file.name);

    if (!validTypes.includes(file.type) && !isExtValid) {
      setUploadError('Invalid format. Please upload a PDF or DOCX file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10MB limit.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      // 1. Upload to /api/resume/upload (Supabase Storage)
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error || 'Failed to upload resume');
      }

      // 2. Parse resume to extract skills
      const parseRes = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_url: uploadData.resume_url,
          file_name: uploadData.file_name,
        }),
      });

      const parseData = await parseRes.json();

      onFileUploaded({
        resumeUrl: uploadData.resume_url,
        fileName: uploadData.file_name,
        skills: parseData.skills || [],
        text: parseData.text,
      });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload process failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleInputChange}
        accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
      />

      {uploadError && (
        <div className="p-3 rounded-xl bg-[#FFF1F2] border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {!currentResumeUrl ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
            isDragging
              ? 'border-cyan-600 bg-[#ECFEFF] scale-[1.01]'
              : 'border-[#CBD5E1] hover:border-cyan-500 bg-[#F8FAFC] hover:bg-slate-50'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-white text-cyan-600 border border-[#E2E8F0] flex items-center justify-center shadow-sm">
            {isUploading ? (
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-600" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>

          <div>
            <p className="text-sm font-bold text-[#0F172A] font-heading">
              {isUploading
                ? 'Uploading & extracting skills...'
                : 'Drag & drop your resume here, or browse files'}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Supports PDF and DOCX (up to 10MB) • Stored securely in Supabase Storage
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-[#ECFEFF] border border-cyan-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-sm">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0F172A] truncate max-w-sm">
                {currentFileName || 'Resume uploaded'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-semibold text-cyan-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-cyan-600" />
                  Uploaded to Supabase
                </span>
                <a
                  href={currentResumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#475569] hover:text-cyan-800 underline"
                >
                  View file
                </a>
              </div>
            </div>
          </div>

          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-2 text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              title="Remove resume"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
