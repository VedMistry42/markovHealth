"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileText, AlertCircle, X, CheckCircle2 } from "lucide-react"

interface FileDropzoneProps {
  onUploadComplete: (patientId: string, summary: string, fileCount: number) => void
  onProcessingStart: () => void
}

const ACCEPTED_TYPES = ["application/pdf", "text/plain"]
const MAX_SIZE_MB = 5
const MAX_FILES = 5

function isValidType(file: File) {
  return ACCEPTED_TYPES.includes(file.type) || file.name.endsWith(".pdf") || file.name.endsWith(".txt")
}

export default function FileDropzone({ onUploadComplete, onProcessingStart }: FileDropzoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  function validateFiles(files: File[]): string | null {
    if (files.length > MAX_FILES) return `Maximum ${MAX_FILES} files at once.`
    for (const file of files) {
      if (!isValidType(file)) return `"${file.name}" is not a PDF or TXT file.`
      if (file.size > MAX_SIZE_MB * 1024 * 1024) return `"${file.name}" must be under ${MAX_SIZE_MB} MB.`
    }
    return null
  }

  async function uploadFiles(files: File[]) {
    const err = validateFiles(files)
    if (err) { setFileError(err); return }

    setFileError(null)
    setSelectedFiles(files)
    setUploading(true)
    onProcessingStart()

    const formData = new FormData()
    for (const file of files) formData.append("file", file)

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }
      const { patientId, deidentifiedSummary, fileCount } = await res.json()
      onUploadComplete(patientId, deidentifiedSummary, fileCount)
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Upload failed.")
      setSelectedFiles([])
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) uploadFiles(files)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) uploadFiles(files)
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <motion.label
        htmlFor="file-upload"
        animate={dragActive ? { scale: 1.02 } : { scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-4 w-full h-56 rounded-3xl border-2 border-dashed cursor-pointer
          transition-all duration-300 shadow-lg overflow-hidden group
          ${dragActive
            ? "border-rose-400 bg-rose-50/80 scale-[1.02]"
            : "border-rose-200/60 bg-white/60 hover:border-rose-300 hover:bg-white/80"
          }
        `}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-rose-100/20 via-transparent to-rose-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <AnimatePresence mode="wait">
          {selectedFiles.length > 0 ? (
            <motion.div
              key="selected"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-2 z-10 pointer-events-none"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              <p className="text-sm font-semibold text-gray-900">
                {selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} ready
              </p>
              <p className="text-xs text-gray-500">{selectedFiles.map((f) => f.name).join(", ")}</p>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 z-10"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm ${dragActive ? "bg-rose-100" : "bg-white border border-rose-50"}`}>
                <Upload className={`w-8 h-8 ${dragActive ? "text-rose-600" : "text-rose-400 group-hover:text-rose-500 transition-colors"}`} />
              </div>
              <div className="text-center px-4">
                <p className="text-base font-semibold text-gray-900">Click or drag your medical records here</p>
                <p className="text-sm text-gray-500 mt-1">PDF or TXT · Up to {MAX_FILES} files · Max {MAX_SIZE_MB}MB each</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <input id="file-upload" type="file" accept=".pdf,.txt" multiple className="hidden" onChange={handleChange} />
      </motion.label>

      {/* File list */}
      <AnimatePresence>
        {selectedFiles.length > 1 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-2 overflow-hidden"
          >
            {selectedFiles.map((file, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between bg-white border border-rose-100 rounded-xl px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]">{file.name}</span>
                  <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                </div>
                {!uploading && (
                  <button onClick={(e) => { e.preventDefault(); removeFile(i) }} className="text-gray-400 hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fileError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 flex items-center justify-center gap-2 text-rose-600 text-sm font-medium"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {fileError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
