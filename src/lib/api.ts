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

export const createTrustedPerson = (person: TrustedPerson) => api.post<TrustedPerson>('/vault/trusted-people', person).then((response) => response.data);
export const updateTrustedPerson = (id: string, person: Partial<TrustedPerson>) => api.patch<TrustedPerson>(`/vault/trusted-people/${id}`, person).then((response) => response.data);
export const deleteTrustedPerson = (id: string) => api.delete(`/vault/trusted-people/${id}`);

export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
