// Auth Check Script
// Put this at the top of protected pages

const token = localStorage.getItem('ai_ops_token');
const currentUser = localStorage.getItem('ai_ops_user');

if (!token || !currentUser) {
  window.location.href = 'login.html';
}

// Add logout function
window.logout = function() {
  localStorage.removeItem('ai_ops_token');
  localStorage.removeItem('ai_ops_user');
  window.location.href = 'login.html';
};

// Override global fetch to always include the Authorization header
const originalFetch = window.fetch;
window.fetch = function() {
  let [resource, config] = arguments;
  if(config === undefined) config = {};
  if(config.headers === undefined) config.headers = {};
  
  if (config.headers instanceof Headers) {
    config.headers.append('Authorization', `Bearer ${token}`);
  } else {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  
  return originalFetch(resource, config).then(res => {
    if (res.status === 401) {
      // Token invalid or expired
      logout();
    }
    return res;
  });
};
