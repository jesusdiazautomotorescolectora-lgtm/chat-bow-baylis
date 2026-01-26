import axios from "axios";

export const CORE_API_URL = import.meta.env.VITE_CORE_API_URL as string;
export const TENANT_ID = import.meta.env.VITE_TENANT_ID as string;

export const api = axios.create({
  baseURL: CORE_API_URL,
  headers: { "x-tenant-id": TENANT_ID }
});
