'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button, Input, Select, EmptyState, Badge, useToast } from '@/components/ui'
import { useStageGuard } from '@/hooks/useStageGuard'

interface Document {
  id: string
  filename: string
  file_type: string | null
  file_size_bytes: number | null
  description: string | null
  uploaded_at: string | null
}

interface DocumentLink {
  id: string
  document_id: string
  indicator_id: string | null
  link_note: string | null
  indicators?: { label: string } | null
}

interface Indicator {
  id: string
  pillar: string
  label: string
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon(type: string | null) {
  if (!type) return '📄'
  if (type.includes('pdf')) return '📕'
  if (type.includes('word') || type.includes('document')) return '📘'
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return '📗'
  if (type.includes('image')) return '🖼️'
  return '📄'
}

export default function DocumentVaultPage() {
  const { workspaceId, cycleId } = useParams<{ workspaceId: string; cycleId: string }>()
  const guard = useStageGuard(workspaceId, cycleId, 5)
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { success, error: toastError, info } = useToast()

  const [documents, setDocuments] = useState<Document[]>([])
  const [links, setLinks] = useState<DocumentLink[]>([])
  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [description, setDescription] = useState('')
  const [linkingDocId, setLinkingDocId] = useState<string | null>(null)
  const [linkIndicatorId, setLinkIndicatorId] = useState('')
  const [linkNote, setLinkNote] = useState('')
  const [savingLink, setSavingLink] = useState(false)

  const fetchData = useCallback(async () => {
    const { data: docs } = await supabase
      .from('documents')
      .select('id, filename, file_type, file_size_bytes, description, uploaded_at')
      .eq('cycle_id', cycleId)
      .order('uploaded_at', { ascending: false })

    const { data: docLinks } = await supabase
      .from('document_links')
      .select(`id, document_id, indicator_id, link_note, indicators ( label )`)
      .in('document_id', (docs ?? []).map((d) => d.id))

    const { data: ci } = await supabase
      .from('cycle_indicators')
      .select(`indicators ( id, pillar, label )`)
      .eq('cycle_id', cycleId)
      .neq('inclusion_source', 'manual_exclude')

    const inds = (ci ?? [])
      .map((row) => {
        const ind = Array.isArray(row.indicators) ? row.indicators[0] : row.indicators
        return ind as Indicator | null
      })
      .filter(Boolean) as Indicator[]

    inds.sort((a, b) => a.pillar.localeCompare(b.pillar) || a.label.localeCompare(b.label))

    setDocuments(docs ?? [])
    setLinks((docLinks ?? []) as DocumentLink[])
    setIndicators(inds)
    setLoading(false)
  }, [cycleId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return

  setUploading(true)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    toastError('Session expired. Please sign in again.')
    setUploading(false)
    return
  }

  // Compute SHA-256 hash for duplicate detection
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  // Check for duplicate
  const { data: existing } = await supabase
    .from('documents')
    .select('id, filename')
    .eq('file_hash', fileHash)
    .eq('cycle_id', cycleId)

  if (existing && existing.length > 0) {
    toastError(`Duplicate file detected. This file was already uploaded as "${existing[0].filename}".`)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploading(false)
    return
  }

  const storagePath = `${workspaceId}/${cycleId}/${Date.now()}_${file.name}`
    const { error: storageError } = await supabase.storage
      .from('esg-documents')
      .upload(storagePath, file, { upsert: false })

    if (storageError) {
      toastError(`Upload failed: ${storageError.message}`)
      setUploading(false)
      return
    }

    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert({
  workspace_id: workspaceId,
  cycle_id: cycleId,
  filename: file.name,
  storage_path: storagePath,
  file_type: file.type || null,
  file_size_bytes: file.size,
  file_hash: fileHash,
  description: description.trim() || null,
  uploaded_by: user.id,
})
      .select('id, filename, file_type, file_size_bytes, description, uploaded_at')
      .single()

    if (dbError || !doc) {
      toastError('Failed to save document record.')
      setUploading(false)
      return
    }

    setDocuments((prev) => [doc, ...prev])
    setDescription('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploading(false)
    success(`"${file.name}" uploaded successfully.`)
  }

  async function handleAddLink() {
    if (!linkingDocId) return
    setSavingLink(true)

    const { data, error } = await supabase
      .from('document_links')
      .insert({
        document_id: linkingDocId,
        indicator_id: linkIndicatorId || null,
        link_note: linkNote.trim() || null,
      })
      .select(`id, document_id, indicator_id, link_note, indicators ( label )`)
      .single()

    if (error) {
      toastError('Failed to save link.')
      setSavingLink(false)
      return
    }

    setLinks((prev) => [...prev, data as DocumentLink])
    setLinkingDocId(null)
    setLinkIndicatorId('')
    setLinkNote('')
    setSavingLink(false)
    success('Document linked successfully.')
  }

  async function handleDeleteLink(linkId: string) {
    const { error } = await supabase.from('document_links').delete().eq('id', linkId)
    if (error) { toastError('Failed to remove link.'); return }
    setLinks((prev) => prev.filter((l) => l.id !== linkId))
  }

  async function handleDeleteDoc(doc: Document) {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return

    const { data: dbDoc } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', doc.id)
      .single()

    if (dbDoc?.storage_path) {
      await supabase.storage.from('esg-documents').remove([dbDoc.storage_path])
    }

    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (error) { toastError('Failed to delete document.'); return }

    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    setLinks((prev) => prev.filter((l) => l.document_id !== doc.id))
    success(`"${doc.filename}" deleted.`)
  }

  async function handleDownload(doc: Document) {
    info('Preparing download...')
    const { data: dbDoc } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', doc.id)
      .single()

    if (!dbDoc?.storage_path) { toastError('File path not found.'); return }

    const { data } = await supabase.storage
      .from('esg-documents')
      .createSignedUrl(dbDoc.storage_path, 60)

    if (data?.signedUrl) {
  const a = document.createElement('a')
  a.href = data.signedUrl
  a.target = '_blank'
  a.click()
} else {
  toastError('Failed to generate download link.')
}
  }

  function getLinksForDoc(docId: string) {
    return links.filter((l) => l.document_id === docId)
  }

  const indicatorOptions = [
    { value: '', label: 'General (no specific indicator)' },
    ...indicators.map((ind) => ({
      value: ind.id,
      label: `[${ind.pillar}] ${ind.label}`,
    })),
  ]
if (guard.checking || !guard.allowed) return null
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspaceId}/cycles/${cycleId}`}
          className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block"
        >
          ← Back to cycle
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Document vault</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload evidence documents and link them to specific indicators.
        </p>
      </div>

      {/* Upload panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Upload document</h2>
        <div className="space-y-3">
          <Input
            label="Document description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. FY2024 electricity invoices, HR policy v2.1"
          />
          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center
                       hover:border-sky-300 hover:bg-sky-50 transition-colors cursor-pointer"
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sky-600">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm">Uploading...</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-700">Click to select a file</p>
                <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, CSV, or image files</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-20 animate-pulse" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            title="No documents uploaded yet"
            description="Upload evidence documents to support your indicator responses."
            icon={
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 px-1">
            {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
          </p>

          {documents.map((doc) => {
            const docLinks = getLinksForDoc(doc.id)
            const isLinking = linkingDocId === doc.id

            return (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-200">
                <div className="flex items-center gap-3 px-5 py-4">
                  <span className="text-xl flex-shrink-0">{fileIcon(doc.file_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {doc.description && (
                        <p className="text-xs text-gray-500 truncate">{doc.description}</p>
                      )}
                      <span className="text-xs text-gray-300">{formatBytes(doc.file_size_bytes)}</span>
                      {doc.uploaded_at && (
                        <span className="text-xs text-gray-300">
                          {new Date(doc.uploaded_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    {docLinks.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {docLinks.map((link) => {
                          const indLabel = link.indicators
                            ? (Array.isArray(link.indicators)
                              ? (link.indicators as { label: string }[])[0]?.label
                              : (link.indicators as { label: string }).label)
                            : null
                          return (
                            <div key={link.id} className="flex items-center gap-1">
                              <Badge variant="sky">{indLabel ?? 'General'}</Badge>
                              <button
                                onClick={() => handleDeleteLink(link.id)}
                                className="text-gray-300 hover:text-red-400 transition-colors"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setLinkingDocId(isLinking ? null : doc.id)
                        setLinkIndicatorId('')
                        setLinkNote('')
                      }}
                    >
                      Link
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                    >
                      Download
                    </Button>
                    <button
                      onClick={() => handleDeleteDoc(doc)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isLinking && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
                    <p className="text-xs font-medium text-gray-700">Link this document to an indicator</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        label="Indicator"
                        value={linkIndicatorId}
                        onChange={(e) => setLinkIndicatorId(e.target.value)}
                        options={indicatorOptions}
                      />
                      <Input
                        label="Link note (optional)"
                        value={linkNote}
                        onChange={(e) => setLinkNote(e.target.value)}
                        placeholder="e.g. Supports energy consumption data"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" loading={savingLink} onClick={handleAddLink}>
                        Save link
                      </Button>
                      <button
                        onClick={() => setLinkingDocId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

                    <div className="pt-2">
            <Button
              onClick={() => window.location.href = `/workspaces/${workspaceId}/cycles/${cycleId}/scoring`}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              }
              iconPosition="right"
            >
              Continue to scoring
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}