import axios from 'axios';

const API_URL = 'http://127.0.0.1:5000';

// Configure axios defaults
axios.defaults.headers.post['Content-Type'] = 'application/json';
axios.defaults.headers.put['Content-Type'] = 'application/json';

// Projects API - matching your backend exactly
export const getProjects = (userId) =>
  axios.get(`${API_URL}/users/${userId}/projects`);
export const createProject = (userId, project) =>
  axios.post(`${API_URL}/users/${userId}/projects`, project, {
    headers: { 'Content-Type': 'application/json' },
  });
export const updateProject = (userId, projectId, project) =>
  axios.put(`${API_URL}/users/${userId}/projects/${projectId}`, project, {
    headers: { 'Content-Type': 'application/json' },
  });
export const deleteProject = (userId, projectId) =>
  axios.delete(`${API_URL}/users/${userId}/projects/${projectId}`);
export const getProject = (userId, projectId) =>
  axios.get(`${API_URL}/users/${userId}/projects/${projectId}`);

export const saveProject = (userId, projectId, updatedFilesArr) =>
  axios.put(
    `${API_URL}/users/${userId}/projects/${projectId}/save`,
    updatedFilesArr,
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

// AI Review API
export const getSecurityReview = (userId, projectId) =>
  axios.post(
    `${API_URL}/users/${userId}/projects/${projectId}/security-review`,
    {},
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

export const getLogicReview = (userId, submissionId, activeFile) =>
  axios.post(
    `${API_URL}/users/${userId}/submissions/${submissionId}/logic-review`,
    activeFile, 
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

export const getTestCases = (userId, submissionId, activeFile) =>
  axios.post(
    `${API_URL}/users/${userId}/submissions/${submissionId}/testing-review`,
    activeFile, 
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

// File submissions API - matching your backend exactly
export const getSubmissions = (userId, projectId) =>
  axios.get(`${API_URL}/users/${userId}/projects/${projectId}/submissions`);
export const createSubmission = (userId, projectId, submission) =>
  axios.post(
    `${API_URL}/users/${userId}/projects/${projectId}/submissions`,
    submission,
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

// File/folder movement API - updates submission filename (which includes folder path)
// This is how folders work: they're implicit in the file path, not separate backend entities
export const moveSubmission = (userId, submissionId, newFilename) =>
  axios.put(
    `${API_URL}/users/${userId}/submissions/${submissionId}`,
    { filename: newFilename },
    { headers: { 'Content-Type': 'application/json' } },
  );

export const updateSubmission = (userId, submissionId, submission) =>
  axios.put(
    `${API_URL}/users/${userId}/submissions/${submissionId}`,
    submission,
    {
      headers: { 'Content-Type': 'application/json' },
    },
  );

export const deleteSubmission = (userId, submissionId) =>
  axios.delete(`${API_URL}/users/${userId}/submissions/${submissionId}`);

// Legacy API (keeping for backward compatibility)
export const getItems = () => axios.get(`${API_URL}/items`);
export const createItem = (item) => axios.post(`${API_URL}/items`, item);
export const updateItem = (id, item) =>
  axios.put(`${API_URL}/items/${id}`, item);
export const deleteItem = (id) => axios.delete(`${API_URL}/items/${id}`);

// ===== GitHub Integration =====
export const listGithubRepos = (userId, { perPage = 100, page = 1 } = {}) =>
  axios.get(`${API_URL}/users/${userId}/github/repos`, {
    params: { per_page: perPage, page },
    headers: (() => {
      const token =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('github_access_token')
          : undefined;
      return token ? { Authorization: `Bearer ${token}` } : {};
    })(),
  });

export const linkGithubRepo = (
  userId,
  projectId,
  { repo_full_name, branch = 'main' },
) =>
  axios.post(
    `${API_URL}/users/${userId}/projects/${projectId}/github/link`,
    { repo_full_name, branch },
    {
      headers: (() => {
        const token =
          typeof localStorage !== 'undefined'
            ? localStorage.getItem('github_access_token')
            : undefined;
        return token ? { Authorization: `Bearer ${token}` } : {};
      })(),
    },
  );

export const importGithubRepo = (
  userId,
  projectId,
  { repo_full_name, branch, max_files, max_bytes } = {},
) =>
  axios.post(
    `${API_URL}/users/${userId}/projects/${projectId}/github/import`,
    { repo_full_name, branch, max_files, max_bytes },
    {
      headers: (() => {
        const token =
          typeof localStorage !== 'undefined'
            ? localStorage.getItem('github_access_token')
            : undefined;
        return token ? { Authorization: `Bearer ${token}` } : {};
      })(),
    },
  );
