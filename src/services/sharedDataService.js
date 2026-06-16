import { requestSharedApi } from '../lib/apiClient';

export const sharedDataService = {
  getHealth: (options) => requestSharedApi('/health', options),

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
};
