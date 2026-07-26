import { requestSharedApi } from '../lib/apiClient';

export const sharedDataService = {
  getHealth: (options) => requestSharedApi('/health', options),
  updateMyProfile: (profile) => requestSharedApi('/users/me', { method: 'PATCH', body: profile }),

  listContacts: (options) => requestSharedApi('/contacts', options),
  createContact: (contact) => requestSharedApi('/contacts', { method: 'POST', body: contact }),
  updateContact: (contactId, contact) => requestSharedApi(`/contacts/${contactId}`, { method: 'PATCH', body: contact }),
  deleteContact: (contactId) => requestSharedApi(`/contacts/${contactId}`, { method: 'DELETE' }),

  listClosingCompanies: (options) => requestSharedApi('/closing-companies', options),
  updateClosingCompany: (companyId, patch) => requestSharedApi(`/closing-companies/${companyId}`, { method: 'PATCH', body: patch }),

  listTodos: (options) => requestSharedApi('/todos', options),
  createTodo: (todo) => requestSharedApi('/todos', { method: 'POST', body: todo }),
  updateTodo: (todoId, todo) => requestSharedApi(`/todos/${todoId}`, { method: 'PATCH', body: todo }),
  deleteTodo: (todoId) => requestSharedApi(`/todos/${todoId}`, { method: 'DELETE' }),

  createBackup: (backup) => requestSharedApi('/backups', { method: 'POST', body: backup }),
  listBackups: (options) => requestSharedApi('/backups', options),
  importWorkspace: (payload) => requestSharedApi('/migration/import', { method: 'POST', body: payload }),
  syncWorkspace: (payload) => requestSharedApi('/sync/workspace', { method: 'POST', body: payload }),
  downloadWorkspace: (options) => requestSharedApi('/sync/workspace', options),
  listCloudFiles: (options) => requestSharedApi('/files', options),
  presignCloudFile: (payload) => requestSharedApi('/files/presign', { method: 'POST', body: payload }),
  completeCloudFile: (payload) => requestSharedApi('/files/complete', { method: 'POST', body: payload }),
  downloadCloudFile: (key) => requestSharedApi('/files/download-url', { method: 'POST', body: { key } }),
  deleteCloudFile: (key) => requestSharedApi('/files', { method: 'DELETE', body: { key } }),
};
