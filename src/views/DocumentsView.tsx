import React, { useEffect, useRef, useState } from 'react';
import { useVault } from '../context/VaultContext';
import {
  FileText,
  UploadCloud,
  Search,
  Eye,
  Trash2,
  Scan,
  Camera,
  Image,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { deleteDocumentApi, getDocumentFileUrl, listDocuments, normalizeDocument, uploadDocument } from '../lib/api';

export const DocumentsView: React.FC = () => {
  const {
    documents: vaultDocuments,
    addDocument,
    replaceDocuments,
    showToast,
    theme,
  } = useVault();

  const documents = vaultDocuments ?? [];

  const isDark = theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocIndex, setSelectedDocIndex] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [filePickerAccept, setFilePickerAccept] = useState<string | undefined>();
  const [filePickerCapture, setFilePickerCapture] = useState<'environment' | undefined>();
  const [uploadCategory, setUploadCategory] = useState('personal');
  const [uploadKind, setUploadKind] = useState<'image' | 'pdf'>('image');
  const [documentFileUrls, setDocumentFileUrls] = useState<Record<string, string>>({});
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('lifevault_token');
    if (!token) return;

    listDocuments(token)
      .then((serverDocuments) => replaceDocuments((serverDocuments ?? []).map(normalizeDocument)))
      .catch((error) => {
        replaceDocuments([]);
        showToast({
          type: 'warning',
          title: 'Documents Could Not Load',
          message: error instanceof Error ? error.message : 'Unable to load your documents.',
        });
      });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('lifevault_token');
    if (!token) {
      setDocumentFileUrls({});
      return;
    }

    let cancelled = false;
    let createdUrls: string[] = [];
    Promise.all(
      (documents ?? []).map(async (document) => {
        if (!document?.id) return null;
        try {
          const url = await getDocumentFileUrl(document.id, token);
          return [document.id, url] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      const validEntries = entries.filter((entry): entry is readonly [string, string] => entry !== null);
      createdUrls = validEntries.map(([, url]) => url);
      if (cancelled) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setDocumentFileUrls(Object.fromEntries(validEntries));
    });

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [documents]);

  const openFilePicker = (category: string, kind: 'image' | 'pdf', accept: string, capture?: 'environment') => {
    setUploadCategory(category);
    setUploadKind(kind);
    setFilePickerAccept(accept);
    setFilePickerCapture(capture);
    const input = fileInputRef.current;
    if (input) {
      input.accept = accept;
      if (capture) {
        input.setAttribute('capture', capture);
      } else {
        input.removeAttribute('capture');
      }
      input.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(file.name);
    if ((uploadKind === 'pdf' && !isPdf) || (uploadKind === 'image' && !isImage)) {
      showToast({ type: 'warning', title: 'Invalid File Type', message: uploadKind === 'pdf' ? 'Please select a PDF file.' : 'Please select an image file.' });
      return;
    }

    const token = localStorage.getItem('lifevault_token');
    if (!token) {
      showToast({ type: 'warning', title: 'Authentication Required', message: 'Sign in again before uploading a document.' });
      return;
    }

    setIsScanning(true);
    setScanStep('Uploading securely...');

    try {
      const uploaded = await uploadDocument(file, file.name, uploadCategory, token);
      console.log('Uploaded document:', uploaded);
      if (!uploaded || typeof uploaded !== 'object') {
        showToast({ type: 'warning', title: 'Document Upload Failed', message: 'The server returned no document.' });
        return;
      }
      await addDocument(normalizeDocument(uploaded));
      const refreshedDocuments = await listDocuments(token);
      replaceDocuments(refreshedDocuments.map(normalizeDocument));
      setScanStep('');
    } catch (error) {
      showToast({
        type: 'warning',
        title: 'Document Upload Failed',
        message: error instanceof Error ? error.message : 'Unable to upload this document.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const openDocumentFile = async (id: string) => {
    const existingUrl = documentFileUrls[id];
    if (existingUrl) {
      window.open(existingUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const token = localStorage.getItem('lifevault_token');
    if (!token) {
      showToast({ type: 'warning', title: 'Authentication Required', message: 'Sign in again before opening this document.' });
      return;
    }

    try {
      const url = await getDocumentFileUrl(id, token);
      setDocumentFileUrls((current) => ({ ...current, [id]: url }));
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      showToast({ type: 'warning', title: 'Document Could Not Open', message: error instanceof Error ? error.message : 'Unable to open this document.' });
    }
  };

  const handleDeleteDocument = async (id: string) => {
    const token = localStorage.getItem('lifevault_token');
    if (!token) {
      showToast({ type: 'warning', title: 'Authentication Required', message: 'Sign in again before deleting a document.' });
      return;
    }

    setDeletingDocumentId(id);
    try {
      await deleteDocumentApi(id, token);
      replaceDocuments((documents ?? []).filter((document) => document.id !== id));
      if (selectedDoc?.id === id) setSelectedDocIndex(null);
    } catch (error) {
      showToast({
        type: 'warning',
        title: 'Document Not Deleted',
        message: error instanceof Error ? error.message : 'Unable to delete this document.',
      });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const categories = [
    {
      id: 'all',
      label: 'All Files',
    },
    {
      id: 'legal',
      label: 'Wills & Deeds',
    },
    {
      id: 'insurance',
      label: 'Insurance',
    },
    {
      id: 'financial',
      label: 'Tax & Banks',
    },
  ];

  const filteredDocs = (documents ?? []).filter((doc) => {
    const query = searchQuery.toLowerCase();
    const title = String(doc?.title ?? '');
    const fileName = String(doc?.fileName ?? '');
    const category = String(doc?.category ?? '');

    const matchesSearch =
      title.toLowerCase().includes(query) ||
      fileName.toLowerCase().includes(query) ||
      category.toLowerCase().includes(query);

    const matchesCategory =
      activeCategory === 'all' ||
      String(doc?.category ?? '') === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const selectedDoc =
    selectedDocIndex !== null
      ? filteredDocs[selectedDocIndex]
      : null;

  const handleNextDoc = () => {
    if (
      selectedDocIndex !== null &&
      selectedDocIndex < filteredDocs.length - 1
    ) {
      setSelectedDocIndex(selectedDocIndex + 1);
    }
  };

  const handlePrevDoc = () => {
    if (
      selectedDocIndex !== null &&
      selectedDocIndex > 0
    ) {
      setSelectedDocIndex(selectedDocIndex - 1);
    }
  };

  return (
    <div className="space-y-8 pb-16">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.45,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5"
      >
        <div>
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-3 ${
              isDark
                ? 'border-white/10 bg-white/[0.03] text-emerald-400'
                : 'border-black/10 bg-black/[0.02] text-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Secure document storage</span>
          </div>

          <h1
            className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
              isDark
                ? 'text-white'
                : 'text-neutral-900'
            }`}
          >
            Document Vault
          </h1>

          <p className="text-sm text-neutral-500 mt-2 max-w-2xl leading-relaxed">
            Store, organize and securely access important documents from one
            protected workspace.
          </p>
        </div>

        {/* Search */}

        <div className="relative w-full lg:w-80">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
          />

          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(e.target.value)
            }
            className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none transition-all ${
              isDark
                ? 'bg-[#101010] border-white/10 text-white placeholder:text-neutral-600 focus:border-emerald-500/50'
                : 'bg-white border-black/10 text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-600/50'
            }`}
          />
        </div>
      </motion.section>


      {/* =====================================================
          CATEGORY FILTERS
      ===================================================== */}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
      >
        {categories.map((category) => {
          const active =
            activeCategory === category.id;

          return (
            <button
              key={category.id}
              onClick={() =>
                setActiveCategory(category.id)
              }
              className={`px-4 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                active
                  ? isDark
                    ? 'bg-white text-black'
                    : 'bg-neutral-900 text-white'
                  : isDark
                  ? 'border border-white/10 text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  : 'border border-black/10 text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.03]'
              }`}
            >
              {category.label}
            </button>
          );
        })}
      </motion.div>


      {/* =====================================================
          UPLOAD AREA
      ===================================================== */}

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.45,
          delay: 0.1,
        }}
        className={`border rounded-2xl p-7 sm:p-10 ${
          isDark
            ? 'bg-[#0d0d0d] border-white/10'
            : 'bg-white border-black/10'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={filePickerAccept}
          capture={filePickerCapture}
          onChange={handleFileChange}
          className="hidden"
        />

        {isScanning ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">

            <motion.div
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'linear',
              }}
              className={`w-14 h-14 rounded-full border-2 flex items-center justify-center ${
                isDark
                  ? 'border-white/10 border-t-emerald-400'
                  : 'border-black/10 border-t-emerald-600'
              }`}
            >
              <Scan
                className={`w-6 h-6 ${
                  isDark
                    ? 'text-emerald-400'
                    : 'text-emerald-600'
                }`}
              />
            </motion.div>

            <h3
              className={`mt-5 text-sm font-bold ${
                isDark
                  ? 'text-white'
                  : 'text-neutral-900'
              }`}
            >
              Processing document
            </h3>

            <p className="text-xs text-neutral-500 mt-2 font-mono">
              {scanStep}
            </p>
          </div>
        ) : (
          <div className="text-center">

            <div
              className={`mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center ${
                isDark
                  ? 'bg-white/[0.03] border-white/10 text-neutral-300'
                  : 'bg-black/[0.02] border-black/10 text-neutral-700'
              }`}
            >
              <UploadCloud className="w-6 h-6" />
            </div>

            <h2
              className={`mt-5 text-lg font-bold ${
                isDark
                  ? 'text-white'
                  : 'text-neutral-900'
              }`}
            >
              Add a document
            </h2>

            <p className="text-xs text-neutral-500 mt-2 max-w-md mx-auto">
              Upload important documents and keep them organized
              inside your secure vault.
            </p>

            <div className="flex flex-wrap justify-center gap-2.5 mt-6">

              <button
                onClick={() => openFilePicker('personal', 'image', 'image/*', 'environment')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all hover:-translate-y-0.5 ${
                  isDark
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-neutral-900 text-white hover:bg-neutral-800'
                }`}
              >
                <Camera className="w-4 h-4" />
                Camera Scan
              </button>

              <button
                onClick={() => openFilePicker('personal', 'image', 'image/*')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-bold transition-all hover:-translate-y-0.5 ${
                  isDark
                    ? 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
                    : 'border-black/10 text-neutral-700 hover:bg-black/[0.03]'
                }`}
              >
                <Image className="w-4 h-4" />
                Gallery & Images
              </button>

              <button
                onClick={() => openFilePicker('legal', 'pdf', '.pdf,application/pdf')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-bold transition-all hover:-translate-y-0.5 ${
                  isDark
                    ? 'border-white/10 text-neutral-300 hover:bg-white/[0.05]'
                    : 'border-black/10 text-neutral-700 hover:bg-black/[0.03]'
                }`}
              >
                <FileText className="w-4 h-4" />
                Upload PDF
              </button>

            </div>
          </div>
        )}
      </motion.section>


      {/* =====================================================
          DOCUMENT COUNT
      ===================================================== */}

      <div className="flex items-center justify-between">

        <div>
          <h2
            className={`text-lg font-bold ${
              isDark
                ? 'text-white'
                : 'text-neutral-900'
            }`}
          >
            Your Documents
          </h2>

          <p className="text-xs text-neutral-500 mt-1">
            {filteredDocs.length} document
            {filteredDocs.length !== 1 ? 's' : ''} available
          </p>
        </div>

      </div>


      {/* =====================================================
          DOCUMENT GRID
      ===================================================== */}

      {filteredDocs.length > 0 ? (

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {filteredDocs.map((doc, idx) => (

            (() => {
              const fileName = String(doc?.fileName ?? '');
              const isPdf = doc?.mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
              const isImage = doc?.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(fileName);

              return (

            <motion.article
              key={doc.id}
              onClick={() => {
                if (isPdf || isImage) void openDocumentFile(doc.id);
              }}
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.35,
                delay: idx * 0.05,
              }}
              whileHover={{
                y: -3,
              }}
              className={`group rounded-2xl border p-5 transition-all ${
                isDark
                  ? 'bg-[#0d0d0d] border-white/10 hover:border-white/20'
                  : 'bg-white border-black/10 hover:border-black/20'
              }`}
            >

              {/* Top */}

              <div className="flex items-start justify-between gap-3">

                <div
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                    isDark
                      ? 'border-white/10 bg-white/[0.03] text-neutral-300'
                      : 'border-black/10 bg-black/[0.02] text-neutral-700'
                  }`}
                >
                  {isImage && documentFileUrls[doc.id] ? (
                    <img src={documentFileUrls[doc.id]} alt={doc.title} className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <FileText className={`${isPdf ? 'w-7 h-7' : 'w-5 h-5'}`} />
                  )}
                </div>

                <div className="flex items-center gap-2">

                  {doc.isVerified && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold ${
                        isDark
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteDocument(doc.id);
                    }}
                    disabled={deletingDocumentId === doc.id}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark
                        ? 'text-neutral-600 hover:text-red-400 hover:bg-red-500/10'
                        : 'text-neutral-400 hover:text-red-600 hover:bg-red-50'
                    }`}
                    title="Delete document"
                    aria-label="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                </div>
              </div>


              {/* Information */}

              <div className="mt-5">

                <h3
                  className={`text-sm font-bold truncate ${
                    isDark
                      ? 'text-white'
                      : 'text-neutral-900'
                  }`}
                >
                  {String(doc?.title ?? '')}
                </h3>

                <p className="text-xs text-neutral-500 mt-1 truncate">
                  {fileName}
                </p>

                <div className="flex items-center gap-2 mt-4 text-[11px] text-neutral-500">
                  <span>{doc.fileSize}</span>
                  <span>•</span>
                  <span>
                    {String(doc?.category ?? '')}
                  </span>
                </div>

              </div>


              {/* Bottom */}

              <div
                className={`mt-5 pt-4 border-t flex items-center justify-between ${
                  isDark
                    ? 'border-white/[0.08]'
                    : 'border-black/[0.07]'
                }`}
              >

                <span className="text-[10px] text-neutral-500">
                  Uploaded {doc.uploadDate}
                </span>

                <button
                  onClick={() => {
                    if (isPdf || isImage) {
                      void openDocumentFile(doc.id);
                    } else {
                      setSelectedDocIndex(idx);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  View
                </button>

              </div>

            </motion.article>
              );
            })()

          ))}

        </div>

      ) : (

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`border rounded-2xl py-16 text-center ${
            isDark
              ? 'border-white/10 bg-[#0d0d0d]'
              : 'border-black/10 bg-white'
          }`}
        >
          <FileText
            className="w-10 h-10 mx-auto text-neutral-400"
          />

          <h3
            className={`mt-4 text-sm font-bold ${
              isDark
                ? 'text-white'
                : 'text-neutral-900'
            }`}
          >
            No documents found
          </h3>

          <p className="text-xs text-neutral-500 mt-1">
            Try changing your search or category filter.
          </p>
        </motion.div>

      )}


      {/* =====================================================
          DOCUMENT MODAL
      ===================================================== */}

      <AnimatePresence>

        {selectedDoc && selectedDocIndex !== null && (

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

            {/* Backdrop */}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() =>
                setSelectedDocIndex(null)
              }
              className="fixed inset-0 bg-black/70"
            />


            {/* Modal */}

            <motion.div
              initial={{
                opacity: 0,
                y: 20,
                scale: 0.98,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 20,
                scale: 0.98,
              }}
              transition={{
                duration: 0.25,
              }}
              className={`relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 ${
                isDark
                  ? 'bg-[#0d0d0d] border-white/10 text-white'
                  : 'bg-white border-black/10 text-neutral-900'
              }`}
            >

              {/* Modal Header */}

              <div
                className={`flex items-center justify-between pb-5 border-b ${
                  isDark
                    ? 'border-white/10'
                    : 'border-black/10'
                }`}
              >

                <div className="flex items-center gap-3 min-w-0">

                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                      isDark
                        ? 'border-white/10 text-neutral-300'
                        : 'border-black/10 text-neutral-700'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="min-w-0">

                    <h3 className="text-base font-bold truncate">
                      {String(selectedDoc.title ?? '')}
                    </h3>

                    <p className="text-xs text-neutral-500 truncate">
                      {String(selectedDoc.fileName ?? '')}
                    </p>

                  </div>

                </div>

                <button
                  onClick={() =>
                    setSelectedDocIndex(null)
                  }
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    isDark
                      ? 'text-neutral-400 hover:text-white hover:bg-white/[0.06]'
                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-black/[0.04]'
                  }`}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>

              </div>


              {/* Verification */}

              <div className="mt-6">

                <div
                  className={`flex items-center gap-3 p-4 rounded-xl border ${
                    isDark
                      ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                      : 'border-emerald-600/20 bg-emerald-50'
                  }`}
                >

                  <CheckCircle2
                    className={`w-5 h-5 ${
                      isDark
                        ? 'text-emerald-400'
                        : 'text-emerald-700'
                    }`}
                  />

                  <div>

                    <div
                      className={`text-xs font-bold ${
                        isDark
                          ? 'text-emerald-400'
                          : 'text-emerald-800'
                      }`}
                    >
                      Document verified
                    </div>

                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      Integrity check completed successfully.
                    </div>

                  </div>

                </div>

              </div>


              {/* Metadata */}

              <div className="mt-6">

                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
                  Document information
                </h4>

                <div
                  className={`border rounded-xl overflow-hidden ${
                    isDark
                      ? 'border-white/10'
                      : 'border-black/10'
                  }`}
                >

                      {(selectedDoc.extractedKeyData ?? []).map(
                    (item, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3 ${
                          idx !==
                          (selectedDoc.extractedKeyData ?? []).length - 1
                            ? isDark
                              ? 'border-b border-white/[0.07]'
                              : 'border-b border-black/[0.07]'
                            : ''
                        }`}
                      >

                        <span className="text-xs text-neutral-500">
                          {String(item?.key ?? '')}
                        </span>

                        <span
                          className={`text-xs font-semibold ${
                            isDark
                              ? 'text-neutral-200'
                              : 'text-neutral-800'
                          }`}
                        >
                          {String(item?.value ?? '')}
                        </span>

                      </div>
                    )
                  )}

                </div>

              </div>


              {/* Technical details */}

              <div className="mt-6">

                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
                  Security details
                </h4>

                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 gap-3`}
                >

                  <div
                    className={`p-4 rounded-xl border ${
                      isDark
                        ? 'border-white/10'
                        : 'border-black/10'
                    }`}
                  >
                    <span className="text-[10px] text-neutral-500 block">
                      Encryption
                    </span>

                    <span className="text-xs font-semibold mt-1 block">
                      {selectedDoc.encryptionType}
                    </span>
                  </div>

                  <div
                    className={`p-4 rounded-xl border ${
                      isDark
                        ? 'border-white/10'
                        : 'border-black/10'
                    }`}
                  >
                    <span className="text-[10px] text-neutral-500 block">
                      OCR Confidence
                    </span>

                    <span className="text-xs font-semibold mt-1 block">
                      {selectedDoc.ocrConfidence}%
                    </span>
                  </div>

                </div>

              </div>


              {/* Navigation */}

              <div
                className={`mt-6 pt-5 border-t flex items-center justify-between ${
                  isDark
                    ? 'border-white/10'
                    : 'border-black/10'
                }`}
              >

                <div className="flex items-center gap-2">

                  <button
                    onClick={handlePrevDoc}
                    disabled={
                      selectedDocIndex === 0
                    }
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-30 ${
                      isDark
                        ? 'border-white/10 hover:bg-white/[0.05]'
                        : 'border-black/10 hover:bg-black/[0.03]'
                    }`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-xs text-neutral-500 font-mono">
                    {selectedDocIndex + 1} /{' '}
                    {filteredDocs.length}
                  </span>

                  <button
                    onClick={handleNextDoc}
                    disabled={
                      selectedDocIndex ===
                      filteredDocs.length - 1
                    }
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-30 ${
                      isDark
                        ? 'border-white/10 hover:bg-white/[0.05]'
                        : 'border-black/10 hover:bg-black/[0.03]'
                    }`}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                </div>

                <button
                  onClick={() =>
                    setSelectedDocIndex(null)
                  }
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold ${
                    isDark
                      ? 'bg-white text-black hover:bg-neutral-200'
                      : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                >
                  Done
                </button>

              </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>

    </div>
  );
};