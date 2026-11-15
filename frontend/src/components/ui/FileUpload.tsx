import React, { useCallback, useState } from 'react'
import { Upload, AlertCircle, CheckCircle } from 'lucide-react'
import { cn, formatFileSize } from '../../lib/utils'

interface FileUploadProps {
  accept?: string
  multiple?: boolean
  maxSize?: number          // in MB when number, used as bytes fallback
  onFile?: (file: File) => void
  onFiles?: (files: File[]) => void
  progress?: number         // 0-100 when uploading
  className?: string
  label?: string
  sublabel?: string
  hint?: string
  uploading?: boolean
}

export default function FileUpload({
  accept,
  multiple = false,
  maxSize = 100,
  onFile,
  onFiles,
  progress,
  className,
  label,
  sublabel,
  hint,
  uploading,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // maxSize is in MB
  const maxBytes = maxSize * 1024 * 1024

  const isUploading = uploading || (progress !== undefined && progress > 0 && progress < 100)

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return
      setError(null)
      setDone(false)
      const arr = Array.from(fileList)
      const valid: File[] = []
      for (const f of arr) {
        if (f.size > maxBytes) {
          setError(`${f.name} exceeds ${maxSize} MB limit`)
          return
        }
        valid.push(f)
      }
      if (!valid.length) return
      if (onFile) onFile(valid[0])
      if (onFiles) onFiles(multiple ? valid : [valid[0]])
    },
    [maxBytes, maxSize, onFile, onFiles, multiple]
  )

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = () => setIsDragging(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className={cn('w-full', className)}>
      <label
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 w-full rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 py-10 px-6',
          isDragging
            ? 'border-[#00D6C9] bg-[#00D6C9]/5 scale-[1.01]'
            : 'border-[#243550] bg-[#111B2B]/50 hover:border-[#00D6C9]/50 hover:bg-[#00D6C9]/5',
          isUploading && 'opacity-60 pointer-events-none'
        )}
      >
        <input
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={isUploading}
        />
        <div className="w-12 h-12 rounded-xl bg-[#00D6C9]/10 border border-[#00D6C9]/20 flex items-center justify-center">
          <Upload className="w-6 h-6 text-[#00D6C9]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-[#8899AA]">
            {isDragging ? 'Drop to upload' : (label || 'Drag & drop or click to browse')}
          </p>
          {(sublabel || hint) && (
            <p className="text-xs text-[#4A5568] mt-1">{sublabel || hint}</p>
          )}
          <p className="text-xs text-[#4A5568] mt-1">Max {maxSize} MB</p>
        </div>
      </label>

      {/* Progress bar */}
      {progress !== undefined && progress > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-[#8899AA] mb-1">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-[#1A2740] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00D6C9] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[#FF4757]">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  )
}

export { FileUpload }
