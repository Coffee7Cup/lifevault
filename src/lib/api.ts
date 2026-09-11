import axios from 'axios';
import type { AssetItem, DocumentItem, TrustedPerson, UserProfile } from '../types';

export const TOKEN_KEY = 'lifevault_token';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || fallback;
  }
  return fallback;
};

export const normalizeDocument = (raw: unknown): DocumentItem => {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const id = String(value.id ?? '');
  const fileName = String(value.fileName ?? value.filename ?? value.original_name ?? '');
  const uploadedAt = String(value.uploadedAt ?? value.uploaded_at ?? value.created_at ?? value.uploadDate ?? '');
  const fileType = String(value.fileType ?? value.mimeType ?? value.mime_type ?? (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : ''));

  return {
    ...value,
    id,
    title: String(value.title ?? ''),
    category: String(value.category ?? '') as DocumentItem['category'],
    fileName,
    fileSize: String(value.fileSize ?? value.file_size ?? ''),
    uploadDate: String(value.uploadDate ?? uploadedAt),
    uploadedAt,
    fileUrl: String(value.fileUrl ?? value.file_url ?? (id ? `/api/vault/documents/${id}/file` : '')),
    fileType,
    mimeType: String(value.mimeType ?? fileType),
    extractedKeyData: Array.isArray(value.extractedKeyData) ? value.extractedKeyData as DocumentItem['extractedKeyData'] : [],
  };
};

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export const signup = async (
  name: string,
  email: string,
  password: string,
  emergencyContact: string,
): Promise<AuthResponse> => {
  try {
    const response = await api.post<AuthResponse>('/auth/signup', {
      name,
      email,
      password,
      emergencyContact,
    });
    localStorage.setItem(TOKEN_KEY, response.data.token);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to create your account.'));
  }
};

export const login = async (email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await api.post<AuthResponse>('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, response.data.token);
    return response.data;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Invalid email or password.'));
  }
};

export const getMe = async (token: string): Promise<UserProfile> => {
  try {
    const response = await api.get<{ user: UserProfile }>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.user;
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Your session has expired.'));
  }
};

export const getAssets = () => api.get<AssetItem[]>('/vault/assets').then((response) => response.data);
export const getDocuments = () => api.get<DocumentItem[]>('/vault/documents').then((response) => response.data);
export const getTrustedPeople = () => api.get<TrustedPerson[]>('/vault/trusted-people').then((response) => response.data);

export const createAsset = (asset: AssetItem) => api.post<AssetItem>('/vault/assets', asset).then((response) => response.data);
export const updateAsset = (id: string, asset: Partial<AssetItem>) => api.patch<AssetItem>(`/vault/assets/${id}`, asset).then((response) => response.data);
export const deleteAsset = (id: string) => api.delete(`/vault/assets/${id}`);

export const createDocument = (document: DocumentItem) => api.post<DocumentItem>('/vault/documents', document).then((response) => response.data);
export const deleteDocument = (id: string) => api.delete(`/vault/documents/${id}`);

export const uploadDocument = async (
  file: File,
  title: string,
  category: string,
  token: string,
): Promise<DocumentItem> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  formData.append('category', category);
  try {
    const response = await api.post<{ document?: DocumentItem } | DocumentItem>('/vault/documents', formData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const responseData = response.data;
    const uploaded =
      responseData && typeof responseData === 'object' && 'document' in responseData
        ? responseData.document
        : responseData;
    if (!uploaded || typeof uploaded !== 'object') {
      throw new Error('Upload succeeded but the server returned no document.');
    }
    const normalized = normalizeDocument(uploaded);
    if (!normalized.id) throw new Error('Upload succeeded but the server returned no document ID.');
    return normalized;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 413) throw new Error('File is too large. The maximum size is 25MB.');
      if (error.response?.status === 401) throw new Error('Your session has expired. Please sign in again.');
      if (error.response?.status === 400) throw new Error(error.response.data?.error || 'Invalid file type.');
      if (!error.response) throw new Error('Network error. Check your connection and try again.');
    }
    throw new Error('Unable to upload this document.');
  }
};

export const getDocumentFileUrl = async (id: string, token: string): Promise<string> => {
  try {
    const response = await api.get(`/vault/documents/${id}/file`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    });
    return URL.createObjectURL(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) throw new Error('Your session has expired. Please sign in again.');
      if (!error.response) throw new Error('Network error. Check your connection and try again.');
    }
    throw new Error('Unable to open this document.');
  }
};

export const listDocuments = async (token: string): Promise<DocumentItem[]> => {
  try {
    const response = await api.get<{ documents?: unknown[] } | unknown[]>('/vault/documents', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rawDocuments = Array.isArray(response.data) ? response.data : response.data.documents;
    return (rawDocuments ?? []).map(normalizeDocument);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) throw new Error('Your session has expired. Please sign in again.');
      if (!error.response) throw new Error('Network error. Check your connection and try again.');
    }
    throw new Error('Unable to load your documents.');
  }
};

export const deleteDocumentApi = (id: string, token: string) =>
  api.delete(`/vault/documents/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const createTrustedPerson = (person: TrustedPerson) => api.post<TrustedPerson>('/vault/trusted-people', person).then((response) => response.data);
export const updateTrustedPerson = (id: string, person: Partial<TrustedPerson>) => api.patch<TrustedPerson>(`/vault/trusted-people/${id}`, person).then((response) => response.data);
export const deleteTrustedPerson = (id: string) => api.delete(`/vault/trusted-people/${id}`);

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
