// src/api.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true, // allow cookies (refresh token)
});

// Request interceptor → attach access token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor → refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshResponse = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = refreshResponse.data.accessToken;
        localStorage.setItem("accessToken", newAccessToken);

        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${newAccessToken}`;
        originalRequest.headers[
          "Authorization"
        ] = `Bearer ${newAccessToken}`;

        return api(originalRequest); // retry the failed request
      } catch (refreshError) {
        console.error("Refresh token expired, please log in again.");
        localStorage.removeItem("accessToken");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
 